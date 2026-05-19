'use client'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value?: string
  onChange?: (v: string) => void
  options: (string | SelectOption)[]
  placeholder?: string
  size?: 'sm' | 'md' | 'lg'
  style?: React.CSSProperties
  disabled?: boolean
  name?: string
}

export function Select({ value, onChange, options, placeholder, size = 'md', style, disabled, name }: SelectProps) {
  const heights: Record<string, number> = { sm: 32, md: 38, lg: 44 }
  return (
    <select
      name={name}
      value={value ?? ''}
      disabled={disabled}
      onChange={e => onChange?.(e.target.value)}
      style={{
        height: heights[size], padding: '0 32px 0 12px',
        borderRadius: 8, border: '1px solid var(--border)',
        background: 'var(--card)', color: 'var(--ink)', fontSize: 13,
        fontFamily: 'inherit', outline: 'none', appearance: 'none',
        backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23999%22 stroke-width=%222%22><path d=%22M6 9l6 6 6-6%22/></svg>")',
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
        opacity: disabled ? 0.6 : 1, ...style,
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o =>
        typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
      )}
    </select>
  )
}
