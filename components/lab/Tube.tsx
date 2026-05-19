interface TubeProps {
  color: string
  label?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Tube({ color, label, size = 'md' }: TubeProps) {
  const sz = size === 'lg' ? { w: 12, h: 32 } : { w: 8, h: 22 }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          display: 'inline-block', width: sz.w, height: sz.h, borderRadius: 3,
          background: `linear-gradient(180deg, ${color} 30%, #ffffff 30%, #f3f4f6 100%)`,
          border: '1px solid rgba(0,0,0,.08)',
        }}
      />
      {label && <span style={{ fontSize: 12, color: 'var(--ink)' }}>{label}</span>}
    </span>
  )
}
