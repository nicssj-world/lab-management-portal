import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role, name').eq('id', user.id).single()
  return data as { id: string; role: string; name: string } | null
}

interface Params { params: Promise<{ id: string }> }

function normalizeUsageMonth(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = value.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/)
  if (!match) return null
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return `${match[1]}-${match[2]}-01`
}

export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('contract_usage')
    .select('*')
    .eq('contract_id', Number(id))
    .order('usage_month', { ascending: false, nullsFirst: false })
    .order('usage_date', { ascending: false, nullsFirst: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['สัญญา'] ?? 'none') !== 'edit') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { amount, note, usage_date, usage_month } = body
  const numericAmount = Number(amount)
  const month = normalizeUsageMonth(usage_month)
  if (!amount || isNaN(numericAmount)) return NextResponse.json({ error: 'amount จำเป็น' }, { status: 422 })

  if (!month) return NextResponse.json({ error: 'usage_month is required' }, { status: 422 })

  const { data: contract, error: contractErr } = await supabaseAdmin
    .from('contracts')
    .select('total, contract_usage(amount)')
    .eq('id', Number(id))
    .single()

  if (contractErr) return NextResponse.json({ error: contractErr.message }, { status: 500 })

  const used = ((contract.contract_usage as { amount: number | null }[] | null) ?? [])
    .reduce((sum, row) => sum + (row.amount ?? 0), 0)
  const remaining = Number(contract.total ?? 0) - used
  if (numericAmount > remaining) {
    return NextResponse.json({ error: 'จำนวนเงินเกินมูลค่าคงเหลือ' }, { status: 422 })
  }

  const date = usage_date || new Date().toISOString().split('T')[0]
  const { data, error } = await supabaseAdmin
    .from('contract_usage')
    .insert({ contract_id: Number(id), amount: numericAmount, note: note || null, usage_date: date, usage_month: month, recorded_by: actor.name })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  supabaseAdmin.from('audit_log').insert({
    action: 'contract.usage_add',
    user_id: actor.id,
    target: id,
    detail: `${numericAmount.toLocaleString('th-TH')} บาท${note ? ' · ' + note : ''}`,
  }).then(undefined, () => {})
  return NextResponse.json(data, { status: 201 })
}
