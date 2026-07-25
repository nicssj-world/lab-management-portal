import { NextRequest, NextResponse } from 'next/server'
import { requirePersonnelManage } from '@/lib/auth/guards'
import { expandAuthorizationRows, authorizationRowKey, type AuthorizationInsertRow } from '@/lib/personnel/authorization-batch'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { AuthorizationBatchSchema } from '@/lib/validations/personnel'

type ExistingAuthorization = Pick<AuthorizationInsertRow, 'profile_id' | 'test_id' | 'category' | 'role_type'>

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await requirePersonnelManage()
  if (!actor) return response

  const { id } = await ctx.params
  const parsed = AuthorizationBatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const payload = parsed.data
  const candidates = expandAuthorizationRows({
    profileIds: [id], testId: payload.test_id ?? null, categories: payload.categories, roles: payload.roles,
    common: {
      competency_id: payload.competency_id ?? null, authorized_date: payload.authorized_date ?? null,
      status: 'active', notes: payload.notes ?? null, created_by: actor.id,
    },
  })
  let existingQuery = supabaseAdmin
    .from('staff_authorizations')
    .select('profile_id,test_id,category,role_type')
    .eq('profile_id', id)
    .eq('status', 'active')
    .is('deleted_at', null)
  existingQuery = payload.test_id != null
    ? existingQuery.eq('test_id', payload.test_id)
    : existingQuery.is('test_id', null).in('category', payload.categories)
  existingQuery = existingQuery.in('role_type', payload.roles)

  const { data: existing, error: existingError } = await existingQuery
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })

  const existingKeys = new Set((existing as ExistingAuthorization[] ?? []).map(authorizationRowKey))
  const rows = candidates.filter((row) => !existingKeys.has(authorizationRowKey(row)))
  const skipped = candidates.length - rows.length
  if (rows.length === 0) return NextResponse.json({ created: [], inserted: 0, skipped })

  const { data: created, error } = await supabaseAdmin.from('staff_authorizations').insert(rows).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log')
    .insert({ action: 'personnel.staff_authorizations.batch_create', user_id: actor.id, target: id, detail: `created=${rows.length}; skipped=${skipped}` })
    .then(undefined, () => {})

  return NextResponse.json({ created: created ?? [], inserted: rows.length, skipped }, { status: 201 })
}
