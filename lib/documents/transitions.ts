export type DocStatus = 'Draft' | 'Review' | 'Approved' | 'Published' | 'Obsolete'
type WorkflowRole = 'Laboratory Director' | 'Quality Manager' | 'Document Controller' | 'Reviewer' | 'Viewer'

const WORKFLOW_ROLES: WorkflowRole[] = ['Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer', 'Viewer']
const MANAGER_ROLE = 'Manager'

export const FULL_TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  Draft:     ['Review'],
  Review:    ['Approved', 'Draft'],
  Approved:  ['Published', 'Review'],
  Published: ['Obsolete'],
  Obsolete:  [],
}

const DCC_TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  Draft:     ['Review'],
  Review:    ['Approved', 'Draft'],
  Approved:  ['Published', 'Review'],
  Published: ['Obsolete'],
  Obsolete:  [],
}

const APPROVER_TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  Draft:     [],
  Review:    ['Approved', 'Draft'],
  Approved:  ['Published', 'Review'],
  Published: ['Obsolete'],
  Obsolete:  [],
}

const MANAGER_TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  Draft:     [],
  Review:    ['Approved'],
  Approved:  [],
  Published: [],
  Obsolete:  [],
}

const NO_TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  Draft:     [],
  Review:    [],
  Approved:  [],
  Published: [],
  Obsolete:  [],
}

// For non-cover document types (Form/Reference/Card file/etc.), document-control
// roles may publish a revision directly without the Review/Approved steps.
const NON_COVER_QUICK: Record<DocStatus, DocStatus[]> = {
  Draft:     ['Published'],
  Review:    ['Published'],
  Approved:  ['Published'],
  Published: [],
  Obsolete:  [],
}

function resolveWorkflowRole(role: string, docRole?: string | null): WorkflowRole | undefined {
  const cleanDocRole = docRole?.trim()
  if (cleanDocRole && WORKFLOW_ROLES.includes(cleanDocRole as WorkflowRole)) {
    return cleanDocRole as WorkflowRole
  }

  const cleanRole = role.trim()
  return WORKFLOW_ROLES.includes(cleanRole as WorkflowRole) ? cleanRole as WorkflowRole : undefined
}

function mergeTransitions(...sets: DocStatus[][]) {
  return Array.from(new Set(sets.flat()))
}

export function allowedTransitions(
  current: DocStatus,
  role: string,
  docRole?: string,
  opts?: { coverRequired?: boolean },
): DocStatus[] {
  const coverRequired = opts?.coverRequired ?? true
  const wfRole = resolveWorkflowRole(role, docRole)
  // Non-cover types: Admin/DC may publish a revision directly (skip Review/Approved).
  const quick = !coverRequired && (role === 'Admin' || wfRole === 'Document Controller')
    ? NON_COVER_QUICK[current] ?? []
    : []

  if (role === 'Admin') return mergeTransitions(FULL_TRANSITIONS[current] ?? [], quick)
  const roleTransitions = role.trim() === MANAGER_ROLE ? MANAGER_TRANSITIONS[current] ?? [] : []
  let workflowTransitions: DocStatus[] = []
  switch (wfRole) {
    case 'Laboratory Director':
    case 'Quality Manager':
      workflowTransitions = APPROVER_TRANSITIONS[current] ?? []
      break
    case 'Document Controller':
      workflowTransitions = DCC_TRANSITIONS[current] ?? []
      break
    case 'Reviewer':
      workflowTransitions = NO_TRANSITIONS[current] ?? []
      break
    default:
      workflowTransitions = []
  }
  return mergeTransitions(roleTransitions, workflowTransitions, quick)
}

