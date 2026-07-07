'use client'

import { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Badge } from '@/components/ui/Badge'

interface ProfileData {
  id: string
  name: string
  role: string
  dept: string | null
  phone: string | null
  avatar_url: string | null
  doc_role: string | null
  document_position: string | null
  signature_url: string | null
  signature_signed_url: string | null
  signature_updated_at: string | null
}

const DOC_ROLE_SCHEME: Record<string, { color: string; bg: string; border: string; label: string }> = {
  'Laboratory Director': { color: '#1E5FAD', bg: 'rgba(30,95,173,.08)',  border: 'rgba(30,95,173,.2)',  label: 'Laboratory Director' },
  'Quality Manager':     { color: '#0D9488', bg: 'rgba(13,148,136,.08)', border: 'rgba(13,148,136,.2)', label: 'Quality Manager' },
  'Document Controller': { color: '#7C3AED', bg: 'rgba(124,58,237,.08)', border: 'rgba(124,58,237,.2)', label: 'Document Controller' },
  'Reviewer':            { color: '#B45309', bg: 'rgba(217,119,6,.08)',  border: 'rgba(217,119,6,.2)',  label: 'Reviewer' },
  'Viewer':              { color: '#64748B', bg: 'rgba(100,116,139,.08)',border: 'rgba(100,116,139,.2)',label: 'Viewer' },
}

const ROLE_SCHEME: Record<string, string> = {
  Admin: '#DC2626', Manager: '#1E5FAD', 'Medical Technologist': '#0D9488',
  'Medical Science Technician': '#D97706', Assistant: '#64748B',
  'Document Controller': '#7C3AED',
}

