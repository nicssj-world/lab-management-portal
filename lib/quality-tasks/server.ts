import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Actor } from '@/lib/auth/guards'
import type { PermLevel } from '@/lib/permissions'
import { bangkokToday, canMutateOccurrence, completionBlockReason, deriveTaskState, generatePeriods, occurrenceKey, resolveAssigneeEntries } from './logic'
import { resolveParticipantSelection, resolveParticipants } from './participants'
import type {
  AssigneeEntry, OccurrenceActionPayload, OccurrenceCreatePayload, QualityTaskAttachment, QualityTaskOccurrence,
  QualityTaskSchedule, QualityTaskTemplate, TaskIntervalUnit, TaskKind,
} from './types'

type Row = Record<string, any>

function fail(error: { message: string } | null, fallback = 'Quality task operation failed') {
  if (error) throw new Error(error.message || fallback)
}
function str(value: unknown) { return typeof value === 'string' ? value : '' }
function nullable(value: unknown) { return typeof value === 'string' ? value : null }
function rowsToAssigneeEntries(rows: Row[] | null): AssigneeEntry[] {
  return (rows ?? []).map(r => ({ userId: nullable(r.user_id), manualName: nullable(r.manual_name) }))
}

function audit(actor: Actor, action: string, target: string, detail: unknown) {
  supabaseAdmin.from('audit_log').insert({ action, user_id: actor.id, target, detail: JSON.stringify(detail) }).then(undefined, () => {})
}

export async function getQualityTaskTemplates(activeOnly = false): Promise<QualityTaskTemplate[]> {
  let query = supabaseAdmin.from('quality_task_templates').select('*').order('activity_no')
  if (activeOnly) query = query.eq('active', true)
  const [{ data: templateRows, error }, { data: scheduleRows, error: scheduleError }, { data: defaultRows, error: defaultError }] = await Promise.all([
    query,
    supabaseAdmin.from('quality_task_schedules').select('*').order('starts_on'),
    supabaseAdmin.from('quality_task_default_assignees').select('*'),
  ])
  fail(error); fail(scheduleError); fail(defaultError)
  const schedules = new Map<string, QualityTaskSchedule[]>()
  for (const row of (scheduleRows ?? []) as Row[]) {
    const templateId = str(row.template_id)
    schedules.set(templateId, [...(schedules.get(templateId) ?? []), {
      id: str(row.id), templateId, intervalUnit: str(row.interval_unit) as TaskIntervalUnit,
      intervalCount: Number(row.interval_count), startsOn: str(row.starts_on), endsOn: nullable(row.ends_on), active: Boolean(row.active),
    }])
  }
  const defaults = new Map<string, AssigneeEntry[]>()
  for (const row of (defaultRows ?? []) as Row[]) defaults.set(str(row.template_id), [...(defaults.get(str(row.template_id)) ?? []), { userId: nullable(row.user_id), manualName: nullable(row.manual_name) }])
  return ((templateRows ?? []) as Row[]).map(row => ({
    id: str(row.id), sourceKey: nullable(row.source_key), categoryCode: str(row.category_code), categoryName: str(row.category_name),
    activityNo: row.activity_no == null ? null : Number(row.activity_no), title: str(row.title), description: nullable(row.description),
    referenceCode: nullable(row.reference_code), frequencyText: str(row.frequency_text), ownerText: str(row.owner_text),
    taskKind: str(row.task_kind) as TaskKind, reminderDays: Number(row.reminder_days), evidenceRequired: Boolean(row.evidence_required),
    active: Boolean(row.active), defaultAssignees: defaults.get(str(row.id)) ?? [],
    defaultParticipantDepts: (row.default_participant_depts ?? []) as string[],
    defaultParticipantUserIds: (row.default_participant_user_ids ?? []) as string[],
    schedules: schedules.get(str(row.id)) ?? [],
  }))
}

