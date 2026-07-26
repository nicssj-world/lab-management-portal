import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isProtectedPath } from '../lib/auth/session-guard'
import { RESOURCES } from '../lib/permission-resources'
import {
  ACTIVITY_TYPES, APPOINTMENTS, BADGE_STATES, ORG_TYPES, SAFETY_ACKS, VISIT_TYPES,
} from '../lib/it-visitor/constants'
import { validateVisitorSubmission } from '../lib/it-visitor/validation'
import type { VisitorSubmissionInput } from '../lib/it-visitor/types'

const read = (path: string) => {
  const full = join(process.cwd(), path)
  return existsSync(full) ? readFileSync(full, 'utf8') : ''
}

/**
 * ตัดคอมเมนต์ออกก่อนตรวจ "ต้องไม่มี ..." — ไม่งั้นคอมเมนต์ที่อธิบายว่า
 * "จงใจไม่ใช้ X" จะทำให้ assertion ที่ห้าม X ล้มเอง
 */
const codeOnly = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*\r?$/, ''))
    .join('\n')

const publicRoute = read('app/api/it-visitors/[token]/route.ts')
const publicPage = read('app/v/[token]/page.tsx')
const publicForm = read('components/it-visitor/PublicVisitorForm.tsx')
const activeVisitCard = read('components/it-visitor/ActiveVisitCard.tsx')
const publicServer = read('lib/it-visitor/public-server.ts')
const guard = read('lib/it-visitor/guard.ts')
const listRoute = read('app/api/admin/it-visitors/route.ts')
const itemRoute = read('app/api/admin/it-visitors/[id]/route.ts')
const settingsRoute = read('app/api/admin/it-visitors/settings/route.ts')
const staffClient = read('app/(protected)/staff/it/visitors/ItVisitorsClient.tsx')
const staffPage = read('app/(protected)/staff/it/visitors/page.tsx')
const activityClient = read('app/(protected)/staff/activity/ActivityClient.tsx')
const dashboardPage = read('app/(protected)/staff/dashboard/page.tsx')
const supabaseTypes = read('lib/supabase/types.ts')
const itQueries = read('lib/queries/it-access.ts')
const readme = read('README.md')
const sidebar = read('components/layout/StaffSidebar.tsx')
const sql = read('scripts/it-visitor-log.sql')
const selfCheckoutSql = read('scripts/it-visitor-self-checkout.sql')
const surveyPublicServer = read('lib/surveys/public-server.ts')

for (const source of [publicRoute, publicPage, itemRoute]) {
  assert.match(source, /params\s*:\s*Promise</)
  assert.ok(source.includes('await params'))
}

// ── 1. Public route ต้องเป็น public จริง ──
for (const forbidden of ['requireVisitorLog(', 'requireIt(', 'getItActor(']) {
  assert.ok(!codeOnly(publicRoute).includes(forbidden), `public API must not call ${forbidden}`)
}

