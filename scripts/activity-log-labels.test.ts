// กันไม่ให้ action ใหม่ที่เขียนลง audit_log หลุดไม่มี label ใน "กิจกรรมทั้งหมด" / dashboard อีก
// (ประวัติ: quality_task.check_in, register.close, incident.close และอีกกว่า 40 action หลุดไปเงียบๆ
// หลายเดือนก่อนถูกจับได้ — README เคยเตือนไว้แล้วแต่ครอบคลุมแค่ไฟล์เดียวจาก 4 จุดที่ต้องอัปเดตคู่กัน)
//
// สแกน source จริงหา action string ทุกตัวที่ถูก insert เข้า audit_log (ทั้งใน app/lib และ SQL,
// แบบ literal ตรงๆ,
// ternary, และผ่าน audit-helper wrapper อย่าง auditRisk/auditIt/auditSafety/auditExternalQuality/
// auditChild/auditVerification) แล้วเทียบกับ ACTION_LABELS ทั้ง 2 ไฟล์ + CATEGORY_ACTIONS ฝั่ง API + ปุ่มกรองหมวดหมู่
//
// นี่เป็นการสแกนด้วย regex ไม่ใช่ parser จริง — ครอบคลุมแพทเทิร์นที่มีอยู่จริงใน repo นี้เท่านั้น
// ถ้าเพิ่ม audit-helper function ใหม่ที่ไม่ตรงกับแพทเทิร์นด้านล่าง ต้องเพิ่มการสแกนให้ครอบคลุมด้วย

import assert from 'node:assert/strict'
import { readFileSync as readFileSyncRaw, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ไฟล์ในโปรเจกต์นี้ใช้ CRLF (Windows) — normalize เป็น LF ก่อนรัน regex ทุกตัว
// มิฉะนั้น pattern อย่าง /\n}\n/ จะไม่แมตช์ "}\r\n" (ตัวถัดจาก } เป็น \r ไม่ใช่ \n)
function readFileSync(path: string, _encoding: 'utf8'): string {
  return readFileSyncRaw(path, 'utf8').replace(/\r\n/g, '\n')
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) return []
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) return walk(path)
    return path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : []
  })
}

const SOURCE_FILES = [...walk(join(process.cwd(), 'app')), ...walk(join(process.cwd(), 'lib'))].filter(
  (p) => !p.endsWith('.test.ts'),
)
assert.ok(SOURCE_FILES.length > 100, `expected to walk a substantial number of source files, found ${SOURCE_FILES.length}`)

function walkSql(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry.startsWith('.')) return []
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) return walkSql(path)
    return path.endsWith('.sql') ? [path] : []
  })
}

const SQL_SOURCE_FILES = [walkSql(join(process.cwd(), 'supabase')), walkSql(join(process.cwd(), 'scripts'))].flat()

const AUDIT_HELPER_NAMES = /\baudit(?:Risk|It|HeadContact|Safety|MapRelease|ExternalQuality|Child|PurgeRetry|SatisfactionChange|Verification)\b|\bwritePmCalAudit\b/

// action code เข้ารูป "word.word" / "word_word.word" (มี separator อย่างน้อยหนึ่งจุด) หรือคำเดี่ยวที่รู้จัก
const ACTION_SHAPE = /^[a-z][a-z0-9]*(?:[_.][a-z0-9]+)+$/
const BARE_ACTIONS = new Set(['delete', 'manual_publish', 'phleb_upload_init'])

// พบใน source จริง → ไฟล์แรกที่พบ (ไว้รายงานตำแหน่งเวลา assert fail)
const found = new Map<string, string>()
function record(action: string, file: string) {
  if (ACTION_SHAPE.test(action) || BARE_ACTIONS.has(action)) {
    if (!found.has(action)) found.set(action, file)
  }
}