function periodLabel(start: string, end: string) {
  const a = new Date(`${start}T00:00:00+07:00`)
  const b = new Date(`${end}T00:00:00+07:00`)
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return a.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
  return `${a.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' })} – ${b.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' })}`
}

export async function getQualityTaskOccurrences(input: { from: string; to: string; actorId: string; level: PermLevel; scope?: 'mine' | 'all' }) {
  const templates = await getQualityTaskTemplates(true)
  const people = await listTaskPeople()
  const { data: instanceRows, error } = await supabaseAdmin.from('quality_task_instances').select('*').lte('period_start', input.to).gte('period_end', input.from)
  fail(error)
  const instanceIds = ((instanceRows ?? []) as Row[]).map(r => str(r.id))
  const [{ data: assigneeRows, error: assigneeError }, { data: attachmentRows, error: attachmentError }] = instanceIds.length
    ? await Promise.all([
        supabaseAdmin.from('quality_task_instance_assignees').select('*').in('instance_id', instanceIds),
        supabaseAdmin.from('quality_task_attachments').select('*').in('instance_id', instanceIds).order('uploaded_at', { ascending: false }),
      ])
    : [{ data: [], error: null }, { data: [], error: null }]
  fail(assigneeError); fail(attachmentError)
  const assignees = new Map<string, AssigneeEntry[]>()
  for (const row of (assigneeRows ?? []) as Row[]) assignees.set(str(row.instance_id), [...(assignees.get(str(row.instance_id)) ?? []), { userId: nullable(row.user_id), manualName: nullable(row.manual_name) }])
  const attachments = new Map<string, QualityTaskAttachment[]>()
  for (const row of (attachmentRows ?? []) as Row[]) {
    const instanceId = str(row.instance_id)
    attachments.set(instanceId, [...(attachments.get(instanceId) ?? []), {
      id: str(row.id), instanceId, fileName: str(row.file_name), contentType: str(row.content_type), sizeBytes: Number(row.size_bytes),
      uploadedBy: str(row.uploaded_by), uploadedAt: str(row.uploaded_at),
    }])
  }
  const instanceByKey = new Map<string, Row>()
  for (const row of (instanceRows ?? []) as Row[]) instanceByKey.set(occurrenceKey(nullable(row.schedule_id), str(row.template_id), str(row.period_start)), row)
  const today = bangkokToday()
  const result: QualityTaskOccurrence[] = []
  for (const template of templates) {
    for (const schedule of template.schedules.filter(s => s.active)) {
      for (const period of generatePeriods(schedule, input.from, input.to)) {
        const key = occurrenceKey(schedule.id, template.id, period.start)
        const row = instanceByKey.get(key)
        const instanceId = row ? str(row.id) : null
        const assigned = resolveAssigneeEntries(template.defaultAssignees, instanceId ? assignees.get(instanceId) ?? [] : [])
        const rowDepts = row ? ((row.participant_depts ?? []) as string[]) : []
        const rowUserIds = row ? ((row.participant_user_ids ?? []) as string[]) : []
        const selection = resolveParticipantSelection(template.defaultParticipantDepts, template.defaultParticipantUserIds, rowDepts, rowUserIds)
        const resolvedParticipants = resolveParticipants(people, selection.depts, selection.userIds)
        const state = deriveTaskState({ status: row?.status === 'completed' ? 'completed' : 'open', plannedDate: nullable(row?.planned_date), periodEnd: period.end, reminderDays: template.reminderDays }, today)
        result.push({ key, instanceId, template, scheduleId: schedule.id, periodStart: period.start, periodEnd: period.end,
          periodLabel: row ? str(row.period_label) : periodLabel(period.start, period.end), plannedDate: nullable(row?.planned_date),
          status: row?.status === 'completed' ? 'completed' : 'open', note: nullable(row?.note), completionNote: nullable(row?.completion_note),
          completedBy: nullable(row?.completed_by), completedAt: nullable(row?.completed_at), assignees: assigned,
          participantDepts: rowDepts, participantUserIds: rowUserIds,
          participants: resolvedParticipants.map(p => ({ id: str(p.id), name: str(p.name), documentPosition: nullable((p as Row).document_position) })),
          attachments: instanceId ? attachments.get(instanceId) ?? [] : [], ...state })
      }
    }
  }
  for (const row of (instanceRows ?? []) as Row[]) {
    if (row.schedule_id) continue
    const template = templates.find(t => t.id === row.template_id)
    if (!template) continue
    const instanceId = str(row.id)
    const assigned = resolveAssigneeEntries(template.defaultAssignees, assignees.get(instanceId) ?? [])
    const rowDepts = (row.participant_depts ?? []) as string[]
    const rowUserIds = (row.participant_user_ids ?? []) as string[]
    const selection = resolveParticipantSelection(template.defaultParticipantDepts, template.defaultParticipantUserIds, rowDepts, rowUserIds)
    const resolvedParticipants = resolveParticipants(people, selection.depts, selection.userIds)
    const state = deriveTaskState({ status: row.status === 'completed' ? 'completed' : 'open', plannedDate: nullable(row.planned_date), periodEnd: str(row.period_end), reminderDays: template.reminderDays }, today)
    result.push({ key: occurrenceKey(null, template.id, str(row.period_start)), instanceId, template, scheduleId: null,
      periodStart: str(row.period_start), periodEnd: str(row.period_end), periodLabel: str(row.period_label), plannedDate: nullable(row.planned_date),
      status: row.status === 'completed' ? 'completed' : 'open', note: nullable(row.note), completionNote: nullable(row.completion_note),
      completedBy: nullable(row.completed_by), completedAt: nullable(row.completed_at), assignees: assigned,
      participantDepts: rowDepts, participantUserIds: rowUserIds,
      participants: resolvedParticipants.map(p => ({ id: str(p.id), name: str(p.name), documentPosition: nullable((p as Row).document_position) })),
      attachments: attachments.get(instanceId) ?? [], ...state })
  }
  const scoped = input.scope === 'mine' && input.level !== 'edit' ? result.filter(o => o.assignees.some(e => e.userId === input.actorId)) : result
  return scoped.sort((a, b) => a.effectiveDueDate.localeCompare(b.effectiveDueDate) || a.template.title.localeCompare(b.template.title, 'th'))
}

