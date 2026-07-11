import assert from 'node:assert/strict'

import {
  buildReadAudiencePickerState,
  buildReadAudiencePayload,
  resolveReadAudience,
  type ReadAudiencePerson,
} from '../lib/documents/read-audience'

const people: ReadAudiencePerson[] = [
  { id: 'u-office', dept: 'Office' },
  { id: 'u-chem-1', dept: 'Chemistry' },
  { id: 'u-chem-2', dept: 'Chemistry' },
  { id: 'u-micro', dept: 'Microbiology' },
  { id: 'u-none', dept: null },
]

assert.deepEqual(
  resolveReadAudience(people, ['Chemistry'], ['u-micro', 'missing']).map((p) => p.id),
  ['u-chem-1', 'u-chem-2', 'u-micro'],
  'resolves department users union explicit users and ignores unknown ids',
)

assert.deepEqual(
  resolveReadAudience(people, null, null).map((p) => p.id),
  people.map((p) => p.id),
  'empty audience fields resolve to all active people',
)

assert.deepEqual(
  buildReadAudiencePayload(new Set(['u-chem-1', 'u-chem-2', 'u-micro', 'u-none']), people, ['Office', 'Chemistry', 'Microbiology']),
  { depts: ['Chemistry', 'Microbiology'], user_ids: ['u-none'] },
  'full department selections are stored as departments and no-dept people as ids',
)

assert.deepEqual(
  buildReadAudiencePayload(new Set(['u-chem-1']), people, ['Office', 'Chemistry', 'Microbiology']),
  { depts: [], user_ids: ['u-chem-1'] },
  'partial department selections are stored as explicit user ids',
)

assert.deepEqual(
  buildReadAudiencePickerState(people, null, null),
  { mode: 'all', selected_user_ids: [], expanded_keys: [] },
  'whole-division prefill does not select or expand everyone when switching to per-person mode',
)

assert.deepEqual(
  buildReadAudiencePickerState(people, ['Chemistry'], ['u-none']),
  { mode: 'depts', selected_user_ids: ['u-chem-1', 'u-chem-2', 'u-none'], expanded_keys: [] },
  'restricted prefill selects the resolved audience but leaves departments collapsed',
)

console.log('read-audience tests passed')
