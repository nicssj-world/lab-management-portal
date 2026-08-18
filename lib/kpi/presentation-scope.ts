interface PresentationDefinition {
  id: number
  code: string
}

interface PresentationDepartment {
  id: number
  code: string
}

export function isKpiApplicable(
  code: string,
  deptCode: string | null,
  definitions: PresentationDefinition[],
  departments: PresentationDepartment[],
  exclusions: ReadonlySet<string>,
): boolean {
  const definition = definitions.find((item) => item.code === code)
  if (!definition) return false
  const candidates = deptCode ? departments.filter((department) => department.code === deptCode) : departments
  return candidates.some((department) => !exclusions.has(`${department.id}|${definition.id}`))
}
