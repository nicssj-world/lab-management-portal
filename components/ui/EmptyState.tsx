'use client'

import { Icon } from './Icon'

interface EmptyStateProps {
  title: string
  hint?: string
  icon?: string
}

export function EmptyState({ title, hint, icon = 'inbox' }: EmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
      <div style={{ width: 60, height: 60, margin: '0 auto 16px', borderRadius: 16, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={28} />
      </div>
      <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{title}</div>
      {hint && <div style={{ fontSize: 13 }}>{hint}</div>}
    </div>
  )
}
