'use client'

import { Icon } from './Icon'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  children?: React.ReactNode
  variant?: Variant
  size?: Size
  icon?: string
  iconRight?: string
  onClick?: () => void
  disabled?: boolean
  full?: boolean
  type?: 'button' | 'submit' | 'reset'
  style?: React.CSSProperties
  title?: string
}

const SIZES: Record<Size, { padding: string; fontSize: number; height: number; gap: number; iconSize: number }> = {
  sm: { padding: '6px 10px', fontSize: 12, height: 28, gap: 6, iconSize: 14 },
  md: { padding: '8px 14px', fontSize: 13, height: 36, gap: 8, iconSize: 16 },
  lg: { padding: '10px 18px', fontSize: 14, height: 44, gap: 8, iconSize: 18 },
}

const VARIANTS: Record<Variant, React.CSSProperties> = {
  primary:   { background: 'var(--primary)',     color: '#fff',           border: '1px solid var(--primary)' },
  secondary: { background: 'var(--card)',         color: 'var(--ink)',     border: '1px solid var(--border)' },
  ghost:     { background: 'transparent',          color: 'var(--ink)',     border: '1px solid transparent' },
  danger:    { background: 'var(--danger)',        color: '#fff',           border: '1px solid var(--danger)' },
  soft:      { background: 'var(--primary-soft)',  color: 'var(--primary)', border: '1px solid transparent' },
}

export function Button({
  children, variant = 'primary', size = 'md', icon, iconRight,
  onClick, disabled, full, type = 'button', style, title,
}: ButtonProps) {
  const s = SIZES[size]
  const v = VARIANTS[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        ...v, padding: s.padding, height: s.height, fontSize: s.fontSize,
        width: full ? '100%' : undefined, gap: s.gap,
        borderRadius: 8, display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', fontFamily: 'inherit', fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'all .15s',
        whiteSpace: 'nowrap', ...style,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = 'brightness(0.95)' }}
      onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
    >
      {icon && <Icon name={icon} size={s.iconSize} />}
      {children}
      {iconRight && <Icon name={iconRight} size={s.iconSize} />}
    </button>
  )
}
