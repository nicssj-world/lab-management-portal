/**
 * Seeds role_permissions using ':level' suffix encoding — no DDL needed.
 * Works with the existing granted-boolean schema via service role (HTTPS).
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://fslagsuorkcckvvtrmyi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbGFnc3VvcmtjY2t2dnRybXlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTE4MDc1OSwiZXhwIjoyMDk0NzU2NzU5fQ.6OwSnEAaMWpwQ52QaubLxIHDcqRVE-pj0qJWNGaFYdY',
  { auth: { persistSession: false } },
)

// [role, resource, level]  — 'none' entries omitted (absence = no permission)
const SEED = [
  // Admin — all edit (locked in UI)
  ['Admin', 'รายการตรวจ',              'edit'],
  ['Admin', 'เอกสารคุณภาพ',           'edit'],
  ['Admin', 'ข่าวสาร',                'edit'],
  ['Admin', 'ความเสี่ยง / Rejection', 'edit'],
  ['Admin', 'สัญญา',                  'edit'],
  ['Admin', 'Workload',               'edit'],
  ['Admin', 'KPI',                    'edit'],
  ['Admin', 'TAT (นำเข้า)',           'edit'],
  ['Admin', 'User Management',        'edit'],
  // Manager
  ['Manager', 'รายการตรวจ',              'edit'],
  ['Manager', 'เอกสารคุณภาพ',           'edit'],
  ['Manager', 'ข่าวสาร',                'edit'],
  ['Manager', 'ความเสี่ยง / Rejection', 'edit'],
  ['Manager', 'สัญญา',                  'edit'],
  ['Manager', 'Workload',               'view'],
  ['Manager', 'KPI',                    'edit'],
  ['Manager', 'TAT (นำเข้า)',           'edit'],
  // Medical Technologist
  ['Medical Technologist', 'รายการตรวจ',              'view'],
  ['Medical Technologist', 'เอกสารคุณภาพ',           'view'],
  ['Medical Technologist', 'ข่าวสาร',                'view'],
  ['Medical Technologist', 'ความเสี่ยง / Rejection', 'view'],
  ['Medical Technologist', 'Workload',               'edit'],
  ['Medical Technologist', 'KPI',                    'view'],
  // Assistant
  ['Assistant', 'รายการตรวจ', 'view'],
  ['Assistant', 'ข่าวสาร',    'view'],
]

async function main() {
  console.log('▶ ลบข้อมูลเก่าทั้งหมด …')
  const { error: delErr } = await supabase.from('role_permissions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (delErr) {
    console.error('❌ ลบไม่สำเร็จ:', delErr.message)
    process.exit(1)
  }
  console.log('✓ ล้างข้อมูลเก่าแล้ว')

  console.log(`▶ Inserting ${SEED.length} permission rows …`)
  const rows = SEED.map(([role, resource, level]) => ({
    role,
    resource: `${resource}:${level}`,
    granted:  true,
  }))

  const { error: insErr } = await supabase.from('role_permissions').insert(rows)
  if (insErr) {
    console.error('❌ Insert ล้มเหลว:', insErr.message)
    process.exit(1)
  }

  console.log('✅ Seed สำเร็จ — permissions matrix พร้อมใช้งานแล้ว')
}

main()
