export type DocStatus = 'Draft' | 'Review' | 'Approved' | 'Published' | 'Obsolete'

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
  switch (docRole) {
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
  // Admin / Lab Director / Doc Controller — เห็นทุกสถานะเสมอ
  if (role === 'Admin' || docRole === 'Laboratory Director' || docRole === 'Document Controller') {
    return ALL_STATUSES
  }

  // Quality Manager — Draft, Review, Approved (ไม่มี Published/Obsolete)
  if (docRole === 'Quality Manager') {
    return ['Draft', 'Review', 'Approved']
  }

  // Reviewer — ขึ้นอยู่กับ current status + transitions
  if (docRole === 'Reviewer') {
    if (!currentStatus) return ['Draft']
    const transitions = allowedTransitions(currentStatus, role, docRole)
    return [currentStatus, ...transitions.filter((s) => s !== currentStatus)]
  }

  // Viewer / null — Draft เท่านั้น (ถ้าผ่านมาได้ถึง modal นี้)
  return ['Draft']
}
