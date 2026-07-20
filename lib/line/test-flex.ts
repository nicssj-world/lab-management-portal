import type { Test, TestDocument } from '@/lib/supabase/types'
import type { LineFlexMessage } from '@/lib/line/client'
import { htmlToPlainText } from '@/lib/html-sanitize'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

type Doc = Pick<TestDocument, 'name' | 'doc_type'>

const PRIMARY = '#1E5FAD'  // var(--primary)
const GREY = '#94A3B8'     // muted grey for the "not found" card

// One card per query term, kept in the order the user typed them so a missing item
// shows a grey "not found" card in place rather than silently dropping out of the list.
export type BatchResult =
  | { kind: 'found'; test: Test; extraContacts: string[] }
  | { kind: 'notFound'; query: string }

// Same precedence as formatTestReply: explicit minutes label → hours → freeform tat text.
function tatLabel(test: Test): string | null {
  if (test.tat_minutes) return test.tat_minutes
  if (test.tat_hours != null) return `${test.tat_hours} ชั่วโมง`
  return test.tat ?? null
}

// A label/value line. Uses horizontal (not baseline) layout so long values wrap cleanly.
function infoRow(emoji: string, value: string): Record<string, unknown> {
  return {
    type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'sm',
    contents: [
      { type: 'text', text: emoji, size: 'sm', flex: 0 },
      { type: 'text', text: value, size: 'sm', color: '#334155', wrap: true, flex: 1 },
    ],
  }
}

interface FoundOpts { docs?: Doc[]; full?: boolean }

// A single test card. `full` (single-test reply) adds the detail the compact carousel
// card omits: method, storage, reject criteria, note, and attached documents.
function foundBubble(
  { test, extraContacts }: { test: Test; extraContacts: string[] },
  { docs = [], full = false }: FoundOpts = {},
): Record<string, unknown> {
  const name = test.th || test.en || 'รายการตรวจ'
  const rows: Record<string, unknown>[] = []

  if (test.price != null) rows.push(infoRow('💰', `${new Intl.NumberFormat('th-TH').format(test.price)} บาท`))
  if (test.tube) rows.push(infoRow('🧪', `${test.tube}${test.volume ? ` · ${test.volume}` : ''}`))
  const tat = tatLabel(test)
  if (tat) rows.push(infoRow('⏱', tat))
  if (test.available_24hr) rows.push(infoRow('🕐', 'บริการ 24 ชั่วโมง'))
  else if (test.service) rows.push(infoRow('🕐', test.service.replace(/\s*\n+\s*/g, ' ')))
  if (full && test.transport_condition) rows.push(infoRow('🌡', `การเก็บรักษา: ${test.transport_condition}`))
  if (full && test.reject) {
    const rejectCount = test.reject.split('\n').map(l => l.trim()).filter(Boolean).length
    if (rejectCount > 0) rows.push(infoRow('⛔', `เกณฑ์ปฏิเสธ: มี ${rejectCount} ข้อ (ดูรายละเอียดเต็ม)`))
  }
  if (full && test.specimen_note) rows.push(infoRow('📝', `หมายเหตุ: ${htmlToPlainText(test.specimen_note)}`))
  if (test.contact_staff) rows.push(infoRow('⚠️', 'ติดต่อเจ้าหน้าที่ก่อนเก็บตัวอย่าง'))

  // primary contact from the picked row, then any extra department contacts
  const primaryContact = [test.contact_name, test.contact_phone].filter(Boolean).join(' ')
  const contacts = [...new Set([primaryContact, ...extraContacts].filter(Boolean))]
  contacts.forEach(c => rows.push(infoRow('☎️', c)))

  const bodyContents: Record<string, unknown>[] = [
    { type: 'text', text: name, weight: 'bold', size: 'md', color: '#0F172A', wrap: true },
  ]
  if (test.en && test.en !== name) {
    bodyContents.push({ type: 'text', text: test.en, size: 'xs', color: '#64748B', wrap: true, margin: 'xs' })
  }
  if (full && test.method) {
    bodyContents.push({ type: 'text', text: `หลักการ: ${test.method}`, size: 'xs', color: '#64748B', wrap: true, margin: 'xs' })
  }
  bodyContents.push({ type: 'separator', margin: 'md', color: '#E5EAF0' })
  bodyContents.push({ type: 'box', layout: 'vertical', margin: 'md', spacing: 'none', contents: rows })

  if (full && docs.length > 0) {
    const docLines: Record<string, unknown>[] = docs.slice(0, 3).map(d => ({
      type: 'text', text: `• ${d.doc_type} - ${d.name}`, size: 'xs', color: '#334155', wrap: true,
    }))
    if (docs.length > 3) {
      docLines.push({ type: 'text', text: `และอีก ${docs.length - 3} รายการ`, size: 'xs', color: '#64748B', wrap: true })
    }
    bodyContents.push({ type: 'separator', margin: 'md', color: '#E5EAF0' })
    bodyContents.push({
      type: 'box', layout: 'vertical', margin: 'md', spacing: 'xs',
      contents: [
        { type: 'text', text: `📎 เอกสารแนบ ${docs.length} รายการ`, size: 'xs', weight: 'bold', color: '#0F172A' },
        ...docLines,
      ],
    })
  }

  const bubble: Record<string, unknown> = {
    type: 'bubble',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: PRIMARY, paddingAll: '12px',
      contents: [
        { type: 'text', text: `🔢 รหัส E-Phis: ${test.code}`, color: '#FFFFFF', size: 'sm', weight: 'bold' },
      ],
    },
    body: { type: 'box', layout: 'vertical', paddingAll: '14px', contents: bodyContents },
  }
  if (APP_URL) {
    bubble.footer = {
      type: 'box', layout: 'vertical', paddingStart: '14px', paddingEnd: '14px', paddingBottom: '14px',
      contents: [{
        type: 'button', style: 'primary', height: 'sm', color: PRIMARY,
        action: { type: 'uri', label: 'ดูรายละเอียดเต็ม', uri: `${APP_URL}/catalog/${test.id}` },
      }],
    }
  }
  return bubble
}

