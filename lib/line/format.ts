import type { Test, TestDocument } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export function formatTestReply(
  test: Test,
  docs: Pick<TestDocument, 'name' | 'doc_type'>[] = [],
  extraContacts: string[] = [],
): string {
  const lines: string[] = []
  const title = test.th || test.en || 'รายละเอียดรายการตรวจ'
  lines.push(`🧪 ${title}`)
  if (test.en && test.en !== title) lines.push(test.en)
  if (test.method) lines.push(`หลักการ: ${test.method}`)
  lines.push(`🔢 รหัส E-Phis: ${test.code}`)
  lines.push('')
  lines.push('📋 ข้อมูลหลัก')
  if (test.price != null)       lines.push(`ราคา: ${new Intl.NumberFormat('th-TH').format(test.price)} บาท`)
  if (test.tube)                lines.push(`สิ่งส่งตรวจ: ${test.tube}${test.volume ? ` ปริมาตร ${test.volume}` : ''}`)
  const tat = test.tat_minutes ?? (test.tat_hours != null ? `${test.tat_hours} ชั่วโมง` : test.tat)
  if (tat)                      lines.push(`ระยะเวลา: ${tat}`)
  if (test.available_24hr)      lines.push('เวลาบริการ: 24 ชั่วโมง')
  else if (test.service)        lines.push(`เวลาบริการ: ${test.service}`)
  if (test.transport_condition) lines.push(`การเก็บรักษา: ${test.transport_condition}`)
  if (test.reject) {
    const rejectCount = test.reject.split('\n').map(line => line.trim()).filter(Boolean).length
    if (rejectCount > 0) lines.push(`⛔ เกณฑ์ปฏิเสธ: มี ${rejectCount} ข้อ (ดูรายละเอียดเต็ม)`)
  }
  // collect contacts from primary row + duplicate rows, deduplicated
  const primaryContact = [test.contact_name, test.contact_phone].filter(Boolean).join(' ')
  const allContacts = [...new Set([primaryContact, ...extraContacts].filter(Boolean))]
  if (test.specimen_note || test.contact_staff || allContacts.length > 0) lines.push('')
  if (test.specimen_note)       lines.push(`📝 หมายเหตุ: ${test.specimen_note}`)
  if (test.contact_staff)       lines.push('☎️ ติดต่อเจ้าหน้าที่ก่อนเก็บตัวอย่าง')
  allContacts.forEach(c => lines.push(`☎️ ติดต่อ: ${c}`))
  if (docs.length > 0) {
    lines.push('')
    lines.push(`📎 เอกสารแนบ: ${docs.length} รายการ`)
    docs.slice(0, 3).forEach(d => lines.push(`- ${d.doc_type} - ${d.name}`))
    if (docs.length > 3) lines.push(`และอีก ${docs.length - 3} รายการ`)
  }
  if (APP_URL) {
    lines.push('')
    lines.push(`🔗 ดูรายละเอียดเต็ม: ${APP_URL}/catalog/${test.id}`)
  }
  return lines.join('\n')
}

export function formatListReply(tests: Test[]): string {
  const shown = tests.slice(0, 5)
  const items = shown
    .map((t, i) => {
      const methodLine = t.method ? `\n   หลักการ: ${t.method}` : ''
      return `${i + 1}. ${t.th || t.en}${methodLine}\n   🔢 รหัส E-Phis: ${t.code}`
    })
    .join('\n')
  const example = shown[0]?.code ?? ''
  const shownLabel = tests.length > shown.length ? ` (แสดง ${shown.length} รายการแรก)` : ''
  return `🔎 พบ ${tests.length} รายการ${shownLabel}:\n\n${items}\n\n💬 พิมพ์รหัส E-Phis เพื่อดูรายละเอียด${example ? ` เช่น ${example}` : ''}`
}

export function formatNotFound(q: string): string {
  const hasThai = /[฀-๿]/.test(q)
  return hasThai
    ? `ไม่พบรายการตรวจ "${q}"\nลองพิมพ์ชื่อภาษาอังกฤษหรือรหัสตรวจ`
    : `ไม่พบรายการตรวจ "${q}"`
}
