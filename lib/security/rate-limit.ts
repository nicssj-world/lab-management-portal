type RateLimitEntry = {
  count: number
  resetAt: number
  touchedAt: number
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

type RateLimitInput = {
  key: string
  limit: number
  windowMs: number
  now?: number
}

const MAX_ENTRIES = 10_000
const SWEEP_INTERVAL = 100

const globalRateLimit = globalThis as typeof globalThis & {
  __labPortalRateLimits?: Map<string, RateLimitEntry>
  __labPortalRateLimitOps?: number
}

const entries = globalRateLimit.__labPortalRateLimits ?? new Map<string, RateLimitEntry>()
globalRateLimit.__labPortalRateLimits = entries

function maintainEntries(now: number) {
  globalRateLimit.__labPortalRateLimitOps = (globalRateLimit.__labPortalRateLimitOps ?? 0) + 1
  if (globalRateLimit.__labPortalRateLimitOps % SWEEP_INTERVAL === 0) {
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) entries.delete(key)
    }
  }

  if (entries.size < MAX_ENTRIES) return
  const oldest = [...entries.entries()]
    .sort((left, right) => left[1].touchedAt - right[1].touchedAt)
    .slice(0, Math.max(1, Math.ceil(MAX_ENTRIES * 0.1)))
  for (const [key] of oldest) entries.delete(key)
}

/**
 * A bounded, per-instance limiter that protects downstream Supabase/R2 work.
 * Vercel Firewall remains the distributed first line of defence.
 */
export function consumeRateLimit({ key, limit, windowMs, now = Date.now() }: RateLimitInput): RateLimitResult {
  if (!key || !Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1) {
    throw new Error('Invalid rate-limit configuration')
  }

  maintainEntries(now)
  const current = entries.get(key)
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs, touchedAt: now }
    : current

  entry.count += 1
  entry.touchedAt = now
  entries.set(key, entry)

  const allowed = entry.count <= limit
  return {
    allowed,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  }
}

