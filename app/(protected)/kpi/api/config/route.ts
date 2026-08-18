import { NextResponse } from 'next/server'
import { getActor, canAccessResource } from '@/lib/auth/guards'
import { isAdminRole } from '@/lib/roles'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getAssignedDeptIds, getExclusions } from '@/lib/queries/kpi'

// Returns the current user's KPI entry scope + global exclusions.
// Used by the entry form (which depts/KPIs they may fill) and dashboard components.
// Reads the config tables via the admin client — they have no RLS read policy,
// and the actor is already authenticated above.
export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [canEditAll, canViewAll, assignedDeptIds, exclusions] = await Promise.all([
    canAccessResource(actor, 'KPI', 'edit'),
    canAccessResource(actor, 'KPI', 'view'),
    getAssignedDeptIds(supabaseAdmin, actor.id),
    getExclusions(supabaseAdmin),
  ])

  return NextResponse.json({
    canEditAll,
    isAdmin: isAdminRole(actor.role),
    canViewAll,
    assignedDeptIds,
    exclusions: Array.from(exclusions),
  })
}
