import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireResource } from '@/lib/auth/guards'
import { OrgNodeCreateSchema } from '@/lib/validations/personnel'
import { createStaffSignedUrl } from '@/lib/personnel/storage'
import { toMsg } from '@/lib/personnel/crud'
import type { OrgChartNode } from '@/lib/supabase/types'

// GET full chart — resolves display name + photo (uploaded photo > linked profile avatar)
export async function GET() {
  const { actor, response } = await requireResource('บุคลากร', 'view')
  if (!actor) return response
  try {
    const { data: nodes, error } = await supabaseAdmin
      .from('org_chart_nodes')
      .select('*')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const profileIds = [...new Set((nodes ?? []).map((n) => n.profile_id).filter(Boolean))] as string[]
    const profileMap = new Map<string, { name: string; avatar_url: string | null }>()
    if (profileIds.length) {
      const { data: profs } = await supabaseAdmin.from('profiles').select('id, name, avatar_url').in('id', profileIds)
      for (const p of profs ?? []) profileMap.set(p.id, { name: p.name, avatar_url: p.avatar_url })
    }

    const resolved = await Promise.all((nodes ?? []).map(async (n: OrgChartNode) => {
      const linked = n.profile_id ? profileMap.get(n.profile_id) : undefined
      const photo = n.photo_url ? await createStaffSignedUrl(n.photo_url) : (linked?.avatar_url ?? null)
      return {
        ...n,
        display_name: n.person_name || linked?.name || null,
        photo,
      }
    }))
    return NextResponse.json({ data: resolved })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { actor, response } = await requireResource('บุคลากร', 'edit')
  if (!actor) return response
  try {
    const parsed = OrgNodeCreateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
    }
    const { data, error } = await supabaseAdmin.from('org_chart_nodes').insert(parsed.data).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    supabaseAdmin.from('audit_log').insert({ action: 'personnel.org.create', user_id: actor.id, target: data.id }).then(undefined, () => {})
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
