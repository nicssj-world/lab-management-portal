import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getActor, getPermissionLevel, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'

export async function GET() {
  try {
    const actor = await getActor()
    if (!actor) return jsonUnauthorized()
    if ((await getPermissionLevel(actor, 'รายการตรวจ')) === 'none') return jsonForbidden()

    const { data, error } = await supabaseAdmin
      .from('tests')
      .select('department')
      .eq('active', true)
      .not('department', 'is', null)
      .order('department')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const departments = [...new Set(
      (data ?? [])
        .map(row => row.department?.trim())
        .filter((value): value is string => Boolean(value)),
    )]

    return NextResponse.json(departments)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
