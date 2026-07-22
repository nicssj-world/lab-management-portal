'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { clearStaleAuthSession, createClient } from '@/lib/supabase/client'
import { RETURN_PATH_PARAM, safeReturnPath } from '@/lib/auth/session-guard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { HospitalLogo } from '@/components/lab/HospitalLogo'
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    clearStaleAuthSession()
    const supabase = createClient()
    const loginEmail = email.includes('@') ? email : `${email}@cbh.go.th`
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password }).catch(() => ({
      error: { message: 'Failed to fetch' },
    }))

    if (error) {
      if (error.message === 'Failed to fetch') clearStaleAuthSession()
      setError('รหัสผ่านไม่ถูกต้อง')
      setLoading(false)
      return
    }

    // อ่านจาก window แทน useSearchParams เพราะโค้ดนี้รันหลังผู้ใช้กดปุ่มแล้วเสมอ
    // จึงไม่ต้องผ่าหน้านี้ออกเป็นสองไฟล์เพื่อครอบ <Suspense> ตอน prerender
    const returnTo = safeReturnPath(new URLSearchParams(window.location.search).get(RETURN_PATH_PARAM))
    router.push(returnTo ?? '/staff/dashboard')
  }

  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', background: 'var(--bg)',
      }}
    >
      {/* Left panel */}
      <div
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'clamp(24px, 5vw, 48px)',
        }}
      >
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Brand */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, rowGap: 10, marginBottom: 36 }}>
            <HospitalLogo height={64} preload compactWithNext />
            <Image
              src="/images/cbh-lab-logo-v3.png"
              alt="CBH Lab"
              width={64}
              height={64}
              preload
              quality={100}
              sizes="64px"
              style={{ width: 64, height: 64, objectFit: 'contain' }}
            />
            <div style={{ flex: '1 1 180px', minWidth: 180, maxWidth: 190 }}>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, color: 'var(--ink)' }}>กลุ่มงานเทคนิคการแพทย์</div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--muted)' }}>โรงพยาบาลชลบุรี · CBH Staff</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
              เข้าสู่ระบบ
            </h1>
            <a
              href="/"
              aria-label="กลับสู่หน้าแรก"
              title="กลับสู่หน้าแรก"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0,
                padding: '9px 13px', borderRadius: 9,
                border: '1px solid #93C5FD', background: '#EFF6FF',
                color: '#1D4ED8', textDecoration: 'none',
                fontSize: 12.5, fontWeight: 750,
                boxShadow: '0 2px 8px rgba(30,95,173,.12)',
              }}
            >
              <Icon name="home" size={15} stroke={2} />
              กลับหน้าแรก
            </a>
          </div>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 28px' }}>
            สำหรับบุคลากรกลุ่มงานเทคนิคการแพทย์เท่านั้น
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
                E-Phis
              </label>
              <Input
                icon="users"
                type="text"
                value={email}
                onChange={setEmail}
                placeholder="xxxxxxx"
                required
                name="email"
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
                รหัสผ่าน
              </label>
              <Input
                icon="lock"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                required
                name="password"
                rightElement={
                  <button
                    type="button"
                    aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    onClick={() => setShowPassword(v => !v)}
                    style={{
                      width: 30,
                      height: 30,
                      border: 'none',
                      borderRadius: 7,
                      background: 'transparent',
                      color: 'var(--muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--surface-2)'
                      e.currentTarget.style.color = 'var(--primary)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--muted)'
                    }}
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                  </button>
                }
              />
            </div>

            {error && (
              <div
                style={{
                  padding: '10px 14px', background: '#FEE2E2', border: '1px solid #FECACA',
                  borderRadius: 8, fontSize: 13, color: '#B91C1C',
                }}
              >
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" disabled={loading}>
              {loading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            </Button>
          </form>

          <p style={{ marginTop: 24, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
            ปัญหาการเข้าสู่ระบบ? ติดต่อผู้ดูแลระบบ
          </p>
        </div>
      </div>

      {/* Right panel — hidden on mobile */}
      <div
        className="login-right-panel"
        style={{
          flex: 1, background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-2) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48,
          position: 'relative', overflow: 'hidden',
        }}
      >
        <style>{`
          @media (max-width: 640px) { .login-right-panel { display: none !important; } }
        `}</style>
        <div style={{ position: 'absolute', right: -80, top: -80, width: 360, height: 360, borderRadius: '50%', background: 'rgba(255,255,255,.07)' }} />
        <div style={{ position: 'absolute', left: -40, bottom: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,.05)' }} />
        <div style={{ position: 'relative', color: '#fff', maxWidth: 400, textAlign: 'center' }}>
          <Image
            src="/images/cbh-lab-logo-v3.png"
            alt="CBH Lab"
            width={140}
            height={140}
            preload
            quality={100}
            sizes="140px"
            style={{ width: 140, height: 140, objectFit: 'contain', margin: '0 auto 20px', display: 'block', filter: 'drop-shadow(0 8px 20px rgba(0,0,0,.25))' }}
          />
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            Lab Management CBH
          </h2>
          <p style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.7 }}>
            ระบบจัดการห้องปฏิบัติการเทคนิคการแพทย์ โรงพยาบาลชลบุรี
            
          </p>
          <div style={{ marginTop: 28, padding: '12px 18px', background: 'rgba(255,255,255,.12)', borderRadius: 10, border: '1px solid rgba(255,255,255,.2)' }}>
            <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>Accredited</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>ISO 15189:2022 · ISO 15190:2020</div>
          </div>
        </div>
      </div>
    </div>
  )
}
