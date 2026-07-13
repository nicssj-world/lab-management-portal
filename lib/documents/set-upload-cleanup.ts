import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

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

export async function cleanupExpiredSetUploads(limit = 10) {
  const { data: uploads, error } = await supabaseAdmin
    .from('document_set_uploads')
    .select('id, storage_key')
    .is('claimed_at', null)
    .lt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
    .limit(Math.max(1, Math.min(limit, 25)))
  if (error) throw new Error(error.message)

  for (const upload of uploads ?? []) {
    if (await isSetUploadKeyReferenced(upload.storage_key)) {
      const claimed = await supabaseAdmin
        .from('document_set_uploads')
        .update({ claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', upload.id)
        .is('claimed_at', null)
      if (claimed.error) throw new Error(claimed.error.message)
      continue
    }

    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: upload.storage_key }))
    const deleted = await supabaseAdmin
      .from('document_set_uploads')
      .delete()
      .eq('id', upload.id)
      .is('claimed_at', null)
    if (deleted.error) throw new Error(deleted.error.message)
  }
}
