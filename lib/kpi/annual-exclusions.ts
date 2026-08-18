export interface AnnualRowScope {
  dept_code: string
  kpi_code: string
}

export function filterAnnualRowsByExclusions<T extends AnnualRowScope>(
  rows: T[],
  deptByCode: ReadonlyMap<string, { id: number }>,
  definitionByCode: ReadonlyMap<string, { id: number }>,
  exclusions: ReadonlySet<string>,
): T[] {
  return rows.filter((row) => {
    const dept = deptByCode.get(row.dept_code)
    const definition = definitionByCode.get(row.kpi_code)
    if (!dept || !definition) return true
    return !exclusions.has(`${dept.id}|${definition.id}`)
  })
}
