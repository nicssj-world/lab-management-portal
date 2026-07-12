import { NextResponse } from 'next/server'
import { getActor, canAccessResource } from '@/lib/auth/guards'
import { createClient } from '@/lib/supabase/server'
import { getAssignedDeptIds, getExclusions } from '@/lib/queries/kpi'

// Returns the current user's KPI entry scope + global exclusions.
// Used by the entry form (which depts/KPIs they may fill) and dashboard components.
export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const [canEditAll, assignedDeptIds, exclusions] = await Promise.all([
    canAccessResource(actor, 'KPI', 'edit'),
    getAssignedDeptIds(supabase, actor.id),
    getExclusions(supabase),
  ])

  return NextResponse.json({
    canEditAll,
    assignedDeptIds,
    exclusions: Array.from(exclusions),
  })
}
