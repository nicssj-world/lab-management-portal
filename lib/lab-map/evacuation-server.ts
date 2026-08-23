import 'server-only'

import type { PermLevel } from '@/lib/permissions'
import type { Actor } from '@/lib/auth/guards'
import { bangkokToday } from '@/lib/quality-tasks/logic'
import { fiscalYearForDate } from '@/lib/quality-tasks/safety'
import { getQualityTaskOccurrences, getQualityTaskTemplates, materializeOccurrence } from '@/lib/quality-tasks/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditSafety } from './safety-access'
import { listAssemblyPoints } from './safety-server'
import { getStaffLabMapDTO } from './server'
import { LAB_ROUTE_PRESETS } from './manifest'
import {
  calculateEvacuationMetrics,
  missingEvacuationEvidence,
  projectEvacuationTask,
  validateEvacuationDrillSession,
  validateEvacuationPlanForPublish,
  type EvacuationDashboardDTO,
  type EvacuationDrillCycleDTO,
  type EvacuationDrillSessionDTO,
  type EvacuationExitAssignmentDTO,
  type EvacuationPlanDTO,
  type EvacuationPlanStatus,
  type EvacuationReleaseDTO,
  type EvacuationTaskDTO,
  type EvacuationTaskLinkDTO,
} from './evacuation'

type Row = Record<string, any>

const PLAN_TASK_KEYS = new Set(['CBH-ST-15', 'CBH-ST-21'])
const DRILL_TASK_KEYS = new Set(['CBH-ST-17', 'CBH-ST-21'])
const EVACUATION_TASK_KEYS = new Set([...PLAN_TASK_KEYS, ...DRILL_TASK_KEYS])

function fail(error: { message: string } | null, fallback = 'Evacuation operation failed') {
  if (error) throw new Error(error.message || fallback)
}

function str(value: unknown) { return typeof value === 'string' ? value : '' }
function nullable(value: unknown) { return typeof value === 'string' ? value : null }
function numberOrNull(value: unknown) { return value == null || value === '' ? null : Number(value) }

function dateDurationSeconds(start: string | null, end: string | null) {
  if (!start || !end) return null
  const seconds = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  return seconds >= 0 ? seconds : null
}

function linkDTO(row: Row | null | undefined): EvacuationTaskLinkDTO | null {
  if (!row) return null
  return {
    id: str(row.id), integrationKind: str(row.integration_kind) as EvacuationTaskLinkDTO['integrationKind'],
    sourceType: str(row.source_type), sourceId: str(row.source_id),
    syncStatus: (str(row.sync_status) || 'pending') as EvacuationTaskLinkDTO['syncStatus'],
  }
}

function assignmentDTO(row: Row): EvacuationExitAssignmentDTO {
  return {
    id: str(row.id), planVersionId: str(row.plan_version_id),
    scopeType: str(row.scope_type) as EvacuationExitAssignmentDTO['scopeType'],
    scopeCode: str(row.scope_code), exitCode: str(row.exit_code),
    routeVariant: str(row.route_variant) as EvacuationExitAssignmentDTO['routeVariant'],
    routeCode: nullable(row.route_code), assemblyPointId: str(row.assembly_point_id),
    postExitInstructionTh: nullable(row.post_exit_instruction_th), responsibleText: nullable(row.responsible_text),
  }
}

function planDTO(row: Row, assignments: Row[], releaseById: Map<string, Row>, linkBySourceId: Map<string, Row>): EvacuationPlanDTO {
  const release = releaseById.get(str(row.map_release_id))
  return {
    id: str(row.id), planCode: str(row.plan_code), versionCode: str(row.version_code),
    status: str(row.status) as EvacuationPlanStatus, mapReleaseId: str(row.map_release_id),
    mapReleaseVersion: release ? str(release.version_code) : null,
    effectiveDate: nullable(row.effective_date), reviewDueDate: nullable(row.review_due_date),
    reportPointId: nullable(row.report_point_id), headcountResponsible: nullable(row.headcount_responsible),
    reviewedBy: nullable(row.reviewed_by), reviewedAt: nullable(row.reviewed_at),
    approvedBy: nullable(row.approved_by), approvedAt: nullable(row.approved_at), notes: nullable(row.notes),
    assignments: assignments.filter(item => str(item.plan_version_id) === str(row.id)).map(assignmentDTO),
    reviewTaskLink: linkDTO(linkBySourceId.get(str(row.id))),
    createdAt: str(row.created_at), updatedAt: str(row.updated_at),
  }
}

