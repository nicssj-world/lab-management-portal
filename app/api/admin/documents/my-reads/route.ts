import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET — returns array of document IDs the current user has viewed
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const { data } = await supabaseAdmin
    .from('document_access_logs')
    .select('document_id')
    .eq('user_id', user.id)
    .eq('action', 'view')

  const ids = [...new Set((data ?? []).map((r) => r.document_id).filter(Boolean))]
  return NextResponse.json(ids)
}
