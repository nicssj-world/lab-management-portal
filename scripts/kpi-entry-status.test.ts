import assert from 'node:assert/strict'
import * as kpi from '../lib/queries/kpi'

type EntryStatusBuilder = (
  depts: Array<{ id: number; code: string; name_th: string }>,
  defs: Array<{ id: number }>,
  entries: Array<{ dept_id: number; kpi_id: number; month: number; numerator: number | null }>,
  exclusions: ReadonlySet<string>,
) => Array<{ dept_id: number; months: Record<number, { filled: number; required: number }> }>

const buildEntryStatus = (kpi as unknown as { buildEntryStatus?: EntryStatusBuilder }).buildEntryStatus
assert.equal(typeof buildEntryStatus, 'function', 'KPI status calculation should be available as a testable pure helper')

const result = buildEntryStatus!(
  [{ id: 18, code: 'OUT', name_th: 'OUT LAB' }],
  Array.from({ length: 13 }, (_, index) => ({ id: index + 1 })),
  [
    { dept_id: 18, kpi_id: 1, month: 11, numerator: 1041 },
    { dept_id: 18, kpi_id: 5, month: 11, numerator: 0 },
    { dept_id: 18, kpi_id: 7, month: 11, numerator: 0 },
    { dept_id: 18, kpi_id: 8, month: 11, numerator: 0 },
    { dept_id: 18, kpi_id: 9, month: 11, numerator: 0 },
    { dept_id: 18, kpi_id: 12, month: 11, numerator: 0 },
    { dept_id: 18, kpi_id: 13, month: 11, numerator: 0 },
    { dept_id: 18, kpi_id: 6, month: 11, numerator: 0 }, // excluded RISK_BLOOD; must not count
  ],
  new Set(['18|2', '18|3', '18|4', '18|6']),
)

assert.deepEqual(result[0].months[11], { filled: 7, required: 9 }, 'OUT LAB Nov 2569 should not count a saved excluded KPI')

console.log('KPI entry status tests passed')
