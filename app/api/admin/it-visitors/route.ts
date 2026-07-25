import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireVisitorLog } from '@/lib/it-visitor/guard'
import { getItVisitorLogs } from '@/lib/queries/it-access'

export async function GET() {
  const guard = await requireVisitorLog('view')
  if ('error' in guard) return guard.error

  const items = await getItVisitorLogs(supabaseAdmin)
  return NextResponse.json({ items })
}
