import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { refreshLabWorkloadSummary } from '@/lib/workload/refresh-summary'
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

const rowSchema = z.object({
  hn: z.string(),
  register_at: z.string(),
  queue_confirmed_at: z.string().optional(),
  phleb_done_at: z.string(),
  wait_minutes: z.number(),
  draw_minutes: z.number().optional(),
  labzone_name: z.string().nullable().optional(),
  phlebotomist: z.string().nullable().optional(),
  phleb_date: z.string(),
})

const bodySchema = z.object({
  upload_id: z.string().uuid(),
  rows: z.array(rowSchema),
  chunk_index: z.number().int().min(0),
  is_last_chunk: z.boolean(),
})

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if (perms['TAT'] !== 'edit') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 422 })
  const { upload_id, rows, is_last_chunk } = parsed.data

  const { data: upload } = await supabaseAdmin
    .from('phleb_uploads')
    .select('id, year, month')
    .eq('id', upload_id)
    .maybeSingle()
  if (!upload) return NextResponse.json({ error: 'Upload not found' }, { status: 404 })

  const records = rows.map(r => ({
    upload_id,
    year: upload.year,
    month: upload.month,
    hn: r.hn,
    register_at: r.register_at,
    queue_confirmed_at: r.queue_confirmed_at ?? r.register_at,
    phleb_done_at: r.phleb_done_at,
    wait_minutes: r.wait_minutes,
    draw_minutes: r.draw_minutes ?? r.wait_minutes,
    labzone_name: r.labzone_name ?? null,
    phlebotomist: r.phlebotomist ?? null,
    phleb_date: r.phleb_date,
  }))

  let insertedCount = 0
  if (records.length > 0) {
    const { data: inserted, error } = await supabaseAdmin
      .from('phlebotomy_records')
      .insert(records)
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    insertedCount = inserted?.length ?? 0
  }

  let needs_rejoin = false

  if (is_last_chunk) {
    const { count } = await supabaseAdmin
      .from('phlebotomy_records')
      .select('id', { count: 'exact', head: true })
      .eq('upload_id', upload_id)
    await supabaseAdmin
      .from('phleb_uploads')
      .update({ row_count: count ?? 0 })
      .eq('id', upload_id)

    const { count: tatCount } = await supabaseAdmin
      .from('tat_uploads')
      .select('id', { count: 'exact', head: true })
      .eq('year', upload.year)
      .eq('month', upload.month)
    needs_rejoin = (tatCount ?? 0) > 0

    try {
      await refreshLabWorkloadSummary(upload.year, upload.month)
    } catch (err) {
      console.warn('refreshLabWorkloadSummary failed after phlebotomy upload', err)
    }
    await invalidateAnalysisCache(upload.year, upload.month)
  }

  return NextResponse.json({ inserted: insertedCount, skipped: 0, joined: false, needs_rejoin })
}
