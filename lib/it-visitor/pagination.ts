export const VISITOR_PAGE_SIZE = 50

export interface VisitorPagination<T> {
  items: T[]
  page: number
  pageCount: number
  pageSize: number
  total: number
  from: number
  to: number
}

interface VisitorLogTimeFields {
  entered_at: string
  exited_at: string | null
}

export function prioritizeOpenVisitorLogs<T extends VisitorLogTimeFields>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => {
    const leftOpen = !left.exited_at
    const rightOpen = !right.exited_at
    if (leftOpen !== rightOpen) return leftOpen ? -1 : 1
    return new Date(right.entered_at).getTime() - new Date(left.entered_at).getTime()
  })
}

export function paginateVisitorLogs<T>(
  rows: readonly T[],
  requestedPage: number,
  requestedPageSize = VISITOR_PAGE_SIZE,
): VisitorPagination<T> {
  const pageSize = Number.isInteger(requestedPageSize) && requestedPageSize > 0
    ? requestedPageSize
    : VISITOR_PAGE_SIZE
  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(pageCount, Math.max(1, Math.trunc(requestedPage) || 1))
  const start = (page - 1) * pageSize
  const end = Math.min(start + pageSize, total)

  return {
    items: rows.slice(start, end),
    page,
    pageCount,
    pageSize,
    total,
    from: total === 0 ? 0 : start + 1,
    to: end,
  }
}
