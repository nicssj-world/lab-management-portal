import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequestGuard } from './request-guard'

const guard = createRequestGuard()
const first = guard.begin()
const second = guard.begin()

assert.equal(first.signal.aborted, true, 'starting a newer request should abort the older request')
assert.equal(guard.isCurrent(first.id), false, 'an older request must not remain current')
assert.equal(guard.isCurrent(second.id), true, 'the newest request should be current')

guard.cancel()
assert.equal(second.signal.aborted, true, 'cancelling should abort the active request')

for (const file of [
  'components/kpi/KpiInputForm.tsx',
  'components/kpi/KpiAnnualTable.tsx',
  'components/kpi/KpiPresentationDashboard.tsx',
  'components/kpi/KpiOverviewTable.tsx',
]) {
  const source = readFileSync(resolve(__dirname, '..', '..', file), 'utf8')
  assert.match(source, /createRequestGuard/, `${file} should use a request guard`)
  assert.match(source, /signal: request\.signal|signal: activeRequest\.signal|signal: handle\.signal/, `${file} should pass an abort signal to fetch`)
  assert.match(source, /isCurrent\(/, `${file} should ignore stale responses`)
}

console.log('KPI request race tests passed')
