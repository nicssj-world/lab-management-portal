import assert from 'node:assert/strict'
import { REVIEW_ONLY_FIELDS, stripReviewOnlyFields } from './fields'
import { incidentPatchSchema, incidentReportSchema, incidentSchema } from '@/lib/validations/incident'

// ── schema ต้องตัด key ที่ไม่รู้จักทิ้ง ──────────────────────────────────────
// นี่คือสิ่งที่ปิดบั๊กเดิม: หน้ารายละเอียดเก็บ state เป็นทั้งแถวรวม actions[] ติดมาด้วย
// แล้ว PATCH ทั้งก้อน ระบบเดิมใช้ z.record จึงปล่อยผ่าน ทำให้ยิงคอลัมน์ที่ไม่มีจริงเข้า DB
const patched = incidentPatchSchema.parse({
  event_detail: 'ตัวอย่างหก',
  actions: [{ id: 1, description: 'x' }],
  id: 99,
  created_at: '2026-01-01T00:00:00Z',
  legacy_risk_id: 5,
})
assert.deepEqual(Object.keys(patched), ['event_detail'])
assert.ok(!('actions' in patched), 'actions ต้องไม่หลุดเข้า payload')
assert.ok(!('id' in patched), 'id ต้องไม่หลุดเข้า payload')

// ── ฟอร์มของเจ้าหน้าที่ทั่วไปต้องไม่รับฟิลด์เชิงคุณภาพ ─────────────────────
const reported = incidentReportSchema.parse({
  event_date: '2026-07-20',
  department_found: 'งานเคมีคลินิก',
  event_category: 'สิ่งส่งตรวจ clot',
  event_detail: 'พบลิ่มเลือดในหลอด',
  severity_level: 'I',      // ผู้รายงานกำหนดเองไม่ได้
  status: 'closed',         // ปิดเรื่องเองไม่ได้
  root_cause: 'มั่ว',        // สรุปสาเหตุเองไม่ได้
})
assert.ok(!('severity_level' in reported), 'ผู้รายงานต้องกำหนดระดับความรุนแรงเองไม่ได้')
assert.ok(!('status' in reported), 'ผู้รายงานต้องกำหนดสถานะเองไม่ได้')
assert.ok(!('root_cause' in reported), 'ผู้รายงานต้องสรุปรากของปัญหาเองไม่ได้')
assert.equal(reported.event_detail, 'พบลิ่มเลือดในหลอด')

// ── บันทึกแทนผู้รายงาน (คนโทรมาแจ้ง / ส่งใบกระดาษ) ─────────────────────────
// schema รับชื่อได้ แต่ route เป็นคนตัดสินว่าใครใส่ชื่อคนอื่นได้จริง
const onBehalf = incidentReportSchema.parse({
  event_date: '2026-07-20',
  department_found: 'งานเคมีคลินิก',
  event_category: 'สิ่งส่งตรวจ clot',
  event_detail: 'พบลิ่มเลือดในหลอด',
  reporter_name: 'สมชาย ใจดี',
})
assert.equal(onBehalf.reporter_name, 'สมชาย ใจดี')

// ช่องว่างล้วนต้องไม่กลายเป็นชื่อ — ไม่งั้นได้เรื่องที่ผู้รายงานเป็นสตริงว่าง
const blankName = incidentReportSchema.parse({
  event_date: '2026-07-20',
  department_found: 'งานเคมีคลินิก',
  event_category: 'สิ่งส่งตรวจ clot',
  event_detail: 'พบลิ่มเลือดในหลอด',
  reporter_name: '   ',
})
assert.equal(blankName.reporter_name, '', 'zod trim แล้วเหลือค่าว่าง route ต้อง fallback เป็นชื่อจาก session')

// ── ข้อบังคับของฟอร์มรายงาน ────────────────────────────────────────────────
const missingDetail = incidentReportSchema.safeParse({
  event_date: '2026-07-20',
  department_found: 'งานเคมีคลินิก',
  event_category: 'สิ่งส่งตรวจ clot',
  event_detail: '   ',
})
assert.equal(missingDetail.success, false)

const badDate = incidentReportSchema.safeParse({
  event_date: '20/07/2569',
  department_found: 'งานเคมีคลินิก',
  event_category: 'สิ่งส่งตรวจ clot',
  event_detail: 'ทดสอบ',
})
assert.equal(badDate.success, false, 'วันที่ต้องเป็น YYYY-MM-DD เท่านั้น')

// ── ระดับความรุนแรงต้องอยู่ในช่วง A–I ──────────────────────────────────────
assert.equal(incidentSchema.safeParse({ event_date: '2026-07-20', event_detail: 'x', severity_level: 'J' }).success, false)
assert.equal(incidentSchema.safeParse({ event_date: '2026-07-20', event_detail: 'x', severity_level: 'D' }).success, true)

// ── stripReviewOnlyFields ───────────────────────────────────────────────────
// ผู้มีสิทธิ์ทบทวน: ผ่านทั้งหมด ไม่มีคำเตือน
const asReviewer = stripReviewOnlyFields(
  { event_detail: 'ก', severity_level: 'D', root_cause: 'ข' },
  true,
)
assert.deepEqual(asReviewer.payload, { event_detail: 'ก', severity_level: 'D', root_cause: 'ข' })
assert.deepEqual(asReviewer.warnings, [])

// ผู้มีสิทธิ์แค่แก้ไข: เก็บเฉพาะข้อเท็จจริง ตัดส่วนตัดสินใจออก พร้อมบอกว่าตัดอะไรไป
const asEditor = stripReviewOnlyFields(
  { event_detail: 'ก', severity_level: 'D', root_cause: 'ข', status: 'closed' },
  false,
)
assert.deepEqual(asEditor.payload, { event_detail: 'ก' })
assert.equal(asEditor.warnings.length, 1)
assert.match(asEditor.warnings[0], /severity_level/)

// ไม่มีฟิลด์เชิงทบทวนอยู่แล้ว = ไม่ต้องเตือนอะไร
const nothingToStrip = stripReviewOnlyFields({ event_detail: 'ก' }, false)
assert.deepEqual(nothingToStrip.payload, { event_detail: 'ก' })
assert.deepEqual(nothingToStrip.warnings, [])

// ต้องไม่แก้ object เดิมที่ส่งเข้ามา
const original = { event_detail: 'ก', severity_level: 'D' }
stripReviewOnlyFields(original, false)
assert.equal(original.severity_level, 'D', 'ต้องไม่กลายพันธุ์ object ต้นทาง')

// ทุกฟิลด์ในรายการต้องถูกตัดจริงเมื่อไม่มีสิทธิ์
const everything = Object.fromEntries(REVIEW_ONLY_FIELDS.map(f => [f, 'x']))
assert.deepEqual(stripReviewOnlyFields(everything, false).payload, {})

console.log('incident tests passed')
