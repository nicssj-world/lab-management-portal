// The shift scheduler is a separate app that shares this portal's Supabase
// project. Keep its production origin in source so the SSO handoff remains
// usable even when the optional Vercel override is not configured.

type Env = Record<string, string | undefined>
const DEFAULT_SHIFT_SCHEDULER_URL = 'https://shift-mtcbh.vercel.app'

export function shiftSchedulerTarget(env: Env = process.env): string {
  const raw = env.SHIFT_SCHEDULER_URL?.trim() || DEFAULT_SHIFT_SCHEDULER_URL

  // Only an absolute http(s) origin is usable. Invalid overrides fall back to
  // the known production destination rather than becoming an open redirect.
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return DEFAULT_SHIFT_SCHEDULER_URL
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return DEFAULT_SHIFT_SCHEDULER_URL
  if (parsed.username || parsed.password) return DEFAULT_SHIFT_SCHEDULER_URL

  parsed.search = ''
  parsed.hash = ''
  parsed.pathname = parsed.pathname.replace(/\/+$/, '')
  return parsed.toString().replace(/\/+$/, '')
}
