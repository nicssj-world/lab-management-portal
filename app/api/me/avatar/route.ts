import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { ensureOwnProfile, isProfileNotProvisionedError } from '@/lib/auth/profile'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const AVATAR_EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await ensureOwnProfile(user)
  } catch (err) {
    if (isProfileNotProvisionedError(err)) return NextResponse.json({ error: err.message }, { status: 403 })
    throw err
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 422 })
  if (!AVATAR_EXT_BY_TYPE[file.type]) {
    return NextResponse.json({ error: 'Only JPG, PNG, WebP, or GIF images are allowed' }, { status: 415 })
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: 'Avatar image must be 2 MB or smaller' }, { status: 413 })
  }

  const ext = AVATAR_EXT_BY_TYPE[file.type]
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

  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', user.id)
    .select('id')
    .single()

  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })

  return NextResponse.json({ url })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await ensureOwnProfile(user)
  } catch (err) {
    if (isProfileNotProvisionedError(err)) return NextResponse.json({ error: err.message }, { status: 403 })
    throw err
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', user.id)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
