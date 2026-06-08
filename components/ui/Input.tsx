'use client'

import { Icon } from './Icon'

interface InputProps {
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  icon?: string
  type?: string
  size?: 'sm' | 'md' | 'lg'
  style?: React.CSSProperties
  disabled?: boolean
  name?: string
  required?: boolean
  rightElement?: React.ReactNode
}

export function Input({ value, onChange, placeholder, icon, type = 'text', size = 'md', style, disabled, name, required, rightElement }: InputProps) {
  const heights: Record<string, number> = { sm: 32, md: 38, lg: 44 }
  return (
    <div style={{ position: 'relative', ...style }}>
      {icon && (
        <Icon name={icon} size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
      )}
      <input
        type={type}
        name={name}
        value={value ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        onChange={e => onChange?.(e.target.value)}
        style={{
          width: '100%', height: heights[size],
          paddingLeft: icon ? 36 : 12,
          paddingRight: rightElement ? 44 : 12,
          borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--card)', color: 'var(--ink)', fontSize: 13,
          fontFamily: 'inherit', outline: 'none', transition: 'border-color .15s',
          opacity: disabled ? 0.6 : 1,
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)' }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
      />
      {rightElement && (
        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
          {rightElement}
        </div>
      )}
    </div>
  )
}
