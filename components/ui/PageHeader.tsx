interface PageHeaderProps {
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, eyebrow, actions }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
      <div>
        {eyebrow && (
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 6 }}>
            {eyebrow}
          </div>
        )}
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{title}</h1>
        {subtitle && <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 14 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  )
}
