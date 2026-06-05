import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canEditRisk, getRiskActor } from '@/lib/risk-server'
import { riskLevel, riskScore } from '@/lib/risk-utils'

const schema = z.object({
  residual_likelihood: z.number().min(1).max(5),
  residual_impact: z.number().min(1).max(5),
  risk_accepted_by: z.string().nullable().optional(),
  effectiveness_result: z.string().nullable().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await canEditRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 })

  const score = riskScore(parsed.data.residual_likelihood, parsed.data.residual_impact)
  const { data, error } = await supabaseAdmin
    .from('risks')
    .update({
      residual_likelihood: parsed.data.residual_likelihood,
      residual_impact: parsed.data.residual_impact,
      residual_score: score,
      residual_level: riskLevel(score),
      residual_assessed_at: new Date().toISOString(),
      residual_assessed_by: actor.name ?? actor.role,
      risk_accepted_by: parsed.data.risk_accepted_by ?? null,
      risk_accepted_at: parsed.data.risk_accepted_by ? new Date().toISOString() : null,
      effectiveness_result: parsed.data.effectiveness_result ?? null,
      review_status: 'follow_up',
      status: 'monitoring',
      updated_at: new Date().toISOString(),
    })
    .eq('id', Number(id))
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
