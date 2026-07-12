import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { DEPARTMENTS } from '@/lib/validations/user-schema'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role, doc_role, name').eq('id', user.id).single()
  return data as { id: string; role: string; doc_role: string | null; name: string | null } | null
}

// Bulk-assign the read audience for many documents at once. If both depts and user_ids
// are null/empty, the restriction is cleared and the whole division must read.
export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const canAssign = actor.role === 'Admin' || actor.role === 'Document Controller' || actor.doc_role === 'Document Controller'
  if (!canAssign) return NextResponse.json({ error: 'เฉพาะ Admin หรือ Document Controller เท่านั้น' }, { status: 403 })

  const body = await req.json().catch(() => null) as { ids?: unknown; depts?: unknown; user_ids?: unknown } | null
  const ids = Array.from(new Set(Array.isArray(body?.ids) ? body.ids.filter((v): v is string => typeof v === 'string') : []))
  if (ids.length === 0) return NextResponse.json({ error: 'ไม่มีรายการเอกสาร' }, { status: 422 })

  let depts: string[] | null = null
  if (body?.depts != null) {
    if (!Array.isArray(body.depts) || !body.depts.every((d): d is string => typeof d === 'string')) {
      return NextResponse.json({ error: 'รูปแบบรายชื่อแผนกไม่ถูกต้อง' }, { status: 422 })
    }
    const invalid = body.depts.filter((d) => !(DEPARTMENTS as readonly string[]).includes(d))
    if (invalid.length > 0) {
      return NextResponse.json({ error: `ไม่รู้จักแผนก: ${invalid.join(', ')}` }, { status: 422 })
    }
    depts = body.depts.length > 0 ? Array.from(new Set(body.depts)) : null
  }

  let userIds: string[] | null = null
  if (body?.user_ids != null) {
    if (!Array.isArray(body.user_ids) || !body.user_ids.every((id): id is string => typeof id === 'string')) {
      return NextResponse.json({ error: 'รูปแบบรายชื่อบุคคลไม่ถูกต้อง' }, { status: 422 })
    }
    const normalizedUserIds = Array.from(new Set(body.user_ids))
    if (normalizedUserIds.length > 0) {
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .in('id', normalizedUserIds)
        .eq('status', 'active')
      if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

      const found = new Set((profiles ?? []).map((p) => p.id))
      const unknown = normalizedUserIds.filter((id) => !found.has(id))
      if (unknown.length > 0) {
        return NextResponse.json({ error: `ไม่พบผู้ใช้ active: ${unknown.join(', ')}` }, { status: 422 })
      }
    }
    userIds = normalizedUserIds.length > 0 ? normalizedUserIds : null
  }

  const { data, error } = await supabaseAdmin
    .from('documents')
    .update({ read_audience_depts: depts, read_audience_user_ids: userIds })
    .in('id', ids)
    .is('deleted_at', null)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const deptDetail = depts && depts.length > 0 ? depts.join(', ') : ''
  const userDetail = userIds && userIds.length > 0 ? `รายบุคคล ${userIds.length} คน` : ''
  const detail = deptDetail || userDetail
    ? `กำหนดกลุ่มผู้อ่าน: ${[deptDetail, userDetail].filter(Boolean).join(' + ')}`
    : 'กำหนดกลุ่มผู้อ่าน: ทั้งกลุ่มงาน'

  supabaseAdmin.from('audit_log').insert({
    action: 'document.read_audience_bulk',
    user_id: actor.id,
    target: `${data?.length ?? 0} documents`,
    detail,
  }).then(undefined, () => {})

  return NextResponse.json({ updated: (data ?? []).map((d) => d.id), depts, user_ids: userIds })
}
