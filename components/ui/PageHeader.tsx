interface PageHeaderProps {
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: React.ReactNode
  marginBottom?: number
}

export function PageHeader({ title, subtitle, eyebrow, actions, marginBottom = 20 }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom, flexWrap: 'wrap' }}>
      <div>
        {eyebrow && (
          <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5 }}>
            {eyebrow}
          </div>
        )}
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--ink)', lineHeight: 1.2 }}>{title}</h1>
        {subtitle && <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  )
}
