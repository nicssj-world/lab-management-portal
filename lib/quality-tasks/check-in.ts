import 'server-only'

import { randomBytes } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Actor } from '@/lib/auth/guards'
import type { PermLevel } from '@/lib/permissions'
import { isCheckInClosed, occurrenceDisplayTitle } from './logic'
import { getOccurrenceAccess, listTaskPeople } from './server'
import { addParticipantToSelection, resolveParticipantSelection, resolveParticipants } from './participants'
import type { QualityTaskCheckIn } from './types'

type Row = Record<string, any>

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/

function str(value: unknown) { return typeof value === 'string' ? value : '' }
function nullable(value: unknown) { return typeof value === 'string' ? value : null }
function checkInClosed(instance: Row) {
  return isCheckInClosed(instance.status === 'completed' ? 'completed' : 'open', nullable(instance.check_in_closed_at))
}

export function createCheckInToken() {
  return randomBytes(32).toString('base64url')
}

/**
 * ออก QR token ให้รอบประชุม — ออกครั้งเดียวแล้วใช้ token เดิมจนกว่าจะปิดรับเช็คอิน
 *
 * เรียกซ้ำได้: ถ้ามี token แล้วคืนของเดิม ไม่ออกใหม่ ป้องกันไม่ให้ QR ที่พิมพ์
 * แจกไปแล้วใช้ไม่ได้เพราะมีคนกดปุ่มซ้ำ
 */
export async function issueCheckInToken(instanceId: string, actor: Actor, level: PermLevel) {
  const access = await getOccurrenceAccess(instanceId, actor, level)
  const existing = nullable(access.instance.check_in_token)
  if (existing) return existing
  if (checkInClosed(access.instance)) throw new Error('การประชุมนี้ปิดรับเช็คอินแล้ว')

  const token = createCheckInToken()
  const { error } = await supabaseAdmin
    .from('quality_task_instances')
    .update({ check_in_token: token, updated_by: actor.id, updated_at: new Date().toISOString() })
    .eq('id', instanceId)
    .is('check_in_token', null)
  if (error) throw new Error(error.message)

  // แข่งกับ request คู่ขนานที่ออก token พร้อมกัน — อ่านกลับมาเพื่อให้ทุกคนได้ค่าเดียวกัน
  const { data } = await supabaseAdmin
    .from('quality_task_instances')
    .select('check_in_token')
    .eq('id', instanceId)
    .single()
  return str(data?.check_in_token) || token
}

/** ปิดรับเช็คอินของรอบนี้ — เป็นการปิดถาวรของ QR token เดิม */
export async function closeCheckIn(instanceId: string, actor: Actor, level: PermLevel) {
  const access = await getOccurrenceAccess(instanceId, actor, level)
  const existing = nullable(access.instance.check_in_closed_at)
  if (existing) return existing

  const closedAt = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('quality_task_instances')
    .update({ check_in_closed_at: closedAt, updated_by: actor.id, updated_at: closedAt })
    .eq('id', instanceId)
    .is('check_in_closed_at', null)
  if (error) throw new Error(error.message)

  const { data, error: readError } = await supabaseAdmin
    .from('quality_task_instances')
    .select('check_in_closed_at')
    .eq('id', instanceId)
    .single()
  if (readError) throw new Error(readError.message)
  const committedAt = nullable(data?.check_in_closed_at) ?? closedAt

  supabaseAdmin.from('audit_log').insert({
    action: 'quality_task.check_in.close',
    user_id: actor.id,
    target: instanceId,
    detail: `ปิดรับเช็คอิน ${committedAt}`,
  }).then(undefined, () => {})

  return committedAt
}

export interface CheckInContext {
  instanceId: string
  title: string
  periodLabel: string
  plannedDate: string | null
  /** ปิดรับเช็คอินเมื่อเจ้าหน้าที่กดปิด หรือรอบถูกปิดงานแล้ว */
  closed: boolean
  alreadyCheckedIn: boolean
  isListedParticipant: boolean
}

/**
 * แปลง token เป็นข้อมูลรอบประชุมสำหรับหน้าเช็คอิน — คืน null เมื่อ token ไม่ถูกต้อง
 *
 * actorId เป็น null เมื่อเรียกจากหน้าสาธารณะก่อนรู้ว่าผู้สแกนมีบัญชีหรือไม่
 * (alreadyCheckedIn/isListedParticipant จะเป็น false เสมอในกรณีนี้ — ยังไม่รู้ตัวตน)
 */
