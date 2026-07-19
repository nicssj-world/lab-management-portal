'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import { PERMISSION_COLUMNS } from '@/lib/it-access/columns'
import { buildItAccessRegisterHtml } from '@/lib/it-access/register-pdf'
import type { ItAccessRecordWithProfile, ItSystem, ItAccessReview } from '@/lib/supabase/types'

type PickProfile = { id: string; name: string; position_title: string | null; ephis_id: string | null }

interface Props {
  initialRecords: ItAccessRecordWithProfile[]
  initialSystems: ItSystem[]
  latestReview: ItAccessReview | null
  profiles: PickProfile[]
  canEdit: boolean
  isAdmin: boolean
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)', fontSize: 13,
  fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block',
}

type RecordForm = {
  profile_id: string
  lis_user_id: string
  can_register: boolean
  can_view_result: boolean
  can_report_result: boolean
  can_verify_result: boolean
  can_edit_result: boolean
  can_set_parameter: boolean
  can_admin_setting: boolean
  system_ids: string[]
  display_order: string
}

function emptyForm(): RecordForm {
  return {
    profile_id: '', lis_user_id: '',
    can_register: false, can_view_result: false, can_report_result: false,
    can_verify_result: false, can_edit_result: false, can_set_parameter: false, can_admin_setting: false,
    system_ids: [], display_order: '',
  }
}

function isRevokePending(r: ItAccessRecordWithProfile): boolean {
  const p = r.profile
  return !p || p.deleted_at != null || p.status !== 'active'
}

