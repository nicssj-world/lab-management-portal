import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { createUserSchema } from '@/lib/validations/user-schema'
import { listUsers, createUser } from '@/lib/services/users'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role?.toLowerCase() !== 'admin') return null
  return profile as { id: string; role: string }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const actor = await requireAdmin(supabase)
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const sp = req.nextUrl.searchParams
    // Use admin client to bypass RLS — actor has already been verified as Admin above
    const result = await listUsers(
      supabaseAdmin,
      {
        search: sp.get('search') ?? '',
        role:   (sp.get('role')   as never) ?? '',
        dept:   sp.get('dept')   ?? '',
        status: (sp.get('status') as never) ?? '',
      },
      Number(sp.get('page')     ?? 1),
      Number(sp.get('pageSize') ?? 10),
      sp.get('sortField') ?? 'created_at',
      (sp.get('sortDir') as 'asc' | 'desc') ?? 'desc',
    )

    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const actor = await requireAdmin(supabase)
    if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const parsed = createUserSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง'
      return NextResponse.json({ error: firstError }, { status: 422 })
    }

    const profile = await createUser(parsed.data, actor.id)
    return NextResponse.json({ success: true, user: profile }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
