import { createHash } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { NextResponse, type NextRequest } from 'next/server'
import { unexpectedError } from '@/lib/chemical-safety/api'
import { requireDepartmentSdsPublisher } from '@/lib/chemical-safety/department-access'
import {
  CHEMICAL_PDF_MAX_BYTES,
  buildChemicalSdsSourceKey,
  safeChemicalFilename,
  validateChemicalPdf,
} from '@/lib/chemical-safety/files'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

// [code] คือ id ของแถว chemical_department_sds (เหมือน route.ts ระดับบน) ไม่ใช่รหัสงาน
export async function POST(
  request: NextRequest,
  ctx: RouteContext<'/api/admin/chemical-safety/department-sds/[code]/replace'>,
) {
  const { code: id } = await ctx.params

  try {
    const entry = await supabaseAdmin
      .from('chemical_department_sds')
      .select('id, department_code, file_id, display_name')
      .eq('id', id)
      .maybeSingle()
    if (entry.error) throw entry.error
    if (!entry.data) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })

    const guard = await requireDepartmentSdsPublisher(String(entry.data.department_code))
    if (guard.response) return guard.response

    const registryLink = await supabaseAdmin
      .from('chemical_department_chemical_links')
      .select('id')
      .eq('department_sds_id', id)
      .maybeSingle()
    if (registryLink.error) throw registryLink.error
    if (registryLink.data) return NextResponse.json({ error: 'ไฟล์ SDS ที่อยู่ในทะเบียนแล้วห้ามแทนที่' }, { status: 409 })

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

    const departmentCode = String(entry.data.department_code)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const existingFile = await supabaseAdmin.from('chemical_sds_files').select('id').eq('sha256', sha256).maybeSingle()
    if (existingFile.error) throw existingFile.error

    let fileId = existingFile.data?.id ?? null
    const sourcePath = `uploaded/${departmentCode}/${safeChemicalFilename(file.name)}`
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

    const beforeFileId = entry.data.file_id
    const updated = await supabaseAdmin.from('chemical_department_sds').update({
      file_id: fileId,
      source_path: sourcePath,
      display_name: displayName,
      display_name_edited: true,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (updated.error) {
      if (updated.error.code === '23505') return NextResponse.json({ error: 'ไฟล์นี้มีอยู่ในงานนี้แล้ว' }, { status: 409 })
      throw updated.error
    }

    // เนื้อหาในงานเปลี่ยน ถ้ากำลังเผยแพร่อยู่ต้องให้ตรวจรายการใหม่ก่อนเผยแพร่ซ้ำ เหมือนตอนอัปโหลด/ลบ
    const departmentRow = await supabaseAdmin
      .from('chemical_sds_departments')
      .select('status')
      .eq('code', departmentCode)
      .maybeSingle()
    if (departmentRow.error) throw departmentRow.error

    const republishRequired = departmentRow.data?.status === 'published'
    if (republishRequired) {
      const unpublished = await supabaseAdmin.from('chemical_sds_departments').update({
        status: 'draft', published_by: null, published_at: null, updated_at: new Date().toISOString(),
      }).eq('code', departmentCode)
      if (unpublished.error) throw unpublished.error
    }

    supabaseAdmin.from('audit_log').insert({
      action: 'chemical_safety.department_sds.replace_file',
      user_id: guard.actor.id,
      target: id,
      detail: JSON.stringify({ department: departmentCode, beforeFileId, afterFileId: fileId, sha256, republishRequired }),
    }).then(undefined, () => {})

    return NextResponse.json({ id, republishRequired })
  } catch (error) {
    return unexpectedError(error)
  }
}
