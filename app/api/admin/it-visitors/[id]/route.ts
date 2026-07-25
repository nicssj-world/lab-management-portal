import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditIt } from '@/lib/it-access/guard'
import { canDeleteVisitorLog, requireVisitorLog } from '@/lib/it-visitor/guard'
import { ItVisitorUpdateSchema } from '@/lib/validations/it-visitor'

const SELECT = '*, closer:profiles!it_visitor_logs_closed_by_fkey(id, name)'

// PATCH ทำทั้งแก้ไขข้อมูลและ "บันทึกเวลาออก" — การปิดเวลาออกคือการ set exited_at
// จึงไม่ต้องมี route แยก แต่ต้องตามด้วย closed_by/closed_at เพื่อให้รู้ว่าใครปิด
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireVisitorLog('edit')
  if ('error' in guard) return guard.error
  const actor = guard.actor
  const { id } = await params

  const parsed = ItVisitorUpdateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const { data: before } = await supabaseAdmin
    .from('it_visitor_logs').select('entered_at, exited_at').eq('id', id).maybeSingle()
  if (!before) return NextResponse.json({ error: 'ไม่พบบันทึก' }, { status: 404 })

  const entered = parsed.data.entered_at ?? before.entered_at
  const exited = 'exited_at' in parsed.data ? parsed.data.exited_at : before.exited_at
  if (entered && exited && new Date(exited).getTime() < new Date(entered).getTime()) {
    return NextResponse.json({ error: 'เวลาออกต้องไม่ก่อนเวลาเข้า' }, { status: 422 })
  }

  const patch: Record<string, unknown> = { ...parsed.data }
  // บันทึกผู้ปิดเฉพาะตอนที่เปลี่ยนจาก "ยังอยู่ในพื้นที่" เป็นมีเวลาออก
  if (exited && !before.exited_at) {
    patch.closed_by = actor.id
    patch.closed_at = new Date().toISOString()
  } else if (!exited && before.exited_at) {
    patch.closed_by = null
    patch.closed_at = null
  }

  const { data, error } = await supabaseAdmin
    .from('it_visitor_logs').update(patch).eq('id', id).select(SELECT).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const action = exited && !before.exited_at ? 'it_visitor.checkout' : 'it_visitor.update'
  const detail = exited && !before.exited_at ? 'บันทึกเวลาออก' : 'แก้ไขบันทึกการเข้า-ออก'
  auditIt(action, actor.id, id, detail)
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireVisitorLog('edit')
  if ('error' in guard) return guard.error
  const actor = guard.actor
  // บันทึกการเข้า-ออกเป็นหลักฐาน ISO — ผู้มีสิทธิ์ edit แก้ไขได้ แต่ลบได้เฉพาะ Admin
  if (!canDeleteVisitorLog(actor)) {
    return NextResponse.json({ error: 'ลบบันทึกได้เฉพาะผู้ดูแลระบบ' }, { status: 403 })
  }
  const { id } = await params

  const { error } = await supabaseAdmin.from('it_visitor_logs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  auditIt('it_visitor.delete', actor.id, id, 'ลบบันทึกการเข้า-ออก')
  return NextResponse.json({ ok: true })
}
