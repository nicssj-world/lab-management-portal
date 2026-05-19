import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDepartments } from '@/lib/queries/kpi'

export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await getDepartments(supabase)
  return NextResponse.json(data)
}
