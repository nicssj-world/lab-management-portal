// การตัดสินใจเรื่อง session ที่ proxy (server) กับ browser client ต้องเห็นตรงกัน
// แยกออกมาเป็นโมดูลบริสุทธิ์ เพื่อให้ทดสอบได้โดยไม่ต้องพึ่ง next/server หรือ window

/** เส้นทางที่ต้องล็อกอิน — นอกจากนี้คือหน้า public ที่การไม่มี session เป็นเรื่องปกติ */
const PROTECTED_PATH_PATTERN = /^\/(staff|kpi|lab-workload|tat)(?:\/|$)/

export function isProtectedPath(path: string) {
  return PROTECTED_PATH_PATTERN.test(path)
}

/** ชื่อ query param ที่ proxy ใช้ฝากปลายทางไว้ให้หน้า login พากลับ */
export const RETURN_PATH_PARAM = 'next'

/**
 * ปลายทางที่ปลอดภัยพอจะพาผู้ใช้กลับไปหลังล็อกอิน
 *
 * นี่คือช่องทาง open redirect คลาสสิก — ถ้ารับค่าดิบ ผู้โจมตีส่งลิงก์
 * /login?next=https://เว็บปลอม ให้เหยื่อ พอล็อกอินเสร็จระบบจะพาออกไปหน้าปลอมเอง
 * จึงรับเฉพาะ path ภายในที่เราเป็นคนเด้งมาจริง ๆ เท่านั้น
 */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value) return null

  // ต้องเป็น path ภายใน — ตัด https://evil.com และ javascript: ทิ้ง
  if (!value.startsWith('/')) return null
  // //evil.com เป็น scheme-relative URL ส่วน /\evil.com เบราว์เซอร์บางตัวตีความเหมือนกัน
  if (value.startsWith('//') || value.startsWith('/\\')) return null
  // ขึ้นบรรทัดใหม่ใน Location header เปิดทาง header injection
  if (/[\r\n\t]/.test(value)) return null

  // allowlist แคบที่สุด: เฉพาะหน้าที่ proxy เด้งมาจริง ๆ เท่านั้น
  const [pathname] = value.split('?')
  return isProtectedPath(pathname) ? value : null
}

/**
 * แยก "auth server ตอบไม่ได้" ออกจาก "ผู้ใช้ไม่ได้ล็อกอิน"
 * เน็ตหลุด / timeout / 5xx เป็นเรื่องชั่วคราว ถ้าเหมารวมว่าไม่ได้ล็อกอินแล้วลบ cookie ทิ้ง
 * session ที่ยังใช้ได้จะตายถาวรจากความผิดพลาดครั้งเดียว
 */
export function isAuthServiceUnavailable(reason: unknown) {
  if (!reason || typeof reason !== 'object') return false

  const { name, status } = reason as { name?: string; status?: number }
  if (name === 'AuthRetryableFetchError') return true

  // AuthSessionMissingError / AuthApiError ที่เป็น 4xx คือคำตอบชัดเจนว่าไม่มีสิทธิ์
  // error ที่ไม่มี status (เช่น TypeError จาก fetch ที่ล้ม) ถือว่าติดต่อ server ไม่ได้
  if (typeof status !== 'number') return true
  return status === 0 || status >= 500
}
