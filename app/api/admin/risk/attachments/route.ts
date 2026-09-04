import { NextRequest, NextResponse } from 'next/server'
import { finalizeUpload, presignUpload, requireAttachmentWriter } from '@/lib/risk/attachments'

/** ขอ URL สำหรับอัปโหลดตรงไปยัง R2 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const guard = await requireAttachmentWriter({ body })
  if (guard.error) return guard.error
  try {
    return await presignUpload(body)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 422 })
  }
}

/** ยืนยันไฟล์ที่อัปโหลดเสร็จแล้วและบันทึกลงฐานข้อมูล */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const guard = await requireAttachmentWriter({ body })
  if (guard.error) return guard.error
  try {
    return await finalizeUpload(guard.actor, body)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 422 })
  }
}
