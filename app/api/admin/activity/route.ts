import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

const EXCLUDED = ['permission.update', 'settings.update', 'user.update', 'user.create', 'document.cover_generate', 'document.cover_regenerate']

const CATEGORY_ACTIONS: Record<string, string[]> = {
  document: ['document.upload', 'document.edit', 'document.delete', 'document.status_change'],
  test:     ['test.create', 'test.update', 'test.delete', 'test.bulk_delete', 'test.import', 'test.duplicate', 'test.purge_deleted'],
  equipment:['equipment.create', 'equipment.update', 'equipment.delete'],
  contract: ['contract.create', 'contract.update', 'contract.delete', 'contract.usage_add'],
  risk:     ['risk.create', 'risk.update', 'risk.delete', 'risk.close'],
  kpi:      ['kpi.entry'],
  news:     ['create_news', 'update_news', 'delete_news'],
}

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

const PAGE_SIZE = 30

export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['Activity Log'] ?? 'none') === 'none') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  const page     = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
  const category = sp.get('category') ?? ''
  const from     = sp.get('from') ?? ''
  const to       = sp.get('to') ?? ''

  const excluded = `(${EXCLUDED.map(a => `"${a}"`).join(',')})`

  let query = supabaseAdmin
    .from('audit_log')
    .select('id, action, target, detail, created_at, user_id', { count: 'exact' })
    .not('action', 'in', excluded)
    .order('created_at', { ascending: false })

  if (category && CATEGORY_ACTIONS[category]) {
    query = query.in('action', CATEGORY_ACTIONS[category])
  }
  if (from) query = query.gte('created_at', from)
  if (to)   query = query.lte('created_at', to + 'T23:59:59.999Z')

  const fromIdx = (page - 1) * PAGE_SIZE
  const { data: logs, count, error } = await query.range(fromIdx, fromIdx + PAGE_SIZE - 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = [...new Set((logs ?? []).map(l => l.user_id).filter(Boolean))]
  let profileMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, name').in('id', userIds)
    profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name ?? '']))
  }

  return NextResponse.json({
    data: (logs ?? []).map(l => ({ ...l, user_name: profileMap[l.user_id] ?? null })),
    count: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  })
}

export async function DELETE(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['Activity Log'] ?? 'none') !== 'edit') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const ids: unknown[] = Array.isArray(body?.ids) ? body.ids : []
  if (ids.length === 0) return NextResponse.json({ error: 'No ids provided' }, { status: 400 })

  const { error } = await supabaseAdmin.from('audit_log').delete().in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: ids.length })
}
