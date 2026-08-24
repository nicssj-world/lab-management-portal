'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { Stat } from '@/components/ui/Stat'
import { EmptyState } from '@/components/ui/EmptyState'
import { DEPARTMENTS } from '@/lib/validations/user-schema'
import {
  ACTIVITY_LABEL, ACTIVITY_TYPES, APPOINTMENT_LABEL, BADGE_LABEL,
  ORG_TYPE_LABEL, ORG_TYPES, SAFETY_LABEL, VISIT_TYPE_LABEL,
} from '@/lib/it-visitor/constants'
import type { ActivityType, OrgType } from '@/lib/it-visitor/constants'
import { buildVisitorRegisterHtml } from '@/lib/it-visitor/register-pdf'
import { paginateVisitorLogs, prioritizeOpenVisitorLogs } from '@/lib/it-visitor/pagination'
import type { ItVisitorLogWithRefs } from '@/lib/supabase/types'

interface Settings { public_token: string; is_open: boolean; updated_at: string }
interface Props {
  initialLogs: ItVisitorLogWithRefs[]
  initialSettings: Settings | null
  canEdit: boolean
  isAdmin: boolean
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

function pad(n: number) { return String(n).padStart(2, '0') }
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function checkoutMethodLabel(method: ItVisitorLogWithRefs['checkout_method']) {
  if (method === 'self') return 'ผู้มาติดต่อบันทึกเอง'
  if (method === 'staff') return 'เจ้าหน้าที่บันทึกให้'
  return 'ไม่ระบุ (ข้อมูลเดิม)'
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtTime(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}
function durationLabel(entered: string, exited: string | null): string {
  if (!exited) return '—'
  const mins = Math.max(0, Math.round((new Date(exited).getTime() - new Date(entered).getTime()) / 60000))
  const h = Math.floor(mins / 60)
  return h > 0 ? `${h} ชม. ${mins % 60} นาที` : `${mins} นาที`
}
function todayValue() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

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

type EditForm = {
  id: string
  visit_date: string
  visitor_name: string
  group_name: string
  member_names: string
  party_size: string
  phone: string
  email: string
  org_type: OrgType
  org_name: string
  contact_dept: string
  entered_at: string
  exited_at: string
  activity_type: ActivityType
  activity_other: string
}

export function ItVisitorsClient({ initialLogs, initialSettings, canEdit, isAdmin }: Props) {
  const [logs, setLogs] = useState(initialLogs)
  const [settings, setSettings] = useState(initialSettings)
  const { toasts, add } = useToast()

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [insideOnly, setInsideOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [detail, setDetail] = useState<ItVisitorLogWithRefs | null>(null)
  const [form, setForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [qrOpen, setQrOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [rotateConfirm, setRotateConfirm] = useState(false)

  const publicUrl = settings ? `${typeof window === 'undefined' ? '' : window.location.origin}/v/${settings.public_token}` : ''

  const stats = useMemo(() => {
    const today = todayValue()
    const monthPrefix = today.slice(0, 7)
    const inside = logs.filter((l) => !l.exited_at).length
    const todayPeople = logs.filter((l) => l.visit_date === today).reduce((s, l) => s + l.party_size, 0)
    const monthPeople = logs.filter((l) => l.visit_date.startsWith(monthPrefix)).reduce((s, l) => s + l.party_size, 0)
    const declined = logs.filter((l) => l.safety_ack === 'declined').length
    return { inside, todayPeople, monthPeople, declined }
  }, [logs])

  const filtered = useMemo(() => prioritizeOpenVisitorLogs(logs.filter((l) => {
    if (from && l.visit_date < from) return false
    if (to && l.visit_date > to) return false
    if (typeFilter && l.visit_type !== typeFilter) return false
    if (deptFilter && l.contact_dept !== deptFilter) return false
    if (insideOnly && l.exited_at) return false
    if (search) {
      const q = search.toLowerCase()
      const hay = [l.visitor_name, l.group_name, l.org_name, l.phone, l.contact_dept]
        .filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })), [logs, from, to, typeFilter, deptFilter, insideOnly, search])

  const pagination = useMemo(() => paginateVisitorLogs(filtered, page), [filtered, page])

  useEffect(() => {
    setPage(1)
  }, [from, to, typeFilter, deptFilter, insideOnly, search])

  useEffect(() => {
    if (page > pagination.pageCount) setPage(pagination.pageCount)
  }, [page, pagination.pageCount])

  const deptOptions = useMemo(() => {
    const used = new Set(logs.map((l) => l.contact_dept))
    return [...DEPARTMENTS.filter((d) => used.has(d)), ...[...used].filter((d) => !DEPARTMENTS.includes(d as never))]
  }, [logs])

  async function refetch() {
    const res = await fetch('/api/admin/it-visitors')
    if (res.ok) { const j = await res.json(); setLogs(j.items ?? []) }
  }

  async function checkout(row: ItVisitorLogWithRefs) {
    const res = await fetch(`/api/admin/it-visitors/${row.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exited_at: new Date().toISOString() }),
    })
    if (res.ok) { add('บันทึกเวลาออกแล้ว'); await refetch() }
    else { const j = await res.json().catch(() => ({})); add(j.error ?? 'บันทึกไม่สำเร็จ', false) }
  }

  function openEdit(l: ItVisitorLogWithRefs) {
    setForm({
      id: l.id,
      visit_date: l.visit_date,
      visitor_name: l.visitor_name,
      group_name: l.group_name ?? '',
      member_names: l.member_names ?? '',
      party_size: String(l.party_size),
      phone: l.phone,
      email: l.email ?? '',
      org_type: l.org_type,
      org_name: l.org_name,
      contact_dept: l.contact_dept,
      entered_at: toLocalInput(l.entered_at),
      exited_at: toLocalInput(l.exited_at),
      activity_type: l.activity_type,
      activity_other: l.activity_other ?? '',
    })
  }

  async function save() {
    if (!form) return
    if (!form.visitor_name.trim()) { add('กรุณากรอกชื่อ', false); return }
    if (!form.phone.trim()) { add('กรุณากรอกเบอร์โทรศัพท์', false); return }
    setSaving(true)
    const payload = {
      visit_date: form.visit_date,
      visitor_name: form.visitor_name,
      group_name: form.group_name || null,
      member_names: form.member_names || null,
      party_size: Number(form.party_size) || 1,
      phone: form.phone,
      email: form.email || null,
      org_type: form.org_type,
      org_name: form.org_name,
      contact_dept: form.contact_dept,
      entered_at: new Date(form.entered_at).toISOString(),
      exited_at: form.exited_at ? new Date(form.exited_at).toISOString() : null,
      activity_type: form.activity_type,
      activity_other: form.activity_other || null,
    }
    const res = await fetch(`/api/admin/it-visitors/${form.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) { add('บันทึกการแก้ไขแล้ว'); setForm(null); await refetch() }
    else { const j = await res.json().catch(() => ({})); add(j.error ?? 'บันทึกไม่สำเร็จ', false) }
  }

  async function confirmDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/admin/it-visitors/${deleteId}`, { method: 'DELETE' })
    if (res.ok) { add('ลบแล้ว'); setDeleteId(null); await refetch() }
    else { const j = await res.json().catch(() => ({})); add(j.error ?? 'ลบไม่สำเร็จ', false) }
  }

  async function showQr() {
    if (!settings) { add('ยังไม่ได้ตั้งค่าฟอร์ม — กรุณารัน scripts/it-visitor-log.sql', false); return }
    const url = `${window.location.origin}/v/${settings.public_token}`
    const dataUrl = await QRCode.toDataURL(url, {
      width: 720, margin: 2, errorCorrectionLevel: 'M',
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
    setQrDataUrl(dataUrl)
    setQrOpen(true)
  }

  async function patchSettings(body: Record<string, unknown>, okMsg: string) {
    const res = await fetch('/api/admin/it-visitors/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (res.ok) {
      const next = await res.json()
      setSettings(next)
      setQrDataUrl('')
      add(okMsg)
      return next as Settings
    }
    const j = await res.json().catch(() => ({}))
    add(j.error ?? 'บันทึกไม่สำเร็จ', false)
    return null
  }

  function printRegister() {
    const html = buildVisitorRegisterHtml(filtered, { from, to })
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html; charset=utf-8' }))
    const win = window.open(blobUrl, '_blank')
    win?.addEventListener('load', () => { win.print(); URL.revokeObjectURL(blobUrl) }, { once: true })
  }

  return (
    <div>
      <PageHeader
        title="บันทึกการเข้า-ออก"
        subtitle="ทะเบียนผู้มาติดต่อและเยี่ยมชมห้องปฏิบัติการ · บันทึกผ่าน QR Code หน้าห้องปฏิบัติการ"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" icon="download" onClick={printRegister}>พิมพ์ทะเบียน</Button>
            <Button variant="primary" icon="globe" onClick={showQr}>ลิงก์ / QR Code</Button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
        <Stat label="กำลังอยู่ในพื้นที่" value={stats.inside} color={stats.inside > 0 ? 'amber' : 'green'} icon="users" />
        <Stat label="ผู้เข้าวันนี้ (คน)" value={stats.todayPeople} color="blue" icon="user" />
        <Stat label="ผู้เข้าเดือนนี้ (คน)" value={stats.monthPeople} color="purple" icon="chart" />
        <Stat label="ไม่ยินยอมนโยบาย" value={stats.declined} color={stats.declined > 0 ? 'red' : 'green'} icon="alert" />
      </div>

      {settings && !settings.is_open && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--warning)', background: 'rgba(217,119,6,.08)', color: 'var(--warning)', fontSize: 13, fontWeight: 600 }}>
          <Icon name="alert" size={16} /> ขณะนี้ปิดรับแบบฟอร์มสาธารณะ — ผู้มาติดต่อสแกน QR แล้วจะกรอกไม่ได้
        </div>
      )}

      {/* ── ตัวกรอง ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <label style={labelStyle}>ตั้งแต่วันที่</label>
          <input type="date" style={{ ...inputStyle, width: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>ถึงวันที่</label>
          <input type="date" style={{ ...inputStyle, width: 160 }} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>ประเภท</label>
          <Select value={typeFilter} onChange={setTypeFilter} placeholder="ทุกประเภท"
            options={[{ value: 'individual', label: VISIT_TYPE_LABEL.individual }, { value: 'group', label: VISIT_TYPE_LABEL.group }]} />
        </div>
        <div>
          <label style={labelStyle}>หน่วยงานที่ติดต่อ</label>
          <Select value={deptFilter} onChange={setDeptFilter} placeholder="ทุกหน่วยงาน"
            options={deptOptions.map((d) => ({ value: d, label: d }))} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={labelStyle}>ค้นหา</label>
          <input style={inputStyle} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ชื่อ / คณะ / หน่วยงาน / เบอร์โทร" />
        </div>
        <button onClick={() => setInsideOnly((v) => !v)} aria-pressed={insideOnly} style={{
          minHeight: 44, padding: '5px 16px', borderRadius: 20, border: '1px solid var(--border)',
          background: insideOnly ? 'var(--primary)' : 'transparent', color: insideOnly ? '#fff' : 'var(--ink)',
          fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
        }}>ยังอยู่ในพื้นที่</button>
      </div>

      <Card padding={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th style={thStyle}>วันที่ / เวลาเข้า</th>
                <th style={thStyle}>เวลาออก</th>
                <th style={thStyle}>ประเภท</th>
                <th style={thStyle}>ชื่อ</th>
                <th style={thStyle}>หน่วยงาน</th>
                <th style={thStyle}>ติดต่อ</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>จำนวน</th>
                <th style={thStyle}>กิจกรรม</th>
                <th style={thStyle}>สถานะ</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {pagination.items.map((l) => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--border)', transition: 'background .1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={tdStyle}>{fmtDateTime(l.entered_at)}</td>
                  <td style={tdStyle}>
                    {l.exited_at
                      ? <span>{fmtTime(l.exited_at)}<div style={{ fontSize: 11, color: 'var(--muted)' }}>{durationLabel(l.entered_at, l.exited_at)}</div></span>
                      : <Badge color="red" size="sm" dot>ยังอยู่ในพื้นที่</Badge>}
                  </td>
                  <td style={tdStyle}><Badge color={l.visit_type === 'group' ? 'purple' : 'blue'} size="sm">{VISIT_TYPE_LABEL[l.visit_type]}</Badge></td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{l.visitor_name}</div>
                    {l.group_name && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.group_name}</div>}
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 180 }}>
                    <div>{l.org_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{ORG_TYPE_LABEL[l.org_type]}</div>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--muted)', maxWidth: 160 }}>{l.contact_dept}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>{l.party_size}</td>
                  <td style={{ ...tdStyle, color: 'var(--muted)', maxWidth: 170 }}>
                    {l.activity_type === 'other' && l.activity_other ? l.activity_other : ACTIVITY_LABEL[l.activity_type]}
                  </td>
                  <td style={tdStyle}>
                    {/* ทุกธงมีข้อความกำกับ ไม่สื่อความหมายด้วยสีอย่างเดียว */}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {l.safety_ack === 'declined' && <Badge color="red" size="sm">ไม่ยินยอมนโยบาย</Badge>}
                      {l.badge_exchanged === 'no' && <Badge color="amber" size="sm">ไม่แลกบัตร</Badge>}
                      {l.appointment === 'walk_in' && <Badge color="gray" size="sm">ไม่ได้นัด</Badge>}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setDetail(l)} title="รายละเอียด" style={iconBtn}><Icon name="eye" size={15} /></button>
                    {canEdit && !l.exited_at && (
                      <button onClick={() => checkout(l)} title="บันทึกเวลาออก" style={{ ...iconBtn, color: 'var(--success)' }}><Icon name="check" size={15} /></button>
                    )}
                    {canEdit && <button onClick={() => openEdit(l)} title="แก้ไข" style={iconBtn}><Icon name="edit" size={15} /></button>}
                    {isAdmin && <button onClick={() => setDeleteId(l.id)} title="ลบ" style={{ ...iconBtn, color: 'var(--danger)' }}><Icon name="trash" size={15} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <EmptyState title="ไม่มีบันทึกการเข้า-ออก" hint="ผู้มาติดต่อบันทึกเองผ่าน QR Code หน้าห้องปฏิบัติการ" icon="users" />}
      </Card>

      {pagination.total > 0 && (
        <nav aria-label="การแบ่งหน้าบันทึกการเข้า-ออก" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 12 }}>
          <span aria-live="polite" aria-atomic="true">แสดง {pagination.from}–{pagination.to} จาก {pagination.total} รายการ</span>
          {pagination.pageCount > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button
                variant="secondary"
                size="sm"
                icon="arrowLeft"
                title="ไปหน้าก่อนหน้า"
                onClick={() => setPage(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >ก่อนหน้า</Button>
              <span style={{ minWidth: 76, textAlign: 'center', color: 'var(--ink)', fontWeight: 700 }}>
                หน้า {pagination.page} / {pagination.pageCount}
              </span>
              <Button
                variant="secondary"
                size="sm"
                iconRight="arrowRight"
                title="ไปหน้าถัดไป"
                onClick={() => setPage(pagination.page + 1)}
                disabled={pagination.page >= pagination.pageCount}
              >ถัดไป</Button>
            </div>
          )}
        </nav>
      )}

      {filtered.length !== logs.length && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>กรองแล้วเหลือ {filtered.length} จาก {logs.length} รายการ</div>
      )}

      {/* ── รายละเอียด ── */}
      {detail && (
        <Modal title="รายละเอียดการเข้า-ออก" maxWidth={760} onClose={() => setDetail(null)}>
          <div style={{ display: 'grid', gap: 20 }}>
            <section
              aria-labelledby="visitor-detail-summary"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
                padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div style={{ width: 44, height: 44, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 12, color: 'var(--primary)', background: 'var(--primary-soft)' }}>
                  <Icon name={detail.visit_type === 'group' ? 'users' : 'user'} size={22} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 id="visitor-detail-summary" style={{ margin: 0, color: 'var(--ink)', fontSize: 16, fontWeight: 800, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
                    {detail.visit_type === 'group' && detail.group_name ? detail.group_name : detail.visitor_name}
                  </h3>
                  <div style={{ marginTop: 4, color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                    {detail.visit_type === 'group' ? `หัวหน้าคณะ: ${detail.visitor_name}` : VISIT_TYPE_LABEL[detail.visit_type]} · {detail.party_size} คน · {detail.org_name}
                  </div>
                </div>
              </div>
              <Badge color={detail.exited_at ? 'green' : 'amber'} dot style={{ flex: '0 0 auto' }}>
                {detail.exited_at ? 'ออกจากพื้นที่แล้ว' : 'ยังอยู่ในพื้นที่'}
              </Badge>
            </section>

            <section aria-labelledby="visitor-detail-status" style={{ display: 'grid', gap: 10 }}>
              <DetailSectionHeading id="visitor-detail-status" title="สถานะการเข้า-ออก" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                <div style={{ padding: 14, border: '1px solid var(--border)', borderLeft: '3px solid var(--primary)', borderRadius: 10, background: 'var(--card)' }}>
                  <div style={detailTimeLabelStyle}><Icon name="arrowRight" size={14} /> เวลาเข้า</div>
                  <div style={detailTimeValueStyle}>{fmtDateTime(detail.entered_at)}</div>
                </div>
                <div style={{ padding: 14, border: '1px solid var(--border)', borderLeft: `3px solid ${detail.exited_at ? 'var(--success)' : 'var(--warning)'}`, borderRadius: 10, background: 'var(--card)' }}>
                  <div style={detailTimeLabelStyle}><Icon name="arrowLeft" size={14} /> เวลาออก</div>
                  <div style={{ ...detailTimeValueStyle, color: detail.exited_at ? 'var(--ink)' : 'var(--warning)' }}>
                    {detail.exited_at ? fmtDateTime(detail.exited_at) : 'ยังอยู่ในพื้นที่'}
                  </div>
                  {detail.exited_at && <div style={{ marginTop: 4, color: 'var(--muted)', fontSize: 12 }}>ใช้เวลา {durationLabel(detail.entered_at, detail.exited_at)}</div>}
                </div>
              </div>
            </section>

            <section aria-labelledby="visitor-detail-contact" style={{ display: 'grid', gap: 10 }}>
              <DetailSectionHeading id="visitor-detail-contact" title="ข้อมูลผู้มาติดต่อ" />
              <dl style={detailGridStyle}>
                <DetailField label="ประเภท" value={VISIT_TYPE_LABEL[detail.visit_type]} />
                {detail.group_name && <DetailField label="ชื่อคณะ" value={detail.group_name} />}
                <DetailField label={detail.visit_type === 'group' ? 'หัวหน้าคณะ' : 'ชื่อ-สกุล'} value={detail.visitor_name} />
                <DetailField label="จำนวนคน" value={`${detail.party_size} คน`} />
                <DetailField label="เบอร์โทร" value={detail.phone} />
                <DetailField label="อีเมล" value={detail.email || 'ไม่ระบุ'} />
                <DetailField label="ประเภทหน่วยงาน" value={ORG_TYPE_LABEL[detail.org_type]} />
                <DetailField label="หน่วยงาน/บริษัท" value={detail.org_name} />
                <DetailField label="ติดต่อหน่วยงาน" value={detail.contact_dept} />
              </dl>
            </section>

            <section aria-labelledby="visitor-detail-visit" style={{ display: 'grid', gap: 10 }}>
              <DetailSectionHeading id="visitor-detail-visit" title="รายละเอียดการเข้าพื้นที่" />
              <dl style={detailGridStyle}>
                <DetailField label="กิจกรรม" value={detail.activity_type === 'other' && detail.activity_other ? detail.activity_other : ACTIVITY_LABEL[detail.activity_type]} wide />
                <DetailField label="นัดหมายล่วงหน้า">
                  <Badge color={detail.appointment === 'booked' ? 'blue' : 'gray'}>{APPOINTMENT_LABEL[detail.appointment]}</Badge>
                </DetailField>
                <DetailField label="แลกบัตร">
                  <Badge color={detail.badge_exchanged === 'yes' ? 'green' : 'gray'}>{BADGE_LABEL[detail.badge_exchanged]}</Badge>
                </DetailField>
                <DetailField label="นโยบายความปลอดภัย">
                  <Badge color={detail.safety_ack === 'acknowledged' ? 'green' : 'red'}>{SAFETY_LABEL[detail.safety_ack]}</Badge>
                </DetailField>
              </dl>
            </section>

            {detail.member_names && (
              <section aria-labelledby="visitor-detail-members" style={{ display: 'grid', gap: 10 }}>
                <DetailSectionHeading id="visitor-detail-members" title="รายชื่อผู้มา" />
                <div style={{ padding: 12, borderRadius: 8, background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.7, overflowWrap: 'anywhere' }}>{detail.member_names}</div>
              </section>
            )}

            {detail.exited_at && (
              <section aria-labelledby="visitor-detail-audit" style={{ display: 'grid', gap: 10 }}>
                <DetailSectionHeading id="visitor-detail-audit" title="การบันทึกเวลาออก" />
                <dl style={detailGridStyle}>
                  <DetailField label="วิธีบันทึกเวลาออก" value={checkoutMethodLabel(detail.checkout_method)} />
                  {detail.closer?.name && <DetailField label="ผู้บันทึกเวลาออก" value={detail.closer.name} />}
                </dl>
              </section>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 2 }}>
              <Button variant="secondary" onClick={() => setDetail(null)}>ปิด</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── แก้ไข ── */}
      {form && (
        <Modal title="แก้ไขบันทึกการเข้า-ออก" onClose={() => setForm(null)}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={labelStyle}>วันที่</label>
                <input type="date" style={inputStyle} value={form.visit_date} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} /></div>
              <div><label style={labelStyle}>จำนวนคน</label>
                <input type="number" min={1} style={inputStyle} value={form.party_size} onChange={(e) => setForm({ ...form, party_size: e.target.value })} /></div>
            </div>
            <div><label style={labelStyle}>ชื่อ-สกุล *</label>
              <input style={inputStyle} value={form.visitor_name} onChange={(e) => setForm({ ...form, visitor_name: e.target.value })} /></div>
            <div><label style={labelStyle}>ชื่อคณะ / กลุ่ม</label>
              <input style={inputStyle} value={form.group_name} onChange={(e) => setForm({ ...form, group_name: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={labelStyle}>เบอร์โทร *</label>
                <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label style={labelStyle}>อีเมล</label>
                <input style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={labelStyle}>ประเภทหน่วยงาน</label>
                <select style={inputStyle} value={form.org_type} onChange={(e) => setForm({ ...form, org_type: e.target.value as OrgType })}>
                  {ORG_TYPES.map((v) => <option key={v} value={v}>{ORG_TYPE_LABEL[v]}</option>)}
                </select></div>
              <div><label style={labelStyle}>หน่วยงาน/บริษัท</label>
                <input style={inputStyle} value={form.org_name} onChange={(e) => setForm({ ...form, org_name: e.target.value })} /></div>
            </div>
            <div><label style={labelStyle}>หน่วยงานที่ติดต่อ</label>
              <input style={inputStyle} value={form.contact_dept} onChange={(e) => setForm({ ...form, contact_dept: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={labelStyle}>เวลาเข้า</label>
                <input type="datetime-local" style={inputStyle} value={form.entered_at} onChange={(e) => setForm({ ...form, entered_at: e.target.value })} /></div>
              <div><label style={labelStyle}>เวลาออก (เว้นว่าง = ยังอยู่)</label>
                <input type="datetime-local" style={inputStyle} value={form.exited_at} onChange={(e) => setForm({ ...form, exited_at: e.target.value })} /></div>
            </div>
            <div><label style={labelStyle}>ประเภทกิจกรรม</label>
              <select style={inputStyle} value={form.activity_type} onChange={(e) => setForm({ ...form, activity_type: e.target.value as ActivityType })}>
                {ACTIVITY_TYPES.map((v) => <option key={v} value={v}>{ACTIVITY_LABEL[v]}</option>)}
              </select></div>
            {form.activity_type === 'other' && (
              <div><label style={labelStyle}>ระบุกิจกรรม</label>
                <input style={inputStyle} value={form.activity_other} onChange={(e) => setForm({ ...form, activity_other: e.target.value })} /></div>
            )}
            <div><label style={labelStyle}>รายชื่อผู้มา</label>
              <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={form.member_names} onChange={(e) => setForm({ ...form, member_names: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <Button variant="secondary" onClick={() => setForm(null)}>ยกเลิก</Button>
            <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</Button>
          </div>
        </Modal>
      )}

      {/* ── QR / ลิงก์ ── */}
      {qrOpen && settings && (
        <Modal title="ลิงก์และ QR Code แบบฟอร์มสาธารณะ" onClose={() => setQrOpen(false)}>
          <div style={{ textAlign: 'center' }}>
            {qrDataUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={qrDataUrl} alt="QR Code แบบฟอร์มบันทึกการเข้า-ออก" style={{ width: 240, height: 240, background: '#fff', borderRadius: 12, padding: 8, border: '1px solid var(--border)' }} />
              : <Button variant="secondary" onClick={showQr}>สร้าง QR Code ใหม่</Button>}
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>ลิงก์สาธารณะ</label>
            <code style={{ display: 'block', padding: 10, borderRadius: 8, background: 'var(--surface-2)', fontSize: 12, wordBreak: 'break-all', color: 'var(--ink)' }}>{publicUrl}</code>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {qrDataUrl && (
              <a href={qrDataUrl} download="visitor-log-qr.png" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                <Icon name="download" size={15} /> ดาวน์โหลด PNG
              </a>
            )}
            <Button variant="secondary" icon="doc" onClick={() => { navigator.clipboard.writeText(publicUrl); add('คัดลอกลิงก์แล้ว') }}>คัดลอกลิงก์</Button>
          </div>
          {isAdmin && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'grid', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.is_open}
                  onChange={(e) => patchSettings({ is_open: e.target.checked }, e.target.checked ? 'เปิดรับแบบฟอร์มแล้ว' : 'ปิดรับแบบฟอร์มแล้ว')} />
                เปิดรับการบันทึกผ่านแบบฟอร์มสาธารณะ
              </label>
              {rotateConfirm ? (
                <div style={{ padding: 12, borderRadius: 8, border: '1px solid var(--danger)', background: 'rgba(220,38,38,.06)' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--danger)', fontWeight: 600, marginBottom: 10 }}>
                    เปลี่ยนลิงก์แล้ว QR Code ที่พิมพ์แจกไปทั้งหมดจะใช้ไม่ได้ทันที ต้องพิมพ์ใหม่ติดแทน
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="secondary" onClick={() => setRotateConfirm(false)}>ยกเลิก</Button>
                    <Button variant="danger" onClick={async () => { setRotateConfirm(false); await patchSettings({ rotateToken: true }, 'เปลี่ยนลิงก์แล้ว — กรุณาพิมพ์ QR ใหม่') }}>ยืนยันเปลี่ยนลิงก์</Button>
                  </div>
                </div>
              ) : (
                <Button variant="secondary" onClick={() => setRotateConfirm(true)}>เปลี่ยนลิงก์ / QR Code</Button>
              )}
            </div>
          )}
        </Modal>
      )}

      {deleteId && (
        <Modal title="ยืนยันการลบ" onClose={() => setDeleteId(null)}>
          <p style={{ fontSize: 13.5, margin: 0 }}>ต้องการลบบันทึกการเข้า-ออกนี้ใช่หรือไม่? บันทึกนี้เป็นหลักฐานตาม ISO การลบไม่สามารถย้อนกลับได้</p>
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

const detailGridStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px 18px', margin: 0,
}

const detailTimeLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 11.5, fontWeight: 700,
}

const detailTimeValueStyle: React.CSSProperties = {
  marginTop: 8, color: 'var(--ink)', fontSize: 14, fontWeight: 700, lineHeight: 1.45,
}

function DetailSectionHeading({ id, title }: { id: string; title: string }) {
  return <h3 id={id} style={{ margin: 0, paddingBottom: 8, borderBottom: '1px solid var(--border)', color: 'var(--ink)', fontSize: 12.5, fontWeight: 800 }}>{title}</h3>
}

function DetailField({ label, value, children, wide = false }: { label: string; value?: React.ReactNode; children?: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ minWidth: 0, gridColumn: wide ? '1 / -1' : undefined }}>
      <dt style={{ marginBottom: 4, color: 'var(--muted)', fontSize: 11.5, fontWeight: 700 }}>{label}</dt>
      <dd style={{ margin: 0, color: 'var(--ink)', fontSize: 13.5, lineHeight: 1.55, overflowWrap: 'anywhere' }}>{children ?? value ?? 'ไม่ระบุ'}</dd>
    </div>
  )
}

function Modal({ title, onClose, children, maxWidth = 620 }: { title: string; onClose: () => void; children: React.ReactNode; maxWidth?: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div role="dialog" aria-modal="true" aria-label={title} style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{title}</h2>
          <button type="button" aria-label="ปิดหน้าต่าง" title="ปิด" onClick={onClose} style={{ border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', width: 32, height: 32, borderRadius: 7, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}
