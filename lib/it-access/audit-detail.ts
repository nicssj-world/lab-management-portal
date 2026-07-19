import type { ItAccessRecord } from '@/lib/supabase/types'
import { PERMISSION_COLUMNS } from '@/lib/it-access/columns'

type SystemNameMap = Map<string, string>

function systemNames(ids: string[], names: SystemNameMap): string[] {
  return ids.map((id) => names.get(id) ?? id)
}

// "เพิ่ม สมชาย · สิทธิ์: ลงทะเบียน / รับตัวอย่าง, ดูรายงานผล · ระบบ: HIS, AI-LIS"
export function buildCreateDetail(name: string, record: ItAccessRecord, names: SystemNameMap): string {
  const granted = PERMISSION_COLUMNS.filter((c) => record[c.key]).map((c) => c.label)
  const parts = [`เพิ่ม ${name}`]
  parts.push(`สิทธิ์: ${granted.length ? granted.join(', ') : 'ไม่มี'}`)
  const sys = systemNames(record.system_ids, names)
  if (sys.length) parts.push(`ระบบ: ${sys.join(', ')}`)
  return parts.join(' · ')
}

// Diff of what actually changed. Empty string = nothing changed (skip the log entry).
// e.g. "แก้ไขผล: เพิ่ม · Admin setting: ถอน · ระบบ: +M-Lab −HIS · LIS ID: L833"
export function buildUpdateDetail(
  name: string,
  before: ItAccessRecord,
  after: ItAccessRecord,
  names: SystemNameMap,
): string {
  const changes: string[] = []

  for (const col of PERMISSION_COLUMNS) {
    if (before[col.key] !== after[col.key]) {
      changes.push(`${col.label}: ${after[col.key] ? 'เพิ่ม' : 'ถอน'}`)
    }
  }

  const beforeSys = new Set(before.system_ids)
  const afterSys = new Set(after.system_ids)
  const added = after.system_ids.filter((id) => !beforeSys.has(id))
  const removed = before.system_ids.filter((id) => !afterSys.has(id))
  if (added.length || removed.length) {
    const tokens = [
      ...systemNames(added, names).map((n) => `+${n}`),
      ...systemNames(removed, names).map((n) => `−${n}`),
    ]
    changes.push(`ระบบ: ${tokens.join(' ')}`)
  }

  if ((before.lis_user_id ?? '') !== (after.lis_user_id ?? '')) {
    changes.push(`LIS ID: ${after.lis_user_id ?? '—'}`)
  }

  if (changes.length === 0) return ''
  return `${name} · ${changes.join(' · ')}`
}