async function replaceAssignees(instanceId: string, entries: AssigneeEntry[]) {
  const { error } = await supabaseAdmin.from('quality_task_instance_assignees').delete().eq('instance_id', instanceId)
  fail(error)
  if (entries.length) fail((await supabaseAdmin.from('quality_task_instance_assignees').insert(entries.map(e => ({ instance_id: instanceId, user_id: e.userId, manual_name: e.manualName })))).error)
}

export async function materializeOccurrence(payload: OccurrenceCreatePayload, actor: Actor, level: PermLevel) {
  if (payload.mode === 'adHoc') {
    if (level !== 'edit') throw new Error('Forbidden')
    const { data, error } = await supabaseAdmin.from('quality_task_instances').insert({ template_id: payload.templateId, period_start: payload.dueDate, period_end: payload.dueDate, period_label: payload.label.trim(), planned_date: payload.dueDate, created_by: actor.id, updated_by: actor.id }).select('*').single()
    fail(error); await replaceAssignees(str(data.id), payload.assignees); audit(actor, 'quality_task.instance.create', str(data.id), payload); return data
  }
  const { data: scheduleRow, error } = await supabaseAdmin.from('quality_task_schedules').select('*').eq('id', payload.scheduleId).single()
  fail(error)
  const schedule: QualityTaskSchedule = { id: str(scheduleRow.id), templateId: str(scheduleRow.template_id), intervalUnit: str(scheduleRow.interval_unit) as TaskIntervalUnit, intervalCount: Number(scheduleRow.interval_count), startsOn: str(scheduleRow.starts_on), endsOn: nullable(scheduleRow.ends_on), active: Boolean(scheduleRow.active) }
  if (level !== 'edit') {
    const { data: defaults, error: defaultError } = await supabaseAdmin.from('quality_task_default_assignees').select('user_id').eq('template_id', schedule.templateId)
    fail(defaultError)
    if (!(defaults ?? []).some((row: Row) => str(row.user_id) === actor.id)) throw new Error('Forbidden')
  }
  const period = generatePeriods(schedule, payload.periodStart, payload.periodStart).find(p => p.start === payload.periodStart)
  if (!period) throw new Error('Invalid schedule period')
  const { data, error: upsertError } = await supabaseAdmin.from('quality_task_instances').upsert({ template_id: schedule.templateId, schedule_id: schedule.id, period_start: period.start, period_end: period.end, period_label: periodLabel(period.start, period.end), created_by: actor.id, updated_by: actor.id }, { onConflict: 'schedule_id,period_start' }).select('*').single()
  fail(upsertError); audit(actor, 'quality_task.instance.materialize', str(data.id), payload); return data
}

