import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

// DELETE — reset read logs; Admin only
// ?scope=single&docId=<id>  → delete logs for one document
// ?scope=all                → delete all read logs
export async function DELETE(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (actor.role !== 'Admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const scope = req.nextUrl.searchParams.get('scope')
  const docId = req.nextUrl.searchParams.get('docId')

  if (scope === 'single') {
    if (!docId) return NextResponse.json({ error: 'docId required' }, { status: 400 })
    const { error } = await supabaseAdmin
      .from('document_access_logs')
      .delete()
      .eq('document_id', docId)
      .eq('action', 'view')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    supabaseAdmin.from('audit_log')
      .insert({ action: 'delete', user_id: actor.id, target: docId, detail: 'reset read logs (single document)' })
      .then(undefined, () => {})
    return NextResponse.json({ ok: true })
  }

  if (scope === 'all') {
    const { error } = await supabaseAdmin
      .from('document_access_logs')
      .delete()
      .eq('action', 'view')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    supabaseAdmin.from('audit_log')
      .insert({ action: 'delete', user_id: actor.id, target: 'all', detail: 'reset read logs (all documents)' })
      .then(undefined, () => {})
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'scope must be "single" or "all"' }, { status: 400 })
}
