import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { createSignatureSignedUrl } from '@/lib/signatures'
import { ensureOwnProfile } from '@/lib/auth/profile'

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await ensureOwnProfile(user)

  return NextResponse.json({
    ...data,
    signature_signed_url: await createSignatureSignedUrl(data.signature_url),
  })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureOwnProfile(user)

  const body = await req.json()
  const allowed = ['name', 'avatar_url', 'document_position'] as const
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
  return NextResponse.json({ success: true, ...updates })
}
