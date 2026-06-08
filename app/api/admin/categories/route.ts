import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

function toMsg(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    return String(e.message ?? e.error ?? JSON.stringify(err))
  }
  return String(err)
}

// GET — list categories with test count
export async function GET() {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: cats, error }, { data: testRows }] = await Promise.all([
      supabaseAdmin.from('categories').select('*').order('sort_order'),
      supabaseAdmin.from('tests').select('category_id').not('category_id', 'is', null).eq('active', true),
    ])
    if (error) throw error

    const countMap: Record<string, number> = {}
    for (const t of testRows ?? []) {
      if (t.category_id) countMap[t.category_id] = (countMap[t.category_id] ?? 0) + 1
    }

    const data = (cats ?? []).map((c) => ({
      ...c,
      tests: [{ count: countMap[c.id] ?? 0 }],
    }))

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

const upsertSchema = z.object({
  id:         z.string().min(1),
  th:         z.string().min(1),
  en:         z.string().min(1),
  color:      z.string().min(1),
  icon:       z.string().min(1),
  active:     z.boolean(),
  sort_order: z.number().optional(),
})

// POST — upsert category (Admin only)
export async function POST(req: NextRequest) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (actor.role?.toLowerCase() !== 'admin')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const parsed = upsertSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })

    const { data, error } = await supabaseAdmin
      .from('categories')
      .upsert(parsed.data)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

// DELETE — delete category (Admin only)
export async function DELETE(req: NextRequest) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (actor.role?.toLowerCase() !== 'admin')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 422 })

    const { error } = await supabaseAdmin.from('categories').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

const reorderSchema = z.object({ ids: z.array(z.string()) })

// PATCH — reorder categories (Admin only)
export async function PATCH(req: NextRequest) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (actor.role?.toLowerCase() !== 'admin')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const parsed = reorderSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })

    const updates = parsed.data.ids.map((id, idx) => ({ id, sort_order: idx }))
    const { error } = await supabaseAdmin.from('categories').upsert(updates)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
