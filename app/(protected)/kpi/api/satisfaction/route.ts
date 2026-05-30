import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { getSatisfaction } from '@/lib/queries/kpi'

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const body = await request.json()
  const { metric_code, metric_name, fiscal_year, value, target_val } = body
  if (!metric_code || !fiscal_year) return NextResponse.json({ error: 'metric_code and fiscal_year required' }, { status: 422 })

  const upsertData: Record<string, unknown> = { metric_code, metric_name, fiscal_year, value: value ?? null }
  if (target_val !== undefined) upsertData.target_val = target_val

  const { data, error } = await supabaseAdmin
    .from('kpi_satisfaction')
    .upsert(upsertData, { onConflict: 'metric_code,fiscal_year' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
