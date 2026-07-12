export interface ReadAudiencePerson {
  id: string
  dept: string | null
}

export interface ReadAudiencePayload {
  depts: string[]
  user_ids: string[]
}

export interface ReadAudiencePickerState {
  mode: 'all' | 'depts'
  selected_user_ids: string[]
  expanded_keys: string[]
}

export function resolveReadAudience<T extends ReadAudiencePerson>(
  people: T[],
  depts: readonly string[] | null | undefined,
  userIds: readonly string[] | null | undefined,
): T[] {
  const deptSet = new Set(depts ?? [])
  const userSet = new Set(userIds ?? [])
  if (deptSet.size === 0 && userSet.size === 0) return people

  return people.filter((person) => (
    (person.dept != null && deptSet.has(person.dept)) || userSet.has(person.id)
  ))
}

export function buildReadAudiencePayload(
  selectedUserIds: ReadonlySet<string> | readonly string[],
  people: ReadAudiencePerson[],
  departmentOrder: readonly string[],
): ReadAudiencePayload {
  const selected = selectedUserIds instanceof Set ? selectedUserIds : new Set(selectedUserIds)
  const knownDepartments = new Set(departmentOrder)
  const depts: string[] = []
  const userIds: string[] = []

  for (const dept of departmentOrder) {
    const members = people.filter((person) => person.dept === dept)
    if (members.length === 0) continue

    const selectedMembers = members.filter((person) => selected.has(person.id))
    if (selectedMembers.length === 0) continue

    if (selectedMembers.length === members.length) {
      depts.push(dept)
    } else {
      userIds.push(...selectedMembers.map((person) => person.id))
    }
  }

  for (const person of people) {
    if (!selected.has(person.id)) continue
    if (person.dept && knownDepartments.has(person.dept)) continue
    userIds.push(person.id)
  }

  return { depts, user_ids: userIds }
}

export function buildReadAudiencePickerState<T extends ReadAudiencePerson>(
  people: T[],
  depts: readonly string[] | null | undefined,
  userIds: readonly string[] | null | undefined,
): ReadAudiencePickerState {
  const hasRestriction = (depts?.length ?? 0) > 0 || (userIds?.length ?? 0) > 0
  if (!hasRestriction) {
    return { mode: 'all', selected_user_ids: [], expanded_keys: [] }
  }

  return {
    mode: 'depts',
    selected_user_ids: resolveReadAudience(people, depts, userIds).map((person) => person.id),
    expanded_keys: [],
  }
}
