import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET — returns array of document IDs the current user has read.
// A read only counts for the document's current revision: same reset rule as
// the read-report (views logged before the revision's published_at don't count).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const { data } = await supabaseAdmin
    .from('document_access_logs')
    .select('document_id, created_at, documents(published_at)')
    .eq('user_id', user.id)
    .eq('action', 'view')

  const ids = new Set<string>()
  for (const log of data ?? []) {
    if (!log.document_id) continue
    const doc = Array.isArray(log.documents) ? log.documents[0] : log.documents
    const publishedAt = doc?.published_at ?? null
    if (publishedAt && log.created_at < publishedAt) continue
    ids.add(log.document_id)
  }
  return NextResponse.json([...ids])
}
