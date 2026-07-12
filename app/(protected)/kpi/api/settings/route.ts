import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

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
    supabaseAdmin.from('profiles').select('id, name, role').order('name'),
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

  // Replace-all strategy: wipe then insert. Simple and correct for a small admin table.
  const delA = await supabaseAdmin.from('kpi_dept_assignees').delete().neq('id', 0)
  if (delA.error) return NextResponse.json({ error: delA.error.message }, { status: 500 })
  if (assignees.length > 0) {
    const insA = await supabaseAdmin.from('kpi_dept_assignees').insert(assignees)
    if (insA.error) return NextResponse.json({ error: insA.error.message }, { status: 500 })
  }

  const delE = await supabaseAdmin.from('kpi_dept_exclusions').delete().neq('id', 0)
  if (delE.error) return NextResponse.json({ error: delE.error.message }, { status: 500 })
  if (exclusions.length > 0) {
    const insE = await supabaseAdmin.from('kpi_dept_exclusions').insert(exclusions)
    if (insE.error) return NextResponse.json({ error: insE.error.message }, { status: 500 })
  }

  supabaseAdmin.from('audit_log').insert({
    action: 'kpi.settings',
    user_id: actor.id,
    detail: `ตั้งค่าผู้กรอก KPI ${assignees.length} รายการ, ยกเว้น ${exclusions.length} รายการ`,
  }).then(undefined, () => {})

  return NextResponse.json({ ok: true })
}
