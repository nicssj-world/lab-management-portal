import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { invalidateAnalysisCache } from '@/lib/analysis-cache'
import { NextRequest, NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if (perms['TAT'] !== 'edit') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { year, month, file_name } = body as { year: number; month: number; file_name: string }
  if (!year || !month || !file_name)
    return NextResponse.json({ error: 'year, month, file_name required' }, { status: 422 })

  await invalidateAnalysisCache(year, month)

  const { data: existing } = await supabaseAdmin
    .from('tat_uploads')
    .select('id')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  let upload_id: string

  if (existing) {
    // Monthly TAT exports are treated as snapshots. Re-upload replaces the month
    // so parsing/target logic changes can be applied to existing data.
    const { error: deleteErr } = await supabaseAdmin
      .from('tat_records')
      .delete()
      .eq('upload_id', existing.id)
    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

    await supabaseAdmin
      .from('tat_uploads')
      .update({ file_name, row_count: 0, uploaded_by: actor.id, uploaded_at: new Date().toISOString() })
      .eq('id', existing.id)
    upload_id = existing.id
  } else {
    const { data: newUpload, error } = await supabaseAdmin
      .from('tat_uploads')
      .insert({ year, month, file_name, row_count: 0, uploaded_by: actor.id })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    upload_id = newUpload.id
  }

  return NextResponse.json({ upload_id })
}
