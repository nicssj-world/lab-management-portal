import assert from 'node:assert/strict'
import {
  QUALITY_TASK_POLL_INTERVAL_MS,
  shouldPollQualityTaskDashboard,
} from './polling'

assert.equal(QUALITY_TASK_POLL_INTERVAL_MS, 10_000)
assert.equal(shouldPollQualityTaskDashboard(true, 'visible'), true)
assert.equal(shouldPollQualityTaskDashboard(false, 'visible'), false)
assert.equal(shouldPollQualityTaskDashboard(true, 'hidden'), false)

console.log('lib/quality-tasks/polling.test.ts: all assertions passed')
