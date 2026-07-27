import 'server-only'

import type { NextResponse } from 'next/server'
import { getActor, jsonForbidden, jsonUnauthorized, type Actor } from '@/lib/auth/guards'
import { normalizeRole } from '@/lib/roles'
import { isSafetyEditor } from '@/lib/lab-map/safety-access'
import { departmentByCode } from './departments'

type PublisherActor = Pick<Actor, 'id' | 'role' | 'dept' | 'dept_role'>
type GuardResult =
  | { actor: Actor; response?: undefined }
  | { actor?: undefined; response: NextResponse }

/**
 * ใครเผยแพร่คลัง SDS ของงานได้
 *
 * การเผยแพร่ทำทีละงานทั้งงาน จึงเป็นการรับรองว่า "เอกสารชุดนี้เป็นของงานเราและใช้ได้"
 * คนที่รับรองแทนงานได้จึงมีสามกลุ่ม:
 *   - Admin (ดูแลระบบ)
 *   - หัวหน้า/รองหัวหน้ากลุ่มงาน (group_lead / group_deputy) ซึ่งกำกับทุกงานอยู่แล้ว
 *   - Manager ที่ profiles.dept ตรงกับงานนั้น = หัวหน้างานนั้น
 *
 * ระบบไม่มีฟิลด์ "หัวหน้างาน" รายงานแยกต่างหาก จึงอนุมานจาก role + dept ตามข้างต้น
 */
export function canPublishDepartmentSds(actor: PublisherActor, departmentCode: string): boolean {
  const department = departmentByCode(departmentCode)
  if (!department) return false

  const role = normalizeRole(actor.role)
  if (role === 'Admin') return true
  if (actor.dept_role === 'group_lead' || actor.dept_role === 'group_deputy') return true
  return role === 'Manager' && (actor.dept ?? '') === department.department
}

export async function canManageDepartmentSds(actor: PublisherActor, departmentCode: string): Promise<boolean> {
  return canPublishDepartmentSds(actor, departmentCode) || await isSafetyEditor(actor)
}

export async function requireDepartmentSdsPublisher(departmentCode: string): Promise<GuardResult> {
  const actor = await getActor()
  if (!actor) return { response: jsonUnauthorized() }
  return await canManageDepartmentSds(actor, departmentCode) ? { actor } : { response: jsonForbidden() }
}
