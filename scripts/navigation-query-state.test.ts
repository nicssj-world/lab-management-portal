import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

for (const path of [
  'app/(protected)/kpi/dashboard/page.tsx',
  'app/(protected)/tat/TatDashboardClient.tsx',
  'app/(protected)/lab-workload/dashboard/page.tsx',
  'components/rejection/RejectionClient.tsx',
  'app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx',
]) {
  const source = read(path)
  assert.ok(source.includes('useSearchParams'), `${path} reads its view from the URL`)
  assert.ok(source.includes('normalizeNavigationValue'), `${path} rejects invalid URL values`)
  assert.ok(source.includes('<ViewTabs'), `${path} renders shared query-backed navigation`)
}

for (const path of [
  'app/(protected)/staff/equipment/EquipmentClient.tsx',
  'app/(protected)/staff/news/NewsManageClient.tsx',
  'app/(protected)/staff/documents/master-list/MasterListClient.tsx',
]) {
  assert.ok(read(path).includes('<FilterChips'), `${path} uses pressed-state filter chips`)
}

console.log('navigation query-state tests passed')
