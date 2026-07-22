import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RETURN_PATH_PARAM, isAuthServiceUnavailable, isProtectedPath, safeReturnPath } from '../lib/auth/session-guard'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

// หน้าที่ต้องล็อกอิน — ตรงกับ route group (protected)
for (const path of ['/staff', '/staff/risk/ior', '/kpi/dashboard', '/lab-workload/dashboard', '/tat']) {
  assert.ok(isProtectedPath(path), `${path} ต้องล็อกอิน`)
}

// หน้า public — การไม่มี session เป็นเรื่องปกติ ห้ามเด้งไป /login
for (const path of ['/', '/catalog', '/news', '/manual', '/contact', '/login', '/s/abc123']) {
  assert.ok(!isProtectedPath(path), `${path} เป็นหน้า public`)
}

// prefix ชนกันต้องไม่ถูกนับเป็น protected
for (const path of ['/staffing', '/tattoo', '/kpi-report']) {
  assert.ok(!isProtectedPath(path), `${path} ไม่ใช่โมดูลที่ต้องล็อกอิน`)
}

// คำตอบชัดเจนจาก auth server ว่าไม่มีสิทธิ์ → ล้าง cookie แล้วเด้งได้
for (const error of [
  { name: 'AuthSessionMissingError', status: 400 },
  { name: 'AuthApiError', status: 401 },
  { name: 'AuthApiError', status: 403 },
]) {
  assert.ok(!isAuthServiceUnavailable(error), `${error.name} ${error.status} คือไม่ได้ล็อกอินจริง`)
}

// ติดต่อ auth server ไม่ได้ → ห้ามตีความว่าไม่ได้ล็อกอิน
for (const error of [
  { name: 'AuthRetryableFetchError', status: 0 },
  { name: 'AuthRetryableFetchError', status: 503 },
  { name: 'AuthApiError', status: 500 },
  new TypeError('Failed to fetch'),
]) {
  assert.ok(isAuthServiceUnavailable(error), `${(error as Error).name} ต้องถือว่าเป็นความล้มเหลวชั่วคราว`)
}

// proxy ต้องคง cookie ไว้เมื่อ auth server ล่ม ไม่งั้น session ที่ยังดีอยู่ตายถาวร
const proxySource = read('proxy.ts')
assert.ok(
  proxySource.indexOf('isAuthServiceUnavailable') < proxySource.indexOf('clearSupabaseAuthCookies(request, response)'),
  'proxy ตรวจความล้มเหลวชั่วคราวก่อนลบ cookie'
)

// network error ทั่วไปต้องไม่ทำให้ผู้ใช้หลุด session
const clientSource = read('lib/supabase/client.ts')
for (const message of ['Failed to fetch', 'NetworkError', 'Load failed']) {
  assert.ok(!clientSource.includes(message), `browser client ไม่ล้าง session เพราะ '${message}'`)
}
assert.ok(
  clientSource.includes('if (event === \'SIGNED_OUT\') redirectToLoginIfProtected()'),
  'SIGNED_OUT เด้งไป /login เฉพาะหน้าที่ต้องล็อกอิน'
)

// ── safeReturnPath: พากลับหน้าเดิมหลังล็อกอิน โดยไม่เปิดช่อง open redirect ──

// ปลายทางที่ proxy เด้งมาจริง — ต้องพากลับได้ และ query ต้องไม่หาย
assert.equal(safeReturnPath('/staff/risk/report'), '/staff/risk/report')
assert.equal(safeReturnPath('/staff/risk/ior?status=reported'), '/staff/risk/ior?status=reported')
assert.equal(safeReturnPath('/tat/dashboard?view=overview'), '/tat/dashboard?view=overview')

// พาออกนอกเว็บไม่ได้ — นี่คือเหตุผลทั้งหมดที่ฟังก์ชันนี้มีอยู่
for (const attack of [
  'https://evil.com',
  'http://evil.com',
  '//evil.com',
  '/\\evil.com',
  'javascript:alert(1)',
  '/staff/risk\r\nSet-Cookie: x=1',
]) {
  assert.equal(safeReturnPath(attack), null, `ต้องปฏิเสธ ${JSON.stringify(attack)}`)
}

// หน้า public ไม่ใช่ปลายทางที่ proxy เด้งมา จึงไม่ต้องพากลับ
for (const path of ['/login', '/', '/catalog', '/staffing']) {
  assert.equal(safeReturnPath(path), null, `${path} ไม่ใช่ปลายทางที่ต้องพากลับ`)
}

// ไม่มีค่า = ใช้ปลายทางเริ่มต้นของผู้เรียก
for (const empty of ['', null, undefined]) {
  assert.equal(safeReturnPath(empty), null)
}

// proxy กับ login ต้องใช้ชื่อ param เดียวกัน ไม่งั้นฝากไว้แล้วอีกฝั่งอ่านไม่เจอ
assert.equal(RETURN_PATH_PARAM, 'next')
assert.ok(proxySource.includes('RETURN_PATH_PARAM'), 'proxy แนบปลายทางไปกับ /login')
assert.ok(read('app/login/page.tsx').includes('RETURN_PATH_PARAM'), 'หน้า login อ่านปลายทางที่ฝากไว้')

console.log('session-guard: ok')
