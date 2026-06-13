import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireResource } from '@/lib/auth/guards'
import { OrgNodeUpdateSchema } from '@/lib/validations/personnel'
import { toMsg } from '@/lib/personnel/crud'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ nodeId: string }> }) {
  const { actor, response } = await requireResource('บุคลากร', 'edit')
  if (!actor) return response
  const { nodeId } = await ctx.params
  try {
    const parsed = OrgNodeUpdateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
    }
    const { data, error } = await supabaseAdmin
      .from('org_chart_nodes')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', nodeId)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

// Soft-delete a node and all its descendants
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ nodeId: string }> }) {
  const { actor, response } = await requireResource('บุคลากร', 'edit')
  if (!actor) return response
  const { nodeId } = await ctx.params
  try {
    const { data: all } = await supabaseAdmin.from('org_chart_nodes').select('id, parent_id').is('deleted_at', null)
    const childrenOf = new Map<string, string[]>()
    for (const n of all ?? []) {
      if (!n.parent_id) continue
      childrenOf.set(n.parent_id, [...(childrenOf.get(n.parent_id) ?? []), n.id])
    }
    const toDelete: string[] = []
    const stack = [nodeId]
    while (stack.length) {
      const cur = stack.pop()!
      toDelete.push(cur)
      stack.push(...(childrenOf.get(cur) ?? []))
    }
    const { error } = await supabaseAdmin
      .from('org_chart_nodes')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', toDelete)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    supabaseAdmin.from('audit_log').insert({ action: 'personnel.org.delete', user_id: actor.id, target: nodeId, detail: `${toDelete.length} nodes` }).then(undefined, () => {})
    return NextResponse.json({ ok: true, deleted: toDelete.length })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
