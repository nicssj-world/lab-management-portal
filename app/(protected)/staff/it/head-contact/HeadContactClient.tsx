'use client'

import QRCode from 'qrcode'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { addLogoToQrDataUrl } from '@/lib/qr-logo'
import {
  HEAD_CONTACT_CATEGORIES,
  HEAD_CONTACT_CATEGORY_LABEL,
  HEAD_CONTACT_STATUSES,
  HEAD_CONTACT_STATUS_LABEL,
  headContactReference,
} from '@/lib/head-contact/constants'
import type { HeadContactCategory, HeadContactStatus } from '@/lib/head-contact/constants'
import type { HeadContactSummary } from '@/lib/head-contact/admin-server'
import type {
  HeadContactFormSettings,
  HeadContactServiceUnit,
  HeadContactSubmission,
} from '@/lib/head-contact/types'

type Props = {
  initialRows: HeadContactSubmission[]
  initialTotal: number
  initialSummary: HeadContactSummary
  initialSettings: HeadContactFormSettings | null
  initialUnits: HeadContactServiceUnit[]
  isAdmin: boolean
}

type Filters = { search: string; status: string; category: string; unitId: string; from: string; to: string }
const EMPTY_FILTERS: Filters = { search: '', status: '', category: '', unitId: '', from: '', to: '' }

