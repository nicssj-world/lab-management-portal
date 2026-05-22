export default function MaintenancePage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', fontFamily: 'inherit',
    }}>
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔧</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
          ปิดปรับปรุงชั่วคราว
        </h1>
        <p style={{ fontSize: 15, color: 'var(--muted)' }}>
          ระบบอยู่ระหว่างการปรับปรุง กรุณากลับมาใหม่ในภายหลัง
        </p>
      </div>
    </div>
  )
}
