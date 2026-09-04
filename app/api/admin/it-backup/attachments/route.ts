import { NextRequest, NextResponse } from 'next/server'
import { requireIt } from '@/lib/it-access/guard'
import { finalizeBackupAttachment, presignBackupAttachment } from '@/lib/it-access/backup-attachments'

/** ขอ URL สำหรับอัปโหลดไฟล์หลักฐานตรงไปยัง R2 */
export async function POST(req: NextRequest) {
  const guard = await requireIt('edit')
  if ('error' in guard) return guard.error
  try {
    return await presignBackupAttachment(await req.json())
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 422 })
  }
}

/** ตรวจสอบและบันทึก metadata หลังอัปโหลดไฟล์เสร็จ */
export async function PUT(req: NextRequest) {
  const guard = await requireIt('edit')
  if ('error' in guard) return guard.error
  try {
    return await finalizeBackupAttachment(guard.actor, await req.json())
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 422 })
  }
}
