import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditRisk, canReviewRisk, getRiskActor } from '@/lib/risk/access'
import { incidentReviewSchema } from '@/lib/validations/incident'

/**
 * ทบทวนเรื่องที่เจ้าหน้าที่รายงานเข้ามา
 *
 * ขั้นนี้คือจุดที่ระดับความรุนแรงถูกกำหนด — ผู้รายงานกำหนดเองไม่ได้ เพราะเป็นการตัดสินใจเชิงคุณภาพ
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReviewRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const parsed = incidentReviewSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const { data: current } = await supabaseAdmin
    .from('incident_reports')
    .select('status')
    .eq('id', Number(id))
    .is('deleted_at', null)
    .single()

  if (!current) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })
  if (current.status === 'closed') {
    return NextResponse.json({ error: 'เรื่องที่ปิดแล้วทบทวนซ้ำไม่ได้' }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin
    .from('incident_reports')
    .update({
      severity_level: parsed.data.severity_level,
      requires_rca: parsed.data.requires_rca,
      review_note: parsed.data.review_note ?? null,
      reviewed_by: actor.id,
      reviewed_by_name: actor.name,
      reviewed_at: new Date().toISOString(),
      // ทบทวนแล้วยังไม่มีมาตรการ จึงยังอยู่ขั้นทบทวน — จะขยับเป็น action เมื่อเพิ่มมาตรการแรก
      status: current.status === 'reported' ? 'reviewing' : current.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', Number(id))
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  auditRisk('incident.review', actor.id, data.report_no ?? id, `ระดับ ${data.severity_level}`)
  return NextResponse.json({ data })
}
