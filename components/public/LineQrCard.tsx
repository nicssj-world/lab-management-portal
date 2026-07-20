'use client'

import { useState } from 'react'

const LINE_ID = '@759ksiuc'

function LineGlyph({ size, fill }: { size: number; fill: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} aria-hidden="true">
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  )
}

export function LineQrCard() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`ขยาย QR Code LINE ${LINE_ID}`}
        className="line-card"
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          minHeight: 100,
          background: 'rgba(255,255,255,.13)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,.22)',
          borderRadius: 14, padding: '12px 18px 12px 12px',
          font: 'inherit', textAlign: 'left', cursor: 'pointer',
        }}
      >
        {/* QR code */}
        <div style={{
          background: '#fff', borderRadius: 10, padding: 5,
          flexShrink: 0, lineHeight: 0,
        }}>
          <img
            src="/line-qr.png"
            alt={`LINE QR Code ${LINE_ID}`}
            width={64} height={64}
            style={{ display: 'block', borderRadius: 6 }}
          />
        </div>
        {/* Text */}
        <div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.72)', marginBottom: 2, fontWeight: 500 }}>
            ระบบตอบข้อมูลอัตโนมัติผ่าน LINE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <LineGlyph size={16} fill="#06C755" />
            <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '.01em' }}>
              {LINE_ID}
            </span>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: '#06C755', color: '#fff',
            padding: '5px 12px', borderRadius: 999,
            fontSize: 11.5, fontWeight: 700,
          }}>
            <LineGlyph size={11} fill="currentColor" />
            แตะเพื่อขยาย QR
          </div>
        </div>
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 380, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LineGlyph size={18} fill="#06C755" />
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{LINE_ID}</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="ปิด"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1, padding: 4 }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 12, lineHeight: 0 }}>
                <img
                  src="/line-qr.png"
                  alt={`LINE QR Code ${LINE_ID}`}
                  style={{ display: 'block', width: '100%', maxWidth: 280, height: 'auto' }}
                />
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', textAlign: 'center' }}>
                สแกน QR Code นี้ด้วยแอป LINE เพื่อเพิ่มเพื่อน
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
