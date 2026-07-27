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
