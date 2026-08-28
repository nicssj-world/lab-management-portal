import 'server-only'

import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import type { Actor } from '@/lib/auth/guards'
import type { PermLevel } from '@/lib/permissions'
import { QUALITY_TASK_TRACKING_START, bangkokToday, canMutateOccurrence, canViewOccurrence, completionBlockReason, deriveTaskState, generatePeriods, isWeekendDate, occurrenceKey, resolveAssigneeEntries } from './logic'
import { listQualityTaskHolidays } from './holidays'
import { resolveParticipantSelection, resolveParticipants } from './participants'
import { canApproveTask, nextRollingDueDate, templateRemovalMode } from './safety'
import { meetingSlotsOverlap, normalizeMeetingTime } from './meeting-time'
import { isMonthlySafetySourceKey } from './monthly-safety'
import type {
  AssigneeEntry, OccurrenceActionPayload, OccurrenceCreatePayload, QualityTaskActionItem, QualityTaskAttachment, QualityTaskCheckIn,
  QualityTaskEvidenceRequirement, QualityTaskOccurrence, QualityTaskSchedule, QualityTaskTemplate, RecurrenceMode,
  TaskIntervalUnit, TaskKind, TaskStatus, TaskWorkstream,
} from './types'

type Row = Record<string, any>
type TaskPerson = { id: string; name: string; dept: string | null; role: string; position_title: string | null }
const CANCELLED_NOTE = '__quality_task_cancelled__'

function fail(error: { message: string } | null, fallback = 'Quality task operation failed') {
  if (error) throw new Error(error.message || fallback)
}
function str(value: unknown) { return typeof value === 'string' ? value : '' }
function nullable(value: unknown) { return typeof value === 'string' ? value : null }
function nullableTime(value: unknown) {
  const text = nullable(value)
  return text ? text.slice(0, 5) : null
}
function taskStatus(value: unknown): TaskStatus {
  return value === 'in_progress' || value === 'pending_review' || value === 'completed' ? value : 'open'
}
function integrationKind(value: unknown): QualityTaskTemplate['integrationKind'] {
  return value === 'safety_inspection' || value === 'equipment_reference' || value === 'evacuation_plan_review' || value === 'evacuation_drill'
    ? value
    : 'none'
}
function rowsToAssigneeEntries(rows: Row[] | null): AssigneeEntry[] {
  return (rows ?? []).map(r => ({ userId: nullable(r.user_id), manualName: nullable(r.manual_name) }))
}

function audit(actor: Actor, action: string, target: string, detail: unknown) {
  supabaseAdmin.from('audit_log').insert({ action, user_id: actor.id, target, detail: JSON.stringify(detail) }).then(undefined, () => {})
}

export async function getTaskEvidenceRequirements(templateIds: string[] = []): Promise<QualityTaskEvidenceRequirement[]> {
  if (!templateIds.length) return []
  const { data, error } = await supabaseAdmin.from('quality_task_evidence_requirements').select('*')
    .in('template_id', templateIds).eq('active', true).order('sort_order')
  fail(error)
  return ((data ?? []) as Row[]).map(row => ({
    id: str(row.id), templateId: str(row.template_id), label: str(row.label), evidenceKind: str(row.evidence_kind),
    required: Boolean(row.required), minimumFiles: Number(row.minimum_files), sortOrder: Number(row.sort_order),
  }))
}

