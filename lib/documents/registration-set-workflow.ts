import { canMoveToStatus } from './workflow'

export type RegistrationSetNextStatus = 'Review' | 'Approved' | 'Published'

export interface RegistrationSetWorkflowDocument {
  id: string
  documentCode: string
  type: string
  status: string
  fileUrl: string | null
  sourcePdfUrl: string | null
  wordUrl: string | null
}

export interface RegistrationSetWorkflowDraft {
  id: string
  documentId: string
  type: string
  status: string
  fileUrl: string | null
  sourcePdfUrl: string | null
  wordUrl: string | null
}

export interface RegistrationSetWorkflowMember {
  document: RegistrationSetWorkflowDocument
  activeDraft: RegistrationSetWorkflowDraft | null
}

export interface RegistrationSetWorkflowInput {
  mainDocument: RegistrationSetWorkflowDocument
  members: RegistrationSetWorkflowMember[]
}

export interface RegistrationSetMutationTarget {
  kind: 'document' | 'revision-draft'
  documentId: string
  draftId: string | null
  documentCode: string
  endpoint: string
  nextStatus: RegistrationSetNextStatus
  isMain: boolean
}

export interface RegistrationSetBlocker {
  documentCode: string
  reason: string
}

export interface RegistrationSetTransitionPlan {
  nextStatus: RegistrationSetNextStatus | null
  actionLabel: string | null
  targets: RegistrationSetMutationTarget[]
  blocker: RegistrationSetBlocker | null
}

export interface RegistrationSetExecutionResult {
  succeeded: RegistrationSetMutationTarget[]
  failed: (RegistrationSetBlocker & { target?: RegistrationSetMutationTarget }) | null
}

const SET_ACTIONS: Partial<Record<string, { nextStatus: RegistrationSetNextStatus; label: string }>> = {
  Draft: { nextStatus: 'Review', label: 'ส่งทั้งชุดเข้า Review' },
  Review: { nextStatus: 'Approved', label: 'อนุมัติทั้งชุด' },
  Approved: { nextStatus: 'Published', label: 'เผยแพร่ทั้งชุด' },
}

function readinessBlocker(
  documentCode: string,
  item: RegistrationSetWorkflowDocument | RegistrationSetWorkflowDraft,
  nextStatus: RegistrationSetNextStatus,
): RegistrationSetBlocker | null {
  const readiness = canMoveToStatus({
    type: item.type,
    status: item.status,
    file_url: item.fileUrl,
    source_pdf_url: item.sourcePdfUrl,
    word_url: item.wordUrl,
  }, nextStatus)
  return readiness.ok ? null : { documentCode, reason: readiness.error }
}

function mutationTarget(
  document: RegistrationSetWorkflowDocument,
  activeDraft: RegistrationSetWorkflowDraft | null,
  nextStatus: RegistrationSetNextStatus,
  isMain: boolean,
): RegistrationSetMutationTarget {
  return activeDraft
    ? {
        kind: 'revision-draft',
        documentId: activeDraft.documentId,
        draftId: activeDraft.id,
        documentCode: document.documentCode,
        endpoint: `/api/admin/documents/${activeDraft.documentId}/revision-drafts/${activeDraft.id}`,
        nextStatus,
        isMain,
      }
    : {
        kind: 'document',
        documentId: document.id,
        draftId: null,
        documentCode: document.documentCode,
        endpoint: `/api/admin/documents/${document.id}`,
        nextStatus,
        isMain,
      }
}

export function planRegistrationSetTransition(set: RegistrationSetWorkflowInput): RegistrationSetTransitionPlan {
  const action = SET_ACTIONS[set.mainDocument.status]
  if (!action) {
    return {
      nextStatus: null,
      actionLabel: null,
      targets: [],
      blocker: { documentCode: set.mainDocument.documentCode, reason: 'สถานะเอกสารหลักไม่มีขั้นตอนถัดไปสำหรับทั้งชุด' },
    }
  }

  const targets: RegistrationSetMutationTarget[] = []
  for (const member of set.members) {
    if (!member.activeDraft && member.document.status === 'Published') continue
    const routed = member.activeDraft ?? member.document
    if (routed.status === action.nextStatus) continue
    if (routed.status !== set.mainDocument.status) {
      return {
        nextStatus: action.nextStatus,
        actionLabel: action.label,
        targets,
        blocker: {
          documentCode: member.document.documentCode,
          reason: `สถานะ ${routed.status} ไม่สอดคล้องกับเอกสารหลัก ${set.mainDocument.status}`,
        },
      }
    }
    const blocker = readinessBlocker(member.document.documentCode, routed, action.nextStatus)
    if (blocker) return { nextStatus: action.nextStatus, actionLabel: action.label, targets, blocker }
    targets.push(mutationTarget(member.document, member.activeDraft, action.nextStatus, false))
  }

  const mainBlocker = readinessBlocker(set.mainDocument.documentCode, set.mainDocument, action.nextStatus)
  if (mainBlocker) return { nextStatus: action.nextStatus, actionLabel: action.label, targets, blocker: mainBlocker }
  targets.push(mutationTarget(set.mainDocument, null, action.nextStatus, true))

  return { nextStatus: action.nextStatus, actionLabel: action.label, targets, blocker: null }
}

export async function executeRegistrationSetPlan(
  plan: RegistrationSetTransitionPlan,
  mutate: (target: RegistrationSetMutationTarget) => Promise<void>,
): Promise<RegistrationSetExecutionResult> {
  if (plan.blocker) return { succeeded: [], failed: plan.blocker }

  const succeeded: RegistrationSetMutationTarget[] = []
  for (const target of plan.targets) {
    try {
      await mutate(target)
      succeeded.push(target)
    } catch (error) {
      return {
        succeeded,
        failed: {
          target,
          documentCode: target.documentCode,
          reason: error instanceof Error ? error.message : 'ดำเนินการไม่สำเร็จ',
        },
      }
    }
  }
  return { succeeded, failed: null }
}

export function classifyRegistrationSetDocument(
  documentId: string,
  mainIds: ReadonlySet<string>,
  memberIds: ReadonlySet<string>,
): 'main' | 'member' | null {
  if (mainIds.has(documentId)) return 'main'
  if (memberIds.has(documentId)) return 'member'
  return null
}

export function canInteractWithRegistrationSetRows(userRole?: string, docRole?: string) {
  return userRole === 'Admin'
    || userRole === 'Document Controller'
    || docRole === 'Document Controller'
}
