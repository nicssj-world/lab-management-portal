import { NextResponse } from 'next/server'

// The contract-management module ("บริหารสัญญา") moves to LABCBH Stock. Setting
// LABCBH_STOCK_URL is the single switch that retires it here: pages redirect,
// writes return 410 Gone, and read endpoints stay up for reconciliation.
//
// Until the variable is set the portal behaves exactly as before, so deploying
// this code is safe ahead of the database migration.

type Env = Record<string, string | undefined>

export function contractsCutoverTarget(env: Env = process.env): string | null {
  const raw = env.LABCBH_STOCK_URL?.trim()
  if (!raw) return null

  // Only an absolute http(s) origin is usable. Anything else — a relative path,
  // a javascript: payload — would turn this into an open redirect.
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

  return raw.replace(/\/+$/, '')
}

export function isContractsCutoverActive(env: Env = process.env): boolean {
  return contractsCutoverTarget(env) !== null
}

export function legacyContractRedirect(env: Env = process.env): string | null {
  const target = contractsCutoverTarget(env)
  return target ? `${target}/contracts` : null
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