export async function getQualityTaskTemplates(activeOnly = false, workstream: TaskWorkstream = 'quality'): Promise<QualityTaskTemplate[]> {
  let query = supabaseAdmin.from('quality_task_templates').select('*').eq('workstream', workstream).order('activity_no')
  if (activeOnly) query = query.eq('active', true)
  const { data: templateRows, error } = await query
  fail(error)
  const templateIds = ((templateRows ?? []) as Row[]).map(row => str(row.id))
  const [{ data: scheduleRows, error: scheduleError }, { data: defaultRows, error: defaultError }, evidenceRequirements] = templateIds.length
    ? await Promise.all([
        supabaseAdmin.from('quality_task_schedules').select('*').in('template_id', templateIds).order('starts_on'),
        supabaseAdmin.from('quality_task_default_assignees').select('*').in('template_id', templateIds),
        getTaskEvidenceRequirements(templateIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, []]
  fail(scheduleError); fail(defaultError)
  const schedules = new Map<string, QualityTaskSchedule[]>()
  for (const row of (scheduleRows ?? []) as Row[]) {
    const templateId = str(row.template_id)
    schedules.set(templateId, [...(schedules.get(templateId) ?? []), {
      id: str(row.id), templateId, intervalUnit: str(row.interval_unit) as TaskIntervalUnit,
      intervalCount: Number(row.interval_count), recurrenceMode: (str(row.recurrence_mode) || 'fixed_calendar') as RecurrenceMode,
      dueDayOfMonth: row.due_day_of_month == null ? null : Number(row.due_day_of_month),
      startsOn: str(row.starts_on), endsOn: nullable(row.ends_on), active: Boolean(row.active),
    }])
  }
  const defaults = new Map<string, AssigneeEntry[]>()
  for (const row of (defaultRows ?? []) as Row[]) defaults.set(str(row.template_id), [...(defaults.get(str(row.template_id)) ?? []), { userId: nullable(row.user_id), manualName: nullable(row.manual_name) }])
  const requirements = new Map<string, QualityTaskEvidenceRequirement[]>()
  for (const item of evidenceRequirements) requirements.set(item.templateId, [...(requirements.get(item.templateId) ?? []), item])
  return ((templateRows ?? []) as Row[]).map(row => ({
    id: str(row.id), sourceKey: nullable(row.source_key), workstream: (str(row.workstream) || 'quality') as TaskWorkstream,
    categoryCode: str(row.category_code), categoryName: str(row.category_name),
    activityNo: row.activity_no == null ? null : Number(row.activity_no), title: str(row.title), description: nullable(row.description),
    referenceCode: nullable(row.reference_code), frequencyText: str(row.frequency_text), ownerText: str(row.owner_text),
    taskKind: str(row.task_kind) as TaskKind, approvalMode: str(row.approval_mode) === 'required' ? 'required' : 'none',
    integrationKind: integrationKind(row.integration_kind),
    approverId: nullable(row.approver_id), reminderDays: Number(row.reminder_days), evidenceRequired: Boolean(row.evidence_required),
    active: Boolean(row.active), defaultAssignees: defaults.get(str(row.id)) ?? [],
    defaultParticipantDepts: (row.default_participant_depts ?? []) as string[],
    defaultParticipantUserIds: (row.default_participant_user_ids ?? []) as string[],
    evidenceRequirements: requirements.get(str(row.id)) ?? [],
    schedules: schedules.get(str(row.id)) ?? [],
  }))
}

function periodLabel(start: string, end: string) {
  const a = new Date(`${start}T00:00:00+07:00`)
  const b = new Date(`${end}T00:00:00+07:00`)
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return a.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
  return `${a.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' })} – ${b.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' })}`
}

async function assertNoMeetingConflict(input: {
  startDate: string
  endDate: string
  startTime: string | null
  endTime: string | null
}) {
  const { data, error } = await supabaseAdmin
    .from('quality_task_instances')
    .select('id, schedule_id, period_start, period_end, planned_date, planned_start_time, planned_end_time, note, quality_task_templates!inner(task_kind,workstream)')
    .eq('quality_task_templates.task_kind', 'meeting')
    .eq('quality_task_templates.workstream', 'quality')
  fail(error)

  const conflict = ((data ?? []) as Row[]).some(row => {
    // Cancelled scheduled occurrences stay in the database for audit history but
    // no longer occupy a meeting slot.
    if (nullable(row.note) === CANCELLED_NOTE) return false

    const plannedDate = nullable(row.planned_date)
    if (!plannedDate) return false

    const existingStartDate = row.schedule_id ? plannedDate : str(row.period_start)
    const existingEndDate = row.schedule_id ? plannedDate : str(row.period_end)
    if (!existingStartDate || !existingEndDate) return false

    return meetingSlotsOverlap(
      {
        startDate: input.startDate,
        endDate: input.endDate,
        startTime: input.startTime,
        endTime: input.endTime,
      },
      {
        startDate: existingStartDate,
        endDate: existingEndDate,
        startTime: nullableTime(row.planned_start_time),
        endTime: nullableTime(row.planned_end_time),
      },
    )
  })

  if (conflict) throw new Error('ช่วงเวลาดังกล่าวมีประชุมแล้ว')
}

export async function getQualityTaskOccurrences(
  input: { from: string; to: string; actorId: string; level: PermLevel; scope?: 'mine' | 'all'; workstream?: TaskWorkstream },
  prefetched?: { templates: QualityTaskTemplate[]; people: TaskPerson[] },
) {
  const workstream = input.workstream ?? 'quality'
  const templates = prefetched?.templates ?? await getQualityTaskTemplates(true, workstream)
  if (!templates.length) return []
  const people = prefetched?.people ?? await listTaskPeople()
  const { data: instanceRows, error } = await supabaseAdmin.from('quality_task_instances').select('*')
    .in('template_id', templates.map(template => template.id)).lte('period_start', input.to).gte('period_end', input.from)
  fail(error)
  // Widen the holiday lookup a little past `to` since an auto due date near the edge of the
  // range can shift forward past it when it lands on a holiday/weekend.
  const holidayShiftEnd = new Date(`${input.to}T00:00:00Z`)
  holidayShiftEnd.setUTCDate(holidayShiftEnd.getUTCDate() + 7)
  const holidays = new Set((await listQualityTaskHolidays(input.from, holidayShiftEnd.toISOString().slice(0, 10))).map(holiday => holiday.holidayDate))
  const instanceIds = ((instanceRows ?? []) as Row[]).map(r => str(r.id))
  const [{ data: assigneeRows, error: assigneeError }, { data: attachmentRows, error: attachmentError }, { data: checkInRows, error: checkInError }] = instanceIds.length
    ? await Promise.all([
        supabaseAdmin.from('quality_task_instance_assignees').select('*').in('instance_id', instanceIds),
        supabaseAdmin.from('quality_task_attachments').select('*').in('instance_id', instanceIds).order('uploaded_at', { ascending: false }),
        supabaseAdmin.from('quality_task_check_ins').select('*').in('instance_id', instanceIds).order('checked_in_at'),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }]
  fail(assigneeError); fail(attachmentError); fail(checkInError)
  const assignees = new Map<string, AssigneeEntry[]>()
  for (const row of (assigneeRows ?? []) as Row[]) assignees.set(str(row.instance_id), [...(assignees.get(str(row.instance_id)) ?? []), { userId: nullable(row.user_id), manualName: nullable(row.manual_name) }])
  const attachments = new Map<string, QualityTaskAttachment[]>()
  for (const row of (attachmentRows ?? []) as Row[]) {
    const instanceId = str(row.instance_id)
    attachments.set(instanceId, [...(attachments.get(instanceId) ?? []), {
      id: str(row.id), instanceId, fileName: str(row.file_name), contentType: str(row.content_type), sizeBytes: Number(row.size_bytes),
      requirementId: nullable(row.requirement_id), evidenceKind: str(row.evidence_kind) || 'document',
      uploadedBy: str(row.uploaded_by), uploadedAt: str(row.uploaded_at),
    }])
  }
  const checkIns = new Map<string, QualityTaskCheckIn[]>()
  for (const row of (checkInRows ?? []) as Row[]) {
    const instanceId = str(row.instance_id)
    checkIns.set(instanceId, [...(checkIns.get(instanceId) ?? []), {
      userId: nullable(row.user_id), checkedInAt: str(row.checked_in_at),
      method: str(row.method) === 'manual' ? 'manual' : str(row.method) === 'guest' ? 'guest' : 'qr', wasUnlisted: Boolean(row.was_unlisted),
      guestName: nullable(row.guest_name), guestSurname: nullable(row.guest_surname), guestDepartment: nullable(row.guest_department),
    }])
  }
  const instanceByKey = new Map<string, Row>()
  for (const row of (instanceRows ?? []) as Row[]) instanceByKey.set(occurrenceKey(nullable(row.schedule_id), str(row.template_id), str(row.period_start), str(row.id)), row)
  const today = bangkokToday()
  const scheduledFrom = input.from < QUALITY_TASK_TRACKING_START ? QUALITY_TASK_TRACKING_START : input.from
  const result: QualityTaskOccurrence[] = []
  for (const template of templates) {
    for (const schedule of template.schedules.filter(s => s.active)) {
      const materializedRollingPeriods = ((instanceRows ?? []) as Row[])
        .filter(row => str(row.schedule_id) === schedule.id)
        .map(row => ({ start: str(row.period_start), end: str(row.period_end) }))
      const periods = schedule.recurrenceMode === 'rolling_completion'
        ? (materializedRollingPeriods.length ? materializedRollingPeriods : generatePeriods(schedule, scheduledFrom, input.to).slice(0, 1))
        : generatePeriods(schedule, scheduledFrom, input.to)
      for (const period of periods) {
        const key = occurrenceKey(schedule.id, template.id, period.start)
        const row = instanceByKey.get(key)
        if (nullable(row?.note) === CANCELLED_NOTE) continue
        const instanceId = row ? str(row.id) : null
        const assigned = resolveAssigneeEntries(template.defaultAssignees, instanceId ? assignees.get(instanceId) ?? [] : [])
        const rowDepts = row ? ((row.participant_depts ?? []) as string[]) : []
        const rowUserIds = row ? ((row.participant_user_ids ?? []) as string[]) : []
        const selection = resolveParticipantSelection(template.defaultParticipantDepts, template.defaultParticipantUserIds, rowDepts, rowUserIds)
        const resolvedParticipants = resolveParticipants(people, selection.depts, selection.userIds)
        const status = taskStatus(row?.status)
        const state = deriveTaskState({ status, plannedDate: nullable(row?.planned_date), periodStart: period.start, periodEnd: period.end, dueDayOfMonth: schedule.dueDayOfMonth, reminderDays: template.reminderDays }, today, holidays)
        result.push({ key, instanceId, template, scheduleId: schedule.id, periodStart: period.start, periodEnd: period.end,
          periodLabel: row ? str(row.period_label) : periodLabel(period.start, period.end), ownerTextOverride: nullable(row?.owner_text_override), plannedDate: nullable(row?.planned_date),
          plannedStartTime: nullableTime(row?.planned_start_time), plannedEndTime: nullableTime(row?.planned_end_time),
          meetingLocation: nullable(row?.meeting_location), meetingAgenda: nullable(row?.meeting_agenda),
          status, note: nullable(row?.note), completionNote: nullable(row?.completion_note),
          completedBy: nullable(row?.completed_by), completedAt: nullable(row?.completed_at), assignees: assigned,
          submittedBy: nullable(row?.submitted_by), submittedAt: nullable(row?.submitted_at), reviewedBy: nullable(row?.reviewed_by),
          reviewedAt: nullable(row?.reviewed_at), reviewNote: nullable(row?.review_note),
          participantDepts: rowDepts, participantUserIds: rowUserIds,
          participants: resolvedParticipants.map(p => ({ id: str(p.id), name: str(p.name), positionTitle: nullable((p as Row).position_title) })),
          attachments: instanceId ? attachments.get(instanceId) ?? [] : [],
          checkInToken: nullable(row?.check_in_token), checkInClosedAt: nullable(row?.check_in_closed_at), checkIns: instanceId ? checkIns.get(instanceId) ?? [] : [], ...state })
      }
    }
  }
  for (const row of (instanceRows ?? []) as Row[]) {
    if (row.schedule_id) continue
    if (nullable(row.note) === CANCELLED_NOTE) continue
    const template = templates.find(t => t.id === row.template_id)
    if (!template) continue
    const instanceId = str(row.id)
    const assigned = resolveAssigneeEntries(template.defaultAssignees, assignees.get(instanceId) ?? [])
    const rowDepts = (row.participant_depts ?? []) as string[]
    const rowUserIds = (row.participant_user_ids ?? []) as string[]
    const selection = resolveParticipantSelection(template.defaultParticipantDepts, template.defaultParticipantUserIds, rowDepts, rowUserIds)
    const resolvedParticipants = resolveParticipants(people, selection.depts, selection.userIds)
    const status = taskStatus(row.status)
    const state = deriveTaskState({ status, plannedDate: nullable(row.planned_date), periodEnd: str(row.period_end), reminderDays: template.reminderDays }, today, holidays)
    result.push({ key: occurrenceKey(null, template.id, str(row.period_start), instanceId), instanceId, template, scheduleId: null,
      periodStart: str(row.period_start), periodEnd: str(row.period_end), periodLabel: str(row.period_label), ownerTextOverride: nullable(row.owner_text_override), plannedDate: nullable(row.planned_date),
      plannedStartTime: nullableTime(row.planned_start_time), plannedEndTime: nullableTime(row.planned_end_time),
      meetingLocation: nullable(row.meeting_location), meetingAgenda: nullable(row.meeting_agenda),
      status, note: nullable(row.note), completionNote: nullable(row.completion_note),
      completedBy: nullable(row.completed_by), completedAt: nullable(row.completed_at), assignees: assigned,
      submittedBy: nullable(row.submitted_by), submittedAt: nullable(row.submitted_at), reviewedBy: nullable(row.reviewed_by),
      reviewedAt: nullable(row.reviewed_at), reviewNote: nullable(row.review_note),
      participantDepts: rowDepts, participantUserIds: rowUserIds,
      participants: resolvedParticipants.map(p => ({ id: str(p.id), name: str(p.name), positionTitle: nullable((p as Row).position_title) })),
      attachments: attachments.get(instanceId) ?? [],
      checkInToken: nullable(row.check_in_token), checkInClosedAt: nullable(row.check_in_closed_at), checkIns: checkIns.get(instanceId) ?? [], ...state })
  }
  const scoped = input.scope === 'mine' && input.level !== 'edit' ? result.filter(o => o.assignees.some(e => e.userId === input.actorId)) : result
  const bounded = workstream === 'safety' ? scoped.filter(item => item.effectiveDueDate >= input.from && item.effectiveDueDate <= input.to) : scoped
  return bounded.sort((a, b) => a.effectiveDueDate.localeCompare(b.effectiveDueDate) || a.template.title.localeCompare(b.template.title, 'th'))
}

async function replaceAssignees(instanceId: string, entries: AssigneeEntry[]) {
  const { error } = await supabaseAdmin.from('quality_task_instance_assignees').delete().eq('instance_id', instanceId)
  fail(error)
  if (entries.length) fail((await supabaseAdmin.from('quality_task_instance_assignees').insert(entries.map(e => ({ instance_id: instanceId, user_id: e.userId, manual_name: e.manualName })))).error)
}

async function assertTemplateWorkstream(templateId: string, workstream: TaskWorkstream) {
  const { data, error } = await supabaseAdmin.from('quality_task_templates').select('id, task_kind').eq('id', templateId).eq('workstream', workstream).maybeSingle()
  fail(error)
  if (!data) throw new Error('Task template not found')
  return { id: str(data.id), taskKind: str(data.task_kind) as TaskKind }
}

export async function materializeOccurrence(payload: OccurrenceCreatePayload, actor: Actor, level: PermLevel, workstream: TaskWorkstream = 'quality') {
  if (payload.mode === 'adHoc') {
    if (level !== 'edit') throw new Error('Forbidden')
    const template = await assertTemplateWorkstream(payload.templateId, workstream)
    const hasMeetingDetails = Boolean(
      payload.location?.trim() ||
      payload.agenda?.trim() ||
      (payload.participantDepts?.length ?? 0) > 0 ||
      (payload.participantUserIds?.length ?? 0) > 0,
    )
    if (template.taskKind !== 'meeting' &&
      (payload.startTime != null || payload.endTime != null || hasMeetingDetails)) {
      throw new Error('รายละเอียดการประชุมใช้ได้เฉพาะงานประชุม')
    }
    const meetingTime = template.taskKind === 'meeting' ? normalizeMeetingTime(payload.startTime, payload.endTime) : { startTime: null, endTime: null }
    if (template.taskKind === 'meeting') {
      await assertNoMeetingConflict({
        startDate: payload.startDate,
        endDate: payload.endDate,
        startTime: meetingTime.startTime,
        endTime: meetingTime.endTime,
      })
    }
    const meetingDetails = template.taskKind === 'meeting'
      ? { meeting_location: payload.location?.trim() || null, meeting_agenda: payload.agenda?.trim() || null }
      : { meeting_location: null, meeting_agenda: null }
    const { data, error } = await supabaseAdmin.from('quality_task_instances').insert({ template_id: payload.templateId, period_start: payload.startDate, period_end: payload.endDate, period_label: payload.label.trim(), owner_text_override: payload.ownerText?.trim() || null, planned_date: payload.startDate, planned_start_time: meetingTime.startTime, planned_end_time: meetingTime.endTime, ...meetingDetails, participant_depts: template.taskKind === 'meeting' ? payload.participantDepts ?? [] : [], participant_user_ids: template.taskKind === 'meeting' ? payload.participantUserIds ?? [] : [], created_by: actor.id, updated_by: actor.id }).select('*').single()
    fail(error); await replaceAssignees(str(data.id), payload.assignees); audit(actor, 'quality_task.instance.create', str(data.id), payload); return data
  }
  const { data: scheduleRow, error } = await supabaseAdmin.from('quality_task_schedules').select('*').eq('id', payload.scheduleId).single()
  fail(error)
  await assertTemplateWorkstream(str(scheduleRow.template_id), workstream)
  const schedule: QualityTaskSchedule = { id: str(scheduleRow.id), templateId: str(scheduleRow.template_id), intervalUnit: str(scheduleRow.interval_unit) as TaskIntervalUnit, intervalCount: Number(scheduleRow.interval_count), recurrenceMode: (str(scheduleRow.recurrence_mode) || 'fixed_calendar') as RecurrenceMode, dueDayOfMonth: scheduleRow.due_day_of_month == null ? null : Number(scheduleRow.due_day_of_month), startsOn: str(scheduleRow.starts_on), endsOn: nullable(scheduleRow.ends_on), active: Boolean(scheduleRow.active) }
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

export async function getOccurrenceAccess(instanceId: string, actor: Actor, level: PermLevel, workstream: TaskWorkstream = 'quality', allowApprover = false) {
  const { data: instance, error } = await supabaseAdmin.from('quality_task_instances').select('*, quality_task_templates!inner(source_key,evidence_required,approval_mode,approver_id,workstream,task_kind,integration_kind)').eq('id', instanceId).eq('quality_task_templates.workstream', workstream).single()
  fail(error)
  const [{ data: overrides }, { data: defaults }] = await Promise.all([
    supabaseAdmin.from('quality_task_instance_assignees').select('user_id, manual_name').eq('instance_id', instanceId),
    supabaseAdmin.from('quality_task_default_assignees').select('user_id, manual_name').eq('template_id', instance.template_id),
  ])
  const entries = resolveAssigneeEntries(rowsToAssigneeEntries(defaults), rowsToAssigneeEntries(overrides))
  const ids = entries.map(e => e.userId).filter((id): id is string => id != null)
  const template = instance.quality_task_templates as Row
  const isDesignatedApprover = canApproveTask(level, actor.id, nullable(template?.approver_id))
  if (!canMutateOccurrence(level, ids.includes(actor.id), entries.length === 0) && !(allowApprover && isDesignatedApprover)) throw new Error('Forbidden')
  return { instance, template, evidenceRequired: Boolean(template?.evidence_required), assignees: entries }
}

export async function getOccurrenceReadAccess(instanceId: string, level: PermLevel, workstream: TaskWorkstream = 'quality') {
  if (!canViewOccurrence(level)) throw new Error('Forbidden')
  const { data: instance, error } = await supabaseAdmin.from('quality_task_instances').select('id, quality_task_templates!inner(workstream)').eq('id', instanceId).eq('quality_task_templates.workstream', workstream).single()
  fail(error)
  return instance
}

export async function updateOccurrence(instanceId: string, payload: OccurrenceActionPayload, actor: Actor, level: PermLevel, workstream: TaskWorkstream = 'quality') {
  const reviewing = payload.action === 'approve' || payload.action === 'reject'
  const access = await getOccurrenceAccess(instanceId, actor, level, workstream, reviewing)
  if (workstream === 'safety' && isMonthlySafetySourceKey(str(access.template.source_key))) {
    throw new Error('งานแม่รายเดือนปิดอัตโนมัติจากผลตรวจของทุกจุด กรุณาดำเนินการในแท็บตรวจประจำเดือน')
  }
  const inspectionTask = workstream === 'safety' && str(access.template.integration_kind) === 'safety_inspection'
  if (inspectionTask && ['start', 'submit', 'complete'].includes(payload.action)) {
    throw new Error(payload.action === 'start'
      ? 'กรุณาเริ่มงานตรวจจากหน้า งานความปลอดภัย เพื่อสร้างรอบตรวจที่เชื่อมกับอุปกรณ์'
      : 'งานตรวจอุปกรณ์จะปิดอัตโนมัติเมื่อปิด Inspection Round ครบทุกอุปกรณ์')
  }
  if (payload.action === 'schedule') {
    if ((payload.assignees || payload.participantDepts || payload.participantUserIds) && level !== 'edit') throw new Error('Forbidden')
    if (payload.plannedDate) {
      if (isWeekendDate(payload.plannedDate)) throw new Error('ไม่สามารถเลือกวันเสาร์-อาทิตย์ได้')
      const { data: holiday, error: holidayError } = await supabaseAdmin.from('quality_task_holidays').select('name').eq('holiday_date', payload.plannedDate).maybeSingle()
      fail(holidayError)
      if (holiday) throw new Error(`วันที่เลือกตรงกับวันหยุด: ${str(holiday.name)}`)
    }
    if (payload.plannedDate && access.instance.schedule_id) {
      const { data: schedule, error: scheduleError } = await supabaseAdmin.from('quality_task_schedules').select('interval_unit').eq('id', access.instance.schedule_id).single()
      fail(scheduleError)
      if (!schedule) throw new Error('Schedule not found')
      if (schedule.interval_unit === 'month' && payload.plannedDate.slice(0, 7) !== str(access.instance.period_start).slice(0, 7)) {
        throw new Error('กรุณาเลือกวันที่ภายในเดือนของรอบกิจกรรม')
      }
    }
    const hasTimePatch = payload.startTime !== undefined || payload.endTime !== undefined
    const timePatch: { startTime: string | null; endTime: string | null } | null = hasTimePatch
      ? (() => {
          if (str(access.template.task_kind) !== 'meeting') {
            if (payload.startTime != null || payload.endTime != null) throw new Error('ช่วงเวลาใช้ได้เฉพาะงานประชุม')
            return { startTime: null, endTime: null }
          }
          return normalizeMeetingTime(
            payload.startTime === undefined ? nullableTime(access.instance.planned_start_time) : payload.startTime,
            payload.endTime === undefined ? nullableTime(access.instance.planned_end_time) : payload.endTime,
          )
        })()
      : null
    const { error } = await supabaseAdmin.from('quality_task_instances').update({
      planned_date: payload.plannedDate || null, note: payload.note?.trim() || null,
      ...(timePatch ? { planned_start_time: timePatch.startTime, planned_end_time: timePatch.endTime } : {}),
      updated_by: actor.id, updated_at: new Date().toISOString(),
      ...(payload.participantDepts ? { participant_depts: payload.participantDepts } : {}),
      ...(payload.participantUserIds ? { participant_user_ids: payload.participantUserIds } : {}),
    }).eq('id', instanceId)
    fail(error); if (payload.assignees) await replaceAssignees(instanceId, payload.assignees)
  } else if (payload.action === 'start') {
    if (taskStatus(access.instance.status) === 'open') {
      fail((await supabaseAdmin.from('quality_task_instances').update({ status: 'in_progress', updated_by: actor.id, updated_at: new Date().toISOString() }).eq('id', instanceId)).error)
    }
  } else if (payload.action === 'complete' || payload.action === 'submit') {
    if (access.instance.status === 'completed') return access.instance
    await assertRequiredEvidenceComplete(instanceId, str(access.instance.template_id), access.evidenceRequired)
    const now = new Date().toISOString()
    const requiresReview = payload.action === 'submit' && str(access.template.approval_mode) === 'required'
    const nextStatus: TaskStatus = requiresReview ? 'pending_review' : 'completed'
    fail((await supabaseAdmin.from('quality_task_instances').update({
      status: nextStatus, completion_note: payload.completionNote?.trim() || null,
      submitted_by: actor.id, submitted_at: now,
      completed_by: nextStatus === 'completed' ? actor.id : null, completed_at: nextStatus === 'completed' ? now : null,
      reviewed_by: null, reviewed_at: null, review_note: null,
      updated_by: actor.id, updated_at: now,
    }).eq('id', instanceId)).error)
    if (payload.action === 'submit') {
      fail((await supabaseAdmin.from('quality_task_reviews').insert({ instance_id: instanceId, action: 'submitted', actor_id: actor.id, note: payload.completionNote?.trim() || null, created_at: now })).error)
    }
    if (nextStatus === 'completed') await materializeNextRollingOccurrence(access.instance, actor.id, now.slice(0, 10))
  } else if (payload.action === 'approve' || payload.action === 'reject') {
    if (taskStatus(access.instance.status) !== 'pending_review') throw new Error('งานนี้ไม่ได้อยู่ในสถานะรอตรวจทาน')
    if (!canApproveTask(level, actor.id, nullable(access.template.approver_id))) throw new Error('Forbidden')
    const approved = payload.action === 'approve'
    const note = approved ? payload.note?.trim() || null : payload.reason.trim()
    if (!approved && !note) throw new Error('กรุณาระบุเหตุผลที่ส่งกลับแก้ไข')
    const now = new Date().toISOString()
    fail((await supabaseAdmin.from('quality_task_reviews').insert({ instance_id: instanceId, action: approved ? 'approved' : 'rejected', note, actor_id: actor.id, created_at: now })).error)
    fail((await supabaseAdmin.from('quality_task_instances').update({
      status: approved ? 'completed' : 'in_progress', reviewed_by: actor.id, reviewed_at: now, review_note: note,
      completed_by: approved ? actor.id : null, completed_at: approved ? now : null,
      updated_by: actor.id, updated_at: now,
    }).eq('id', instanceId)).error)
    if (approved) await materializeNextRollingOccurrence(access.instance, actor.id, now.slice(0, 10))
  } else {
    if (level !== 'edit' || !payload.reason.trim()) throw new Error('ต้องระบุเหตุผลและมีสิทธิ์ edit')
    fail((await supabaseAdmin.from('quality_task_instances').update({ status: 'open', completed_by: null, completed_at: null, completion_note: null, submitted_by: null, submitted_at: null, reviewed_by: null, reviewed_at: null, review_note: null, updated_by: actor.id, updated_at: new Date().toISOString() }).eq('id', instanceId)).error)
    fail((await supabaseAdmin.from('quality_task_reviews').insert({ instance_id: instanceId, action: 'reopened', actor_id: actor.id, note: payload.reason.trim() })).error)
  }
  audit(actor, `quality_task.instance.${payload.action}`, instanceId, payload)
  return (await supabaseAdmin.from('quality_task_instances').select('*').eq('id', instanceId).single()).data
}

async function assertRequiredEvidenceComplete(instanceId: string, templateId: string, evidenceRequired: boolean) {
  const [{ data: requirementRows, error: requirementError }, { data: attachmentRows, error: attachmentError }] = await Promise.all([
    supabaseAdmin.from('quality_task_evidence_requirements').select('id,label,minimum_files').eq('template_id', templateId).eq('active', true).eq('required', true),
    supabaseAdmin.from('quality_task_attachments').select('requirement_id').eq('instance_id', instanceId),
  ])
  fail(requirementError); fail(attachmentError)
  const requirements = (requirementRows ?? []) as Row[]
  if (!requirements.length) {
    const blocked = completionBlockReason(evidenceRequired, (attachmentRows ?? []).length)
    if (blocked) throw new Error(blocked.replace('PDF ', ''))
    return
  }
  const counts = new Map<string, number>()
  for (const row of (attachmentRows ?? []) as Row[]) {
    const requirementId = nullable(row.requirement_id)
    if (requirementId) counts.set(requirementId, (counts.get(requirementId) ?? 0) + 1)
  }
  const missing = requirements.filter(row => (counts.get(str(row.id)) ?? 0) < Number(row.minimum_files))
  if (missing.length) throw new Error(`หลักฐานที่ต้องมีไม่ครบ: ${missing.map(row => str(row.label)).join(', ')}`)
}

async function materializeNextRollingOccurrence(instance: Row, actorId: string, completedOn: string) {
  if (!instance.schedule_id) return
  const { data: schedule, error } = await supabaseAdmin.from('quality_task_schedules').select('*').eq('id', instance.schedule_id).single()
  fail(error)
  if (str(schedule.recurrence_mode) !== 'rolling_completion') return
  const dueOn = nextRollingDueDate(completedOn, str(schedule.interval_unit) as TaskIntervalUnit, Number(schedule.interval_count))
  const { error: upsertError } = await supabaseAdmin.from('quality_task_instances').upsert({
    template_id: instance.template_id, schedule_id: instance.schedule_id, period_start: completedOn, period_end: dueOn,
    period_label: `ครบกำหนด ${new Date(`${dueOn}T00:00:00+07:00`).toLocaleDateString('th-TH')}`,
    planned_date: dueOn, created_by: actorId, updated_by: actorId,
  }, { onConflict: 'schedule_id,period_start', ignoreDuplicates: true })
  fail(upsertError)
}

export async function removeOccurrence(instanceId: string, reason: string | null, actor: Actor, level: PermLevel, workstream: TaskWorkstream = 'quality') {
  if (level !== 'edit') throw new Error('Forbidden')
  const { data: instance, error } = await supabaseAdmin.from('quality_task_instances').select('*, quality_task_templates!inner(workstream)').eq('id', instanceId).eq('quality_task_templates.workstream', workstream).single()
  fail(error)
  if (instance.schedule_id) {
    if (!reason?.trim()) throw new Error('กรุณาระบุเหตุผลที่ยกเลิกรอบนี้')
    const { error: updateError } = await supabaseAdmin.from('quality_task_instances').update({ note: CANCELLED_NOTE, updated_by: actor.id, updated_at: new Date().toISOString() }).eq('id', instanceId)
    fail(updateError)
    const { error: auditError } = await supabaseAdmin.from('audit_log').insert({ action: 'quality_task.instance.cancel', user_id: actor.id, target: instanceId, detail: reason.trim() })
    fail(auditError)
    return { mode: 'cancelled' as const }
  }
  const { data: attachments, error: attachmentError } = await supabaseAdmin.from('quality_task_attachments').select('r2_key').eq('instance_id', instanceId)
  fail(attachmentError)
  await Promise.all((attachments ?? []).map(row => r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: row.r2_key }))))
  const { error: auditError } = await supabaseAdmin.from('audit_log').insert({ action: 'quality_task.instance.delete', user_id: actor.id, target: instanceId, detail: instance.period_label })
  fail(auditError)
  const { error: deleteError } = await supabaseAdmin.from('quality_task_instances').delete().eq('id', instanceId)
  fail(deleteError)
  return { mode: 'deleted' as const }
}

