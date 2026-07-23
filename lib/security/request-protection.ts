import 'server-only'

import { createHmac } from 'node:crypto'
import { requiredEnv } from '@/lib/env'
import { consumeRateLimit } from './rate-limit'

export function getClientIp(headers: Headers) {
  const vercelIp = headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
  if (vercelIp) return vercelIp
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

export function privateRequestKey(namespace: string, value: string) {
  return createHmac('sha256', requiredEnv('SUPABASE_SERVICE_ROLE_KEY'))
    .update(`${namespace}:${value}`)
    .digest('hex')
}

export function consumeClientRateLimit(headers: Headers, namespace: string, limit: number, windowMs: number) {
  return consumeRateLimit({
    key: `${namespace}:${privateRequestKey(`${namespace}-ip`, getClientIp(headers))}`,
    limit,
    windowMs,
  })
}
