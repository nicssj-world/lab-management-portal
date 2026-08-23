import type { AccessPointStatus, LabPointType, RouteVariant } from './types'
import type { QualityTaskAttachment, QualityTaskEvidenceRequirement, QualityTaskOccurrence, TaskStatus } from '@/lib/quality-tasks/types'

export type EvacuationPlanStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'retired'
export type EvacuationDrillCycleStatus = 'planned' | 'in_progress' | 'awaiting_evidence' | 'pending_review' | 'completed' | 'cancelled'
export type EvacuationDrillSessionStatus = 'planned' | 'completed' | 'cancelled'

export interface EvacuationReleaseDTO {
  id: string
  versionCode: string
  status: 'draft' | 'published' | 'retired'
  effectiveDate: string | null
}

export interface EvacuationExitAssignmentDTO {
  id: string
  planVersionId: string
  scopeType: 'station' | 'space' | 'zone'
  scopeCode: string
  exitCode: string
  routeVariant: RouteVariant
  routeCode: string | null
  assemblyPointId: string
  postExitInstructionTh: string | null
  responsibleText: string | null
}

export interface EvacuationTaskLinkDTO {
  id: string
  integrationKind: 'evacuation_plan_review' | 'evacuation_drill'
  sourceType: string
  sourceId: string
  syncStatus: 'pending' | 'synced' | 'failed'
}

export interface EvacuationTaskRequirementDTO extends QualityTaskEvidenceRequirement {
  attachedCount: number
}

export interface EvacuationTaskDTO {
  key: string
  instanceId: string | null
  sourceKey: string | null
  title: string
  referenceCode: string | null
  description: string | null
  frequencyText: string
  ownerText: string
  approvalMode: 'none' | 'required'
  status: TaskStatus
  dueDate: string
  periodLabel: string
  scheduleId: string | null
  periodStart: string
  attachments: QualityTaskAttachment[]
  requirements: EvacuationTaskRequirementDTO[]
  link: EvacuationTaskLinkDTO | null
}

export interface EvacuationPlanDTO {
  id: string
  planCode: string
  versionCode: string
  status: EvacuationPlanStatus
  mapReleaseId: string
  mapReleaseVersion: string | null
  effectiveDate: string | null
  reviewDueDate: string | null
  reportPointId: string | null
  headcountResponsible: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  approvedBy: string | null
  approvedAt: string | null
  notes: string | null
  assignments: EvacuationExitAssignmentDTO[]
  reviewTaskLink: EvacuationTaskLinkDTO | null
  createdAt: string
  updatedAt: string
}

export interface EvacuationDrillSessionDTO {
  id: string
  cycleId: string
  scenario: string
  startedAt: string | null
  endedAt: string | null
  durationSeconds: number | null
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
  headcountComplete: boolean | null
  status: EvacuationDrillSessionStatus
  evidence: { attachmentId: string; evidenceRole: 'plan' | 'attendance' | 'evaluation' | 'photo' | 'incident' }[]
  createdAt: string
  updatedAt: string
}

export interface EvacuationDrillCycleDTO {
  id: string
  fiscalYear: number
  planVersionId: string
  taskInstanceId: string
  status: EvacuationDrillCycleStatus
  ownerText: string
  dueDate: string | null
  notes: string | null
  task: EvacuationTaskDTO | null
  sessions: EvacuationDrillSessionDTO[]
  createdAt: string
  updatedAt: string
}

export interface EvacuationDashboardDTO {
  map: import('./types').LabMapDTO
  releases: EvacuationReleaseDTO[]
  plans: EvacuationPlanDTO[]
  assemblyPoints: import('./types').AssemblyPointDTO[]
  tasks: EvacuationTaskDTO[]
  cycles: EvacuationDrillCycleDTO[]
  metrics: EvacuationMetrics
}

export interface EvacuationTaskLinkRow {
  id: string
  integration_kind: string
  source_type: string
  source_id: string
  sync_status: string
}

export interface EvacuationEvidenceRequirementCheck {
  id: string
  evidenceKind: string
  label: string
  required: boolean
  minimumFiles: number
}

export interface EvacuationEvidenceAttachmentCheck {
  requirementId: string | null
}

export interface MissingEvacuationEvidence {
  id: string
  evidenceKind: string
  label: string
  minimumFiles: number
  attachedCount: number
}

/**
 * Evidence is counted against the requirement id, not merely against a file
 * existing on the task. This keeps the drill closure gate auditable when a
 * task has several evidence categories.
 */