export async function saveTemplate(input: Omit<QualityTaskTemplate, 'id' | 'sourceKey'>, actor: Actor, id?: string, workstream: TaskWorkstream = 'quality') {
  if (input.workstream !== workstream) throw new Error('Task workstream mismatch')
  const payload = { workstream, category_code: input.categoryCode, category_name: input.categoryName, activity_no: input.activityNo, title: input.title.trim(), description: input.description?.trim() || null, reference_code: input.referenceCode?.trim() || null, frequency_text: input.frequencyText.trim(), owner_text: input.ownerText.trim(), task_kind: input.taskKind, approval_mode: input.approvalMode, integration_kind: input.integrationKind, approver_id: input.approverId, reminder_days: input.reminderDays, evidence_required: input.evidenceRequired, active: input.active, default_participant_depts: input.defaultParticipantDepts, default_participant_user_ids: input.defaultParticipantUserIds, updated_at: new Date().toISOString() }
  const result = id ? await supabaseAdmin.from('quality_task_templates').update(payload).eq('id', id).eq('workstream', workstream).select('id').single() : await supabaseAdmin.from('quality_task_templates').insert({ ...payload, created_by: actor.id }).select('id').single()
  fail(result.error); if (!result.data) throw new Error('Template was not saved'); const templateId = str(result.data.id)
  const { data: existingSchedules, error: existingScheduleError } = await supabaseAdmin.from('quality_task_schedules').select('id').eq('template_id', templateId)
  fail(existingScheduleError)
  const retained = new Set(input.schedules.map(s => s.id).filter(Boolean))
  const omitted = (existingSchedules ?? []).map((s: Row) => str(s.id)).filter(id => !retained.has(id))
  if (omitted.length) fail((await supabaseAdmin.from('quality_task_schedules').update({ active: false }).in('id', omitted)).error)
  for (const [index, schedule] of input.schedules.entries()) {
    const schedulePayload = { interval_unit: schedule.intervalUnit, interval_count: schedule.intervalCount, recurrence_mode: schedule.recurrenceMode, due_day_of_month: schedule.dueDayOfMonth ?? null, starts_on: schedule.startsOn, ends_on: schedule.endsOn, active: schedule.active }
    if (schedule.id) fail((await supabaseAdmin.from('quality_task_schedules').update(schedulePayload).eq('id', schedule.id).eq('template_id', templateId)).error)
    else fail((await supabaseAdmin.from('quality_task_schedules').insert({ template_id: templateId, schedule_key: `custom-${Date.now()}-${index + 1}`, ...schedulePayload })).error)
  }
  await supabaseAdmin.from('quality_task_default_assignees').delete().eq('template_id', templateId)
  if (input.defaultAssignees.length) fail((await supabaseAdmin.from('quality_task_default_assignees').insert(input.defaultAssignees.map(e => ({ template_id: templateId, user_id: e.userId, manual_name: e.manualName })))).error)
  const { data: existingRequirements, error: existingRequirementError } = await supabaseAdmin.from('quality_task_evidence_requirements').select('id').eq('template_id', templateId)
  fail(existingRequirementError)
  const retainedRequirements = new Set(input.evidenceRequirements.map(item => item.id).filter(Boolean))
  const omittedRequirements = (existingRequirements ?? []).map((item: Row) => str(item.id)).filter(requirementId => !retainedRequirements.has(requirementId))
  if (omittedRequirements.length) fail((await supabaseAdmin.from('quality_task_evidence_requirements').update({ active: false, updated_at: new Date().toISOString() }).in('id', omittedRequirements)).error)
  for (const [index, item] of input.evidenceRequirements.entries()) {
    const requirementPayload = {
      evidence_kind: item.evidenceKind, label: item.label.trim(), required: item.required, minimum_files: item.minimumFiles,
      sort_order: item.sortOrder || index + 1, active: true, updated_at: new Date().toISOString(),
    }
    if (item.id) fail((await supabaseAdmin.from('quality_task_evidence_requirements').update(requirementPayload).eq('id', item.id).eq('template_id', templateId)).error)
    else fail((await supabaseAdmin.from('quality_task_evidence_requirements').insert({ template_id: templateId, ...requirementPayload })).error)
  }
  audit(actor, id ? 'quality_task.template.update' : 'quality_task.template.create', templateId, payload)
  return templateId
}

