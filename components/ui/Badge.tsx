export type BadgeColor = 'gray' | 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'teal'

interface BadgeProps {
  children: React.ReactNode
  color?: BadgeColor
  size?: 'sm' | 'md'
  dot?: boolean
  style?: React.CSSProperties
}

const COLORS: Record<BadgeColor, { bg: string; fg: string }> = {
  gray:   { bg: 'var(--surface-2)',           fg: 'var(--muted)' },
  blue:   { bg: 'rgba(37,99,235,.10)',         fg: '#1D4ED8' },
  green:  { bg: 'rgba(22,163,74,.10)',         fg: '#15803D' },
  red:    { bg: 'rgba(220,38,38,.10)',         fg: '#B91C1C' },
  amber:  { bg: 'rgba(217,119,6,.12)',         fg: '#B45309' },
  purple: { bg: 'rgba(147,51,234,.10)',        fg: '#7E22CE' },
  teal:   { bg: 'rgba(8,145,178,.10)',         fg: '#0E7490' },
}

export function Badge({ children, color = 'gray', size = 'md', dot, style }: BadgeProps) {
  const c = COLORS[color]
  const sz = size === 'sm' ? { padding: '1px 6px', fontSize: 10.5 } : { padding: '3px 9px', fontSize: 11.5 }
  return (
    <span
      style={{
        ...sz, background: c.bg, color: c.fg, borderRadius: 999,
        fontWeight: 600, display: 'inline-flex', alignItems: 'center',
        gap: 5, lineHeight: 1.4, ...style,
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: c.fg }} />}
      {children}
    </span>
  )
}
