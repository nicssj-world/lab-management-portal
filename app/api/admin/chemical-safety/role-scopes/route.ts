import { NextResponse, type NextRequest } from 'next/server'
import { requireChemicalAdmin, requireChemicalViewer } from '@/lib/chemical-safety/access'
import { parseJson, unexpectedError } from '@/lib/chemical-safety/api'
import { chemicalRoleScopeSchema } from '@/lib/chemical-safety/schemas'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(_request: NextRequest) {
  const guard = await requireChemicalViewer()
  if (guard.response) return guard.response
  try {
    const [scopes, profiles, units] = await Promise.all([
      supabaseAdmin.from('chemical_role_scopes').select('user_id, unit_id, role'),
      supabaseAdmin.from('profiles').select('id, name, role, dept').order('name'),
      supabaseAdmin.from('chemical_units').select('id, code, name_th').eq('active', true).order('name_th'),
    ])
    const error = scopes.error || profiles.error || units.error
    if (error) throw error
    return NextResponse.json({ scopes: scopes.data ?? [], profiles: profiles.data ?? [], units: units.data ?? [] })
  } catch (error) { return unexpectedError(error) }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireChemicalAdmin()
  if (guard.response) return guard.response
  const input = await parseJson(request, chemicalRoleScopeSchema)
  if (input.response) return input.response
  try {
    const [{ data: profile }, { data: unit }] = await Promise.all([
      supabaseAdmin.from('profiles').select('id').eq('id', input.data.userId).maybeSingle(),
      supabaseAdmin.from('chemical_units').select('id').eq('id', input.data.unitId).maybeSingle(),
    ])
    if (!profile || !unit) return NextResponse.json({ error: 'ไม่พบบุคลากรหรือหน่วยงาน' }, { status: 404 })
    const key = { user_id: input.data.userId, unit_id: input.data.unitId, role: input.data.role }
    const result = input.data.enabled
      ? await supabaseAdmin.from('chemical_role_scopes').upsert(key, { onConflict: 'user_id,unit_id,role' })
      : await supabaseAdmin.from('chemical_role_scopes').delete().match(key)
    if (result.error) throw result.error
    const action = input.data.enabled ? 'chemical_safety.role_scope.grant' : 'chemical_safety.role_scope.revoke'
    const audit = await supabaseAdmin.from('audit_log').insert({ action, user_id: guard.actor.id, target: `${input.data.userId}:${input.data.unitId}:${input.data.role}`, detail: JSON.stringify(key) })
    if (audit.error) throw audit.error
    return NextResponse.json({ ok: true })
  } catch (error) { return unexpectedError(error) }
}
