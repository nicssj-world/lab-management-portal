import { NextResponse } from 'next/server'
import { getActor, jsonUnauthorized } from '@/lib/auth/guards'
import { createAgreementSignedUrl, currentAgreementTask } from '@/lib/personnel/annual-agreements-server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createSignatureSignedUrl } from '@/lib/signatures'

export async function GET() {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  try {
    const task = await currentAgreementTask(actor.id)
    if (!task) {
      const { data: savedSignature } = await supabaseAdmin.from('profiles')
        .select('signature_url, signature_updated_at').eq('id', actor.id).maybeSingle()
      return NextResponse.json({
        task: null,
        savedSignature: savedSignature?.signature_url ? { ...savedSignature, signed_url: await createSignatureSignedUrl(savedSignature.signature_url) } : null,
      })
    }
    return NextResponse.json({
      task: {
        ...task,
        recipient: { ...task.recipient, evidence_signed_url: await createAgreementSignedUrl(task.recipient.evidence_url) },
        savedSignature: task.savedSignature?.signature_url ? { ...task.savedSignature, signed_url: await createSignatureSignedUrl(task.savedSignature.signature_url) } : null,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'โหลดข้อตกลงไม่สำเร็จ' }, { status: 500 })
  }
}
