import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()
  if (!['Admin', 'Manager'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const form = await req.formData()
  const file = form.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 400 })

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'รองรับเฉพาะไฟล์รูปภาพ' }, { status: 422 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'ขนาดไฟล์เกิน 5 MB' }, { status: 422 })
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const key = `news-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const bytes = await file.arrayBuffer()

  // Ensure the public bucket exists (no-op if it already does)
  await supabaseAdmin.storage.createBucket('news', { public: true }).catch(() => {})

  const { error } = await supabaseAdmin.storage
    .from('news')
    .upload(key, bytes, { contentType: file.type, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabaseAdmin.storage.from('news').getPublicUrl(key)

  return NextResponse.json({ url: publicUrl })
}