export async function deleteTemplate(
  id: string,
  actor: Actor,
  workstream: TaskWorkstream = 'quality',
  options: { archiveWhenUsed?: boolean } = {},
) {
  await assertTemplateWorkstream(id, workstream)
  const { count, error: countError } = await supabaseAdmin.from('quality_task_instances').select('*', { count: 'exact', head: true }).eq('template_id', id)
  fail(countError)
  const mode = templateRemovalMode(count ?? 0)
  if (mode === 'archive') {
    if (!options.archiveWhenUsed) throw new Error('ไม่สามารถลบได้ เนื่องจากกิจกรรมนี้มีการสร้างงานไปแล้ว กรุณาปิดใช้งานแทน')
    fail((await supabaseAdmin.from('quality_task_templates').update({ active: false, updated_at: new Date().toISOString() }).eq('id', id).eq('workstream', workstream)).error)
    audit(actor, 'quality_task.template.archive', id, { workstream, instanceCount: count })
    return { mode }
  }
  await supabaseAdmin.from('quality_task_default_assignees').delete().eq('template_id', id)
  await supabaseAdmin.from('quality_task_schedules').delete().eq('template_id', id)
  fail((await supabaseAdmin.from('quality_task_templates').delete().eq('id', id)).error)
  audit(actor, 'quality_task.template.delete', id, {})
  return { mode }
}

