import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getTests, getTestByCode } from '@/lib/queries/tests'
import { verifyLineSignature, replyMessage } from '@/lib/line/client'
import { formatTestReply, formatListReply, formatNotFound } from '@/lib/line/format'

export async function GET() {
  return NextResponse.json({ ok: true })
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

    try {
      const exact = await getTestByCode(supabaseAdmin, q.toUpperCase())
      if (exact) {
        const { data: docs } = await supabaseAdmin
          .from('test_documents')
          .select('name, doc_type')
          .eq('test_id', exact.id)
        await replyMessage(replyToken, [{ type: 'text', text: formatTestReply(exact, docs ?? []) }])
        continue
      }

      const { data } = await getTests(supabaseAdmin, { search: q, active: true, pageSize: 10 })
      if (data.length === 1) {
        const { data: docs } = await supabaseAdmin
          .from('test_documents')
          .select('name, doc_type')
          .eq('test_id', data[0].id)
        await replyMessage(replyToken, [{ type: 'text', text: formatTestReply(data[0], docs ?? []) }])
      } else if (data.length > 1) {
        await replyMessage(replyToken, [{ type: 'text', text: formatListReply(data) }])
      } else {
        await replyMessage(replyToken, [{ type: 'text', text: formatNotFound(q) }])
      }
    } catch {
      // swallow per-event errors — always return 200 so LINE doesn't retry
    }
  }

  return NextResponse.json({ ok: true })
}
