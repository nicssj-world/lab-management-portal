import { NextResponse, type NextRequest } from 'next/server'
import { getActor, canAccessResource, jsonUnauthorized, jsonForbidden } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getEntryStatus, getAssignedDeptIds } from '@/lib/queries/kpi'

export async function GET(request: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()

  if (!(await canAccessResource(actor, 'KPI', 'view'))) {
    const assigned = await getAssignedDeptIds(supabaseAdmin, actor.id)
    if (assigned.length === 0) return jsonForbidden()
  }

  const year = parseInt(new URL(request.url).searchParams.get('year') ?? '0', 10)
  if (!year) return NextResponse.json({ error: 'year is required' }, { status: 400 })

  // admin client: the exclusions/assignees config tables have no RLS read policy
  const data = await getEntryStatus(supabaseAdmin, year)
  return NextResponse.json(data)
}
