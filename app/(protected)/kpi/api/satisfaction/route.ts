import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { getSatisfaction } from '@/lib/queries/kpi'
import { validateKpiSatisfactionPayload } from '@/lib/kpi/satisfaction-validation'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await getSatisfaction(supabase)
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  const perms = profile?.role ? await getRolePermissions(profile.role) : {}
  if ((perms['KPI'] ?? 'none') !== 'edit')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const validation = validateKpiSatisfactionPayload(await request.json())
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 422 })
  const { metric_code, metric_name, fiscal_year, value, target_val } = validation.data

  const upsertData: Record<string, unknown> = { metric_code, metric_name, fiscal_year, value: value ?? null }
  if (target_val !== undefined) upsertData.target_val = target_val

  const { data, error } = await supabaseAdmin
    .from('kpi_satisfaction')
    .upsert(upsertData, { onConflict: 'metric_code,fiscal_year' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  supabaseAdmin.from('audit_log').insert({
    action: 'kpi.satisfaction',
    user_id: user.id,
    target: `${metric_code}/${fiscal_year}`,
    detail: `บันทึกความพึงพอใจ ${metric_name}`,
  }).then(undefined, () => {})
  return NextResponse.json(data)
}
