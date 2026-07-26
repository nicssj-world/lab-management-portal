import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

import {
  JUNE_2026_MASTERLIST_ROWS,
  JUNE_2026_MASTERLIST_SHA256,
  buildJune2026NormalizedProposals,
  findConflictNames,
  readJune2026Masterlist,
} from './masterlist-june-2026'
import { assertSourceFile, sha256File } from './source-files'

const sourcePdf = 'C:\\Users\\User\\Downloads\\Unit Chemical Inventory List ห้องเก็บสารเคมี (1).pdf'

assert.equal(JUNE_2026_MASTERLIST_SHA256, '71d25b0e50b3056f97edb3238a1a7949584744f67fc0bfbfafcaa70273d83ddb')
assert.equal(JUNE_2026_MASTERLIST_ROWS.length, 25)
assert.deepEqual(JUNE_2026_MASTERLIST_ROWS.map(row => row.no), Array.from({ length: 25 }, (_, i) => i + 1))
assert.deepEqual(findConflictNames(JUNE_2026_MASTERLIST_ROWS), [
  'Ammonia solution 30%',
  'Ethyl alcohol 95%',
  'Formic acid',
  'Methanol',
  'Wright’s Baso',
])
assert.equal(JUNE_2026_MASTERLIST_ROWS.find(row => row.no === 11)?.reportedTotalRaw, '18 ลิตร')
assert.equal(JUNE_2026_MASTERLIST_ROWS.find(row => row.no === 25)?.rawLocation, 'B3, B4')

assert.deepEqual(
  JUNE_2026_MASTERLIST_ROWS.filter(row => row.rawLocation === 'B3, B4').map(row => row.no),
  [2, 10, 13, 19, 20, 25],
)
assert.equal(JUNE_2026_MASTERLIST_ROWS.find(row => row.no === 1)?.chemicalName, '70 % alcohol')
assert.equal(JUNE_2026_MASTERLIST_ROWS.find(row => row.no === 7)?.chemicalName, 'alcohol Hand Rub')
assert.equal(JUNE_2026_MASTERLIST_ROWS.find(row => row.no === 20)?.chemicalName, 'PROPAN-2-OL')
assert.equal(JUNE_2026_MASTERLIST_ROWS.find(row => row.no === 22)?.chemicalName, 'Sulphuric acid')
assert.equal(JUNE_2026_MASTERLIST_ROWS.find(row => row.no === 25)?.reportedTotalRaw, '5 ลิตร 1 ขวด')

const proposals = buildJune2026NormalizedProposals(JUNE_2026_MASTERLIST_ROWS)
assert.equal(proposals.length, 25)
assert.deepEqual(
  proposals.find(proposal => proposal.rawRowNo === 13)?.packageParts,
  [
    { value: 2.5, unit: 'L', count: 1 },
    { value: 1, unit: 'L', count: 1 },
  ],
)
assert.equal(proposals.find(proposal => proposal.rawRowNo === 2)?.currentPositionCode, 'B3')
assert.equal(proposals.find(proposal => proposal.rawRowNo === 20)?.currentPositionCode, 'B4')
assert.equal(proposals.find(proposal => proposal.rawRowNo === 25)?.currentPositionCode, 'B4')
assert.equal(JUNE_2026_MASTERLIST_ROWS.find(row => row.no === 2)?.rawLocation, 'B3, B4')

async function main() {
  if (existsSync(sourcePdf)) {
    assert.equal(await sha256File(sourcePdf), JUNE_2026_MASTERLIST_SHA256)
    assert.equal(await assertSourceFile(sourcePdf, JUNE_2026_MASTERLIST_SHA256), JUNE_2026_MASTERLIST_SHA256)
    await assert.rejects(
      assertSourceFile(sourcePdf, '0'.repeat(64)),
      /Source file SHA-256 mismatch/,
    )

    const source = await readJune2026Masterlist(sourcePdf)
    assert.equal(source.sha256, JUNE_2026_MASTERLIST_SHA256)
    assert.equal(source.title, 'Unit Chemical Inventory List')
    assert.equal(source.unitDepartment, 'ห้องเก็บสารเคมีกลุ่มงานเทคนิคการแพทย์')
    assert.equal(source.updatedLabel, 'June 2026')
    assert.equal(source.rows.length, 25)

    source.rows[0].chemicalName = 'changed by caller'
    assert.equal(JUNE_2026_MASTERLIST_ROWS[0].chemicalName, '70 % alcohol')
  }

  console.log('June 2026 chemical master list contract passed')
}

void main()
