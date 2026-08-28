import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const activeProfileFiles = [
  'lib/queries/personnel.ts',
  'lib/quality-tasks/server.ts',
  'lib/quality-tasks/monthly-safety-config-server.ts',
  'app/(protected)/staff/personnel/[id]/page.tsx',
  'app/(protected)/staff/personnel/org/page.tsx',
  'app/(public)/staff/personnel/team-org/page.tsx',
  'app/(protected)/staff/safety/page.tsx',
  'app/(protected)/staff/it/access/page.tsx',
  'app/(protected)/staff/it/backup/page.tsx',
  'app/(protected)/staff/dashboard/page.tsx',
  'app/(protected)/kpi/api/settings/route.ts',
  'app/api/admin/satisfaction/editors/route.ts',
  'app/api/admin/chemical-safety/role-scopes/route.ts',
  'app/api/admin/lab-map/safety-editors/route.ts',
  'app/api/admin/personnel/org/route.ts',
  'app/(public)/contact/page.tsx',
  'app/api/admin/it-access/route.ts',
  'app/api/admin/it-access/editors/route.ts',
  'app/api/admin/equipment/route.ts',
  'app/api/admin/equipment/[id]/route.ts',
  'app/api/admin/equipment/editors/route.ts',
  'app/api/admin/personnel/org/[nodeId]/route.ts',
]

const activeFilter = /\.eq\(\s*['"]status['"]\s*,\s*['"]active['"]\s*\)/
const deletedFilter = /\.is\(\s*['"]deleted_at['"]\s*,\s*null\s*\)/

for (const file of activeProfileFiles) {
  const source = readFileSync(file, 'utf8')
  assert.match(source, activeFilter, `${file} must filter active profiles`)
  assert.match(source, deletedFilter, `${file} must exclude soft-deleted profiles`)
}

for (const file of ['app/api/admin/personnel/org/route.ts', 'app/(public)/contact/page.tsx']) {
  assert.match(readFileSync(file, 'utf8'), /inactiveProfileLink/, `${file} must hide stale linked profile details`)
}

console.log('active profile query contract: all assertions passed')
