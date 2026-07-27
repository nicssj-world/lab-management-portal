import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextRequest, NextResponse } from 'next/server'
import { getPmCalActor, writePmCalAudit } from '@/lib/equipment/pm-cal-server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { r2ObjectResponse } from '@/lib/r2/stream-response'

interface Params { params: Promise<{ id: string; resultId: string }> }
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

async function loadResult(id: string, resultId: string) {
  return supabaseAdmin.from('equipment_calibrations').select('id, equipment_id, certificate_file_url, source').eq('id', resultId).eq('equipment_id', id).maybeSingle()
}

export async function GET(req: NextRequest, { params }: Params) {
  const actor = await getPmCalActor('read')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, resultId } = await params
  const { data, error } = await loadResult(id, resultId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.certificate_file_url) return NextResponse.json({ error: 'ไม่มี Certificate' }, { status: 404 })
  if (req.nextUrl.searchParams.get('proxy') === '1') {
    const object = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: data.certificate_file_url, Range: req.headers.get('range') ?? undefined }))
    return r2ObjectResponse(object, { contentType: data.certificate_file_url.toLowerCase().endsWith('.pdf') ? 'application/pdf' : undefined })
  }
  const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: data.certificate_file_url }), { expiresIn: 3600 })
  return NextResponse.json({ url })
}

export async function POST(req: NextRequest, { params }: Params) {
  const actor = await getPmCalActor('edit')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, resultId } = await params
  const { data, error } = await loadResult(id, resultId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'ไม่พบประวัติ PM/CAL' }, { status: 404 })
  if (data.source === 'legacy_import') return NextResponse.json({ error: 'ข้อมูล legacy แก้ไขจากหน้านี้ไม่ได้' }, { status: 409 })
  if (data.certificate_file_url) return NextResponse.json({ error: 'รายการนี้มี Certificate แล้ว กรุณาลบก่อนอัปโหลดใหม่' }, { status: 409 })
  const body = await req.json().catch(() => null) as { fileName?: unknown; fileType?: unknown; fileSize?: unknown } | null
  const { fileName, fileType, fileSize } = body ?? {}
  if (typeof fileName !== 'string' || typeof fileType !== 'string' || typeof fileSize !== 'number' || !fileName || !ALLOWED_TYPES.includes(fileType) || !Number.isFinite(fileSize) || fileSize <= 0 || fileSize > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'ไฟล์ไม่ถูกต้อง รองรับ PDF/JPG/PNG/WEBP ไม่เกิน 50 MB' }, { status: 422 })
  }
  const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `equipment/${id}/pm-cal/${resultId}/${Date.now()}-${safeName}`
  const uploadUrl = await getSignedUrl(r2, new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: fileType }), { expiresIn: 300 })
  return NextResponse.json({ uploadUrl, key })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const actor = await getPmCalActor('edit')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, resultId } = await params
  const body = await req.json().catch(() => null) as { key?: unknown } | null
  const key = body?.key
  const prefix = `equipment/${id}/pm-cal/${resultId}/`
  if (typeof key !== 'string' || !key.startsWith(prefix)) return NextResponse.json({ error: 'key ไม่ถูกต้อง' }, { status: 422 })
  const { data, error: loadError } = await loadResult(id, resultId)
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'ไม่พบประวัติ PM/CAL' }, { status: 404 })
  if (data.source === 'legacy_import') return NextResponse.json({ error: 'ข้อมูล legacy แก้ไขจากหน้านี้ไม่ได้' }, { status: 409 })
  if (data.certificate_file_url && data.certificate_file_url !== key) return NextResponse.json({ error: 'รายการนี้มี Certificate แล้ว' }, { status: 409 })
  try {
    const uploaded = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    if (!ALLOWED_TYPES.includes(uploaded.ContentType ?? '') || !uploaded.ContentLength || uploaded.ContentLength > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'ไฟล์ที่อัปโหลดไม่ถูกต้อง' }, { status: 422 })
    }
  } catch {
    return NextResponse.json({ error: 'ไม่พบไฟล์ที่อัปโหลด' }, { status: 422 })
  }
  const { error } = await supabaseAdmin.from('equipment_calibrations').update({ certificate_file_url: key, updated_at: new Date().toISOString(), updated_by: actor.id }).eq('id', resultId).eq('equipment_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writePmCalAudit(actor.id, 'equipment.pm_cal.certificate.attach', id, resultId)
  return NextResponse.json({ certificate_file_url: key })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const actor = await getPmCalActor('edit')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, resultId } = await params
  const { data, error: loadError } = await loadResult(id, resultId)
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'ไม่พบประวัติ PM/CAL' }, { status: 404 })
  if (data.source === 'legacy_import') return NextResponse.json({ error: 'ข้อมูล legacy แก้ไขจากหน้านี้ไม่ได้' }, { status: 409 })
  if (data.certificate_file_url) await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: data.certificate_file_url }))
  const { error } = await supabaseAdmin.from('equipment_calibrations').update({ certificate_file_url: null, updated_at: new Date().toISOString(), updated_by: actor.id }).eq('id', resultId).eq('equipment_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writePmCalAudit(actor.id, 'equipment.pm_cal.certificate.delete', id, resultId)
  return new NextResponse(null, { status: 204 })
}
