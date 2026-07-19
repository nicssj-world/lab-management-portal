import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const outlab = readFileSync('lib/outlab/server.ts', 'utf8')
const eqa = readFileSync('lib/eqa/server.ts', 'utf8')

assert.ok(outlab.includes('export async function getOutlabOverview'))
assert.ok(outlab.includes("from('outlab_laboratories')"))
assert.ok(outlab.includes('certificateUrgency'))
assert.ok(eqa.includes('export async function getEqaOverview'))
assert.ok(eqa.includes("from('eqa_programs')"))
assert.ok(eqa.includes('roundClosureBlockers'))
assert.ok(eqa.includes('summarizeCoverage'))

console.log('scripts/external-quality-server-contract.test.ts: all assertions passed')
