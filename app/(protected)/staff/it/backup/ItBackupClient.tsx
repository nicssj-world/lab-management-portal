'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import type { ItBackupLogWithRefs, ItSystem } from '@/lib/supabase/types'

type PickProfile = { id: string; name: string }

interface Props {
  initialLogs: ItBackupLogWithRefs[]
  systems: ItSystem[]
  profiles: PickProfile[]
  canEdit: boolean
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)', fontSize: 13,
  fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block' }
const thStyle: React.CSSProperties = { padding: '10px 12px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap', textAlign: 'left' }
const tdStyle: React.CSSProperties = { padding: '9px 12px', color: 'var(--ink)', verticalAlign: 'middle' }
const iconBtn: React.CSSProperties = {
  border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)',
  width: 30, height: 30, borderRadius: 7, cursor: 'pointer', marginLeft: 6,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}

const ACTIVITY_LABEL: Record<string, string> = { backup: 'สำรองข้อมูล', restore_test: 'ทดสอบกู้คืน' }

type Form = { id?: string; system_id: string; log_date: string; activity: 'backup' | 'restore_test'; result: 'success' | 'failed'; performed_by: string; note: string }
function emptyForm(): Form {
  const today = new Date().toLocaleDateString('en-CA')
  return { system_id: '', log_date: today, activity: 'backup', result: 'success', performed_by: '', note: '' }
}

function fmtDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
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

