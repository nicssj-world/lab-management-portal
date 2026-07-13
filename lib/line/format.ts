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
  // test.service can contain an embedded line break (e.g. "ในเวลาราชการ\n08.00–16.00น.") —
  // collapse it to one line so the time range doesn't render as an orphaned unlabeled line.
  else if (test.service)        lines.push(`เวลาบริการ: ${test.service.replace(/\s*\n+\s*/g, ' ')}`)
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

// Follow-up "แสดงเพิ่มเติม" quick replies send this prefix + the original query back,
// so the stateless webhook can tell a page-2 request apart from a fresh search.
export const LIST_MORE_PREFIX = 'ดูเพิ่มเติม: '
const PAGE_SIZE = 5

export function formatListReply(tests: Test[], start = 0): string {
  const page = tests.slice(start, start + PAGE_SIZE)
  const items = page
    .map((t, i) => {
      const primary = t.th || t.en
      // Search matches th/en/code/cgd/loinc, but only th (often just the short abbreviation,
      // e.g. "HbA1C") is shown by default — append the full en name when it differs, so a
      // match found only in the full name (e.g. searching "hemo" → "Hemoglobin A1c") isn't a mystery.
      const name = t.en && t.en !== primary ? `${primary} — ${t.en}` : primary
      const methodLine = t.method ? `\n🔬 ${t.method}` : ''
      return `${start + i + 1}. ${name}${methodLine}\n🔢 รหัส E-Phis: ${t.code}`
    })
    .join('\n\n')
  const example = page[0]?.code ?? ''
  const remaining = tests.length - (start + page.length)
  const rangeLabel = tests.length > page.length
    ? ` (แสดงรายการที่ ${start + 1}-${start + page.length})`
    : ''
  const moreHint = remaining > 0 ? `\n\n➕ ยังมีอีก ${remaining} รายการ กดปุ่ม "ดูเพิ่มเติม" ด้านล่าง` : ''
  return `🔎 พบ ${tests.length} รายการ${rangeLabel}\n\n${items}${moreHint}\n\n💬 พิมพ์รหัส E-Phis เพื่อดูรายละเอียด${example ? ` เช่น ${example}` : ''}`
}

export function buildListMoreQuickReply(query: string, remaining: number) {
  return {
    items: [{
      type: 'action' as const,
      action: { type: 'message' as const, label: `ดูเพิ่มเติม (${remaining})`, text: `${LIST_MORE_PREFIX}${query}` },
    }],
  }
}

export function formatNotFound(q: string): string {
  const hasThai = /[฀-๿]/.test(q)
  const catalogLink = APP_URL ? `\n\n🔗 ดูรายการตรวจทั้งหมด: ${APP_URL}/catalog` : ''
  return hasThai
    ? `ไม่พบรายการตรวจ "${q}"\nลองพิมพ์ชื่อภาษาอังกฤษหรือรหัสตรวจ${catalogLink}`
    : `ไม่พบรายการตรวจ "${q}"${catalogLink}`
}
