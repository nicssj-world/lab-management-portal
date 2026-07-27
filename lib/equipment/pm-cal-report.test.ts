import assert from 'node:assert/strict'
import { buildPmCalReport } from './pm-cal-report'

const report = buildPmCalReport({
  equipment: [
    { id: 'e1', equipment_type: 'Centrifuge', department: 'เคมีคลินิก', classification: 'Centrifuge' },
    { id: 'e2', equipment_type: 'BSC', department: 'จุลชีววิทยา', classification: 'BSC' },
  ],
  plans: [
    { id: 'p1', equipment_id: 'e1', fiscal_year: 2569, calendar_month: 7, cal_type: 'CAL', due_date: '2026-07-31', record_status: 'active', version: 1, planned_cost: 1000 },
    { id: 'p2', equipment_id: 'e2', fiscal_year: 2569, calendar_month: 6, cal_type: 'CAL', due_date: '2026-06-30', record_status: 'active', version: 1, planned_cost: 2000 },
  ],
  results: [
    { id: 'r1', plan_id: 'p1', equipment_id: 'e1', cal_type: 'CAL', completed_date: '2026-07-20', result: 'PASS', actual_cost: 900 },
    { id: 'r2', plan_id: 'p2', equipment_id: 'e2', cal_type: 'CAL', completed_date: '2026-06-25', result: 'FAIL', actual_cost: 1800 },
  ],
  today: new Date(2026, 6, 28),
})

assert.deepEqual(report.summary, { plan: 2, done: 1, failed: 1, dueSoon: 0, overdue: 0, plannedCost: 3000, actualCost: 2700 })
assert.equal(report.rows.length, 2)
assert.equal(report.rows.find(row => row.classification === 'BSC')?.failed, 1)
assert.equal(report.rows.find(row => row.classification === 'Centrifuge')?.done, 1)

console.log('pm-cal report: all cases passed')
