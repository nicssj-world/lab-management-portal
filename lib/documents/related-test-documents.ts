export interface RelatedTestDocument {
  id: string
  document_code: string
  title: string
  type: string
  file_url: string | null
  file_name: string | null
}

export function orderRelatedTestDocuments(
  relatedDocumentIds: readonly string[],
  documents: readonly RelatedTestDocument[],
): RelatedTestDocument[] {
  const byId = new Map(documents.map((document) => [document.id, document]))
  const seen = new Set<string>()

  return relatedDocumentIds.flatMap((id) => {
    if (seen.has(id)) return []
    seen.add(id)
    const document = byId.get(id)
    return document ? [document] : []
  })
}
