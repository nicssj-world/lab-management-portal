import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, role, dept, avatar_url, doc_role')
    .eq('id', user.id)
    .single()

  if (error) {
    const { data: basic } = await supabaseAdmin
      .from('profiles')
      .select('id, name, role, dept, doc_role')
      .eq('id', user.id)
      .single()
    return NextResponse.json(basic ? { ...basic, avatar_url: null } : { error: 'Not found' })
  }

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['name', 'avatar_url'] as const
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'No valid fields' }, { status: 422 })

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
