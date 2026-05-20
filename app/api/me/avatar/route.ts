import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 422 })

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${user.id}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  // Ensure bucket exists
  const { data: buckets } = await supabaseAdmin.storage.listBuckets()
  if (!buckets?.find((b) => b.id === 'avatars')) {
    await supabaseAdmin.storage.createBucket('avatars', { public: true })
  }

  const { error: upErr } = await supabaseAdmin.storage
    .from('avatars')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: { publicUrl } } = supabaseAdmin.storage.from('avatars').getPublicUrl(path)
  const url = `${publicUrl}?t=${Date.now()}`

  await supabaseAdmin.from('profiles').update({ avatar_url: url }).eq('id', user.id)

  return NextResponse.json({ url })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabaseAdmin.from('profiles').update({ avatar_url: null }).eq('id', user.id)
  return NextResponse.json({ success: true })
}
