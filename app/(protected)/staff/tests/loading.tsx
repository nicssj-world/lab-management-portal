export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ height: 36, background: 'var(--surface-2)', borderRadius: 8, width: '30%', animation: 'pulse 1.5s infinite' }} />
      <div style={{ height: 60, background: 'var(--surface-2)', borderRadius: 12, animation: 'pulse 1.5s infinite' }} />
      <div style={{ height: 400, background: 'var(--surface-2)', borderRadius: 12, animation: 'pulse 1.5s infinite' }} />
    </div>
  )
}