function sessionDTO(row: Row, evidenceRows: Row[]): EvacuationDrillSessionDTO {
  const startedAt = nullable(row.started_at)
  const endedAt = nullable(row.ended_at)
  return {
    id: str(row.id), cycleId: str(row.cycle_id), scenario: str(row.scenario), startedAt, endedAt,
    durationSeconds: dateDurationSeconds(startedAt, endedAt), offHours: Boolean(row.off_hours),
    scopeCodes: Array.isArray(row.scope_codes) ? row.scope_codes.map(String) : [],
    routeCodes: Array.isArray(row.route_codes) ? row.route_codes.map(String) : [],
    expectedParticipants: Number(row.expected_participants ?? 0), actualParticipants: Number(row.actual_participants ?? 0),
    expectedHeadcount: Number(row.expected_headcount ?? 0), checkedHeadcount: Number(row.checked_headcount ?? 0),
    missingHeadcount: Number(row.missing_headcount ?? 0), injuredCount: Number(row.injured_count ?? 0),
    reportPointId: nullable(row.report_point_id), observerText: nullable(row.observer_text),
    evaluation: nullable(row.evaluation), compliancePercent: numberOrNull(row.compliance_percent),
    deviationText: nullable(row.deviation_text),
    headcountComplete: row.expected_headcount == null || Number(row.expected_headcount) === 0
      ? null
      : Number(row.missing_headcount ?? 0) === 0 && Number(row.checked_headcount ?? 0) >= Number(row.expected_headcount),
    status: str(row.status) as EvacuationDrillSessionDTO['status'],
    evidence: evidenceRows.filter(item => str(item.session_id) === str(row.id)).map(item => ({
      attachmentId: str(item.attachment_id), evidenceRole: str(item.evidence_role) as EvacuationDrillSessionDTO['evidence'][number]['evidenceRole'],
    })),
    createdAt: str(row.created_at), updatedAt: str(row.updated_at),
  }
}

function fiscalRange(today: string) {
  const fiscalYear = fiscalYearForDate(today)
  const gregorianEndYear = fiscalYear - 543
  return { fiscalYear, from: `${gregorianEndYear - 1}-10-01`, to: `${gregorianEndYear}-09-30` }
}

async function relevantTaskData(actorId: string, level: PermLevel) {
  const templates = await getQualityTaskTemplates(true, 'safety')
  const relevantTemplates = templates.filter(template => EVACUATION_TASK_KEYS.has(template.sourceKey ?? ''))
  const { from, to } = fiscalRange(bangkokToday())
  const occurrences = relevantTemplates.length
    ? await getQualityTaskOccurrences({ from, to, actorId, level, scope: 'all', workstream: 'safety' }, { templates: relevantTemplates, people: [] })
    : []
  const instanceIds = occurrences.map(item => item.instanceId).filter((id): id is string => Boolean(id))
  const { data: links, error: linkError } = instanceIds.length
    ? await supabaseAdmin.from('quality_task_links').select('*').in('instance_id', instanceIds).in('integration_kind', ['evacuation_plan_review', 'evacuation_drill'])
    : { data: [], error: null }
  fail(linkError)
  const linksByInstanceId = new Map<string, Row>()
  for (const row of (links ?? []) as Row[]) linksByInstanceId.set(str(row.instance_id), row)
  const taskByInstanceId = new Map<string, EvacuationTaskDTO>()
  const tasks = occurrences.map(item => {
    const taskLink = item.instanceId ? linksByInstanceId.get(item.instanceId) ?? null : null
    const task = projectEvacuationTask(item, taskLink ? {
      id: str(taskLink.id), integration_kind: str(taskLink.integration_kind), source_type: str(taskLink.source_type),
      source_id: str(taskLink.source_id), sync_status: str(taskLink.sync_status),
    } : null)
    if (task.instanceId) taskByInstanceId.set(task.instanceId, task)
    return task
  })
  return { templates: relevantTemplates, tasks, taskByInstanceId }
}

async function listPlanData() {
  const [{ data: planRows, error: planError }, { data: releaseRows, error: releaseError }] = await Promise.all([
    supabaseAdmin.from('evacuation_plan_versions').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('lab_map_versions').select('id,version_code,status,effective_date').order('created_at', { ascending: false }),
  ])
  fail(planError); fail(releaseError)
  const planIds = ((planRows ?? []) as Row[]).map(row => str(row.id))
  const [{ data: assignmentRows, error: assignmentError }, { data: linkRows, error: linkError }] = await Promise.all([
    planIds.length ? supabaseAdmin.from('evacuation_exit_assignments').select('*').in('plan_version_id', planIds).order('scope_code') : Promise.resolve({ data: [], error: null }),
    planIds.length ? supabaseAdmin.from('quality_task_links').select('*').eq('integration_kind', 'evacuation_plan_review').eq('source_type', 'evacuation_plan_version').in('source_id', planIds) : Promise.resolve({ data: [], error: null }),
  ])
  fail(assignmentError); fail(linkError)
  const releaseById = new Map(((releaseRows ?? []) as Row[]).map(row => [str(row.id), row]))
  const linkBySourceId = new Map(((linkRows ?? []) as Row[]).map(row => [str(row.source_id), row]))
  return {
    plans: ((planRows ?? []) as Row[]).map(row => planDTO(row, (assignmentRows ?? []) as Row[], releaseById, linkBySourceId)),
    releases: ((releaseRows ?? []) as Row[]).map(row => ({ id: str(row.id), versionCode: str(row.version_code), status: str(row.status) as EvacuationReleaseDTO['status'], effectiveDate: nullable(row.effective_date) })),
  }
}

