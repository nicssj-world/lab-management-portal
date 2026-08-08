import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePersonnelManage } from '@/lib/auth/guards'
import { presignExamImage } from '@/lib/personnel/exam-image-server'

const schema = z.object({
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
})

export async function POST(req: NextRequest) {
  const { actor, response } = await requirePersonnelManage()
  if (!actor) return response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลอัปโหลดไม่ถูกต้อง' }, { status: 422 })
  const contentType = 'image/webp'
  if (parsed.data.contentType !== contentType) return NextResponse.json({ error: 'รูปต้องผ่านการบีบอัดเป็น WebP ก่อนอัปโหลด' }, { status: 422 })
  try {
    return NextResponse.json(await presignExamImage(actor.id, { contentType, sizeBytes: parsed.data.sizeBytes }))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'เตรียมอัปโหลดรูปไม่สำเร็จ' }, { status: 422 })
  }
}
