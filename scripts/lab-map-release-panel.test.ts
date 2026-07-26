import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panel = readFileSync('components/lab-map/LabMapReleasePanel.tsx', 'utf8')

assert.match(panel, /^'use client'/)
assert.match(panel, /export function LabMapReleasePanel/)
assert.match(panel, /fetch\('\/api\/admin\/lab-map\/releases',/, 'creates a draft release via the existing POST route')
assert.match(panel, /fetch\(`\/api\/admin\/lab-map\/releases\/\$\{release\.id\}`,/, 'edits the draft via the existing PATCH route')
assert.match(panel, /fetch\(`\/api\/admin\/lab-map\/releases\/\$\{release\.id\}\/publish`/, 'publishes via the existing publish route')
assert.match(panel, /response\.status === 422/, 'treats 422 as a validation-blocker response, not a generic error')
assert.match(panel, /setBlockers\(Array\.isArray\(body\.blockers\)/, 'reads the blockers array the publish route returns, guarded against a non-array response shape')
assert.match(panel, /router\.refresh\(\)/, 'reloads server-fetched data after every successful action')
assert.match(panel, /!release\.id/, 'the create-draft form is shown when there is no persisted release yet')
assert.match(panel, /release\.status === 'draft'/, 'the edit/publish form is shown for a draft release')
assert.match(panel, /reviewedBy \|\| null/, 'reviewer is sent as null, not empty string, when unset')
assert.match(panel, /approvedBy \|\| null/, 'approver is sent as null, not empty string, when unset')

console.log('lab map release panel contract passed')
