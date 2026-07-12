interface CatalogFilterUrlState {
  search: string
  categoryId: string
  tube: string
  openId?: number | null
}

export function buildCatalogFilterUrl({ search, categoryId, tube, openId }: CatalogFilterUrlState) {
  const params = new URLSearchParams()
  const trimmedSearch = search.trim()

  if (trimmedSearch) params.set('search', trimmedSearch)
  if (categoryId) params.set('cat', categoryId)
  if (tube) params.set('tube', tube)
  if (openId) params.set('open', String(openId))

  const query = params.toString()
  return query ? `/catalog?${query}` : '/catalog'
}
