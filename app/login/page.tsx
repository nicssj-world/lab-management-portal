'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      setLoading(false)
      return
    }

    router.push('/staff/dashboard')
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
          padding: 48,
        }}
      >
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
            <Image
              src="/images/logo-chonburi.png"
              alt="โรงพยาบาลชลบุรี"
              width={64}
              height={64}
              style={{ height: 64, width: 'auto', objectFit: 'contain' }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>กลุ่มงานเทคนิคการแพทย์</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>โรงพยาบาลชลบุรี · Staff Portal</div>
            </div>
          </div>

          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px' }}>
            เข้าสู่ระบบ
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 28px' }}>
            สำหรับบุคลากรกลุ่มงานเทคนิคการแพทย์เท่านั้น
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
                อีเมล
              </label>
              <Input
                icon="users"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="staff@cbh.go.th"
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
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                required
                name="password"
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

      {/* Right panel */}
      <div
        style={{
          flex: 1, background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-2) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48,
          position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', right: -80, top: -80, width: 360, height: 360, borderRadius: '50%', background: 'rgba(255,255,255,.07)' }} />
        <div style={{ position: 'absolute', left: -40, bottom: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,.05)' }} />
        <div style={{ position: 'relative', color: '#fff', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🔬</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            Lab Management Portal
          </h2>
          <p style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.7 }}>
            ระบบจัดการห้องปฏิบัติการเทคนิคการแพทย์ โรงพยาบาลชลบุรี
            ครอบคลุมรายการตรวจ เอกสารคุณภาพ ทะเบียนความเสี่ยง KPI และภาระงาน
          </p>
          <div style={{ marginTop: 28, padding: '12px 18px', background: 'rgba(255,255,255,.12)', borderRadius: 10, border: '1px solid rgba(255,255,255,.2)' }}>
            <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>Accredited</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>ISO 15189 · ISO 15190</div>
          </div>
        </div>
      </div>
    </div>
  )
}
