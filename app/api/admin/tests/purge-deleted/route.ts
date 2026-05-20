import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

// GET — count soft-deleted tests
export async function GET() {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['Admin', 'Manager'].includes(actor.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { count, error } = await supabaseAdmin
      .from('tests')
      .select('*', { count: 'exact', head: true })
      .eq('active', false)

    if (error) throw error
    return NextResponse.json({ count: count ?? 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE — hard delete all soft-deleted tests
export async function DELETE() {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['Admin', 'Manager'].includes(actor.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { count, error } = await supabaseAdmin
      .from('tests')
      .delete({ count: 'exact' })
      .eq('active', false)

    if (error) throw error

    supabaseAdmin.from('audit_log').insert({
      action: 'test.purge_deleted',
      user_id: actor.id,
      target: `${count ?? 0} รายการ`,
      detail: 'Hard deleted all inactive tests',
    }).then(undefined, () => {})

    return NextResponse.json({ purged: count ?? 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
