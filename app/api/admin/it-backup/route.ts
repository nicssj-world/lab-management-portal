import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireIt, auditIt } from '@/lib/it-access/guard'
import { getItBackupLogs } from '@/lib/queries/it-access'
import { ItBackupSchema } from '@/lib/validations/it-access'

export async function GET() {
  const guard = await requireIt('view')
  if ('error' in guard) return guard.error
  const items = await getItBackupLogs(supabaseAdmin)
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const guard = await requireIt('edit')
  if ('error' in guard) return guard.error
  const actor = guard.actor

  const parsed = ItBackupSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const { data, error } = await supabaseAdmin
    .from('it_backup_logs')
    .insert({ ...parsed.data, performed_by: parsed.data.performed_by || null, created_by: actor.id })
    .select('*, system:it_systems(name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const systemName = (data as { system?: { name?: string } }).system?.name ?? ''
  const activityLabel = parsed.data.activity === 'restore_test' ? 'ทดสอบกู้คืน' : 'สำรองข้อมูล'
  auditIt('it_backup.create', actor.id, data.id, `${systemName} · ${activityLabel}`)
  return NextResponse.json(data, { status: 201 })
}
