import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getTests } from '@/lib/queries/tests'
import { verifyLineSignature, replyMessage } from '@/lib/line/client'
import { formatTestReply, formatListReply, formatNotFound, buildListMoreQuickReply, LIST_MORE_PREFIX } from '@/lib/line/format'

export async function GET() {
  return NextResponse.json({ ok: true })
}

// among rows sharing a code, prefer the row from a "main" department (anything
// other than ศูนย์สุขภาพชุมชนเมืองชลบุรี) as the primary contact/link target
function pickPrimaryRow<T extends { contact_name?: string | null }>(rows: T[]): T {
  return rows.find(r => !(r.contact_name ?? '').includes('ศูนย์สุขภาพชุมชนเมืองชลบุรี')) ?? rows[0]
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
      // exact code match — fetch all rows with same code to collect all contacts.
      // Skipped for a "more" follow-up: that only ever continues a prior list search.
      if (!isMoreRequest) {
        const { data: exactRows } = await supabaseAdmin
          .from('tests')
          .select('*')
          .eq('code', q.toUpperCase())
          .eq('active', true)

        if (exactRows && exactRows.length > 0) {
          const primary = pickPrimaryRow(exactRows)
          const extraContacts = exactRows.filter(t => t !== primary)
            .map(t => [t.contact_name, t.contact_phone].filter(Boolean).join(' '))
            .filter(Boolean)
          const { data: docs } = await supabaseAdmin
            .from('test_documents')
            .select('name, doc_type')
            .eq('test_id', primary.id)
          await replyMessage(replyToken, [{ type: 'text', text: formatTestReply(primary, docs ?? [], extraContacts) }])
          continue
        }
      }

      const { data: rawData } = await getTests(supabaseAdmin, { search: searchQuery, active: true, pageSize: 20 })
      // dedupe by id, then group by code — rows sharing a code across different
      // categories are the same catalog entry with multiple department contacts
      const seenIds = new Set<number>()
      const uniqueRows = rawData.filter(t => {
        if (seenIds.has(t.id)) return false
        seenIds.add(t.id)
        return true
      })
      const groups = new Map<string, typeof uniqueRows>()
      for (const t of uniqueRows) {
        const group = groups.get(t.code)
        if (group) group.push(t)
        else groups.set(t.code, [t])
      }
      const data = [...groups.values()].slice(0, 10)

      if (data.length === 1) {
        const rows = data[0]
        const primary = pickPrimaryRow(rows)
        const extraContacts = rows.filter(t => t !== primary)
          .map(t => [t.contact_name, t.contact_phone].filter(Boolean).join(' '))
          .filter(Boolean)
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
