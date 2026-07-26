import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auditSafety, requireSafetyAdmin, requireSafetyViewer } from '@/lib/lab-map/safety-access'
import { normalizeRole } from '@/lib/roles'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const guard = await requireSafetyViewer()
  if (guard.response) return guard.response
  const { data, error } = await supabaseAdmin.from('lab_map_safety_editors')
    .select('user_id, created_at').order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const userIds = (data ?? []).map(row => String(row.user_id))
  const { data: profiles } = userIds.length
    ? await supabaseAdmin.from('profiles').select('id, name, role').in('id', userIds)
    : { data: [] }
  const profileById = new Map((profiles ?? []).map(profile => [String(profile.id), profile]))
  return NextResponse.json({ items: (data ?? []).map(row => ({
    ...row, profile: profileById.get(String(row.user_id)) ?? null,
  })) })
}

export async function PATCH(req: NextRequest) {
  const guard = await requireSafetyAdmin()
  if (guard.response) return guard.response
  const parsed = z.object({ userId: z.string().uuid(), enabled: z.boolean() }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })
  const { userId, enabled } = parsed.data
  const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('id, role').eq('id', userId).maybeSingle()
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: 'ไม่พบบุคลากรที่ต้องการกำหนดสิทธิ์' }, { status: 404 })
  const automaticEditor = ['Admin', 'Manager'].includes(normalizeRole(profile.role as string | null))
  if (automaticEditor && enabled) {
    return NextResponse.json({ error: 'Admin และ Manager มีสิทธิ์อัตโนมัติอยู่แล้ว ไม่ต้องมอบหมายซ้ำ' }, { status: 422 })
  }
  const result = enabled
    ? await supabaseAdmin.from('lab_map_safety_editors').upsert({ user_id: userId, created_by: guard.actor.id })
    : await supabaseAdmin.from('lab_map_safety_editors').delete().eq('user_id', userId)
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  try { await auditSafety(enabled ? 'lab_map.safety_editor.grant' : 'lab_map.safety_editor.revoke', guard.actor.id, userId) }
  catch (auditError) { return NextResponse.json({ error: (auditError as Error).message }, { status: 500 }) }
  return NextResponse.json({ userId, enabled })
}
