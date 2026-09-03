import assert from 'node:assert/strict'
import test from 'node:test'
import { parseLegacyFormSheet, type LegacyFormSheetResult } from './legacy-form'
import { buildLegacyImportPlan, legacyRunKey, resolveLegacyPlanAssignees, toLegacySampleRow } from './legacy-import'

const sourceRows = [
  ['', 'งาน เคมีคลินิก', '', 'มกราคม-มีนาคม 2569'],
  [],
  ['', '', '', 'LAB ID', 'LN-001'],
  [],
  ['', '', '', 'ผลการตรวจสอบ', 'P'],
  ['', '', '', 'ผลการตรวจสอบ', 'P'],
]

function parsed(quarter: 1 | 2 | 3 | 4): LegacyFormSheetResult {
  return parseLegacyFormSheet(quarter === 1 ? sourceRows : [], {
    folderYear: 2026,
    quarter,
    departmentCode: 'CHE',
    sourceFileName: '[CHE] Fm-QP-LAB-24-02',
  })
}

test('legacy import plan creates one draft round per quarter, including blank forms', () => {
  const plan = buildLegacyImportPlan([{
    sourceFileId: 'drive-che',
    sourceFileName: '[CHE] Fm-QP-LAB-24-02',
    responsibleName: 'สุธีมนต์',
    quarters: [parsed(1), parsed(2), parsed(3), parsed(4)],
  }])

  assert.deepEqual(plan.map((item) => item.quarter), [1, 2, 3, 4])
  assert.deepEqual(plan.map((item) => item.action), ['import', 'import', 'import', 'import'])
  assert.deepEqual(plan.map((item) => item.sampleCount), [1, 0, 0, 0])
  assert.ok(plan.every((item) => item.roundStatus === 'draft'))
  assert.ok(plan.every((item) => item.responsibleName === 'สุธีมนต์'))
  assert.match(plan[1].warning ?? '', /ไม่พบรายการ LAB ID/)
})

test('legacy import plan skips an existing form run without generating a new sample set', () => {
  const existingKey = legacyRunKey(2026, 1, 'CHE')
  const plan = buildLegacyImportPlan([{
    sourceFileId: 'drive-che',
    sourceFileName: '[CHE] Fm-QP-LAB-24-02',
    quarters: [parsed(1)],
  }], new Set([existingKey]))

  assert.equal(plan[0].action, 'skip')
  assert.equal(plan[0].runKey, existingKey)
  assert.equal(plan[0].sampleCount, 1)
})

test('legacy sample rows preserve only approved verification fields', () => {
  const sample = parsed(1).samples[0]
  assert.deepEqual(toLegacySampleRow('round-id', 'run-id', 11, sample), {
    round_id: 'round-id',
    sampling_run_id: 'run-id',
    department_id: 11,
    ln: 'LN-001',
    source_month: null,
    source_lab_section: null,
    test_name: null,
    first_spcm_at: null,
    last_result_at: null,
    source_record_count: 0,
    sampling_method: 'legacy_manual',
    lis_to_his: 'pass',
    source_to_lis: 'pass',
    remark: '',
  })
})

test('legacy import assignments repeat the sheet owner across all quarters without enforcing profile department', () => {
  const plan = buildLegacyImportPlan([{
    sourceFileId: 'drive-che',
    sourceFileName: '[CHE] Fm-QP-LAB-24-02',
    responsibleName: 'วรวุฒิ',
    quarters: [parsed(1), parsed(2), parsed(3), parsed(4)],
  }])
  const result = resolveLegacyPlanAssignees(plan, [{
    id: 'outlab-admin',
    name: 'วรวุฒิ วงษ์เจริญผล',
    dept: 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ',
    role: 'Admin',
  }])

  assert.deepEqual(result.issues, [])
  assert.equal(result.assignments.length, 4)
  assert.ok(result.assignments.every((item) => item.profileId === 'outlab-admin'))
})
