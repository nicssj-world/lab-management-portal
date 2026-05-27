import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { rejoinTatBatchStep } from '@/lib/tat/rejoin-batch'
import { warmTatSummaryCache } from '@/lib/tat/summary-cache'
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
  cursor: z.string().uuid().nullable().optional(),
})

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if (perms['TAT'] !== 'edit') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 422 })
  const { year, month, cursor = null } = parsed.data

  let result
  try {
    result = await rejoinTatBatchStep(year, month, cursor, true)
  } catch (err) {
    console.error('Manual TAT rejoin failed', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Rejoin failed' },
      { status: 500 },
    )
  }

  let warning: string | null = null

  if (result.done) {
    try {
      await refreshLabWorkloadSummary(year, month)
    } catch (err) {
      console.error('Refresh workload summary failed after manual TAT rejoin', err)
      warning = err instanceof Error ? err.message : 'Refresh workload summary failed'
    }

    await invalidateAnalysisCache(year, month)

    try {
      await warmTatSummaryCache(year, month)
    } catch (err) {
      warning = warning ?? (err instanceof Error ? err.message : 'Warm TAT summary cache failed')
      console.warn('Warm TAT summary cache failed after manual TAT rejoin', err)
    }
  }

  return NextResponse.json({ ok: true, ...result, warning })
}
