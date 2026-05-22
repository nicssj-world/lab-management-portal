'use client'

interface CardProps {
  children: React.ReactNode
  padding?: number
  style?: React.CSSProperties
  className?: string
  onClick?: () => void
  hoverable?: boolean
}

export function Card({ children, padding = 16, style, className, onClick, hoverable }: CardProps) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 12, padding, cursor: onClick ? 'pointer' : undefined,
        transition: 'all .15s', ...style,
      }}
      onMouseEnter={e => {
        if (hoverable) {
          e.currentTarget.style.borderColor = 'var(--primary)'
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.06)'
        }
      }}
      onMouseLeave={e => {
        if (hoverable) {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.boxShadow = 'none'
        }
      }}
    >
      {children}
    </div>
  )
}
