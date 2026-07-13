import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { purgeEphemeralAttachments } from '@/lib/documents/ephemeral-attachments'
import { supabaseAdmin } from '@/lib/supabase/admin'

const PurgeRequestSchema = z.object({ documentId: z.string().uuid() }).strict()

function auditPurgeRetry(
  actorId: string,
  document: { id: string; document_code: string | null },
  result: 'attempt' | 'succeeded' | 'failed',
  error?: string,
) {
  supabaseAdmin.from('audit_log').insert({
    action: 'document.ephemeral_purge_retry',
    user_id: actorId,
    target: document.document_code ?? document.id,
    detail: error ? `${result}: ${error}` : result,
  }).then(undefined, () => {})
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!(
    actor.role === 'Admin'
    || actor.role === 'Document Controller'
    || actor.doc_role === 'Document Controller'
  )) return jsonForbidden()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON ไม่ถูกต้อง' }, { status: 422 })
  }
  const parsed = PurgeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const documentResult = await supabaseAdmin
    .from('documents')
    .select('id, document_code, status')
    .eq('id', parsed.data.documentId)
    .is('deleted_at', null)
    .maybeSingle()
  if (documentResult.error) {
    return NextResponse.json({ error: documentResult.error.message }, { status: 500 })
  }
  if (!documentResult.data) return NextResponse.json({ error: 'ไม่พบเอกสาร' }, { status: 404 })
  if (documentResult.data.status !== 'Published') {
    return NextResponse.json({ error: 'ล้างไฟล์แนบชั่วคราวได้เฉพาะเอกสาร Published' }, { status: 409 })
  }

  auditPurgeRetry(actor.id, documentResult.data, 'attempt')
  try {
    await purgeEphemeralAttachments(documentResult.data.id)
    auditPurgeRetry(actor.id, documentResult.data, 'succeeded')
    return NextResponse.json({
      succeeded: [{ id: documentResult.data.id, documentCode: documentResult.data.document_code }],
      failed: [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    auditPurgeRetry(actor.id, documentResult.data, 'failed', message)
    return NextResponse.json({
      succeeded: [],
      failed: [{
        id: documentResult.data.id,
        documentCode: documentResult.data.document_code,
        error: message,
      }],
    }, { status: 500 })
  }
}