async function listCycleData(taskByInstanceId: Map<string, EvacuationTaskDTO>) {
  const { data: cycleRows, error: cycleError } = await supabaseAdmin.from('evacuation_drill_cycles').select('*').order('fiscal_year', { ascending: false }).order('created_at', { ascending: false })
  fail(cycleError)
  const cycleIds = ((cycleRows ?? []) as Row[]).map(row => str(row.id))
  const { data: sessionRows, error: sessionError } = cycleIds.length
    ? await supabaseAdmin.from('evacuation_drill_sessions').select('*').in('cycle_id', cycleIds).order('started_at', { ascending: false })
    : { data: [], error: null }
  fail(sessionError)
  const sessions = (sessionRows ?? []) as Row[]
  const sessionIds = sessions.map(row => str(row.id))
  const { data: actualEvidenceRows, error: actualEvidenceError } = sessionIds.length
    ? await supabaseAdmin.from('evacuation_drill_evidence').select('session_id,attachment_id,evidence_role').in('session_id', sessionIds)
    : { data: [], error: null }
  fail(actualEvidenceError)
  const evidenceBySessionId = new Map<string, Row[]>()
  for (const row of (actualEvidenceRows ?? []) as Row[]) evidenceBySessionId.set(str(row.session_id), [...(evidenceBySessionId.get(str(row.session_id)) ?? []), row])
  const sessionDTOs = sessions.map(row => sessionDTO(row, evidenceBySessionId.get(str(row.id)) ?? []))
  const sessionsByCycleId = new Map<string, EvacuationDrillSessionDTO[]>()
  for (const session of sessionDTOs) sessionsByCycleId.set(session.cycleId, [...(sessionsByCycleId.get(session.cycleId) ?? []), session])
  return (cycleRows ?? []).map(row => ({
    id: str(row.id), fiscalYear: Number(row.fiscal_year), planVersionId: str(row.plan_version_id), taskInstanceId: str(row.task_instance_id),
    status: str(row.status) as EvacuationDrillCycleDTO['status'], ownerText: str(row.owner_text), dueDate: nullable(row.due_date), notes: nullable(row.notes),
    task: taskByInstanceId.get(str(row.task_instance_id)) ?? null, sessions: sessionsByCycleId.get(str(row.id)) ?? [],
    createdAt: str(row.created_at), updatedAt: str(row.updated_at),
  })) as EvacuationDrillCycleDTO[]
}

export async function getEvacuationDashboard(actorId: string, level: PermLevel): Promise<EvacuationDashboardDTO> {
  const [map, assemblyPoints, planData, taskData] = await Promise.all([
    getStaffLabMapDTO(), listAssemblyPoints(false), listPlanData(), relevantTaskData(actorId, level),
  ])
  const cycles = await listCycleData(taskData.taskByInstanceId)
  const metrics = calculateEvacuationMetrics(cycles.flatMap(cycle => cycle.sessions))
  return { map: { ...map, safetyEquipment: [] }, releases: planData.releases, plans: planData.plans, assemblyPoints, tasks: taskData.tasks, cycles, metrics }
}

export interface PublicEvacuationGuidance {
  versionCode: string
  effectiveDate: string | null
  reportPoint: { id: string; nameTh: string; detailTh: string | null; latitude: number | null; longitude: number | null } | null
  assignments: { scopeCode: string; routeVariant: 'primary' | 'alternate'; exitCode: string; routeCode: string | null; postExitInstructionTh: string | null }[]
}

/**
 * Public projection for the QR map. It deliberately omits reviewers, owners,
 * task ids, headcount responsibility, and all internal room metadata.
 */
