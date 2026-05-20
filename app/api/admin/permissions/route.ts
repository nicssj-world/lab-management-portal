import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Level is encoded as a suffix in the resource column: 'รายการตรวจ:edit'
// This avoids needing a schema migration on the existing role_permissions table.

type Level = 'none' | 'view' | 'edit'

const RESOURCES = [
  'รายการตรวจ', 'เอกสารคุณภาพ', 'ข่าวสาร',
  'ความเสี่ยง / Rejection', 'สัญญา', 'Workload',
  'KPI', 'TAT (นำเข้า)', 'User Management',
]
const ALL_ROLES = ['Admin', 'Manager', 'Medical Technologist', 'Assistant']

function parseResource(raw: string): { base: string; level: Level } | null {
  const i = raw.lastIndexOf(':')
  if (i === -1) return null
  const level = raw.slice(i + 1) as Level
  if (!['none', 'view', 'edit'].includes(level)) return null
  return { base: raw.slice(0, i), level }
}

async function getActor(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

function toMsg(err: unknown): string {
  if (!err) return 'Unknown error'
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>
    return String(e.message ?? e.error ?? JSON.stringify(err))
  }
  return String(err)
}

// GET — returns { [role]: { [resource]: 'none'|'view'|'edit' } }
export async function GET() {
  try {
    const supabase = await createClient()
    const actor = await getActor(supabase)
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabaseAdmin
      .from('role_permissions')
      .select('role, resource, granted')

    if (error) throw error

    // Default everything to 'none'
    const matrix: Record<string, Record<string, Level>> = {}
    for (const role of ALL_ROLES) {
      matrix[role] = {}
      for (const res of RESOURCES) matrix[role][res] = 'none'
    }

    // Overlay rows that use the new ':level' suffix encoding
    for (const row of data ?? []) {
      if (!row.granted) continue
      const parsed = parseResource(row.resource)
      if (!parsed) continue
      const { base, level } = parsed
      if (matrix[row.role] && RESOURCES.includes(base)) {
        matrix[row.role][base] = level
      }
    }

    return NextResponse.json(matrix)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

const patchSchema = z.object({
  role:     z.string().min(1),
  resource: z.string().min(1),
  level:    z.enum(['none', 'view', 'edit']),
})

// PATCH — body: { role, resource, level }
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const actor = await getActor(supabase)
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (actor.role?.toLowerCase() !== 'admin')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })

    const { role, resource, level } = parsed.data
    if (role === 'Admin')
      return NextResponse.json({ error: 'Admin permissions cannot be changed' }, { status: 400 })

    // Remove all existing rows for this role+resource (all level variants + legacy format)
    await supabaseAdmin.from('role_permissions').delete()
      .eq('role', role)
      .in('resource', [
        resource,                 // legacy format without suffix
        `${resource}:none`,
        `${resource}:view`,
        `${resource}:edit`,
      ])

    // Insert new row — 'none' means no row (absence = no permission)
    if (level !== 'none') {
      const { error: insErr } = await supabaseAdmin.from('role_permissions').insert({
        role,
        resource:   `${resource}:${level}`,
        granted:    true,
        updated_by: actor.id,
        updated_at: new Date().toISOString(),
      })
      if (insErr) throw insErr
    }

    await supabaseAdmin.from('audit_log').insert({
      action: 'permission.update', user_id: actor.id,
      target: `${role}:${resource}`, detail: `Set to ${level}`,
    }).then(undefined, () => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