export async function getCheckInContext(token: string, actorId: string | null): Promise<CheckInContext | null> {
  if (!TOKEN_PATTERN.test(token)) return null

  const { data: instance, error } = await supabaseAdmin
    .from('quality_task_instances')
    .select('*, quality_task_templates(title, category_name, task_kind, default_participant_depts, default_participant_user_ids)')
    .eq('check_in_token', token)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!instance) return null

  const template = (instance.quality_task_templates ?? {}) as Row
  const people = await listTaskPeople()
  const selection = resolveParticipantSelection(
    (template.default_participant_depts ?? []) as string[],
    (template.default_participant_user_ids ?? []) as string[],
    (instance.participant_depts ?? []) as string[],
    (instance.participant_user_ids ?? []) as string[],
  )
  const participants = resolveParticipants(people, selection.depts, selection.userIds)

  const existing = actorId
    ? (await supabaseAdmin
        .from('quality_task_check_ins')
        .select('user_id')
        .eq('instance_id', instance.id)
        .eq('user_id', actorId)
        .maybeSingle()).data
    : null

  return {
    instanceId: str(instance.id),
    // งานเฉพาะกิจเก็บชื่อประชุมที่ผู้ใช้กรอกไว้ใน period_label ส่วนงานตามตารางใช้ชื่อ template
    title: occurrenceDisplayTitle({
      scheduleId: nullable(instance.schedule_id),
      periodLabel: str(instance.period_label),
      template: {
        title: str(template.title),
        categoryName: str(template.category_name),
      },
    }),
    periodLabel: str(instance.period_label),
    plannedDate: nullable(instance.planned_date),
    closed: checkInClosed(instance),
    alreadyCheckedIn: Boolean(existing),
    isListedParticipant: actorId ? participants.some(p => str(p.id) === actorId) : false,
  }
}

export type CheckInResult =
  | { status: 'recorded'; wasUnlisted: boolean }
  | { status: 'already' }
  | { status: 'closed' }
  | { status: 'not_found' }

/**
 * บันทึกการเช็คอินของผู้ใช้ที่ล็อกอินอยู่
 *
 * ผู้ที่ไม่อยู่ในรายชื่อจะถูกเพิ่มเข้ารายชื่อผู้เข้าร่วมของรอบนั้นอัตโนมัติ
 * (ผ่าน addParticipantToSelection ที่รักษารายชื่อเดิมไว้) จึงได้แถวใน PDF ใบลงนามเองโดยไม่ต้องมี logic แยกใน PDF
 */
export async function recordCheckIn(token: string, actor: Actor): Promise<CheckInResult> {
  if (!TOKEN_PATTERN.test(token)) return { status: 'not_found' }

  const { data: instance, error } = await supabaseAdmin
    .from('quality_task_instances')
    .select('*, quality_task_templates(default_participant_depts, default_participant_user_ids)')
    .eq('check_in_token', token)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!instance) return { status: 'not_found' }
  if (checkInClosed(instance)) return { status: 'closed' }

  const instanceId = str(instance.id)
  const template = (instance.quality_task_templates ?? {}) as Row
  const defaultDepts = (template.default_participant_depts ?? []) as string[]
  const defaultUserIds = (template.default_participant_user_ids ?? []) as string[]
  const overrideDepts = (instance.participant_depts ?? []) as string[]
  const overrideUserIds = (instance.participant_user_ids ?? []) as string[]

  const people = await listTaskPeople()
  const selection = resolveParticipantSelection(defaultDepts, defaultUserIds, overrideDepts, overrideUserIds)
  const participants = resolveParticipants(people, selection.depts, selection.userIds)
  const wasUnlisted = !participants.some(p => str(p.id) === actor.id)

  if (wasUnlisted) {
    const next = addParticipantToSelection(defaultDepts, defaultUserIds, overrideDepts, overrideUserIds, actor.id)
    const { error: updateError } = await supabaseAdmin
      .from('quality_task_instances')
      .update({ participant_depts: next.depts, participant_user_ids: next.userIds, updated_at: new Date().toISOString() })
      .eq('id', instanceId)
    if (updateError) throw new Error(updateError.message)
  }

  const { error: insertError } = await supabaseAdmin
    .from('quality_task_check_ins')
    .insert({ instance_id: instanceId, user_id: actor.id, was_unlisted: wasUnlisted, method: 'qr', recorded_by: actor.id })
  if (insertError) {
    // 23505 = เช็คอินไปแล้ว (PK ซ้ำ) — สแกนซ้ำถือว่าสำเร็จ ไม่ใช่ error
    if ((insertError as { code?: string }).code === '23505') return { status: 'already' }
    throw new Error(insertError.message)
  }

  supabaseAdmin.from('audit_log').insert({
    action: 'quality_task.check_in',
    user_id: actor.id,
    target: instanceId,
    detail: wasUnlisted ? 'เช็คอินและเพิ่มเข้ารายชื่อผู้เข้าร่วมอัตโนมัติ' : 'เช็คอิน',
  }).then(undefined, () => {})

  return { status: 'recorded', wasUnlisted }
}

