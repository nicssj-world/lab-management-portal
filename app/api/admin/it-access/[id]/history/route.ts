import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireIt } from '@/lib/it-access/guard'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireIt('view')
  if ('error' in guard) return guard.error
  const { id } = await params

  const { data: logs } = await supabaseAdmin
    .from('audit_log')
    .select('id, action, detail, created_at, user_id')
    .like('action', 'it_access.%')
    .eq('target', id)
    .order('created_at', { ascending: false })

  const rows = (logs ?? []) as { id: number; action: string; detail: string | null; created_at: string; user_id: string | null }[]

  const userIds = [...new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v))]
  const nameMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, name').in('id', userIds)
    for (const p of profiles ?? []) if (p.id && p.name) nameMap[p.id] = p.name
  }

  const items = rows.map((r) => ({
    id: r.id,
    action: r.action,
    detail: r.detail,
    created_at: r.created_at,
    actor_name: r.user_id ? (nameMap[r.user_id] ?? '') : '',
  }))
  return NextResponse.json({ items })
}
