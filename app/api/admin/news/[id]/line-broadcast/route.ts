import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { broadcastMessage } from '@/lib/line/client'
import { buildNewsFlex } from '@/lib/line/news-flex'
import { NextRequest, NextResponse } from 'next/server'
import type { News } from '@/lib/supabase/types'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role, name').eq('id', user.id).single()
  return data as { id: string; role: string; name: string | null } | null
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const canEdit = ['Admin', 'Manager'].includes(actor.role)
  if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const { data: news, error } = await supabaseAdmin
    .from('news').select('*').eq('id', id).single()
  if (error || !news) return NextResponse.json({ error: 'ไม่พบข่าว' }, { status: 404 })

  if (!(news as News).published) {
    return NextResponse.json({ error: 'ต้องเผยแพร่ข่าวก่อนจึงจะส่งผ่าน LINE ได้' }, { status: 422 })
  }

  try {
    await broadcastMessage([buildNewsFlex(news as News)])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `ส่ง LINE ไม่สำเร็จ: ${msg}` }, { status: 502 })
  }

  const sentAt = new Date().toISOString()
  const sentBy = actor.name ?? null
  await supabaseAdmin.from('news')
    .update({ line_sent_at: sentAt, line_sent_by: sentBy })
    .eq('id', id)

  supabaseAdmin.from('audit_log')
    .insert({ action: 'line_broadcast_news', user_id: actor.id, target: String(id), detail: (news as News).title })
    .then(undefined, () => {})

  return NextResponse.json({ line_sent_at: sentAt, line_sent_by: sentBy })
}
