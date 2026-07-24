import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requirePersonnelManage } from '@/lib/auth/guards'
import { AuthorizationSchema, TrainingPlanSchema, CompetencySchema } from '@/lib/validations/personnel'

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
  const config = CONFIG[type]
  const parsed = config.schema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const uniqueIds = [...new Set(profileIds)]
  const rows = uniqueIds.map((profileId) => ({ ...parsed.data, profile_id: profileId, created_by: actor.id }))
  const { error } = await supabaseAdmin.from(config.table).insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log')
    .insert({ action: `personnel.bulk.${type}`, user_id: actor.id, target: type, detail: `${uniqueIds.length} คน` })
    .then(undefined, () => {})

  return NextResponse.json({ ok: true, count: uniqueIds.length })
}
