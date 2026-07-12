import { resolveReadAudience } from '@/lib/documents/read-audience'

// Mirrors resolveAssigneeIds in ./logic.ts: a non-empty override replaces the
// default wholesale (not merged); an empty override means "no override, use default".
export function resolveParticipantSelection(
  defaultDepts: string[], defaultUserIds: string[],
  overrideDepts: string[], overrideUserIds: string[],
): { depts: string[]; userIds: string[] } {
  const useOverride = overrideDepts.length > 0 || overrideUserIds.length > 0
  return useOverride
    ? { depts: overrideDepts, userIds: overrideUserIds }
    : { depts: defaultDepts, userIds: defaultUserIds }
}

// Unlike resolveReadAudience's own default ("nothing selected" = everyone), an
// unconfigured meeting-participant selection must resolve to an EMPTY list —
// an unconfigured template should not silently invite the entire staff roster.
export function resolveParticipants<T extends { id: string; dept: string | null }>(
  people: T[], depts: string[], userIds: string[],
): T[] {
  if (depts.length === 0 && userIds.length === 0) return []
  return resolveReadAudience(people, depts, userIds)
}
