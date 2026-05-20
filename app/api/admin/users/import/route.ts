import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { createUserSchema } from '@/lib/validations/user-schema'
import { createUser } from '@/lib/services/users'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('profiles').select('id, role').eq('id', user.id).single()
  if (!data || data.role?.toLowerCase() !== 'admin') return null
  return data as { id: string; role: string }
}

export async function POST(req: NextRequest) {
  const actor = await requireAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let rows: unknown[]
  try {
    const body = await req.json()
    rows = Array.isArray(body.users) ? body.users : []
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  if (rows.length === 0) return NextResponse.json({ error: 'ไม่มีข้อมูลที่จะนำเข้า' }, { status: 422 })
  if (rows.length > 200) return NextResponse.json({ error: 'นำเข้าได้สูงสุด 200 รายการต่อครั้ง' }, { status: 422 })

  const results: { row: number; success: boolean; name?: string; error?: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const parsed = createUserSchema.safeParse(rows[i])
    if (!parsed.success) {
      results.push({ row: i + 1, success: false, error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' })
      continue
    }
    try {
      const profile = await createUser(parsed.data, actor.id)
      results.push({ row: i + 1, success: true, name: profile.name })
    } catch (err) {
      results.push({ row: i + 1, success: false, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' })
    }
  }

  const succeeded = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success)

  return NextResponse.json({ succeeded, failed, total: rows.length })
}
