import { NextRequest, NextResponse } from 'next/server'
import { auditIt } from '@/lib/it-access/guard'
import { canManageVisitorFormSettings, requireVisitorLog } from '@/lib/it-visitor/guard'
import {
  getVisitorFormSettings,
  rotateVisitorToken,
  setVisitorFormOpen,
} from '@/lib/it-visitor/public-server'
import { ItVisitorSettingsSchema } from '@/lib/validations/it-visitor'

// public_token ถูกกันไม่ให้ anon/authenticated อ่านตรงจาก DB (ดู scripts/it-visitor-log.sql)
// เจ้าหน้าที่จึงเห็น token ผ่าน route นี้เท่านั้น หลังผ่าน guard แล้ว
export async function GET() {
  const guard = await requireVisitorLog('view')
  if ('error' in guard) return guard.error

  const settings = await getVisitorFormSettings()
  if (!settings) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่าฟอร์ม — กรุณารัน scripts/it-visitor-log.sql' }, { status: 404 })
  }
  return NextResponse.json(settings, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(req: NextRequest) {
  const guard = await requireVisitorLog('edit')
  if ('error' in guard) return guard.error
  const actor = guard.actor
  if (!canManageVisitorFormSettings(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = ItVisitorSettingsSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
  }

  try {
    if (parsed.data.is_open !== undefined) {
      await setVisitorFormOpen(parsed.data.is_open, actor.id)
      auditIt('it_visitor.settings', actor.id, 'form', parsed.data.is_open ? 'เปิดรับแบบฟอร์ม' : 'ปิดรับแบบฟอร์ม')
    }
    if (parsed.data.rotateToken) {
      await rotateVisitorToken(actor.id)
      auditIt('it_visitor.rotate_token', actor.id, 'form', 'เปลี่ยนลิงก์/QR ของแบบฟอร์ม')
    }
    const settings = await getVisitorFormSettings()
    return NextResponse.json(settings, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
