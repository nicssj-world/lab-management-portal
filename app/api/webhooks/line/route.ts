import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getTests } from '@/lib/queries/tests'
import type { Test } from '@/lib/supabase/types'
import { verifyLineSignature, replyMessage, type LineMessage } from '@/lib/line/client'
import { formatTestReply, formatListReply, formatNotFound, buildListMoreQuickReply, LIST_MORE_PREFIX, parseBatchItems, CODE_TOKEN } from '@/lib/line/format'
import { buildTestCarousel, type BatchResult } from '@/lib/line/test-flex'

const BATCH_CARD_LIMIT = 12  // LINE Flex carousel holds at most 12 bubbles

export async function GET() {
  return NextResponse.json({ ok: true })
}

// among rows sharing a code, prefer the row from a "main" department (anything
// other than ศูนย์สุขภาพชุมชนเมืองชลบุรี) as the primary contact/link target
function pickPrimaryRow<T extends { contact_name?: string | null }>(rows: T[]): T {
  return rows.find(r => !(r.contact_name ?? '').includes('ศูนย์สุขภาพชุมชนเมืองชลบุรี')) ?? rows[0]
}

// rows sharing a code = same catalog entry with multiple department contacts: pick a
// primary row and collect the other departments' contacts as extra lines.
function toTestResult(rows: Test[]): { primary: Test; extraContacts: string[] } {
  const primary = pickPrimaryRow(rows)
  const extraContacts = rows.filter(t => t !== primary)
    .map(t => [t.contact_name, t.contact_phone].filter(Boolean).join(' '))
    .filter(Boolean)
  return { primary, extraContacts }
}

// dedupe by id, then group by code (preserving first-seen order) — the tests table has
// multiple rows per code across categories.
function groupTestRows(rawData: Test[]): Test[][] {
  const seenIds = new Set<number>()
  const groups = new Map<string, Test[]>()
  for (const t of rawData) {
    if (seenIds.has(t.id)) continue
    seenIds.add(t.id)
    const group = groups.get(t.code)
    if (group) group.push(t)
    else groups.set(t.code, [t])
  }
  return [...groups.values()]
}

// Resolve each term of a multi-test message, keeping the user's original order so the
// carousel can show a "not found" card in place. Numeric codes are looked up in a single
// batched query; name terms fall back to the same search the single-message flow uses.
async function resolveBatch(items: string[]): Promise<BatchResult[]> {
  const codeItems = items.filter(i => CODE_TOKEN.test(i))
  const codeMap = new Map<string, Test[]>()
  if (codeItems.length > 0) {
    const codes = [...new Set(codeItems.map(c => c.toUpperCase()))]
    const { data } = await supabaseAdmin.from('tests').select('*').in('code', codes).eq('active', true)
    for (const row of (data ?? []) as Test[]) {
      const group = codeMap.get(row.code)
      if (group) group.push(row)
      else codeMap.set(row.code, [row])
    }
  }

  const results: BatchResult[] = []
  for (const item of items) {
    let rows: Test[] | undefined
    if (CODE_TOKEN.test(item)) {
      rows = codeMap.get(item.toUpperCase())
    } else {
      const { data: rawData } = await getTests(supabaseAdmin, { search: item, active: true, pageSize: 20 })
      rows = groupTestRows(rawData)[0]
    }
    if (rows && rows.length > 0) {
      const { primary, extraContacts } = toTestResult(rows)
      results.push({ kind: 'found', test: primary, extraContacts })
    } else {
      results.push({ kind: 'notFound', query: item })
    }
  }
  return results
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('x-line-signature') ?? ''
  if (!verifyLineSignature(rawBody, sig))
    return new NextResponse('Unauthorized', { status: 401 })

  let body: { events?: unknown[] }
  try { body = JSON.parse(rawBody) } catch { return NextResponse.json({ ok: true }) }

  for (const ev of body.events ?? []) {
    const event = ev as Record<string, unknown>
    if (event.type !== 'message') continue
    const msg = event.message as Record<string, unknown> | undefined
    if (msg?.type !== 'text') continue
    const q = (msg.text as string).trim()
    const replyToken = event.replyToken as string
    // A "ดูเพิ่มเติม" quick-reply sends the marker prefix + original query back — the
    // webhook is stateless per request, so page 2 is just re-running the same search
    // and slicing further in rather than tracking any session state.
    const isMoreRequest = q.startsWith(LIST_MORE_PREFIX)
    const searchQuery = isMoreRequest ? q.slice(LIST_MORE_PREFIX.length).trim() : q

    try {
      // batch: user typed several tests in one message (comma/newline separated, or
      // whitespace-separated numeric codes) → reply with one Flex carousel of cards.
      // Skipped for a "more" follow-up, which only ever continues a prior list search.
      if (!isMoreRequest) {
        const items = parseBatchItems(q)
        if (items) {
          const capped = items.slice(0, BATCH_CARD_LIMIT)
          const overflow = items.length - capped.length
          const results = await resolveBatch(capped)
          const messages: LineMessage[] = [buildTestCarousel(results)]
          if (overflow > 0) {
            messages.push({ type: 'text', text: `แสดง ${BATCH_CARD_LIMIT} รายการแรก — ยังมีอีก ${overflow} รายการ พิมพ์แยกเพื่อดูเพิ่มเติม` })
          }
          await replyMessage(replyToken, messages)
          continue
        }
      }

      // exact code match — fetch all rows with same code to collect all contacts.
      // Skipped for a "more" follow-up: that only ever continues a prior list search.
      if (!isMoreRequest) {
        const { data: exactRows } = await supabaseAdmin
          .from('tests')
          .select('*')
          .eq('code', q.toUpperCase())
          .eq('active', true)

        if (exactRows && exactRows.length > 0) {
          const { primary, extraContacts } = toTestResult(exactRows)
          const { data: docs } = await supabaseAdmin
            .from('test_documents')
            .select('name, doc_type')
            .eq('test_id', primary.id)
          await replyMessage(replyToken, [{ type: 'text', text: formatTestReply(primary, docs ?? [], extraContacts) }])
          continue
        }
      }

      const { data: rawData } = await getTests(supabaseAdmin, { search: searchQuery, active: true, pageSize: 20 })
      const data = groupTestRows(rawData).slice(0, 10)

      if (data.length === 1) {
        const { primary, extraContacts } = toTestResult(data[0])
        const { data: docs } = await supabaseAdmin
          .from('test_documents')
          .select('name, doc_type')
          .eq('test_id', primary.id)
        await replyMessage(replyToken, [{ type: 'text', text: formatTestReply(primary, docs ?? [], extraContacts) }])
      } else if (data.length > 1) {
        const tests = data.map(rows => rows[0])
        if (isMoreRequest) {
          await replyMessage(replyToken, [{ type: 'text', text: formatListReply(tests, 5) }])
        } else {
          const remaining = tests.length - 5
          const quickReply = remaining > 0 ? buildListMoreQuickReply(searchQuery, remaining) : undefined
          await replyMessage(replyToken, [{ type: 'text', text: formatListReply(tests, 0), ...(quickReply ? { quickReply } : {}) }])
        }
      } else {
        await replyMessage(replyToken, [{ type: 'text', text: formatNotFound(searchQuery) }])
      }
    } catch (err) {
      // always return 200 so LINE doesn't retry — still log so a failure isn't invisible
      console.error('LINE webhook event failed', { query: q, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ ok: true })
}