export function missingEvacuationEvidence(
  requirements: readonly EvacuationEvidenceRequirementCheck[],
  attachments: readonly EvacuationEvidenceAttachmentCheck[],
): MissingEvacuationEvidence[] {
  return requirements
    .filter(requirement => requirement.required)
    .map(requirement => ({
      id: requirement.id,
      evidenceKind: requirement.evidenceKind,
      label: requirement.label,
      minimumFiles: requirement.minimumFiles,
      attachedCount: attachments.filter(attachment => attachment.requirementId === requirement.id).length,
    }))
    .filter(requirement => requirement.attachedCount < requirement.minimumFiles)
}

export interface EvacuationDrillValidationInput {
  status: string
  startedAt: string | null
  endedAt: string | null
  reportPointId: string | null
  evaluation: string | null
  expectedParticipants: number
  actualParticipants: number
  expectedHeadcount: number
  checkedHeadcount: number
  missingHeadcount: number
}

export function validateEvacuationDrillSession(input: EvacuationDrillValidationInput): string[] {
  const errors: string[] = []
  if (input.actualParticipants > input.expectedParticipants) {
    errors.push('ผู้เข้าร่วมจริงต้องไม่มากกว่าผู้เข้าร่วมคาดหมาย')
  }
  if (input.checkedHeadcount > input.expectedHeadcount || input.missingHeadcount > input.expectedHeadcount || input.checkedHeadcount + input.missingHeadcount > input.expectedHeadcount) {
    errors.push('จำนวนที่นับได้รวมกับที่ตามไม่พบต้องไม่มากกว่าจำนวนที่ต้องนับ')
  }
  if (input.status === 'completed') {
    if (!input.startedAt || !input.endedAt) errors.push('ผลการซ้อมที่เสร็จสิ้นต้องมีเวลาเริ่มและเวลาสิ้นสุด')
    if (!input.reportPointId) errors.push('ผลการซ้อมที่เสร็จสิ้นต้องมีจุดรายงานตัว')
    if (!input.evaluation?.trim()) errors.push('ผลการซ้อมที่เสร็จสิ้นต้องมีผลประเมิน')
  }
  return errors
}

export function projectEvacuationTask(item: QualityTaskOccurrence, link: EvacuationTaskLinkRow | null): EvacuationTaskDTO {
  const template = item.template
  const attachments = item.attachments ?? []
  return {
    key: item.key,
    instanceId: item.instanceId,
    sourceKey: template.sourceKey,
    title: template.title,
    referenceCode: template.referenceCode,
    description: template.description,
    frequencyText: template.frequencyText,
    ownerText: template.ownerText,
    approvalMode: template.approvalMode,
    status: item.status,
    dueDate: item.effectiveDueDate,
    periodLabel: item.periodLabel,
    scheduleId: item.scheduleId,
    periodStart: item.periodStart,
    attachments,
    requirements: template.evidenceRequirements.map(requirement => ({
      ...requirement,
      attachedCount: attachments.filter(file => file.requirementId === requirement.id).length,
    })),
    link: link ? {
      id: link.id,
      integrationKind: link.integration_kind as EvacuationTaskLinkDTO['integrationKind'],
      sourceType: link.source_type,
      sourceId: link.source_id,
      syncStatus: (link.sync_status || 'pending') as EvacuationTaskLinkDTO['syncStatus'],
    } : null,
  }
}

export interface EvacuationAssemblyPointForValidation {
  id: string
  pointType?: LabPointType
  latitude?: number | null
  longitude?: number | null
  positionStatus?: 'unverified' | 'verified'
  verified?: boolean
}

export interface EvacuationExitForValidation {
  code: string
  status: AccessPointStatus
}

export interface EvacuationAssignmentForValidation {
  scopeCode: string
  routeVariant: RouteVariant
  routeCode?: string | null
  exitCode: string
  assemblyPointId: string
}

export interface EvacuationPlanForValidation {
  reportPointId: string | null
  headcountResponsible: string | null
  assignments: readonly EvacuationAssignmentForValidation[]
}

export interface EvacuationPlanPublishValidationInput {
  plan: EvacuationPlanForValidation
  assemblyPoints: readonly EvacuationAssemblyPointForValidation[]
  exits: readonly EvacuationExitForValidation[]
  availableRouteCodes?: readonly string[]
  availableRoutes?: readonly { code: string; fromStationCode: string; variant: RouteVariant; destinationCode: string }[]
}

export type EvacuationPlanPublishValidation =
  | { ok: true }
  | { ok: false; errors: string[] }

