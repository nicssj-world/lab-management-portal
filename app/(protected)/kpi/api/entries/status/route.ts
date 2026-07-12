import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActor, canAccessResource, jsonUnauthorized, jsonForbidden } from '@/lib/auth/guards'
import { getEntryStatus, getAssignedDeptIds } from '@/lib/queries/kpi'

export async function GET(request: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()

  const supabase = await createClient()
  if (!(await canAccessResource(actor, 'KPI', 'view'))) {
    const assigned = await getAssignedDeptIds(supabase, actor.id)
    if (assigned.length === 0) return jsonForbidden()
  }

  const year = parseInt(new URL(request.url).searchParams.get('year') ?? '0', 10)
  if (!year) return NextResponse.json({ error: 'year is required' }, { status: 400 })

  const data = await getEntryStatus(supabase, year)
  return NextResponse.json(data)
}
