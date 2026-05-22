import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('contracts')
    .select('*, contract_usage(amount)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const contracts = (data ?? []).map((c: any) => ({
    ...c,
    used: (c.contract_usage as { amount: number }[])?.reduce((s: number, u: { amount: number }) => s + (u.amount ?? 0), 0) ?? 0,
  }))
  return NextResponse.json(contracts)
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['สัญญา'] ?? 'none') !== 'edit') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { vendor, product, total, start_date, end_date, contract_number, department, status } = body
  if (!contract_number?.trim() || !product?.trim() || total == null || !start_date || !end_date) {
    return NextResponse.json({ error: 'เลขที่สัญญา ชื่อสัญญา มูลค่าสัญญา วันที่เริ่ม และวันที่สิ้นสุด จำเป็น' }, { status: 422 })
  }
  const cleanContractNumber = contract_number.trim()

  const { data: existing, error: dupErr } = await supabaseAdmin
    .from('contracts')
    .select('id, contract_number')

  if (dupErr) return NextResponse.json({ error: dupErr.message }, { status: 500 })
  const duplicate = (existing ?? []).some((c: { contract_number: string | null }) =>
    (c.contract_number ?? '').trim().toLowerCase() === cleanContractNumber.toLowerCase()
  )
  if (duplicate) {
    return NextResponse.json({ error: 'เลขที่สัญญานี้มีอยู่แล้ว' }, { status: 409 })
  }

  const { data, error } = await supabaseAdmin
    .from('contracts')
    .insert({ vendor, product, total: Number(total), start_date: start_date || null, end_date: end_date || null, contract_number: cleanContractNumber, department: department || null, status: status || 'active' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, used: 0 }, { status: 201 })
}