export async function getPublishedEvacuationGuidance(): Promise<PublicEvacuationGuidance | null> {
  const { data: plan, error: planError } = await supabaseAdmin.from('evacuation_plan_versions')
    .select('id,version_code,effective_date,report_point_id,map_release_id')
    .eq('status', 'published')
    .not('effective_date', 'is', null)
    .maybeSingle()
  fail(planError)
  if (!plan) return null
  const { data: release, error: releaseError } = await supabaseAdmin.from('lab_map_versions')
    .select('id')
    .eq('id', plan.map_release_id)
    .eq('status', 'published')
    .not('effective_date', 'is', null)
    .maybeSingle()
  fail(releaseError)
  if (!release) return null
  const [{ data: assignmentRows, error: assignmentError }, { data: point, error: pointError }] = await Promise.all([
    supabaseAdmin.from('evacuation_exit_assignments').select('scope_code,route_variant,exit_code,route_code,post_exit_instruction_th').eq('plan_version_id', plan.id).order('scope_code').order('route_variant'),
    plan.report_point_id
      ? supabaseAdmin.from('lab_map_assembly_points').select('id,name_th,detail_th,latitude,longitude').eq('id', plan.report_point_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  fail(assignmentError); fail(pointError)
  return {
    versionCode: str(plan.version_code), effectiveDate: nullable(plan.effective_date),
    reportPoint: point ? { id: str(point.id), nameTh: str(point.name_th), detailTh: nullable(point.detail_th), latitude: numberOrNull(point.latitude), longitude: numberOrNull(point.longitude) } : null,
    assignments: ((assignmentRows ?? []) as Row[]).map(row => ({
      scopeCode: str(row.scope_code), routeVariant: str(row.route_variant) as 'primary' | 'alternate', exitCode: str(row.exit_code), routeCode: nullable(row.route_code), postExitInstructionTh: nullable(row.post_exit_instruction_th),
    })),
  }
}

export interface EvacuationAssignmentInput {
  scopeType: 'station' | 'space' | 'zone'
  scopeCode: string
  exitCode: string
  routeVariant: 'primary' | 'alternate'
  routeCode?: string | null
  assemblyPointId: string
  postExitInstructionTh?: string | null
  responsibleText?: string | null
}

export interface EvacuationTaskReferenceInput {
  instanceId?: string | null
  scheduleId?: string | null
  periodStart?: string | null
}

async function ensureTaskInstance(reference: EvacuationTaskReferenceInput, actor: Actor, allowedKeys: Set<string>) {
  let instanceId = reference.instanceId ?? null
  if (!instanceId && reference.scheduleId && reference.periodStart) {
    const materialized = await materializeOccurrence({ mode: 'scheduled', scheduleId: reference.scheduleId, periodStart: reference.periodStart }, actor, 'edit', 'safety')
    instanceId = str(materialized?.id)
  }
  if (!instanceId) throw new Error('กรุณาเลือกงานความปลอดภัยที่ต้องเชื่อมก่อนบันทึก')
  const { data, error } = await supabaseAdmin.from('quality_task_instances').select('id,quality_task_templates!inner(source_key,workstream)').eq('id', instanceId).eq('quality_task_templates.workstream', 'safety').single()
  fail(error)
  const template = data?.quality_task_templates as Row | undefined
  if (!template || !allowedKeys.has(str(template.source_key))) throw new Error('งานที่เลือกไม่ใช่งานความปลอดภัยสำหรับโมดูลนี้')
  return instanceId
}

async function linkTask(input: { instanceId: string; integrationKind: EvacuationTaskLinkDTO['integrationKind']; sourceType: string; sourceId: string; actorId: string; metadata?: Row }) {
  const { data: existing, error: existingError } = await supabaseAdmin.from('quality_task_links').select('*').eq('integration_kind', input.integrationKind).eq('source_type', input.sourceType).eq('source_id', input.sourceId).maybeSingle()
  fail(existingError)
  if (existing) {
    if (str(existing.instance_id) !== input.instanceId) {
      const { data: replacementLinks, error: replacementError } = await supabaseAdmin.from('quality_task_links').select('id').eq('instance_id', input.instanceId).neq('id', existing.id)
      fail(replacementError)
      if ((replacementLinks ?? []).length) throw new Error('งานนี้ถูกเชื่อมกับรายการความปลอดภัยแล้ว กรุณาเลือก occurrence อื่น')
      const { error: relinkError } = await supabaseAdmin.from('quality_task_links').update({ instance_id: input.instanceId, sync_status: 'pending', updated_at: new Date().toISOString() }).eq('id', existing.id)
      fail(relinkError)
    }
    return existing as Row
  }
  const { data: instanceLinks, error: instanceLinkError } = await supabaseAdmin.from('quality_task_links').select('id,integration_kind,source_type,source_id').eq('instance_id', input.instanceId)
  fail(instanceLinkError)
  if ((instanceLinks ?? []).length) throw new Error('งานนี้ถูกเชื่อมกับรายการความปลอดภัยแล้ว กรุณาเลือก occurrence อื่น')
  const { data, error } = await supabaseAdmin.from('quality_task_links').insert({
    instance_id: input.instanceId, integration_kind: input.integrationKind, source_type: input.sourceType,
    source_id: input.sourceId, sync_status: 'pending', created_by: input.actorId, metadata: input.metadata ?? {},
  }).select('*').single()
  if (error?.code === '23505') {
    const { data: raced, error: racedError } = await supabaseAdmin.from('quality_task_links').select('*').eq('integration_kind', input.integrationKind).eq('source_type', input.sourceType).eq('source_id', input.sourceId).single()
    fail(racedError)
    return raced as Row
  }
  fail(error)
  return data as Row
}

async function evacuationEvidenceComplete(taskInstanceId: string) {
  const { data: instance, error: instanceError } = await supabaseAdmin
    .from('quality_task_instances')
    .select('template_id')
    .eq('id', taskInstanceId)
    .single()
  fail(instanceError)
  if (!instance?.template_id) throw new Error('งานซ้อมไม่มีต้นแบบงานสำหรับตรวจข้อกำหนดหลักฐาน')

  const [{ data: requirements, error: requirementError }, { data: attachments, error: attachmentError }] = await Promise.all([
    supabaseAdmin.from('quality_task_evidence_requirements')
      .select('id,evidence_kind,label,required,minimum_files')
      .eq('template_id', instance.template_id)
      .eq('active', true)
      .order('sort_order'),
    supabaseAdmin.from('quality_task_attachments')
      .select('requirement_id')
      .eq('instance_id', taskInstanceId),
  ])
  fail(requirementError); fail(attachmentError)
  const activeRequirements = (requirements ?? []) as Row[]
  if (!activeRequirements.length) return false
  return missingEvacuationEvidence(
    activeRequirements.map(requirement => ({
      id: str(requirement.id), evidenceKind: str(requirement.evidence_kind), label: str(requirement.label),
      required: Boolean(requirement.required), minimumFiles: Number(requirement.minimum_files ?? 1),
    })),
    ((attachments ?? []) as Row[]).map(attachment => ({ requirementId: nullable(attachment.requirement_id) })),
  ).length === 0
}

export interface CreateEvacuationPlanInput {
  planCode: string
  versionCode: string
  mapReleaseId: string
  effectiveDate: string | null
  reviewDueDate: string | null
  reportPointId: string | null
  headcountResponsible: string | null
  notes: string | null
  reviewTask: EvacuationTaskReferenceInput
  assignments: EvacuationAssignmentInput[]
}

async function loadPlanForMutation(id: string) {
  const [{ data: plan, error: planError }, { data: assignments, error: assignmentError }] = await Promise.all([
    supabaseAdmin.from('evacuation_plan_versions').select('*').eq('id', id).single(),
    supabaseAdmin.from('evacuation_exit_assignments').select('*').eq('plan_version_id', id).order('scope_code'),
  ])
  fail(planError); fail(assignmentError)
  return { plan: plan as Row, assignments: (assignments ?? []) as Row[] }
}

async function replaceAssignments(planId: string, assignments: EvacuationAssignmentInput[]) {
  const { error: deleteError } = await supabaseAdmin.from('evacuation_exit_assignments').delete().eq('plan_version_id', planId)
  fail(deleteError)
  if (!assignments.length) return
  const { error } = await supabaseAdmin.from('evacuation_exit_assignments').insert(assignments.map(item => ({
    plan_version_id: planId, scope_type: item.scopeType, scope_code: item.scopeCode.trim(), exit_code: item.exitCode,
    route_variant: item.routeVariant, route_code: item.routeCode?.trim() || null, assembly_point_id: item.assemblyPointId,
    post_exit_instruction_th: item.postExitInstructionTh?.trim() || null, responsible_text: item.responsibleText?.trim() || null,
  })))
  fail(error)
}

export async function createEvacuationPlan(input: CreateEvacuationPlanInput, actor: Actor) {
  const reviewTaskInstanceId = await ensureTaskInstance(input.reviewTask, actor, PLAN_TASK_KEYS)
  const { data: release, error: releaseError } = await supabaseAdmin.from('lab_map_versions').select('id,status').eq('id', input.mapReleaseId).single()
  fail(releaseError)
  if (!release || str(release.status) !== 'published') throw new Error('ต้องเลือก map release ที่เผยแพร่แล้ว')
  const { data: plan, error: planError } = await supabaseAdmin.from('evacuation_plan_versions').insert({
    plan_code: input.planCode.trim(), version_code: input.versionCode.trim(), status: 'draft', map_release_id: input.mapReleaseId,
    effective_date: input.effectiveDate, review_due_date: input.reviewDueDate, report_point_id: input.reportPointId,
    headcount_responsible: input.headcountResponsible?.trim() || null, notes: input.notes?.trim() || null, created_by: actor.id,
  }).select('*').single()
  fail(planError)
  try {
    await replaceAssignments(str(plan.id), input.assignments)
    await linkTask({ instanceId: reviewTaskInstanceId, integrationKind: 'evacuation_plan_review', sourceType: 'evacuation_plan_version', sourceId: str(plan.id), actorId: actor.id, metadata: { planCode: input.planCode, versionCode: input.versionCode } })
  } catch (error) {
    await supabaseAdmin.from('evacuation_plan_versions').delete().eq('id', plan.id)
    throw error
  }
  await auditSafety('lab_map.evacuation.plan.create', actor.id, str(plan.id), { versionCode: input.versionCode })
  const { plan: saved, assignments } = await loadPlanForMutation(str(plan.id))
  const { data: releaseRow } = await supabaseAdmin.from('lab_map_versions').select('id,version_code,status,effective_date').eq('id', saved.map_release_id).maybeSingle()
  const { data: linkRow } = await supabaseAdmin.from('quality_task_links').select('*').eq('source_type', 'evacuation_plan_version').eq('source_id', saved.id).maybeSingle()
  return planDTO(saved, assignments, new Map(releaseRow ? [[str(releaseRow.id), releaseRow as Row]] : []), new Map(linkRow ? [[str(linkRow.source_id), linkRow as Row]] : []))
}

export async function updateEvacuationPlan(id: string, input: Omit<CreateEvacuationPlanInput, 'reviewTask'> & { reviewTask?: EvacuationTaskReferenceInput; updatedAt: string }, actor: Actor) {
  const { plan: current } = await loadPlanForMutation(id)
  if (str(current.status) === 'published') throw new Error('แผนที่เผยแพร่แล้วแก้ทับไม่ได้ ให้สร้าง version ใหม่')
  if (str(current.updated_at) !== input.updatedAt) throw new Error('ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดใหม่')
  const reviewTaskInstanceId = input.reviewTask ? await ensureTaskInstance(input.reviewTask, actor, PLAN_TASK_KEYS) : null
  const { data: plan, error } = await supabaseAdmin.from('evacuation_plan_versions').update({
    plan_code: input.planCode.trim(), version_code: input.versionCode.trim(), map_release_id: input.mapReleaseId,
    effective_date: input.effectiveDate, review_due_date: input.reviewDueDate, report_point_id: input.reportPointId,
    headcount_responsible: input.headcountResponsible?.trim() || null, notes: input.notes?.trim() || null, updated_at: new Date().toISOString(),
  }).eq('id', id).eq('updated_at', input.updatedAt).select('*').maybeSingle()
  fail(error)
  if (!plan) throw new Error('ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณาโหลดใหม่')
  await replaceAssignments(id, input.assignments)
  if (reviewTaskInstanceId) {
    await linkTask({ instanceId: reviewTaskInstanceId, integrationKind: 'evacuation_plan_review', sourceType: 'evacuation_plan_version', sourceId: id, actorId: actor.id })
  }
  await auditSafety('lab_map.evacuation.plan.update', actor.id, id, { versionCode: input.versionCode })
  const { plan: saved, assignments } = await loadPlanForMutation(id)
  const { data: releaseRow } = await supabaseAdmin.from('lab_map_versions').select('id,version_code,status,effective_date').eq('id', saved.map_release_id).maybeSingle()
  const { data: linkRow } = await supabaseAdmin.from('quality_task_links').select('*').eq('source_type', 'evacuation_plan_version').eq('source_id', id).maybeSingle()
  return planDTO(saved, assignments, new Map(releaseRow ? [[str(releaseRow.id), releaseRow as Row]] : []), new Map(linkRow ? [[str(linkRow.source_id), linkRow as Row]] : []))
}

export async function transitionEvacuationPlan(id: string, action: 'submit' | 'approve' | 'publish' | 'retire', actor: Actor) {
  const { plan, assignments } = await loadPlanForMutation(id)
  const currentStatus = str(plan.status)
  if (action === 'submit') {
    if (currentStatus !== 'draft') throw new Error('แผนนี้ไม่อยู่ในสถานะรอส่งทบทวน')
    const { error } = await supabaseAdmin.from('evacuation_plan_versions').update({ status: 'in_review', reviewed_by: actor.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'draft')
    fail(error)
  } else if (action === 'approve') {
    if (currentStatus !== 'in_review') throw new Error('แผนต้องอยู่ในสถานะรอทบทวนก่อนอนุมัติ')
    if (str(plan.reviewed_by) === actor.id) throw new Error('ผู้ทบทวนและผู้อนุมัติต้องเป็นคนละคน')
    const { error } = await supabaseAdmin.from('evacuation_plan_versions').update({ status: 'approved', approved_by: actor.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'in_review')
    fail(error)
  } else if (action === 'publish') {
    if (currentStatus !== 'approved') throw new Error('แผนต้องได้รับอนุมัติก่อนเผยแพร่')
    if (!plan.effective_date || !plan.reviewed_by || !plan.approved_by || str(plan.reviewed_by) === str(plan.approved_by)) throw new Error('ข้อมูลผู้ทบทวน ผู้อนุมัติ และวันมีผลไม่ครบ หรือใช้คนเดียวกัน')
    const [{ data: release, error: releaseError }, { data: points, error: pointError }, { data: exits, error: exitError }] = await Promise.all([
      supabaseAdmin.from('lab_map_versions').select('id,status').eq('id', plan.map_release_id).single(),
      supabaseAdmin.from('lab_map_assembly_points').select('id,latitude,longitude,position_status,point_type').eq('lifecycle_status', 'active'),
      supabaseAdmin.from('lab_map_access_points').select('code,status').eq('kind', 'exit'),
    ])
    fail(releaseError); fail(pointError); fail(exitError)
    if (!release || str(release.status) !== 'published') throw new Error('map release ของแผนยังไม่เผยแพร่')
    const validation = validateEvacuationPlanForPublish({
      plan: { reportPointId: nullable(plan.report_point_id), headcountResponsible: nullable(plan.headcount_responsible), assignments: assignments.map(item => ({ scopeCode: str(item.scope_code), routeVariant: str(item.route_variant) as 'primary' | 'alternate', routeCode: nullable(item.route_code), exitCode: str(item.exit_code), assemblyPointId: str(item.assembly_point_id) })) },
      assemblyPoints: (points ?? []).map(row => ({
        id: str(row.id), latitude: numberOrNull(row.latitude), longitude: numberOrNull(row.longitude), positionStatus: str(row.position_status) as 'unverified' | 'verified',
      })),
      exits: (exits ?? []).map(row => ({ code: str(row.code), status: str(row.status) as 'open' | 'fingerprint_controlled' | 'permanently_locked' })),
      availableRouteCodes: LAB_ROUTE_PRESETS.filter(route => route.kind === 'evacuation').map(route => route.code),
      availableRoutes: LAB_ROUTE_PRESETS.filter(route => route.kind === 'evacuation').map(route => ({ code: route.code, fromStationCode: route.fromStationCode, variant: route.variant, destinationCode: route.destinationCode })),
    })
    if (!validation.ok) throw new Error(`เผยแพร่ไม่ได้: ${validation.errors.join(' · ')}`)
    const { error: publishError } = await supabaseAdmin.rpc('publish_evacuation_plan', { target_plan_id: id })
    fail(publishError)
  } else {
    if (currentStatus !== 'published' && currentStatus !== 'approved') throw new Error('แผนนี้ยังไม่สามารถเลิกใช้ได้')
    fail((await supabaseAdmin.from('evacuation_plan_versions').update({ status: 'retired', updated_at: new Date().toISOString() }).eq('id', id)).error)
  }
  await auditSafety(`lab_map.evacuation.plan.${action}`, actor.id, id)
  const { plan: saved, assignments: savedAssignments } = await loadPlanForMutation(id)
  const { data: releaseRow } = await supabaseAdmin.from('lab_map_versions').select('id,version_code,status,effective_date').eq('id', saved.map_release_id).maybeSingle()
  const { data: linkRow } = await supabaseAdmin.from('quality_task_links').select('*').eq('source_type', 'evacuation_plan_version').eq('source_id', id).maybeSingle()
  return planDTO(saved, savedAssignments, new Map(releaseRow ? [[str(releaseRow.id), releaseRow as Row]] : []), new Map(linkRow ? [[str(linkRow.source_id), linkRow as Row]] : []))
}

export interface CreateDrillCycleInput {
  fiscalYear: number
  planVersionId: string
  ownerText: string
  dueDate: string | null
  notes: string | null
  task: EvacuationTaskReferenceInput
}

export async function createDrillCycle(input: CreateDrillCycleInput, actor: Actor) {
  const taskInstanceId = await ensureTaskInstance(input.task, actor, DRILL_TASK_KEYS)
  const { data: plan, error: planError } = await supabaseAdmin.from('evacuation_plan_versions').select('id,status').eq('id', input.planVersionId).single()
  fail(planError)
  if (!plan || !['approved', 'published'].includes(str(plan.status))) throw new Error('ต้องเลือกแผนที่ได้รับอนุมัติแล้ว')
  const { data: cycle, error } = await supabaseAdmin.from('evacuation_drill_cycles').insert({ fiscal_year: input.fiscalYear, plan_version_id: input.planVersionId, task_instance_id: taskInstanceId, owner_text: input.ownerText.trim(), due_date: input.dueDate, notes: input.notes?.trim() || null, created_by: actor.id }).select('*').single()
  fail(error)
  await linkTask({ instanceId: taskInstanceId, integrationKind: 'evacuation_drill', sourceType: 'evacuation_drill_cycle', sourceId: str(cycle.id), actorId: actor.id, metadata: { fiscalYear: input.fiscalYear, planVersionId: input.planVersionId } })
  await auditSafety('lab_map.evacuation.drill_cycle.create', actor.id, str(cycle.id), { fiscalYear: input.fiscalYear })
  return cycle as Row
}

export interface CreateDrillSessionInput {
  cycleId: string
  scenario: string
  startedAt: string | null
  endedAt: string | null
  offHours: boolean
  scopeCodes: string[]
  routeCodes: string[]
  expectedParticipants: number
  actualParticipants: number
  expectedHeadcount: number
  checkedHeadcount: number
  missingHeadcount: number
  injuredCount: number
  reportPointId: string | null
  observerText: string | null
  evaluation: string | null
  compliancePercent: number | null
  deviationText: string | null
  status: 'planned' | 'completed'
}

export async function createDrillSession(input: CreateDrillSessionInput, actor: Actor) {
  const { data: cycle, error: cycleError } = await supabaseAdmin.from('evacuation_drill_cycles').select('id,task_instance_id').eq('id', input.cycleId).single()
  fail(cycleError)
  if (!cycle) throw new Error('ไม่พบรอบซ้อม')
  const validationErrors = validateEvacuationDrillSession(input)
  if (validationErrors.length) throw new Error(validationErrors.join(' · '))
  const { data, error } = await supabaseAdmin.from('evacuation_drill_sessions').insert({
    cycle_id: input.cycleId, scenario: input.scenario.trim(), started_at: input.startedAt, ended_at: input.endedAt,
    off_hours: input.offHours, scope_codes: input.scopeCodes, route_codes: input.routeCodes,
    expected_participants: input.expectedParticipants, actual_participants: input.actualParticipants,
    expected_headcount: input.expectedHeadcount, checked_headcount: input.checkedHeadcount,
    missing_headcount: input.missingHeadcount, injured_count: input.injuredCount, report_point_id: input.reportPointId,
    observer_text: input.observerText?.trim() || null, evaluation: input.evaluation?.trim() || null,
    compliance_percent: input.compliancePercent, deviation_text: input.deviationText?.trim() || null,
    status: input.status, created_by: actor.id,
  }).select('*').single()
  fail(error)
  const { error: cycleUpdateError } = await supabaseAdmin.from('evacuation_drill_cycles').update({ status: input.status === 'completed' ? 'awaiting_evidence' : 'in_progress', updated_at: new Date().toISOString() }).eq('id', input.cycleId)
  fail(cycleUpdateError)
  await auditSafety('lab_map.evacuation.drill_session.create', actor.id, str(data.id), { cycleId: input.cycleId, taskInstanceId: cycle.task_instance_id })
  return sessionDTO(data as Row, [])
}

export async function updateDrillSession(id: string, input: Partial<CreateDrillSessionInput> & { updatedAt: string; evidence?: { attachmentId: string; evidenceRole: 'plan' | 'attendance' | 'evaluation' | 'photo' | 'incident' }[] }, actor: Actor) {
  const { data: current, error: currentError } = await supabaseAdmin.from('evacuation_drill_sessions').select('*, evacuation_drill_cycles!inner(task_instance_id)').eq('id', id).single()
  fail(currentError)
  if (str(current.updated_at) !== input.updatedAt) throw new Error('ข้อมูลการซ้อมถูกแก้ไขโดยผู้อื่น กรุณาโหลดใหม่')
  const payload: Row = { updated_at: new Date().toISOString() }
  const fieldMap: Record<string, string> = {
    scenario: 'scenario', startedAt: 'started_at', endedAt: 'ended_at', offHours: 'off_hours', scopeCodes: 'scope_codes', routeCodes: 'route_codes',
    expectedParticipants: 'expected_participants', actualParticipants: 'actual_participants', expectedHeadcount: 'expected_headcount', checkedHeadcount: 'checked_headcount',
    missingHeadcount: 'missing_headcount', injuredCount: 'injured_count', reportPointId: 'report_point_id', observerText: 'observer_text', evaluation: 'evaluation', compliancePercent: 'compliance_percent', deviationText: 'deviation_text', status: 'status',
  }
  for (const [key, column] of Object.entries(fieldMap)) if (key in input) payload[column] = input[key as keyof CreateDrillSessionInput] ?? null
  if (typeof payload.scenario === 'string') payload.scenario = payload.scenario.trim()
  const expectedHeadcount = Number(payload.expected_headcount ?? current.expected_headcount ?? 0)
  const checkedHeadcount = Number(payload.checked_headcount ?? current.checked_headcount ?? 0)
  const missingHeadcount = Number(payload.missing_headcount ?? current.missing_headcount ?? 0)
  const validationErrors = validateEvacuationDrillSession({
    status: str(payload.status ?? current.status),
    startedAt: nullable(payload.started_at ?? current.started_at),
    endedAt: nullable(payload.ended_at ?? current.ended_at),
    reportPointId: nullable(payload.report_point_id ?? current.report_point_id),
    evaluation: nullable(payload.evaluation ?? current.evaluation),
    expectedParticipants: Number(payload.expected_participants ?? current.expected_participants ?? 0),
    actualParticipants: Number(payload.actual_participants ?? current.actual_participants ?? 0),
    expectedHeadcount, checkedHeadcount, missingHeadcount,
  })
  if (validationErrors.length) throw new Error(validationErrors.join(' · '))
  const { data, error } = await supabaseAdmin.from('evacuation_drill_sessions').update(payload).eq('id', id).eq('updated_at', input.updatedAt).select('*').maybeSingle()
  fail(error)
  if (!data) throw new Error('ข้อมูลการซ้อมถูกแก้ไขโดยผู้อื่น กรุณาโหลดใหม่')
  if (input.evidence) {
    const attachmentIds = input.evidence.map(item => item.attachmentId)
    if (attachmentIds.length) {
      const { data: attachments, error: attachmentError } = await supabaseAdmin.from('quality_task_attachments').select('id').eq('instance_id', current.evacuation_drill_cycles.task_instance_id).in('id', attachmentIds)
      fail(attachmentError)
      if ((attachments ?? []).length !== attachmentIds.length) throw new Error('หลักฐานบางไฟล์ไม่ได้อยู่ในงานซ้อมที่เชื่อมไว้')
    }
    fail((await supabaseAdmin.from('evacuation_drill_evidence').delete().eq('session_id', id)).error)
    if (input.evidence.length) fail((await supabaseAdmin.from('evacuation_drill_evidence').insert(input.evidence.map(item => ({ session_id: id, attachment_id: item.attachmentId, evidence_role: item.evidenceRole })))).error)
  }
  const { data: evidence, error: evidenceError } = await supabaseAdmin.from('evacuation_drill_evidence').select('session_id,attachment_id,evidence_role').eq('session_id', id)
  fail(evidenceError)
  const nextCycleStatus = str(data.status) === 'completed'
    ? (await evacuationEvidenceComplete(str(current.evacuation_drill_cycles.task_instance_id)) ? 'pending_review' : 'awaiting_evidence')
    : 'in_progress'
  fail((await supabaseAdmin.from('evacuation_drill_cycles').update({ status: nextCycleStatus, updated_at: new Date().toISOString() }).eq('id', current.cycle_id)).error)
  await auditSafety('lab_map.evacuation.drill_session.update', actor.id, id)
  return sessionDTO(data as Row, (evidence ?? []) as Row[])
}
