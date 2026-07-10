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

// Bulk-assign the read audience (which profile departments must read) for many documents at
// once. depts = null clears the restriction (whole division must read).
export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const canAssign = actor.role === 'Admin' || actor.role === 'Document Controller' || actor.doc_role === 'Document Controller'
  if (!canAssign) return NextResponse.json({ error: 'เฉพาะ Admin หรือ Document Controller เท่านั้น' }, { status: 403 })

  const body = await req.json().catch(() => null) as { ids?: unknown; depts?: unknown } | null
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v): v is string => typeof v === 'string') : []
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
    depts = body.depts.length > 0 ? body.depts : null
  }

  const { data, error } = await supabaseAdmin
    .from('documents')
    .update({ read_audience_depts: depts })
    .in('id', ids)
    .is('deleted_at', null)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('audit_log').insert({
    action: 'document.read_audience_bulk',
    user_id: actor.id,
    target: `${data?.length ?? 0} documents`,
    detail: depts ? `กำหนดกลุ่มผู้อ่าน: ${depts.join(', ')}` : 'กำหนดกลุ่มผู้อ่าน: ทั้งกลุ่มงาน',
  }).then(undefined, () => {})

  return NextResponse.json({ updated: (data ?? []).map((d) => d.id), depts })
}
