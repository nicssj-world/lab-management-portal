import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canManageRisk, getRiskActor } from '@/lib/risk-server'

const actionSchema = z.object({
  id: z.number().optional(),
  action_type: z.enum(['correction', 'corrective', 'preventive', 'follow_up']),
  description: z.string().min(1),
  owner: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  status: z.enum(['open', 'in_progress', 'done']).optional(),
  completed_at: z.string().nullable().optional(),
  evidence: z.string().nullable().optional(),
  effectiveness_note: z.string().nullable().optional(),
  follow_up_date: z.string().nullable().optional(),
  followed_by: z.string().nullable().optional(),
  result: z.string().nullable().optional(),
  is_effective: z.boolean().nullable().optional(),
  next_follow_up_date: z.string().nullable().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const parsed = actionSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 })

  const payload = {
    ...parsed.data,
    risk_id: Number(id),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabaseAdmin.from('risk_actions').insert(payload).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await syncRiskStatus(Number(id))
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const parsed = actionSchema.partial().extend({ id: z.number() }).safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 })
  const { id: actionId, ...patch } = parsed.data

  const completedAt = patch.status === 'done' && !patch.completed_at ? new Date().toISOString() : patch.completed_at
  const { data, error } = await supabaseAdmin
    .from('risk_actions')
    .update({ ...patch, completed_at: completedAt, updated_at: new Date().toISOString() })
    .eq('id', actionId)
    .eq('risk_id', Number(id))
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await syncRiskStatus(Number(id))
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const actionId = Number(req.nextUrl.searchParams.get('action_id'))
  if (!actionId) return NextResponse.json({ error: 'action_id required' }, { status: 422 })
  const { error } = await supabaseAdmin.from('risk_actions').delete().eq('id', actionId).eq('risk_id', Number(id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await syncRiskStatus(Number(id))
  return NextResponse.json({ ok: true })
}

async function syncRiskStatus(riskId: number) {
  const { data } = await supabaseAdmin.from('risk_actions').select('status, action_type').eq('risk_id', riskId)
  const actions = data ?? []
  if (actions.length === 0) return
  const hasOpen = actions.some(action => action.status !== 'done')
  const hasFollowUp = actions.some(action => action.action_type === 'follow_up')
  await supabaseAdmin
    .from('risks')
    .update({
      status: hasOpen ? 'mitigating' : hasFollowUp ? 'monitoring' : 'mitigating',
      review_status: hasOpen ? 'action_plan' : 'follow_up',
      updated_at: new Date().toISOString(),
    })
    .eq('id', riskId)
}
