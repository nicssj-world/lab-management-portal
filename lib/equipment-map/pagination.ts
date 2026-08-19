/**
 * Reads every page of a query and concatenates them.
 *
 * `fetchPage` must impose a total order on the rows — order by the primary
 * key. Postgres gives no ordering guarantee otherwise, so the boundary between
 * two pages is undefined and a row can be skipped or returned twice, which
 * silently corrupts whatever is being accumulated here.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<readonly T[]>,
  pageSize = 500,
): Promise<T[]> {
  const rows: T[] = []

  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1)
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}
