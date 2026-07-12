import assert from 'node:assert/strict'
import { resolveParticipantSelection, resolveParticipants } from './participants'

// resolveParticipantSelection: non-empty override wins wholesale, same rule as resolveAssigneeIds
assert.deepEqual(
  resolveParticipantSelection(['A'], ['u1'], [], []),
  { depts: ['A'], userIds: ['u1'] },
  'no override configured -> falls back to the template default',
)
assert.deepEqual(
  resolveParticipantSelection(['A'], ['u1'], ['B'], []),
  { depts: ['B'], userIds: [] },
  'a non-empty override replaces the default wholesale, not merged',
)
assert.deepEqual(
  resolveParticipantSelection(['A'], ['u1'], [], ['u2']),
  { depts: [], userIds: ['u2'] },
  'an override with only user_ids still fully replaces the dept default',
)

// resolveParticipants: unconfigured must resolve to EMPTY, not everyone
type P = { id: string; dept: string | null }
const people: P[] = [
  { id: 'u1', dept: 'A' },
  { id: 'u2', dept: 'B' },
  { id: 'u3', dept: null },
]
assert.deepEqual(resolveParticipants(people, [], []), [], 'unconfigured selection resolves to an empty audience')
assert.deepEqual(resolveParticipants(people, ['A'], []).map(p => p.id), ['u1'], 'resolves department members')
assert.deepEqual(resolveParticipants(people, [], ['u3']).map(p => p.id), ['u3'], 'resolves an individually-selected person with no dept')
assert.deepEqual(resolveParticipants(people, ['A'], ['u3']).map(p => p.id).sort(), ['u1', 'u3'], 'union of dept and individual selection')

console.log('lib/quality-tasks/participants.test.ts: all assertions passed')
