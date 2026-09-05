import { isCoverRequiredType } from './workflow'

export const FIRST_PUBLICATION_DESCRIPTION = 'ประกาศใช้ครั้งแรกทั้งฉบับ'
export const CHANGE_DESCRIPTION_REQUIRED_ERROR = 'QP/WI ต้องระบุรายละเอียดการแก้ไขก่อนเผยแพร่'

export function requiresPublicationDescription(
  type: string | null | undefined,
  nextStatus: string | null | undefined,
) {
  return nextStatus === 'Published' && isCoverRequiredType(type)
}

export function hasChangeDescription(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
}

export function getPublicationDescriptionError(
  type: string | null | undefined,
  nextStatus: string | null | undefined,
  value: unknown,
) {
  return requiresPublicationDescription(type, nextStatus) && !hasChangeDescription(value)
    ? CHANGE_DESCRIPTION_REQUIRED_ERROR
    : null
}

export function shouldDisplayChangeDescription(type: string | null | undefined) {
  return isCoverRequiredType(type)
}

export function isInitialRevision(revision: string | null | undefined) {
  const normalized = revision?.trim().replace(/^rev(?:ision)?\.?\s*/i, '')
  return Boolean(normalized && /^0+$/.test(normalized))
}

export function getInitialChangeDescription({
  type,
  revision,
  isNewDocument,
  isImportCurrent,
}: {
  type: string | null | undefined
  revision: string | null | undefined
  isNewDocument: boolean
  isImportCurrent: boolean
}) {
  if (!isNewDocument || isImportCurrent || !isInitialRevision(revision) || !isCoverRequiredType(type)) return null
  return FIRST_PUBLICATION_DESCRIPTION
}

export function resolveInitialChangeDescription({
  type,
  revision,
  isNewDocument,
  isImportCurrent,
  description,
}: {
  type: string | null | undefined
  revision: string | null | undefined
  isNewDocument: boolean
  isImportCurrent: boolean
  description?: string
}) {
  if (description !== undefined) return description.trim()
  return getInitialChangeDescription({ type, revision, isNewDocument, isImportCurrent }) ?? undefined
}
