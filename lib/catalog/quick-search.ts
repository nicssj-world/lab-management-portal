export const QUICK_SEARCH_MIN_LENGTH = 2
export const QUICK_SEARCH_LIMIT = 6

export function canQuickSearch(query: string) {
  return query.trim().length >= QUICK_SEARCH_MIN_LENGTH
}

export function buildCatalogSearchUrl(query: string) {
  const trimmed = query.trim()
  if (!trimmed) return '/catalog'

  const params = new URLSearchParams({ search: trimmed })
  return `/catalog?${params.toString()}`
}

export function buildCatalogOpenUrl(test: { id: number }, query: string) {
  const params = new URLSearchParams()
  const trimmed = query.trim()

  if (trimmed) params.set('search', trimmed)
  params.set('open', String(test.id))

  return `/catalog?${params.toString()}`
}

export function buildQuickSearchApiUrl(query: string, limit = QUICK_SEARCH_LIMIT) {
  const params = new URLSearchParams({
    search: query.trim(),
    page: '0',
    pageSize: String(limit),
    sortBy: 'th',
    sortDir: 'asc',
  })

  return `/api/tests?${params.toString()}`
}

export function buildTestDetailHref(test: { id: number }) {
  return `/catalog/${test.id}`
}
