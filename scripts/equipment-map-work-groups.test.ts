import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

const modulePath = '../lib/equipment-map/walk-groups'
assert.ok(
  existsSync('lib/equipment-map/walk-groups.ts'),
  'the mobile picker needs one authoritative partition so grouped areas cannot also appear as standalone options',
)

const { groupEquipmentWalkAreas } = require(modulePath) as {
  groupEquipmentWalkAreas: <T extends { area: { code: string }; total: number; unsurveyed: number; overdue: number; dueSoon: number }>(items: readonly T[]) => {
    groups: readonly { code: string; items: readonly T[]; summary: null | { selectionCode: string; nameTh: string; total: number; unsurveyed: number; overdue: number; dueSoon: number } }[]
    standalone: readonly T[]
  }
}

const items = [
  { area: { code: 'zone-special-testing' }, marker: 'outlab-container', total: 9, unsurveyed: 7, overdue: 5, dueSoon: 4 },
  { area: { code: 'zone-special-testing-upper-1' }, marker: 'outlab-1', total: 2, unsurveyed: 1, overdue: 1, dueSoon: 0 },
  { area: { code: 'zone-special-testing-upper-2' }, marker: 'outlab-2', total: 3, unsurveyed: 2, overdue: 0, dueSoon: 1 },
  { area: { code: 'zone-blood-bank' }, marker: 'blood-bank', total: 4, unsurveyed: 3, overdue: 1, dueSoon: 1 },
  { area: { code: 'zone-special-testing-lower' }, marker: 'crossmatch', total: 1, unsurveyed: 1, overdue: 0, dueSoon: 0 },
  { area: { code: 'room-nw-corner' }, marker: 'standalone-northwest', total: 0, unsurveyed: 0, overdue: 0, dueSoon: 0 },
  { area: { code: 'room-centre-upper' }, marker: 'standalone-centre', total: 0, unsurveyed: 0, overdue: 0, dueSoon: 0 },
  { area: { code: 'zone-equipment-wash' }, marker: 'standalone', total: 0, unsurveyed: 0, overdue: 0, dueSoon: 0 },
]
const result = groupEquipmentWalkAreas(items)

assert.deepEqual(
  result.groups.find((group) => group.code === 'outlab')?.items.map((item) => item.area.code),
  ['zone-special-testing-upper-1', 'zone-special-testing-upper-2'],
  'OUTLAB must be grouped by its canonical area code even if per-area metadata is stale or absent',
)
assert.deepEqual(
  result.groups.find((group) => group.code === 'blood-bank')?.items.map((item) => item.area.code),
  ['zone-blood-bank', 'zone-special-testing-lower'],
  'blood-bank areas must be grouped by their canonical area codes',
)
assert.deepEqual(
  result.groups.find((group) => group.code === 'outlab')?.summary,
  { selectionCode: 'work-group:outlab', nameTh: 'งาน OUTLAB', total: 5, unsurveyed: 3, overdue: 1, dueSoon: 1 },
  'OUTLAB must have a synthetic whole-work summary calculated only from its two inspection zones',
)
assert.deepEqual(
  result.groups.find((group) => group.code === 'blood-bank')?.summary,
  { selectionCode: 'work-group:blood-bank', nameTh: 'งานคลังเลือด', total: 5, unsurveyed: 4, overdue: 1, dueSoon: 1 },
  'blood bank must have a synthetic whole-work summary across its canonical inspection areas',
)
assert.deepEqual(
  result.standalone.map((item) => item.area.code),
  ['room-nw-corner', 'room-centre-upper', 'zone-equipment-wash'],
  'only areas outside every canonical work group may appear in the standalone section',
)

const groupedCodes = new Set(result.groups.flatMap((group) => group.items.map((item) => item.area.code)))
assert.equal(
  result.standalone.some((item) => groupedCodes.has(item.area.code)),
  false,
  'no area may appear in both a work group and the standalone section',
)
assert.equal(
  result.standalone.some((item) => item.area.code === 'zone-special-testing'),
  false,
  'the OUTLAB map container must not reappear as a standalone inspection option',
)
assert.equal(
  result.groups.find((group) => group.code === 'outlab')?.items.some((item) => item.area.code === 'zone-special-testing'),
  false,
  'the OUTLAB map container must not be selectable because its geometric count also contains blood-bank zones',
)

console.log('equipment map work-group partition passed')