export async function listTaskPeople() {
  const { data, error } = await supabaseAdmin.from('profiles').select('id,name,dept,role,position_title').eq('status', 'active').is('deleted_at', null).order('name')
  fail(error); return data ?? []
}

export async function materializeCertificateRenewals(actorId: string, today = bangkokToday()) {
  const limit = new Date(`${today}T00:00:00Z`)
  limit.setUTCDate(limit.getUTCDate() + 90)
  const through = limit.toISOString().slice(0, 10)
  const [{ data: certificates, error: certificateError }, { data: template, error: templateError }] = await Promise.all([
    supabaseAdmin.from('safety_certificates').select('id,certificate_type,document_no,holder_name,expires_on,owner_id')
      .eq('active', true).eq('no_expiry', false).lte('expires_on', through),
    supabaseAdmin.from('quality_task_templates').select('id').eq('source_key', 'CBH-ST-25').eq('workstream', 'safety').eq('active', true).single(),
  ])
  fail(certificateError); fail(templateError)
  if (!template) throw new Error('Certificate renewal template not found')
  let created = 0
  for (const certificate of (certificates ?? []) as Row[]) {
    const expiresOn = str(certificate.expires_on)
    const { data: existing, error: existingError } = await supabaseAdmin.from('safety_certificate_renewals').select('instance_id')
      .eq('certificate_id', certificate.id).eq('expires_on', expiresOn).maybeSingle()
    fail(existingError)
    if (existing) continue
    const renewalStart = new Date(`${expiresOn}T00:00:00Z`)
    renewalStart.setUTCDate(renewalStart.getUTCDate() - 90)
    const startOn = renewalStart.toISOString().slice(0, 10)
    const { data: instance, error: instanceError } = await supabaseAdmin.from('quality_task_instances').insert({
      template_id: template.id, period_start: startOn, period_end: expiresOn, planned_date: expiresOn,
      period_label: `ต่ออายุ ${str(certificate.certificate_type)} — ${str(certificate.holder_name)}`,
      note: certificate.document_no ? `เลขที่ ${str(certificate.document_no)}` : null,
      created_by: actorId, updated_by: actorId,
    }).select('id').single()
    fail(instanceError)
    if (!instance) throw new Error('Certificate renewal task was not created')
    const { error: renewalError } = await supabaseAdmin.from('safety_certificate_renewals').insert({ certificate_id: certificate.id, expires_on: expiresOn, instance_id: instance.id })
    if (renewalError) {
      await supabaseAdmin.from('quality_task_instances').delete().eq('id', instance.id)
      if (renewalError.code === '23505') continue
      fail(renewalError)
    }
    try {
      if (certificate.owner_id) fail((await supabaseAdmin.from('quality_task_instance_assignees').insert({ instance_id: instance.id, user_id: certificate.owner_id })).error)
      fail((await supabaseAdmin.from('quality_task_links').insert({
        instance_id: instance.id, integration_kind: 'certificate_renewal', source_type: 'safety_certificate_expiry', source_id: `${certificate.id}:${expiresOn}`,
        sync_status: 'synced', metadata: { certificateId: certificate.id, expiresOn }, created_by: actorId,
      })).error)
    } catch (error) {
      await supabaseAdmin.from('safety_certificate_renewals').delete().eq('certificate_id', certificate.id).eq('expires_on', expiresOn)
      await supabaseAdmin.from('quality_task_instances').delete().eq('id', instance.id)
      throw error
    }
    created += 1
  }
  return { created, through }
}

