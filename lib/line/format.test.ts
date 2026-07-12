import assert from 'node:assert/strict'
import { formatTestReply } from './format'

const reply = formatTestReply({
  id: 31,
  code: '31',
  th: 'HIV-1 RNA Viral Load',
  en: 'HIV-1 RNA Viral Load (Quantitative)',
  price: 1800,
  tube: 'EDTA (ม่วง)',
  volume: '6 mL',
  tat: '7 วันทำการ',
  tat_minutes: null,
  tat_hours: null,
  available_24hr: false,
  service: 'พุธ, ศุกร์ ในเวลาราชการ',
  transport_condition: 'เก็บที่อุณหภูมิ 2–25°C ไม่ควรเกิน 24 ชั่วโมง',
  reject: 'ข้อมูลไม่ตรงกัน\nTube แตกหรือรั่ว\nปริมาณไม่เพียงพอ',
  specimen_note: null,
  contact_staff: false,
  contact_name: null,
  contact_phone: null,
} as any, [], [])

assert.match(reply, /^HIV-1 RNA Viral Load\nHIV-1 RNA Viral Load \(Quantitative\)\nรหัส E-Phis: 31/m)
assert.match(reply, /ข้อมูลหลัก\nราคา: 1,800 บาท\nสิ่งส่งตรวจ: EDTA \(ม่วง\) ปริมาตร 6 mL\nระยะเวลา: 7 วันทำการ/)
assert.match(reply, /เกณฑ์ปฏิเสธ: มี 3 ข้อ \(ดูรายละเอียดเต็ม\)/)
assert.match(reply, /ดูรายละเอียดเต็ม: https:\/\/lab\.example\.test\/catalog\/31/)
assert.doesNotMatch(reply, /⭐|🔬|💰|🧪|⛔|ข้อมูลไม่ตรงกัน/)

console.log('lib/line/format.test.ts: all assertions passed')
