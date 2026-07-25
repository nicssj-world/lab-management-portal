import { NextRequest, NextResponse } from 'next/server'
import { auditHeadContact, requireHeadContactAccess } from '@/lib/head-contact/guard'
import { HeadContactSettingsSchema } from '@/lib/validations/head-contact'
import {
  getHeadContactFormSettings,
  rotateHeadContactToken,
  setHeadContactFormOpen,
} from '@/lib/head-contact/public-server'

export async function GET() {
  const guard = await requireHeadContactAccess()
  if ('error' in guard) return guard.error
  const settings = await getHeadContactFormSettings()
  return settings
    ? NextResponse.json(settings, { headers: { 'Cache-Control': 'no-store' } })
    : NextResponse.json({ error: 'ยังไม่ได้ตั้งค่าฟอร์ม' }, { status: 404 })
}

export async function PATCH(request: NextRequest) {
  const guard = await requireHeadContactAccess()
  if ('error' in guard) return guard.error
  const parsed = HeadContactSettingsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  try {
    if (parsed.data.is_open !== undefined) {
      await setHeadContactFormOpen(parsed.data.is_open, guard.actor.id)
      auditHeadContact('head_contact.settings', guard.actor.id, 'form', parsed.data.is_open ? 'เปิดรับเรื่อง' : 'ปิดรับเรื่อง')
    }
    if (parsed.data.rotateToken) {
      await rotateHeadContactToken(guard.actor.id)
      auditHeadContact('head_contact.rotate_token', guard.actor.id, 'form', 'เปลี่ยนลิงก์/QR')
    }
    return NextResponse.json(await getHeadContactFormSettings(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ' }, { status: 500 })
  }
}
