'use client'

import { Card } from './Card'
import { Icon } from './Icon'

type StatColor = 'blue' | 'green' | 'red' | 'amber' | 'purple'

interface StatProps {
  label: string
  value: string | number
  change?: string | number
  changeLabel?: string
  color?: StatColor
  icon?: string
}

const COLOR_MAP: Record<StatColor, string> = {
  blue:   '#2563EB',
  green:  '#16A34A',
  red:    '#DC2626',
  amber:  '#D97706',
  purple: '#9333EA',
}

export function Stat({ label, value, change, changeLabel, color = 'blue', icon }: StatProps) {
  const hex = COLOR_MAP[color]
  const changeStr = String(change ?? '')
  const positive = changeStr.startsWith('+') || (typeof change === 'number' && change > 0)
  const negative = changeStr.startsWith('-') || (typeof change === 'number' && change < 0)
  return (
    <Card padding={18}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
        {icon && (
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `${hex}15`, color: hex, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={15} />
          </div>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{value}</div>
      {change != null && (
        <div style={{ marginTop: 6, fontSize: 12, color: positive ? '#16A34A' : negative ? '#DC2626' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
          <Icon name="trending" size={12} style={{ transform: negative ? 'scaleY(-1)' : 'none' }} />
          {change}
          {changeLabel && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{changeLabel}</span>}
        </div>
      )}
    </Card>
  )
}