function notFoundBubble(query: string): Record<string, unknown> {
  return {
    type: 'bubble',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: GREY, paddingAll: '12px',
      contents: [{ type: 'text', text: 'ไม่พบรายการ', color: '#FFFFFF', size: 'sm', weight: 'bold' }],
    },
    body: {
      type: 'box', layout: 'vertical', paddingAll: '14px', spacing: 'sm',
      contents: [
        { type: 'text', text: `⚠️ "${query}"`, weight: 'bold', size: 'md', color: '#0F172A', wrap: true },
        { type: 'text', text: 'ไม่พบรายการตรวจที่ตรงกัน ลองพิมพ์ชื่อภาษาอังกฤษหรือรหัส E-Phis', size: 'xs', color: '#64748B', wrap: true, margin: 'sm' },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', paddingStart: '14px', paddingEnd: '14px', paddingBottom: '14px',
      contents: [{
        type: 'button', style: 'secondary', height: 'sm',
        // Re-sends this single term so it runs through the normal single-search flow.
        action: { type: 'message', label: 'ค้นหาใหม่', text: query },
      }],
    },
  }
}

// Single-test reply: one full-detail card (same look as the carousel cards, more fields).
export function buildTestFlex(test: Test, extraContacts: string[], docs: Doc[] = []): LineFlexMessage {
  const name = test.th || test.en || 'รายการตรวจ'
  return {
    type: 'flex',
    altText: `🧪 ${name} · รหัส E-Phis ${test.code}`.slice(0, 400),
    contents: foundBubble({ test, extraContacts }, { docs, full: true }),
  }
}

export function buildTestCarousel(results: BatchResult[]): LineFlexMessage {
  const bubbles = results.map(r => r.kind === 'found' ? foundBubble(r) : notFoundBubble(r.query))
  const foundCount = results.filter(r => r.kind === 'found').length
  const notFoundCount = results.length - foundCount
  const altText = `ผลค้นหา ${results.length} รายการ (พบ ${foundCount}${notFoundCount ? ` ไม่พบ ${notFoundCount}` : ''})`

  return {
    type: 'flex',
    altText: altText.slice(0, 400),
    contents: { type: 'carousel', contents: bubbles },
  }
}
