import { NextResponse } from 'next/server'
import { getRolePermissions } from '@/lib/permissions'
import { isAdminRole } from '@/lib/roles'
import { getItActor, type ItActor } from '@/lib/it-access/guard'

// บันทึกการเข้า-ออกใช้ resource แยกจาก 'ระบบสารสนเทศ (IT)' เพราะผู้ชมคนละกลุ่ม:
// ทะเบียนสิทธิ์ HIS&LIS / downtime / backup เป็นงานคณะทำงาน IT ส่วนบันทึกการเข้า-ออก
// ทุกคนในกลุ่มงาน (ยกเว้น Assistant) ต้องเห็น จึงต้องกำหนดสิทธิ์ได้อิสระจากกัน
export const VISITOR_RESOURCE = 'บันทึกการเข้า-ออก'

/**
 * ไม่มี it_editors override — กฎของโมดูลนี้คือ "ทุก role ยกเว้น Assistant"
 * ล้วน ๆ ปรับได้จาก Permission Matrix ไม่ต้องมีข้อยกเว้นรายคน
 */
export async function requireVisitorLog(
  level: 'view' | 'edit',
): Promise<{ error: NextResponse } | { actor: ItActor }> {
  const actor = await getItActor()
  if (!actor) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const perms = await getRolePermissions(actor.role)
  const perm = perms[VISITOR_RESOURCE] ?? 'none'
  const ok = level === 'edit' ? perm === 'edit' : perm !== 'none'
  if (!ok) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { actor }
}

/**
 * ลบบันทึกได้เฉพาะ Admin — บันทึกการเข้า-ออกเป็นหลักฐาน ISO
 * ผู้มีสิทธิ์ edit ทั่วไปแก้ไข/ปิดเวลาออกได้ แต่ลบทิ้งไม่ได้
 */
export function canDeleteVisitorLog(actor: Pick<ItActor, 'role'>): boolean {
  return isAdminRole(actor.role)
}

/**
 * การเปิด/ปิดฟอร์มและเปลี่ยนลิงก์สาธารณะทำได้เฉพาะ Admin
 */
export function canManageVisitorFormSettings(actor: Pick<ItActor, 'role'>): boolean {
  return isAdminRole(actor.role)
}
