export interface DocumentSetSaveEligibility {
  isEdit: boolean
  isImportCurrent: boolean
  type: string
  registerSetAfterSave: boolean
}

export function requiresControlledCover(type: string) {
  return type === 'QP' || type === 'WI'
}

export function normalizeRegisterSetSelection(type: string, checked: boolean) {
  return requiresControlledCover(type) ? checked : false
}

export function shouldRegisterSetAfterSave(input: DocumentSetSaveEligibility) {
  return !input.isEdit
    && !input.isImportCurrent
    && requiresControlledCover(input.type)
    && input.registerSetAfterSave
}

export function completeSuccessfulDocumentSave<T>(
  document: T,
  eligibility: DocumentSetSaveEligibility,
  callbacks: {
    onSaved: (document: T) => void
    onRegisterSet?: (document: T) => void
  },
) {
  callbacks.onSaved(document)
  if (shouldRegisterSetAfterSave(eligibility)) callbacks.onRegisterSet?.(document)
}
