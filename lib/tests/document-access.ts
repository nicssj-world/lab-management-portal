export type DocumentVisibility = 'Internal' | 'Public'
export type DocumentAccessMode = 'view' | 'download' | 'both'
export type DocumentAction = 'view' | 'download'

export function normalizeDocumentAccess(
  visibility: string | null | undefined,
  accessMode: string | null | undefined,
): { visibility: DocumentVisibility; accessMode: DocumentAccessMode } {
  const normalizedVisibility: DocumentVisibility = visibility === 'Public' ? 'Public' : 'Internal'
  if (normalizedVisibility === 'Internal') return { visibility: normalizedVisibility, accessMode: 'view' }

  const normalizedAccess: DocumentAccessMode =
    accessMode === 'view' || accessMode === 'download' || accessMode === 'both' ? accessMode : 'both'
  return { visibility: normalizedVisibility, accessMode: normalizedAccess }
}

export function canUseDocumentAction(accessMode: DocumentAccessMode, action: DocumentAction) {
  return accessMode === 'both' || accessMode === action
}
