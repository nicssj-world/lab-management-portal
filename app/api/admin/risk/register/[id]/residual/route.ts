import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditRisk, canReviewRisk, getRiskActor } from '@/lib/risk/access'
import { residualSchema } from '@/lib/validations/risk-register'

/**
 * ประเมินความเสี่ยงคงเหลือหลังทำมาตรการ
 *
 * residual_score และ residual_level เป็น generated column ใน DB จึงไม่ส่งมาที่นี่
 * ค่าจะคำนวณจาก L×S เสมอ ไม่มีทางไม่ตรงกับคะแนน
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReviewRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const parsed = residualSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const accepted = Boolean(parsed.data.risk_accepted_by_name?.trim())
  const now = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('risk_register')
    .update({
      residual_likelihood: parsed.data.residual_likelihood,
      residual_impact: parsed.data.residual_impact,
      residual_assessed_at: now,
      residual_assessed_by: actor.id,
      residual_assessed_by_name: actor.name,
      risk_accepted_by: accepted ? actor.id : null,
      risk_accepted_by_name: parsed.data.risk_accepted_by_name?.trim() || null,
      risk_accepted_at: accepted ? now : null,
      status: accepted ? 'accepted' : 'monitoring',
      updated_at: now,
    })
    .eq('id', Number(id))
    .is('deleted_at', null)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })

  auditRisk('register.residual', actor.id, data.risk_no ?? id,
    `ความเสี่ยงคงเหลือ ${data.residual_score} (${data.residual_level})`)
  return NextResponse.json({ data })
}
