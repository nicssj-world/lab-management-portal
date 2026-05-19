interface Props {
  pass: boolean | null
}

export function StatusBadge({ pass }: Props) {
  if (pass === null) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: '#F1F5F9', color: '#64748B' }}>
        ไม่มีข้อมูล
      </span>
    )
  }
  return pass ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: '#DCFCE7', color: '#15803D' }}>
      ผ่าน
    </span>
  ) : (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: '#FEE2E2', color: '#B91C1C' }}>
      ไม่ผ่าน
    </span>
  )
}