function pointIsVerified(point: EvacuationAssemblyPointForValidation | undefined) {
  return Boolean(
    point &&
    (point.positionStatus === 'verified' || point.verified === true) &&
    point.latitude != null &&
    point.longitude != null,
  )
}

export function validateEvacuationPlanForPublish(input: EvacuationPlanPublishValidationInput): EvacuationPlanPublishValidation {
  const errors: string[] = []
  const { plan, assemblyPoints, exits, availableRouteCodes, availableRoutes } = input
  const pointById = new Map(assemblyPoints.map(point => [point.id, point]))
  const exitByCode = new Map(exits.map(exit => [exit.code, exit]))

  if (!plan.reportPointId) errors.push('ต้องกำหนดจุดรายงานตัว')
  if (!plan.headcountResponsible?.trim()) errors.push('ต้องกำหนดผู้รับผิดชอบการนับคน/รายงานตัว')

  const assignmentByScope = new Map<string, EvacuationAssignmentForValidation[]>()
  for (const assignment of plan.assignments) {
    const list = assignmentByScope.get(assignment.scopeCode) ?? []
    list.push(assignment)
    assignmentByScope.set(assignment.scopeCode, list)
  }

  const incompleteScopes = [...assignmentByScope.entries()]
    .filter(([, assignments]) => {
      const variants = new Set(assignments.map(assignment => assignment.routeVariant))
      return !variants.has('primary') || !variants.has('alternate')
    })
  if (!plan.assignments.length || incompleteScopes.length) {
    errors.push('ต้องมีทางออกหลักและทางออกสำรองสำหรับทุกพื้นที่')
  }

  const missingPointScopes = new Set<string>()
  for (const assignment of plan.assignments) {
    if (!assignment.routeCode?.trim()) errors.push(`ต้องระบุ route preset สำหรับ ${assignment.scopeCode} (${assignment.routeVariant})`)
    else if (availableRouteCodes && !availableRouteCodes.includes(assignment.routeCode)) errors.push(`ไม่พบ route preset ${assignment.routeCode}`)
    else if (availableRoutes) {
      const route = availableRoutes.find(candidate => candidate.code === assignment.routeCode)
      if (!route || route.fromStationCode !== assignment.scopeCode || route.variant !== assignment.routeVariant || route.destinationCode !== assignment.exitCode) {
        errors.push(`route preset ${assignment.routeCode} ไม่ตรงกับพื้นที่/ทางออกที่กำหนด`)
      }
    }
    if (!pointIsVerified(pointById.get(assignment.assemblyPointId))) missingPointScopes.add(assignment.scopeCode)
    const exit = exitByCode.get(assignment.exitCode)
    if (!exit) errors.push(`ไม่พบทางออก ${assignment.exitCode}`)
    else if (exit.status === 'permanently_locked') errors.push(`ทางออก ${assignment.exitCode} ถูกล็อกถาวรและใช้ในแผนอพยพไม่ได้`)
  }
  for (const scopeCode of missingPointScopes) {
    errors.push(`จุดปลายทางต้องยืนยันตำแหน่งและมีพิกัด GPS: ${scopeCode}`)
  }

  if (plan.reportPointId && !pointIsVerified(pointById.get(plan.reportPointId))) {
    errors.push('จุดรายงานตัวต้องยืนยันตำแหน่งและมีพิกัด GPS')
  }

  return errors.length ? { ok: false, errors } : { ok: true }
}

export interface EvacuationMetricSession {
  status: EvacuationDrillSessionStatus | string
  durationSeconds: number | null
  compliancePercent: number | null
  headcountComplete: boolean | null
}

export interface EvacuationMetrics {
  completedRate: number
  averageDurationSeconds: number | null
  complianceRate: number | null
  headcountReadyRate: number | null
}

function roundedPercent(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 100) : 0
}

export function calculateEvacuationMetrics(sessions: readonly EvacuationMetricSession[]): EvacuationMetrics {
  const completed = sessions.filter(session => session.status === 'completed')
  const durations = completed.map(session => session.durationSeconds).filter((value): value is number => value != null && value >= 0)
  const compliance = completed.map(session => session.compliancePercent).filter((value): value is number => value != null && value >= 0)
  const headcount = completed.map(session => session.headcountComplete).filter((value): value is boolean => value != null)
  return {
    completedRate: roundedPercent(completed.length, sessions.length),
    averageDurationSeconds: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
    complianceRate: compliance.length ? Math.round(compliance.reduce((sum, value) => sum + value, 0) / compliance.length) : null,
    headcountReadyRate: headcount.length ? roundedPercent(headcount.filter(Boolean).length, headcount.length) : null,
  }
}
