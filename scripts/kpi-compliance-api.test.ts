import assert from 'node:assert/strict'
import fs from 'node:fs'

const complianceRoute = fs.readFileSync('app/(protected)/kpi/api/compliance/route.ts', 'utf8')
const detailRoute = fs.readFileSync('app/(protected)/kpi/api/compliance/detail/route.ts', 'utf8')
const entriesRoute = fs.readFileSync('app/(protected)/kpi/api/entries/route.ts', 'utf8')

assert.match(complianceRoute, /canAccessResource\(actor, 'KPI', 'view'\)/)
assert.match(complianceRoute, /getAssignedDeptIds/)
assert.match(complianceRoute, /requestedStatus/)
assert.match(complianceRoute, /getKpiCompliance/)
assert.match(detailRoute, /getKpiComplianceDetail/)
assert.match(detailRoute, /assignedSet\.has\(item\.id\)/)
assert.match(entriesRoute, /saveKpiEntriesAtomic\(supabaseAdmin, entries, clearEntries, actor\.id\)/)
assert.doesNotMatch(entriesRoute, /await upsertEntries\(/, 'entry writes must use the atomic save RPC')
assert.doesNotMatch(entriesRoute, /await deleteEntries\(/, 'entry clears must use the atomic save RPC')

console.log('KPI compliance API contract tests passed')

