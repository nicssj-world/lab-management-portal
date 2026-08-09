import type { ApprovalMode, QualityTaskOccurrence, TaskIntervalUnit } from './types'

const DAY_MS = 86_400_000
export const SAFETY_EVIDENCE_MAX_BYTES = 20 * 1024 * 1024
export const SAFETY_MEETING_QUALITY_SOURCE_KEY = 'CBH-QT-42'
export const RETIRED_SAFETY_MEETING_SOURCE_KEY = 'CBH-ST-05'

const EVIDENCE_TYPES = new Map<string, string[]>([
  ['.pdf', ['application/pdf']],
  ['.jpg', ['image/jpeg']],
  ['.jpeg', ['image/jpeg']],
  ['.png', ['image/png']],
  ['.xls', ['application/vnd.ms-excel']],
  ['.xlsx', ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']],
])

function parseIso(value: string) {
  return new Date(`${value}T00:00:00Z`)
}

function iso(value: Date) {
  return value.toISOString().slice(0, 10)
}

export function fiscalYearForDate(value: string) {
  const [year, month] = value.split('-').map(Number)
  return year + 543 + (month >= 10 ? 1 : 0)
}

export function nextRollingDueDate(completedOn: string, unit: TaskIntervalUnit, count: number) {
  const next = parseIso(completedOn)
  if (unit === 'day') next.setUTCDate(next.getUTCDate() + count)
  if (unit === 'week') next.setUTCDate(next.getUTCDate() + count * 7)
  if (unit === 'month' || unit === 'year') {
    const originalDay = next.getUTCDate()
    const targetMonth = next.getUTCMonth() + (unit === 'month' ? count : count * 12)
    next.setUTCDate(1)
    next.setUTCMonth(targetMonth)
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()
    next.setUTCDate(Math.min(originalDay, lastDay))
  }
  return iso(next)
}

export function submissionStatus(approvalMode: ApprovalMode) {
  return approvalMode === 'required' ? 'pending_review' as const : 'completed' as const
}

export function canApproveTask(level: 'none' | 'view' | 'edit', actorId: string, approverId: string | null) {
  return level === 'edit' || (level === 'view' && approverId === actorId)
}

export function templateRemovalMode(instanceCount: number) {
  return instanceCount > 0 ? 'archive' as const : 'delete' as const
}

export function isLinkedQualityOccurrence(item: QualityTaskOccurrence) {
  return item.template.workstream === 'quality' && item.template.sourceKey === SAFETY_MEETING_QUALITY_SOURCE_KEY
}

export function mergeSafetyCalendarOccurrences(
  safetyOccurrences: readonly QualityTaskOccurrence[],
  qualityOccurrences: readonly QualityTaskOccurrence[],
) {
  const items = [
    ...safetyOccurrences.filter(item => item.template.sourceKey !== RETIRED_SAFETY_MEETING_SOURCE_KEY),
    ...qualityOccurrences.filter(isLinkedQualityOccurrence),
  ]
  return [...new Map(items.map(item => [item.key, item])).values()]
    .sort((a, b) => a.effectiveDueDate.localeCompare(b.effectiveDueDate) || a.template.title.localeCompare(b.template.title, 'th'))
}

export function linkedQualityTaskHref(item: QualityTaskOccurrence) {
  const params = new URLSearchParams({ month: item.effectiveDueDate.slice(0, 7), task: item.key })
  return `/staff/quality-tasks?${params.toString()}`
}

export function missingEvidenceRequirements(
  requirements: readonly { id: string; required: boolean; minimumFiles: number }[],
  attachments: readonly { requirementId: string | null }[],
) {
  const counts = new Map<string, number>()
  for (const attachment of attachments) {
    if (!attachment.requirementId) continue
    counts.set(attachment.requirementId, (counts.get(attachment.requirementId) ?? 0) + 1)
  }
  return requirements
    .filter(requirement => requirement.required && (counts.get(requirement.id) ?? 0) < requirement.minimumFiles)
    .map(requirement => requirement.id)
}

export function certificateRenewalWindow(
  certificate: { expiresOn: string | null; noExpiry: boolean },
  today: string,
) {
  if (certificate.noExpiry || !certificate.expiresOn) {
    return { shouldCreate: false, daysRemaining: null, urgency: 'none' as const, reminderStage: null }
  }
  const daysRemaining = Math.round((parseIso(certificate.expiresOn).getTime() - parseIso(today).getTime()) / DAY_MS)
  return {
    shouldCreate: daysRemaining <= 90,
    daysRemaining,
    urgency: daysRemaining < 0 ? 'overdue' as const : daysRemaining <= 60 ? 'due-soon' as const : 'normal' as const,
    reminderStage: daysRemaining < 0 ? 'overdue' as const : daysRemaining <= 30 ? 30 as const : daysRemaining <= 60 ? 60 as const : daysRemaining <= 90 ? 90 as const : null,
  }
}

export function validateSafetyEvidenceMetadata(fileName: string, contentType: string, sizeBytes: number) {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 1 || sizeBytes > SAFETY_EVIDENCE_MAX_BYTES) {
    return { ok: false as const, error: 'ไฟล์ต้องมีขนาดไม่เกิน 20 MB' }
  }
  const lower = fileName.toLowerCase()
  const extension = [...EVIDENCE_TYPES.keys()].find(item => lower.endsWith(item))
  if (!extension || !EVIDENCE_TYPES.get(extension)?.includes(contentType)) {
    return { ok: false as const, error: 'รองรับเฉพาะ PDF, JPG, PNG, XLS และ XLSX' }
  }
  return { ok: true as const }
}
