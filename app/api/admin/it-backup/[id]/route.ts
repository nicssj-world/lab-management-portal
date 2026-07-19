import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireIt, auditIt } from '@/lib/it-access/guard'
import { ItBackupUpdateSchema } from '@/lib/validations/it-access'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireIt('edit')
  if ('error' in guard) return guard.error
  const actor = guard.actor
  const { id } = await params

  const parsed = ItBackupUpdateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }
  const patch = { ...parsed.data }
  if ('performed_by' in patch) patch.performed_by = patch.performed_by || null

  const { data, error } = await supabaseAdmin
    .from('it_backup_logs').update(patch).eq('id', id)
    .select('*, system:it_systems(name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const systemName = (data as { system?: { name?: string } }).system?.name ?? ''
  auditIt('it_backup.update', actor.id, id, systemName)
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireIt('edit')
  if ('error' in guard) return guard.error
  const actor = guard.actor
  const { id } = await params

  const { error } = await supabaseAdmin.from('it_backup_logs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  auditIt('it_backup.delete', actor.id, id, 'ลบบันทึกการสำรองข้อมูล')
  return NextResponse.json({ ok: true })
}