function rowToActionItem(row: Row): QualityTaskActionItem {
  return {
    id: str(row.id), instanceId: str(row.instance_id),
    assignee: { userId: nullable(row.user_id), manualName: nullable(row.manual_name) },
    description: str(row.description), dueDate: nullable(row.due_date),
    doneAt: nullable(row.done_at), doneBy: nullable(row.done_by),
    sourceType: nullable(row.source_type), sourceId: nullable(row.source_id),
  }
}

export async function listActionItems(instanceId: string, level: PermLevel, workstream: TaskWorkstream = 'quality', source?: { sourceType?: string | null; sourceId?: string | null }) {
  await getOccurrenceReadAccess(instanceId, level, workstream)
  let query = supabaseAdmin.from('quality_task_action_items').select('*').eq('instance_id', instanceId)
  if (source?.sourceType) query = query.eq('source_type', source.sourceType)
  if (source?.sourceId) query = query.eq('source_id', source.sourceId)
  const { data, error } = await query
    .order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true })
  fail(error); return (data ?? []).map(rowToActionItem)
}

export async function createActionItem(instanceId: string, input: { assignee: AssigneeEntry; description: string; dueDate: string | null; sourceType?: string | null; sourceId?: string | null }, actor: Actor, level: PermLevel, workstream: TaskWorkstream = 'quality') {
  await getOccurrenceAccess(instanceId, actor, level, workstream)
  const { data, error } = await supabaseAdmin.from('quality_task_action_items').insert({
    instance_id: instanceId, user_id: input.assignee.userId, manual_name: input.assignee.manualName,
    description: input.description.trim(), due_date: input.dueDate || null,
    source_type: input.sourceType || null, source_id: input.sourceId || null, created_by: actor.id,
  }).select('*').single()
  fail(error)
  audit(actor, 'quality_task.action_item.create', instanceId, { itemId: data.id, ...input })
  return rowToActionItem(data)
}

