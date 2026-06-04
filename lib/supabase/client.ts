import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | undefined
let staleAuthHandlerInstalled = false

function isInvalidRefreshTokenError(reason: unknown) {
  const message = reason instanceof Error
    ? reason.message
    : typeof reason === 'object' && reason && 'message' in reason
      ? String((reason as { message?: unknown }).message)
      : String(reason ?? '')

  return message.includes('Invalid Refresh Token') || message.includes('Refresh Token Not Found')
}

export function clearStaleAuthSession() {
  if (typeof window === 'undefined') return

  for (let i = window.localStorage.length - 1; i >= 0; i--) {
    const key = window.localStorage.key(i)
    if (key?.startsWith('sb-')) window.localStorage.removeItem(key)
  }

  document.cookie
    .split(';')
    .map((cookie) => cookie.trim().split('=')[0])
    .filter((name) => name.startsWith('sb-'))
    .forEach((name) => {
      document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
    })
}

function installStaleAuthHandler() {
  if (staleAuthHandlerInstalled || typeof window === 'undefined') return
  staleAuthHandlerInstalled = true

  window.addEventListener('unhandledrejection', (event) => {
    if (!isInvalidRefreshTokenError(event.reason)) return
    event.preventDefault()
    clearStaleAuthSession()
    if (window.location.pathname !== '/login') {
      window.location.assign('/login')
    }
  })
}

export function createClient() {
  installStaleAuthHandler()
  browserClient ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return browserClient
}
