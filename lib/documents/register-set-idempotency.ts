import type { RegisterSetItem } from '@/lib/validations/document-set'

type RegisterItem = Extract<RegisterSetItem, { kind: 'register' }>

export type RegisteredRetryDocument = {
  id: string
  document_code: string
  title: string
  type: string
  department: string | null
  revision: string
  status: string
  visibility: string
  owner_id: string | null
  owner_name: string | null
  reviewer_name: string | null
  approver_name: string | null
  edit_date: string | null
  effective_date: string | null
  word_url: string | null
  pending_file_url: string | null
  deleted_at: string | null
}

export type RegisterRetryClassification = 'linked-retry' | 'stranded-retry' | 'conflict'

function normalized(value: string | null | undefined) {
  return value?.trim() ?? ''
}

export function registeredFileKey(document: RegisteredRetryDocument, fileKind: 'pdf' | 'source') {
  return fileKind === 'source' ? document.word_url : document.pending_file_url
}

export function isSameRegistrationMetadata(
  document: RegisteredRetryDocument,
  item: RegisterItem,
  actorId: string,
) {
  // Registration creation stores the authenticated actor in owner_id; unlike owner_name,
  // this is the stable creator identity used to authenticate an ambiguous retry.
  return document.status === 'Draft'
    && document.deleted_at === null
    && document.owner_id === actorId
    && document.document_code.trim().toUpperCase() === item.document_code.trim().toUpperCase()
    && normalized(document.title) === normalized(item.title)
    && document.type === item.type
    && normalized(document.department) === normalized(item.department)
    && normalized(document.revision) === normalized(item.revision)
    && document.visibility === item.visibility
    && normalized(document.owner_name) === normalized(item.owner_name)
    && normalized(document.reviewer_name) === normalized(item.reviewer_name)
    && normalized(document.approver_name) === normalized(item.approver_name)
    && normalized(document.edit_date) === normalized(item.edit_date)
    && normalized(document.effective_date) === normalized(item.effective_date)
}

export function classifyRegisterRetry(args: {
  document: RegisteredRetryDocument
  item: RegisterItem
  actorId: string
  mainDocumentId: string
  setLinkMainIds: string[]
  fileKind: 'pdf' | 'source'
}): RegisterRetryClassification {
  const { document, item, actorId, mainDocumentId, setLinkMainIds, fileKind } = args
  if (registeredFileKey(document, fileKind) !== item.file.key) return 'conflict'
  if (!isSameRegistrationMetadata(document, item, actorId)) return 'conflict'
  if (setLinkMainIds.includes(mainDocumentId)) return 'linked-retry'
  if (setLinkMainIds.length > 0) return 'conflict'
  return 'stranded-retry'
}

export function hasMatchingFileKey(row: { file_url: string } | null | undefined, key: string) {
  return row?.file_url === key
}

export function hasMatchingSourceKey(row: { word_url?: string | null } | null | undefined, key: string) {
  return row?.word_url === key
}
