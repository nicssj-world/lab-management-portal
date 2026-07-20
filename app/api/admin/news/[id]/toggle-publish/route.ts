import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const canEdit = ['Admin', 'Manager'].includes(actor.role)
  if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const { data: current } = await supabaseAdmin
    .from('news').select('id, published').eq('id', id).single()
  if (!current) return NextResponse.json({ error: 'ไม่พบข่าวสาร' }, { status: 404 })

  const { data: updated, error } = await supabaseAdmin
    .from('news')
    .update({ published: !current.published, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, published')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/')
  return NextResponse.json(updated)
}
