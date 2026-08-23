export type DepartmentPublicationAction = 'publish' | 'update' | 'unpublish'
export type DepartmentPublicationStatus = 'draft' | 'published'
export type PublicationState = 'active' | 'ready' | 'stale' | 'unlinked'

export interface DepartmentPublicationActivity {
  id: string
  linkedAt: string | null
  versionUpdatedAt: string | null
}

export interface DepartmentPublicationSummaryInput {
  status: DepartmentPublicationStatus
  publishedAt: string | null
  lastPublishedAt: string | null
  activePublications: DepartmentPublicationActivity[]
}

export interface DepartmentPublicationSummary {
  action: DepartmentPublicationAction
  buttonLabel: string
  helperText: string | null
  pendingCount: number
}

function isAfter(value: string | null, baseline: string): boolean {
  const valueTime = Date.parse(value ?? '')
  const baselineTime = Date.parse(baseline)
  return Number.isFinite(valueTime) && Number.isFinite(baselineTime) && valueTime > baselineTime
}

export function summarizeDepartmentPublication(
  input: DepartmentPublicationSummaryInput,
): DepartmentPublicationSummary {
  const baseline = input.lastPublishedAt ?? input.publishedAt
  const seenPublicationIds = new Set<string>()
  let pendingCount = 0

  if (baseline) {
    for (const publication of input.activePublications) {
      if (seenPublicationIds.has(publication.id)) continue
      seenPublicationIds.add(publication.id)
      if (isAfter(publication.linkedAt, baseline) || isAfter(publication.versionUpdatedAt, baseline)) {
        pendingCount += 1
      }
    }
  }

  if (baseline && pendingCount > 0) {
    const count = pendingCount.toLocaleString('th-TH')
    return {
      action: 'update',
      buttonLabel: `อัปเดตการเผยแพร่ (${count} รายการ)`,
      helperText: `มีการเปลี่ยนแปลงรอเผยแพร่ ${count} รายการ`,
      pendingCount,
    }
  }

  if (input.status === 'published') {
    return {
      action: 'unpublish',
      buttonLabel: 'ยกเลิกเผยแพร่ทั้งงาน',
      helperText: null,
      pendingCount,
    }
  }

  return {
    action: 'publish',
    buttonLabel: 'เผยแพร่ทั้งงาน',
    helperText: null,
    pendingCount,
  }
}

export function roomPublicationLabel(status: PublicationState): string {
  switch (status) {
    case 'active':
      return 'เผยแพร่แล้ว · อัปเดตอัตโนมัติ'
    case 'ready':
      return 'พร้อมเผยแพร่อัตโนมัติ'
    case 'stale':
      return 'มีฉบับใหม่ · อัปเดตอัตโนมัติ'
    case 'unlinked':
      return 'ยังไม่มีการเผยแพร่ · ต้องแนบ SDS'
  }
}
