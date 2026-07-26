import { NextResponse } from 'next/server'
import type { ZodError, ZodType } from 'zod'

export function queryObject(params: URLSearchParams) {
  return Object.fromEntries(params.entries())
}

export function validationError(error: ZodError) {
  return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง', issues: error.flatten() }, { status: 422 })
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<{ data: T; response?: undefined } | { data?: undefined; response: NextResponse }> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { response: NextResponse.json({ error: 'JSON ไม่ถูกต้อง' }, { status: 422 }) }
  }
  const parsed = schema.safeParse(body)
  return parsed.success ? { data: parsed.data } : { response: validationError(parsed.error) }
}

export function unexpectedError(error: unknown) {
  console.error('chemical-safety request failed', error instanceof Error ? error.message : 'unknown error')
  return NextResponse.json({ error: 'ไม่สามารถดำเนินการได้' }, { status: 500 })
}

export function transitionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (/not_found/i.test(message)) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
  if (/not_draft|not_in_review|stale|self_review|already/i.test(message)) {
    return NextResponse.json({ error: 'สถานะรายการเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่' }, { status: 409 })
  }
  return unexpectedError(error)
}
