import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'

function workbookBuffer(rows: Array<Record<string, unknown>>, bookType: 'xls' | 'xlsx' = 'xls') {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), '9495')
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType }))
}

async function main() {
  const importer = await import('../lib/personnel/his-training-import').catch(() => ({}))

  assert.equal(
    typeof (importer as { parseHisTrainingWorkbook?: unknown }).parseHisTrainingWorkbook,
    'function',
    'HIS training workbook parser should be available',
  )

  const parse = (importer as unknown as {
    parseHisTrainingWorkbook: (
      bytes: Buffer,
      options: { fileName: string; profile: { id: string; ephisId: string; name: string } },
    ) => {
      fileName: string
      profileId: string
      fingerprint: string
      rows: Array<Record<string, unknown>>
    }
  }).parseHisTrainingWorkbook

  const result = parse(workbookBuffer([
    {
      trnno: '680001001', title: 'อบรมคุณภาพ', place: 'รพ.ชลบุรี', plcmng: 'กลุ่มงานคุณภาพ',
      startdate: new Date(2025, 6, 2), enddate: new Date(2025, 6, 3), hournum: null, daynum: 2,
      bdgyear: 2568, trnnm: 'ไปประชุม', fname: 'สมชาย', lname: 'ใจดี', perid: '550000001',
    },
    {
      trnno: '680001002', title: 'อบรมความปลอดภัย', place: 'ออนไลน์', plcmng: 'รพ.ชลบุรี',
      startdate: new Date(2025, 7, 4), enddate: new Date(2025, 7, 4), hournum: 3.5, daynum: 1,
      bdgyear: 2568, trnnm: 'วิทยากร', fname: 'สมชาย', lname: 'ใจดี', perid: '550000001',
    },
  ]), {
    fileName: '9495.xls',
    profile: { id: 'profile-1', ephisId: '9495', name: 'นายสมชาย ใจดี' },
  })

  assert.equal(result.fileName, '9495.xls')
  assert.equal(result.profileId, 'profile-1')
  assert.match(result.fingerprint, /^[a-f0-9]{64}$/)
  assert.deepEqual(result.rows, [
    {
      key: `${result.fingerprint}:680001001`, sourceRecordId: '680001001', topic: 'อบรมคุณภาพ',
      trainingDate: '2025-07-02', trainingEndDate: '2025-07-03', hours: 16,
      provider: 'กลุ่มงานคุณภาพ', location: 'รพ.ชลบุรี', trainingType: 'in_plan',
      sourceDetails: { budgetYear: 2568, activityType: 'ไปประชุม', dayCount: 2 },
      status: 'ready', error: null,
    },
    {
      key: `${result.fingerprint}:680001002`, sourceRecordId: '680001002', topic: 'อบรมความปลอดภัย',
      trainingDate: '2025-08-04', trainingEndDate: '2025-08-04', hours: 3.5,
      provider: 'รพ.ชลบุรี', location: 'ออนไลน์', trainingType: 'in_plan',
      sourceDetails: { budgetYear: 2568, activityType: 'วิทยากร', dayCount: 1 },
      status: 'ready', error: null,
    },
  ])

  const invalid = parse(workbookBuffer([
    {
      trnno: '', title: 'ไม่มีรหัส', startdate: new Date(2025, 7, 2), enddate: new Date(2025, 7, 2),
      daynum: 1, fname: 'สมชาย', lname: 'ใจดี', perid: '550000001',
    },
    {
      trnno: '680001003', title: '', startdate: new Date(2025, 7, 2), enddate: new Date(2025, 7, 2),
      daynum: 1, fname: 'สมชาย', lname: 'ใจดี', perid: '550000001',
    },
    {
      trnno: '680001004', title: 'วันที่กลับด้าน', startdate: new Date(2025, 7, 3), enddate: new Date(2025, 7, 2),
      daynum: 1, fname: 'สมชาย', lname: 'ใจดี', perid: '550000001',
    },
  ]), {
    fileName: '9495.xls', profile: { id: 'profile-1', ephisId: '9495', name: 'สมชาย ใจดี' },
  })
  assert.deepEqual(invalid.rows.map((row) => [row.status, row.error]), [
    ['error', 'ไม่พบรหัสรายการ HIS (trnno)'],
    ['error', 'ไม่พบหัวข้อการอบรม'],
    ['error', 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม'],
  ])

  assert.throws(
    () => parse(workbookBuffer([{ trnno: '1', title: 'x', fname: 'สมชาย', lname: 'ใจดี' }]), {
      fileName: '1111.xls', profile: { id: 'profile-1', ephisId: '9495', name: 'สมชาย ใจดี' },
    }),
    /ชื่อไฟล์ไม่ตรงกับ E-Phis/,
  )
  assert.throws(
    () => parse(workbookBuffer([{ trnno: '1', title: 'x', fname: 'สมหญิง', lname: 'ใจดี' }]), {
      fileName: '9495.xls', profile: { id: 'profile-1', ephisId: '9495', name: 'สมชาย ใจดี' },
    }),
    /ชื่อบุคลากรในไฟล์ไม่ตรงกับโปรไฟล์/,
  )
  assert.throws(
    () => parse(workbookBuffer([
      { trnno: '1', title: 'x', fname: 'สมชาย', lname: 'ใจดี', perid: '1' },
      { trnno: '2', title: 'y', fname: 'สมชาย', lname: 'ใจดี', perid: '2' },
    ]), { fileName: '9495.xls', profile: { id: 'profile-1', ephisId: '9495', name: 'สมชาย ใจดี' } }),
    /มากกว่าหนึ่งบุคลากร/,
  )
  assert.throws(
    () => parse(workbookBuffer(Array.from({ length: 501 }, (_, index) => ({
      trnno: String(index + 1), title: 'x', fname: 'สมชาย', lname: 'ใจดี', perid: '1',
    }))), { fileName: '9495.xls', profile: { id: 'profile-1', ephisId: '9495', name: 'สมชาย ใจดี' } }),
    /ไม่เกิน 500 รายการ/,
  )
  assert.throws(
    () => parse(Buffer.alloc(5 * 1024 * 1024 + 1), {
      fileName: '9495.xls', profile: { id: 'profile-1', ephisId: '9495', name: 'สมชาย ใจดี' },
    }),
    /ไฟล์ต้องไม่เกิน 5 MB/,
  )
  assert.throws(
    () => parse(workbookBuffer([{ trnno: '1', title: 'x', fname: 'สมชาย', lname: 'ใจดี' }]), {
      fileName: '9495.csv', profile: { id: 'profile-1', ephisId: '9495', name: 'สมชาย ใจดี' },
    }),
    /รองรับเฉพาะไฟล์ .xls และ .xlsx/,
  )

  const repeatedSource = parse(workbookBuffer([
    { trnno: '680001010', title: 'รายการแรก', startdate: new Date(2025, 0, 1), fname: 'สมชาย', lname: 'ใจดี', perid: '1' },
    { trnno: '680001010', title: 'รายการซ้ำ', startdate: new Date(2025, 0, 2), fname: 'สมชาย', lname: 'ใจดี', perid: '1' },
  ]), { fileName: '9495.xls', profile: { id: 'profile-1', ephisId: '9495', name: 'สมชาย ใจดี' } })
  assert.deepEqual(repeatedSource.rows.map((row) => [row.status, row.error]), [
    ['ready', null],
    ['error', 'รหัสรายการ HIS ซ้ำภายในไฟล์'],
  ])

  const markDuplicates = (importer as unknown as {
    markHisTrainingDuplicates: (
      rows: typeof result.rows,
      existing: Array<Record<string, unknown>>,
    ) => typeof result.rows
  }).markHisTrainingDuplicates
  assert.equal(typeof markDuplicates, 'function', 'duplicate classifier should be available')
  const duplicateRows = markDuplicates(result.rows, [
    {
      source_record_id: '680001001', topic: 'อบรมคุณภาพ', training_date: '2025-07-02',
      training_end_date: '2025-07-03', hours: 16, provider: 'กลุ่มงานคุณภาพ', location: 'รพ.ชลบุรี',
      training_type: 'in_plan', source_details: { budgetYear: 2568, activityType: 'ไปประชุม', dayCount: 2 },
    },
    {
      source_record_id: '680001002', topic: 'ชื่อเดิมที่ต่างกัน', training_date: '2025-08-04',
      training_end_date: '2025-08-04', hours: 3.5, provider: 'รพ.ชลบุรี', location: 'ออนไลน์',
      training_type: 'in_plan', source_details: { budgetYear: 2568, activityType: 'วิทยากร', dayCount: 1 },
    },
  ])
  assert.deepEqual(duplicateRows.map((row) => [row.status, row.error]), [
    ['duplicate', 'มีรายการนี้ในระบบแล้ว'],
    ['conflict', 'รหัสรายการ HIS เดิมมีข้อมูลต่างจากไฟล์นี้'],
  ])

  console.log('personnel HIS training import tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
