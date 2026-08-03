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

// Adds a walk-in attendee to an instance's participant override.
//
// The trap this exists to avoid: a non-empty override REPLACES the default wholesale
// (see resolveParticipantSelection). Appending the walk-in to a still-empty override
// would therefore collapse the whole meeting's audience down to that one person.
// So the currently-resolved selection is materialised into the override FIRST, and the
// walk-in appended to that — the resulting override re-resolves to "everyone who was
// already invited, plus this person".
export function addParticipantToSelection(
  defaultDepts: string[], defaultUserIds: string[],
  overrideDepts: string[], overrideUserIds: string[],
  userId: string,
): { depts: string[]; userIds: string[] } {
  const current = resolveParticipantSelection(defaultDepts, defaultUserIds, overrideDepts, overrideUserIds)
  if (current.userIds.includes(userId)) return current
  return { depts: current.depts, userIds: [...current.userIds, userId] }
}
