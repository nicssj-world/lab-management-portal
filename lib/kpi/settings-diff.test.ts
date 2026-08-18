import assert from 'node:assert/strict'
import { diffKpiSettings } from './settings-diff'

const diff = diffKpiSettings(
  {
    assignees: [
      { id: 1, dept_id: 20, user_id: 'old-user' },
      { id: 2, dept_id: 18, user_id: 'keep-user' },
    ],
    exclusions: [{ id: 3, dept_id: 20, kpi_id: 6 }],
  },
  {
    assignees: [
      { dept_id: 18, user_id: 'keep-user' },
      { dept_id: 11, user_id: 'new-user' },
      { dept_id: 11, user_id: 'new-user' },
    ],
    exclusions: [],
  },
)

assert.deepEqual(diff.assigneesToInsert, [{ dept_id: 11, user_id: 'new-user' }])
assert.deepEqual(diff.assigneeIdsToDelete, [1])
assert.deepEqual(diff.exclusionsToInsert, [])
assert.deepEqual(diff.exclusionIdsToDelete, [3])
console.log('KPI settings diff tests passed')
