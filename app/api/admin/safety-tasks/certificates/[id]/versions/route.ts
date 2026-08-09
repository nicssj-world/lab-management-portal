import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const certificateId = (await params).id
    const { data, error } = await supabaseAdmin.from('safety_certificate_versions').select('id,certificate_type,document_no,holder_name,department,issued_on,expires_on,no_expiry,file_name,content_type,size_bytes,uploaded_by,uploaded_at').eq('certificate_id', certificateId).order('uploaded_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ versions: data ?? [] })
  } catch (error) { return safetyTaskError(error) }
}