export function ItBackupClient({ initialLogs, systems, profiles, canEdit }: Props) {
  const [logs, setLogs] = useState(initialLogs)
  const [systemFilter, setSystemFilter] = useState('')
  const [activityFilter, setActivityFilter] = useState<'all' | 'backup' | 'restore_test'>('all')
  const { toasts, add } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<Form>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const activeSystems = systems.filter((s) => s.is_active)

  const filtered = useMemo(() => logs.filter((l) => {
    if (systemFilter && l.system_id !== systemFilter) return false
    if (activityFilter !== 'all' && l.activity !== activityFilter) return false
    return true
  }), [logs, systemFilter, activityFilter])

  async function refetch() {
    const res = await fetch('/api/admin/it-backup')
    if (res.ok) { const j = await res.json(); setLogs(j.items ?? []) }
  }

  function openAdd() { setForm(emptyForm()); setFormOpen(true) }
  function openEdit(l: ItBackupLogWithRefs) {
    setForm({ id: l.id, system_id: l.system_id, log_date: l.log_date, activity: l.activity, result: l.result, performed_by: l.performed_by ?? '', note: l.note ?? '' })
    setFormOpen(true)
  }

  async function save() {
    if (!form.system_id) { add('กรุณาเลือกระบบ', false); return }
    if (!form.log_date) { add('กรุณาระบุวันที่', false); return }
    setSaving(true)
    const payload = {
      system_id: form.system_id, log_date: form.log_date, activity: form.activity, result: form.result,
      performed_by: form.performed_by || null, note: form.note || null,
    }
    const res = await fetch(form.id ? `/api/admin/it-backup/${form.id}` : '/api/admin/it-backup', {
      method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) { add(form.id ? 'บันทึกการแก้ไขแล้ว' : 'บันทึกแล้ว'); setFormOpen(false); await refetch() }
    else { const j = await res.json().catch(() => ({})); add(j.error ?? 'บันทึกไม่สำเร็จ', false) }
  }

  async function confirmDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/admin/it-backup/${deleteId}`, { method: 'DELETE' })
    if (res.ok) { add('ลบแล้ว'); setDeleteId(null); await refetch() }
    else add('ลบไม่สำเร็จ', false)
  }

  return (
    <div>
      <PageHeader
        title="ทะเบียนการสำรองข้อมูล (Backup Log)"
        subtitle="บันทึกการสำรองข้อมูลและทดสอบการกู้คืนระบบสารสนเทศ"
        actions={canEdit ? <Button variant="primary" icon="plus" onClick={openAdd}>บันทึกรายการ</Button> : undefined}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Select value={systemFilter} onChange={setSystemFilter} placeholder="ทุกระบบ" options={systems.map((s) => ({ value: s.id, label: s.name }))} />
        {([['all', 'ทั้งหมด'], ['backup', 'สำรองข้อมูล'], ['restore_test', 'ทดสอบกู้คืน']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActivityFilter(key)} style={{
            padding: '5px 16px', borderRadius: 20, border: '1px solid var(--border)',
            background: activityFilter === key ? 'var(--primary)' : 'transparent', color: activityFilter === key ? '#fff' : 'var(--ink)',
            fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
          }}>{label}</button>
        ))}
      </div>

      <Card padding={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th style={thStyle}>วันที่</th>
                <th style={thStyle}>ระบบ</th>
                <th style={thStyle}>กิจกรรม</th>
                <th style={thStyle}>ผลลัพธ์</th>
                <th style={thStyle}>ผู้ดำเนินการ</th>
                <th style={thStyle}>หมายเหตุ</th>
                {canEdit && <th style={{ ...thStyle, textAlign: 'right' }}>จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--border)', transition: 'background .1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={tdStyle}>{fmtDate(l.log_date)}</td>
                  <td style={tdStyle}><Badge color="blue" size="sm">{l.system?.name ?? '-'}</Badge></td>
                  <td style={tdStyle}><Badge color={l.activity === 'restore_test' ? 'purple' : 'teal'} size="sm">{ACTIVITY_LABEL[l.activity]}</Badge></td>
                  <td style={tdStyle}><Badge color={l.result === 'success' ? 'green' : 'red'} size="sm" dot>{l.result === 'success' ? 'สำเร็จ' : 'ล้มเหลว'}</Badge></td>
                  <td style={{ ...tdStyle, color: 'var(--muted)' }}>{l.performer?.name ?? '-'}</td>
                  <td style={{ ...tdStyle, color: 'var(--muted)', maxWidth: 240 }}>{l.note ?? '-'}</td>
                  {canEdit && (
                    <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => openEdit(l)} title="แก้ไข" style={iconBtn}><Icon name="edit" size={15} /></button>
                      <button onClick={() => setDeleteId(l.id)} title="ลบ" style={{ ...iconBtn, color: 'var(--danger)' }}><Icon name="trash" size={15} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <EmptyState title="ไม่มีบันทึกการสำรองข้อมูล" hint="บันทึกการสำรองข้อมูล/ทดสอบการกู้คืนตามรอบ" icon="download" />}
      </Card>

      {formOpen && (
        <Modal title={form.id ? 'แก้ไขบันทึกการสำรองข้อมูล' : 'บันทึกการสำรองข้อมูล'} onClose={() => setFormOpen(false)}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>ระบบ *</label>
                <Select value={form.system_id} onChange={(v) => setForm((f) => ({ ...f, system_id: v }))} placeholder="— เลือกระบบ —"
                  style={{ width: '100%' }} options={activeSystems.map((s) => ({ value: s.id, label: s.name }))} />
              </div>
              <div>
                <label style={labelStyle}>วันที่ *</label>
                <input style={inputStyle} type="date" value={form.log_date} onChange={(e) => setForm((f) => ({ ...f, log_date: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>กิจกรรม</label>
                <Select value={form.activity} onChange={(v) => setForm((f) => ({ ...f, activity: v as Form['activity'] }))}
                  style={{ width: '100%' }} options={[{ value: 'backup', label: 'สำรองข้อมูล' }, { value: 'restore_test', label: 'ทดสอบกู้คืน' }]} />
              </div>
              <div>
                <label style={labelStyle}>ผลลัพธ์</label>
                <Select value={form.result} onChange={(v) => setForm((f) => ({ ...f, result: v as Form['result'] }))}
                  style={{ width: '100%' }} options={[{ value: 'success', label: 'สำเร็จ' }, { value: 'failed', label: 'ล้มเหลว' }]} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>ผู้ดำเนินการ</label>
              <Select value={form.performed_by} onChange={(v) => setForm((f) => ({ ...f, performed_by: v }))} placeholder="— ไม่ระบุ —"
                style={{ width: '100%' }} options={profiles.map((p) => ({ value: p.id, label: p.name }))} />
            </div>
            <div>
              <label style={labelStyle}>หมายเหตุ</label>
              <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>ยกเลิก</Button>
            <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</Button>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="ยืนยันการลบ" onClose={() => setDeleteId(null)}>
          <p style={{ fontSize: 13.5, margin: 0 }}>ต้องการลบบันทึกการสำรองข้อมูลนี้ใช่หรือไม่?</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <Button variant="secondary" onClick={() => setDeleteId(null)}>ยกเลิก</Button>
            <Button variant="danger" onClick={confirmDelete}>ลบ</Button>
          </div>
        </Modal>
      )}

      <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 2000 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: '#fff', background: t.ok ? 'var(--success)' : 'var(--danger)', boxShadow: '0 6px 20px rgba(0,0,0,.18)' }}>{t.msg}</div>
        ))}
      </div>
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{title}</h2>
          <button onClick={onClose} style={{ border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', width: 30, height: 30, borderRadius: 7, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}
