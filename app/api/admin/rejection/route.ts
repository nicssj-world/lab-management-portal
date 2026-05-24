import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { getRejectionLogs } from '@/lib/queries/rejection'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id,role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const { data, count, error } = await getRejectionLogs(supabaseAdmin, {
    year:   sp.get('year')   ? parseInt(sp.get('year')!)   : undefined,
    month:  sp.get('month')  ? parseInt(sp.get('month')!)  : undefined,
    reject: sp.get('reject') || undefined,
    page:   sp.get('page')   ? parseInt(sp.get('page')!)   : 1,
    limit:  50,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count })
}

// DELETE /api/admin/rejection?month=YYYY-MM
// Deletes all rejection_logs where spcmdate is within the given month.
// Works for both CE (2024-03) and BE (2567-03) stored values.
export async function DELETE(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const perms = await getRolePermissions(actor.role)
  if (perms['ความเสี่ยง / Rejection'] !== 'edit') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const month = new URL(req.url).searchParams.get('month') // 'YYYY-MM'
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 })
  }

  const [y, m] = month.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { count, error } = await supabaseAdmin
    .from('rejection_logs')
    .delete({ count: 'exact' })
    .gte('spcmdate', start)
    .lte('spcmdate', end)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Remove matching rejection_uploads record too
  await supabaseAdmin
    .from('rejection_uploads')
    .delete()
    .eq('data_month', month)
    .then(undefined, () => {})

  return NextResponse.json({ deleted: count ?? 0 })
}
