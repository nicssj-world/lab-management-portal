import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canEditRisk } from '@/lib/risk/access'
import { nextReviewDate } from '@/lib/risk/register'
import { riskRegisterSchema } from '@/lib/validations/risk-register'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { getOccurrenceAccess } from '@/lib/quality-tasks/server'

const schema = riskRegisterSchema.extend({ actionItemId: z.string().uuid().nullable().optional() })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const instanceId = (await params).id
    await getOccurrenceAccess(instanceId, ctx.actor, ctx.level, 'safety')
    if (!(await canEditRisk({ id: ctx.actor.id, role: ctx.actor.role, name: ctx.actor.name ?? null }))) throw new Error('Forbidden')
    const input = schema.parse(await req.json())
    const { actionItemId, ...riskInput } = input
    const sourceId = actionItemId ?? instanceId
    const { data: existing } = await supabaseAdmin.from('quality_task_links').select('source_id').eq('instance_id', instanceId).eq('integration_kind', 'risk_register').eq('source_type', actionItemId ? 'quality_task_action_item' : 'quality_task_instance').eq('metadata->>taskSourceId', sourceId).maybeSingle()
    if (existing) return NextResponse.json({ riskId: Number(existing.source_id), reused: true })
    const { data: risk, error } = await supabaseAdmin.from('risk_register').insert({
      ...riskInput, next_review_date: riskInput.next_review_date ?? nextReviewDate(riskInput.assessed_date), created_by: ctx.actor.id,
    }).select('id,risk_no').single()
    if (error || !risk) throw new Error(error?.message ?? 'Risk register was not created')
    const { error: linkError } = await supabaseAdmin.from('quality_task_links').insert({
      instance_id: instanceId, integration_kind: 'risk_register', source_type: actionItemId ? 'quality_task_action_item' : 'quality_task_instance',
      source_id: String(risk.id), sync_status: 'synced', metadata: { taskSourceId: sourceId }, created_by: ctx.actor.id,
    })
    if (linkError) {
      await supabaseAdmin.from('risk_register').delete().eq('id', risk.id)
      throw new Error(linkError.message)
    }
    return NextResponse.json({ riskId: risk.id, riskNo: risk.risk_no, reused: false }, { status: 201 })
  } catch (error) { return safetyTaskError(error) }
}
