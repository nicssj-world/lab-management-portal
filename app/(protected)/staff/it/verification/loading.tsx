export default function ItVerificationLoading() {
  return (
    <div aria-label="กำลังโหลดหน้าทวนสอบ" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ height: 30, width: 'min(460px, 72%)', borderRadius: 8, background: 'var(--surface-2)' }} />
      <div style={{ height: 18, width: 320, borderRadius: 6, background: 'var(--surface-2)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        {[1, 2, 3, 4].map((item) => <div key={item} style={{ height: 112, borderRadius: 12, background: 'var(--surface-2)' }} />)}
      </div>
      <div style={{ height: 360, borderRadius: 12, background: 'var(--surface-2)' }} />
    </div>
  )
}
