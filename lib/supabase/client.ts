import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isProtectedPath } from '@/lib/auth/session-guard'

let browserClient: SupabaseClient | undefined
let staleAuthHandlerInstalled = false

function errorMessage(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : typeof reason === 'object' && reason && 'message' in reason
      ? String((reason as { message?: unknown }).message)
      : String(reason ?? '')
}

export function isInvalidRefreshTokenError(reason: unknown) {
  const message = errorMessage(reason)

  return message.includes('Invalid Refresh Token') || message.includes('Refresh Token Not Found')
}

/**
 * ล้าง session ที่เก็บไว้เฉพาะกรณี refresh token ตายจริงเท่านั้น
 * ความล้มเหลวระดับเครือข่ายเกิดกับ fetch ตัวไหนในแอปก็ได้ ไม่ใช่สัญญาณว่า session เสีย
 */
export function recoverStaleAuthSession(reason: unknown) {
  if (!isInvalidRefreshTokenError(reason)) return false
  clearStaleAuthSession()
  return true
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

// การไม่มี session เป็นเรื่องปกติของหน้า public — เด้งไป /login เฉพาะหน้าที่ต้องล็อกอินจริง
function redirectToLoginIfProtected() {
  if (typeof window === 'undefined') return
  if (!isProtectedPath(window.location.pathname)) return
  window.location.assign('/login')
}

function installStaleAuthHandler() {
  if (staleAuthHandlerInstalled || typeof window === 'undefined') return
  staleAuthHandlerInstalled = true

  window.addEventListener('unhandledrejection', (event) => {
    if (!recoverStaleAuthSession(event.reason)) return
    event.preventDefault()
    redirectToLoginIfProtected()
  })
}

export function createClient() {
  installStaleAuthHandler()
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    browserClient.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') redirectToLoginIfProtected()
    })
  }
  return browserClient
}
