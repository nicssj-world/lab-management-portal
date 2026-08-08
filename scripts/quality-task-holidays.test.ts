import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path: string) => fs.readFileSync(path, 'utf8')
const migration = read('supabase/migrations/20260808194305_quality_task_holidays.sql')
const collectionRoute = read('app/api/admin/quality-tasks/holidays/route.ts')
const itemRoute = read('app/api/admin/quality-tasks/holidays/[id]/route.ts')
const dashboard = read('components/quality-tasks/QualityTaskDashboard.tsx')
const page = read('app/(protected)/staff/quality-tasks/page.tsx')

assert.match(migration, /quality_task_holidays/, 'migration creates the holiday table')
assert.match(migration, /ENABLE ROW LEVEL SECURITY/, 'holiday table keeps RLS enabled')
assert.match(collectionRoute, /isAdminRole/, 'holiday creation checks the Admin role')
assert.match(collectionRoute, /export async function POST/, 'holiday creation endpoint exists')
assert.match(itemRoute, /export async function PATCH/, 'holiday update endpoint exists')
assert.match(itemRoute, /export async function DELETE/, 'holiday delete endpoint exists')
assert.match(dashboard, /qt-day-weekend/, 'calendar styles weekend cells')
assert.match(dashboard, /วันหยุด/, 'calendar displays holidays')
assert.match(dashboard, /isAdmin/, 'holiday management controls are admin-gated')
assert.match(page, /isAdminRole/, 'page passes the normalized Admin status to the calendar')

console.log('scripts/quality-task-holidays.test.ts: all assertions passed')
