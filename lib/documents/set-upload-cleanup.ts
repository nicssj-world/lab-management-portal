import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

const CLEANUP_LEASE_MS = 5 * 60 * 1000
const CLAIMED_RETENTION_DAYS = 30

export type SetUploadCleanupSummary = {
  attempted: number
  succeeded: number
  failures: { id: string; error: string }[]
}

export async function runSetUploadCleanupCandidates<T extends { id: string }>(
  candidates: readonly T[],
  processCandidate: (candidate: T, now: Date) => Promise<void>,
  now: () => Date = () => new Date(),
): Promise<SetUploadCleanupSummary> {
  const summary: SetUploadCleanupSummary = { attempted: 0, succeeded: 0, failures: [] }
  for (const candidate of candidates) {
    summary.attempted += 1
    try {
      await processCandidate(candidate, now())
      summary.succeeded += 1
    } catch (error) {
      summary.failures.push({
        id: candidate.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return summary
}

export function runSetUploadMaintenance(
  cleanup: () => Promise<SetUploadCleanupSummary>,
  prune: () => Promise<void>,
) {
  return Promise.allSettled([
    Promise.resolve().then(cleanup),
    Promise.resolve().then(prune),
  ] as const)
}

async function hasRows(query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) {
  const result = await query
  if (result.error) throw new Error(result.error.message)
  return Boolean(result.data?.length)
}

export async function isSetUploadKeyReferenced(key: string) {
  const checks = await Promise.all([
    hasRows(supabaseAdmin.from('documents').select('id').or(`file_url.eq.${key},source_pdf_url.eq.${key},word_url.eq.${key},pending_file_url.eq.${key}`).limit(1)),
    hasRows(supabaseAdmin.from('document_revisions').select('id').or(`file_url.eq.${key},source_pdf_url.eq.${key},word_url.eq.${key}`).limit(1)),
    hasRows(supabaseAdmin.from('document_attachments').select('id').eq('file_url', key).limit(1)),
    hasRows(supabaseAdmin.from('document_revision_drafts').select('id').or(`file_url.eq.${key},source_pdf_url.eq.${key},word_url.eq.${key}`).limit(1)),
    hasRows(supabaseAdmin.from('document_revision_draft_attachments').select('id').eq('file_url', key).limit(1)),
  ])
  return checks.some(Boolean)
}

async function releaseCleanupLease(uploadId: string, leaseToken: string) {
  const released = await supabaseAdmin
    .from('document_set_uploads')
    .update({ lease_token: null, lease_kind: null, lease_expires_at: null, updated_at: new Date().toISOString() })
    .eq('id', uploadId)
    .eq('lease_token', leaseToken)
    .eq('lease_kind', 'cleanup')
    .is('claimed_at', null)
  if (released.error) throw new Error(released.error.message)
}

export async function cleanupExpiredSetUploads(limit = 10) {
  const selectionNowIso = new Date().toISOString()
  const boundedLimit = Math.max(1, Math.min(limit, 25))
  const { data: candidates, error } = await supabaseAdmin
    .from('document_set_uploads')
    .select('id')
    .is('claimed_at', null)
    .lt('expires_at', selectionNowIso)
    .or(`lease_token.is.null,lease_expires_at.lt.${selectionNowIso}`)
    .order('expires_at', { ascending: true })
    .limit(boundedLimit)
  if (error) throw new Error(error.message)

  return runSetUploadCleanupCandidates(candidates ?? [], async (candidate, now) => {
    const nowIso = now.toISOString()
    const leaseToken = crypto.randomUUID()
    const leased = await supabaseAdmin
      .from('document_set_uploads')
      .update({
        lease_token: leaseToken,
        lease_kind: 'cleanup',
        lease_expires_at: new Date(now.getTime() + CLEANUP_LEASE_MS).toISOString(),
        updated_at: nowIso,
      })
      .eq('id', candidate.id)
      .is('claimed_at', null)
      .lt('expires_at', nowIso)
      .or(`lease_token.is.null,lease_expires_at.lt.${nowIso}`)
      .select('id, storage_key')
      .maybeSingle()
    if (leased.error) throw new Error(leased.error.message)
    if (!leased.data) return

    try {
      if (await isSetUploadKeyReferenced(leased.data.storage_key)) {
        const claimed = await supabaseAdmin
          .from('document_set_uploads')
          .update({
            claimed_at: new Date().toISOString(),
            lease_token: null,
            lease_kind: null,
            lease_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', leased.data.id)
          .eq('lease_token', leaseToken)
          .eq('lease_kind', 'cleanup')
          .is('claimed_at', null)
          .select('id')
          .maybeSingle()
        if (claimed.error) throw new Error(claimed.error.message)
        if (!claimed.data) throw new Error('Set upload cleanup lease changed before reference claim')
        return
      }

      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: leased.data.storage_key }))
      const deleted = await supabaseAdmin
        .from('document_set_uploads')
        .delete()
        .eq('id', leased.data.id)
        .eq('lease_token', leaseToken)
        .eq('lease_kind', 'cleanup')
        .is('claimed_at', null)
        .select('id')
        .maybeSingle()
      if (deleted.error) throw new Error(deleted.error.message)
      if (!deleted.data) throw new Error('Set upload cleanup lease changed before ticket deletion')
    } catch (cleanupError) {
      try {
        await releaseCleanupLease(leased.data.id, leaseToken)
      } catch (releaseError) {
        console.error('Set upload cleanup lease release failed', {
          uploadId: leased.data.id,
          error: releaseError instanceof Error ? releaseError.message : String(releaseError),
        })
      }
      throw cleanupError
    }
  })
}

export async function pruneClaimedSetUploads(limit = 25, retentionDays = CLAIMED_RETENTION_DAYS) {
  const boundedLimit = Math.max(1, Math.min(limit, 100))
  const boundedDays = Math.max(1, retentionDays)
  const cutoff = new Date(Date.now() - boundedDays * 24 * 60 * 60 * 1000).toISOString()
  const selected = await supabaseAdmin
    .from('document_set_uploads')
    .select('id')
    .not('claimed_at', 'is', null)
    .lt('claimed_at', cutoff)
    .order('claimed_at', { ascending: true })
    .limit(boundedLimit)
  if (selected.error) throw new Error(selected.error.message)
  const ids = (selected.data ?? []).map((row) => row.id)
  if (ids.length === 0) return

  const deleted = await supabaseAdmin
    .from('document_set_uploads')
    .delete()
    .in('id', ids)
    .not('claimed_at', 'is', null)
    .lt('claimed_at', cutoff)
  if (deleted.error) throw new Error(deleted.error.message)
}
