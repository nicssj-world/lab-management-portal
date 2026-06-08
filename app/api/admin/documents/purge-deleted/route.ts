import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

// GET — count soft-deleted documents
export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['Admin', 'Manager'].includes(actor.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { count, error } = await supabaseAdmin
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .not('deleted_at', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: count ?? 0 })
}

// DELETE — hard delete all soft-deleted documents + R2 files
export async function DELETE() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['Admin', 'Manager'].includes(actor.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: rows, error: fetchErr } = await supabaseAdmin
    .from('documents')
    .select('id, file_url, word_url')
    .not('deleted_at', 'is', null)

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  // Delete files from R2 (best-effort)
  for (const row of rows ?? []) {
    if (row.file_url) {
      r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: row.file_url })).catch(() => {})
    }
    if (row.word_url) {
      r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: row.word_url })).catch(() => {})
    }
  }

  const { count, error } = await supabaseAdmin
    .from('documents')
    .delete({ count: 'exact' })
    .not('deleted_at', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  supabaseAdmin.from('document_access_logs')
    .insert({ document_id: null, user_id: actor.id, action: 'delete' })
    .then(undefined, () => {})

  return NextResponse.json({ purged: count ?? 0 })
}
