import assert from 'node:assert/strict'
import fs from 'node:fs'

const dashboard = fs.readFileSync('components/quality-tasks/QualityTaskDashboard.tsx', 'utf8')

assert.match(dashboard, /QUALITY_TASK_POLL_INTERVAL_MS/)
assert.match(dashboard, /visibilitychange/)
assert.match(dashboard, /setTimeout/)
assert.match(dashboard, /setSelected\(\(current\)/)
assert.match(dashboard, /cache:\s*["']no-store["']/)

console.log('scripts/quality-task-polling.test.ts: all assertions passed')
