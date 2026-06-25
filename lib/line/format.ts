import type { Test, TestDocument } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export function formatTestReply(test: Test, docs: Pick<TestDocument, 'name' | 'doc_type'>[] = []): string {
  const lines: string[] = []
  lines.push(`⭐ รหัส E-Phis: ${test.code}`)
  lines.push(`🔬 ${test.th}${test.en ? ` (${test.en})` : ''}`)
  if (test.price != null)       lines.push(`💰 ราคา: ${test.price} บาท`)
  if (test.tube)                lines.push(`🧪 สิ่งส่งตรวจ: ${test.tube}${test.volume ? ` ปริมาตร ${test.volume}` : ''}`)
  const tat = test.tat_minutes ?? (test.tat_hours != null ? `${test.tat_hours} ชั่วโมง` : test.tat)
  if (tat)                      lines.push(`⏱ ระยะเวลา (TAT): ${tat}`)
  if (test.available_24hr)      lines.push(`🕐 เวลาให้บริการ: 24 ชั่วโมง`)
  else if (test.service)        lines.push(`🕐 เวลาให้บริการ: ${test.service}`)
  if (test.transport_condition) lines.push(`📋 การเก็บรักษาตัวอย่างก่อนนำส่ง: ${test.transport_condition}`)
  if (test.reject) {
    const rejectLines = test.reject.split('\n').map(l => `   ${l.trim()}`).filter(l => l.trim())
    lines.push(`⛔ เกณฑ์ปฏิเสธ:\n${rejectLines.join('\n')}`)
  }
  if (test.specimen_note)       lines.push(`📝 หมายเหตุ: ${test.specimen_note}`)
  if (test.contact_staff)       lines.push(`⚠️ ติดต่อเจ้าหน้าที่ก่อนเก็บตัวอย่าง`)
  if (test.contact_name || test.contact_phone)
    lines.push(`☎️ ติดต่อ: ${[test.contact_name, test.contact_phone].filter(Boolean).join(' ')}`)
  if (docs.length > 0) {
    lines.push(`📎 เอกสารแนบ (${docs.length} รายการ):`)
    docs.forEach(d => lines.push(`  • ${d.doc_type} - ${d.name}`))
  }
  if (APP_URL)                  lines.push(`🔗 ${APP_URL}/catalog/${test.id}`)
  return lines.join('\n')
}

const NUMBER_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']

export function formatListReply(tests: Test[]): string {
  const shown = tests.slice(0, 10)
  const items = shown
    .map((t, i) => `${NUMBER_EMOJI[i]} ${t.th || t.en}\n   ⭐ รหัส E-Phis: ${t.code}`)
    .join('\n')
  const example = shown[0]?.code ?? ''
  return `🔍 พบ ${tests.length} รายการ:\n\n${items}\n\n💬 พิมพ์รหัส E-Phis เพื่อดูรายละเอียด${example ? ` เช่น ${example}` : ''}`
}

export function formatNotFound(q: string): string {
  const hasThai = /[฀-๿]/.test(q)
  return hasThai
    ? `ไม่พบรายการตรวจ "${q}"\nลองพิมพ์ชื่อภาษาอังกฤษหรือรหัสตรวจ`
    : `ไม่พบรายการตรวจ "${q}"`
}
