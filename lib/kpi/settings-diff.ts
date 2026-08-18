export interface CurrentKpiAssignee {
  id: number
  dept_id: number
  user_id: string
}

export interface CurrentKpiExclusion {
  id: number
  dept_id: number
  kpi_id: number
}

export interface DesiredKpiAssignee {
  dept_id: number
  user_id: string
}

export interface DesiredKpiExclusion {
  dept_id: number
  kpi_id: number
}

export function diffKpiSettings(
  current: { assignees: CurrentKpiAssignee[]; exclusions: CurrentKpiExclusion[] },
  desired: { assignees: DesiredKpiAssignee[]; exclusions: DesiredKpiExclusion[] },
) {
  const desiredAssignees = new Map<string, DesiredKpiAssignee>()
  for (const assignee of desired.assignees) desiredAssignees.set(`${assignee.dept_id}|${assignee.user_id}`, assignee)
  const currentAssigneeKeys = new Set(current.assignees.map((assignee) => `${assignee.dept_id}|${assignee.user_id}`))

  const desiredExclusions = new Map<string, DesiredKpiExclusion>()
  for (const exclusion of desired.exclusions) desiredExclusions.set(`${exclusion.dept_id}|${exclusion.kpi_id}`, exclusion)
  const currentExclusionKeys = new Set(current.exclusions.map((exclusion) => `${exclusion.dept_id}|${exclusion.kpi_id}`))

  return {
    assigneesToInsert: [...desiredAssignees.entries()]
      .filter(([key]) => !currentAssigneeKeys.has(key))
      .map(([, value]) => value),
    assigneeIdsToDelete: current.assignees
      .filter((assignee) => !desiredAssignees.has(`${assignee.dept_id}|${assignee.user_id}`))
      .map((assignee) => assignee.id),
    exclusionsToInsert: [...desiredExclusions.entries()]
      .filter(([key]) => !currentExclusionKeys.has(key))
      .map(([, value]) => value),
    exclusionIdsToDelete: current.exclusions
      .filter((exclusion) => !desiredExclusions.has(`${exclusion.dept_id}|${exclusion.kpi_id}`))
      .map((exclusion) => exclusion.id),
  }
}
