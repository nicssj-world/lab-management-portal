import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { invalidateAnalysisCache } from '@/lib/analysis-cache'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

const bodySchema = z.object({
  year: z.number().int().min(2000),
  month: z.number().int().min(1).max(12),
  file_name: z.string().min(1),
  total_rows: z.number().int().min(0),
})

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if (perms['TAT'] !== 'edit') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 422 })
  const { year, month, file_name } = parsed.data

  await invalidateAnalysisCache(year, month)

  const { data: existing } = await supabaseAdmin
    .from('phleb_uploads')
    .select('id')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  let upload_id: string

  if (existing) {
    await supabaseAdmin.from('phlebotomy_records').delete().eq('upload_id', existing.id)
    await supabaseAdmin
      .from('phleb_uploads')
      .update({ file_name, row_count: 0, uploaded_by: actor.id, uploaded_at: new Date().toISOString() })
      .eq('id', existing.id)
    upload_id = existing.id
  } else {
    const { data: newUpload, error } = await supabaseAdmin
      .from('phleb_uploads')
      .insert({ year, month, file_name, row_count: 0, uploaded_by: actor.id })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    upload_id = newUpload.id
  }

  supabaseAdmin.from('audit_log').insert({
    action: 'phleb_upload_init', user_id: actor.id,
    target: upload_id, detail: { year, month, file_name },
  }).then(undefined, () => {})

  return NextResponse.json({ upload_id })
}
