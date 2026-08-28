import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { diffKpiSettings } from '@/lib/kpi/settings-diff'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()
  if (!data || data.role?.toLowerCase() !== 'admin') return null
  return data as { id: string; role: string }
}

// GET — current assignees + exclusions + list of users to pick from
export async function GET() {
  const actor = await requireAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [assigneesRes, exclusionsRes, usersRes] = await Promise.all([
    supabaseAdmin.from('kpi_dept_assignees').select('dept_id, user_id'),
    supabaseAdmin.from('kpi_dept_exclusions').select('dept_id, kpi_id'),
    supabaseAdmin.from('profiles').select('id, name, role').eq('status', 'active').is('deleted_at', null).order('name'),
  ])

  if (assigneesRes.error) return NextResponse.json({ error: assigneesRes.error.message }, { status: 500 })
  if (exclusionsRes.error) return NextResponse.json({ error: exclusionsRes.error.message }, { status: 500 })
  if (usersRes.error) return NextResponse.json({ error: usersRes.error.message }, { status: 500 })

  return NextResponse.json({
    assignees: assigneesRes.data ?? [],
    exclusions: exclusionsRes.data ?? [],
    users: usersRes.data ?? [],
  })
}

const putSchema = z.object({
  assignees: z.array(z.object({ dept_id: z.number().int(), user_id: z.string().uuid() })),
  exclusions: z.array(z.object({ dept_id: z.number().int(), kpi_id: z.number().int() })),
})

// PUT — replace the full config (idempotent overwrite)
export async function PUT(req: NextRequest) {
  const actor = await requireAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = putSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })

  const { assignees, exclusions } = parsed.data

  const [currentAssignees, currentExclusions] = await Promise.all([
    supabaseAdmin.from('kpi_dept_assignees').select('id, dept_id, user_id'),
    supabaseAdmin.from('kpi_dept_exclusions').select('id, dept_id, kpi_id'),
  ])
  if (currentAssignees.error) return NextResponse.json({ error: currentAssignees.error.message }, { status: 500 })
  if (currentExclusions.error) return NextResponse.json({ error: currentExclusions.error.message }, { status: 500 })

  const diff = diffKpiSettings(
    { assignees: currentAssignees.data ?? [], exclusions: currentExclusions.data ?? [] },
    { assignees, exclusions },
  )

  // Insert first and delete stale rows afterwards. A failed insert therefore
  // leaves the existing configuration intact instead of wiping it first.
  if (diff.assigneesToInsert.length > 0) {
    const result = await supabaseAdmin.from('kpi_dept_assignees').insert(diff.assigneesToInsert)
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  }
  if (diff.exclusionsToInsert.length > 0) {
    const result = await supabaseAdmin.from('kpi_dept_exclusions').insert(diff.exclusionsToInsert)
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  }
  if (diff.assigneeIdsToDelete.length > 0) {
    const result = await supabaseAdmin.from('kpi_dept_assignees').delete().in('id', diff.assigneeIdsToDelete)
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  }
  if (diff.exclusionIdsToDelete.length > 0) {
    const result = await supabaseAdmin.from('kpi_dept_exclusions').delete().in('id', diff.exclusionIdsToDelete)
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  supabaseAdmin.from('audit_log').insert({
    action: 'kpi.settings',
    user_id: actor.id,
    detail: `ตั้งค่าผู้กรอก KPI ${assignees.length} รายการ, ยกเว้น ${exclusions.length} รายการ`,
  }).then(undefined, () => {})

  return NextResponse.json({ ok: true })
}
