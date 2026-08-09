export const REGISTRY_PAGE_SIZE = 20

export function paginateRegistryItems<T>(items: readonly T[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / REGISTRY_PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), pageCount)
  const start = (currentPage - 1) * REGISTRY_PAGE_SIZE
  const pageItems = items.slice(start, start + REGISTRY_PAGE_SIZE)

  return {
    items: pageItems,
    currentPage,
    pageCount,
    from: pageItems.length > 0 ? start + 1 : 0,
    to: start + pageItems.length,
  }
}
