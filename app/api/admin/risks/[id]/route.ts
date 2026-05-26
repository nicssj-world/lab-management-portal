import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canManageRisk, getRiskActor, getRiskPermission, normalizeRiskPayload } from '@/lib/risk-server'

const patchSchema = z.record(z.string(), z.unknown())

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perm = await getRiskPermission(actor.role)
  if (perm === 'none') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { data, error } = await supabaseAdmin.from('risks').select('*').eq('id', Number(id)).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  const { data: actions } = await supabaseAdmin.from('risk_actions').select('*').eq('risk_id', Number(id)).order('created_at')
  return NextResponse.json({ data, actions: actions ?? [] })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const parsed = patchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 })

  const payload = normalizeRiskPayload(parsed.data)
  const { data, error } = await supabaseAdmin
    .from('risks')
    .update(payload)
    .eq('id', Number(id))
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { error } = await supabaseAdmin.from('risks').delete().eq('id', Number(id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