export default function ProfilePage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const signatureRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [documentPosition, setDocumentPosition] = useState('')
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadingSignature, setUploadingSignature] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [savingPhone, setSavingPhone] = useState(false)
  const [editingPhone, setEditingPhone] = useState(true)
  const [savingDocumentProfile, setSavingDocumentProfile] = useState(false)
  const [editingDocumentPosition, setEditingDocumentPosition] = useState(true)
  const [editingName, setEditingName] = useState(false)

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
      .then((r) => {
        if (r.status === 401) { window.location.href = '/login'; return null }
        return r.json()
      })
      .then((data: ProfileData | null) => {
        if (!data?.id) return
        setProfile(data)
        setDisplayName(data.name ?? '')
        setPhone(data.phone ?? '')
        setEditingPhone(!data.phone)
        setAvatarUrl(data.avatar_url ?? null)
        setDocumentPosition(data.document_position ?? '')
        setEditingDocumentPosition(!data.document_position)
        setSignatureUrl(data.signature_signed_url ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSaveName() {
    if (!profile || !displayName.trim()) return
    setSavingName(true)
    const res = await fetch('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: displayName.trim() }) })
    setSavingName(false)
    if (!res.ok) showToast('บันทึกไม่สำเร็จ', false)
    else { setProfile((p) => p ? { ...p, name: displayName.trim() } : p); setEditingName(false); showToast('บันทึกชื่อแล้ว') }
  }

  async function handleSavePhone() {
    if (!profile) return
    if (!editingPhone) {
      setEditingPhone(true)
      return
    }
    setSavingPhone(true)
    const normalizedPhone = phone.trim()
    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalizedPhone || null }),
    })
    setSavingPhone(false)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(json.error ?? 'บันทึกเบอร์โทรศัพท์ไม่สำเร็จ', false)
      return
    }
    setPhone(json.phone ?? '')
    setEditingPhone(false)
    setProfile((p) => p ? { ...p, phone: json.phone ?? null } : p)
    showToast('บันทึกเบอร์โทรศัพท์แล้ว')
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

  async function handleSaveDocumentProfile() {
    if (!profile) return
    if (!editingDocumentPosition) {
      setEditingDocumentPosition(true)
      return
    }
    setSavingDocumentProfile(true)
    const res = await fetch('/api/me/document-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_position: documentPosition.trim() || null }),
    })
    setSavingDocumentProfile(false)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      showToast(json.error ?? 'บันทึกข้อมูลเอกสารคุณภาพไม่สำเร็จ', false)
      return
    }
    setProfile((p) => p ? { ...p, document_position: json.document_position ?? null } : p)
    setDocumentPosition(json.document_position ?? '')
    setEditingDocumentPosition(false)
    showToast('บันทึกข้อมูลเอกสารคุณภาพแล้ว')
  }

  async function handleSignatureUpload(file: File) {
    setUploadingSignature(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/me/signature', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'อัปโหลดลายเซ็นไม่สำเร็จ')
      setSignatureUrl(json.signature_signed_url ?? null)
      setProfile((p) => p ? { ...p, signature_url: json.signature_url ?? null, signature_signed_url: json.signature_signed_url ?? null } : p)
      showToast('อัปโหลดลายเซ็นแล้ว')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'อัปโหลดลายเซ็นไม่สำเร็จ', false)
    } finally {
      setUploadingSignature(false)
      if (signatureRef.current) signatureRef.current.value = ''
    }
  }

  async function handleRemoveSignature() {
    const res = await fetch('/api/me/signature', { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      showToast(json.error ?? 'ลบลายเซ็นไม่สำเร็จ', false)
      return
    }
    setSignatureUrl(null)
    setProfile((p) => p ? { ...p, signature_url: null, signature_signed_url: null } : p)
    showToast('ลบลายเซ็นแล้ว')
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword !== confirmPassword) {
      showToast('รหัสผ่านไม่ตรงกัน', false); return
    }
    if (newPassword.length < 6) {
      showToast('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', false); return
    }
    setSavingPwd(true)
    try {
      const res = await fetch('/api/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'เปลี่ยนรหัสผ่านไม่สำเร็จ', false); return }
      setOldPassword(''); setNewPassword(''); setConfirmPassword(''); setShowPwdSection(false)
      showToast('เปลี่ยนรหัสผ่านแล้ว')
    } catch {
      showToast('เกิดข้อผิดพลาด กรุณาลองใหม่', false)
    } finally {
      setSavingPwd(false)
    }
  }

  const initial = profile?.name?.charAt(0).toUpperCase() ?? 'U'
  const roleColor = profile?.role ? (ROLE_SCHEME[profile.role] ?? '#64748B') : '#64748B'
  const docScheme = profile?.doc_role ? DOC_ROLE_SCHEME[profile.doc_role] : null
  const canEditDocumentProfile = profile?.role === 'Admin' || profile?.role === 'Manager' || profile?.doc_role === 'Reviewer'

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--border)', fontSize: 13,
    fontFamily: 'inherit', color: 'var(--ink)',
    background: 'var(--card)', outline: 'none', boxSizing: 'border-box',
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: 'var(--muted)', fontSize: 13 }}>
        กำลังโหลด...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 680 }}>
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

      {/* ── Hero profile card ─────────────────────────────────── */}
      <Card padding={0} style={{ overflow: 'hidden' }}>
        {/* Top accent strip */}
        <div style={{
          height: 6,
          background: docScheme
            ? `linear-gradient(90deg, ${docScheme.color}, ${docScheme.color}88)`
            : `linear-gradient(90deg, var(--primary), #3B82F6)`,
        }} />

        <div style={{ padding: '28px 28px 24px', display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="avatar"
                style={{ width: 88, height: 88, borderRadius: 18, objectFit: 'cover', border: '3px solid var(--card)', boxShadow: '0 0 0 2px var(--border)' }}
              />
            ) : (
              <div style={{
                width: 88, height: 88, borderRadius: 18,
                background: docScheme
                  ? `linear-gradient(135deg, ${docScheme.color}cc, ${docScheme.color}88)`
                  : 'linear-gradient(135deg, var(--primary), #3B82F6)',
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, fontWeight: 700,
                boxShadow: '0 4px 16px rgba(0,0,0,.1)',
              }}>
                {initial}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="เปลี่ยนรูป"
              style={{
                position: 'absolute', bottom: -4, right: -4,
                width: 26, height: 26, borderRadius: '50%',
                background: 'var(--primary)', color: '#fff',
                border: '2px solid var(--card)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name="edit" size={11} />
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f) }}
            />
          </div>

          {/* Identity */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              {editingName ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditingName(false); setDisplayName(profile?.name ?? '') } }}
                    autoFocus
                    style={{ ...inputStyle, fontSize: 20, fontWeight: 700, padding: '4px 10px', maxWidth: 300 }}
                  />
                  <button onClick={handleSaveName} disabled={savingName}
                    style={{ padding: '5px 14px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {savingName ? '...' : 'บันทึก'}
                  </button>
                  <button onClick={() => { setEditingName(false); setDisplayName(profile?.name ?? '') }}
                    style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <>
                  <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em' }}>
                    {profile?.name ?? '—'}
                  </h1>
                  <button onClick={() => setEditingName(true)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, display: 'flex', alignItems: 'center' }}
                    title="แก้ไขชื่อ">
                    <Icon name="edit" size={13} />
                  </button>
                </>
              )}
            </div>

            {/* Role + Doc Role badges */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Main role */}
              {profile?.role && (
                <span style={{
                  fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: roleColor + '15', color: roleColor,
                  border: `1px solid ${roleColor}30`, letterSpacing: '.02em',
                }}>
                  {profile.role}
                </span>
              )}

              {/* Doc role badge */}
              {docScheme && (
                <span style={{
                  fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: docScheme.bg, color: docScheme.color,
                  border: `1px solid ${docScheme.border}`,
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: docScheme.color, flexShrink: 0 }} />
                  {docScheme.label}
                </span>
              )}
            </div>

            {/* Dept */}
            {profile?.dept && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="building" size={12} />
                {profile.dept}
              </div>
            )}

            {/* Avatar actions */}
            {!editingName && (
              <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}>
                  {uploading ? 'กำลังอัปโหลด...' : 'เปลี่ยนรูปโปรไฟล์'}
                </button>
                {avatarUrl && (
                  <button onClick={handleRemoveAvatar}
                    style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #FEE2E2', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: '#DC2626' }}>
                    ลบรูป
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── Account info ──────────────────────────────────────── */}
      <Card padding={0}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>ข้อมูลบัญชี</div>
        </div>
        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <InfoCell label="บทบาทหลัก" value={profile?.role} color={roleColor} />
          <InfoCell label="แผนก" value={profile?.dept} />
          {profile?.doc_role && (
            <InfoCell label="บทบาทด้านเอกสาร" value={profile.doc_role} color={docScheme?.color} />
          )}
          <div style={{ gridColumn: '1 / -1', padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8 }}>
            <label style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em', display: 'block' }}>
              เบอร์โทรศัพท์
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => { if (editingPhone && e.key === 'Enter') handleSavePhone() }}
                readOnly={!editingPhone}
                disabled={savingPhone}
                placeholder="เช่น 08x-xxx-xxxx หรือ เบอร์ภายใน"
                style={{
                  ...inputStyle,
                  flex: '1 1 220px',
                  minWidth: 0,
                  background: editingPhone ? 'var(--card)' : 'var(--surface-2)',
                  color: editingPhone ? 'var(--ink)' : 'var(--muted)',
                  cursor: editingPhone ? 'text' : 'default',
                }}
              />
              <Button variant="primary" onClick={handleSavePhone} disabled={savingPhone}>
                {savingPhone ? 'กำลังบันทึก...' : editingPhone ? 'บันทึกเบอร์โทร' : 'แก้ไขเบอร์โทร'}
              </Button>
            </div>
          </div>
        </div>
        {(!profile?.role || !profile?.dept) && (
          <div style={{ padding: '0 24px 16px', fontSize: 11.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="alert" size={13} />
            Role และ Department ถูกจัดการโดย Admin ใน User Management
          </div>
        )}
      </Card>

      {/* ── Quality document identity ───────────────────────────────────── */}
      <Card padding={0}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>ข้อมูลสำหรับเอกสารคุณภาพ</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>ตำแหน่งและลายเซ็นที่ระบบใช้บนหน้าปก QP/WI</div>
          </div>
          {!canEditDocumentProfile && (
            <Badge color="gray" size="sm">ดูอย่างเดียว</Badge>
          )}
        </div>
        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 220px', gap: 18, alignItems: 'start' }}>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, display: 'block' }}>ตำแหน่งที่แสดงในเอกสาร</label>
            <input
              value={documentPosition}
              onChange={(e) => setDocumentPosition(e.target.value)}
              onKeyDown={(e) => { if (editingDocumentPosition && e.key === 'Enter') handleSaveDocumentProfile() }}
              readOnly={!editingDocumentPosition}
              disabled={!canEditDocumentProfile || savingDocumentProfile}
              placeholder="เช่น นักเทคนิคการแพทย์"
              style={{
                ...inputStyle,
                background: editingDocumentPosition ? 'var(--card)' : 'var(--surface-2)',
                color: editingDocumentPosition ? 'var(--ink)' : 'var(--muted)',
                cursor: editingDocumentPosition ? 'text' : 'default',
              }}
            />
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <Button
                variant="primary"
                onClick={handleSaveDocumentProfile}
                disabled={!canEditDocumentProfile || savingDocumentProfile}
              >
                {savingDocumentProfile ? 'กำลังบันทึก...' : editingDocumentPosition ? 'บันทึกตำแหน่ง' : 'แก้ไขตำแหน่ง'}
              </Button>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, display: 'block' }}>ลายเซ็น</label>
            <div style={{ height: 92, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, marginBottom: 8 }}>
              {signatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={signatureUrl} alt="signature" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>ยังไม่มีลายเซ็น</span>
              )}
            </div>
            <input ref={signatureRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSignatureUpload(f) }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => signatureRef.current?.click()}
                disabled={!canEditDocumentProfile || uploadingSignature}
                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: canEditDocumentProfile ? 'pointer' : 'not-allowed', fontFamily: 'inherit', color: 'var(--ink)' }}
              >
                {uploadingSignature ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
              </button>
              {signatureUrl && (
                <button
                  onClick={handleRemoveSignature}
                  disabled={!canEditDocumentProfile}
                  style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #FEE2E2', background: 'transparent', cursor: canEditDocumentProfile ? 'pointer' : 'not-allowed', fontFamily: 'inherit', color: '#DC2626' }}
                >
                  ลบ
                </button>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6, lineHeight: 1.4 }}>
              รองรับ PNG, JPG, WebP ไม่เกิน 2 MB; ระบบจะปรับเป็น PNG 900x260 ให้อัตโนมัติ
            </div>
          </div>
        </div>
      </Card>

      {/* ── Change password ───────────────────────────────────── */}
      <Card padding={0}>
        <div style={{ padding: '16px 24px', borderBottom: showPwdSection ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>ความปลอดภัย</div>
            {!showPwdSection && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>เปลี่ยนรหัสผ่านสำหรับเข้าสู่ระบบ</div>}
          </div>
          {!showPwdSection && (
            <button onClick={() => setShowPwdSection(true)}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)', fontWeight: 500 }}>
              เปลี่ยนรหัสผ่าน
            </button>
          )}
        </div>
        {showPwdSection && (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'รหัสผ่านเดิม', value: oldPassword, set: setOldPassword, autoComplete: 'current-password' },
              { label: 'รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)', value: newPassword, set: setNewPassword, autoComplete: 'new-password' },
              { label: 'ยืนยันรหัสผ่านใหม่', value: confirmPassword, set: setConfirmPassword, autoComplete: 'new-password' },
            ].map(({ label, value, set, autoComplete }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>{label}</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPwd ? 'text' : 'password'} value={value} autoComplete={autoComplete}
                    onChange={(e) => set(e.target.value)}
                    style={{ ...inputStyle, paddingRight: 40 }} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0 }}>
                    <Icon name="eye" size={15} />
                  </button>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <button onClick={() => { setShowPwdSection(false); setOldPassword(''); setNewPassword(''); setConfirmPassword('') }}
                style={{ fontSize: 12, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--muted)' }}>
                ยกเลิก
              </button>
              <Button variant="primary" onClick={handleChangePassword} disabled={savingPwd || !oldPassword || !newPassword || !confirmPassword}>
                {savingPwd ? 'กำลังเปลี่ยน...' : 'ยืนยันเปลี่ยนรหัสผ่าน'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

function InfoCell({ label, value, color }: { label: string; value?: string | null; color?: string }) {
  return (
    <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color ?? (value ? 'var(--ink)' : 'var(--muted)') }}>
        {value ?? 'ไม่ระบุ'}
      </div>
    </div>
  )
}
