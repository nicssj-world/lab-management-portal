import assert from 'node:assert/strict'
import {
  GHS_H_STATEMENT_OPTIONS,
  GHS_HAZARD_CLASS_OPTIONS,
  GHS_P_STATEMENT_OPTIONS,
  findGhsHazardClassOption,
  findGhsStatementOption,
} from './ghs-catalog'
import { chemicalSdsDraftPatchSchema } from './schemas'

function assertUnique(values: string[], label: string) {
  assert.equal(new Set(values).size, values.length, `${label} contains duplicate values`)
}

assertUnique(GHS_H_STATEMENT_OPTIONS.map(option => option.code), 'H statement catalog')
assertUnique(GHS_P_STATEMENT_OPTIONS.map(option => option.code), 'P statement catalog')
assertUnique(GHS_HAZARD_CLASS_OPTIONS.map(option => option.className), 'hazard class catalog')

assert.equal(findGhsHazardClassOption('ก๊าซไวไฟ')?.className, 'Flammable gases')
assert.equal(findGhsStatementOption(GHS_H_STATEMENT_OPTIONS, 'h225')?.code, 'H225')
assert.equal(findGhsStatementOption(GHS_P_STATEMENT_OPTIONS, 'P301 + P310')?.code, 'P301+P310')

const parsed = chemicalSdsDraftPatchSchema.safeParse({
  updatedAt: '2026-08-31T00:00:00.000Z',
  language: 'en',
  hazards: [{ className: 'Flammable liquids', category: 'Category 2' }],
  hStatements: [{ code: 'H360FD', text: 'May damage fertility or the unborn child' }],
  pStatements: [{ code: 'P301+P310', text: 'Immediately call a poison centre/doctor.' }],
})
assert.equal(parsed.success, true, 'the API schema must accept standard H suffixes and combined P codes')

console.log('chemical-safety GHS catalog: ok')
