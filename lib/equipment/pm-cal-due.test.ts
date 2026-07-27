import assert from 'node:assert/strict'
import { computePmCalDue } from './pm-cal-due'

// วันนี้คงที่เพื่อให้ผลลัพธ์ทดสอบซ้ำได้เสมอ
const TODAY = new Date(2026, 6, 27) // 27 กรกฎาคม 2569

type PmCalDataInput = {
  tech_group: null
  times_pm: null
  times_cal: null
  plan: Record<string, { pm: boolean; cal: boolean }>
  last_pm_date: string | null
  last_cal_date: string | null
  certificate_no: null
  error_value: null
  uncertainty: null
  cal_result: null
  remark: null
  certificate_file_url: null
}

function planData(overrides: Partial<PmCalDataInput>): PmCalDataInput {
  return {
    tech_group: null,
    times_pm: null,
    times_cal: null,
    plan: {},
    last_pm_date: null,
    last_cal_date: null,
    certificate_no: null,
    error_value: null,
    uncertainty: null,
    cal_result: null,
    remark: null,
    certificate_file_url: null,
    ...overrides,
  }
}

// ── 1. ไม่มีแผนเลย → unplanned ทั้ง pm/cal ──
{
  const due = computePmCalDue({ status: 'Active', needs_calibration: true, pm_cal_data: null }, TODAY)
  assert.equal(due.pm.state, 'unplanned')
  assert.equal(due.cal.state, 'unplanned')
  assert.equal(due.worst, 'unplanned')
}

// ── 2. ทำแล้วในเดือนที่วางแผนไว้ → ok ──
{
  const due = computePmCalDue({
    status: 'Active',
    needs_calibration: true,
    pm_cal_data: planData({
      plan: { Jul: { pm: true, cal: true } },
      last_pm_date: '2026-07-10',
      last_cal_date: '2026-07-15',
    }),
  }, TODAY)
  assert.equal(due.pm.state, 'ok')
  assert.equal(due.cal.state, 'ok')
  assert.equal(due.worst, 'ok')
}

// ── 3. ข้ามเดือนที่วางแผนไว้ (เดือนผ่านไปแล้วแต่ไม่มีวันที่ทำ) → overdue ──
{
  const due = computePmCalDue({
    status: 'Active',
    needs_calibration: true,
    pm_cal_data: planData({ plan: { Jun: { pm: true, cal: false } }, last_pm_date: null }),
  }, TODAY)
  assert.equal(due.pm.state, 'overdue')
  assert.equal(due.pm.dueMonth, 6)
  assert.equal(due.pm.dueDate, '2026-06-30')
  assert.equal(due.cal.state, 'unplanned')
  assert.equal(due.worst, 'overdue')
}

// ── 4. ครบกำหนดใน 30 วัน (ยังไม่ทำ) → due_soon ──
{
  const due = computePmCalDue({
    status: 'Active',
    needs_calibration: true,
    pm_cal_data: planData({ plan: { Jul: { pm: true, cal: false } }, last_pm_date: null }),
  }, TODAY)
  assert.equal(due.pm.state, 'due_soon')
  assert.equal(due.pm.dueMonth, 7)
  assert.equal(due.pm.dueDate, '2026-07-31')
}

// ── 5. Inactive หรือ needs_calibration=false → not_required เสมอ ไม่ว่าจะมีแผนหรือไม่ ──
{
  const inactiveWithPlan = computePmCalDue({
    status: 'Inactive',
    needs_calibration: true,
    pm_cal_data: planData({ plan: { Jun: { pm: true, cal: true } }, last_pm_date: null }),
  }, TODAY)
  assert.equal(inactiveWithPlan.pm.state, 'not_required')
  assert.equal(inactiveWithPlan.cal.state, 'not_required')
  assert.equal(inactiveWithPlan.worst, 'not_required')

  const noCalNeeded = computePmCalDue({ status: 'Active', needs_calibration: false, pm_cal_data: null }, TODAY)
  assert.equal(noCalNeeded.worst, 'not_required')
}

// ── 6. ติ๊กหลายเดือน → เอาเดือนที่แย่ที่สุด (เก่าที่สุดในบรรดาเดือนเกินกำหนด) ──
{
  const due = computePmCalDue({
    status: 'Active',
    needs_calibration: true,
    pm_cal_data: planData({
      plan: {
        May: { pm: true, cal: false },
        Jun: { pm: true, cal: false },
        Sep: { pm: true, cal: false },
      },
      last_pm_date: null,
    }),
  }, TODAY)
  assert.equal(due.pm.state, 'overdue')
  assert.equal(due.pm.dueMonth, 5, 'must pick the earliest overdue month (May), not June')
}

console.log('pm-cal-due: all cases passed')
