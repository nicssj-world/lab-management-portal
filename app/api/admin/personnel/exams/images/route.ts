import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePersonnelManage } from '@/lib/auth/guards'
import { examImageActorPrefix } from '@/lib/personnel/exam-image-server'
import { r2, R2_BUCKET } from '@/lib/r2/client'

const schema = z.object({ key: z.string().min(1) })

export async function DELETE(req: NextRequest) {
  const { actor, response } = await requirePersonnelManage()
  if (!actor) return response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'เส้นทางรูปไม่ถูกต้อง' }, { status: 422 })
  if (!parsed.data.key.startsWith(examImageActorPrefix(actor.id))) {
    return NextResponse.json({ error: 'ไม่สามารถลบรูปของผู้ใช้อื่นได้' }, { status: 403 })
  }
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: parsed.data.key }))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ลบรูปไม่สำเร็จ' }, { status: 500 })
  }
}
