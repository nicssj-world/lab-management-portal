export type DocStatus = 'Draft' | 'Review' | 'Approved' | 'Published' | 'Obsolete'
type WorkflowRole = 'Laboratory Director' | 'Quality Manager' | 'Document Controller' | 'Reviewer' | 'Viewer'

const WORKFLOW_ROLES: WorkflowRole[] = ['Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer', 'Viewer']

export const FULL_TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  Draft:     ['Review'],
  Review:    ['Approved', 'Draft'],
  Approved:  ['Published', 'Review'],
  Published: ['Obsolete'],
  Obsolete:  [],
}

const QM_TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  Draft:     ['Review'],
  Review:    ['Approved', 'Draft'],
  Approved:  ['Review'],
  Published: [],
  Obsolete:  [],
}

const REVIEWER_TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  Draft:     ['Review'],
  Review:    ['Draft'],
  Approved:  ['Draft', 'Review'],
  Published: [],
  Obsolete:  [],
}

export function allowedTransitions(current: DocStatus, role: string, docRole?: string): DocStatus[] {
  if (role === 'Admin') return FULL_TRANSITIONS[current] ?? []
  const workflowRole = docRole ?? (WORKFLOW_ROLES.includes(role as WorkflowRole) ? role : undefined)
  switch (workflowRole) {
    case 'Laboratory Director':
    case 'Document Controller':
      return FULL_TRANSITIONS[current] ?? []
    case 'Quality Manager':
      return QM_TRANSITIONS[current] ?? []
    case 'Reviewer':
      return REVIEWER_TRANSITIONS[current] ?? []
    default:
      return []
  }
}

const ALL_STATUSES: DocStatus[] = ['Draft', 'Review', 'Approved', 'Published', 'Obsolete']

/** สถานะที่เลือกได้ใน Upload/Edit modal */
export function availableEditStatuses(
  role: string,
  docRole: string | undefined,
  currentStatus?: DocStatus,
): DocStatus[] {
  const workflowRole = docRole ?? (WORKFLOW_ROLES.includes(role as WorkflowRole) ? role : undefined)

  // Admin / Lab Director / Doc Controller — เห็นทุกสถานะเสมอ
  if (role === 'Admin' || workflowRole === 'Laboratory Director' || workflowRole === 'Document Controller') {
    return ALL_STATUSES
  }

  // Quality Manager — Draft, Review, Approved (ไม่มี Published/Obsolete)
  if (workflowRole === 'Quality Manager') {
    return ['Draft', 'Review', 'Approved']
  }

  // Reviewer — จำกัดให้เลือกได้เฉพาะ Draft / Review
  if (workflowRole === 'Reviewer') {
    return ['Draft', 'Review']
  }

  // Viewer / null — Draft เท่านั้น (ถ้าผ่านมาได้ถึง modal นี้)
  return ['Draft']
}
