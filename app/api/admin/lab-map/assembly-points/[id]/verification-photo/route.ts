import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isAllowedFileSignature } from '@/lib/external-quality/files'
import { auditSafety, requireSafetyEditor } from '@/lib/lab-map/safety-access'
import { DeleteObjectCommand, deleteSafetyPhoto, inspectUploadedSafetyPhoto, presignSafetyPhoto } from '@/lib/lab-map/safety-photo'
import { assemblyVerificationFinalizeSchema } from '@/lib/validations/lab-map-safety'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Context = { params: Promise<{ id: string }> }
void DeleteObjectCommand

export async function POST(req: NextRequest, { params }: Context) {
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  const { id } = await params
  const parsed = z.object({ fileName: z.string().min(1), contentType: z.string().min(1), sizeBytes: z.number().int().positive() })
    .safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })
  const { data: point } = await supabaseAdmin.from('lab_map_assembly_points').select('id').eq('id', id).eq('lifecycle_status', 'active').maybeSingle()
  if (!point) return NextResponse.json({ error: 'ไม่พบจุดรวมพลที่ใช้งานอยู่' }, { status: 404 })
  try {
    return NextResponse.json(await presignSafetyPhoto(`lab-map/assembly-points/${id}/`, parsed.data.fileName, parsed.data.contentType, parsed.data.sizeBytes))
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 422 })
  }
}

export async function PUT(req: NextRequest, { params }: Context) {
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  const { id } = await params
  const parsed = assemblyVerificationFinalizeSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 422 })
  const prefix = `lab-map/assembly-points/${id}/`
  if (!parsed.data.key.startsWith(prefix)) return NextResponse.json({ error: 'เส้นทางรูปไม่ตรงกับจุดรวมพล' }, { status: 422 })
  let verificationId: unknown
  try {
    const photo = await inspectUploadedSafetyPhoto(parsed.data.key, parsed.data.fileName, isAllowedFileSignature)
    const { data, error } = await supabaseAdmin.rpc('record_lab_map_assembly_verification', {
      p_assembly_point_id: id, p_latitude: parsed.data.latitude, p_longitude: parsed.data.longitude,
      p_accuracy_meters: parsed.data.accuracyMeters ?? null, p_note: parsed.data.note ?? null,
      p_photo_r2_key: parsed.data.key, p_photo_file_name: parsed.data.fileName,
      p_photo_content_type: photo.contentType, p_photo_size_bytes: photo.sizeBytes, p_actor_id: guard.actor.id,
    })
    if (error) throw new Error(error.message)
    verificationId = data
  } catch (error) {
    await deleteSafetyPhoto(parsed.data.key)
    return NextResponse.json({ error: (error as Error).message }, { status: 422 })
  }
  try {
    await auditSafety('lab_map.assembly_verification.create', guard.actor.id, String(verificationId), {
      assemblyPointId: id, latitude: parsed.data.latitude, longitude: parsed.data.longitude,
    })
  } catch (error) {
    console.error('lab map assembly verification audit failed', error)
    return NextResponse.json({ id: verificationId, auditWarning: true }, { status: 201 })
  }
  return NextResponse.json({ id: verificationId }, { status: 201 })
}
