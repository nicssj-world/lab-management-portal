import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { isReviewOnlyType } from '@/lib/documents/review'
import { appendRevisionHistoryPdf, generateRevisionHistoryPdfForDocument } from '@/lib/documents/revision-history-pdf'
import type { Document } from '@/lib/supabase/types'

const MAX_BULK_IDS = 100
const ANNUAL_REVIEW_NOTE = 'ทบทวนแล้ว ไม่มีการแก้ไข'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role, doc_role, name').eq('id', user.id).single()
  return data as { id: string; role: string; doc_role: string | null; name: string | null } | null
}

async function getObjectBuffer(key: string) {
  const object = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  const body = object.Body
  if (!body) throw new Error('ไม่พบไฟล์ทางการใน R2')
  if ('transformToByteArray' in body && typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray())
  }
  const chunks: Uint8Array[] = []
  for await (const chunk of body as AsyncIterable<Uint8Array | Buffer>) {
    chunks.push(chunk instanceof Buffer ? new Uint8Array(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

// Look up the current holder of a doc_role (for the approver name on the review row). Returns
// the first active profile with that role, or null.
async function roleHolderName(docRole: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('name')
    .eq('doc_role', docRole)
    .eq('status', 'active')
    .order('name')
    .limit(1)
  return data?.[0]?.name ?? null
}

function fileIsPdf(doc: Document): boolean {
  return doc.mime_type === 'application/pdf' || /\.pdf$/i.test(doc.file_name ?? doc.file_url ?? '')
}

// One-click annual review (ISO 15189 8.3) — review-only model: for each confirmed QP/WI
// document, record a "ทบทวนแล้ว ไม่มีการแก้ไข" row (Rev "-") and regenerate ONLY the appended
// revision-history page. Revision, effective date, footer, and body are left untouched.
export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const canBulk = actor.role === 'Admin' || actor.role === 'Document Controller' || actor.doc_role === 'Document Controller'
  if (!canBulk) {
    return NextResponse.json({ error: 'เฉพาะ Admin หรือ Document Controller เท่านั้น' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as { ids?: unknown } | null
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v): v is string => typeof v === 'string') : []
  if (ids.length === 0) return NextResponse.json({ error: 'ไม่มีรายการเอกสาร' }, { status: 422 })
  if (ids.length > MAX_BULK_IDS) {
    return NextResponse.json({ error: `ทำได้ครั้งละไม่เกิน ${MAX_BULK_IDS} ฉบับ` }, { status: 422 })
  }

  // Approver names resolved once (WI → Quality Manager, QP → Laboratory Director).
  const [qmName, ldName] = await Promise.all([
    roleHolderName('Quality Manager'),
    roleHolderName('Laboratory Director'),
  ])

  const today = new Date().toISOString().split('T')[0]
  const succeeded: { id: string; document_code: string }[] = []
  const failed: { id: string; document_code: string; error: string }[] = []

  // Sequential on purpose: each item does an R2 download/upload + PDF generation.
  for (const id of ids) {
    let code = id
    try {
      const { data: current, error } = await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single()
      if (error || !current) throw new Error('ไม่พบเอกสาร')
      const doc = current as Document
      code = doc.document_code

      if (doc.status !== 'Published') throw new Error('เอกสารไม่ได้อยู่ในสถานะ Published')
      if (!isReviewOnlyType(doc.type)) throw new Error('เอกสาร Manual ต้องทบทวนผ่าน Rev+')
      if (!doc.review_confirmed_at) throw new Error('ยังไม่ได้ยืนยันการทบทวน')
      if (!doc.file_url || !fileIsPdf(doc)) throw new Error('ไฟล์ทางการไม่ใช่ PDF')

      const approverName = doc.type === 'WI'
        ? (qmName ?? doc.approver_name)
        : (ldName ?? doc.approver_name)

      // Record the review as a Rev "-" history row (file_url null → keeps it out of the
      // buildRows dedup and renders "-" in the Rev column).
      const { error: insertErr } = await supabaseAdmin
        .from('document_revisions')
        .insert({
          document_id: id,
          revision_number: '-',
          history_source: 'review',
          revision_note: ANNUAL_REVIEW_NOTE,
          revised_by: doc.review_confirmed_by_name,
          approved_by: approverName,
          edit_date: today,
          effective_date: null,
          file_url: null,
          uploaded_by: actor.id,
        })
      if (insertErr) throw new Error(insertErr.message)

      // Regenerate ONLY the trailing history page — strip old marker pages, append fresh.
      // Body pages + footer are untouched (no re-stamp, no Rev change).
      const existing = await getObjectBuffer(doc.file_url)
      const historyPdf = await generateRevisionHistoryPdfForDocument(id, {})
      const finalPdf = await appendRevisionHistoryPdf(existing, historyPdf, { removeExistingPortalHistory: true })
      const safeCode = doc.document_code.replace(/[^a-zA-Z0-9._-]/g, '_')
      const finalKey = `documents/generated/${id}/${Date.now()}-${safeCode}-review.pdf`
      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: finalKey,
        Body: Buffer.from(finalPdf),
        ContentType: 'application/pdf',
      }))

      const { error: updateErr } = await supabaseAdmin
        .from('documents')
        .update({
          file_url: finalKey,
          file_size: finalPdf.length,
          mime_type: 'application/pdf',
          last_reviewed_at: today,
          review_confirmed_at: null,
          review_confirmed_by: null,
          review_confirmed_by_name: null,
        })
        .eq('id', id)
      if (updateErr) throw new Error(updateErr.message)

      supabaseAdmin.from('audit_log').insert({
        action: 'document.annual_review',
        user_id: actor.id,
        target: doc.document_code,
        detail: `ทบทวนคง Rev.${doc.revision} · ${ANNUAL_REVIEW_NOTE} · โดย ${doc.review_confirmed_by_name ?? '-'}`,
      }).then(undefined, () => {})

      succeeded.push({ id, document_code: doc.document_code })
    } catch (err) {
      failed.push({ id, document_code: code, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ succeeded, failed })
}
