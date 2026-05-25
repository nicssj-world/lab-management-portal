import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const year = Number(sp.get('year'))
  const month = Number(sp.get('month'))
  if (!year || !month)
    return NextResponse.json({ error: 'year and month required' }, { status: 422 })

  // All aggregation runs server-side in PostgreSQL — no PostgREST row-limit issue
  const { data, error } = await supabaseAdmin.rpc('get_tat_summary', {
    p_year:        year,
    p_month:       month,
    p_lab_section: sp.get('lab_section') || null,
    p_ward:        sp.get('ward')        || null,
    p_priority:    sp.get('priority')    || null,
    p_test_name:   sp.get('test_name')   || null,
    p_labzone:     sp.get('labzone_name')|| null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach has_phleb_data flag (separate count query, always small)
  const { count: phlebCount } = await supabaseAdmin
    .from('phleb_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('year', year)
    .eq('month', month)

  const { count: phlebRecordCount } = await supabaseAdmin
    .from('phlebotomy_records')
    .select('id', { count: 'exact', head: true })
    .eq('year', year)
    .eq('month', month)

  // Distinct HN count from phlebotomy_records (Tab 2 KPI — not from tat_records)
  const { data: phlebKpi } = await supabaseAdmin.rpc('get_phleb_kpi', {
    p_year:    year,
    p_month:   month,
    p_labzone: sp.get('labzone_name') || null,
  })

  return NextResponse.json({
    ...data,
    has_phleb_data:     (phlebCount ?? 0) > 0,
    phleb_record_count: phlebRecordCount ?? 0,
    phleb_hn_count:     (phlebKpi as { phleb_hn_count: number } | null)?.phleb_hn_count ?? 0,
  })
}
