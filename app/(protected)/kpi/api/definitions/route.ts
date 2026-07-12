import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getDefinitions } from '@/lib/queries/kpi'
import { definitionSchema } from '@/lib/validations/kpi-definition'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await getDefinitions(supabase)
  return NextResponse.json(data)
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).maybeSingle()
  if (!data || data.role?.toLowerCase() !== 'admin') return null
  return data as { id: string; role: string }
}

export async function POST(req: NextRequest) {
  const actor = await requireAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = definitionSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })

  const body = parsed.data
  // Auto-assign sort_order (max + 10) when not provided
  let sort_order = body.sort_order
  if (sort_order === undefined) {
    const { data: last } = await supabaseAdmin
      .from('kpi_definitions').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
    sort_order = (last?.sort_order ?? 0) + 10
  }

  const { data, error } = await supabaseAdmin
    .from('kpi_definitions')
    .insert({ ...body, sort_order })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `รหัส ${body.code} มีอยู่แล้ว` }, { status: 422 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  supabaseAdmin.from('audit_log').insert({
    action: 'kpi.definition.create', user_id: actor.id, target: body.code, detail: `เพิ่มตัวชี้วัด ${body.name_th}`,
  }).then(undefined, () => {})

  return NextResponse.json(data)
}
