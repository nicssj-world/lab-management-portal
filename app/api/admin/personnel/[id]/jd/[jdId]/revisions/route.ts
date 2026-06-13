import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireResource } from '@/lib/auth/guards'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ jdId: string }> }) {
  const { actor, response } = await requireResource('บุคลากร', 'view')
  if (!actor) return response
  const { jdId } = await ctx.params
  const { data, error } = await supabaseAdmin
    .from('staff_jd_revisions')
    .select('*')
    .eq('jd_id', jdId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}
