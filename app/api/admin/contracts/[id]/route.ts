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

interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['สัญญา'] ?? 'none') !== 'edit') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { vendor, product, total, start_date, end_date, contract_number, department, status, responsible_user_ids } = body
  const cleanResponsibleIds = Array.isArray(responsible_user_ids) ? responsible_user_ids.filter((rid: unknown) => typeof rid === 'string' && rid) : undefined

  const { data, error } = await supabaseAdmin
    .from('contracts')
    .update({ vendor, product, total: total != null ? Number(total) : undefined, start_date: start_date || null, end_date: end_date || null, contract_number: contract_number || null, department: department || null, status, responsible_user_ids: cleanResponsibleIds })
    .eq('id', Number(id))
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  supabaseAdmin.from('audit_log').insert({
    action: 'contract.update',
    user_id: actor.id,
    target: data.contract_number ?? id,
    detail: `${data.contract_number} · ${data.product}`,
  }).then(undefined, () => {})
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['สัญญา'] ?? 'none') !== 'edit') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { data: deleted, error } = await supabaseAdmin.from('contracts').delete().eq('id', Number(id)).select('contract_number, product').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  supabaseAdmin.from('audit_log').insert({
    action: 'contract.delete',
    user_id: actor.id,
    target: deleted?.contract_number ?? id,
    detail: `${deleted?.contract_number} · ${deleted?.product}`,
  }).then(undefined, () => {})
  return new NextResponse(null, { status: 204 })
}
