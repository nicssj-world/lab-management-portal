interface Props {
  pass: boolean | null
}

export function StatusBadge({ pass }: Props) {
  const cfg = pass === null
    ? { bg: 'var(--surface-2)', fg: 'var(--muted)', dot: 'var(--muted)', label: 'ไม่มีข้อมูล' }
    : pass
    ? { bg: 'rgba(22,163,74,.10)', fg: 'var(--success)', dot: 'var(--success)', label: 'ผ่าน' }
    : { bg: 'rgba(220,38,38,.10)', fg: 'var(--danger)', dot: 'var(--danger)', label: 'ไม่ผ่าน' }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
      background: cfg.bg, color: cfg.fg, lineHeight: 1.4, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}
