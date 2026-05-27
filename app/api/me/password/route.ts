import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { oldPassword, newPassword } = await req.json()
  if (!oldPassword || !newPassword) return NextResponse.json({ error: 'Missing fields' }, { status: 422 })
  if (newPassword.length < 6) return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }, { status: 422 })

  // Verify old password using an isolated client (does not touch browser session)
  const verifyClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { error: signInErr } = await verifyClient.auth.signInWithPassword({ email: user.email, password: oldPassword })
  if (signInErr) return NextResponse.json({ error: 'รหัสผ่านเดิมไม่ถูกต้อง' }, { status: 400 })

  // Change password via admin (no session side-effects)
  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: newPassword })
  if (error) return NextResponse.json({ error: 'เปลี่ยนรหัสผ่านไม่สำเร็จ' }, { status: 500 })

  return NextResponse.json({ success: true })
}
