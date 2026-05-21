'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'

export function NewsShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleShare}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 36, padding: '0 14px', borderRadius: 8,
        border: '1px solid var(--border)', background: 'var(--card)',
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
        color: copied ? 'var(--success)' : 'var(--ink)',
        fontWeight: 500, transition: 'all .15s',
      }}
    >
      <Icon name={copied ? 'check' : 'globe'} size={13} />
      {copied ? 'คัดลอกแล้ว' : 'แชร์'}
    </button>
  )
}
