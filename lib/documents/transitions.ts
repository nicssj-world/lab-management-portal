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
  Approved:  [],
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

