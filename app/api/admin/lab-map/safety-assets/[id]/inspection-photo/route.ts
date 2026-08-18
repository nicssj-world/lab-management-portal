import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isAllowedFileSignature } from '@/lib/external-quality/files'
import { auditSafety, requireSafetyEditor } from '@/lib/lab-map/safety-access'
import {
  DeleteObjectCommand, SAFETY_PHOTO_MAX_BYTES, deleteSafetyPhoto, inspectUploadedSafetyPhoto, presignSafetyPhoto,
} from '@/lib/lab-map/safety-photo'
import { nextSafetyInspectionDate } from '@/lib/lab-map/safety-inspection-schedule'
import { inspectionFinalizeSchema } from '@/lib/validations/lab-map-safety'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Context = { params: Promise<{ id: string }> }
void DeleteObjectCommand
void SAFETY_PHOTO_MAX_BYTES

export async function POST(req: NextRequest, { params }: Context) {
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  const { id } = await params
  const parsed = z.object({ fileName: z.string().min(1), contentType: z.string().min(1), sizeBytes: z.number().int().positive() })
    .safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })
  const { data: asset } = await supabaseAdmin.from('lab_map_safety_assets').select('id').eq('id', id).eq('lifecycle_status', 'active').maybeSingle()
  if (!asset) return NextResponse.json({ error: 'ไม่พบอุปกรณ์ที่ใช้งานอยู่' }, { status: 404 })
  try {
    return NextResponse.json(await presignSafetyPhoto(`lab-map/safety-assets/${id}/`, parsed.data.fileName, parsed.data.contentType, parsed.data.sizeBytes))
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 422 })
  }
}

export async function PUT(req: NextRequest, { params }: Context) {
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  const { id } = await params
  const parsed = inspectionFinalizeSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })
  const prefix = `lab-map/safety-assets/${id}/`
  if (!parsed.data.key.startsWith(prefix)) return NextResponse.json({ error: 'เส้นทางรูปไม่ตรงกับอุปกรณ์' }, { status: 422 })
  let inspectionId: string
  let reused = false
  try {
    const nextInspectionDate = nextSafetyInspectionDate(parsed.data.inspectedOn)
    const photo = await inspectUploadedSafetyPhoto(parsed.data.key, parsed.data.fileName, isAllowedFileSignature)
    const { data, error } = await supabaseAdmin.rpc('record_lab_map_safety_inspection', {
      p_asset_id: id, p_result: parsed.data.result, p_inspected_on: parsed.data.inspectedOn,
      p_next_inspection_date: nextInspectionDate, p_expires_on: parsed.data.expiresOn ?? null,
      p_note: parsed.data.note ?? null, p_photo_r2_key: parsed.data.key, p_photo_file_name: parsed.data.fileName,
      p_photo_content_type: photo.contentType, p_photo_size_bytes: photo.sizeBytes, p_actor_id: guard.actor.id,
      p_round_item_id: parsed.data.roundItemId ?? null, p_checklist_snapshot: parsed.data.checklist,
    })
    if (error) throw new Error(error.message)
    inspectionId = String(data)
    const { data: storedInspection, error: storedInspectionError } = await supabaseAdmin
      .from('lab_map_safety_inspections')
      .select('photo_r2_key')
      .eq('id', inspectionId)
      .maybeSingle()
    if (storedInspectionError) throw new Error(storedInspectionError.message)
    if (!storedInspection) throw new Error('ไม่พบผลตรวจที่บันทึกไว้')
    reused = String(storedInspection.photo_r2_key ?? '') !== parsed.data.key
    if (reused) {
      try {
        await deleteSafetyPhoto(parsed.data.key)
      } catch (cleanupError) {
        console.error('duplicate safety photo cleanup failed', cleanupError)
      }
    }
  } catch (error) {
    if (!reused) await deleteSafetyPhoto(parsed.data.key)
    return NextResponse.json({ error: (error as Error).message }, { status: 422 })
  }
  // เมื่อ RPC สำเร็จ รูปถูกอ้างอิงโดย immutable inspection แล้ว ห้ามลบแม้ audit ชั่วคราวล้มเหลว
  try {
    await auditSafety(reused ? 'lab_map.safety_inspection.reuse' : 'lab_map.safety_inspection.create', guard.actor.id, inspectionId, {
      assetId: id, roundItemId: parsed.data.roundItemId ?? null, result: parsed.data.result, reused,
      checklist: parsed.data.checklist, position_status: parsed.data.result === 'not_found' ? 'unverified' : 'verified',
    })
  } catch (error) {
    console.error('lab map safety inspection audit failed', error)
    return NextResponse.json({ id: inspectionId, reused, auditWarning: true }, { status: reused ? 200 : 201 })
  }
  return NextResponse.json({ id: inspectionId, reused, message: reused ? 'ผลตรวจวันนี้มีอยู่แล้ว จึงใช้รายการเดิม' : 'บันทึกผลตรวจแล้ว' }, { status: reused ? 200 : 201 })
}
