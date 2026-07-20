import type { Test, TestDocument } from '@/lib/supabase/types'
import { htmlToPlainText } from '@/lib/html-sanitize'

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
  if (test.specimen_note)       lines.push(`📝 หมายเหตุ: ${htmlToPlainText(test.specimen_note)}`)
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

// A "ดูเพิ่มเติม" tap on the results-menu bubble sends `<prefix><page>|<query>` back, so the
// stateless webhook can tell a paged follow-up apart from a fresh search. The bubble itself
// is built in lib/line/test-flex.ts (buildTestListFlex).
export const LIST_MORE_PREFIX = 'ดูเพิ่มเติม: '

export function formatNotFound(q: string): string {
  const hasThai = /[฀-๿]/.test(q)
  const catalogLink = APP_URL ? `\n\n🔗 ดูรายการตรวจทั้งหมด: ${APP_URL}/catalog` : ''
  return hasThai
    ? `ไม่พบรายการตรวจ "${q}"\nลองพิมพ์ชื่อภาษาอังกฤษหรือรหัสตรวจ${catalogLink}`
    : `ไม่พบรายการตรวจ "${q}"${catalogLink}`
}

// A single E-Phis code is a short numeric token (e.g. "31", "30074") — this lets us tell
// a list of codes apart from a natural-language search phrase that merely contains spaces.
export const CODE_TOKEN = /^\d{1,6}$/

// Detect a "multiple tests in one message" request and split it into individual query terms.
// Returns null when the text should be treated as a single search (the existing flow).
//  1. Comma- or newline-separated → items (names or codes), if ≥2 pieces.
//  2. Otherwise, whitespace-separated only when EVERY token is a numeric code (so "vitamin d"
//     stays a single search but "31 30074" becomes two lookups).
// Items are de-duplicated case-insensitively, preserving first-seen order. No length cap here —
// the caller slices to the carousel limit and reports any overflow.
export function parseBatchItems(text: string): string[] | null {
  const trimmed = text.trim()
  let items = trimmed.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
  if (items.length < 2) {
    const tokens = trimmed.split(/\s+/).filter(Boolean)
    if (tokens.length >= 2 && tokens.every(t => CODE_TOKEN.test(t))) {
      items = tokens
    } else {
      return null
    }
  }
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const it of items) {
    const key = it.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(it)
  }
  return deduped
}
