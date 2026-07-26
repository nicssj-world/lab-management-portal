import { NextRequest, NextResponse } from 'next/server'
import { requireSafetyViewer } from '@/lib/lab-map/safety-access'
import { loadSafetyPhoto } from '@/lib/lab-map/safety-photo'
import { r2ObjectResponse } from '@/lib/r2/stream-response'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Context = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Context) {
  const guard = await requireSafetyViewer()
  if (guard.response) return guard.response
  const { id } = await params
  const { data } = await supabaseAdmin.from('lab_map_assembly_point_verifications')
    .select('photo_r2_key, photo_file_name, photo_content_type').eq('id', id).maybeSingle()
  if (!data) return NextResponse.json({ error: 'ไม่พบรูป' }, { status: 404 })
  try {
    const object = await loadSafetyPhoto(data.photo_r2_key, req.headers.get('range'))
    const name = String(data.photo_file_name).replace(/[\r\n"]/g, '_')
    return r2ObjectResponse(object, { contentType: data.photo_content_type, contentDisposition: `inline; filename="${name}"` })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
