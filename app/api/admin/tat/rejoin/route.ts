import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { rejoinTatBatch } from '@/lib/tat/rejoin-batch'
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

const bodySchema = z.object({
  year: z.number().int().min(2000),
  month: z.number().int().min(1).max(12),
})

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if (perms['TAT'] !== 'edit') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 422 })
  const { year, month } = parsed.data

  const result = await rejoinTatBatch(year, month, true)
  await refreshLabWorkloadSummary(year, month)
  await invalidateAnalysisCache(year, month)

  return NextResponse.json({ ok: true, ...result })
}
