const DOCUMENT_SORT_COLUMNS = new Set([
  'document_code',
  'title',
  'type',
  'status',
  'visibility',
  'department',
  'revision',
  'effective_date',
  'expiry_date',
  'created_at',
  'updated_at',
])

const DOCUMENT_SORT_ALIASES: Record<string, string> = {
  review_date: 'expiry_date',
}

export function resolveDocumentSortColumn(sortBy: string | null | undefined) {
  const requested = sortBy || 'updated_at'
  const column = DOCUMENT_SORT_ALIASES[requested] ?? requested
  return DOCUMENT_SORT_COLUMNS.has(column) ? column : 'updated_at'
}
