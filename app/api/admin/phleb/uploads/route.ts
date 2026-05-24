import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('phleb_uploads')
    .select('id, year, month, file_name, row_count, uploaded_at, uploaded_by')
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const uploaderIds = [...new Set((data ?? []).map(r => r.uploaded_by).filter(Boolean))]
  let nameMap: Record<string, string> = {}
  if (uploaderIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, name')
      .in('id', uploaderIds)
    nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name]))
  }

  const uploads = (data ?? []).map(r => ({
    ...r,
    uploader_name: r.uploaded_by ? (nameMap[r.uploaded_by] ?? '—') : '—',
  }))

  return NextResponse.json({ uploads })
}
