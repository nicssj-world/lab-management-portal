import type { Test, TestDocument } from '@/lib/supabase/types'
import type { LineFlexMessage } from '@/lib/line/client'
import { htmlToPlainText } from '@/lib/html-sanitize'
import { LIST_MORE_PREFIX } from '@/lib/line/format'

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
    bodyContents.push({ type: 'text', text: `🔬 หลักการ: ${test.method}`, size: 'xs', color: '#64748B', wrap: true, margin: 'xs' })
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

// Search that matched many tests → a vertical "results menu" bubble. Each row is tappable
// (sends its code back → the single-result flow replies with the full card). "ดูเพิ่มเติม"
// carries the next page number so the stateless webhook can fetch further results.
export interface TestListOpts { page: number; perPage: number; total: number; approx: boolean; hasMore: boolean }

export function buildTestListFlex(tests: Test[], query: string, opts: TestListOpts): LineFlexMessage {
  const { page, perPage, total, approx, hasMore } = opts
  const start = page * perPage + 1
  const end = page * perPage + tests.length

  const rows: Record<string, unknown>[] = []
  tests.forEach((t, i) => {
    if (i > 0) rows.push({ type: 'separator', color: '#E5EAF0' })
    const name = t.th || t.en || t.code
    const priceText = t.price != null ? ` · 💰 ${new Intl.NumberFormat('th-TH').format(t.price)} บาท` : ''
    rows.push({
      type: 'box', layout: 'horizontal', paddingTop: 'md', paddingBottom: 'md', spacing: 'sm',
      action: { type: 'message', text: t.code },
      contents: [
        {
          type: 'box', layout: 'vertical', flex: 1, spacing: 'xs',
          contents: [
            { type: 'text', text: name, size: 'sm', weight: 'bold', color: '#0F172A', wrap: true },
            { type: 'text', text: `🔢 ${t.code}${priceText}`, size: 'xs', color: '#64748B', wrap: true },
          ],
        },
        { type: 'text', text: '›', size: 'xl', color: '#94A3B8', flex: 0, gravity: 'center', align: 'end' },
      ],
    })
  })

  const footerContents: Record<string, unknown>[] = []
  if (hasMore) {
    footerContents.push({
      type: 'button', style: 'secondary', height: 'sm',
      action: { type: 'message', label: 'ดูเพิ่มเติม', text: `${LIST_MORE_PREFIX}${page + 1}|${query}` },
    })
  }
  footerContents.push({
    type: 'text', text: `แสดง ${start}–${end} · 💬 แตะรายการเพื่อดูรายละเอียดเต็ม`,
    size: 'xxs', color: '#94A3B8', align: 'center', wrap: true,
  })

  return {
    type: 'flex',
    altText: `🔎 พบ ${total}${approx ? '+' : ''} รายการสำหรับ "${query}"`.slice(0, 400),
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: PRIMARY, paddingAll: '14px', spacing: 'xs',
        contents: [
          { type: 'text', text: `🔎 พบ ${total}${approx ? '+' : ''} รายการ`, color: '#FFFFFF', size: 'md', weight: 'bold' },
          { type: 'text', text: `"${query}"`, color: '#FFFFFFCC', size: 'xs', wrap: true },
        ],
      },
      body: { type: 'box', layout: 'vertical', paddingStart: '14px', paddingEnd: '14px', paddingTop: 'sm', paddingBottom: 'sm', contents: rows },
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px', contents: footerContents },
    },
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
