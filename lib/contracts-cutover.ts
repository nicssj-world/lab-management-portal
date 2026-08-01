import { NextResponse } from 'next/server'

// The contract-management module ("บริหารสัญญา") lives in LABCBH Stock. Keep a
// safe production destination in source so a missing Vercel environment value
// cannot accidentally reactivate the retired portal module.

type Env = Record<string, string | undefined>
const DEFAULT_LABCBH_STOCK_URL = 'https://labcbh-stock.vercel.app'

export function contractsCutoverTarget(env: Env = process.env): string | null {
  const raw = env.LABCBH_STOCK_URL?.trim() || DEFAULT_LABCBH_STOCK_URL

  // Only an absolute http(s) origin is usable. Anything else — a relative path,
  // a javascript: payload — would turn this into an open redirect.
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return DEFAULT_LABCBH_STOCK_URL
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return DEFAULT_LABCBH_STOCK_URL

  // Credentials in the URL would be handed to the browser on redirect.
  if (parsed.username || parsed.password) return DEFAULT_LABCBH_STOCK_URL

  // Normalise through the URL object rather than trimming the raw string: a
  // configured query or fragment must be dropped, not left in the middle when
  // callers append a path to it.
  parsed.search = ''
  parsed.hash = ''
  parsed.pathname = parsed.pathname.replace(/\/+$/, '')

  // URL.toString re-adds a trailing slash for an empty path; strip it so
  // callers can append a destination path without doubling the separator.
  return parsed.toString().replace(/\/+$/, '')
}

export function isContractsCutoverActive(env: Env = process.env): boolean {
  return contractsCutoverTarget(env) !== null
}

export function legacyContractRedirect(env: Env = process.env): string | null {
  const target = contractsCutoverTarget(env)
  return target ? `${target}/dashboard` : null
}

export function contractsGoneResponse(target: string | null): NextResponse {
  return NextResponse.json(
    {
      error: 'โมดูลบริหารสัญญาย้ายไปที่ระบบ LABCBH Stock แล้ว การแก้ไขข้อมูลต้องทำที่ระบบใหม่',
      movedTo: target ? `${target}/contracts` : null,
    },
    { status: 410 },
  )
}
