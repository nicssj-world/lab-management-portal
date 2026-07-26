'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import type { MapReleaseDTO } from '@/lib/lab-map/types'

export interface LabMapReleaseStaffOption {
  id: string
  name: string | null
  role: string
}

interface LabMapReleasePanelProps {
  release: MapReleaseDTO
  staff: readonly LabMapReleaseStaffOption[]
}

const labelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block',
}

function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([])
  const counter = useRef(0)
  const add = useCallback((msg: string, ok = true) => {
    const id = ++counter.current
    setToasts((t) => [...t, { id, msg, ok }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  return { toasts, add }
}

function suggestedVersionCode() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `F3-${yyyy}.${mm}.${dd}-01`
}

async function readJson(response: Response) {
  return response.json().catch(() => ({}))
}

export function LabMapReleasePanel({ release, staff }: LabMapReleasePanelProps) {
  const router = useRouter()
  const { toasts, add } = useToast()
  const [saving, setSaving] = useState(false)
  const [blockers, setBlockers] = useState<string[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)

  const [versionCode, setVersionCode] = useState(suggestedVersionCode())
  const [effectiveDate, setEffectiveDate] = useState(release.effectiveDate ?? '')
  const [notes, setNotes] = useState(release.notes ?? '')
  const [reviewedBy, setReviewedBy] = useState(release.reviewedBy ?? '')
  const [approvedBy, setApprovedBy] = useState(release.approvedBy ?? '')

  const staffOptions = staff.map((person) => ({ value: person.id, label: `${person.name ?? 'ไม่ทราบชื่อ'} (${person.role})` }))

  async function createDraft() {
    setSaving(true)
    setBlockers([])
    try {
      const response = await fetch('/api/admin/lab-map/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionCode, effectiveDate: effectiveDate || null, notes: notes || null }),
      })
      const body = await readJson(response)
      if (!response.ok) throw new Error(body.error ?? 'สร้างฉบับร่างไม่สำเร็จ')
      add('สร้างฉบับร่างสำเร็จ')
      setShowCreateForm(false)
      router.refresh()
    } catch (caught) {
      add(caught instanceof Error ? caught.message : 'สร้างฉบับร่างไม่สำเร็จ', false)
    } finally {
      setSaving(false)
    }
  }

  async function saveDraft() {
    if (!release.id) return
    setSaving(true)
    setBlockers([])
    try {
      const response = await fetch(`/api/admin/lab-map/releases/${release.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          effectiveDate: effectiveDate || null,
          reviewedBy: reviewedBy || null,
          approvedBy: approvedBy || null,
          notes: notes || null,
        }),
      })
      const body = await readJson(response)
      if (!response.ok) throw new Error(body.error ?? 'บันทึกไม่สำเร็จ')
      add('บันทึกสำเร็จ')
      router.refresh()
    } catch (caught) {
      add(caught instanceof Error ? caught.message : 'บันทึกไม่สำเร็จ', false)
    } finally {
      setSaving(false)
    }
  }

  async function publish() {
    if (!release.id) return
    setSaving(true)
    setBlockers([])
    try {
      const response = await fetch(`/api/admin/lab-map/releases/${release.id}/publish`, { method: 'POST' })
      const body = await readJson(response)
      if (response.status === 422) {
        setBlockers(Array.isArray(body.blockers) && body.blockers.length > 0 ? body.blockers : [body.error ?? 'ยังเผยแพร่ไม่ได้'])
        return
      }
      if (!response.ok) throw new Error(body.error ?? 'เผยแพร่ไม่สำเร็จ')
      add('เผยแพร่สำเร็จ')
      router.refresh()
    } catch (caught) {
      add(caught instanceof Error ? caught.message : 'เผยแพร่ไม่สำเร็จ', false)
    } finally {
      setSaving(false)
    }
  }

  const toastTray = (
    <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 2000 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: '#fff', background: t.ok ? 'var(--success)' : 'var(--danger)', boxShadow: '0 6px 20px rgba(0,0,0,.18)' }}>{t.msg}</div>
      ))}
    </div>
  )

  const createForm = (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <label style={labelStyle}>รหัสเวอร์ชัน</label>
        <Input value={versionCode} onChange={setVersionCode} />
      </div>
      <div>
        <label style={labelStyle}>วันที่มีผล</label>
        <Input type="date" value={effectiveDate ?? ''} onChange={setEffectiveDate} />
      </div>
      <div>
        <label style={labelStyle}>หมายเหตุ</label>
        <Input value={notes ?? ''} onChange={setNotes} placeholder="ไม่บังคับ" />
      </div>
      <Button onClick={createDraft} disabled={saving || versionCode.trim().length < 3}>สร้างฉบับร่าง</Button>
    </div>
  )

  if (!release.id) {
    return (
      <Card padding={24} style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--ink)' }}>จัดการฉบับแผนที่ควบคุม</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--muted)' }}>
          ยังไม่มีฉบับแผนที่ในระบบ — สร้างฉบับร่างเพื่อเริ่มขั้นตอนทบทวนและเผยแพร่
        </p>
        {createForm}
        {toastTray}
      </Card>
    )
  }

  if (release.status === 'draft') {
    return (
      <Card padding={24} style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 15, color: 'var(--ink)' }}>จัดการฉบับแผนที่ควบคุม</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--muted)' }}>ฉบับร่าง {release.versionCode}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>ผู้ทบทวน</label>
            <Select value={reviewedBy} onChange={setReviewedBy} options={staffOptions} placeholder="เลือกผู้ทบทวน" />
          </div>
          <div>
            <label style={labelStyle}>ผู้อนุมัติ</label>
            <Select value={approvedBy} onChange={setApprovedBy} options={staffOptions} placeholder="เลือกผู้อนุมัติ" />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>วันที่มีผล</label>
          <Input type="date" value={effectiveDate ?? ''} onChange={setEffectiveDate} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>หมายเหตุ</label>
          <Input value={notes ?? ''} onChange={setNotes} placeholder="ไม่บังคับ" />
        </div>
        {blockers.length > 0 ? (
          <div role="alert" style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', fontSize: 12.5 }}>
            <strong>ยังเผยแพร่ไม่ได้:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {blockers.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={saveDraft} disabled={saving}>บันทึก</Button>
          <Button onClick={publish} disabled={saving}>เผยแพร่</Button>
        </div>
        {toastTray}
      </Card>
    )
  }

  return (
    <Card padding={24} style={{ marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15, color: 'var(--ink)' }}>จัดการฉบับแผนที่ควบคุม</h3>
      <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.8 }}>
        ฉบับใช้งานจริง {release.versionCode} · มีผล {release.effectiveDate ?? 'ยังไม่กำหนด'}<br />
        ผู้ทบทวน {release.reviewerName ?? 'ยังไม่กำหนด'} · ผู้อนุมัติ {release.approverName ?? 'ยังไม่กำหนด'}
      </p>
      {showCreateForm ? createForm : (
        <Button variant="secondary" onClick={() => setShowCreateForm(true)}>สร้างฉบับร่างใหม่</Button>
      )}
      {toastTray}
    </Card>
  )
}
