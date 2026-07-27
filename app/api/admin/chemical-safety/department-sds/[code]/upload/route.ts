import { createHash } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse, type NextRequest } from 'next/server'
import { unexpectedError } from '@/lib/chemical-safety/api'
import { requireDepartmentSdsPublisher } from '@/lib/chemical-safety/department-access'
import { departmentByCode } from '@/lib/chemical-safety/departments'
import {
  CHEMICAL_PDF_MAX_BYTES,
  buildChemicalSdsSourceKey,
  safeChemicalFilename,
  validateChemicalPdf,
} from '@/lib/chemical-safety/files'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params
  const department = departmentByCode(code)
  if (!department) return NextResponse.json({ error: 'ไม่พบงาน' }, { status: 404 })

  const guard = await requireDepartmentSdsPublisher(department.code)
  if (guard.response) return guard.response

  try {
    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    const rawDisplayName = form?.get('displayName')
    const displayName = typeof rawDisplayName === 'string' ? rawDisplayName.trim() : ''
    if (!(file instanceof File)) return NextResponse.json({ error: 'กรุณาเลือกไฟล์ PDF' }, { status: 422 })
    if (!displayName || displayName.length > 300) return NextResponse.json({ error: 'กรุณาระบุชื่อเอกสารที่แสดง (ไม่เกิน 300 ตัวอักษร)' }, { status: 422 })
    if (file.size > CHEMICAL_PDF_MAX_BYTES) return NextResponse.json({ error: 'ไฟล์ต้องไม่เกิน 50 MB' }, { status: 422 })

    const bytes = new Uint8Array(await file.arrayBuffer())
    const validation = validateChemicalPdf({
      fileName: file.name,
      contentType: file.type,
      sizeBytes: bytes.byteLength,
      signature: bytes.subarray(0, 5),
    })
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 422 })

    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const existing = await supabaseAdmin.from('chemical_sds_files').select('id').eq('sha256', sha256).maybeSingle()
    if (existing.error) throw existing.error

    let fileId = existing.data?.id ?? null
    const sourcePath = `uploaded/${department.code}/${safeChemicalFilename(file.name)}`
    if (!fileId) {
      const r2Key = buildChemicalSdsSourceKey(sha256, file.name)
      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET, Key: r2Key, Body: bytes, ContentType: 'application/pdf',
      }))
      const insertedFile = await supabaseAdmin.from('chemical_sds_files').insert({
        sha256,
        r2_key: r2Key,
        file_name: safeChemicalFilename(file.name),
        content_type: 'application/pdf',
        size_bytes: bytes.byteLength,
        source_paths: [sourcePath],
      }).select('id').single()
      if (insertedFile.error) throw insertedFile.error
      fileId = insertedFile.data.id
    }

    const departmentRow = await supabaseAdmin
      .from('chemical_sds_departments')
      .select('status')
      .eq('code', department.code)
      .maybeSingle()
    if (departmentRow.error) throw departmentRow.error
    if (!departmentRow.data) return NextResponse.json({ error: 'ไม่พบข้อมูลงาน' }, { status: 404 })

    const entry = await supabaseAdmin.from('chemical_department_sds').insert({
      department_code: department.code,
      file_id: fileId,
      source_path: sourcePath,
      display_name: displayName,
      display_name_edited: true,
    }).select('id').single()
    if (entry.error) {
      if (entry.error.code === '23505') return NextResponse.json({ error: 'ไฟล์นี้มีอยู่ในงานนี้แล้ว' }, { status: 409 })
      throw entry.error
    }

    const republishRequired = departmentRow.data.status === 'published'
    if (republishRequired) {
      const unpublished = await supabaseAdmin.from('chemical_sds_departments').update({
        status: 'draft', published_by: null, published_at: null, updated_at: new Date().toISOString(),
      }).eq('code', department.code)
      if (unpublished.error) throw unpublished.error
    }

    supabaseAdmin.from('audit_log').insert({
      action: 'chemical_safety.department_sds.upload',
      user_id: guard.actor.id,
      target: entry.data.id,
      detail: JSON.stringify({ department: department.code, sha256, sizeBytes: bytes.byteLength, republishRequired }),
    }).then(undefined, () => {})

    return NextResponse.json({ id: entry.data.id, republishRequired }, { status: 201 })
  } catch (error) {
    return unexpectedError(error)
  }
}