/**
 * บันทึกการเช็คอินของผู้ที่ไม่มีบัญชีในระบบ (แขก/บุคลากรหน่วยงานอื่นที่ยังไม่มี profile)
 *
 * ไม่มี user_id ให้เพิ่มเข้ารายชื่อผู้เข้าร่วม (participant_user_ids อ้าง profiles เท่านั้น)
 * จึงไม่ปรากฏใน selected.participants เหมือนผู้ใช้ระบบ — ใบลงนามต้องต่อแถวจาก check-in
 * โดยตรงแทน (ดู downloadSignInSheet ใน QualityTaskDashboard.tsx)
 */
export async function recordGuestCheckIn(
  token: string,
  guest: { firstName: string; lastName: string; department: string },
): Promise<CheckInResult> {
  if (!TOKEN_PATTERN.test(token)) return { status: 'not_found' }

  const { data: instance, error } = await supabaseAdmin
    .from('quality_task_instances')
    .select('id, status, check_in_closed_at')
    .eq('check_in_token', token)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!instance) return { status: 'not_found' }
  if (checkInClosed(instance)) return { status: 'closed' }

  const instanceId = str(instance.id)
  const { error: insertError } = await supabaseAdmin.from('quality_task_check_ins').insert({
    instance_id: instanceId,
    user_id: null,
    guest_name: guest.firstName.trim(),
    guest_surname: guest.lastName.trim(),
    guest_department: guest.department.trim(),
    was_unlisted: true,
    method: 'guest',
  })
  if (insertError) throw new Error(insertError.message)

  supabaseAdmin.from('audit_log').insert({
    action: 'quality_task.check_in',
    user_id: null,
    target: instanceId,
    detail: `เช็คอินโดยผู้ไม่มีบัญชี: ${guest.firstName.trim()} ${guest.lastName.trim()} (${guest.department.trim()})`,
  }).then(undefined, () => {})

  return { status: 'recorded', wasUnlisted: true }
}

/** เช็คอินของหลายรอบพร้อมกัน — ใช้ประกอบ DTO ของหน้าปฏิทิน */
export async function listCheckIns(instanceIds: string[]): Promise<Map<string, QualityTaskCheckIn[]>> {
  const result = new Map<string, QualityTaskCheckIn[]>()
  if (!instanceIds.length) return result

  const { data, error } = await supabaseAdmin
    .from('quality_task_check_ins')
    .select('*')
    .in('instance_id', instanceIds)
    .order('checked_in_at')
  if (error) throw new Error(error.message)

  for (const row of (data ?? []) as Row[]) {
    const instanceId = str(row.instance_id)
    result.set(instanceId, [...(result.get(instanceId) ?? []), {
      userId: nullable(row.user_id),
      checkedInAt: str(row.checked_in_at),
      method: str(row.method) === 'manual' ? 'manual' : str(row.method) === 'guest' ? 'guest' : 'qr',
      wasUnlisted: Boolean(row.was_unlisted),
      guestName: nullable(row.guest_name),
      guestSurname: nullable(row.guest_surname),
      guestDepartment: nullable(row.guest_department),
    }])
  }
  return result
}