// ── 2. ด่านกันสแปมครบ ──
assert.ok(publicRoute.includes('content-length'), 'checks content-length')
assert.ok(publicRoute.includes('MAX_BODY_BYTES'), 'enforces a body cap')
assert.ok(publicRoute.includes('status: 413'), 'rejects oversized bodies with 413')
assert.ok(publicRoute.includes('parsed.data.website.trim()'), 'has honeypot')
assert.ok(publicRoute.includes('verifyVisitorChallenge'), 'verifies signed challenge')
assert.ok(publicRoute.includes('visitor-submit-visitor:'))
assert.ok(publicRoute.includes('visitor-submit-ip:'))
assert.ok(publicRoute.includes('visitor-submit-form:'))
assert.equal(
  (publicRoute.match(/consumeRateLimit\(/g) ?? []).length >= 4, true,
  'at least three submit limits plus the GET limit',
)
assert.ok(publicRoute.includes('status: 429'))
assert.ok(publicPage.includes('createVisitorChallenge'))
assert.ok(publicPage.includes('<PublicVisitorForm'))

// idempotency ต้องเช็ค "ก่อน" gate ปิดฟอร์ม — retry หลังฟอร์มเพิ่งถูกปิด
// ต้องได้ id เดิม ไม่ใช่ 409 ที่ทำให้ผู้ใช้คิดว่าบันทึกไม่สำเร็จ
const idempotencyAt = publicRoute.indexOf('existingVisitorSubmission(parsed.data.submissionKey)')
const closedGateAt = publicRoute.indexOf('!state.available')
assert.ok(idempotencyAt > 0 && closedGateAt > 0, 'both checks present')
assert.ok(idempotencyAt < closedGateAt, 'idempotency check must come before the closed-form gate')

// checkout credential ผูกกับรายการที่เปิดอยู่ ไม่ใช่ cookie กันส่งแบบสำรวจซ้ำ
assert.ok(publicRoute.includes("response.cookies.set('lab_visitor_checkout'"), 'sets checkout cookie')
assert.ok(publicRoute.includes('httpOnly: true'), 'checkout cookie is HttpOnly')
assert.ok(publicRoute.includes("sameSite: 'lax'"), 'checkout cookie is SameSite=Lax')
assert.ok(publicRoute.includes("secure: process.env.NODE_ENV === 'production'"), 'checkout cookie is Secure in production')
assert.ok(publicServer.includes('checkout_secret_hash'), 'stores only the checkout secret hash')
assert.ok(selfCheckoutSql.includes('checkout_method'), 'migration tracks checkout method')
assert.ok(selfCheckoutSql.includes('checkout_secret_hash'), 'migration stores checkout secret hash')
assert.ok(publicPage.includes('await cookies()'), 'page restores the same-device active visit')
assert.ok(publicPage.includes('initialActiveVisit'), 'page passes a minimal active visit DTO')

// self checkout ต้องใช้ credential ใน HttpOnly cookie และป้องกัน cross-site request
assert.ok(publicRoute.includes('export async function PATCH'), 'public route supports self checkout')
assert.ok(publicRoute.includes("request.cookies.get('lab_visitor_checkout')"), 'reads checkout cookie')
assert.ok(publicRoute.includes('isSameOriginRequest'), 'validates Origin against request host')
assert.ok(publicRoute.includes('visitor-checkout-ip:'), 'rate limits checkout by IP')
assert.ok(publicRoute.includes('visitor-checkout-form:'), 'rate limits checkout by form')
assert.ok(publicServer.includes('selfCheckoutVisitor'), 'server exposes one-time self checkout')
assert.ok(publicServer.includes("checkout_method: 'self'"), 'marks self checkout method')
assert.ok(publicServer.includes('checkout_secret_hash: null'), 'invalidates checkout secret after use')
assert.ok(publicServer.includes("action: 'it_visitor.self_checkout'"), 'audits self checkout')

assert.ok(activeVisitCard.includes("setMapDialog('navigation')"), 'active card opens the map popup in navigation mode')
assert.ok(activeVisitCard.includes("setMapDialog('safety')"), 'active card opens the map popup in safety mode')
assert.ok(!activeVisitCard.includes('/lab-map/office'), 'active card no longer navigates to a public map route')
assert.ok(activeVisitCard.includes('บันทึกออก'), 'active card offers checkout')
assert.ok(activeVisitCard.includes('disabled={submitting}'), 'checkout button prevents duplicate submits')

// ฝั่งเจ้าหน้าที่ต้องปิดรายการแทนได้ และเห็นที่มาของเวลาออกอย่างชัดเจน
assert.ok(itemRoute.includes("checkout_method = 'staff'") || itemRoute.includes("checkout_method: 'staff'"),
  'staff checkout records its method')
assert.ok(itemRoute.includes('checkout_secret_hash = null') || itemRoute.includes('checkout_secret_hash: null'),
  'staff checkout invalidates the visitor credential')
assert.ok(staffClient.includes('ผู้มาติดต่อบันทึกเอง'), 'staff detail labels self checkout')
assert.ok(staffClient.includes('เจ้าหน้าที่บันทึกให้'), 'staff detail labels assisted checkout')
assert.ok(activityClient.includes("'it_visitor.self_checkout'"), 'activity page labels self checkout')
assert.ok(dashboardPage.includes("'it_visitor.self_checkout'"), 'dashboard labels self checkout')
assert.ok(supabaseTypes.includes('checkout_method:'), 'visitor row type includes checkout method')
assert.ok(itQueries.includes('IT_VISITOR_LOG_SELECT'), 'staff list uses an explicit visitor projection')
assert.ok(!itQueries.includes(".select('*, closer:profiles!it_visitor_logs"),
  'staff list must not serialize the checkout credential hash')
assert.ok(readme.includes('it-visitor-self-checkout.sql'), 'deployment docs include checkout migration')

// ── 3. Routing — /v ต้อง public, /staff ต้องถูกป้องกัน ──
assert.equal(isProtectedPath('/v/abc'), false, '/v must stay public')
assert.equal(isProtectedPath('/staff/it/visitors'), true)

// ── 4. Permission resource ──
assert.ok((RESOURCES as readonly string[]).includes('บันทึกการเข้า-ออก'), 'resource registered')
assert.ok(guard.includes("VISITOR_RESOURCE = 'บันทึกการเข้า-ออก'"))
assert.ok(
  !guard.includes('getPermissionsWithItOverride'),
  'no IT-committee override on this resource — visibility comes from the matrix alone',
)
assert.ok(staffPage.includes('VISITOR_RESOURCE'), 'staff page gates on the new resource')
assert.ok(
  !codeOnly(staffPage).includes('ระบบสารสนเทศ (IT)'),
  'staff page must not gate on the IT resource',
)

// ทุก role ยกเว้น Assistant — seed ต้องไม่มีแถวของ Assistant
for (const role of ['Manager', 'Medical Technologist', 'Medical Science Technician']) {
  assert.ok(sql.includes(`('${role}',`), `seeds ${role}`)
}
assert.ok(!/\('Assistant',\s*'บันทึกการเข้า-ออก/.test(sql), 'Assistant must not be granted')

// ── 5. กับดัก sidebar: ตัวแม่ของกลุ่ม IT ต้องไม่ถือ resource ──
// isEntryVisible เช็ค resource ของแม่แล้ว return false ก่อนดูลูก ถ้าใส่คืนเมื่อไหร่
// คนที่มีสิทธิ์เฉพาะบันทึกการเข้า-ออกจะไม่เห็นกลุ่มนี้เลย
// แยกแม่จากลูกด้วยระดับ indent (แม่อยู่ระดับบนสุดของ NAV_ITEMS = 2 ช่อง, ลูก = 6 ช่อง)
// ไม่ใช้ "ไม่มี resource" เป็นตัวแยก เพราะนั่นคือสิ่งที่กำลังจะตรวจ
const itParent = codeOnly(sidebar).split('\n')
  .find((line) => /^ {2}\{ href: '\/staff\/it\/access'/.test(line))
assert.ok(itParent, 'found the IT group parent line')
assert.ok(!itParent!.includes('resource:'), 'IT group parent must NOT carry a resource')
for (const child of ['/staff/it/access', '/staff/it/downtime', '/staff/it/backup']) {
  assert.ok(
    new RegExp(`href: '${child}',[^\\n]*resource: 'ระบบสารสนเทศ \\(IT\\)'`).test(sidebar),
    `${child} child carries the IT resource`,
  )
}
assert.ok(
  /href: '\/staff\/it\/visitors',[^\n]*resource: 'บันทึกการเข้า-ออก'/.test(sidebar),
  'visitor child carries its own resource',
)

// ── 6. ลบได้เฉพาะ Admin — ต้องบังคับที่ route ไม่ใช่แค่ซ่อนปุ่ม ──
assert.ok(itemRoute.includes('canDeleteVisitorLog'), 'DELETE enforces the admin-only rule')
assert.ok(guard.includes('isAdminRole'), 'canDeleteVisitorLog is role-based')
assert.ok(itemRoute.includes('status: 403'))

for (const source of [listRoute, itemRoute, settingsRoute]) {
  assert.ok(source.includes('requireVisitorLog('), 'staff route is guarded')
}
for (const source of [itemRoute, settingsRoute]) {
  assert.ok(source.includes('.safeParse('), 'staff mutations validate input')
  assert.ok(source.includes('status: 422'), 'validation failures return 422')
}

// ── 7. enum ใน constants ต้องตรงกับ CHECK ใน SQL ──
const checkValues = (column: string) => {
  const match = new RegExp(`${column}\\s+text[^,]*?CHECK \\(${column} IN \\(([^)]*)\\)`, 's').exec(sql)
  assert.ok(match, `found CHECK for ${column}`)
  return match![1].split(',').map((v) => v.trim().replace(/^'|'$/g, '')).filter(Boolean).sort()
}
assert.deepEqual(checkValues('visit_type'), [...VISIT_TYPES].sort())
assert.deepEqual(checkValues('org_type'), [...ORG_TYPES].sort())
assert.deepEqual(checkValues('activity_type'), [...ACTIVITY_TYPES].sort())
assert.deepEqual(checkValues('appointment'), [...APPOINTMENTS].sort())
assert.deepEqual(checkValues('badge_exchanged'), [...BADGE_STATES].sort())
assert.deepEqual(checkValues('safety_ack'), [...SAFETY_ACKS].sort())

// ── 8. public_token ต้องไม่หลุดถึง anon/authenticated ──
assert.ok(
  /REVOKE ALL ON it_visitor_form_settings FROM anon, authenticated/i.test(sql),
  'settings table revoked from anon + authenticated',
)
assert.ok(
  !/CREATE POLICY[^\n]*it_visitor_form_settings/i.test(sql),
  'settings table must have no read policy',
)
assert.ok(/ENABLE ROW LEVEL SECURITY/i.test(sql))
assert.ok(!publicServer.includes('public_token') || publicServer.includes('.eq(\'public_token\', token)'))

// ── 9. QR ──
assert.ok(staffClient.includes('QRCode.toDataURL'))
assert.ok(staffClient.includes('download'))
assert.ok(staffClient.includes('/v/'))

// ── 10. refactor challenge ต้องไม่ทำแบบสำรวจพัง ──
assert.ok(surveyPublicServer.includes('export function createPublicSurveyChallenge'))
assert.ok(surveyPublicServer.includes('export function verifyPublicSurveyChallenge'))
assert.ok(
  surveyPublicServer.includes("'survey-challenge'"),
  'survey purpose string unchanged so existing challenges stay valid',
)

// ── 11. accessibility ของฟอร์มสาธารณะ ──
assert.ok(publicForm.includes('role="alert"'))
assert.ok(publicForm.includes('aria-live="polite"'))
assert.ok(publicForm.includes('disabled={submitting'))
assert.ok(publicForm.includes('submissionKeyRef'))
assert.ok(publicForm.includes('honeypotRef'))
assert.ok(publicForm.includes('role="radiogroup"'))
assert.ok(publicForm.includes('validateVisitorSubmission'), 'client reuses the server validator')

// ── 12. กฎ validation ที่สำคัญ (รันจริง ไม่ใช่ดูข้อความ) ──
const base: VisitorSubmissionInput = {
  visit_type: 'individual',
  visit_date: '2026-07-25',
  visitor_name: 'สมชาย ใจดี',
  head_count: 0,
  phone: '0812345678',
  org_type: 'external',
  org_name: 'บริษัท ตัวอย่าง จำกัด',
  contact_dept: 'งานเคมีคลินิก',
  entered_at: new Date('2026-07-25T09:00:00Z').toISOString(),
  activity_type: 'maintenance',
  appointment: 'booked',
  badge_exchanged: 'yes',
  safety_ack: 'acknowledged',
}
const now = new Date('2026-07-25T10:00:00Z').getTime()

const ok = validateVisitorSubmission(base, now)
assert.ok(ok.ok, 'valid individual submission passes')
// รายบุคคล: ผู้ติดตาม 0 → party_size 1 (นับตัวผู้กรอกด้วย)
assert.equal(ok.ok && ok.row.party_size, 1)
assert.equal(ok.ok && ok.row.group_name, null, 'individual never stores a group name')

const withFollowers = validateVisitorSubmission({ ...base, head_count: 3 }, now)
assert.equal(withFollowers.ok && withFollowers.row.party_size, 4, 'followers + self')

// หมู่คณะ: กรอกจำนวนรวมมาแล้ว ไม่ต้องบวกเพิ่ม
const group = validateVisitorSubmission(
  { ...base, visit_type: 'group', group_name: 'คณะดูงาน', head_count: 12 }, now,
)
assert.equal(group.ok && group.row.party_size, 12, 'group head_count is already the total')

const groupNoName = validateVisitorSubmission({ ...base, visit_type: 'group', head_count: 5 }, now)
assert.ok(!groupNoName.ok && groupNoName.issues.some((i) => i.field === 'group_name'))

const groupZero = validateVisitorSubmission(
  { ...base, visit_type: 'group', group_name: 'คณะ', head_count: 0 }, now,
)
assert.ok(!groupZero.ok, 'group must have at least one person')

const otherMissing = validateVisitorSubmission({ ...base, activity_type: 'other' }, now)
assert.ok(!otherMissing.ok && otherMissing.issues.some((i) => i.field === 'activity_other'))

const future = validateVisitorSubmission(
  { ...base, entered_at: new Date(now + 3 * 60 * 60 * 1000).toISOString() }, now,
)
assert.ok(!future.ok && future.issues.some((i) => i.field === 'entered_at'))

const noPhone = validateVisitorSubmission({ ...base, phone: '  ' }, now)
assert.ok(!noPhone.ok && noPhone.issues.some((i) => i.field === 'phone'))

// อีเมลไม่บังคับ แต่ถ้ากรอกต้องถูกรูปแบบ
assert.ok(validateVisitorSubmission({ ...base, email: '' }, now).ok, 'email optional')
const badEmail = validateVisitorSubmission({ ...base, email: 'not-an-email' }, now)
assert.ok(!badEmail.ok && badEmail.issues.some((i) => i.field === 'email'))

// "ไม่ยินยอม" ต้องบันทึกได้ (ขึ้นธงแดงในตาราง staff ไม่ใช่บล็อกการส่ง)
assert.ok(validateVisitorSubmission({ ...base, safety_ack: 'declined' }, now).ok,
  'declining the safety policy is recorded, not blocked')

console.log('it visitor log tests passed')