export async function getOccurrenceAccess(instanceId: string, actor: Actor, level: PermLevel) {
  const { data: instance, error } = await supabaseAdmin.from('quality_task_instances').select('*, quality_task_templates(evidence_required)').eq('id', instanceId).single()
  fail(error)
  const [{ data: overrides }, { data: defaults }] = await Promise.all([
    supabaseAdmin.from('quality_task_instance_assignees').select('user_id, manual_name').eq('instance_id', instanceId),
    supabaseAdmin.from('quality_task_default_assignees').select('user_id, manual_name').eq('template_id', instance.template_id),
  ])
  const entries = resolveAssigneeEntries(rowsToAssigneeEntries(defaults), rowsToAssigneeEntries(overrides))
  const ids = entries.map(e => e.userId).filter((id): id is string => id != null)
  if (!canMutateOccurrence(level, ids.includes(actor.id), entries.length === 0)) throw new Error('Forbidden')
  return { instance, evidenceRequired: Boolean((instance.quality_task_templates as Row)?.evidence_required), assignees: entries }
}

export async function updateOccurrence(instanceId: string, payload: OccurrenceActionPayload, actor: Actor, level: PermLevel) {
  const access = await getOccurrenceAccess(instanceId, actor, level)
  if (payload.action === 'schedule') {
    if ((payload.assignees || payload.participantDepts || payload.participantUserIds) && level !== 'edit') throw new Error('Forbidden')
    const { error } = await supabaseAdmin.from('quality_task_instances').update({
      planned_date: payload.plannedDate || null, note: payload.note?.trim() || null,
      updated_by: actor.id, updated_at: new Date().toISOString(),
      ...(payload.participantDepts ? { participant_depts: payload.participantDepts } : {}),
      ...(payload.participantUserIds ? { participant_user_ids: payload.participantUserIds } : {}),
    }).eq('id', instanceId)
    fail(error); if (payload.assignees) await replaceAssignees(instanceId, payload.assignees)
  } else if (payload.action === 'complete') {
    if (access.instance.status === 'completed') return access.instance
    if (access.evidenceRequired) {
      const { count, error } = await supabaseAdmin.from('quality_task_attachments').select('*', { count: 'exact', head: true }).eq('instance_id', instanceId)
      fail(error); const blocked = completionBlockReason(true, count ?? 0); if (blocked) throw new Error(blocked)
    }
    fail((await supabaseAdmin.from('quality_task_instances').update({ status: 'completed', completion_note: payload.completionNote?.trim() || null, completed_by: actor.id, completed_at: new Date().toISOString(), updated_by: actor.id, updated_at: new Date().toISOString() }).eq('id', instanceId)).error)
  } else {
    if (level !== 'edit' || !payload.reason.trim()) throw new Error('ต้องระบุเหตุผลและมีสิทธิ์ edit')
    fail((await supabaseAdmin.from('quality_task_instances').update({ status: 'open', completed_by: null, completed_at: null, completion_note: null, updated_by: actor.id, updated_at: new Date().toISOString() }).eq('id', instanceId)).error)
  }
  audit(actor, `quality_task.instance.${payload.action}`, instanceId, payload)
  return (await supabaseAdmin.from('quality_task_instances').select('*').eq('id', instanceId).single()).data
}

