import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { refreshLabWorkloadSummary } from '@/lib/workload/refresh-summary'
import { invalidateAnalysisCache } from '@/lib/analysis-cache'
import { NextRequest, NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if (perms['TAT'] !== 'edit') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  // Fetch year/month before deleting (for rejoin reset)
  const { data: upload } = await supabaseAdmin
    .from('tat_uploads')
    .select('year, month')
    .eq('id', id)
    .maybeSingle()
  if (!upload) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabaseAdmin.from('tat_uploads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await refreshLabWorkloadSummary(upload.year, upload.month)
  await invalidateAnalysisCache(upload.year, upload.month)

  return NextResponse.json({ ok: true })
}
