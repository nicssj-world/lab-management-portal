'use client'

interface ContractBatteryProps {
  total: number
  used: number
  label?: string
}

export function ContractBattery({ total, used, label }: ContractBatteryProps) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0
  const isWarning = pct >= 80
  const isDanger = pct >= 95

  const color = isDanger ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--success)'

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
        {label && <span style={{ color: 'var(--muted)' }}>{label}</span>}
        <span style={{ fontWeight: 600, color, marginLeft: 'auto' }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ position: 'relative', height: 12, borderRadius: 6, background: 'var(--surface-2)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div
          style={{
            position: 'absolute', top: 0, left: 0, height: '100%',
            width: `${pct}%`, background: color, borderRadius: 6,
            transition: 'width 0.4s ease',
            ...(isWarning ? {
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,.2) 5px, rgba(255,255,255,.2) 10px)',
            } : {}),
          }}
        />
      </div>
    </div>
  )
}
