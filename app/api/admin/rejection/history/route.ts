import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { REJECTION_RESOURCE } from '@/lib/permission-resources'

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id,role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms[REJECTION_RESOURCE] ?? 'none') === 'none') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ⚠️ never return uploaded_by (privacy)
  const { data, error } = await supabaseAdmin
    .from('rejection_uploads')
    .select('id,filename,data_month,total_rows,inserted,skipped,uploaded_at')
    .order('uploaded_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
