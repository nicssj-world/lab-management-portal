import type { DocxHeaderMetadata } from '@/lib/documents/docx-header'

export type DocumentMetadataSource = {
  document_code?: string | null
  title?: string | null
  revision?: string | null
  effective_date?: string | null
  expiry_date?: string | null
  edit_date?: string | null
}

function clean(value: unknown) {
  if (typeof value === 'string') return value.trim() || undefined
  if (value == null) return undefined
  return String(value).trim() || undefined
}

export function getDocumentEditReviewDate(source: Pick<DocumentMetadataSource, 'edit_date' | 'expiry_date'>) {
  return clean(source.edit_date) ?? clean(source.expiry_date)
}

export function getDocumentReviewDate(source: Pick<DocumentMetadataSource, 'edit_date' | 'expiry_date'>) {
  // expiry_date is the legacy DB column used by master-list screens as review date.
  return clean(source.expiry_date) ?? clean(source.edit_date)
}

export function buildDocxHeaderMetadata(source: DocumentMetadataSource): DocxHeaderMetadata {
  return {
    documentCode: clean(source.document_code),
    title: clean(source.title),
    revision: clean(source.revision),
    effectiveDate: clean(source.effective_date),
    reviewDate: getDocumentReviewDate(source),
    editDate: getDocumentEditReviewDate(source),
  }
}
