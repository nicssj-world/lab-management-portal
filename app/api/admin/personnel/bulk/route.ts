import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requirePersonnelManage } from '@/lib/auth/guards'
import { AuthorizationBatchSchema, AuthorizationSchema, TrainingPlanSchema, CompetencySchema } from '@/lib/validations/personnel'
import { expandAuthorizationRows, authorizationRowKey, type AuthorizationInsertRow } from '@/lib/personnel/authorization-batch'

const CONFIG = {
  authorizations: { table: 'staff_authorizations', schema: AuthorizationSchema },
  'training-plan': { table: 'staff_training_plan', schema: TrainingPlanSchema },
  competencies: { table: 'staff_competencies', schema: CompetencySchema },
} as const

const EnvelopeSchema = z.object({
  type: z.enum(['authorizations', 'training-plan', 'competencies']),
  profileIds: z.array(z.string().uuid()).min(1, 'เลือกบุคลากรอย่างน้อยหนึ่งคน'),
  payload: z.unknown(),
})

// Assign the same record to many staff at once (one row per profile). Admin/Manager only.
export async function POST(req: NextRequest) {
  const { actor, response } = await requirePersonnelManage()
  if (!actor) return response

  const envelope = EnvelopeSchema.safeParse(await req.json())
  if (!envelope.success) {
    return NextResponse.json({ error: envelope.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }
  const { type, profileIds, payload } = envelope.data
  const uniqueIds = [...new Set(profileIds)]

  if (type === 'authorizations') {
    const batch = AuthorizationBatchSchema.safeParse(payload)
    if (batch.success) {
      const batchPayload = batch.data
      const candidates = expandAuthorizationRows({
        profileIds: uniqueIds, testId: batchPayload.test_id ?? null, categories: batchPayload.categories, roles: batchPayload.roles,
        common: {
          competency_id: batchPayload.competency_id ?? null, authorized_date: batchPayload.authorized_date ?? null,
          status: 'active', notes: batchPayload.notes ?? null, created_by: actor.id,
        },
      })
      let existingQuery = supabaseAdmin
        .from('staff_authorizations')
        .select('profile_id,test_id,category,role_type')
        .in('profile_id', uniqueIds)
        .eq('status', 'active')
        .is('deleted_at', null)
      existingQuery = batchPayload.test_id != null
        ? existingQuery.eq('test_id', batchPayload.test_id)
        : existingQuery.is('test_id', null).in('category', batchPayload.categories)
      existingQuery = existingQuery.in('role_type', batchPayload.roles)

      const { data: existing, error: existingError } = await existingQuery
      if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })

      const existingKeys = new Set(((existing ?? []) as Pick<AuthorizationInsertRow, 'profile_id' | 'test_id' | 'category' | 'role_type'>[]).map(authorizationRowKey))
      const rows = candidates.filter((row) => !existingKeys.has(authorizationRowKey(row)))
      const skipped = candidates.length - rows.length
      if (rows.length > 0) {
        const { error } = await supabaseAdmin.from('staff_authorizations').insert(rows)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }

      supabaseAdmin.from('audit_log')
        .insert({ action: 'personnel.bulk.authorizations', user_id: actor.id, target: 'authorizations', detail: `created=${rows.length}; skipped=${skipped}; profiles=${uniqueIds.length}` })
        .then(undefined, () => {})
      return NextResponse.json({ ok: true, count: rows.length, skipped })
    }
  }

  const config = CONFIG[type]
  const parsed = config.schema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const rows = uniqueIds.map((profileId) => ({ ...parsed.data, profile_id: profileId, created_by: actor.id }))
  const { error } = await supabaseAdmin.from(config.table).insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log')
    .insert({ action: `personnel.bulk.${type}`, user_id: actor.id, target: type, detail: `${uniqueIds.length} คน` })
    .then(undefined, () => {})

  return NextResponse.json({ ok: true, count: uniqueIds.length })
}
