import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['Admin', 'Manager'].includes(actor.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { ids }: { ids: number[] } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0)
      return NextResponse.json({ error: 'ไม่มีข้อมูล' }, { status: 422 })

    const { error } = await supabaseAdmin
      .from('tests')
      .update({ active: false, updated_by: actor.id, updated_at: new Date().toISOString() })
      .in('id', ids)

    if (error) throw error

    supabaseAdmin.from('audit_log').insert({
      action: 'test.bulk_delete', user_id: actor.id,
      target: `${ids.length} รายการ`, detail: `ids: ${ids.join(', ')}`,
    }).then(undefined, () => {})

    return NextResponse.json({ deleted: ids.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