// วัน + เวลา (เช่น "18 ก.ค. 2569 14:32")
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// Two-step annual review status.
// - none:             never reviewed
// - pending-approval: reviewed but awaiting approval
// - approved:         cycle complete → due one year after approval (window opens 30 days before)
type ReviewPhase = 'none' | 'pending-approval' | 'approved'
function reviewState(latest: ItAccessReview | null): { phase: ReviewPhase; level: 'ok' | 'soon' | 'overdue'; dueLabel: string } {
  if (!latest) return { phase: 'none', level: 'overdue', dueLabel: '' }
  if (!latest.approved_at) return { phase: 'pending-approval', level: 'soon', dueLabel: '' }
  const due = new Date(latest.approved_at)
  due.setFullYear(due.getFullYear() + 1)
  const dueLabel = due.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
  const days = (due.getTime() - Date.now()) / 86_400_000
  if (days < 0) return { phase: 'approved', level: 'overdue', dueLabel }
  if (days <= 30) return { phase: 'approved', level: 'soon', dueLabel }
  return { phase: 'approved', level: 'ok', dueLabel }
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

export function ItAccessClient({ initialRecords, initialSystems, latestReview: initialReview, profiles, canEdit, isAdmin }: Props) {
  const [records, setRecords] = useState(initialRecords)
  const [systems, setSystems] = useState(initialSystems)
  const [latestReview, setLatestReview] = useState(initialReview)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'revoke'>('all')
  const { toasts, add } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<RecordForm>(emptyForm())
  const [saving, setSaving] = useState(false)

  const [systemsOpen, setSystemsOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [approveOpen, setApproveOpen] = useState(false)
  const [approving, setApproving] = useState(false)
  const [historyFor, setHistoryFor] = useState<ItAccessRecordWithProfile | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ItAccessRecordWithProfile | null>(null)

  const editingRecord = editingId ? records.find((r) => r.id === editingId) ?? null : null

  const revokeCount = useMemo(() => records.filter(isRevokePending).length, [records])
  const rStatus = reviewState(latestReview)

  async function approveReview() {
    if (!latestReview) return
    setApproving(true)
    const res = await fetch(`/api/admin/it-access/reviews/${latestReview.id}/approve`, { method: 'POST' })
    setApproving(false)
    if (res.ok) { add('อนุมัติการทบทวนแล้ว'); setLatestReview(await res.json()); setApproveOpen(false) }
    else { const j = await res.json().catch(() => ({})); add(j.error ?? 'อนุมัติไม่สำเร็จ', false) }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return records.filter((r) => {
      if (filter === 'revoke' && !isRevokePending(r)) return false
      if (!q) return true
      const p = r.profile
      return [p?.name, p?.ephis_id, r.lis_user_id, p?.position_title]
        .filter(Boolean).some((v) => (v as string).toLowerCase().includes(q))
    })
  }, [records, search, filter])

  const usedProfileIds = useMemo(() => new Set(records.map((r) => r.profile_id)), [records])
  const availableProfiles = useMemo(
    () => profiles.filter((p) => !usedProfileIds.has(p.id) || p.id === editingRecord?.profile_id),
    [profiles, usedProfileIds, editingRecord],
  )
  const selectedProfile = profiles.find((p) => p.id === form.profile_id) ?? editingRecord?.profile ?? null

  async function refetch() {
    const res = await fetch('/api/admin/it-access')
    if (res.ok) {
      const j = await res.json()
      setRecords(j.items ?? [])
      setSystems(j.systems ?? [])
    }
  }

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm())
    setFormOpen(true)
  }
  function openEdit(r: ItAccessRecordWithProfile) {
    setEditingId(r.id)
    setForm({
      profile_id: r.profile_id,
      lis_user_id: r.lis_user_id ?? '',
      can_register: r.can_register, can_view_result: r.can_view_result,
      can_report_result: r.can_report_result, can_verify_result: r.can_verify_result, can_edit_result: r.can_edit_result,
      can_set_parameter: r.can_set_parameter, can_admin_setting: r.can_admin_setting,
      system_ids: [...r.system_ids],
      display_order: r.display_order != null ? String(r.display_order) : '',
    })
    setFormOpen(true)
  }

  async function saveRecord() {
    if (!form.profile_id) { add('กรุณาเลือกบุคลากร', false); return }
    setSaving(true)
    const payload: Record<string, unknown> = {
      lis_user_id: form.lis_user_id || null,
      can_register: form.can_register, can_view_result: form.can_view_result,
      can_report_result: form.can_report_result, can_verify_result: form.can_verify_result, can_edit_result: form.can_edit_result,
      can_set_parameter: form.can_set_parameter, can_admin_setting: form.can_admin_setting,
      system_ids: form.system_ids,
      display_order: form.display_order.trim() === '' ? null : Number(form.display_order),
    }
    if (!editingId) payload.profile_id = form.profile_id

    const res = await fetch(editingId ? `/api/admin/it-access/${editingId}` : '/api/admin/it-access', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      add(editingId ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มรายชื่อแล้ว')
      setFormOpen(false)
      await refetch()
    } else {
      const j = await res.json().catch(() => ({}))
      add(j.error ?? 'บันทึกไม่สำเร็จ', false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const res = await fetch(`/api/admin/it-access/${deleteTarget.id}`, { method: 'DELETE' })
    if (res.ok) { add('ลบรายการแล้ว'); setDeleteTarget(null); await refetch() }
    else { add('ลบไม่สำเร็จ', false) }
  }

  function exportPdf() {
    const html = buildItAccessRegisterHtml(records, systems)
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html; charset=utf-8' }))
    const win = window.open(blobUrl, '_blank')
    win?.addEventListener('load', () => { win.print(); URL.revokeObjectURL(blobUrl) }, { once: true })
  }

  // Systems shown as checkboxes: active ones + any inactive system the edited row still references.
  const formSystemOptions = systems.filter((s) => s.is_active || form.system_ids.includes(s.id))

  return (
    <div>
      <PageHeader
        title="ทะเบียนสิทธิ์การเข้าถึงระบบสารสนเทศ HIS &amp; LIS"
        subtitle={`Fm-QP-LAB-24/01 · ทั้งหมด ${records.length} คน`}
        actions={
          <>
            <Button variant="secondary" icon="download" onClick={exportPdf}>พิมพ์ PDF</Button>
            {canEdit && <Button variant="secondary" icon="settings" onClick={() => setSystemsOpen(true)}>จัดการระบบ</Button>}
            {canEdit && <Button variant="primary" icon="plus" onClick={openAdd}>เพิ่มรายชื่อ</Button>}
          </>
        }
      />

      {/* Annual review status bar (ทบทวน → อนุมัติ) */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        padding: '10px 14px', borderRadius: 12, marginBottom: 14,
        border: `1px solid ${rStatus.level === 'overdue' ? '#FCA5A5' : rStatus.level === 'soon' ? '#FDE68A' : 'var(--border)'}`,
        background: rStatus.level === 'overdue' ? '#FFF7F7' : rStatus.level === 'soon' ? '#FFFBEB' : 'var(--surface-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Icon name="clock" size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.6 }}>
            {!latestReview
              ? <span style={{ color: 'var(--muted)' }}>ยังไม่มีการทบทวนสิทธิ์</span>
              : <>
                  <span>ทบทวน {fmtDateTime(latestReview.reviewed_at)} น. โดย {latestReview.reviewed_by_name}</span>
                  {latestReview.approved_at
                    ? <span> · อนุมัติ {fmtDateTime(latestReview.approved_at)} น. โดย {latestReview.approved_by_name}
                        {rStatus.dueLabel && <span style={{ color: 'var(--muted)' }}> · ครบกำหนดทบทวน {rStatus.dueLabel}</span>}</span>
                    : <span style={{ color: 'var(--muted)' }}> · รอการอนุมัติ</span>}
                </>}
          </div>
          <Badge
            color={rStatus.phase === 'pending-approval' ? 'amber' : rStatus.level === 'overdue' ? 'red' : rStatus.level === 'soon' ? 'amber' : 'green'}
            dot
          >
            {rStatus.phase === 'none' ? 'เกินกำหนดทบทวน'
              : rStatus.phase === 'pending-approval' ? 'รออนุมัติ'
              : rStatus.level === 'overdue' ? 'เกินกำหนดทบทวน'
              : rStatus.level === 'soon' ? 'ใกล้ครบกำหนด' : 'ทบทวนแล้ว'}
          </Badge>
        </div>
        {canEdit && (rStatus.phase === 'pending-approval'
          ? <Button size="sm" variant="primary" icon="check" onClick={() => setApproveOpen(true)}>อนุมัติ</Button>
          : <Button size="sm" variant="secondary" icon="check" onClick={() => setReviewOpen(true)}>ยืนยันการทบทวน</Button>
        )}
      </div>

      {/* Search + filter pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 220, maxWidth: 360 }}>
          <Input value={search} onChange={setSearch} placeholder="ค้นหาชื่อ / HIS ID / LIS ID / ตำแหน่ง" icon="search" />
        </div>
        {([['all', `ทั้งหมด (${records.length})`], ['revoke', `รอถอนสิทธิ์ (${revokeCount})`]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            padding: '5px 16px', borderRadius: 20, border: '1px solid var(--border)',
            background: filter === key ? 'var(--primary)' : 'transparent',
            color: filter === key ? '#fff' : 'var(--ink)',
            fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
          }}>{label}</button>
        ))}
      </div>

      <Card padding={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                <th rowSpan={2} style={thStyle}>#</th>
                <th rowSpan={2} style={thStyle}>HIS ID</th>
                <th rowSpan={2} style={thStyle}>LIS ID</th>
                <th rowSpan={2} style={thStyle}>ชื่อ - สกุล</th>
                <th rowSpan={2} style={thStyle}>ตำแหน่ง</th>
                <th colSpan={5} style={{ ...thStyle, textAlign: 'center', borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>สิทธิ์ปฏิบัติการ</th>
                <th colSpan={2} style={{ ...thStyle, textAlign: 'center', borderLeft: '2px solid var(--border)', borderBottom: '1px solid var(--border)' }}>ตั้งค่าระบบ</th>
                <th rowSpan={2} style={{ ...thStyle, borderLeft: '1px solid var(--border)' }}>ระบบ</th>
                {canEdit && <th rowSpan={2} style={{ ...thStyle, textAlign: 'right' }}>จัดการ</th>}
              </tr>
              <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                {PERMISSION_COLUMNS.map((c, idx) => (
                  <th key={c.key} title={c.label} style={{
                    ...thStyle, textAlign: 'center', whiteSpace: 'pre', minWidth: 62,
                    padding: '6px 10px', fontSize: 11, lineHeight: 1.3, verticalAlign: 'middle',
                    borderLeft: c.group === 'admin' && PERMISSION_COLUMNS[idx - 1]?.group === 'op'
                      ? '2px solid var(--border)' : '1px solid var(--border)',
                  }}>{c.short}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const pending = isRevokePending(r)
                return (
                  <tr key={r.id}
                    style={{ borderTop: '1px solid var(--border)', background: pending ? '#FFF7F7' : 'transparent', transition: 'background .1s' }}
                    onMouseEnter={(e) => { if (!pending) e.currentTarget.style.background = 'var(--surface-2)' }}
                    onMouseLeave={(e) => { if (!pending) e.currentTarget.style.background = 'transparent' }}>
                    <td style={tdStyle}>{i + 1}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{r.profile?.ephis_id ?? '-'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{r.lis_user_id || '-'}</td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600 }}>{r.profile?.name ?? '—'}</span>
                      {pending && <Badge color="red" size="sm" style={{ marginLeft: 6 }}>รอถอนสิทธิ์</Badge>}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--muted)' }}>{r.profile?.position_title ?? '-'}</td>
                    {PERMISSION_COLUMNS.map((c, idx) => (
                      <td key={c.key} style={{
                        ...tdStyle, textAlign: 'center', padding: '9px 10px',
                        borderLeft: c.group === 'admin' && PERMISSION_COLUMNS[idx - 1]?.group === 'op'
                          ? '2px solid var(--border)' : '1px solid var(--border)',
                      }}>
                        {r[c.key]
                          ? <Icon name="check" size={15} style={{ color: 'var(--success)', display: 'inline-block', verticalAlign: 'middle' }} />
                          : <span style={{ color: 'var(--border)' }}>·</span>}
                      </td>
                    ))}
                    <td style={{ ...tdStyle, borderLeft: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {systems.filter((s) => r.system_ids.includes(s.id)).map((s) => (
                          <Badge key={s.id} color="blue" size="sm">{s.name}</Badge>
                        ))}
                      </div>
                    </td>
                    {canEdit && (
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => setHistoryFor(r)} title="ประวัติ" style={iconBtn}><Icon name="clock" size={15} /></button>
                        <button onClick={() => openEdit(r)} title="แก้ไข" style={iconBtn}><Icon name="edit" size={15} /></button>
                        <button onClick={() => setDeleteTarget(r)} title="ลบ" style={{ ...iconBtn, color: 'var(--danger)' }}><Icon name="trash" size={15} /></button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <EmptyState title="ไม่พบรายการ" hint="เพิ่มรายชื่อบุคลากรเพื่อบันทึกสิทธิ์การเข้าถึงระบบ" icon="lock" />}
      </Card>

      {/* ── Add/Edit modal ── */}
      {formOpen && (
        <Modal title={editingId ? 'แก้ไขสิทธิ์การเข้าถึง' : 'เพิ่มรายชื่อ'} onClose={() => setFormOpen(false)}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={labelStyle}>บุคลากร *</label>
              {editingId ? (
                <div style={{ ...inputStyle, background: 'var(--surface-2)' }}>{selectedProfile?.name ?? '—'}</div>
              ) : (
                <Select
                  value={form.profile_id}
                  onChange={(v) => setForm((f) => ({ ...f, profile_id: v }))}
                  placeholder="— เลือกบุคลากร —"
                  style={{ width: '100%' }}
                  options={availableProfiles.map((p) => ({ value: p.id, label: `${p.name}${p.ephis_id ? ` · ${p.ephis_id}` : ''}` }))}
                />
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>User ID HIS</label>
                <div style={{ ...inputStyle, background: 'var(--surface-2)', fontFamily: 'monospace' }}>{selectedProfile?.ephis_id ?? '-'}</div>
              </div>
              <div>
                <label style={labelStyle}>User ID LIS</label>
                <input style={{ ...inputStyle, fontFamily: 'monospace' }} value={form.lis_user_id}
                  onChange={(e) => setForm((f) => ({ ...f, lis_user_id: e.target.value }))} placeholder="เช่น L9495" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>ตำแหน่ง</label>
              <div style={{ ...inputStyle, background: 'var(--surface-2)', color: 'var(--muted)' }}>{selectedProfile?.position_title ?? '-'}</div>
            </div>

            <div>
              <label style={labelStyle}>สิทธิ์การใช้งานระบบ</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
                {PERMISSION_COLUMNS.map((c) => (
                  <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form[c.key as keyof RecordForm] as boolean}
                      onChange={(e) => setForm((f) => ({ ...f, [c.key]: e.target.checked }))} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>ระบบที่ใช้งาน (หมายเหตุ)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
                {formSystemOptions.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>ยังไม่มีระบบ — เพิ่มได้ที่ &quot;จัดการระบบ&quot;</span>}
                {formSystemOptions.map((s) => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.system_ids.includes(s.id)}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        system_ids: e.target.checked ? [...f.system_ids, s.id] : f.system_ids.filter((x) => x !== s.id),
                      }))} />
                    {s.name}{!s.is_active && <span style={{ color: 'var(--muted)', fontSize: 11 }}>(ปิดใช้งาน)</span>}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ width: 140 }}>
              <label style={labelStyle}>ลำดับ (เว้นว่าง = อัตโนมัติ)</label>
              <input style={inputStyle} type="number" value={form.display_order}
                onChange={(e) => setForm((f) => ({ ...f, display_order: e.target.value }))} placeholder="อัตโนมัติ" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>ยกเลิก</Button>
            <Button variant="primary" onClick={saveRecord} disabled={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</Button>
          </div>
        </Modal>
      )}

      {/* ── Systems management modal ── */}
      {systemsOpen && (
        <SystemsModal
          systems={systems}
          profiles={profiles}
          isAdmin={isAdmin}
          onClose={() => setSystemsOpen(false)}
          onChanged={refetch}
          notify={add}
        />
      )}

      {/* ── Review modal ── */}
      {reviewOpen && (
        <ReviewModal onClose={() => setReviewOpen(false)} onDone={(rev) => { setLatestReview(rev); setReviewOpen(false) }} notify={add} />
      )}

      {/* ── Approve confirm modal ── */}
      {approveOpen && latestReview && (
        <Modal title="อนุมัติการทบทวนสิทธิ์" onClose={() => setApproveOpen(false)} maxWidth={480}>
          <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>
            <div>ทบทวนโดย <b>{latestReview.reviewed_by_name}</b></div>
            <div style={{ color: 'var(--muted)' }}>เมื่อ {fmtDateTime(latestReview.reviewed_at)} น.</div>
            {latestReview.note && <div style={{ marginTop: 6, color: 'var(--muted)' }}>หมายเหตุ: {latestReview.note}</div>}
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink)', marginTop: 14 }}>ยืนยันการอนุมัติการทบทวนนี้? ระบบจะบันทึกชื่อและวันเวลาที่คุณอนุมัติ</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <Button variant="secondary" onClick={() => setApproveOpen(false)}>ยกเลิก</Button>
            <Button variant="primary" onClick={approveReview} disabled={approving}>{approving ? 'กำลังอนุมัติ…' : 'อนุมัติ'}</Button>
          </div>
        </Modal>
      )}

      {/* ── History modal ── */}
      {historyFor && (
        <HistoryModal record={historyFor} onClose={() => setHistoryFor(null)} />
      )}

      {/* ── Delete confirm ── */}
      {deleteTarget && (
        <Modal title="ยืนยันการลบ" onClose={() => setDeleteTarget(null)}>
          <p style={{ fontSize: 13.5, color: 'var(--ink)', margin: 0 }}>
            ต้องการถอนสิทธิ์/ลบรายการของ <b>{deleteTarget.profile?.name ?? '—'}</b> ใช่หรือไม่?
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>ยกเลิก</Button>
            <Button variant="danger" onClick={confirmDelete}>ลบ</Button>
          </div>
        </Modal>
      )}

      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 2000 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: '#fff',
            background: t.ok ? 'var(--success)' : 'var(--danger)', boxShadow: '0 6px 20px rgba(0,0,0,.18)',
          }}>{t.msg}</div>
        ))}
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '10px 12px', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '9px 12px', color: 'var(--ink)', verticalAlign: 'middle' }
const iconBtn: React.CSSProperties = {
  border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)',
  width: 30, height: 30, borderRadius: 7, cursor: 'pointer', marginLeft: 6,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}

