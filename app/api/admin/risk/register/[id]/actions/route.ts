import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { auditRisk, canReviewRisk, getRiskActor } from '@/lib/risk/access'
import { registerActionPatchSchema, registerActionSchema } from '@/lib/validations/risk-register'

type Params = { params: Promise<{ id: string }> }

/** ทะเบียนที่ยังมีมาตรการค้างถือว่ากำลังจัดการ ปิดครบแล้วจึงเข้าสู่ช่วงติดตามผล */
async function syncRegisterStatus(registerId: number) {
  const { data: register } = await supabaseAdmin
    .from('risk_register')
    .select('status')
    .eq('id', registerId)
    .single()

  // สถานะที่ตัดสินใจไปแล้ว (ยอมรับความเสี่ยง / ปิด) ต้องไม่ถูกย้อนโดยการแก้มาตรการ
  if (!register || register.status === 'closed' || register.status === 'accepted') return

  const { data: actions } = await supabaseAdmin
    .from('risk_actions')
    .select('status')
    .eq('register_id', registerId)

  if (!actions || actions.length === 0) return

  const hasOpen = actions.some(a => a.status !== 'done')
  await supabaseAdmin
    .from('risk_register')
    .update({ status: hasOpen ? 'treating' : 'monitoring', updated_at: new Date().toISOString() })
    .eq('id', registerId)
}

export async function POST(req: NextRequest, { params }: Params) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReviewRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const registerId = Number(id)
  const parsed = registerActionSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  const { data, error } = await supabaseAdmin
    .from('risk_actions')
    .insert({ ...parsed.data, register_id: registerId, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await syncRegisterStatus(registerId)
  auditRisk('register.action.create', actor.id, id, parsed.data.description.slice(0, 120))
  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReviewRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const registerId = Number(id)
  const parsed = registerActionPatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }
  const { id: actionId, ...patch } = parsed.data

  const { data, error } = await supabaseAdmin
    .from('risk_actions')
    .update({
      ...patch,
      ...(patch.status === 'done' ? { completed_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', actionId)
    .eq('register_id', registerId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await syncRegisterStatus(registerId)
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canReviewRisk(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const actionId = Number(req.nextUrl.searchParams.get('actionId'))
  if (!actionId) return NextResponse.json({ error: 'ไม่ได้ระบุมาตรการที่ต้องการลบ' }, { status: 422 })

  const { error } = await supabaseAdmin
    .from('risk_actions')
    .delete()
    .eq('id', actionId)
    .eq('register_id', Number(id))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await syncRegisterStatus(Number(id))
  return NextResponse.json({ ok: true })
}