export async function saveTemplate(input: Omit<QualityTaskTemplate, 'id' | 'sourceKey'>, actor: Actor, id?: string) {
  const payload = { category_code: input.categoryCode, category_name: input.categoryName, activity_no: input.activityNo, title: input.title.trim(), description: input.description?.trim() || null, reference_code: input.referenceCode?.trim() || null, frequency_text: input.frequencyText.trim(), owner_text: input.ownerText.trim(), task_kind: input.taskKind, reminder_days: input.reminderDays, evidence_required: input.evidenceRequired, active: input.active, default_participant_depts: input.defaultParticipantDepts, default_participant_user_ids: input.defaultParticipantUserIds, updated_at: new Date().toISOString() }
  const result = id ? await supabaseAdmin.from('quality_task_templates').update(payload).eq('id', id).select('id').single() : await supabaseAdmin.from('quality_task_templates').insert({ ...payload, created_by: actor.id }).select('id').single()
  fail(result.error); if (!result.data) throw new Error('Template was not saved'); const templateId = str(result.data.id)
  const { data: existingSchedules, error: existingScheduleError } = await supabaseAdmin.from('quality_task_schedules').select('id').eq('template_id', templateId)
  fail(existingScheduleError)
  const retained = new Set(input.schedules.map(s => s.id).filter(Boolean))
  const omitted = (existingSchedules ?? []).map((s: Row) => str(s.id)).filter(id => !retained.has(id))
  if (omitted.length) fail((await supabaseAdmin.from('quality_task_schedules').update({ active: false }).in('id', omitted)).error)
  for (const [index, schedule] of input.schedules.entries()) {
    const schedulePayload = { interval_unit: schedule.intervalUnit, interval_count: schedule.intervalCount, starts_on: schedule.startsOn, ends_on: schedule.endsOn, active: schedule.active }
    if (schedule.id) fail((await supabaseAdmin.from('quality_task_schedules').update(schedulePayload).eq('id', schedule.id).eq('template_id', templateId)).error)
    else fail((await supabaseAdmin.from('quality_task_schedules').insert({ template_id: templateId, schedule_key: `custom-${Date.now()}-${index + 1}`, ...schedulePayload })).error)
  }
  await supabaseAdmin.from('quality_task_default_assignees').delete().eq('template_id', templateId)
  if (input.defaultAssignees.length) fail((await supabaseAdmin.from('quality_task_default_assignees').insert(input.defaultAssignees.map(e => ({ template_id: templateId, user_id: e.userId, manual_name: e.manualName })))).error)
  audit(actor, id ? 'quality_task.template.update' : 'quality_task.template.create', templateId, payload)
  return templateId
}

export async function deleteTemplate(id: string, actor: Actor) {
  const { count, error: countError } = await supabaseAdmin.from('quality_task_instances').select('*', { count: 'exact', head: true }).eq('template_id', id)
  fail(countError)
  if ((count ?? 0) > 0) throw new Error('ไม่สามารถลบได้ เนื่องจากกิจกรรมนี้มีการสร้างงานไปแล้ว กรุณาปิดใช้งานแทน')
  await supabaseAdmin.from('quality_task_default_assignees').delete().eq('template_id', id)
  await supabaseAdmin.from('quality_task_schedules').delete().eq('template_id', id)
  fail((await supabaseAdmin.from('quality_task_templates').delete().eq('id', id)).error)
  audit(actor, 'quality_task.template.delete', id, {})
}

export async function listTaskPeople() {
  const { data, error } = await supabaseAdmin.from('profiles').select('id,name,dept,role,document_position').is('deleted_at', null).order('name')
  fail(error); return data ?? []
}
