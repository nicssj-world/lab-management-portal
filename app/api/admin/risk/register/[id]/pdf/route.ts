import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { exportResponse } from '@/lib/external-quality/export'
import { buildRegisterDetailPdf } from '@/lib/risk/detail-pdf'
import { getRiskActor, getRiskPermission } from '@/lib/risk/access'

type Params = { params: Promise<{ id: string }> }

/** ดาวน์โหลด PDF สรุปความเสี่ยงรายการเดียว — สิทธิ์เท่ากับการเปิดดูรายละเอียด (view ขึ้นไป) */
export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRiskPermission(actor)) === 'none') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const registerId = Number(id)

  const [{ data, error }, { data: actions }, { data: attachments }, { data: sourceIncidents }] = await Promise.all([
    supabaseAdmin.from('risk_register').select('*').eq('id', registerId).is('deleted_at', null).single(),
    supabaseAdmin.from('risk_actions').select('*').eq('register_id', registerId)
      .order('due_date', { ascending: true, nullsFirst: false }).order('id', { ascending: true }),
    supabaseAdmin.from('risk_attachments').select('*').eq('register_id', registerId).order('uploaded_at'),
    supabaseAdmin.from('incident_reports').select('id, report_no')
      .eq('escalated_register_id', registerId).is('deleted_at', null),
  ])

  if (error || !data) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })

  const buffer = buildRegisterDetailPdf(data, actions ?? [], attachments ?? [], sourceIncidents ?? [])
  return exportResponse(buffer, `${data.risk_no ?? `risk-register-${registerId}`}.pdf`, 'application/pdf')
}
