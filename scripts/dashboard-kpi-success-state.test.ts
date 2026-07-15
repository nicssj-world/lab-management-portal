import assert from 'node:assert/strict'
import { getKpiCompletionState } from '../lib/dashboard/kpi-completion'

assert.deepEqual(getKpiCompletionState(20, 20, -1), {
  isComplete: true,
  accent: '#15803D',
  badgeBackground: '#DCFCE7',
  badgeText: 'บันทึกครบ 100% แล้ว',
  successTitle: 'บันทึก KPI ครบทุกหน่วยงานแล้ว',
  successDetail: 'ข้อมูลของงวดนี้พร้อมดูในภาพรวม',
})

assert.equal(
  getKpiCompletionState(199, 200, -1).isComplete,
  false,
  'rounded display percentages must not be treated as complete when an item is still missing',
)

console.log('Dashboard KPI completion success-state tests passed')
