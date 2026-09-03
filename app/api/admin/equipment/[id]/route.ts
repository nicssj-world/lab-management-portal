import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPermissionsWithEquipmentOverride } from '@/lib/permissions'
import { getLabCodeInfo, normalizeLabCode } from '@/lib/equipment-lab-code'
import { canonicalEquipmentDepartment } from '@/lib/equipment/departments'
import { resolveEquipmentAreaAssignment } from '@/lib/equipment-map/area-assignment'
import { NextRequest, NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

function normalizePendingRegistration(body: Record<string, any>) {
  const labCode = String(body.cbh_code ?? '').trim()
  const assetNo = String(body.hospital_asset_no ?? '').trim()

  if (body.cbh_code_pending === true || labCode === 'รอขึ้นทะเบียน') {
    body.cbh_code_pending = true
    body.cbh_code = null
  } else if (body.cbh_code !== undefined) {
    body.cbh_code = normalizeLabCode(labCode)
    if (body.cbh_code) body.cbh_code_pending = false
  }

  if (body.hospital_asset_no_pending === true || assetNo === 'รอขึ้นทะเบียน') {
    body.hospital_asset_no_pending = true
    body.hospital_asset_no = null
  } else if (body.hospital_asset_no !== undefined) {
    body.hospital_asset_no = assetNo || null
    if (body.hospital_asset_no) body.hospital_asset_no_pending = false
  }
}

async function applyResponsibleUser(body: Record<string, any>) {
  if (body.responsible_user_id === '') body.responsible_user_id = null
  if (body.responsible_user_id === undefined || body.responsible_user_id === null) return null

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name')
    .eq('id', body.responsible_user_id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return 'ไม่พบผู้รับผิดชอบในฐานผู้ใช้งาน'
  body.responsible_person = data.name
  return null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getPermissionsWithEquipmentOverride(actor.role, actor.id)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') === 'none')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { data, error } = await supabaseAdmin.from('equipment').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'ไม่พบเครื่องมือนี้' }, { status: 404 })
  return NextResponse.json({
    ...data,
    department: canonicalEquipmentDepartment(data.department),
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getPermissionsWithEquipmentOverride(actor.role, actor.id)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const hasAreaAssignment = Object.prototype.hasOwnProperty.call(body, 'areaCode')
  const requestedAreaCode = body.areaCode
  delete body.areaCode
  // รับเฉพาะ areaCode ที่ validate แล้วจากฟอร์มทะเบียน ส่วนพิกัดยังแก้ได้เฉพาะทาง /position เท่านั้น
  delete body.map_x
  delete body.map_y
  delete body.map_rotation
  delete body.area_code
  delete body.position_set_by
  delete body.position_set_at
  // PM/CAL มี API, validation และ audit แยกแล้ว ห้ามเขียนทับประวัติผ่าน generic update
  delete body.pm_cal_data
  normalizePendingRegistration(body)
  const responsibleError = await applyResponsibleUser(body)
  if (responsibleError) return NextResponse.json({ error: responsibleError }, { status: 422 })
  if (hasAreaAssignment) {
    const { assignment, error: areaError } = await resolveEquipmentAreaAssignment(requestedAreaCode, actor.id)
    if (areaError || !assignment) return NextResponse.json({ error: areaError ?? 'กำหนดพื้นที่ไม่สำเร็จ' }, { status: 422 })
    Object.assign(body, assignment)
  }
  const { data: existing } = await supabaseAdmin
    .from('equipment')
    .select('cbh_code')
    .eq('id', id)
    .single()
  const labInfo = getLabCodeInfo(body.cbh_code !== undefined ? body.cbh_code : existing?.cbh_code)
  if (labInfo.department) body.department = labInfo.department
  else if (typeof body.department === 'string') body.department = canonicalEquipmentDepartment(body.department)
  if (labInfo.classification) body.classification = labInfo.classification
  if (body.status === 'Inactive') body.needs_calibration = false
  const { data, error } = await supabaseAdmin
    .from('equipment')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505' && error.message.includes('cbh_code'))
      return NextResponse.json({ error: 'รหัส LAB นี้มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  supabaseAdmin.from('audit_log').insert({
    action: 'equipment.update',
    user_id: actor.id,
    target: data.cbh_code ?? id,
    detail: `${data.equipment_type}${data.cbh_code ? ' · ' + data.cbh_code : ''}`,
  }).then(undefined, () => {})
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getPermissionsWithEquipmentOverride(actor.role, actor.id)
  if ((perms['ทะเบียนเครื่องมือ'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { data: deleted, error } = await supabaseAdmin.from('equipment').delete().eq('id', id).select('equipment_type, cbh_code').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  supabaseAdmin.from('audit_log').insert({
    action: 'equipment.delete',
    user_id: actor.id,
    target: deleted?.cbh_code ?? id,
    detail: `${deleted?.equipment_type ?? ''}${deleted?.cbh_code ? ' · ' + deleted.cbh_code : ''}`,
  }).then(undefined, () => {})
  return NextResponse.json({ ok: true })
}
