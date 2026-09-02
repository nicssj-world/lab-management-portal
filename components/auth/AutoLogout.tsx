'use client'

import { useEffect } from 'react'
import { clearStaleAuthSession, createClient } from '@/lib/supabase/client'

export const AUTO_LOGOUT_TIMEOUT_MS = 30 * 60 * 1000

const ACTIVITY_EVENTS = [
  'keydown',
  'mousedown',
  'mousemove',
  'pointerdown',
  'pointermove',
  'scroll',
  'touchstart',
  'wheel',
] as const

const ACTIVITY_RESCHEDULE_DELAY_MS = 1000

/** Logs the current browser session out after 30 minutes without user activity. */
export function AutoLogout() {
  useEffect(() => {
    const supabase = createClient()
    let isAuthenticated = false
    let authenticatedUserId: string | null = null
    let isLoggingOut = false
    let lastActivityAt = Date.now()
    let logoutTimer: number | null = null
    let rescheduleTimer: number | null = null

    function clearTimers() {
      if (logoutTimer !== null) {
        window.clearTimeout(logoutTimer)
        logoutTimer = null
      }
      if (rescheduleTimer !== null) {
        window.clearTimeout(rescheduleTimer)
        rescheduleTimer = null
      }
    }

    function scheduleLogout() {
      if (!isAuthenticated || isLoggingOut) return

      if (logoutTimer !== null) window.clearTimeout(logoutTimer)

      const idleFor = Date.now() - lastActivityAt
      const remaining = AUTO_LOGOUT_TIMEOUT_MS - idleFor
      logoutTimer = window.setTimeout(checkIdle, Math.max(0, remaining))
    }

    async function logoutForInactivity() {
      if (!isAuthenticated || isLoggingOut) return

      isLoggingOut = true
      clearTimers()

      try {
        const { error } = await supabase.auth.signOut({ scope: 'local' })
        if (error) {
          // If the auth endpoint is unavailable, still remove the browser-side
          // session so this protected page cannot remain usable in this tab.
          clearStaleAuthSession()
          window.location.assign('/login')
        }
      } catch {
        clearStaleAuthSession()
        window.location.assign('/login')
      }
    }

    function checkIdle() {
      logoutTimer = null
      if (!isAuthenticated || isLoggingOut) return

      if (Date.now() - lastActivityAt >= AUTO_LOGOUT_TIMEOUT_MS) {
        void logoutForInactivity()
        return
      }

      scheduleLogout()
    }

    function recordActivity() {
      if (!isAuthenticated || isLoggingOut) return

      lastActivityAt = Date.now()

      // Mouse/pointer events can fire many times per second. The timestamp is
      // updated for every event, while the timeout is only rescheduled once a
      // second. The timeout callback re-checks the timestamp before logging out.
      if (rescheduleTimer !== null) return
      rescheduleTimer = window.setTimeout(() => {
        rescheduleTimer = null
        scheduleLogout()
      }, ACTIVITY_RESCHEDULE_DELAY_MS)
    }

    function checkIdleOnReturn() {
      checkIdle()
    }

    function applySession(session: { user?: { id?: string } } | null) {
      const userId = session?.user?.id ?? null

      if (!userId) {
        isAuthenticated = false
        authenticatedUserId = null
        clearTimers()
        return
      }

      if (authenticatedUserId !== userId) {
        authenticatedUserId = userId
        lastActivityAt = Date.now()
      }

      isAuthenticated = true
      scheduleLogout()
    }

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, { passive: true })
    })
    document.addEventListener('visibilitychange', checkIdleOnReturn)
    window.addEventListener('focus', checkIdleOnReturn)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session)
    })

    void supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session)
    }).catch(() => {
      // The protected server layout remains the source of truth when the
      // browser cannot read the session during startup.
    })

    return () => {
      subscription.unsubscribe()
      clearTimers()
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity)
      })
      document.removeEventListener('visibilitychange', checkIdleOnReturn)
      window.removeEventListener('focus', checkIdleOnReturn)
    }
  }, [])

  return null
}