for (const file of SOURCE_FILES) {
  const src = readFileSync(file, 'utf8')
  if (!src.includes('audit_log') && !AUDIT_HELPER_NAMES.test(src)) continue

  // 1) action: 'xxx' literal ตรงๆ
  for (const m of src.matchAll(/action:\s*['"]([\w.\-]+)['"]/g)) record(m[1], file)

  // 2) inline ternary หลัง action: โดยตรง — action: cond ? 'a' : 'b'
  for (const m of src.matchAll(/action:\s*[^,{}]*?\?\s*['"]([\w.\-]+)['"]\s*:\s*['"]([\w.\-]+)['"]/g)) {
    record(m[1], file)
    record(m[2], file)
  }

  // 3) ternary ที่สองฝั่งเป็น action code รูปแบบ dotted ทั้งคู่ — ครอบกรณี assign เข้าตัวแปรก่อนใช้
  //    เช่น `const auditAction = cond ? 'document.status_change' : 'document.edit'`
  for (const m of src.matchAll(/\?\s*['"]([a-z][\w\-]*\.[\w.\-]+)['"]\s*:\s*['"]([a-z][\w\-]*\.[\w.\-]+)['"]/g)) {
    record(m[1], file)
    record(m[2], file)
  }

  // 4) audit-helper แรก arg เป็น literal — auditRisk('x', ...) / auditIt('x', ...) / ฯลฯ
  for (const m of src.matchAll(/audit(?:Risk|It|HeadContact|Safety|MapRelease|PurgeRetry)\(\s*['"]([\w.\-]+)['"]/g)) {
    record(m[1], file)
  }
  for (const m of src.matchAll(/writePmCalAudit\(\s*[^,]+,\s*['"]([\w.\-]+)['"]/g)) record(m[1], file)
  for (const m of src.matchAll(/auditSatisfactionChange\(\s*\{[\s\S]*?\baction:\s*['"]([\w.\-]+)['"]/g)) {
    record(m[1], file)
  }

  // 5) auditExternalQuality('module', 'action', ...) → module.action
  for (const m of src.matchAll(/auditExternalQuality\(\s*['"](\w+)['"]\s*,\s*['"]([\w.\-]+)['"]/g)) {
    record(`${m[1]}.${m[2]}`, file)
  }

  // IT data-transfer verification helper prefixes its action with it_verification.
  for (const m of src.matchAll(/auditVerification\(\s*['"]([\w.\-]+)['"]/g)) {
    record(`it_verification.${m[1]}`, file)
  }

  // 6) personnel child tables ผ่าน auditChild (lib/personnel/crud.ts) — table name มาจาก call site จริง
  //    เพื่อให้ตารางลูกใหม่ในอนาคตถูกจับได้อัตโนมัติโดยไม่ต้องแก้สคริปต์นี้
  for (const m of src.matchAll(/createChild\(\s*req,\s*['"](\w+)['"]/g)) record(`personnel.${m[1]}.create`, file)
  for (const m of src.matchAll(/updateChild\(\s*req,\s*['"](\w+)['"]/g)) record(`personnel.${m[1]}.update`, file)
  for (const m of src.matchAll(/softDeleteChild\(\s*['"](\w+)['"]/g)) record(`personnel.${m[1]}.delete`, file)
}

for (const file of SQL_SOURCE_FILES) {
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(/INSERT\s+INTO\s+(?:public\.)?audit_log\s*\([\s\S]*?\)\s*VALUES\s*\(\s*['"]([\w.\-]+)['"]/gi)) {
    record(m[1], file)
  }
}

assert.ok(
  found.size > 100,
  `expected to statically find well over 100 distinct audit_log action codes, found ${found.size} — the scan patterns in this test may be broken`,
)

// ── ต้องมี label ในทั้ง 2 ไฟล์ที่ยังคง ACTION_LABELS แยกกันอยู่ ──
const ACTIVITY_CLIENT_PATH = 'app/(protected)/staff/activity/ActivityClient.tsx'
const DASHBOARD_PAGE_PATH = 'app/(protected)/staff/dashboard/page.tsx'
const ACTIVITY_ROUTE_PATH = 'app/api/admin/activity/route.ts'

const activityClient = readFileSync(ACTIVITY_CLIENT_PATH, 'utf8')
const dashboardPage = readFileSync(DASHBOARD_PAGE_PATH, 'utf8')
const activityRoute = readFileSync(ACTIVITY_ROUTE_PATH, 'utf8')

function labelKeys(src: string, label: string): Set<string> {
  const m = src.match(/const ACTION_LABELS[\s\S]*?\n}/)
  assert.ok(m, `ACTION_LABELS map not found in ${label}`)
  return new Set([...m![0].matchAll(/^\s*'([^']+)':/gm)].map((x) => x[1]))
}

const activityLabels = labelKeys(activityClient, ACTIVITY_CLIENT_PATH)
const dashboardLabels = labelKeys(dashboardPage, DASHBOARD_PAGE_PATH)

// action ที่ไม่ต้องมี label: ถูก exclude ออกจาก feed อยู่แล้ว (permission.update ฯลฯ),
// หรือเป็น action ของตาราง document_access_logs คนละตารางกับ audit_log แม้ค่าจะซ้ำคำกัน
const NOT_REQUIRED = new Set([
  'permission.update', 'settings.update', 'user.update', 'user.create',
  'document.cover_generate', 'document.cover_regenerate',
  'upload', 'edit', 'view', 'download',
])

const missingFromActivity: string[] = []
const missingFromDashboard: string[] = []
for (const [action, file] of found) {
  if (NOT_REQUIRED.has(action)) continue
  if (!activityLabels.has(action)) missingFromActivity.push(`${action}  (${file})`)
  if (!dashboardLabels.has(action)) missingFromDashboard.push(`${action}  (${file})`)
}

assert.deepEqual(
  missingFromActivity, [],
  `${ACTIVITY_CLIENT_PATH} ACTION_LABELS is missing a Thai label for:\n${missingFromActivity.join('\n')}`,
)
assert.deepEqual(
  missingFromDashboard, [],
  `${DASHBOARD_PAGE_PATH} ACTION_LABELS is missing a Thai label for:\n${missingFromDashboard.join('\n')}`,
)

// ── ทุก action ที่ไม่ได้ถูก exclude ต้องอยู่ใน CATEGORY_ACTIONS ฝั่ง server ──
// (พลาดจุดนี้แล้วปุ่มกรองหมวดหมู่จะโชว์ผลลัพธ์ว่างเปล่า หรือแย่กว่านั้น — โชว์ทุกอย่างไม่กรองเลย
// ถ้าหมวดนั้นไม่มี key ใน CATEGORY_ACTIONS เลย แบบที่เคยเกิดกับปุ่ม "แบบสำรวจความพึงพอใจ")
const categoryBlockMatch = activityRoute.match(/const CATEGORY_ACTIONS[\s\S]*?\n}\n/)
assert.ok(categoryBlockMatch, `CATEGORY_ACTIONS map not found in ${ACTIVITY_ROUTE_PATH}`)
const excludedMatch = activityRoute.match(/const EXCLUDED\s*=\s*\[([\s\S]*?)\]/)
assert.ok(excludedMatch, `EXCLUDED list not found in ${ACTIVITY_ROUTE_PATH}`)
const routeExcluded = new Set([...excludedMatch![1].matchAll(/['"]([\w.\-]+)['"]/g)].map((x) => x[1]))
const categorizedActions = new Set([...categoryBlockMatch![0].matchAll(/'([\w.\-]+)'/g)].map((x) => x[1]))

// action ที่ตั้งใจไม่ผูกกับหมวดใดเลย (โผล่เฉพาะใต้ปุ่ม "ทั้งหมด") เพราะไม่มีหมวดที่เข้ากันจริงๆ
// และเกิดไม่บ่อยพอที่จะคุ้มการเพิ่มปุ่มใหม่ — ถ้ามีเพิ่ม ให้พิจารณาก่อนว่าควรมีหมวดใหม่หรือไม่
const UNCATEGORIZED_BY_DESIGN = new Set(['phleb_upload_init'])

const uncategorized: string[] = []
for (const [action, file] of found) {
  if (NOT_REQUIRED.has(action) || routeExcluded.has(action) || UNCATEGORIZED_BY_DESIGN.has(action)) continue
  if (!categorizedActions.has(action)) uncategorized.push(`${action}  (${file})`)
}
assert.deepEqual(
  uncategorized, [],
  `${ACTIVITY_ROUTE_PATH} CATEGORY_ACTIONS is missing:\n${uncategorized.join('\n')}`,
)

// ── ทุกปุ่มกรองหมวดหมู่ใน ActivityClient.tsx ต้องมี entry ใน CATEGORY_ACTIONS ฝั่ง server ──
const categoriesBlockMatch = activityClient.match(/const CATEGORIES[\s\S]*?\n\]/)
assert.ok(categoriesBlockMatch, `CATEGORIES pill list not found in ${ACTIVITY_CLIENT_PATH}`)
const pillKeys = [...categoriesBlockMatch![0].matchAll(/key:\s*'([\w]*)'/g)].map((x) => x[1]).filter(Boolean)
const categoryTopKeys = new Set([...categoryBlockMatch![0].matchAll(/^ {2}(\w+):/gm)].map((x) => x[1]))

const pillsMissingServerEntry = pillKeys.filter((k) => !categoryTopKeys.has(k))
assert.deepEqual(
  pillsMissingServerEntry, [],
  `${ACTIVITY_CLIENT_PATH} has category pill(s) with no matching entry in ${ACTIVITY_ROUTE_PATH} CATEGORY_ACTIONS ` +
  `(the pill would silently show everything unfiltered instead of filtering): ${pillsMissingServerEntry.join(', ')}`,
)

// ── ทุก action ต้องอยู่ใน CRUD_ACTIONS ของวิดเจ็ต "กิจกรรมล่าสุด" หน้า dashboard ──
// (allowlist นี้กรอง query ตั้งแต่ต้น — action ที่ตกหล่นจะไม่มีวันถูกดึงมาเลย ต่อให้ label ครบแค่ไหน)
const ADMIN_QUERIES_PATH = 'lib/queries/admin.ts'
const adminQueries = readFileSync(ADMIN_QUERIES_PATH, 'utf8')
const crudBlockMatch = adminQueries.match(/const CRUD_ACTIONS = \[[\s\S]*?\n\]/)
assert.ok(crudBlockMatch, `CRUD_ACTIONS list not found in ${ADMIN_QUERIES_PATH}`)
const crudActions = new Set([...crudBlockMatch![0].matchAll(/'([\w.\-]+)'/g)].map((x) => x[1]))

const missingFromCrudActions: string[] = []
for (const [action, file] of found) {
  if (NOT_REQUIRED.has(action)) continue
  if (!crudActions.has(action)) missingFromCrudActions.push(`${action}  (${file})`)
}
assert.deepEqual(
  missingFromCrudActions, [],
  `${ADMIN_QUERIES_PATH} CRUD_ACTIONS is missing (dashboard widget silently drops these rows):\n${missingFromCrudActions.join('\n')}`,
)

console.log(`activity-log-labels: OK — ${found.size} action codes, all labelled, categorized, and queryable`)
