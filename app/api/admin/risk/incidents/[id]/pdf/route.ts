import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { exportResponse } from '@/lib/external-quality/export'
import { buildIncidentDetailPdf } from '@/lib/risk/detail-pdf'
import { getRiskActor, getRiskPermission } from '@/lib/risk/access'

type Params = { params: Promise<{ id: string }> }

/** ดาวน์โหลด PDF สรุปอุบัติการณ์รายการเดียว — สิทธิ์เท่ากับการเปิดดูรายละเอียด (view ขึ้นไป) */
export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRiskPermission(actor.role)) === 'none') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const incidentId = Number(id)

  const [{ data, error }, { data: actions }, { data: attachments }] = await Promise.all([
    supabaseAdmin.from('incident_reports').select('*').eq('id', incidentId).is('deleted_at', null).single(),
    supabaseAdmin.from('risk_actions').select('*').eq('incident_id', incidentId)
      .order('due_date', { ascending: true, nullsFirst: false }).order('id', { ascending: true }),
    supabaseAdmin.from('risk_attachments').select('*').eq('incident_id', incidentId).order('uploaded_at'),
  ])

  if (error || !data) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })

  const buffer = buildIncidentDetailPdf(data, actions ?? [], attachments ?? [])
  return exportResponse(buffer, `${data.report_no ?? `incident-${incidentId}`}.pdf`, 'application/pdf')
}
