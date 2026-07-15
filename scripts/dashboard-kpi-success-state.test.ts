import assert from 'node:assert/strict'
import { getKpiCompletionState, getKpiProgressColor } from '../lib/dashboard/kpi-completion'

assert.deepEqual(getKpiCompletionState(20, 20, -1), {
  isComplete: true,
  accent: '#15803D',
  badgeBackground: '#DCFCE7',
  badgeText: 'บันทึกครบ 100% แล้ว',
  successTitle: 'บันทึก KPI ครบทุกงานแล้ว',
  successDetail: 'ข้อมูลของงวดนี้พร้อมดูในภาพรวม',
})

assert.equal(
  getKpiCompletionState(199, 200, -1).isComplete,
  false,
  'rounded display percentages must not be treated as complete when an item is still missing',
)

assert.equal(getKpiProgressColor(49), '#DC2626', 'under 50% should be red')
assert.equal(getKpiProgressColor(50), '#D97706', '50–79% should be amber')
assert.equal(getKpiProgressColor(79), '#D97706', '50–79% should stay amber')
assert.equal(getKpiProgressColor(80), '#1E5FAD', '80–99% should be blue')
assert.equal(getKpiProgressColor(99), '#1E5FAD', 'incomplete rows should not use green')
assert.equal(getKpiProgressColor(100), '#15803D', 'complete overall progress should be green')

console.log('Dashboard KPI completion success-state tests passed')
