'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { Stat } from '@/components/ui/Stat'
import { EmptyState } from '@/components/ui/EmptyState'
import type { ItDowntimeLogWithSystem, ItSystem } from '@/lib/supabase/types'

interface Props {
  initialLogs: ItDowntimeLogWithSystem[]
  systems: ItSystem[]
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

type Form = { id?: string; system_id: string; started_at: string; ended_at: string; cause: string; resolution: string; used_contingency: boolean }
function emptyForm(): Form {
  return { system_id: '', started_at: '', ended_at: '', cause: '', resolution: '', used_contingency: false }
}

// "2026-07-18T09:30:00+00:00" → "2026-07-18T09:30" for datetime-local inputs (local time).
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function durationLabel(started: string, ended: string | null): string {
  if (!ended) return '—'
  const mins = Math.max(0, Math.round((new Date(ended).getTime() - new Date(started).getTime()) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`
}
function thaiFiscalYearStart(now = new Date()): Date {
  const y = now.getFullYear()
  const month = now.getMonth() + 1
  return new Date(month >= 10 ? y : y - 1, 9, 1) // Oct 1
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

export function ItDowntimeClient({ initialLogs, systems, canEdit }: Props) {
  const [logs, setLogs] = useState(initialLogs)
  const [systemFilter, setSystemFilter] = useState('')
  const [ongoingOnly, setOngoingOnly] = useState(false)
  const { toasts, add } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<Form>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const activeSystems = systems.filter((s) => s.is_active)

  const stats = useMemo(() => {
    const fyStart = thaiFiscalYearStart().getTime()
    const thisFy = logs.filter((l) => new Date(l.started_at).getTime() >= fyStart)
    const totalMins = thisFy.reduce((sum, l) => l.ended_at ? sum + Math.max(0, (new Date(l.ended_at).getTime() - new Date(l.started_at).getTime()) / 60000) : sum, 0)
    const h = Math.floor(totalMins / 60)
    const m = Math.round(totalMins % 60)
    return { count: thisFy.length, durationLabel: `${h}:${String(m).padStart(2, '0')}`, ongoing: logs.filter((l) => !l.ended_at).length }
  }, [logs])

  const filtered = useMemo(() => logs.filter((l) => {
    if (systemFilter && l.system_id !== systemFilter) return false
    if (ongoingOnly && l.ended_at) return false
    return true
  }), [logs, systemFilter, ongoingOnly])

  async function refetch() {
    const res = await fetch('/api/admin/it-downtime')
    if (res.ok) { const j = await res.json(); setLogs(j.items ?? []) }
  }

  function openAdd() { setForm(emptyForm()); setFormOpen(true) }
  function openEdit(l: ItDowntimeLogWithSystem) {
    setForm({ id: l.id, system_id: l.system_id, started_at: toLocalInput(l.started_at), ended_at: toLocalInput(l.ended_at), cause: l.cause ?? '', resolution: l.resolution ?? '', used_contingency: l.used_contingency })
    setFormOpen(true)
  }

  async function save() {
    if (!form.system_id) { add('กรุณาเลือกระบบ', false); return }
    if (!form.started_at) { add('กรุณาระบุเวลาที่เริ่มเกิดเหตุ', false); return }
    setSaving(true)
    const payload = {
      system_id: form.system_id,
      started_at: new Date(form.started_at).toISOString(),
      ended_at: form.ended_at ? new Date(form.ended_at).toISOString() : null,
      cause: form.cause || null, resolution: form.resolution || null, used_contingency: form.used_contingency,
    }
    const res = await fetch(form.id ? `/api/admin/it-downtime/${form.id}` : '/api/admin/it-downtime', {
      method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) { add(form.id ? 'บันทึกการแก้ไขแล้ว' : 'บันทึกเหตุการณ์แล้ว'); setFormOpen(false); await refetch() }
    else { const j = await res.json().catch(() => ({})); add(j.error ?? 'บันทึกไม่สำเร็จ', false) }
  }

  async function confirmDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/admin/it-downtime/${deleteId}`, { method: 'DELETE' })
    if (res.ok) { add('ลบแล้ว'); setDeleteId(null); await refetch() }
    else add('ลบไม่สำเร็จ', false)
  }

  return (
    <div>
      <PageHeader
        title="บันทึกระบบล่ม (Downtime Log)"
        subtitle="เหตุการณ์ระบบสารสนเทศใช้งานไม่ได้และการแก้ไข"
        actions={canEdit ? <Button variant="primary" icon="plus" onClick={openAdd}>บันทึกเหตุการณ์</Button> : undefined}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        <Stat label="เหตุการณ์ (ปีงบนี้)" value={stats.count} color="blue" icon="alert" />
        <Stat label="รวมเวลาล่ม (ชม.:นาที)" value={stats.durationLabel} color="amber" icon="clock" />
        <Stat label="กำลังเกิดเหตุ" value={stats.ongoing} color={stats.ongoing > 0 ? 'red' : 'green'} icon="alert" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Select value={systemFilter} onChange={setSystemFilter} placeholder="ทุกระบบ"
          options={systems.map((s) => ({ value: s.id, label: s.name }))} />
        {([['all', 'ทั้งหมด'], ['ongoing', 'กำลังเกิด']] as const).map(([key, label]) => {
          const active = key === 'ongoing' ? ongoingOnly : !ongoingOnly
          return (
            <button key={key} onClick={() => setOngoingOnly(key === 'ongoing')} style={{
              padding: '5px 16px', borderRadius: 20, border: '1px solid var(--border)',
              background: active ? 'var(--primary)' : 'transparent', color: active ? '#fff' : 'var(--ink)',
              fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
            }}>{label}</button>
          )
        })}
      </div>

      <Card padding={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th style={thStyle}>ระบบ</th>
                <th style={thStyle}>เริ่ม</th>
                <th style={thStyle}>สิ้นสุด</th>
                <th style={thStyle}>ระยะเวลา</th>
                <th style={thStyle}>สาเหตุ</th>
                <th style={thStyle}>การแก้ไข</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>แผนสำรอง</th>
                {canEdit && <th style={{ ...thStyle, textAlign: 'right' }}>จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--border)', transition: 'background .1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={tdStyle}><Badge color="blue" size="sm">{l.system?.name ?? '-'}</Badge></td>
                  <td style={tdStyle}>{fmtDateTime(l.started_at)}</td>
                  <td style={tdStyle}>{l.ended_at ? fmtDateTime(l.ended_at) : <Badge color="red" size="sm" dot>กำลังเกิด</Badge>}</td>
                  <td style={tdStyle}>{durationLabel(l.started_at, l.ended_at)}</td>
                  <td style={{ ...tdStyle, color: 'var(--muted)', maxWidth: 200 }}>{l.cause ?? '-'}</td>
                  <td style={{ ...tdStyle, color: 'var(--muted)', maxWidth: 200 }}>{l.resolution ?? '-'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{l.used_contingency ? <Icon name="check" size={14} style={{ color: 'var(--success)' }} /> : ''}</td>
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
        {filtered.length === 0 && <EmptyState title="ไม่มีบันทึกระบบล่ม" hint="บันทึกเหตุการณ์เมื่อระบบใช้งานไม่ได้" icon="alert" />}
      </Card>

      {formOpen && (
        <Modal title={form.id ? 'แก้ไขบันทึกระบบล่ม' : 'บันทึกระบบล่ม'} onClose={() => setFormOpen(false)}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={labelStyle}>ระบบ *</label>
              <Select value={form.system_id} onChange={(v) => setForm((f) => ({ ...f, system_id: v }))} placeholder="— เลือกระบบ —"
                style={{ width: '100%' }} options={activeSystems.map((s) => ({ value: s.id, label: s.name }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>เริ่มเกิดเหตุ *</label>
                <input style={inputStyle} type="datetime-local" value={form.started_at} onChange={(e) => setForm((f) => ({ ...f, started_at: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>กลับมาใช้งาน (เว้นว่าง = ยังไม่จบ)</label>
                <input style={inputStyle} type="datetime-local" value={form.ended_at} onChange={(e) => setForm((f) => ({ ...f, ended_at: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>สาเหตุ</label>
              <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.cause} onChange={(e) => setForm((f) => ({ ...f, cause: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>การแก้ไข</label>
              <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.resolution} onChange={(e) => setForm((f) => ({ ...f, resolution: e.target.value }))} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.used_contingency} onChange={(e) => setForm((f) => ({ ...f, used_contingency: e.target.checked }))} />
              ใช้แผนสำรอง / รายงานผลด้วยมือระหว่างระบบล่ม
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>ยกเลิก</Button>
            <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</Button>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="ยืนยันการลบ" onClose={() => setDeleteId(null)}>
          <p style={{ fontSize: 13.5, margin: 0 }}>ต้องการลบบันทึกระบบล่มนี้ใช่หรือไม่?</p>
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
