import { createHash } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse, type NextRequest } from 'next/server'
import { unexpectedError } from '@/lib/chemical-safety/api'
import {
  CHEMICAL_PDF_MAX_BYTES,
  buildChemicalSdsSourceKey,
  safeChemicalFilename,
  validateChemicalPdf,
} from '@/lib/chemical-safety/files'
import { resolveSdsForCustodian } from '@/lib/chemical-safety/sds-workflow'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/admin/chemical-safety/sds/[id]/upload'>,
) {
  const { id } = await ctx.params

  try {
    const resolved = await resolveSdsForCustodian(id)
    if (resolved.response) return resolved.response
    if (resolved.context.status !== 'draft') {
      return NextResponse.json({ error: 'แนบไฟล์ได้เฉพาะฉบับร่าง' }, { status: 409 })
    }

    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'กรุณาเลือกไฟล์ PDF' }, { status: 422 })
    }
    if (file.size > CHEMICAL_PDF_MAX_BYTES) {
      return NextResponse.json({ error: 'ไฟล์ต้องไม่เกิน 50 MB' }, { status: 422 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const validation = validateChemicalPdf({
      fileName: file.name,
      contentType: file.type,
      sizeBytes: bytes.byteLength,
      signature: bytes.subarray(0, 5),
    })
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 422 })

    // ใช้ sha256 เป็นตัวระบุไฟล์ ทำให้ไฟล์เดียวกันที่ถูกอัปโหลดซ้ำใช้ R2 object เดิม
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const existing = await supabaseAdmin
      .from('chemical_sds_files')
      .select('id')
      .eq('sha256', sha256)
      .maybeSingle()
    if (existing.error) throw existing.error

    let fileId = existing.data?.id ?? null
    if (!fileId) {
      const r2Key = buildChemicalSdsSourceKey(sha256, file.name)
      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: r2Key,
        Body: bytes,
        ContentType: 'application/pdf',
      }))
      const inserted = await supabaseAdmin
        .from('chemical_sds_files')
        .insert({
          sha256,
          r2_key: r2Key,
          file_name: safeChemicalFilename(file.name),
          content_type: 'application/pdf',
          size_bytes: bytes.byteLength,
        })
        .select('id')
        .single()
      if (inserted.error) throw inserted.error
      fileId = inserted.data.id
    }

    // ผูกไฟล์เข้ากับฉบับร่างทันที เพื่อให้กด "ส่งทบทวน" ได้โดยไม่ต้องบันทึกฟอร์มก่อน
    const linked = await supabaseAdmin
      .from('chemical_sds_versions')
      .update({ file_id: fileId, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'draft')
      .select('updated_at')
      .single()
    if (linked.error) throw linked.error

    supabaseAdmin.from('audit_log').insert({
      action: 'chemical_safety.sds.upload_file',
      user_id: resolved.actor.id,
      target: id,
      detail: JSON.stringify({ sha256, sizeBytes: bytes.byteLength }),
    }).then(undefined, () => {})

    return NextResponse.json({ fileId, updatedAt: linked.data.updated_at })
  } catch (error) {
    return unexpectedError(error)
  }
}