// ── Modal shell (X button only; no backdrop close per project decision) ──
function Modal({ title, onClose, children, maxWidth = 620 }: { title: string; onClose: () => void; children: React.ReactNode; maxWidth?: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{title}</h2>
          <button onClick={onClose} style={{ ...iconBtn, marginLeft: 0 }}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

// ── Systems management ──
function SystemsModal({ systems, profiles, isAdmin, onClose, onChanged, notify }: {
  systems: ItSystem[]; profiles: PickProfile[]; isAdmin: boolean
  onClose: () => void; onChanged: () => Promise<void>; notify: (m: string, ok?: boolean) => void
}) {
  const [rows, setRows] = useState(systems)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  async function reload() {
    const res = await fetch('/api/admin/it-access')
    if (res.ok) { const j = await res.json(); setRows(j.systems ?? []) }
    await onChanged()
  }

  async function addSystem() {
    if (!newName.trim()) return
    const res = await fetch('/api/admin/it-access/systems', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim() }),
    })
    if (res.ok) { setNewName(''); notify('เพิ่มระบบแล้ว'); await reload() }
    else { const j = await res.json().catch(() => ({})); notify(j.error ?? 'เพิ่มไม่สำเร็จ', false) }
  }
  async function saveRename(id: string) {
    const res = await fetch(`/api/admin/it-access/systems/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editName.trim() }),
    })
    if (res.ok) { setEditId(null); notify('บันทึกชื่อแล้ว'); await reload() }
    else { const j = await res.json().catch(() => ({})); notify(j.error ?? 'บันทึกไม่สำเร็จ', false) }
  }
  async function toggleActive(s: ItSystem) {
    const res = await fetch(`/api/admin/it-access/systems/${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !s.is_active }),
    })
    if (res.ok) { notify(s.is_active ? 'ปิดใช้งานแล้ว' : 'เปิดใช้งานแล้ว'); await reload() }
    else { notify('ดำเนินการไม่สำเร็จ', false) }
  }

  return (
    <Modal title="จัดการระบบสารสนเทศ" onClose={onClose} maxWidth={520}>
      <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
        {rows.map((s) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
            {editId === s.id ? (
              <>
                <input style={{ ...inputStyle, flex: 1 }} value={editName} onChange={(e) => setEditName(e.target.value)} />
                <Button size="sm" variant="primary" onClick={() => saveRename(s.id)}>บันทึก</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>ยกเลิก</Button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{s.name}</span>
                <Badge color={s.is_active ? 'green' : 'gray'} size="sm">{s.is_active ? 'ใช้งาน' : 'ปิด'}</Badge>
                <button onClick={() => { setEditId(s.id); setEditName(s.name) }} style={iconBtn} title="เปลี่ยนชื่อ"><Icon name="edit" size={14} /></button>
                <button onClick={() => toggleActive(s)} style={iconBtn} title={s.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}>
                  <Icon name={s.is_active ? 'eye' : 'lock'} size={14} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input style={{ ...inputStyle, flex: 1 }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ชื่อระบบใหม่" />
        <Button variant="primary" icon="plus" onClick={addSystem}>เพิ่ม</Button>
      </div>

      {isAdmin && <ItEditorsSection profiles={profiles} notify={notify} />}
    </Modal>
  )
}

type ItEditor = { user_id: string; profile: { id: string; name: string; ephis_id: string | null } | null }

// คณะทำงาน IT: grants a chosen person admin-equivalent edit access to the whole
// งาน IT module, independent of their profiles.role. Admin-only (enforced server-side too).
function ItEditorsSection({ profiles, notify }: { profiles: PickProfile[]; notify: (m: string, ok?: boolean) => void }) {
  const [editors, setEditors] = useState<ItEditor[] | null>(null)
  const [addingId, setAddingId] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const res = await fetch('/api/admin/it-access/editors')
    if (res.ok) { const j = await res.json(); setEditors(j.items ?? []) }
    else setEditors([])
  }
  useEffect(() => { load() }, [])

  const editorIds = useMemo(() => new Set((editors ?? []).map((e) => e.user_id)), [editors])
  const candidates = useMemo(() => profiles.filter((p) => !editorIds.has(p.id)), [profiles, editorIds])

  async function addEditor() {
    if (!addingId) return
    setBusy(true)
    const res = await fetch('/api/admin/it-access/editors', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: addingId }),
    })
    setBusy(false)
    if (res.ok) { setAddingId(''); notify('เพิ่มเข้าคณะทำงาน IT แล้ว'); await load() }
    else { const j = await res.json().catch(() => ({})); notify(j.error ?? 'เพิ่มไม่สำเร็จ', false) }
  }
  async function removeEditor(userId: string) {
    const res = await fetch(`/api/admin/it-access/editors/${userId}`, { method: 'DELETE' })
    if (res.ok) { notify('ถอนออกจากคณะทำงาน IT แล้ว'); await load() }
    else notify('ถอนไม่สำเร็จ', false)
  }

  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>คณะทำงาน IT</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>
        ผู้ที่เพิ่มในนี้จะมีสิทธิ์เทียบเท่า Admin เฉพาะในโมดูล &quot;งาน IT&quot; (ทะเบียนสิทธิ์ / บันทึกระบบล่ม / การสำรองข้อมูล) โดยไม่กระทบสิทธิ์ในโมดูลอื่น
      </div>
      {editors === null ? (
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>กำลังโหลด…</div>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          {editors.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>ยังไม่มีคณะทำงาน IT</div>}
          {editors.map((e) => (
            <div key={e.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{e.profile?.name ?? '—'}</span>
              {e.profile?.ephis_id && <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{e.profile.ephis_id}</span>}
              <button onClick={() => removeEditor(e.user_id)} style={{ ...iconBtn, color: 'var(--danger)' }} title="ถอนออก"><Icon name="trash" size={14} /></button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Select
          value={addingId}
          onChange={setAddingId}
          placeholder="— เลือกบุคลากร —"
          style={{ flex: 1 }}
          options={candidates.map((p) => ({ value: p.id, label: `${p.name}${p.ephis_id ? ` · ${p.ephis_id}` : ''}` }))}
        />
        <Button variant="primary" icon="plus" onClick={addEditor} disabled={!addingId || busy}>เพิ่ม</Button>
      </div>
    </div>
  )
}

// ── Annual review confirm ──
function ReviewModal({ onClose, onDone, notify }: {
  onClose: () => void; onDone: (rev: ItAccessReview) => void; notify: (m: string, ok?: boolean) => void
}) {
  const [note, setNote] = useState('')
  const [history, setHistory] = useState<ItAccessReview[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/it-access/reviews').then((r) => r.json()).then((j) => setHistory(j.items ?? [])).catch(() => {})
  }, [])

  async function submit() {
    setSaving(true)
    const res = await fetch('/api/admin/it-access/reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: note || null }),
    })
    setSaving(false)
    if (res.ok) { notify('บันทึกการทบทวนแล้ว'); onDone(await res.json()) }
    else { notify('บันทึกไม่สำเร็จ', false) }
  }

  return (
    <Modal title="ยืนยันการทบทวนสิทธิ์ประจำปี" onClose={onClose} maxWidth={520}>
      <label style={labelStyle}>หมายเหตุ (ถ้ามี)</label>
      <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ทบทวนแล้วไม่มีการเปลี่ยนแปลง" />
      {history.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>ประวัติการทบทวน</div>
          <div style={{ display: 'grid', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
            {history.map((h) => (
              <div key={h.id} style={{ fontSize: 12, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 7, lineHeight: 1.6 }}>
                <div style={{ color: 'var(--ink)' }}>ทบทวน {fmtDateTime(h.reviewed_at)} น. · {h.reviewed_by_name}</div>
                <div style={{ color: h.approved_at ? '#15803D' : 'var(--warning)' }}>
                  {h.approved_at ? `อนุมัติ ${fmtDateTime(h.approved_at)} น. · ${h.approved_by_name}` : 'รอการอนุมัติ'}
                </div>
                {h.note && <div style={{ color: 'var(--muted)', marginTop: 2 }}>หมายเหตุ: {h.note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
        <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
        <Button variant="primary" onClick={submit} disabled={saving}>{saving ? 'กำลังบันทึก…' : 'ยืนยันการทบทวน'}</Button>
      </div>
    </Modal>
  )
}

// ── Per-person change history ──
function HistoryModal({ record, onClose }: { record: ItAccessRecordWithProfile; onClose: () => void }) {
  const [items, setItems] = useState<{ id: number; detail: string | null; created_at: string; actor_name: string }[] | null>(null)

  useEffect(() => {
    fetch(`/api/admin/it-access/${record.id}/history`).then((r) => r.json()).then((j) => setItems(j.items ?? [])).catch(() => setItems([]))
  }, [record.id])

  return (
    <Modal title={`ประวัติการเปลี่ยนสิทธิ์ — ${record.profile?.name ?? ''}`} onClose={onClose} maxWidth={560}>
      {items === null ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด…</div>
      ) : items.length === 0 ? (
        <EmptyState title="ยังไม่มีประวัติ" hint="การเปลี่ยนแปลงสิทธิ์จะถูกบันทึกที่นี่" icon="clock" />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((it) => (
            <div key={it.id} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)' }}>{it.detail}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
                {new Date(it.created_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {it.actor_name && ` · โดย ${it.actor_name}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
