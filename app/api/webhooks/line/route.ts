import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getTests } from '@/lib/queries/tests'
import type { Test } from '@/lib/supabase/types'
import { verifyLineSignature, replyMessage, type LineMessage } from '@/lib/line/client'
import { formatNotFound, LIST_MORE_PREFIX, parseBatchItems, CODE_TOKEN } from '@/lib/line/format'
import { buildTestFlex, buildTestCarousel, buildTestListFlex, type BatchResult } from '@/lib/line/test-flex'

const BATCH_CARD_LIMIT = 12  // LINE Flex carousel holds at most 12 bubbles
const LIST_PER_PAGE = 10     // results-menu rows shown per page
const LIST_FETCH = 200       // rows pulled once, then grouped by code and paginated in memory

export async function GET() {
  return NextResponse.json({ ok: true })
}

// anything other than ศูนย์สุขภาพชุมชนเมืองชลบุรี counts as a "main" department
function isMainDeptRow(row: { contact_name?: string | null } | undefined): boolean {
  return !(row?.contact_name ?? '').includes('ศูนย์สุขภาพชุมชนเมืองชลบุรี')
}

// among rows sharing a code, prefer the row from a "main" department as the primary
// contact/link target
function pickPrimaryRow<T extends { contact_name?: string | null }>(rows: T[]): T {
  return rows.find(isMainDeptRow) ?? rows[0]
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
// multiple rows per code across categories. Distinct codes matching the same search term
// (e.g. glucose under two different departments) are then reordered so any group backed by
// a main department sorts ahead of a ศูนย์สุขภาพชุมชนเมืองชลบุรี-only group; order within
// each tier is otherwise unchanged (stable sort).
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
  return [...groups.values()].sort(
    (a, b) => Number(!isMainDeptRow(pickPrimaryRow(a))) - Number(!isMainDeptRow(pickPrimaryRow(b))),
  )
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
    // A "ดูเพิ่มเติม" tap sends `<prefix><page>|<query>` back. The webhook is stateless, so
    // it just re-runs the search and returns the requested page of grouped results.
    const isMoreRequest = q.startsWith(LIST_MORE_PREFIX)
    let searchQuery = q
    let searchPage = 0
    if (isMoreRequest) {
      const rest = q.slice(LIST_MORE_PREFIX.length)
      const sep = rest.indexOf('|')
      if (sep >= 0) {
        searchPage = Math.max(0, parseInt(rest.slice(0, sep), 10) || 0)
        searchQuery = rest.slice(sep + 1).trim()
      } else {
        searchQuery = rest.trim()
      }
    }

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
          await replyMessage(replyToken, [buildTestFlex(primary, extraContacts, docs ?? [])])
          continue
        }
      }

      const { data: rawData, count } = await getTests(supabaseAdmin, { search: searchQuery, active: true, pageSize: LIST_FETCH })
      const groups = groupTestRows(rawData)
      // fetched rows hit the cap → more codes may exist beyond what we grouped
      const approx = count > rawData.length

      if (groups.length === 1) {
        const { primary, extraContacts } = toTestResult(groups[0])
        const { data: docs } = await supabaseAdmin
          .from('test_documents')
          .select('name, doc_type')
          .eq('test_id', primary.id)
        await replyMessage(replyToken, [buildTestFlex(primary, extraContacts, docs ?? [])])
      } else if (groups.length > 1) {
        const pageGroups = groups.slice(searchPage * LIST_PER_PAGE, searchPage * LIST_PER_PAGE + LIST_PER_PAGE)
        // a stale "more" tap could land past the end → fall back to the first page
        const safePage = pageGroups.length > 0 ? searchPage : 0
        const shown = pageGroups.length > 0 ? pageGroups : groups.slice(0, LIST_PER_PAGE)
        const tests = shown.map(rows => rows[0])
        const hasMore = (safePage + 1) * LIST_PER_PAGE < groups.length
        await replyMessage(replyToken, [buildTestListFlex(tests, searchQuery, {
          page: safePage, perPage: LIST_PER_PAGE, total: groups.length, approx, hasMore,
        })])
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
