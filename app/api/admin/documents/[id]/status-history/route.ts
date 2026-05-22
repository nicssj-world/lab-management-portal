import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

function isMissingStatusHistoryTable(err: { code?: string; message?: string }) {
  return err.code === '42P01' || (err.message ?? '').includes('document_status_history')
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const { id } = await params
  const { data, error } = await supabaseAdmin
    .from('document_status_history')
    .select('to_status, changed_at')
    .eq('document_id', id)
    .order('changed_at', { ascending: true })

  if (error) {
    if (isMissingStatusHistoryTable(error)) return NextResponse.json([])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
