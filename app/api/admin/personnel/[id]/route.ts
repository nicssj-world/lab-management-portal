import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireResource } from '@/lib/auth/guards'
import { getStaffDetail } from '@/lib/queries/personnel'
import { PersonnelProfileSchema } from '@/lib/validations/personnel'
import { createStaffSignedUrl } from '@/lib/personnel/storage'
import { hasMedicalTechnologistLicenseScope } from '@/lib/personnel/roles'
import { toMsg } from '@/lib/personnel/crud'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await requireResource('บุคลากร', 'view')
  if (!actor) return response
  const { id } = await ctx.params
  try {
    const detail = await getStaffDetail(id)
    if (!detail) return NextResponse.json({ error: 'ไม่พบบุคลากร' }, { status: 404 })

    // Resolve signed URLs for attachments so the client can preview/download
    const certifications = await Promise.all(
      detail.certifications.map(async (c) => ({ ...c, signed_url: await createStaffSignedUrl(c.file_url) })),
    )
    const training = await Promise.all(
      detail.training.map(async (t) => ({ ...t, signed_url: await createStaffSignedUrl(t.evidence_url) })),
    )
    return NextResponse.json({ ...detail, certifications, training })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await requireResource('บุคลากร', 'edit')
  if (!actor) return response
  const { id } = await ctx.params
  try {
    const parsed = PersonnelProfileSchema.partial().safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
    }
    if ('mt_license_no' in parsed.data || 'mt_license_expiry' in parsed.data) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', id).maybeSingle()
      if (profile && !hasMedicalTechnologistLicenseScope(profile.role)) {
        return NextResponse.json({ error: 'ใบ ทนพ. ใช้เฉพาะ Medical Technologist' }, { status: 422 })
      }
    }
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    supabaseAdmin.from('audit_log')
      .insert({ action: 'personnel.profile.update', user_id: actor.id, target: id })
      .then(undefined, () => {})

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
