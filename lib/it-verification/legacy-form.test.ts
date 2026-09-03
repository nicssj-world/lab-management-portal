import assert from 'node:assert/strict'
import test from 'node:test'
import { parseLegacyFormSheet, parseLegacyFormWorkbook } from './legacy-form'

const completedSheet = [
  ['บันทึกการตรวจสอบความถูกต้องของการส่งผ่านข้อมูลในระบบสารสนเทศ'],
  [],
  ['', 'งาน เคมีคลินิก', '', 'มกราคม-มีนาคม 2569'],
  [],
  ['ลำดับที่', 'รายละเอียดของข้อมูล', '', '', 'no.1', 'no.2'],
  [],
  ['1', 'ตรวจสอบการส่งผ่านข้อมูลจากเครื่องตรวจวิเคราะห์ -> ระบบ LIS', '', 'LAB ID', '  LN-001  ', 'LN-002'],
  [],
  ['', '', '', 'ผลการตรวจสอบYes(P) or No(X)', 'P', 'P'],
  ['2', 'ตรวจสอบการส่งผ่านข้อมูลจาก ระบบ LIS -> ระบบ HIS', '', 'ผลการตรวจสอบYes(P) or No(X)', 'P', 'P'],
]

test('legacy form parser uses folder year, maps LAB ID to LN and P to pass', () => {
  const result = parseLegacyFormSheet(completedSheet, {
    folderYear: 2026,
    quarter: 1,
    departmentCode: 'CHE',
    sourceFileName: '[CHE] Fm-QP-LAB-24-02',
  })

  assert.equal(result.year, 2026)
  assert.equal(result.quarter, 1)
  assert.equal(result.departmentCode, 'CHE')
  assert.equal(result.samples.length, 2)
  assert.deepEqual(result.samples[0], {
    ln: 'LN-001',
    sourceMonth: null,
    sourceLabSection: null,
    testName: null,
    firstSpcmAt: null,
    lastResultAt: null,
    sourceRecordCount: 0,
    samplingMethod: 'legacy_manual',
    sourceToLis: 'pass',
    lisToHis: 'pass',
    remark: '',
  })
})

test('legacy form parser warns on a sheet year mismatch without overriding the folder year', () => {
  const mismatchedSheet = completedSheet.map((row, index) => index === 2
    ? ['', 'งาน ภูมิคุ้มกันวิทยาคลินิก', '', 'มกราคม-มีนาคม 2568']
    : [...row])
  const result = parseLegacyFormSheet(mismatchedSheet, {
    folderYear: 2026,
    quarter: 1,
    departmentCode: 'IMM',
    sourceFileName: '[IMM] Fm-QP-LAB-24-02',
  })

  const mismatch = result.warnings.find((warning) => warning.includes('2568'))
  assert.ok(mismatch)
  assert.equal(result.year, 2026)
})

test('blank quarter tabs produce no samples and remain explicit no-evidence drafts', () => {
  const result = parseLegacyFormSheet([
    ['บันทึกการตรวจสอบความถูกต้องของการส่งผ่านข้อมูล'],
    ['', 'งาน เคมีคลินิก', '', 'เมษายน-มิถุนายน 2569'],
    ['', 'LAB ID'],
  ], {
    folderYear: 2026,
    quarter: 2,
    departmentCode: 'CHE',
    sourceFileName: '[CHE] Fm-QP-LAB-24-02',
  })

  assert.deepEqual(result.samples, [])
  assert.equal(result.hasEvidence, false)
  assert.match(result.warnings.join(' '), /ไม่พบรายการ LAB ID/)
})

test('workbook parser always returns all four quarter tabs', () => {
  const result = parseLegacyFormWorkbook({ Q1: completedSheet, Q2: [], Q3: [], Q4: [] }, {
    folderYear: 2026,
    departmentCode: 'CHE',
    sourceFileName: '[CHE] Fm-QP-LAB-24-02',
  })

  assert.deepEqual(result.map((quarter) => quarter.quarter), [1, 2, 3, 4])
  assert.deepEqual(result.map((quarter) => quarter.samples.length), [2, 0, 0, 0])
})

test('legacy form parser deduplicates trimmed LN values and rejects patient identifiers', () => {
  const rows = completedSheet.map((row) => [...row])
  rows[6][5] = ' LN-001 '
  const result = parseLegacyFormSheet(rows, {
    folderYear: 2026,
    quarter: 1,
    departmentCode: 'CHE',
    sourceFileName: '[CHE] Fm-QP-LAB-24-02',
  })
  assert.equal(result.samples.length, 1)
  assert.match(result.warnings.join(' '), /ซ้ำ/)

  const unsafe = completedSheet.map((row) => [...row])
  unsafe[4][1] = 'HN'
  assert.throws(() => parseLegacyFormSheet(unsafe, {
    folderYear: 2026,
    quarter: 1,
    departmentCode: 'CHE',
    sourceFileName: '[CHE] Fm-QP-LAB-24-02',
  }), /HN|ผู้ป่วย/i)
})
