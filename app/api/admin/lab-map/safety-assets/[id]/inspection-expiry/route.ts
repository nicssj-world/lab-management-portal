import { NextResponse } from 'next/server'
import { auditSafety, requireSafetyEditor } from '@/lib/lab-map/safety-access'
import { safetyInspectionExpiryCorrectionSchema } from '@/lib/validations/lab-map-safety'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Context = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: Context) {
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  const { id } = await params
  const parsed = safetyInspectionExpiryCorrectionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })

  const { data, error } = await supabaseAdmin.rpc('correct_lab_map_safety_inspection_expiry', {
    p_asset_id: id,
    p_inspection_id: parsed.data.inspectionId,
    p_expires_on: parsed.data.expiresOn,
    p_expected_updated_at: parsed.data.updatedAt,
    p_actor_id: guard.actor.id,
  })
  if (error) {
    const status = /stale_safety_asset|inspection_not_latest/.test(error.message) ? 409 : 422
    return NextResponse.json({ error: error.message }, { status })
  }

  const correctionId = String(data)
  const { data: correction, error: correctionError } = await supabaseAdmin
    .from('lab_map_safety_inspection_expiry_corrections')
    .select('previous_expires_on, expires_on')
    .eq('id', correctionId)
    .maybeSingle()
  if (correctionError) console.error('lab map safety expiry correction detail lookup failed', correctionError)

  try {
    await auditSafety('lab_map.safety_inspection.expiry_correction', guard.actor.id, id, {
      inspectionId: parsed.data.inspectionId,
      previousExpiresOn: correction?.previous_expires_on ?? null,
      expiresOn: correction?.expires_on ?? parsed.data.expiresOn,
    })
  } catch (auditError) {
    console.error('lab map safety expiry correction audit failed', auditError)
    return NextResponse.json({ id: correctionId, auditWarning: true }, { status: 200 })
  }

  return NextResponse.json({ id: correctionId, message: 'แก้ไขกำหนดวันเรียบร้อยแล้ว' })
}
