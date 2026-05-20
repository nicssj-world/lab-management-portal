'use client'

import { useState, useEffect, useRef } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { createClient } from '@/lib/supabase/client'

interface ProfileData {
  id: string
  name: string
  role: string
  dept: string | null
  avatar_url: string | null
}

export default function ProfilePage() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [savingName, setSavingName] = useState(false)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [showPwdSection, setShowPwdSection] = useState(false)

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((data: ProfileData) => {
        if (!data?.id) return
        setProfile(data)
        setDisplayName(data.name ?? '')
        setAvatarUrl(data.avatar_url ?? null)
      })
  }, [])

  async function handleSaveName() {
    if (!profile || !displayName.trim()) return
    setSavingName(true)
    const res = await fetch('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: displayName.trim() }) })
    setSavingName(false)
    if (!res.ok) showToast('บันทึกไม่สำเร็จ', false)
    else { setProfile((p) => p ? { ...p, name: displayName.trim() } : p); showToast('บันทึกชื่อแล้ว') }
  }

  async function resizeImage(file: File, maxSize = 200): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const { width, height } = img
        if (width <= maxSize && height <= maxSize) { resolve(file); return }
        const scale = Math.min(maxSize / width, maxSize / height)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(width * scale)
        canvas.height = Math.round(height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Resize failed')), file.type, 0.9)
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
      img.src = url
    })
  }

  async function handleAvatarUpload(file: File) {
    setUploading(true)
    try {
      const blob = await resizeImage(file)
      const fd = new FormData()
      fd.append('file', new File([blob], file.name, { type: file.type }))
      const res = await fetch('/api/me/avatar', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'เกิดข้อผิดพลาด')
      setAvatarUrl(json.url)
      setProfile((p) => p ? { ...p, avatar_url: json.url } : p)
      showToast('อัปโหลดรูปแล้ว')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ', false)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleRemoveAvatar() {
    await fetch('/api/me/avatar', { method: 'DELETE' })
    setAvatarUrl(null)
    setProfile((p) => p ? { ...p, avatar_url: null } : p)
    showToast('ลบรูปแล้ว')
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword !== confirmPassword) {
      showToast('รหัสผ่านไม่ตรงกัน', false); return
    }
    if (newPassword.length < 6) {
      showToast('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', false); return
    }
    setSavingPwd(true)
    // Re-authenticate with old password first
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: oldPassword })
      if (signInErr) { setSavingPwd(false); showToast('รหัสผ่านเดิมไม่ถูกต้อง', false); return }
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPwd(false)
    if (error) showToast('เปลี่ยนรหัสผ่านไม่สำเร็จ', false)
    else { setOldPassword(''); setNewPassword(''); setConfirmPassword(''); showToast('เปลี่ยนรหัสผ่านแล้ว') }
  }

  const initial = profile?.name?.charAt(0).toUpperCase() ?? 'U'

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--border)', fontSize: 13,
    fontFamily: 'inherit', color: 'var(--ink)',
    background: 'var(--card)', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: toast.ok ? '#166534' : '#B91C1C', color: '#fff',
          boxShadow: '0 4px 16px rgba(0,0,0,.18)',
        }}>
          {toast.ok ? '✓ ' : '✕ '}{toast.msg}
        </div>
      )}

      <PageHeader eyebrow="บัญชีผู้ใช้" title="Profile" subtitle="Profile Settings" />

      {/* Avatar + display name */}
      <Card padding={24}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 20 }}>ข้อมูลโปรไฟล์</div>

        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="avatar"
                style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', border: '2px solid var(--border)' }}
              />
            ) : (
              <div style={{
                width: 72, height: 72, borderRadius: 16,
                background: 'var(--primary)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 700,
              }}>
                {initial}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                position: 'absolute', bottom: -6, right: -6,
                width: 26, height: 26, borderRadius: '50%',
                background: 'var(--primary)', color: '#fff',
                border: '2px solid var(--card)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11,
              }}
              title="เปลี่ยนรูป"
            >
              <Icon name="edit" size={12} />
            </button>
            <input
              ref={fileRef} type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f) }}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{profile?.name ?? '—'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{profile?.role?.toUpperCase()}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}
              >
                {uploading ? 'กำลังอัปโหลด...' : 'เปลี่ยนรูป'}
              </button>
              {avatarUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #FEE2E2', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: '#DC2626' }}
                >
                  ลบรูป
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Read-only info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
          <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>บทบาท (Role)</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: profile?.role ? 'var(--primary)' : 'var(--muted)' }}>
              {profile?.role ?? 'ไม่ระบุ'}
            </div>
          </div>
          <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>แผนก (Department)</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: profile?.dept ? 'var(--ink)' : 'var(--muted)' }}>
              {profile?.dept ?? 'ไม่ระบุ'}
            </div>
          </div>
        </div>
        {(!profile?.role || !profile?.dept) && (
          <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="alert" size={13} />
            Role และ Department ถูกจัดการโดย Admin ใน User Management
          </div>
        )}
      </Card>

      {/* Change password */}
      <Card padding={24}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showPwdSection ? 20 : 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>เปลี่ยนรหัสผ่าน</div>
          {!showPwdSection && (
            <button
              onClick={() => setShowPwdSection(true)}
              style={{ fontSize: 12, padding: '5px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}
            >
              เปลี่ยนรหัสผ่าน
            </button>
          )}
        </div>
        {showPwdSection && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'รหัสผ่านเดิม', value: oldPassword, set: setOldPassword, autoComplete: 'current-password' },
              { label: 'รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)', value: newPassword, set: setNewPassword, autoComplete: 'new-password' },
              { label: 'ยืนยันรหัสผ่านใหม่', value: confirmPassword, set: setConfirmPassword, autoComplete: 'new-password' },
            ].map(({ label, value, set, autoComplete }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>{label}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={value}
                    autoComplete={autoComplete}
                    onChange={(e) => set(e.target.value)}
                    style={{ ...inputStyle, paddingRight: 40 }}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0 }}
                  >
                    <Icon name="eye" size={15} />
                  </button>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <button
                onClick={() => { setShowPwdSection(false); setOldPassword(''); setNewPassword(''); setConfirmPassword('') }}
                style={{ fontSize: 12, padding: '5px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--muted)' }}
              >
                ยกเลิก
              </button>
              <Button
                variant="primary"
                onClick={handleChangePassword}
                disabled={savingPwd || !oldPassword || !newPassword || !confirmPassword}
              >
                {savingPwd ? 'กำลังเปลี่ยน...' : 'ยืนยันเปลี่ยนรหัสผ่าน'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
