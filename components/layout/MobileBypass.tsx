'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const KEY = 'mobile_bypass'

/** Runs on every protected page load — restores bypass state from localStorage */
export function MobileBypassInit() {
  useEffect(() => {
    if (localStorage.getItem(KEY) === '1') {
      document.documentElement.setAttribute('data-mobile-bypass', '1')
    }
  }, [])
  return null
}

/** Button shown on the mobile-block screen */
export function MobileBypassButton() {
  const router = useRouter()
  function confirm() {
    localStorage.setItem(KEY, '1')
    document.documentElement.setAttribute('data-mobile-bypass', '1')
    router.push('/staff/dashboard')
  }
  return (
    <button
      onClick={confirm}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 10,
        background: 'var(--card)',
        color: 'var(--muted)',
        border: '1px solid var(--border)',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      ยืนยันจะใช้งานผ่านโทรศัพท์
    </button>
  )
}