export async function updateActionItem(instanceId: string, itemId: string, patch: { assignee?: AssigneeEntry; description?: string; dueDate?: string | null; done?: boolean }, actor: Actor, level: PermLevel, workstream: TaskWorkstream = 'quality') {
  await getOccurrenceAccess(instanceId, actor, level, workstream)
  const update: Row = { updated_at: new Date().toISOString() }
  if (patch.assignee) { update.user_id = patch.assignee.userId; update.manual_name = patch.assignee.manualName }
  if (patch.description !== undefined) update.description = patch.description.trim()
  if (patch.dueDate !== undefined) update.due_date = patch.dueDate || null
  if (patch.done !== undefined) {
    update.done_at = patch.done ? new Date().toISOString() : null
    update.done_by = patch.done ? actor.id : null
  }
  const { data, error } = await supabaseAdmin.from('quality_task_action_items').update(update)
    .eq('id', itemId).eq('instance_id', instanceId).select('*').single()
  fail(error); if (!data) throw new Error('Action item not found')
  audit(actor, 'quality_task.action_item.update', instanceId, { itemId, ...patch })
  return rowToActionItem(data)
}

export async function deleteActionItem(instanceId: string, itemId: string, actor: Actor, level: PermLevel, workstream: TaskWorkstream = 'quality') {
  await getOccurrenceAccess(instanceId, actor, level, workstream)
  const { error } = await supabaseAdmin.from('quality_task_action_items').delete().eq('id', itemId).eq('instance_id', instanceId)
  fail(error)
  audit(actor, 'quality_task.action_item.delete', instanceId, { itemId })
}
