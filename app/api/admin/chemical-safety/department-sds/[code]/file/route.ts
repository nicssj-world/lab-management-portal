import { GetObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse, type NextRequest } from 'next/server'
import { requireChemicalViewer } from '@/lib/chemical-safety/access'
import { unexpectedError } from '@/lib/chemical-safety/api'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { r2ObjectResponse } from '@/lib/r2/stream-response'
import { supabaseAdmin } from '@/lib/supabase/admin'

function safeName(value: string) {
  return value.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 180) || 'SDS.pdf'
}

// [code] คือ id ของแถว chemical_department_sds ไม่ใช่รหัสงาน
// เส้นทางนี้ใช้เฉพาะหน้าเจ้าหน้าที่ จึงเปิดดูเอกสารร่างได้โดยไม่ทำให้ public route หลุดสถานะเผยแพร่
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const guard = await requireChemicalViewer()
  if (guard.response) return guard.response

  const { code: id } = await ctx.params

  try {
    const entry = await supabaseAdmin
      .from('chemical_department_sds')
      .select('file_id')
      .eq('id', id)
      .maybeSingle()
    if (entry.error) throw entry.error
    if (!entry.data?.file_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const file = await supabaseAdmin
      .from('chemical_sds_files')
      .select('r2_key, file_name, content_type')
      .eq('id', entry.data.file_id)
      .maybeSingle()
    if (file.error) throw file.error
    if (!file.data || file.data.content_type !== 'application/pdf') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const object = await r2.send(new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: file.data.r2_key,
      Range: request.headers.get('range') ?? undefined,
    }))
    return r2ObjectResponse(object, {
      contentType: 'application/pdf',
      contentDisposition: `inline; filename="${safeName(file.data.file_name)}"`,
    })
  } catch (error) {
    return unexpectedError(error)
  }
}
