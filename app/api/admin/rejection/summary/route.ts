import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

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
  const year        = sp.get('year')        ? parseInt(sp.get('year')!)        : null
  const month       = sp.get('month')       ? parseInt(sp.get('month')!)       : null
  const filter_year = sp.get('filter_year') || null
  const work        = sp.get('work')        || null

  const { data, error } = await supabaseAdmin.rpc('get_rejection_summary', {
    p_year:        year,
    p_month:       month,
    p_filter_year: filter_year,
    p_work:        work,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
