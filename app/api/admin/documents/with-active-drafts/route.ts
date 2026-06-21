import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET — returns array of document IDs that currently have an active (in-progress, unpublished)
// revision draft WITH a Word/Excel source file uploaded
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const { data } = await supabaseAdmin
    .from('document_revision_drafts')
    .select('document_id, word_url')
    .is('cancelled_at', null)
    .neq('status', 'Published')

  const ids = [...new Set(
    (data ?? [])
      .filter((r) => r.document_id && r.word_url)
      .map((r) => r.document_id)
  )]
  return NextResponse.json(ids)
}
