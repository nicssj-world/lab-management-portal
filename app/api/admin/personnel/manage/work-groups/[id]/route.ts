import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requirePersonnelManage } from '@/lib/auth/guards'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { actor, response } = await requirePersonnelManage()
  if (!actor) return response
  const { id } = await params
  const { error } = await supabaseAdmin.from('personnel_work_groups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