export function HeadContactClient({ initialRows, initialTotal, initialSummary, initialSettings, initialUnits, isAdmin }: Props) {
  const [rows, setRows] = useState(initialRows)
  const [total, setTotal] = useState(initialTotal)
  const [summary, setSummary] = useState(initialSummary)
  const [settings, setSettings] = useState(initialSettings)
  const [units, setUnits] = useState(initialUnits)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<HeadContactSubmission | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [qrData, setQrData] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null)

  const pageCount = Math.max(1, Math.ceil(total / 50))
  const activeUnits = useMemo(() => units.filter((unit) => unit.is_active), [units])

  function notify(message: string, ok = true) {
    setToast({ message, ok })
    window.setTimeout(() => setToast(null), 3500)
  }

  async function load(nextPage = page, nextFilters = filters) {
    setLoading(true)
    const params = new URLSearchParams({ page: String(nextPage), pageSize: '50' })
    Object.entries(nextFilters).forEach(([key, value]) => value && params.set(key, value))
    try {
      const response = await fetch(`/api/admin/head-contact?${params}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'โหลดข้อมูลไม่สำเร็จ')
      setRows(result.rows)
      setTotal(result.total)
      setSummary(result.summary)
      setPage(result.page)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ', false)
    } finally { setLoading(false) }
  }

  async function saveCase() {
    if (!selected) return
    const response = await fetch(`/api/admin/head-contact/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: selected.status,
        action_note: selected.action_note,
        contacted_at: selected.contacted_at,
        contact_note: selected.contact_note,
      }),
    })
    const result = await response.json()
    if (!response.ok) return notify(result.error ?? 'บันทึกไม่สำเร็จ', false)
    setSelected(result)
    setRows((current) => current.map((row) => row.id === result.id ? result : row))
    notify('บันทึกผลการดำเนินการแล้ว')
    await load()
  }

  async function deleteCase() {
    if (!selected) return
    const response = await fetch(`/api/admin/head-contact/${selected.id}`, { method: 'DELETE' })
    const result = await response.json()
    if (!response.ok) return notify(result.error ?? 'ลบไม่สำเร็จ', false)
    setSelected(null); setDeleteConfirm(false); notify('ลบรายการแล้ว'); await load()
  }

  async function openSettings() {
    setSettingsOpen(true)
    if (settings) await makeQr(settings.public_token)
  }

  async function makeQr(token: string) {
    const url = `${window.location.origin}/h/${token}`
    setQrData(await addLogoToQrDataUrl(await QRCode.toDataURL(url, { width: 720, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#123F3D', light: '#FFFFFF' } })))
  }

  async function patchSettings(body: { is_open?: boolean; rotateToken?: true }) {
    const response = await fetch('/api/admin/head-contact/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const result = await response.json()
    if (!response.ok) return notify(result.error ?? 'บันทึกการตั้งค่าไม่สำเร็จ', false)
    setSettings(result)
    await makeQr(result.public_token)
    notify(body.rotateToken ? 'เปลี่ยนลิงก์แล้ว กรุณาพิมพ์ QR ใหม่' : 'บันทึกการตั้งค่าแล้ว')
  }

  async function refreshUnits() {
    const response = await fetch('/api/admin/head-contact/units')
    const result = await response.json()
    if (response.ok) setUnits(result)
  }

  async function addUnit(name: string) {
    const response = await fetch('/api/admin/head-contact/units', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    })
    const result = await response.json()
    if (!response.ok) return notify(result.error ?? 'เพิ่มหน่วยไม่สำเร็จ', false)
    await refreshUnits(); notify('เพิ่มหน่วยรับบริการแล้ว')
  }

  async function updateUnit(id: string, patch: Partial<Pick<HeadContactServiceUnit, 'name' | 'display_order' | 'is_active'>>) {
    const response = await fetch(`/api/admin/head-contact/units/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    })
    const result = await response.json()
    if (!response.ok) return notify(result.error ?? 'แก้ไขหน่วยไม่สำเร็จ', false)
    setUnits((current) => current.map((unit) => unit.id === id ? result : unit).toSorted((a, b) => a.display_order - b.display_order))
    notify('บันทึกหน่วยรับบริการแล้ว')
  }

  return (
    <div className="hca-page">
      <style>{CSS}</style>
      <PageHeader
        eyebrow="PRIVATE COMMUNICATION"
        title="สื่อสารถึงหัวหน้า"
        subtitle="ข้อเสนอแนะ ข้อร้องเรียน และคำชื่นชมจากผู้รับบริการ"
        actions={<Button variant="primary" icon="qr" onClick={openSettings}>ลิงก์ / QR และตั้งค่า</Button>}
      />

      {!settings?.is_open && <div className="hca-closed"><Icon name="alert" size={16} /> ขณะนี้ปิดรับเรื่องผ่านฟอร์มสาธารณะ</div>}

      <div className="hca-metrics">
        <Metric label="เรื่องใหม่" value={summary.new} tone="#B45309" icon="inbox" />
        <Metric label="กำลังดำเนินการ" value={summary.in_progress} tone="#0369A1" icon="clock" />
        <Metric label="ปิดเรื่อง" value={summary.closed} tone="#15803D" icon="check" />
        <Metric label="รอติดต่อกลับ" value={summary.awaiting_reply} tone="#B91C1C" icon="phone" />
      </div>

      <form className="hca-filters" onSubmit={(event) => { event.preventDefault(); load(1) }}>
        <label><span>ค้นหา</span><input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="ชื่อ ช่องทางติดต่อ รายละเอียด…" /></label>
        <label><span>สถานะ</span><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">ทั้งหมด</option>{HEAD_CONTACT_STATUSES.map((status) => <option key={status} value={status}>{HEAD_CONTACT_STATUS_LABEL[status]}</option>)}</select></label>
        <label><span>ประเภท</span><select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">ทั้งหมด</option>{HEAD_CONTACT_CATEGORIES.map((category) => <option key={category} value={category}>{HEAD_CONTACT_CATEGORY_LABEL[category]}</option>)}</select></label>
        <label><span>หน่วยรับบริการ</span><select value={filters.unitId} onChange={(e) => setFilters({ ...filters, unitId: e.target.value })}><option value="">ทั้งหมด</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}<option value="other">อื่น ๆ</option></select></label>
        <label><span>จากวันที่</span><input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label>
        <label><span>ถึงวันที่</span><input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label>
        <div className="hca-filter-actions"><Button type="submit" icon="search" disabled={loading}>ค้นหา</Button><Button variant="ghost" onClick={() => { setFilters(EMPTY_FILTERS); load(1, EMPTY_FILTERS) }}>ล้าง</Button></div>
      </form>

      <div className={`hca-table-card ${loading ? 'loading' : ''}`}>
        <div className="hca-table-scroll"><table><thead><tr><th>รับเมื่อ</th><th>เลขอ้างอิง</th><th>ประเภท</th><th>หน่วยรับบริการ</th><th>ผู้ให้ข้อมูล</th><th>สถานะ</th><th>ติดต่อกลับ</th><th></th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}><td>{formatDateTime(row.created_at)}</td><td className="mono">{headContactReference(row.id)}</td><td><CategoryBadge value={row.category} /></td><td>{row.service_unit_snapshot}</td><td>{row.sender_name || 'ไม่ระบุ'}</td><td><StatusBadge value={row.status} /></td><td>{row.wants_reply ? row.contacted_at ? 'ติดต่อแล้ว' : <span className="danger">รอติดต่อ</span> : 'ไม่ต้องการ'}</td><td><button className="hca-open" onClick={() => setSelected({ ...row })} aria-label={`เปิด ${headContactReference(row.id)}`}><Icon name="eye" size={16} /></button></td></tr>)}</tbody>
        </table></div>
        {rows.length === 0 && <EmptyState title="ไม่พบเรื่องที่ส่งเข้ามา" hint="ลองเปลี่ยนตัวกรอง หรือรอการส่งผ่าน QR Code" icon="mail" />}
        <div className="hca-pagination"><span>ทั้งหมด {total.toLocaleString('th-TH')} รายการ · หน้า {page}/{pageCount}</span><div><Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>ก่อนหน้า</Button><Button size="sm" variant="secondary" disabled={page >= pageCount || loading} onClick={() => load(page + 1)}>ถัดไป</Button></div></div>
      </div>

      {selected && <Modal title={`${headContactReference(selected.id)} · ${HEAD_CONTACT_CATEGORY_LABEL[selected.category]}`} onClose={() => setSelected(null)}>
        <div className="hca-case-meta"><div><span>รับเมื่อ</span><strong>{formatDateTime(selected.created_at)}</strong></div><div><span>หน่วยรับบริการ</span><strong>{selected.service_unit_snapshot}</strong></div><div><span>ผู้ให้ข้อมูล</span><strong>{selected.sender_name || 'ไม่ระบุ'}</strong></div><div><span>ช่องทางติดต่อ</span><strong>{selected.contact_channel || 'ไม่ระบุ'}</strong></div></div>
        <div className="hca-message"><span>รายละเอียด</span><p>{selected.detail}</p></div>
        <div className="hca-edit-grid"><label><span>สถานะ</span><select value={selected.status} onChange={(e) => setSelected({ ...selected, status: e.target.value as HeadContactStatus })}>{HEAD_CONTACT_STATUSES.map((status) => <option key={status} value={status}>{HEAD_CONTACT_STATUS_LABEL[status]}</option>)}</select></label><label className="wide"><span>ผลการดำเนินการภายใน</span><textarea rows={4} value={selected.action_note ?? ''} onChange={(e) => setSelected({ ...selected, action_note: e.target.value || null })} /></label></div>
        {selected.wants_reply && <div className="hca-contact-box"><div><strong>การติดต่อกลับ</strong><Button size="sm" variant="soft" onClick={() => setSelected({ ...selected, contacted_at: new Date().toISOString() })}>บันทึกว่าติดต่อแล้วตอนนี้</Button></div><label><span>วันและเวลาที่ติดต่อ</span><input type="datetime-local" value={toLocalDateTime(selected.contacted_at)} onChange={(e) => setSelected({ ...selected, contacted_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label><label><span>ผลการติดต่อ</span><textarea rows={3} value={selected.contact_note ?? ''} onChange={(e) => setSelected({ ...selected, contact_note: e.target.value || null })} /></label></div>}
        <div className="hca-modal-actions">{isAdmin && <Button variant="danger" onClick={() => setDeleteConfirm(true)}>ลบรายการ</Button>}<span /><Button variant="secondary" onClick={() => setSelected(null)}>ยกเลิก</Button><Button onClick={saveCase}>บันทึก</Button></div>
      </Modal>}

      {settingsOpen && <SettingsModal settings={settings} units={units} activeUnits={activeUnits} qrData={qrData} onClose={() => setSettingsOpen(false)} onPatchSettings={patchSettings} onAddUnit={addUnit} onUpdateUnit={updateUnit} />}
      {deleteConfirm && <Modal title="ยืนยันการลบ" onClose={() => setDeleteConfirm(false)}><p>รายการนี้จะถูกลบถาวรและไม่สามารถย้อนกลับได้</p><div className="hca-modal-actions"><span /><Button variant="secondary" onClick={() => setDeleteConfirm(false)}>ยกเลิก</Button><Button variant="danger" onClick={deleteCase}>ยืนยันลบ</Button></div></Modal>}
      {toast && <div className={`hca-toast ${toast.ok ? '' : 'error'}`} role="status">{toast.message}</div>}
    </div>
  )
}

function SettingsModal({ settings, units, activeUnits, qrData, onClose, onPatchSettings, onAddUnit, onUpdateUnit }: {
  settings: HeadContactFormSettings | null; units: HeadContactServiceUnit[]; activeUnits: HeadContactServiceUnit[]; qrData: string; onClose: () => void
  onPatchSettings: (body: { is_open?: boolean; rotateToken?: true }) => Promise<void>
  onAddUnit: (name: string) => Promise<void>
  onUpdateUnit: (id: string, patch: Partial<Pick<HeadContactServiceUnit, 'name' | 'display_order' | 'is_active'>>) => Promise<void>
}) {
  const [newUnit, setNewUnit] = useState('')
  const [drafts, setDrafts] = useState<Record<string, { name: string; display_order: number }>>(() => Object.fromEntries(units.map((unit) => [unit.id, { name: unit.name, display_order: unit.display_order }])))
  const url = settings && typeof window !== 'undefined' ? `${window.location.origin}/h/${settings.public_token}` : ''
  return <Modal title="ลิงก์ QR และตั้งค่าฟอร์ม" onClose={onClose} wide>
    {!settings ? <div role="alert">ยังไม่ได้ตั้งค่าฟอร์ม กรุณารัน migration ก่อน</div> : <>
      <div className="hca-settings-top"><div className="hca-qr">{qrData && <img src={qrData} alt="QR Code ฟอร์มสื่อสารถึงหัวหน้า" />}</div><div className="hca-link"><span>ลิงก์แบบฟอร์มสาธารณะ</span><input readOnly value={url} /><div><Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(url)}>คัดลอกลิงก์</Button>{qrData && <a href={qrData} download="head-contact-qr.png">ดาวน์โหลด PNG</a>}</div><label className="hca-switch"><input type="checkbox" checked={settings.is_open} onChange={(e) => onPatchSettings({ is_open: e.target.checked })} /> เปิดรับเรื่อง</label><Button size="sm" variant="danger" onClick={() => { if (window.confirm('QR เดิมจะใช้งานไม่ได้ทันที ต้องการเปลี่ยนลิงก์หรือไม่?')) onPatchSettings({ rotateToken: true }) }}>เปลี่ยนลิงก์ / QR</Button></div></div>
      <div className="hca-units-head"><div><strong>หน่วยรับบริการ</strong><small>เปิดใช้งาน {activeUnits.length} จาก {units.length} หน่วย</small></div><form onSubmit={async (event) => { event.preventDefault(); if (!newUnit.trim()) return; await onAddUnit(newUnit); setNewUnit('') }}><input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="ชื่อหน่วยใหม่" /><Button type="submit" size="sm" icon="plus">เพิ่ม</Button></form></div>
      <div className="hca-units">{units.map((unit) => { const draft = drafts[unit.id] ?? { name: unit.name, display_order: unit.display_order }; return <div key={unit.id} className={!unit.is_active ? 'inactive' : ''}><input aria-label={`ชื่อ ${unit.name}`} value={draft.name} onChange={(e) => setDrafts({ ...drafts, [unit.id]: { ...draft, name: e.target.value } })} /><input aria-label={`ลำดับ ${unit.name}`} type="number" min={0} max={10000} value={draft.display_order} onChange={(e) => setDrafts({ ...drafts, [unit.id]: { ...draft, display_order: Number(e.target.value) } })} /><Button size="sm" variant="secondary" onClick={() => onUpdateUnit(unit.id, draft)}>บันทึก</Button><Button size="sm" variant={unit.is_active ? 'ghost' : 'soft'} onClick={() => onUpdateUnit(unit.id, { is_active: !unit.is_active })}>{unit.is_active ? 'ปิดใช้' : 'เปิดใช้'}</Button></div> })}</div>
    </>}
  </Modal>
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return <div className="hca-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><section className="hca-modal" style={{ maxWidth: wide ? 880 : 700 }} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button onClick={onClose} aria-label="ปิด"><Icon name="x" size={19} /></button></header><div className="hca-modal-body">{children}</div></section></div>
}

function Metric({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: string }) { return <div className="hca-metric"><span style={{ background: `${tone}18`, color: tone }}><Icon name={icon} size={18} /></span><div><strong>{value.toLocaleString('th-TH')}</strong><small>{label}</small></div></div> }
function StatusBadge({ value }: { value: HeadContactStatus }) { const tone = value === 'new' ? '#B45309' : value === 'in_progress' ? '#0369A1' : '#15803D'; return <span className="hca-badge" style={{ background: `${tone}15`, color: tone }}>{HEAD_CONTACT_STATUS_LABEL[value]}</span> }
function CategoryBadge({ value }: { value: HeadContactCategory }) { const tone = value === 'complaint' ? '#B91C1C' : value === 'compliment' ? '#15803D' : '#0369A1'; return <span className="hca-badge" style={{ background: `${tone}15`, color: tone }}>{HEAD_CONTACT_CATEGORY_LABEL[value]}</span> }
function formatDateTime(value: string) { return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) }
function toLocalDateTime(value: string | null) { if (!value) return ''; const d = new Date(value); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16) }

const CSS = `
  .hca-page{width:100%;min-width:0}.hca-closed{display:flex;align-items:center;gap:8px;margin:-6px 0 16px;padding:11px 14px;border-radius:10px;background:#FFF7ED;color:#9A3412;border:1px solid #FED7AA;font-size:13px}
  .hca-metrics{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:12px;margin-bottom:16px}.hca-metric{display:flex;align-items:center;gap:12px;padding:16px;background:var(--card);border:1px solid var(--border);border-radius:13px}.hca-metric>span{width:38px;height:38px;border-radius:10px;display:grid;place-items:center}.hca-metric div{display:grid}.hca-metric strong{font-size:22px;color:var(--ink)}.hca-metric small{color:var(--muted);font-size:11px}
  .hca-filters{display:grid;grid-template-columns:minmax(210px,1.4fr) repeat(3,minmax(130px,1fr)) 140px 140px auto;gap:9px;align-items:end;padding:14px;background:var(--card);border:1px solid var(--border);border-radius:13px;margin-bottom:12px}.hca-filters label,.hca-edit-grid label,.hca-contact-box label{display:grid;gap:5px}.hca-filters label>span,.hca-edit-grid label>span,.hca-contact-box label>span{font-size:10px;font-weight:700;color:var(--muted)}.hca-filters input,.hca-filters select,.hca-edit-grid input,.hca-edit-grid select,.hca-edit-grid textarea,.hca-contact-box input,.hca-contact-box textarea,.hca-link input,.hca-units input,.hca-units-head input{border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--ink);padding:8px 10px;font:inherit;font-size:12px;min-width:0}.hca-filter-actions{display:flex;gap:4px}
  .hca-table-card{background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden;transition:opacity .15s}.hca-table-card.loading{opacity:.55}.hca-table-scroll{overflow-x:auto}.hca-table{width:100%}.hca-table-card table{width:100%;border-collapse:collapse;min-width:1050px}.hca-table-card th{padding:11px 12px;text-align:left;background:var(--surface-2);font-size:10px;color:var(--muted);white-space:nowrap}.hca-table-card td{padding:12px;border-top:1px solid var(--border);font-size:12px;color:var(--ink);vertical-align:middle}.hca-table-card tr:hover td{background:color-mix(in srgb,var(--primary) 3%,transparent)}.mono{font-family:monospace;font-weight:700}.danger{color:var(--danger);font-weight:700}.hca-badge{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:700;white-space:nowrap}.hca-open{width:30px;height:30px;border:1px solid var(--border);border-radius:7px;background:var(--card);color:var(--primary);cursor:pointer;display:grid;place-items:center}.hca-pagination{display:flex;justify-content:space-between;align-items:center;padding:11px 14px;border-top:1px solid var(--border);font-size:11px;color:var(--muted)}.hca-pagination>div{display:flex;gap:6px}
  .hca-modal-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.48);display:grid;place-items:center;padding:18px;backdrop-filter:blur(3px)}.hca-modal{width:min(100%,700px);max-height:92vh;background:var(--card);border:1px solid var(--border);border-radius:17px;box-shadow:0 30px 80px rgba(0,0,0,.22);overflow:hidden}.hca-modal>header{display:flex;justify-content:space-between;align-items:center;padding:15px 18px;border-bottom:1px solid var(--border)}.hca-modal h2{font-size:16px;margin:0}.hca-modal>header button{border:0;background:transparent;color:var(--muted);cursor:pointer}.hca-modal-body{padding:18px;overflow-y:auto;max-height:calc(92vh - 58px)}.hca-case-meta{display:grid;grid-template-columns:1fr 1fr;gap:10px}.hca-case-meta>div{display:grid;gap:3px;padding:10px;background:var(--surface-2);border-radius:9px}.hca-case-meta span,.hca-message>span{font-size:10px;color:var(--muted)}.hca-case-meta strong{font-size:12px}.hca-message{margin:14px 0;padding:15px;border:1px solid var(--border);border-radius:10px}.hca-message p{white-space:pre-wrap;line-height:1.7;margin:6px 0 0;font-size:13px}.hca-edit-grid{display:grid;grid-template-columns:200px 1fr;gap:12px}.hca-edit-grid .wide{grid-column:1/-1}.hca-contact-box{display:grid;gap:10px;margin-top:14px;padding:14px;border-radius:11px;background:color-mix(in srgb,var(--primary) 6%,var(--card));border:1px solid color-mix(in srgb,var(--primary) 20%,var(--border))}.hca-contact-box>div{display:flex;justify-content:space-between;align-items:center}.hca-modal-actions{display:flex;gap:8px;margin-top:17px}.hca-modal-actions>span{flex:1}
  .hca-settings-top{display:grid;grid-template-columns:220px 1fr;gap:20px;padding-bottom:18px;border-bottom:1px solid var(--border)}.hca-qr img{width:210px;height:210px;background:#fff;padding:6px;border:1px solid var(--border);border-radius:12px}.hca-link{display:grid;align-content:start;gap:9px}.hca-link>span{font-size:11px;color:var(--muted)}.hca-link>div{display:flex;gap:8px;align-items:center}.hca-link a{font-size:11px;color:var(--primary)}.hca-switch{display:flex;gap:7px;align-items:center;font-size:12px}.hca-switch input{accent-color:var(--primary)}.hca-units-head{display:flex;justify-content:space-between;gap:10px;margin:18px 0 10px}.hca-units-head>div{display:grid}.hca-units-head small{font-size:10px;color:var(--muted)}.hca-units-head form{display:flex;gap:6px}.hca-units{display:grid;gap:7px}.hca-units>div{display:grid;grid-template-columns:1fr 82px auto auto;gap:7px;align-items:center}.hca-units>div.inactive{opacity:.52}.hca-toast{position:fixed;right:20px;bottom:20px;z-index:1200;padding:11px 15px;border-radius:9px;background:#166534;color:#fff;font-size:12px;box-shadow:0 10px 30px rgba(0,0,0,.18)}.hca-toast.error{background:#B91C1C}
  @media(max-width:1100px){.hca-filters{grid-template-columns:repeat(3,1fr)}.hca-metrics{grid-template-columns:1fr 1fr}}@media(max-width:680px){.hca-metrics,.hca-filters{grid-template-columns:1fr}.hca-case-meta,.hca-edit-grid{grid-template-columns:1fr}.hca-settings-top{grid-template-columns:1fr}.hca-qr{text-align:center}.hca-units-head{display:grid}.hca-units-head form{display:grid;grid-template-columns:1fr auto}.hca-units>div{grid-template-columns:1fr 68px}.hca-modal-backdrop{padding:0}.hca-modal{height:100%;max-height:100%;border-radius:0}.hca-modal-body{max-height:calc(100vh - 58px)}}
`
