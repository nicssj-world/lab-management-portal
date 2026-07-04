'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { StickyScroll } from '@/components/ui/StickyScroll'
import { getLabCodeInfo } from '@/lib/equipment-lab-code'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'
import type { Equipment, EquipmentSummaryCounts } from '@/lib/queries/equipment'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

// ─── types ────────────────────────────────────────────────────────────────────

type EquipmentStatus = Equipment['status']
type RiskLevel = 'High' | 'Medium' | 'Low'
type EquipmentSortKey = 'name' | 'code'
type ResponsibleUser = {
  id: string
  ephis_id: string | null
  name: string
  dept: string | null
  role: string | null
}

const STATUS_TABS: { value: string; label: string }[] = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'ชำรุด', label: 'ชำรุด' },
  { value: 'มาใหม่', label: 'มาใหม่' },
  { value: 'ย้าย', label: 'ย้าย' },
  { value: 'สูญหาย', label: 'สูญหาย' },
]

const RISK_BADGE: Record<RiskLevel, 'red' | 'amber' | 'teal'> = {
  High: 'red', Medium: 'amber', Low: 'teal',
}

const STATUS_BADGE: Record<EquipmentStatus, 'green' | 'gray' | 'red' | 'blue' | 'purple' | 'amber'> = {
  Active: 'green', Inactive: 'gray', ชำรุด: 'red', มาใหม่: 'blue', ย้าย: 'purple', สูญหาย: 'amber',
}

const DEPARTMENTS = [
  'โลหิตวิทยา', 'เคมีคลินิก', 'จุลชีววิทยา', 'ภูมิคุ้มกันวิทยา',
  'จุลทรรศน์', 'อณูชีววิทยา', 'คลังเลือด', 'ผู้ป่วยนอก',
  'คลังน้ำยา', 'ศสม.', 'POCT', 'DRA',
  'ตรวจพิเศษและปฏิบัติการตรวจต่อ', 'ไม่มีเจ้าของ',
]

const EQUIPMENT_PAGE_SIZE = 50

type EquipmentListPayload = {
  items?: Equipment[]
  count?: number
  page?: number
  pageSize?: number
  totalPages?: number
  statusCounts?: Record<string, number>
  summaryCounts?: EquipmentSummaryCounts
}

function parseEquipmentPayload(payload: unknown): EquipmentListPayload {
  if (Array.isArray(payload)) {
    return { items: payload as Equipment[], count: payload.length, page: 1, pageSize: payload.length, totalPages: 1 }
  }
  if (payload && typeof payload === 'object') return payload as EquipmentListPayload
  return { items: [], count: 0, page: 1, pageSize: EQUIPMENT_PAGE_SIZE, totalPages: 1 }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function warrantyStatus(exp: string | null): 'ok' | 'warn' | 'danger' | null {
  if (!exp) return null
  const days = (new Date(exp).getTime() - Date.now()) / 86400000
  if (days < 0) return 'danger'
  if (days < 30) return 'danger'
  if (days < 90) return 'warn'
  return 'ok'
}

function formatDate(d: string | null) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return d }
}

function formatPrice(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function normalizeOwner(value: unknown): string {
  const raw = String(value ?? '').trim()
  const key = raw.toLowerCase()
  if (!raw) return ''
  if (raw === 'รพ' || raw === 'โรงพยาบาล' || key === 'hospital') return 'Hospital'
  if (key === 'vendor') return 'Vendor'
  return raw
}

function labCodeLabel(item: Pick<Equipment, 'cbh_code' | 'cbh_code_pending'>) {
  if (item.cbh_code_pending) return 'รอขึ้นทะเบียน'
  return item.cbh_code || '—'
}

function compareEquipment(a: Equipment, b: Equipment, sortKey: EquipmentSortKey, sortDir: 'asc' | 'desc') {
  if (sortKey === 'code') {
    const av = a.cbh_code_pending ? '' : (a.cbh_code ?? '')
    const bv = b.cbh_code_pending ? '' : (b.cbh_code ?? '')
    const aEmpty = !av
    const bEmpty = !bv
    if (aEmpty && !bEmpty) return 1
    if (!aEmpty && bEmpty) return -1
    const cmp = av.localeCompare(bv, 'th', { numeric: true, sensitivity: 'base' })
    return sortDir === 'asc' ? cmp : -cmp
  }

  const cmp = a.equipment_type.localeCompare(b.equipment_type, 'th', { numeric: true, sensitivity: 'base' })
  return sortDir === 'asc' ? cmp : -cmp
}

// Converts yyyy-mm-dd → dd/mm/yyyy for display
function isoToDmy(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

// Converts dd/mm/yyyy → yyyy-mm-dd for storage; returns null if invalid
function dmyToIso(dmy: string): string | null {
  const parts = dmy.trim().split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts.map(p => p.trim().padStart(2, '0'))
  if (y.length !== 4 || isNaN(Date.parse(`${y}-${m}-${d}`))) return null
  return `${y}-${m}-${d}`
}

function DateInput({ value, onChange, style }: {
  value: string | null | undefined
  onChange: (v: string | null) => void
  style?: React.CSSProperties
}) {
  const [display, setDisplay] = useState(isoToDmy(value))
  useEffect(() => { setDisplay(isoToDmy(value)) }, [value])
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      <input
        type="text"
        placeholder="วว/ดด/ปปปป"
        style={{ ...style, width: '100%', paddingRight: 32 }}
        value={display}
        onChange={e => setDisplay(e.target.value)}
        onBlur={() => {
          const v = display.trim()
          if (!v) { onChange(null); setDisplay(''); return }
          const iso = dmyToIso(v)
          if (iso) { onChange(iso); setDisplay(isoToDmy(iso)) }
          else setDisplay(isoToDmy(value))
        }}
      />
      <svg
        width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ position: 'absolute', right: 8, color: 'var(--muted)', pointerEvents: 'none' }}
      >
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      {/* Invisible date input covering the icon — clicking it opens the native picker */}
      <input
        type="date"
        value={value ?? ''}
        onChange={e => { onChange(e.target.value || null); setDisplay(isoToDmy(e.target.value)) }}
        tabIndex={-1}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 32, opacity: 0, cursor: 'pointer', border: 'none', padding: 0 }}
      />
    </div>
  )
}

// ─── blank form ───────────────────────────────────────────────────────────────

const BLANK: Partial<Equipment> = {
  item_no: null, cbh_code: '', cbh_code_pending: false, hospital_asset_no: '', hospital_asset_no_pending: false, department: '',
  owner: 'Hospital', owner_status: '', risk_level: null, classification: '',
  equipment_type: '', manufacturer: '', model: '', serial_number: '',
  vendor: '', purchase_date: null, warranty_exp: null, purchase_price: null,
  status: 'Active', needs_calibration: true, responsible_user_id: null, responsible_person: '', purpose: '', remark: '',
  photo_url: null, method_validation_url: null, method_correlation_url: null, manual_url: null,
}

// ─── sub-components ───────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([])
  const counter = useRef(0)
  const add = useCallback((msg: string, ok = true) => {
    const id = ++counter.current
    setToasts(t => [...t, { id, msg, ok }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])
  return { toasts, add }
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)', fontSize: 13,
  fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)',
  outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block',
}

function RiskHint() {
  const term = (text: string, color: string, bg: string) => (
    <strong style={{ color, background: bg, padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap' }}>
      {text}
    </strong>
  )

  return (
    <span className="eq-risk-hint">
      <button type="button" className="eq-risk-hint-btn" aria-label="รายละเอียดระดับความเสี่ยง">?</button>
      <span className="eq-risk-hint-popover" role="tooltip">
        <span>
          {term('High Risk', '#B91C1C', 'rgba(220,38,38,.10)')} หมายถึงเครื่องมือที่ใช้ในการช่วยชีวิต เครื่องมือที่ใช้ในการติดตามสัญญาณชีพ และเครื่องมืออื่น ๆ ที่ชำรุดหรือใช้งานผิดพลาด ซึ่งอาจเป็นเหตุให้เกิดอันตรายขั้นร้ายแรงต่อผู้ป่วยหรือผู้ใช้งาน เช่น ตู้ Biosafety cabinet และ Autoclave
        </span>
        <span>
          {term('Medium Risk', '#B45309', 'rgba(217,119,6,.13)')} หมายถึงเครื่องมือที่ใช้ในการวินิจฉัย ซึ่งอาจเกิดความผิดพลาดจากการใช้งาน ชำรุด ไม่สามารถใช้งานได้ หรือไม่เพียงพอต่อการใช้งาน ทำให้มีผลกระทบต่อความปลอดภัยของผู้ป่วยแต่ไม่ถึงขั้นอันตรายร้ายแรง เช่น Blood bank refrigerators, Blood Gas / pH Analyzers, Centrifuges and Clinical lab equipment, Bio-safety Cabinet Class II และ Microscope
        </span>
        <span>
          {term('Low Risk', '#0E7490', 'rgba(8,145,178,.10)')} หมายถึงเครื่องมือที่ชำรุดไม่สามารถใช้งานได้หรือเกิดความผิดพลาดในการใช้งาน ซึ่งทำให้เกิดผลกระทบต่อผู้ป่วยที่ไม่ร้ายแรง เช่น Electronic Thermometer, Temperature Monitors
        </span>
      </span>
    </span>
  )
}

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

function EquipmentModal({
  item, onClose, onSaved, departments, responsibleUsers,
}: {
  item: Partial<Equipment> | null
  onClose: () => void
  onSaved: (eq: Equipment) => void
  departments: string[]
  responsibleUsers: ResponsibleUser[]
}) {
  const isEdit = !!item?.id
  const [form, setForm] = useState<Partial<Equipment>>(item ? { ...item, owner: normalizeOwner(item.owner) } : BLANK)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [photoDragOver, setPhotoDragOver] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Document file states
  type DocType = 'method_validation' | 'method_correlation' | 'manual'
  const [docFiles, setDocFiles] = useState<Record<DocType, File | null>>({ method_validation: null, method_correlation: null, manual: null })
  const [docRemove, setDocRemove] = useState<Record<DocType, boolean>>({ method_validation: false, method_correlation: false, manual: false })
  const [docDragOver, setDocDragOver] = useState<Record<DocType, boolean>>({ method_validation: false, method_correlation: false, manual: false })
  const docInputRefs = { method_validation: useRef<HTMLInputElement>(null), method_correlation: useRef<HTMLInputElement>(null), manual: useRef<HTMLInputElement>(null) }

  function handleDocSelect(docType: DocType, file: File) {
    if (file.size > 50 * 1024 * 1024) { setErr('ขนาดไฟล์เกิน 50 MB'); return }
    setDocFiles(prev => ({ ...prev, [docType]: file }))
    setDocRemove(prev => ({ ...prev, [docType]: false }))
  }

  const set = (k: keyof Equipment, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  function setResponsibleUser(userId: string) {
    const user = responsibleUsers.find(u => u.id === userId)
    setForm(f => ({
      ...f,
      responsible_user_id: user?.id ?? null,
      responsible_person: user?.name ?? '',
    }))
  }

  function setLabCode(value: string) {
    const cbhCode = value || null
    const labInfo = getLabCodeInfo(cbhCode)
    setForm(f => ({
      ...f,
      cbh_code: cbhCode,
      ...(labInfo.department ? { department: labInfo.department } : {}),
      ...(labInfo.classification ? { classification: labInfo.classification } : {}),
    }))
  }

  function handlePhotoSelect(file: File) {
    if (file.size > 20 * 1024 * 1024) { setErr('ขนาดรูปเกิน 20 MB'); return }
    setPhotoFile(file)
    setRemovePhoto(false)
    const reader = new FileReader()
    reader.onload = e => setPhotoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!form.equipment_type?.trim()) { setErr('กรุณาระบุชื่อเครื่องมือ'); return }
    if (!form.department?.trim()) { setErr('กรุณาระบุแผนก'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch(
        isEdit ? `/api/admin/equipment/${item!.id}` : '/api/admin/equipment',
        { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }
      )
      const json = await res.json()
      if (!res.ok) { setErr(json.error ?? 'เกิดข้อผิดพลาด'); return }

      // Handle photo upload
      if (photoFile) {
        const presignRes = await fetch(`/api/admin/equipment/${json.id}/photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: photoFile.name, fileType: photoFile.type, fileSize: photoFile.size }),
        })
        const { uploadUrl, key, error: presignErr } = await presignRes.json()
        if (!presignRes.ok || presignErr) { setErr(presignErr ?? 'ไม่สามารถสร้าง URL อัพโหลดรูปได้'); return }
        const uploadRes = await fetch(uploadUrl, { method: 'PUT', body: photoFile, headers: { 'Content-Type': photoFile.type } })
        if (!uploadRes.ok) { setErr('อัพโหลดรูปไม่สำเร็จ กรุณาลองใหม่'); return }
        const saveRes = await fetch(`/api/admin/equipment/${json.id}/photo`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        })
        if (!saveRes.ok) {
          const errData = await saveRes.json()
          setErr(errData.error ?? 'บันทึกรูปไม่สำเร็จ')
          return
        }
        const saveData = await saveRes.json()
        json.photo_url = saveData.photo_url
      } else if (removePhoto && isEdit && item?.photo_url) {
        await fetch(`/api/admin/equipment/${json.id}/photo`, { method: 'DELETE' })
        json.photo_url = null
      }

      // Handle document uploads
      const docTypes: DocType[] = ['method_validation', 'method_correlation', 'manual']
      for (const docType of docTypes) {
        const file = docFiles[docType]
        const shouldRemove = docRemove[docType]
        const colKey = `${docType}_url` as keyof Equipment

        if (file) {
          const presignRes = await fetch(`/api/admin/equipment/${json.id}/docs`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ doc_type: docType, fileName: file.name, fileType: file.type, fileSize: file.size }),
          })
          const { uploadUrl, key, error: presignErr } = await presignRes.json()
          if (!presignRes.ok || presignErr) { setErr(presignErr ?? `ไม่สามารถสร้าง URL อัพโหลดไฟล์ ${docType} ได้`); return }
          const uploadRes = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
          if (!uploadRes.ok) { setErr(`อัพโหลดไฟล์ ${docType} ไม่สำเร็จ กรุณาลองใหม่`); return }
          const saveRes = await fetch(`/api/admin/equipment/${json.id}/docs`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ doc_type: docType, key }),
          })
          if (!saveRes.ok) {
            const errData = await saveRes.json()
            setErr(errData.error ?? `บันทึกไฟล์ ${docType} ไม่สำเร็จ — ตรวจสอบว่ารัน SQL migration แล้ว`)
            return
          }
          const saveData = await saveRes.json()
          json[colKey] = saveData[`${docType}_url`]
        } else if (shouldRemove && isEdit && item?.[colKey]) {
          await fetch(`/api/admin/equipment/${json.id}/docs?doc_type=${docType}`, { method: 'DELETE' })
          json[colKey] = null
        }
      }

      onSaved(json as Equipment)
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 760, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{isEdit ? 'แก้ไขเครื่องมือ' : 'เพิ่มเครื่องมือ'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><Icon name="x" size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
          {err && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>{err}</div>}

          {/* Section: ข้อมูลทั่วไป */}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>ข้อมูลทั่วไป</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>ชื่อ / ประเภทเครื่องมือ <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input style={inputStyle} value={form.equipment_type ?? ''} onChange={e => set('equipment_type', e.target.value)} placeholder="Equipment Type" />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>รหัส LAB</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--warning)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form.cbh_code_pending} onChange={e => { set('cbh_code_pending', e.target.checked); if (e.target.checked) set('cbh_code', null) }} style={{ accentColor: 'var(--warning)', width: 13, height: 13, cursor: 'pointer' }} />
                  รอขึ้นทะเบียน
                </label>
              </div>
              <input style={{ ...inputStyle, opacity: form.cbh_code_pending ? 0.6 : 1 }} disabled={!!form.cbh_code_pending} value={form.cbh_code_pending ? 'รอขึ้นทะเบียน' : (form.cbh_code ?? '')} onChange={e => setLabCode(e.target.value)} placeholder="LAB-CC-XX-XXX" />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>เลขทะเบียนสินทรัพย์ รพ.</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--warning)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form.hospital_asset_no_pending} onChange={e => { set('hospital_asset_no_pending', e.target.checked); if (e.target.checked) set('hospital_asset_no', null) }} style={{ accentColor: 'var(--warning)', width: 13, height: 13, cursor: 'pointer' }} />
                  รอขึ้นทะเบียน
                </label>
              </div>
              <input style={{ ...inputStyle, opacity: form.hospital_asset_no_pending ? 0.6 : 1 }} disabled={!!form.hospital_asset_no_pending} value={form.hospital_asset_no_pending ? 'รอขึ้นทะเบียน' : (form.hospital_asset_no ?? '')} onChange={e => set('hospital_asset_no', e.target.value || null)} placeholder="6515-047-0001/1/36" />
            </div>
            <div>
              <label style={labelStyle}>แผนก <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select style={inputStyle} value={form.department ?? ''} onChange={e => set('department', e.target.value)}>
                <option value="">เลือกแผนก</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
                <option value="อื่นๆ">อื่นๆ</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>ผู้รับผิดชอบ</label>
              <select
                style={{ ...inputStyle, marginBottom: 6 }}
                value={form.responsible_user_id ?? ''}
                onChange={e => setResponsibleUser(e.target.value)}
              >
                <option value="">ไม่ผูกกับผู้ใช้ / กรอกชื่อเอง</option>
                {responsibleUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name}{user.ephis_id ? ` (${user.ephis_id})` : ''}{user.dept ? ` · ${user.dept}` : ''}
                  </option>
                ))}
              </select>
              <input
                style={{ ...inputStyle, opacity: form.responsible_user_id ? 0.65 : 1 }}
                disabled={!!form.responsible_user_id}
                value={form.responsible_person ?? ''}
                onChange={e => {
                  setForm(f => ({ ...f, responsible_user_id: null, responsible_person: e.target.value || null }))
                }}
                placeholder="ชื่อผู้รับผิดชอบ"
              />
            </div>
            <div>
              <label style={labelStyle}>Classification</label>
              <input style={inputStyle} value={form.classification ?? ''} onChange={e => set('classification', e.target.value || null)} placeholder="Diagnostic / Misc other" />
            </div>
            <div>
              <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                ระดับความเสี่ยง
                <RiskHint />
              </div>
              <select style={inputStyle} value={form.risk_level ?? ''} onChange={e => set('risk_level', e.target.value || null)}>
                <option value="">เลือก</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>สถานะ</label>
              <select style={inputStyle} value={form.status ?? 'Active'} onChange={e => {
                const s = e.target.value as Equipment['status']
                setForm(f => ({ ...f, status: s, ...(s === 'Inactive' ? { needs_calibration: false } : {}) }))
              }}>
                {['Active', 'Inactive', 'ชำรุด', 'มาใหม่', 'ย้าย', 'สูญหาย'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Section: ผู้ผลิต/จำหน่าย */}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>ผู้ผลิต / จำหน่าย</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Manufacturer</label>
              <input style={inputStyle} value={form.manufacturer ?? ''} onChange={e => set('manufacturer', e.target.value || null)} />
            </div>
            <div>
              <label style={labelStyle}>Model</label>
              <input style={inputStyle} value={form.model ?? ''} onChange={e => set('model', e.target.value || null)} />
            </div>
            <div>
              <label style={labelStyle}>Serial Number</label>
              <input style={inputStyle} value={form.serial_number ?? ''} onChange={e => set('serial_number', e.target.value || null)} />
            </div>
            <div>
              <label style={labelStyle}>Vendor (ผู้จำหน่าย)</label>
              <input style={inputStyle} value={form.vendor ?? ''} onChange={e => set('vendor', e.target.value || null)} />
            </div>
            <div>
              <label style={labelStyle}>เจ้าของ</label>
              <select style={inputStyle} value={normalizeOwner(form.owner)} onChange={e => set('owner', e.target.value || null)}>
                <option value="">เลือกเจ้าของ</option>
                <option value="Hospital">Hospital</option>
                <option value="Vendor">Vendor</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Owner Status</label>
              <input style={inputStyle} value={form.owner_status ?? ''} onChange={e => set('owner_status', e.target.value || null)} placeholder="Hospital" />
            </div>
          </div>

          {/* Section: การจัดซื้อ */}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>การจัดซื้อ</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>วันที่ซื้อ</label>
              <DateInput style={inputStyle} value={form.purchase_date} onChange={v => set('purchase_date', v)} />
            </div>
            <div>
              <label style={labelStyle}>วันหมดประกัน</label>
              <DateInput style={inputStyle} value={form.warranty_exp} onChange={v => set('warranty_exp', v)} />
            </div>
            <div>
              <label style={labelStyle}>ราคาซื้อ (บาท)</label>
              <input type="number" style={inputStyle} value={form.purchase_price ?? ''} onChange={e => set('purchase_price', e.target.value ? Number(e.target.value) : null)} />
            </div>
          </div>

          {/* Section: การสอบเทียบ */}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>การสอบเทียบ</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: form.status === 'Inactive' ? 'not-allowed' : 'pointer', fontSize: 13, opacity: form.status === 'Inactive' ? 0.45 : 1 }}>
              <input type="checkbox" checked={form.needs_calibration ?? true} disabled={form.status === 'Inactive'} onChange={e => set('needs_calibration', e.target.checked)} />
              ต้องการสอบเทียบ + PM ปีนี้
            </label>
            {form.status === 'Inactive' && <span style={{ fontSize: 11.5, color: 'var(--muted)', fontStyle: 'italic' }}>ปิดอัตโนมัติเมื่อสถานะเป็น Inactive</span>}
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>จุดประสงค์ของการใช้งาน</label>
            <textarea style={{ ...inputStyle, height: 64, resize: 'vertical' }} value={form.purpose ?? ''} onChange={e => set('purpose', e.target.value || null)} placeholder="เช่น ตรวจวัดอุณหภูมิ, ปั่นตกตะกอน CSF" />
          </div>

          {/* Remark */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>หมายเหตุ</label>
            <textarea style={{ ...inputStyle, height: 72, resize: 'vertical' }} value={form.remark ?? ''} onChange={e => set('remark', e.target.value || null)} />
          </div>

          {/* Section: รูปถ่ายเครื่องมือ */}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>รูปถ่ายเครื่องมือ</div>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoSelect(f) }} />
          <div
            onDragOver={e => { e.preventDefault(); setPhotoDragOver(true) }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPhotoDragOver(false) }}
            onDrop={e => {
              e.preventDefault(); setPhotoDragOver(false)
              const f = e.dataTransfer.files?.[0]
              if (f && f.type.startsWith('image/')) handlePhotoSelect(f)
              else if (f) setErr('รองรับเฉพาะไฟล์รูปภาพ')
            }}
            style={{ borderRadius: 8, border: `2px dashed ${photoDragOver ? 'var(--primary)' : 'var(--border)'}`, background: photoDragOver ? 'var(--primary-soft)' : 'transparent', transition: 'border-color .15s, background .15s' }}
          >
          {photoPreview ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12 }}>
              <img src={photoPreview} alt="preview" style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{photoFile?.name}</div>
                {photoDragOver && <div style={{ fontSize: 11.5, color: 'var(--primary)', fontWeight: 600 }}>วางเพื่อเปลี่ยนรูป</div>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => photoInputRef.current?.click()} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}>เปลี่ยนรูป</button>
                  <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null) }} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--danger)' }}>ยกเลิก</button>
                </div>
              </div>
            </div>
          ) : isEdit && item?.photo_url && !removePhoto ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px' }}>
              <Icon name="eye" size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: photoDragOver ? 'var(--primary)' : 'var(--ink)', flex: 1, fontWeight: photoDragOver ? 600 : 400 }}>
                {photoDragOver ? 'วางเพื่อเปลี่ยนรูป' : 'มีรูปถ่ายอยู่แล้ว'}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => photoInputRef.current?.click()} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}>เปลี่ยนรูป</button>
                <button type="button" onClick={() => setRemovePhoto(true)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--danger)' }}>ลบรูป</button>
              </div>
            </div>
          ) : removePhoto ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px' }}>
              <span style={{ fontSize: 12.5, color: photoDragOver ? 'var(--primary)' : 'var(--danger)', flex: 1, fontWeight: photoDragOver ? 600 : 400 }}>
                {photoDragOver ? 'วางเพื่ออัพโหลดรูปใหม่' : 'รูปถ่ายจะถูกลบเมื่อบันทึก'}
              </span>
              <button type="button" onClick={() => setRemovePhoto(false)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}>ยกเลิก</button>
              <button type="button" onClick={() => photoInputRef.current?.click()} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}>อัพโหลดรูปใหม่</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              style={{ width: '100%', padding: '24px 20px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: photoDragOver ? 'var(--primary)' : 'var(--muted)', fontFamily: 'inherit' }}
            >
              <Icon name="upload" size={20} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{photoDragOver ? 'วางรูปที่นี่' : 'คลิกหรือลากรูปมาวาง'}</span>
              <span style={{ fontSize: 11.5 }}>JPG, PNG, WEBP, HEIC · ไม่เกิน 20 MB</span>
            </button>
          )}
          </div>

          {/* Section: เอกสารประกอบ */}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>เอกสารประกอบ</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 4 }}>
            {([
              { docType: 'manual' as DocType, label: 'คู่มือการใช้งานเครื่องมือ' },
            ]).map(({ docType, label }) => {
              const file = docFiles[docType]
              const removing = docRemove[docType]
              const hasExisting = isEdit && !!(item?.[`${docType}_url` as keyof typeof item])
              const over = docDragOver[docType]
              return (
                <div key={docType}>
                  <input ref={docInputRefs[docType]} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleDocSelect(docType, f); e.target.value = '' }} />
                  <label style={labelStyle}>{label}</label>
                  <div
                    onDragOver={e => { e.preventDefault(); setDocDragOver(prev => ({ ...prev, [docType]: true })) }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDocDragOver(prev => ({ ...prev, [docType]: false })) }}
                    onDrop={e => {
                      e.preventDefault(); setDocDragOver(prev => ({ ...prev, [docType]: false }))
                      const f = e.dataTransfer.files?.[0]
                      if (f) handleDocSelect(docType, f)
                    }}
                    style={{ borderRadius: 8, border: `2px dashed ${over ? 'var(--primary)' : 'var(--border)'}`, background: over ? 'var(--primary-soft)' : 'transparent', transition: 'border-color .15s, background .15s' }}
                  >
                    {file ? (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px' }}>
                        <Icon name="doc" size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, color: over ? 'var(--primary)' : 'var(--ink)', flex: 1, fontWeight: 500 }}>{over ? 'วางเพื่อเปลี่ยนไฟล์' : file.name}</span>
                        <button type="button" onClick={() => setDocFiles(prev => ({ ...prev, [docType]: null }))}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--danger)' }}>ยกเลิก</button>
                      </div>
                    ) : hasExisting && !removing ? (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px' }}>
                        <Icon name="doc" size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, color: over ? 'var(--primary)' : 'var(--ink)', flex: 1 }}>{over ? 'วางเพื่อเปลี่ยนไฟล์' : 'มีไฟล์อยู่แล้ว'}</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" onClick={() => docInputRefs[docType].current?.click()}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}>เปลี่ยน</button>
                          <button type="button" onClick={() => setDocRemove(prev => ({ ...prev, [docType]: true }))}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--danger)' }}>ลบ</button>
                        </div>
                      </div>
                    ) : removing ? (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px' }}>
                        <span style={{ fontSize: 12.5, color: 'var(--danger)', flex: 1 }}>ไฟล์จะถูกลบเมื่อบันทึก</span>
                        <button type="button" onClick={() => setDocRemove(prev => ({ ...prev, [docType]: false }))}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}>ยกเลิก</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => docInputRefs[docType].current?.click()}
                        style={{ width: '100%', padding: '18px 20px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: over ? 'var(--primary)' : 'var(--muted)', fontFamily: 'inherit' }}>
                        <Icon name="upload" size={16} />
                        <span style={{ fontSize: 13 }}>{over ? 'วางไฟล์ที่นี่' : 'คลิกหรือลากไฟล์มาวาง'}</span>
                        <span style={{ fontSize: 11.5 }}>PDF, DOCX, XLSX, JPG, PNG · ไม่เกิน 50 MB</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)' }}>ยกเลิก</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'กำลังบันทึก...' : isEdit ? 'บันทึก' : 'เพิ่มเครื่องมือ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Import Modal ─────────────────────────────────────────────────────────────

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{
    count: number
    rows: Partial<Equipment>[]
    insertCount?: number
    updateCount?: number
    blockedCount?: number
    duplicateCount?: number
    duplicates?: {
      row: number
      field: string
      value: string
      equipment_type: string
      department: string
      source: 'database' | 'file'
      matched_with: string
    }[]
    duplicateRows?: {
      row: number
      equipment_type: string
      department: string
      action?: 'insert' | 'update' | 'blocked'
      target?: string | null
      canImport: boolean
      reason: string | null
      issues: {
        field: string
        value: string
        source: 'database' | 'file'
        matched_with: string
      }[]
    }[]
  } | null>(null)
  const [skippedRows, setSkippedRows] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handlePreview() {
    if (!file) return
    setLoading(true); setErr(''); setPreview(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('preview', 'true')
    const res = await fetch('/api/admin/equipment/import', { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) { setErr(json.error ?? 'เกิดข้อผิดพลาด') }
    else {
      setPreview(json)
      setSkippedRows(new Set((json.duplicateRows ?? []).map((row: { row: number }) => row.row)))
    }
    setLoading(false)
  }

  async function handleImport() {
    if (!file) return
    setImporting(true); setErr('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('skip_rows', JSON.stringify(Array.from(skippedRows)))
    const res = await fetch('/api/admin/equipment/import', { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) { setErr(json.error ?? 'เกิดข้อผิดพลาด'); setImporting(false); return }
    setImporting(false)
    onImported()
  }

  const selectedImportCount = preview ? Math.max(0, preview.count - skippedRows.size) : 0
  const duplicateRows = preview?.duplicateRows ?? []

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>นำเข้าข้อมูลจาก Excel</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><Icon name="x" size={18} /></button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--surface-2)', fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.7 }}>
            รองรับไฟล์ .xlsx / .xls — ระบบจะอ่าน column header แถวแรกและ map กับ field อัตโนมัติ
            <br />Column ที่รองรับ: LAB Code, Hospital Asset No, Department, Risk, Equipment Type, Manufacturer, Model, Serial Number, Equipment Vendor, Purchase Date, Warranty Exp, Purchase Price, Status, Remark, ผู้รับผิดชอบ, ต้องการสอบเทียบ
            <br />ระบบจะตรวจซ้ำจาก LAB Code, Hospital Asset No, Serial Number และกรณีไม่มีเลขอ้างอิงจะเทียบชื่อเครื่องมือ + แผนก
          </div>

          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => { setFile(e.target.files?.[0] ?? null); setPreview(null); setSkippedRows(new Set()) }} />
            <button onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)' }}>
              <Icon name="upload" size={15} />
              {file ? file.name : 'เลือกไฟล์ Excel'}
            </button>
            <a
              href="/api/admin/equipment/import"
              download="equipment-import-template.xlsx"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              <Icon name="download" size={14} /> ดาวน์โหลด Template
            </a>
          </div>

          {err && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>{err}</div>}

          {preview && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                พบข้อมูล {preview.count} รายการ — ตัวอย่าง 5 แถวแรก:
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <Badge color="green" size="sm">เพิ่มใหม่ {preview.insertCount ?? 0}</Badge>
                <Badge color="blue" size="sm">อัปเดตเดิม {preview.updateCount ?? 0}</Badge>
                {!!preview.blockedCount && <Badge color="red" size="sm">ต้องแก้ไข {preview.blockedCount}</Badge>}
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      {['Equipment Type', 'Department', 'LAB Code', 'Manufacturer', 'Status'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '7px 12px', color: 'var(--ink)' }}>{r.equipment_type ?? '—'}</td>
                        <td style={{ padding: '7px 12px', color: 'var(--ink)' }}>{r.department ?? '—'}</td>
                        <td style={{ padding: '7px 12px', color: 'var(--muted)' }}>{r.cbh_code ?? '—'}</td>
                        <td style={{ padding: '7px 12px', color: 'var(--muted)' }}>{r.manufacturer ?? '—'}</td>
                        <td style={{ padding: '7px 12px', color: 'var(--muted)' }}>{r.status ?? 'Active'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {duplicateRows.some(d => d.action === 'update') && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(59,130,246,.07)', border: '1px solid rgba(59,130,246,.28)', fontSize: 12.5, color: '#1e40af' }}>
                  พบ <strong>{duplicateRows.filter(d => d.action === 'update').length} รายการ</strong> ที่ Hospital Asset No / Serial Number ตรงกับเครื่องมือในระบบ —
                  ค่าเริ่มต้น <strong>ไม่อัปเดต</strong> ต้องติ๊กเพื่ออนุมัติแต่ละรายการ
                </div>
              )}
              {duplicateRows.length > 0 && (
                <div style={{ marginTop: 14, border: '1px solid rgba(220,38,38,.28)', borderRadius: 10, overflow: 'hidden', background: 'rgba(220,38,38,.05)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(220,38,38,.20)', color: 'var(--danger)', fontSize: 13, fontWeight: 700, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>พบรายการที่ต้องตรวจสอบ — ติ๊กเพื่อเลือกแถวที่จะนำเข้า</span>
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>
                      จะนำเข้า {selectedImportCount} จาก {preview.count} รายการ
                    </span>
                  </div>
                  <div style={{ maxHeight: 220, overflow: 'auto', background: 'var(--card)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2)' }}>
                          {['นำเข้า', 'แถว', 'การทำงาน', 'เครื่องมือในไฟล์', 'ซ้ำจาก', 'รายละเอียด'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {duplicateRows.map((d) => {
                          const checked = !skippedRows.has(d.row)
                          const issueSummary = d.issues.map(issue => `${issue.field}${issue.value ? `: ${issue.value}` : ''}`).join(' / ')
                          const detail = d.reason ?? d.issues.map(issue => `${issue.source === 'database' ? 'ในระบบ' : 'ในไฟล์'}: ${issue.matched_with}`).join(' | ')
                          return (
                            <tr key={d.row} style={{ borderTop: '1px solid var(--border)', opacity: d.canImport ? 1 : 0.72 }}>
                              <td style={{ padding: '8px 10px' }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!d.canImport}
                                  onChange={e => {
                                    const shouldImport = e.target.checked
                                    setSkippedRows(prev => {
                                      const next = new Set(prev)
                                      if (shouldImport) next.delete(d.row)
                                      else next.add(d.row)
                                      return next
                                    })
                                  }}
                                  style={{ width: 15, height: 15, accentColor: 'var(--primary)', cursor: d.canImport ? 'pointer' : 'not-allowed' }}
                                  title={d.canImport ? 'เลือกเพื่อนำเข้า' : d.reason ?? 'ไม่สามารถนำเข้าได้'}
                                />
                              </td>
                              <td style={{ padding: '8px 10px', color: d.canImport ? 'var(--danger)' : 'var(--muted)', fontWeight: 700 }}>{d.row}</td>
                              <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                                <Badge color={d.action === 'update' ? 'blue' : d.action === 'blocked' ? 'red' : 'green'} size="sm">
                                  {d.action === 'update' ? 'อัปเดตเดิม' : d.action === 'blocked' ? 'นำเข้าไม่ได้' : 'เพิ่มใหม่'}
                                </Badge>
                              </td>
                              <td style={{ padding: '8px 10px', color: 'var(--ink)' }}>{d.equipment_type} · {d.department}</td>
                              <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{issueSummary}</td>
                              <td style={{ padding: '8px 10px', color: d.canImport ? 'var(--muted)' : 'var(--danger)' }}>
                                {d.target ? `จะทับ: ${d.target}` : detail}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '9px 14px', borderTop: '1px solid rgba(220,38,38,.20)', fontSize: 12, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <span>ค่าเริ่มต้นคือข้ามทุกแถว (รวมถึงการอัปเดต) — ติ๊กเพื่อเลือกแถวที่ต้องการ</span>
                    <button
                      type="button"
                      onClick={() => setSkippedRows(new Set(duplicateRows.filter(row => !row.canImport).map(row => row.row)))}
                      style={{ border: 'none', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, padding: 0 }}
                    >
                      เลือกนำเข้ารายการที่อนุญาตทั้งหมด
                    </button>
                  </div>
                </div>
              )}
              {!!preview.duplicateCount && preview.duplicateCount > 0 && duplicateRows.length === 0 && (
                <div style={{ marginTop: 14, border: '1px solid rgba(220,38,38,.28)', borderRadius: 10, overflow: 'hidden', background: 'rgba(220,38,38,.05)' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(220,38,38,.20)', color: 'var(--danger)', fontSize: 13, fontWeight: 700 }}>
                    พบรายการซ้ำ {preview.duplicateCount} จุด
                  </div>
                  <div style={{ maxHeight: 220, overflow: 'auto', background: 'var(--card)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2)' }}>
                          {['แถว', 'เช็คจาก', 'ค่า', 'เครื่องมือในไฟล์', 'ซ้ำกับ'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(preview.duplicates ?? []).map((d, i) => (
                          <tr key={`${d.row}-${d.field}-${i}`} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 10px', color: 'var(--danger)', fontWeight: 700 }}>{d.row}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--ink)', whiteSpace: 'nowrap' }}>{d.field}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{d.value || '—'}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--ink)' }}>{d.equipment_type} · {d.department}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>
                              {d.source === 'database' ? 'ในระบบ: ' : 'ในไฟล์: '}{d.matched_with}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {preview.duplicateCount > (preview.duplicates?.length ?? 0) && (
                    <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(220,38,38,.20)', fontSize: 12, color: 'var(--muted)' }}>
                      แสดง {preview.duplicates?.length ?? 0} รายการแรกจากทั้งหมด {preview.duplicateCount} จุด
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)' }}>ยกเลิก</button>
          {!preview ? (
            <button onClick={handlePreview} disabled={!file || loading} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: (!file || loading) ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', opacity: (!file || loading) ? 0.6 : 1 }}>
              {loading ? 'กำลังอ่านไฟล์...' : 'ตรวจสอบข้อมูล'}
            </button>
          ) : (
            <button onClick={handleImport} disabled={importing || selectedImportCount <= 0} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: selectedImportCount <= 0 ? 'var(--muted)' : 'var(--success)', color: '#fff', cursor: (importing || selectedImportCount <= 0) ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', opacity: (importing || selectedImportCount <= 0) ? 0.6 : 1 }}>
              {importing ? 'กำลังนำเข้า...' : `นำเข้า ${selectedImportCount} รายการ`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({ item, onClose, onDeleted }: { item: Equipment; onClose: () => void; onDeleted: (id: string) => void }) {
  const [loading, setLoading] = useState(false)
  async function handleDelete() {
    setLoading(true)
    const res = await fetch(`/api/admin/equipment/${item.id}`, { method: 'DELETE' })
    if (res.ok) onDeleted(item.id)
    else setLoading(false)
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>ลบเครื่องมือ</div>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 14, color: 'var(--ink)', marginBottom: 8 }}>ต้องการลบ <strong>{item.equipment_type}</strong> ออกจากระบบ?</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>ข้อมูลที่ลบแล้วไม่สามารถกู้คืนได้</div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>ยกเลิก</button>
          <button onClick={handleDelete} disabled={loading} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'กำลังลบ...' : 'ลบเครื่องมือ'}
          </button>
        </div>
      </div>
    </div>
  )
}

function BulkDeleteConfirm({ ids, allItems, onClose, onDeleted }: {
  ids: string[]
  allItems: Equipment[]
  onClose: () => void
  onDeleted: (ids: string[]) => void
}) {
  const [loading, setLoading] = useState(false)
  const selected = allItems.filter(i => ids.includes(i.id))
  const preview = selected.slice(0, 10)
  const extra = selected.length - preview.length

  async function handleDelete() {
    setLoading(true)
    const res = await fetch('/api/admin/equipment/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (res.ok) onDeleted(ids)
    else setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>ลบเครื่องมือ {ids.length} รายการ</div>
        </div>
        <div style={{ padding: '20px 24px', maxHeight: 300, overflowY: 'auto' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>รายการที่จะถูกลบออกจากระบบ:</div>
          {preview.map(i => (
            <div key={i.id} style={{ fontSize: 13, color: 'var(--ink)', padding: '6px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <span style={{ flex: 1 }}>{i.equipment_type}</span>
              {i.cbh_code && <span style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'monospace' }}>{i.cbh_code}</span>}
            </div>
          ))}
          {extra > 0 && <div style={{ fontSize: 13, color: 'var(--muted)', paddingTop: 8 }}>และอีก {extra} รายการ</div>}
          <div style={{ fontSize: 13, color: 'var(--danger)', marginTop: 14, fontWeight: 500 }}>ข้อมูลที่ลบแล้วไม่สามารถกู้คืนได้</div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>ยกเลิก</button>
          <button onClick={handleDelete} disabled={loading} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'กำลังลบ...' : `ลบ ${ids.length} รายการ`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 160, flexShrink: 0, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--ink)', wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', letterSpacing: 1, textTransform: 'uppercase', margin: '18px 0 4px' }}>{children}</div>
}

function PhotoViewModal({ item, onClose }: { item: Equipment; onClose: () => void }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch(`/api/admin/equipment/${item.id}/photo`)
      .then(r => r.json())
      .then(d => { if (d.url) setPhotoUrl(d.url); else setErr('ไม่สามารถโหลดรูปได้') })
      .catch(() => setErr('เกิดข้อผิดพลาด'))
      .finally(() => setLoading(false))
  }, [item.id])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 680, boxShadow: '0 20px 60px rgba(0,0,0,.35)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{item.equipment_type}</div>
            {item.cbh_code && <div style={{ fontSize: 11.5, color: 'var(--primary)', fontFamily: 'monospace', marginTop: 2 }}>{item.cbh_code}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ padding: 20, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loading ? (
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'spin 0.7s linear infinite' }} />
          ) : err ? (
            <div style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</div>
          ) : photoUrl ? (
            <img src={photoUrl} alt={item.equipment_type} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8, objectFit: 'contain' }} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function EquipmentDetailModal({ item, onClose, onEdit }: {
  item: Equipment
  onClose: () => void
  onEdit?: (item: Equipment) => void
}) {
  const ws = warrantyStatus(item.warranty_exp)
  const [signedPhotoUrl, setSignedPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!item.photo_url) return
    fetch(`/api/admin/equipment/${item.id}/photo`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.url) setSignedPhotoUrl(d.url) })
      .catch(() => {})
  }, [item.id, item.photo_url])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.4 }}>{item.equipment_type}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {item.cbh_code && <span style={{ fontSize: 12, color: 'var(--primary)', fontFamily: 'monospace', background: 'var(--primary-soft)', padding: '2px 8px', borderRadius: 5 }}>{item.cbh_code}</span>}
              <Badge color={STATUS_BADGE[item.status]}>{item.status}</Badge>
              {item.risk_level && <Badge color={RISK_BADGE[item.risk_level as RiskLevel]}>{item.risk_level}</Badge>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {onEdit && (
              <button onClick={() => onEdit(item)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--ink)' }}>
                <Icon name="edit" size={13} /> แก้ไข
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
              <Icon name="x" size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '4px 24px 24px', overflow: 'auto', flex: 1 }}>
          <SectionTitle>ข้อมูลทั่วไป</SectionTitle>
          {item.photo_url && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, marginTop: 4 }}>
              {signedPhotoUrl
                ? <img src={signedPhotoUrl} alt={item.equipment_type} style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', padding: 8 }} />
                : <div style={{ width: 160, height: 100, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="flask" size={24} style={{ color: 'var(--muted)', opacity: .4 }} />
                  </div>
              }
            </div>
          )}
          <DetailRow label="แผนก" value={item.department} />
          <DetailRow label="เลขทะเบียนสินทรัพย์" value={item.hospital_asset_no} />
          <DetailRow label="LAB Code" value={item.cbh_code ? <span style={{ fontFamily: 'monospace' }}>{item.cbh_code}</span> : null} />
          <DetailRow label="Classification" value={item.classification} />
          <DetailRow label="ผู้รับผิดชอบ" value={item.responsible_person} />
          <DetailRow label="เจ้าของ" value={item.owner} />
          <DetailRow label="Owner Status" value={item.owner_status} />

          <SectionTitle>ผู้ผลิต / จำหน่าย</SectionTitle>
          <DetailRow label="Manufacturer" value={item.manufacturer} />
          <DetailRow label="Model" value={item.model} />
          <DetailRow label="Serial Number" value={item.serial_number ? <span style={{ fontFamily: 'monospace' }}>{item.serial_number}</span> : null} />
          <DetailRow label="Vendor" value={item.vendor} />

          <SectionTitle>การจัดซื้อ</SectionTitle>
          <DetailRow label="วันที่ซื้อ" value={formatDate(item.purchase_date)} />
          <DetailRow label="วันหมดประกัน" value={item.warranty_exp ? (
            <span style={{ color: ws === 'danger' ? 'var(--danger)' : ws === 'warn' ? 'var(--warning)' : 'var(--ink)', fontWeight: ws !== 'ok' ? 600 : 400 }}>
              {ws !== 'ok' && <Icon name="alert" size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
              {formatDate(item.warranty_exp)}
            </span>
          ) : null} />
          <DetailRow label="ราคาซื้อ (บาท)" value={item.purchase_price != null ? formatPrice(item.purchase_price) : null} />

          <SectionTitle>การสอบเทียบ</SectionTitle>
          <DetailRow label="ต้องการสอบเทียบ" value={item.needs_calibration ? <Badge color="blue" dot>ต้องการ</Badge> : <span style={{ color: 'var(--muted)', fontSize: 12 }}>ไม่ต้องการ</span>} />
          <DetailRow label="จุดประสงค์การใช้งาน" value={item.purpose} />

          {item.remark && (
            <>
              <SectionTitle>หมายเหตุ</SectionTitle>
              <div style={{ fontSize: 13, color: 'var(--ink)', padding: '8px 0', lineHeight: 1.6 }}>{item.remark}</div>
            </>
          )}

          {item.manual_url && (
            <>
              <SectionTitle>เอกสารประกอบ</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {([
                  { key: 'manual' as const, label: 'คู่มือการใช้งานเครื่องมือ', url: item.manual_url },
                ]).filter(d => d.url).map(d => (
                  <DocDownloadRow key={d.key} label={d.label} equipmentId={item.id} docType={d.key} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DocDownloadRow({ label, equipmentId, docType }: { label: string; equipmentId: string; docType: string }) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/equipment/${equipmentId}/docs?doc_type=${docType}`)
      if (!res.ok) return
      const { url } = await res.json()
      window.open(url, '_blank')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)' }}>
      <Icon name="doc" size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: 'var(--ink)', flex: 1 }}>{label}</span>
      <button onClick={handleDownload} disabled={loading}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 12, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', color: 'var(--primary)', opacity: loading ? .6 : 1 }}>
        <Icon name="download" size={12} />
        {loading ? 'กำลังโหลด...' : 'ดาวน์โหลด'}
      </button>
    </div>
  )
}

// ─── PM/CAL Modal ─────────────────────────────────────────────────────────────

const MONTH_EN  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_TH  = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

type PmCalData = NonNullable<Equipment['pm_cal_data']>

function emptyPmCal(): PmCalData {
  const plan: PmCalData['plan'] = {}
  MONTH_EN.forEach(m => { plan[m] = { pm: false, cal: false } })
  return { tech_group: null, times_pm: null, times_cal: null, plan, last_pm_date: null, last_cal_date: null, certificate_no: null, error_value: null, uncertainty: null, cal_result: null, remark: null, certificate_file_url: null }
}

function PmCalModal({ item, canEdit, onClose, onSaved }: {
  item: Equipment
  canEdit: boolean
  onClose: () => void
  onSaved: (updated: Equipment) => void
}) {
  const [editing, setEditing] = useState(!item.pm_cal_data && canEdit)
  const [form, setForm] = useState<PmCalData>(item.pm_cal_data ?? emptyPmCal())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const certFileRef = useRef<HTMLInputElement>(null)
  const currentFiscalYear = getCurrentThaiFiscalYear()

  async function handleCertUpload(file: File) {
    if (file.size > 50 * 1024 * 1024) { setErr('ขนาดไฟล์เกิน 50 MB'); return }
    setUploading(true); setErr('')
    try {
      // Step 1: ขอ presigned PUT URL จาก server (request เล็กมาก ไม่ติด Vercel limit)
      const presignRes = await fetch(`/api/admin/equipment/${item.id}/cert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileType: file.type || 'application/octet-stream', fileSize: file.size }),
      })
      const presignJson = await presignRes.json()
      if (!presignRes.ok) { setErr(presignJson.error ?? 'ไม่สามารถสร้าง URL อัพโหลดได้'); return }

      // Step 2: อัพโหลดไฟล์ตรงไปยัง R2 โดยไม่ผ่าน Vercel
      const uploadRes = await fetch(presignJson.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })
      if (!uploadRes.ok) { setErr('อัพโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่'); return }

      // Step 3: แจ้ง server ให้บันทึก key ลง DB
      const saveRes = await fetch(`/api/admin/equipment/${item.id}/cert`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: presignJson.key }),
      })
      const saveJson = await saveRes.json()
      if (!saveRes.ok) { setErr(saveJson.error ?? 'บันทึกไม่สำเร็จ'); return }

      const updated = { ...form, certificate_file_url: presignJson.key }
      setForm(updated)
      onSaved({ ...item, pm_cal_data: updated })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setUploading(false)
    }
  }

  async function handleCertDelete() {
    await fetch(`/api/admin/equipment/${item.id}/cert`, { method: 'DELETE' })
    const updated = { ...form, certificate_file_url: null }
    setForm(updated)
    onSaved({ ...item, pm_cal_data: updated })
  }

  const resultColor = (r: string | null) => {
    if (!r) return 'var(--muted)'
    if (r.toLowerCase() === 'pass') return 'var(--success)'
    if (r.toLowerCase().includes('fail')) return 'var(--danger)'
    return 'var(--muted)'
  }

  function togglePlan(month: string, type: 'pm' | 'cal') {
    setForm(f => ({
      ...f,
      plan: { ...f.plan, [month]: { ...f.plan[month], [type]: !f.plan[month]?.[type] } },
    }))
  }

  async function handleSave() {
    setSaving(true); setErr('')
    try {
      const res = await fetch(`/api/admin/equipment/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pm_cal_data: form }),
      })
      const json = await res.json()
      if (!res.ok) { setErr(json.error ?? 'เกิดข้อผิดพลาด'); return }
      onSaved({ ...item, pm_cal_data: form })
      setEditing(false)
    } finally { setSaving(false) }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '92vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{item.equipment_type}</div>
            <div style={{ fontSize: 12, color: 'var(--primary)', fontFamily: 'monospace' }}>{item.cbh_code ?? '—'} · {item.department}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--ink)' }}>
                <Icon name="edit" size={13} /> แก้ไข
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
              <Icon name="x" size={18} />
            </button>
          </div>
        </div>

        <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>
          {err && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>{err}</div>}

          {/* PM/CAL by info */}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>PM/CAL By</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              {editing ? (
                <>
                  <label style={lbl}>PM/CAL By</label>
                  <input style={inp} value={form.tech_group ?? ''} onChange={e => setForm(f => ({ ...f, tech_group: e.target.value || null }))} placeholder="เช่น Out source (ISO 17025), In house" />
                </>
              ) : (
                <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', height: '100%' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>PM/CAL By</div>
                  <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{form.tech_group || '—'}</div>
                </div>
              )}
            </div>
            <div>
              {editing ? (
                <>
                  <label style={lbl}>PM / ปี (ครั้ง)</label>
                  <input type="number" style={inp} value={form.times_pm ?? ''} onChange={e => setForm(f => ({ ...f, times_pm: e.target.value ? Number(e.target.value) : null }))} min={0} max={52} />
                </>
              ) : (
                <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>PM / ปี</div>
                  <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{form.times_pm ?? '—'} ครั้ง</div>
                </div>
              )}
            </div>
            <div>
              {editing ? (
                <>
                  <label style={lbl}>CAL / ปี (ครั้ง)</label>
                  <input type="number" style={inp} value={form.times_cal ?? ''} onChange={e => setForm(f => ({ ...f, times_cal: e.target.value ? Number(e.target.value) : null }))} min={0} max={52} />
                </>
              ) : (
                <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>CAL / ปี</div>
                  <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{form.times_cal ?? '—'} ครั้ง</div>
                </div>
              )}
            </div>
          </div>

          {/* Monthly plan */}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>แผน PM / CAL รายเดือน ปีงบประมาณ {currentFiscalYear}</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>เดือน</th>
                  <th style={{ padding: '9px 14px', textAlign: 'center', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>PM</th>
                  <th style={{ padding: '9px 14px', textAlign: 'center', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>CAL (สอบเทียบ)</th>
                </tr>
              </thead>
              <tbody>
                {MONTH_EN.map((en, i) => {
                  const p = form.plan?.[en] ?? { pm: false, cal: false }
                  return (
                    <tr key={en} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(241,244,249,.35)' }}>
                      <td style={{ padding: '8px 14px', fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{MONTH_TH[i]}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        {editing ? (
                          <button onClick={() => togglePlan(en, 'pm')} style={{ padding: '4px 18px', borderRadius: 6, border: `1.5px solid ${p.pm ? 'var(--primary)' : 'var(--border)'}`, background: p.pm ? 'var(--primary)' : 'transparent', color: p.pm ? '#fff' : 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}>
                            {p.pm ? '✓ วางแผน' : '—'}
                          </button>
                        ) : p.pm ? (
                          <span style={{ display: 'inline-block', padding: '3px 14px', borderRadius: 6, background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 700 }}>✓ วางแผน</span>
                        ) : <span style={{ color: 'var(--border)', fontSize: 16 }}>—</span>}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        {editing ? (
                          <button onClick={() => togglePlan(en, 'cal')} style={{ padding: '4px 18px', borderRadius: 6, border: `1.5px solid ${p.cal ? 'var(--success)' : 'var(--border)'}`, background: p.cal ? 'var(--success)' : 'transparent', color: p.cal ? '#fff' : 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}>
                            {p.cal ? '✓ วางแผน' : '—'}
                          </button>
                        ) : p.cal ? (
                          <span style={{ display: 'inline-block', padding: '3px 14px', borderRadius: 6, background: 'var(--success)', color: '#fff', fontSize: 12, fontWeight: 700 }}>✓ วางแผน</span>
                        ) : <span style={{ color: 'var(--border)', fontSize: 16 }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Result section */}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>ผลการดำเนินการล่าสุด</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {editing ? (
                <><label style={lbl}>วันที่ PM ล่าสุด</label><DateInput style={inp} value={form.last_pm_date} onChange={v => setForm(f => ({ ...f, last_pm_date: v }))} /></>
              ) : (
                <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>วันที่ PM ล่าสุด</div>
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>{form.last_pm_date ? formatDate(form.last_pm_date) : '—'}</div>
                </div>
              )}
            </div>
            <div>
              {editing ? (
                <><label style={lbl}>วันที่ CAL ล่าสุด</label><DateInput style={inp} value={form.last_cal_date} onChange={v => setForm(f => ({ ...f, last_cal_date: v }))} /></>
              ) : (
                <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>วันที่ CAL ล่าสุด</div>
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>{form.last_cal_date ? formatDate(form.last_cal_date) : '—'}</div>
                </div>
              )}
            </div>
            <div>
              {editing ? (
                <><label style={lbl}>Certificate No.</label><input style={inp} value={form.certificate_no ?? ''} onChange={e => setForm(f => ({ ...f, certificate_no: e.target.value || null }))} placeholder="DC_01/24/1531" /></>
              ) : (
                <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Certificate No.</div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', fontFamily: 'monospace' }}>{form.certificate_no || '—'}</div>
                </div>
              )}
            </div>
            <div>
              {editing ? (
                <><label style={lbl}>ผลสอบเทียบ</label>
                <select style={inp} value={form.cal_result ?? ''} onChange={e => setForm(f => ({ ...f, cal_result: e.target.value || null }))}>
                  <option value="">— เลือก —</option>
                  <option value="PASS">PASS</option>
                  <option value="FAIL">FAIL</option>
                  <option value="No cal">No cal</option>
                </select></>
              ) : (
                <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>ผลสอบเทียบ</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: resultColor(form.cal_result) }}>{form.cal_result || '—'}</div>
                </div>
              )}
            </div>
            <div>
              {editing ? (
                <><label style={lbl}>ค่า Error</label><input style={inp} value={form.error_value ?? ''} onChange={e => setForm(f => ({ ...f, error_value: e.target.value || null }))} /></>
              ) : form.error_value ? (
                <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>ค่า Error</div>
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>{form.error_value}</div>
                </div>
              ) : null}
            </div>
            <div>
              {editing ? (
                <><label style={lbl}>ค่า Uncertainty</label><input style={inp} value={form.uncertainty ?? ''} onChange={e => setForm(f => ({ ...f, uncertainty: e.target.value || null }))} /></>
              ) : form.uncertainty ? (
                <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>ค่า Uncertainty</div>
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>{form.uncertainty}</div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Certificate file */}
          <input ref={certFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleCertUpload(f); e.target.value = '' }} />
          <div
            style={{
              marginTop: 16, borderRadius: 10,
              border: `2px dashed ${dragOver ? 'var(--primary)' : canEdit ? 'var(--border)' : 'transparent'}`,
              background: dragOver ? 'var(--primary-soft)' : form.certificate_file_url || !canEdit ? 'var(--surface-2)' : 'transparent',
              transition: 'background .15s, border-color .15s',
            }}
            onDragOver={canEdit ? (e) => { e.preventDefault(); setDragOver(true) } : undefined}
            onDragLeave={canEdit ? () => setDragOver(false) : undefined}
            onDrop={canEdit ? (e) => {
              e.preventDefault(); setDragOver(false)
              const f = e.dataTransfer.files?.[0]
              if (f) handleCertUpload(f)
            } : undefined}
          >
            {!form.certificate_file_url && canEdit ? (
              /* Empty state — full drop zone */
              <div
                onClick={() => !uploading && certFileRef.current?.click()}
                style={{ padding: '22px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: uploading ? 'not-allowed' : 'pointer', userSelect: 'none' }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: dragOver ? 'rgba(30,95,173,.18)' : 'var(--surface-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background .15s',
                }}>
                  <Icon name="upload" size={22} style={{ color: dragOver ? 'var(--primary)' : 'var(--muted)' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: dragOver ? 'var(--primary)' : 'var(--ink)' }}>
                    {uploading ? 'กำลังอัพโหลด...' : dragOver ? 'วางไฟล์ที่นี่' : 'ลากไฟล์มาวาง หรือคลิกเพื่อเลือก'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>PDF, JPG, PNG, WEBP · ไม่เกิน 50 MB</div>
                </div>
              </div>
            ) : (
              /* Has file — compact row */
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icon name="doc" size={18} style={{ color: dragOver ? 'var(--primary)' : 'var(--primary)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 2 }}>ใบ Certificate</div>
                  {dragOver ? (
                    <div style={{ fontSize: 12.5, color: 'var(--primary)', fontWeight: 600 }}>วางไฟล์เพื่อเปลี่ยน...</div>
                  ) : form.certificate_file_url ? (
                    <>
                      <div style={{ fontSize: 12.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {form.certificate_file_url.split('/').pop()?.replace(/^\d+-/, '') ?? 'ไฟล์แนบ'}
                      </div>
                      {canEdit && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>ลากไฟล์มาวางเพื่อเปลี่ยน · ไม่เกิน 50 MB</div>}
                    </>
                  ) : (
                    <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>ยังไม่มีไฟล์</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {form.certificate_file_url && (
                    <button
                      onClick={async () => {
                        const res = await fetch(`/api/admin/equipment/${item.id}/cert`)
                        const { url } = await res.json()
                        if (url) window.open(url, '_blank')
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--ink)' }}
                    >
                      <Icon name="download" size={13} /> ดาวน์โหลด
                    </button>
                  )}
                  {canEdit && (
                    <>
                      <button
                        onClick={() => certFileRef.current?.click()}
                        disabled={uploading}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'inherit', color: uploading ? 'var(--muted)' : 'var(--primary)', opacity: uploading ? 0.6 : 1 }}
                      >
                        <Icon name="upload" size={13} /> {uploading ? 'กำลังอัพโหลด...' : 'เปลี่ยนไฟล์'}
                      </button>
                      {form.certificate_file_url && (
                        <button onClick={handleCertDelete} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
                          <Icon name="trash" size={13} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setForm(item.pm_cal_data ?? emptyPmCal()) }} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)' }}>ยกเลิก</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </>
          ) : (
            <button onClick={onClose} style={{ padding: '8px 24px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)' }}>ปิด</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const S_COLORS: Record<string, string> = {
  Active: '#16A34A', Inactive: '#94A3B8', ชำรุด: '#DC2626',
  มาใหม่: '#1E5FAD', ย้าย: '#8B5CF6', สูญหาย: '#D97706',
}
const R_COLORS: Record<string, string> = {
  High: '#DC2626', Medium: '#D97706', Low: '#0D9488', 'ไม่ระบุ': '#CBD5E1',
}

function EquipmentDashboard({ data }: { data: Equipment[] }) {
  const deptData = Object.entries(
    data.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.department]: (acc[e.department] ?? 0) + 1 }), {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([dept, count]) => ({ dept, count }))

  const statusData = Object.entries(
    data.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.status]: (acc[e.status] ?? 0) + 1 }), {})
  ).map(([name, value]) => ({ name, value, color: S_COLORS[name] ?? '#CBD5E1' }))

  const riskData = ['High', 'Medium', 'Low', 'ไม่ระบุ'].map(k => ({
    name: k, color: R_COLORS[k],
    value: data.filter(e => (e.risk_level ?? 'ไม่ระบุ') === k).length,
  })).filter(r => r.value > 0)

  const calYes = data.filter(e => !!e.pm_cal_data?.last_cal_date).length
  const calNo = data.length - calYes
  const calPct = data.length ? Math.round((calYes / data.length) * 100) : 0
  const calData = [
    { name: 'มีการสอบเทียบ', value: calYes, color: '#1E5FAD' },
    { name: 'ยังไม่มีข้อมูล', value: calNo, color: '#94A3B8' },
  ]

  const card: React.CSSProperties = {
    background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)',
    padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)', minWidth: 0,
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase',
    letterSpacing: .8, marginBottom: 14,
  }
  const tt = { contentStyle: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Row 1: dept + status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        <div style={card}>
          <div style={lbl}>เครื่องมือตามแผนก</div>
          <ResponsiveContainer width="100%" height={Math.max(240, deptData.length * 30)}>
            <BarChart data={deptData} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
              <YAxis type="category" dataKey="dept" tick={{ fontSize: 11, fill: '#64748B' }} width={140} />
              <Tooltip {...tt} cursor={{ fill: 'rgba(30,95,173,.05)' }} formatter={(v) => [v, 'เครื่องมือ']} />
              <Bar dataKey="count" fill="#1E5FAD" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={card}>
          <div style={lbl}>สถานะเครื่องมือ</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" outerRadius={78} innerRadius={42} dataKey="value" paddingAngle={2}>
                {statusData.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
              <Tooltip {...tt} formatter={(v, n) => [v, n]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
            {statusData.map(s => (
              <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ color: 'var(--ink)' }}>{s.name}</span>
                </div>
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: risk + calibration */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={card}>
          <div style={lbl}>ระดับความเสี่ยง</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={riskData} margin={{ top: 0, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
              <Tooltip {...tt} formatter={(v) => [v, 'เครื่องมือ']} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {riskData.map((r, i) => <Cell key={i} fill={r.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={card}>
          <div style={lbl}>การสอบเทียบ / PM</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={calData} cx="50%" cy="50%" outerRadius={68} innerRadius={36} dataKey="value" paddingAngle={3}>
                {calData.map((c, i) => <Cell key={i} fill={c.color} />)}
              </Pie>
              <Tooltip {...tt} formatter={(v, n) => [v, n]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {calData.map(c => (
              <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ color: 'var(--ink)' }}>{c.name}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.value}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>
                    {data.length ? `${Math.round((c.value / data.length) * 100)}%` : ''}
                  </span>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 4, padding: '10px 12px', borderRadius: 8, background: 'rgba(30,95,173,.07)', textAlign: 'center', border: '1px solid rgba(30,95,173,.15)' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#1E5FAD', lineHeight: 1 }}>{calPct}%</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>มีวันที่สอบเทียบล่าสุด</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Calibration Plan Tab ─────────────────────────────────────────────────────

interface CalRow {
  id?: string
  group: string
  name: string
  plan: number
  actual: number | null
  price: number | null
  budget: number
}

const CALPLAN_2566: CalRow[] = [
  { group: '1. ตู้ปลอดเชื้อ',   name: 'ตู้ปลอดเชื้อ (Biosafety Cabinet)',                    plan: 15, actual: 15, price: 60990,  budget: 914850 },
  { group: '2. ISO 15189',        name: 'เครื่องนึ่งฆ่าเชื้อ (Autoclave)',                     plan:  4, actual:  3, price:  1500,  budget:   4500 },
  { group: '2. ISO 15189',        name: 'เครื่องปั่นตกตะกอน (Centrifuge)',                     plan: 42, actual: 18, price:  null,  budget:  30000 },
  { group: '2. ISO 15189',        name: 'เครื่องปั่นเม็ดเลือด (Hematocrit)',                   plan:  5, actual:  2, price:  1500,  budget:   3000 },
  { group: '2. ISO 15189',        name: 'เครื่องเขย่าสาร (Rotator Shaker)',                    plan:  6, actual:  2, price:  1500,  budget:   3000 },
  { group: '2. ISO 15189',        name: 'อ่างน้ำควบคุม (Water Bath)',                          plan:  3, actual:  2, price:  1500,  budget:   3000 },
  { group: '2. ISO 15189',        name: 'ตู้เพาะเชื้อ (Incubator)',                            plan:  5, actual:  2, price:  1500,  budget:   3000 },
  { group: '2. ISO 15189',        name: 'เครื่องชั่งสาร (Analytical Balance)',                 plan:  4, actual:  1, price:  1500,  budget:   1500 },
  { group: '2. ISO 15189',        name: 'ตู้เย็นเก็บส่วนประกอบเลือด',                         plan: 10, actual:  9, price:  2000,  budget:  18000 },
  { group: '2. ISO 15189',        name: 'ตู้เย็นเก็บน้ำยา 2 ประตู',                           plan: 30, actual: 18, price:  2000,  budget:  36000 },
  { group: '2. ISO 15189',        name: 'Digital Thermometer',                                  plan: 50, actual:  8, price:   800,  budget:   6400 },
  { group: '2. ISO 15189',        name: 'Thermometer-Hygometer',                                plan: 20, actual:  6, price:   800,  budget:   4800 },
  { group: '2. ISO 15189',        name: 'Autopipette',                                          plan: 55, actual: 27, price:  1000,  budget:  27000 },
  { group: '2. ISO 15189',        name: 'Dry bath / Tube warmer / Heating block',               plan:  4, actual: null, price: 2000, budget:      0 },
  { group: '2. ISO 15189',        name: 'เครื่องบ่มเกร็ดเลือด (Platelet Incubator)',           plan:  0, actual:  0, price:  null,  budget:      0 },
  { group: '3. Osmometer',        name: 'Osmometer',                                            plan:  1, actual:  1, price: 14000,  budget:  14000 },
  { group: '4. Microbilirubin',   name: 'Microbilirubin Meter',                                 plan:  2, actual:  2, price: 12000,  budget:  24000 },
  { group: '5. กล้องจุลทรรศน์',  name: 'กล้องจุลทรรศน์ (Microscope)',                        plan: 25, actual: null, price: 30000, budget: 30000 },
  { group: '6. ระบบอุณหภูมิ',    name: 'ระบบบันทึกอุณหภูมิอัตโนมัติ',                        plan:  5, actual:  0, price: 38200,  budget:  38200 },
]

const CALPLAN_GROUPS = [
  '1. ตู้ปลอดเชื้อ', '2. ISO 15189', '3. Osmometer',
  '4. Microbilirubin', '5. กล้องจุลทรรศน์', '6. ระบบอุณหภูมิ',
]

function AddCalPlanModal({ onClose, onSaved, existingGroups }: {
  onClose: () => void
  onSaved: (row: CalRow) => void
  existingGroups: string[]
}) {
  const [form, setForm] = useState<Partial<CalRow> & { group: string; name: string; plan: number }>({
    group: existingGroups[0] ?? '', name: '', plan: 0, actual: null, price: null, budget: 0,
  })
  const [err, setErr] = useState('')

  function handleSave() {
    if (!form.name.trim()) { setErr('กรุณาระบุชื่อเครื่องมือ'); return }
    if (!form.group.trim()) { setErr('กรุณาระบุกลุ่ม'); return }
    onSaved({ group: form.group, name: form.name, plan: form.plan ?? 0, actual: form.actual ?? null, price: form.price ?? null, budget: form.budget ?? 0 })
  }

  const allGroups = Array.from(new Set([...CALPLAN_GROUPS, ...existingGroups]))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>เพิ่มแผนสอบเทียบ</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ padding: 24 }}>
          {err && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>{err}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>ชื่อเครื่องมือ / โครงการ <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น เครื่องวัดความดัน" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>กลุ่ม <span style={{ color: 'var(--danger)' }}>*</span></label>
              <select style={inputStyle} value={form.group} onChange={e => setForm(f => ({ ...f, group: e.target.value }))}>
                {allGroups.map(g => <option key={g} value={g}>{g}</option>)}
                <option value="อื่นๆ">อื่นๆ</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>แผน (เครื่อง)</label>
              <input type="number" style={inputStyle} min={0} value={form.plan ?? ''} onChange={e => setForm(f => ({ ...f, plan: Number(e.target.value) || 0 }))} />
            </div>
            <div>
              <label style={labelStyle}>สอบเทียบจริง (เครื่อง)</label>
              <input type="number" style={inputStyle} min={0} value={form.actual ?? ''} onChange={e => setForm(f => ({ ...f, actual: e.target.value ? Number(e.target.value) : null }))} placeholder="—" />
            </div>
            <div>
              <label style={labelStyle}>ราคา / เครื่อง (บาท)</label>
              <input type="number" style={inputStyle} min={0} value={form.price ?? ''} onChange={e => setForm(f => ({ ...f, price: e.target.value ? Number(e.target.value) : null }))} placeholder="—" />
            </div>
            <div>
              <label style={labelStyle}>งบประมาณที่ใช้ (บาท)</label>
              <input type="number" style={inputStyle} min={0} value={form.budget ?? ''} onChange={e => setForm(f => ({ ...f, budget: Number(e.target.value) || 0 }))} placeholder="0" />
            </div>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)' }}>ยกเลิก</button>
          <button onClick={handleSave} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>บันทึก</button>
        </div>
      </div>
    </div>
  )
}

function CalibrationPlanTab({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<CalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    fetch('/api/admin/equipment/calplan')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d) && d.length > 0) setRows(d.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          group: r.group_name as string,
          name: r.name as string,
          plan: r.plan as number,
          actual: r.actual as number | null,
          price: r.price as number | null,
          budget: r.budget as number,
        })))
        else if (Array.isArray(d) && d.length === 0) setRows(CALPLAN_2566)
      })
      .catch(() => setRows(CALPLAN_2566))
      .finally(() => setLoading(false))
  }, [])

  const chartData = rows.filter(r => r.plan > 0).map(r => ({
    name: r.name.length > 24 ? r.name.slice(0, 22) + '…' : r.name,
    แผน: r.plan,
    จริง: r.actual ?? 0,
  }))

  const totalPlan   = rows.reduce((s, r) => s + r.plan, 0)
  const totalActual = rows.reduce((s, r) => s + (r.actual ?? 0), 0)
  const totalBudget = rows.reduce((s, r) => s + r.budget, 0)
  const overallPct  = totalPlan ? Math.round((totalActual / totalPlan) * 100) : 0

  const pctColor = (pct: number) =>
    pct >= 100 ? '#16A34A' : pct >= 60 ? '#D97706' : '#DC2626'

  const card: React.CSSProperties = {
    background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)',
    padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase',
    letterSpacing: .8, marginBottom: 14,
  }
  const tt = { contentStyle: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } }

  if (loading) return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto' }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'แผนทั้งหมด',      value: `${totalPlan} เครื่อง`,  color: '#1E5FAD', bg: 'rgba(30,95,173,.07)',  border: 'rgba(30,95,173,.2)' },
          { label: 'สอบเทียบแล้ว',     value: `${totalActual} เครื่อง`, color: '#16A34A', bg: 'rgba(22,163,74,.07)',  border: 'rgba(22,163,74,.2)' },
          { label: '% สำเร็จโดยรวม',   value: `${overallPct}%`,          color: pctColor(overallPct), bg: `${pctColor(overallPct)}10`, border: `${pctColor(overallPct)}33` },
          { label: 'งบประมาณรวม',       value: `฿${totalBudget.toLocaleString()}`, color: '#7C3AED', bg: 'rgba(124,58,237,.07)', border: 'rgba(124,58,237,.2)' },
        ].map(s => (
          <div key={s.label} style={{ padding: '14px 16px', borderRadius: 10, background: s.bg, border: `1px solid ${s.border}` }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={card}>
        <div style={lbl}>แผน vs สอบเทียบจริง — จำนวนเครื่อง</div>
        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 36)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 40, left: 12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} width={200} />
            <Tooltip {...tt} />
            <Bar dataKey="แผน"  fill="#93C5FD" radius={[0, 3, 3, 0]} barSize={10} />
            <Bar dataKey="จริง" fill="#1E5FAD" radius={[0, 3, 3, 0]} barSize={10} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 20, marginTop: 12, justifyContent: 'center' }}>
          {[{ color: '#93C5FD', label: 'แผน' }, { color: '#1E5FAD', label: 'สอบเทียบจริง' }].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink)' }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: l.color, display: 'inline-block' }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* Detail table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={lbl}>รายละเอียดแผนการสอบเทียบ</div>
          {canEdit && (
            <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600 }}>
              <Icon name="plus" size={14} /> เพิ่มแผนสอบเทียบ
            </button>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                {['ชื่อเครื่องมือ / โครงการ', 'กลุ่ม', 'แผน', 'จริง', '% สำเร็จ', 'ราคา/เครื่อง', 'งบประมาณที่ใช้'].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap', letterSpacing: .5, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const pct = row.plan > 0 && row.actual != null ? Math.round((row.actual / row.plan) * 100) : null
                const c = pct != null ? pctColor(pct) : '#CBD5E1'
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{row.name}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, color: 'var(--primary)', background: 'var(--primary-soft)', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>{row.group}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', textAlign: 'center' }}>{row.plan}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: row.actual == null ? 'var(--muted)' : c, textAlign: 'center' }}>
                      {row.actual == null ? '—' : row.actual}
                    </td>
                    <td style={{ padding: '10px 14px', minWidth: 130 }}>
                      {pct != null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: c, borderRadius: 3, transition: 'width .4s' }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: c, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
                        </div>
                      ) : <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {row.price != null ? `฿${row.price.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--ink)', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {row.budget > 0 ? `฿${row.budget.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border)' }}>
                <td colSpan={2} style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>รวม</td>
                <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 800, color: '#1E5FAD', textAlign: 'center' }}>{totalPlan}</td>
                <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 800, color: '#16A34A', textAlign: 'center' }}>{totalActual}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(overallPct, 100)}%`, height: '100%', background: pctColor(overallPct), borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: pctColor(overallPct), minWidth: 36, textAlign: 'right' }}>{overallPct}%</span>
                  </div>
                </td>
                <td colSpan={2} style={{ padding: '10px 14px', fontSize: 13, fontWeight: 800, color: '#7C3AED', textAlign: 'right' }}>
                  ฿{totalBudget.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      {showAdd && (
        <AddCalPlanModal
          onClose={() => setShowAdd(false)}
          existingGroups={Array.from(new Set(rows.map(r => r.group)))}
          onSaved={async (row) => {
            const res = await fetch('/api/admin/equipment/calplan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ group_name: row.group, name: row.name, plan: row.plan, actual: row.actual, price: row.price, budget: row.budget, sort_order: rows.length + 1 }),
            })
            const saved = await res.json()
            if (res.ok) setRows(prev => [...prev, { ...row, id: saved.id }])
            setShowAdd(false)
          }}
        />
      )}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function EquipmentClient({
  initialData,
  initialTotal,
  initialPageSize,
  departments,
  classifications,
  statusCounts,
  initialSummaryCounts,
  canEdit,
  lastUpdated,
}: {
  initialData: Equipment[]
  initialTotal: number
  initialPageSize: number
  departments: string[]
  classifications: string[]
  statusCounts: Record<string, number>
  initialSummaryCounts: EquipmentSummaryCounts
  canEdit: boolean
  lastUpdated: string | null
}) {
  const [items, setItems] = useState<Equipment[]>(initialData)
  const [total, setTotal] = useState(initialTotal)
  const [pageSize, setPageSize] = useState(initialPageSize || EQUIPMENT_PAGE_SIZE)
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<EquipmentSortKey>('name')
  const [nameSort, setNameSort] = useState<'asc' | 'desc'>('asc')
  const [newItemId, setNewItemId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusTab, setStatusTab] = useState('')
  const [department, setDepartment] = useState('')
  const [classification, setClassification] = useState('')
  const [riskLevel, setRiskLevel] = useState('')
  const [needsCal, setNeedsCal] = useState('')
  const [pendingReg, setPendingReg] = useState(false)
  const [duplicateSN, setDuplicateSN] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [counts, setCounts] = useState<Record<string, number>>({ '': initialTotal, ...statusCounts })
  const [summaryCounts, setSummaryCounts] = useState<EquipmentSummaryCounts>(initialSummaryCounts)
  const [dashboardItems, setDashboardItems] = useState<Equipment[] | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [responsibleUsers, setResponsibleUsers] = useState<ResponsibleUser[]>([])

  const [view, setView] = useState<'list' | 'dashboard' | 'calplan'>('list')
  const [addModal, setAddModal] = useState(false)
  const [editItem, setEditItem] = useState<Equipment | null>(null)
  const [deleteItem, setDeleteItem] = useState<Equipment | null>(null)
  const [importModal, setImportModal] = useState(false)
  const [pmCalItem, setPmCalItem] = useState<Equipment | null>(null)
  const [detailItem, setDetailItem] = useState<Equipment | null>(null)
  const [photoViewItem, setPhotoViewItem] = useState<Equipment | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [exportMenu, setExportMenu] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [xlsxMenu, setXlsxMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const xlsxMenuRef = useRef<HTMLDivElement>(null)

  const { toasts, add: addToast } = useToast()

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), search ? 350 : 0)
    return () => clearTimeout(t)
  }, [search])

  const buildFilterParams = useCallback((includePaging: boolean) => {
    const params = new URLSearchParams()
    if (includePaging) {
      params.set('page', String(page))
      params.set('pageSize', String(pageSize || EQUIPMENT_PAGE_SIZE))
    }
    params.set('sortBy', sortKey)
    params.set('sortDir', nameSort)
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (statusTab) params.set('status', statusTab)
    if (department) params.set('department', department)
    if (classification) params.set('classification', classification)
    if (riskLevel) params.set('risk_level', riskLevel)
    if (needsCal) params.set('needs_calibration', needsCal)
    if (pendingReg) params.set('pending_reg', 'true')
    if (duplicateSN) params.set('duplicate_sn', 'true')
    return params
  }, [classification, debouncedSearch, department, duplicateSN, nameSort, needsCal, page, pageSize, pendingReg, riskLevel, sortKey, statusTab])

  const loadEquipmentList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/equipment?${buildFilterParams(true)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'โหลดข้อมูลไม่สำเร็จ')
      const parsed = parseEquipmentPayload(json)
      setItems(parsed.items ?? [])
      setTotal(Number(parsed.count ?? 0))
      setPageSize(Number(parsed.pageSize ?? EQUIPMENT_PAGE_SIZE))
      if (parsed.statusCounts) setCounts({ '': Number(parsed.statusCounts[''] ?? 0), ...parsed.statusCounts })
      if (parsed.summaryCounts) setSummaryCounts(parsed.summaryCounts)
    } catch {
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [buildFilterParams])

  useEffect(() => {
    setPage(1)
    setNewItemId(null)
  }, [debouncedSearch, statusTab, department, classification, riskLevel, needsCal, pendingReg, duplicateSN, sortKey, nameSort])

  useEffect(() => {
    void loadEquipmentList()
  }, [loadEquipmentList, reloadKey])

  useEffect(() => {
    fetch('/api/admin/equipment/responsible-users')
      .then(async res => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'โหลดรายชื่อผู้ใช้ไม่สำเร็จ')
        setResponsibleUsers(Array.isArray(json.users) ? json.users : [])
      })
      .catch(() => setResponsibleUsers([]))
  }, [])

  useEffect(() => {
    if (view !== 'dashboard' || dashboardItems) return
    setDashboardLoading(true)
    setDashboardError('')
    fetch('/api/admin/equipment?all=1&sortDir=asc')
      .then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? 'โหลด Dashboard ไม่สำเร็จ')
        setDashboardItems(parseEquipmentPayload(json).items ?? [])
      })
      .catch(err => {
        setDashboardItems([])
        setDashboardError((err as Error).message)
      })
      .finally(() => setDashboardLoading(false))
  }, [dashboardItems, view])

  // Departments for filter dropdown: merge hardcoded list + actual data (handles import name variants)
  const allDepts = Array.from(new Set([
    ...DEPARTMENTS,
    ...departments,
    ...initialData.map(i => i.department),
  ])).sort()

  function toggleSort(key: EquipmentSortKey) {
    if (sortKey === key) {
      setNameSort(dir => dir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setNameSort('asc')
    }
    setNewItemId(null)
  }

  function handleSaved(eq: Equipment) {
    setNewItemId(eq.id)
    setDashboardItems(null)
    setReloadKey(k => k + 1)
    setAddModal(false); setEditItem(null)
    addToast(editItem ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มเครื่องมือแล้ว')
  }

  function handleDeleted(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    setDashboardItems(null)
    setReloadKey(k => k + 1)
    setDeleteItem(null)
    addToast('ลบเครื่องมือแล้ว')
  }

  function handleBulkDeleted(ids: string[]) {
    setItems(prev => prev.filter(i => !ids.includes(i.id)))
    setSelectedIds(new Set())
    setBulkDeleteOpen(false)
    setDashboardItems(null)
    setReloadKey(k => k + 1)
    addToast(`ลบ ${ids.length} รายการแล้ว`)
  }

  function handleImported() {
    setImportModal(false)
    addToast('นำเข้าข้อมูลสำเร็จ')
    setPage(1)
    setDashboardItems(null)
    setReloadKey(k => k + 1)
  }

  // Close export dropdowns on outside click
  useEffect(() => {
    if (!exportMenu) return
    function handler(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [exportMenu])

  useEffect(() => {
    if (!xlsxMenu) return
    function handler(e: MouseEvent) {
      if (xlsxMenuRef.current && !xlsxMenuRef.current.contains(e.target as Node)) setXlsxMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [xlsxMenu])

  function buildEquipmentFilterLabel(scope: 'filtered' | 'all'): string {
    const filterParts: string[] = []
    if (scope === 'filtered') {
      if (department) filterParts.push(`แผนก: ${department}`)
      if (classification) filterParts.push(`Classification: ${classification}`)
      if (statusTab) filterParts.push(`สถานะ: ${statusTab}`)
      if (riskLevel) filterParts.push(`Risk: ${riskLevel}`)
      if (needsCal) filterParts.push(`สอบเทียบ: ${needsCal === 'true' ? 'ต้องการ' : 'ไม่ต้องการ'}`)
      if (pendingReg) filterParts.push('รอขึ้นทะเบียน')
      if (duplicateSN) filterParts.push('S/N · Asset No. ซ้ำ')
      if (debouncedSearch) filterParts.push(`ค้นหา: "${debouncedSearch}"`)
    } else if (department) {
      filterParts.push(`แผนก: ${department}`)
    }
    return filterParts.length ? filterParts.join('   ·   ') : 'แสดงเครื่องมือทั้งหมด'
  }

  async function downloadEquipmentPDF(scope: 'filtered' | 'all') {
    setExportMenu(false)
    setExportLoading(true)
    try {
      const params = new URLSearchParams({ all: '1', sortBy: sortKey, sortDir: nameSort })
      if (scope === 'filtered') {
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (statusTab) params.set('status', statusTab)
        if (department) params.set('department', department)
        if (classification) params.set('classification', classification)
        if (riskLevel) params.set('risk_level', riskLevel)
        if (needsCal) params.set('needs_calibration', needsCal)
        if (pendingReg) params.set('pending_reg', 'true')
        if (duplicateSN) params.set('duplicate_sn', 'true')
      }
      const data = await fetch(`/api/admin/equipment?${params}`).then(r => r.json())
      const rows = parseEquipmentPayload(data).items ?? []

      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const { sarabunBase64 } = await import('@/lib/fonts/sarabun-base64')

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      doc.addFileToVFS('Sarabun-Regular.ttf', sarabunBase64)
      doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal')
      doc.setFont('Sarabun')

      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const MX = 10          // left/right margin (mm)
      const HEADER_H = 28    // space reserved for the title block on every page
      const FOOTER_H = 14    // space reserved for the footer on every page

      const fmtD = (s: string | null) =>
        s ? new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
      const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
      const filterLabel = buildEquipmentFilterLabel(scope)

      const body = rows.map((eq, i) => [
        String(i + 1),
        eq.equipment_type ?? '—',
        eq.model ?? '—',
        eq.cbh_code_pending ? 'รอขึ้นทะเบียน' : (eq.cbh_code ?? '—'),
        eq.status ?? '—',
        fmtD(eq.pm_cal_data?.last_cal_date ?? null),
        eq.responsible_person ?? '—',
      ])

      autoTable(doc, {
        startY: HEADER_H,
        margin: { top: HEADER_H, bottom: FOOTER_H, left: MX, right: MX },
        head: [['ลำดับ', 'ชื่อเครื่องมือ', 'Model', 'รหัส LAB', 'สถานะ', 'วันที่สอบเทียบล่าสุด', 'ผู้รับผิดชอบ']],
        body: body.length
          ? body
          : [[{ content: 'ไม่พบข้อมูลตามตัวกรอง', colSpan: 7, styles: { halign: 'center', textColor: [120, 120, 120] as [number, number, number] } }]],
        theme: 'grid',
        styles: { font: 'Sarabun', fontSize: 9, cellPadding: 1.4, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'normal', halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: {
          0: { cellWidth: 14, halign: 'center', textColor: [90, 90, 90] },
          1: { cellWidth: 'auto', halign: 'left' },
          2: { cellWidth: 34, halign: 'center', textColor: [70, 70, 70] },
          3: { cellWidth: 32, halign: 'center' },
          4: { cellWidth: 22, halign: 'center' },
          5: { cellWidth: 34, halign: 'center', textColor: [70, 70, 70] },
          6: { cellWidth: 42, halign: 'center', textColor: [70, 70, 70] },
        },
      })

      // Draw header block + footer on every page (after generation, so total page count is known)
      const totalPages = doc.getNumberOfPages()
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p)
        doc.setFont('Sarabun', 'normal')

        // Header block
        doc.setTextColor(0, 0, 0)
        doc.setFontSize(15)
        doc.text('บัญชีรายการเครื่องมือ (Master List)', pageW / 2, 11, { align: 'center' })
        doc.setFontSize(12)
        doc.text('กลุ่มงานเทคนิคการแพทย์โรงพยาบาลชลบุรี', pageW / 2, 17, { align: 'center' })
        doc.setFontSize(8)
        doc.setTextColor(90, 90, 90)
        doc.text(filterLabel, MX, 23, { maxWidth: pageW - MX * 2 - 60 })
        doc.text(`วันที่พิมพ์: ${today}`, pageW - MX, 23, { align: 'right' })

        // Footer
        const fy = pageH - 9
        doc.setDrawColor(180, 180, 180)
        doc.setLineWidth(0.1)
        doc.line(MX, fy - 4, pageW - MX, fy - 4)
        doc.setTextColor(110, 110, 110)
        doc.setFontSize(8)
        doc.text(`หน้า ${p} / ${totalPages}`, MX, fy)
        doc.text('Fm-QP-LAB-01/EQ', pageW - MX, fy, { align: 'right' })
        doc.setFontSize(7)
        doc.text('เอกสารนี้เป็นสมบัติของกลุ่มงานเทคนิคการแพทย์โรงพยาบาลชลบุรี ห้ามนำออกไปใช้ภายนอกหรือทำซ้ำโดยไม่ได้รับอนุญาต', pageW / 2, fy, { align: 'center' })
        doc.setTextColor(0, 0, 0)
      }

      const stamp = new Date().toISOString().slice(0, 10)
      doc.save(`equipment-master-list-${stamp}.pdf`)
    } catch {
      addToast('ไม่สามารถ Export PDF ได้', false)
    } finally {
      setExportLoading(false)
    }
  }

  function handleExportXlsx(scope: 'filtered' | 'all') {
    setXlsxMenu(false)
    const params = new URLSearchParams({ sortBy: sortKey, sortDir: nameSort })
    if (scope === 'filtered') {
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (statusTab) params.set('status', statusTab)
      if (department) params.set('department', department)
      if (classification) params.set('classification', classification)
      if (riskLevel) params.set('risk_level', riskLevel)
      if (needsCal) params.set('needs_calibration', needsCal)
      if (pendingReg) params.set('pending_reg', 'true')
      if (duplicateSN) params.set('duplicate_sn', 'true')
    }
    const a = document.createElement('a')
    a.href = `/api/admin/equipment/export?${params}`
    a.click()
  }

  // CSV export
  function handleExport() {
    const headers = ['LAB Code', 'เลขทะเบียนสินทรัพย์', 'แผนก', 'ชื่อเครื่องมือ', 'Manufacturer', 'Model', 'Serial Number', 'Vendor', 'Risk', 'สถานะ', 'ต้องการสอบเทียบ', 'ผู้รับผิดชอบ', 'วันที่ซื้อ', 'วันหมดประกัน', 'ราคา', 'หมายเหตุ']
    const rows = items.map(i => [
      i.cbh_code ?? '', i.hospital_asset_no ?? '', i.department, i.equipment_type,
      i.manufacturer ?? '', i.model ?? '', i.serial_number ?? '', i.vendor ?? '',
      i.risk_level ?? '', i.status, i.needs_calibration ? 'ต้องการ' : 'ไม่ต้องการ',
      i.responsible_person ?? '', i.purchase_date ?? '', i.warranty_exp ?? '',
      i.purchase_price != null ? String(i.purchase_price) : '', i.remark ?? '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `equipment-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // Counts for tabs
  const tabCounts = STATUS_TABS.reduce<Record<string, number>>((acc, t) => {
    acc[t.value] = counts[t.value] ?? 0
    return acc
  }, {})

  const totalPages = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)))
  const safePage = Math.min(page, totalPages)
  const pageStart = total ? (safePage - 1) * pageSize + 1 : 0
  const pageEnd = Math.min(safePage * pageSize, total)
  const activeCount = summaryCounts.active
  const highRiskCount = summaryCounts.highRisk
  const warrantyAlertCount = summaryCounts.warrantyAlert
  const calCount = summaryCounts.needsCalibration

  const SUMMARY_STATS = [
    { label: 'ใช้งานอยู่', value: activeCount, icon: 'shieldCheck', color: 'var(--success)', bg: 'linear-gradient(135deg, rgba(22,163,74,.12), rgba(240,253,244,.86))', border: 'rgba(22,163,74,.22)' },
    { label: 'High Risk', value: highRiskCount, icon: 'alert', color: 'var(--danger)', bg: 'linear-gradient(135deg, rgba(220,38,38,.11), rgba(254,242,242,.88))', border: 'rgba(220,38,38,.22)' },
    { label: 'ประกันใกล้หมด', value: warrantyAlertCount, icon: 'clock', color: 'var(--warning)', bg: 'linear-gradient(135deg, rgba(217,119,6,.12), rgba(255,251,235,.9))', border: 'rgba(217,119,6,.22)' },
    { label: 'ต้องการ PM/CAL', value: calCount, icon: 'settings', color: 'var(--primary)', bg: 'linear-gradient(135deg, rgba(30,95,173,.12), rgba(239,246,255,.92))', border: 'rgba(30,95,173,.22)' },
  ]

  const renderPagination = (position: 'top' | 'bottom') => (
    <div className={`eq-pagination eq-pagination-${position}`} style={{ marginBottom: position === 'top' ? 10 : 0, marginTop: position === 'bottom' ? 12 : 0 }}>
      <div className="eq-pagination-info">
        แสดง {pageStart.toLocaleString('th-TH')}-{pageEnd.toLocaleString('th-TH')} จาก {total.toLocaleString('th-TH')} รายการ
      </div>
      <div className="eq-pagination-actions">
        <Button variant="secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1 || loading}>ก่อนหน้า</Button>
        <span className="eq-page-chip">
          หน้า {safePage.toLocaleString('th-TH')} / {totalPages.toLocaleString('th-TH')}
        </span>
        <Button variant="secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages || loading}>ถัดไป</Button>
      </div>
    </div>
  )

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const TAB_DOT: Record<string, string> = {
    Active: 'var(--success)', Inactive: 'var(--muted)', ชำรุด: 'var(--danger)',
    มาใหม่: 'var(--primary)', ย้าย: '#8B5CF6', สูญหาย: 'var(--warning)',
  }

  return (
    <div className="eq-page-shell" style={{ padding: '0 0 48px' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes eqFadeUp { from { opacity: 0; transform: translateY(5px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes toastIn { from { opacity: 0; transform: translateX(12px) } to { opacity: 1; transform: translateX(0) } }
        .eq-page-shell { position: relative; isolation: isolate; }
        .eq-page-shell::before { content: ''; position: fixed; inset: 0; pointer-events: none; z-index: -1; background:
          radial-gradient(circle at 12% 4%, rgba(37,99,235,.10), transparent 26rem),
          radial-gradient(circle at 86% 12%, rgba(14,165,233,.10), transparent 24rem),
          linear-gradient(180deg, rgba(248,251,255,.75), transparent 18rem);
        }
        .eq-header-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .eq-soft-button { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border); background: rgba(255,255,255,.82); cursor: pointer; font-size: 13px; font-family: inherit; color: var(--ink); box-shadow: 0 1px 2px rgba(15,23,42,.04); transition: transform .14s ease, border-color .14s ease, box-shadow .14s ease, background .14s ease; }
        .eq-soft-button:hover { transform: translateY(-1px); border-color: rgba(30,95,173,.35); box-shadow: 0 8px 22px rgba(15,23,42,.08); }
        .eq-view-switcher { display: flex; gap: 4px; margin-bottom: 18px; background: rgba(255,255,255,.74); border: 1px solid rgba(148,163,184,.22); border-radius: 12px; padding: 4px; width: fit-content; box-shadow: 0 8px 26px rgba(15,23,42,.05); backdrop-filter: blur(10px); }
        .eq-view-button { display: flex; align-items: center; gap: 7px; padding: 7px 16px; border-radius: 9px; border: none; background: transparent; color: var(--muted); font-weight: 600; font-size: 13px; cursor: pointer; font-family: inherit; transition: color .15s, background .15s, box-shadow .15s, transform .15s; }
        .eq-view-button:hover { color: var(--primary); }
        .eq-view-button.is-active { background: var(--card); color: var(--primary); box-shadow: 0 2px 10px rgba(15,23,42,.08); transform: translateY(-1px); }
        .eq-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(150px, 1fr)); gap: 12px; margin-bottom: 18px; }
        .eq-stat { position: relative; overflow: hidden; display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; box-shadow: 0 10px 30px rgba(15,23,42,.06); transition: transform .15s, box-shadow .15s, border-color .15s; }
        .eq-stat::after { content: ''; position: absolute; right: -22px; top: -34px; width: 86px; height: 86px; border-radius: 999px; background: currentColor; opacity: .08; }
        .eq-stat:hover { transform: translateY(-2px); box-shadow: 0 14px 34px rgba(15,23,42,.10) !important; }
        .eq-stat-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(255,255,255,.68); box-shadow: inset 0 0 0 1px rgba(255,255,255,.68), 0 6px 16px rgba(15,23,42,.06); }
        .eq-status-tabs { display: flex; gap: 4px; flex-wrap: nowrap; overflow-x: auto; margin-bottom: 0; padding: 5px; border: 1px solid rgba(148,163,184,.2); border-radius: 12px 12px 0 0; background: rgba(255,255,255,.72); }
        .eq-status-tab { display: flex; align-items: center; gap: 7px; padding: 8px 13px; border: none; border-radius: 9px; background: transparent; color: var(--muted); font-weight: 600; font-size: 13px; cursor: pointer; font-family: inherit; transition: all .15s; white-space: nowrap; }
        .eq-status-tab:hover { color: var(--primary); background: rgba(30,95,173,.06); }
        .eq-status-tab.is-active { background: var(--card); color: var(--primary); box-shadow: 0 2px 10px rgba(15,23,42,.08); }
        .eq-filter-panel { display: flex; gap: 8px; flex-wrap: wrap; margin: -1px 0 14px; padding: 12px 14px; background: rgba(255,255,255,.78); border: 1px solid rgba(148,163,184,.2); border-top: none; border-radius: 0 0 12px 12px; align-items: center; box-shadow: 0 14px 30px rgba(15,23,42,.045); }
        .eq-search-box { flex: 1 1 240px; min-width: 180px; }
        .eq-filter-select { padding: 9px 12px; border-radius: 9px; border: 1px solid var(--border); font-size: 13px; font-family: inherit; color: var(--ink); background: var(--card); cursor: pointer; outline: none; transition: border-color .14s, box-shadow .14s, transform .14s; }
        .eq-filter-select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(30,95,173,.10); outline: none; }
        .eq-filter-select:hover { border-color: rgba(30,95,173,.28); }
        .eq-pending-toggle { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 9px; cursor: pointer; font-family: inherit; font-size: 13px; border: 1px solid var(--border); background: var(--card); color: var(--muted); font-weight: 600; transition: all .15s; }
        .eq-pending-toggle:hover { border-color: rgba(217,119,6,.32); color: var(--warning); }
        .eq-pending-toggle.is-active { border-color: var(--warning); background: rgba(217,119,6,.1); color: var(--warning); font-weight: 800; }
        .eq-pagination { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 2px 2px; }
        .eq-pagination-info { font-size: 12px; color: var(--muted); font-weight: 800; letter-spacing: .01em; }
        .eq-pagination-actions { display: flex; align-items: center; gap: 8px; }
        .eq-page-chip { min-width: 94px; text-align: center; color: var(--primary); background: var(--primary-soft); border: 1px solid rgba(30,95,173,.14); border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 900; }
        .eq-table-card { overflow: hidden; border-color: rgba(148,163,184,.24) !important; box-shadow: 0 18px 42px rgba(15,23,42,.07); }
        .eq-table { width: 100%; border-collapse: separate !important; border-spacing: 0; }
        .eq-table thead th { position: sticky; top: 0; z-index: 5; background: linear-gradient(180deg, #F8FBFF, #EFF5FC) !important; border-bottom: 1px solid rgba(148,163,184,.28); }
        .eq-row { transition: background .12s, box-shadow .12s, transform .12s; cursor: pointer; }
        .eq-row:hover { background: linear-gradient(90deg, rgba(30,95,173,.07), rgba(255,255,255,.92)) !important; box-shadow: inset 3px 0 0 var(--primary); }
        .eq-actions { opacity: 1; }
        .eq-code-badge { display: inline-flex; align-items: center; font-size: 10.5px; padding: 3px 9px; border-radius: 999px; font-weight: 800; box-shadow: inset 0 0 0 1px rgba(255,255,255,.5); }
        .eq-toast { animation: toastIn .22s ease both; }
        .eq-risk-hint { position: relative; display: inline-flex; align-items: center; }
        .eq-risk-hint-btn { width: 17px; height: 17px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface-2); color: var(--muted); font-size: 11px; font-weight: 800; line-height: 1; cursor: help; font-family: inherit; padding: 0; }
        .eq-risk-hint-btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
        .eq-risk-hint-popover { position: absolute; left: 50%; bottom: calc(100% + 9px); transform: translateX(-50%) translateY(4px); width: min(440px, calc(100vw - 48px)); display: flex; flex-direction: column; gap: 9px; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--border); background: var(--card); box-shadow: 0 14px 40px rgba(15,23,42,.18); color: var(--ink); font-size: 12px; font-weight: 500; line-height: 1.55; opacity: 0; pointer-events: none; visibility: hidden; transition: opacity .14s ease, transform .14s ease, visibility .14s ease; z-index: 1200; text-transform: none; letter-spacing: 0; }
        .eq-risk-hint-popover::after { content: ''; position: absolute; left: 50%; bottom: -6px; width: 10px; height: 10px; transform: translateX(-50%) rotate(45deg); background: var(--card); border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }
        .eq-risk-hint:hover .eq-risk-hint-popover,
        .eq-risk-hint:focus-within .eq-risk-hint-popover { opacity: 1; pointer-events: auto; visibility: visible; transform: translateX(-50%) translateY(0); }
        @media (max-width: 920px) {
          .eq-stat-grid { grid-template-columns: repeat(2, minmax(150px, 1fr)); }
          .eq-header-actions { justify-content: flex-start; }
        }
        @media (max-width: 620px) {
          .eq-stat-grid { grid-template-columns: 1fr; }
          .eq-view-switcher { width: 100%; }
          .eq-view-button { flex: 1; justify-content: center; padding-left: 10px; padding-right: 10px; }
          .eq-pagination { justify-content: center; }
          .eq-pagination-info { width: 100%; text-align: center; }
        }
      `}</style>

      <PageHeader
        title="ทะเบียนเครื่องมือ"
        eyebrow={lastUpdated ? `${total.toLocaleString('th-TH')} รายการ · อัปเดตล่าสุด ${new Date(lastUpdated).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}` : `${total.toLocaleString('th-TH')} รายการ`}
        marginBottom={16}
        actions={
          <div className="eq-header-actions">
            {/* Export Excel split button */}
            <div ref={xlsxMenuRef} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', border: '1.5px solid rgba(22,163,74,.35)', borderRadius: 8, overflow: 'hidden', background: 'rgba(22,163,74,.07)' }}>
                <button
                  onClick={() => handleExportXlsx('filtered')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'transparent', border: 'none', fontSize: 13, fontFamily: 'inherit', color: 'var(--success)', cursor: 'pointer', fontWeight: 600 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(22,163,74,.10)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Icon name="download" size={13} />
                  Export Excel
                </button>
                <button
                  onClick={() => setXlsxMenu(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', padding: '8px 8px', background: 'transparent', border: 'none', borderLeft: '1.5px solid rgba(22,163,74,.20)', cursor: 'pointer', color: 'var(--success)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(22,163,74,.10)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Icon name="chevDown" size={12} />
                </button>
              </div>
              {xlsxMenu && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 200, minWidth: 200, overflow: 'hidden' }}>
                  <button onClick={() => handleExportXlsx('filtered')}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'transparent', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--ink)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    Export ตามตัวกรองปัจจุบัน
                  </button>
                  <button onClick={() => handleExportXlsx('all')}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'transparent', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--ink)', borderTop: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    Export ทุกรายการ
                  </button>
                </div>
              )}
            </div>
            {/* Export PDF split button */}
            <div ref={exportMenuRef} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', border: '1.5px solid rgba(30,95,173,.35)', borderRadius: 8, overflow: 'hidden', background: 'rgba(30,95,173,.07)' }}>
                <button
                  onClick={() => downloadEquipmentPDF('filtered')}
                  disabled={exportLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'transparent', border: 'none', fontSize: 13, fontFamily: 'inherit', color: 'var(--primary)', cursor: exportLoading ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: exportLoading ? .6 : 1 }}
                  onMouseEnter={e => { if (!exportLoading) e.currentTarget.style.background = 'rgba(30,95,173,.10)' }}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Icon name="download" size={13} />
                  {exportLoading ? 'กำลัง Export...' : 'Export PDF'}
                </button>
                <button
                  onClick={() => setExportMenu(v => !v)}
                  disabled={exportLoading}
                  style={{ display: 'flex', alignItems: 'center', padding: '8px 8px', background: 'transparent', border: 'none', borderLeft: '1.5px solid rgba(30,95,173,.20)', cursor: exportLoading ? 'not-allowed' : 'pointer', color: 'var(--primary)' }}
                  onMouseEnter={e => { if (!exportLoading) e.currentTarget.style.background = 'rgba(30,95,173,.10)' }}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Icon name="chevDown" size={12} />
                </button>
              </div>
              {exportMenu && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 200, minWidth: 200, overflow: 'hidden' }}>
                  <button onClick={() => downloadEquipmentPDF('filtered')}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'transparent', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--ink)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    Export ตามตัวกรองปัจจุบัน
                  </button>
                  <button onClick={() => downloadEquipmentPDF('all')}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'transparent', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--ink)', borderTop: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    Export ทุกรายการ
                  </button>
                </div>
              )}
            </div>
            {canEdit && (
              <>
                <button
                  onClick={() => setImportModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1.5px solid rgba(217,119,6,.35)', background: 'rgba(217,119,6,.07)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--warning)', fontWeight: 600, whiteSpace: 'nowrap' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(217,119,6,.13)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(217,119,6,.07)')}
                >
                  <Icon name="upload" size={14} /> นำเข้า Excel
                </button>
                <Button variant="primary" icon="plus" onClick={() => setAddModal(true)} style={{ fontWeight: 600 }}>เพิ่มเครื่องมือ</Button>
              </>
            )}
          </div>
        }
      />

      {/* View switcher */}
      <div className="eq-view-switcher">
        {([['dashboard', 'chart', 'Dashboard'], ['list', 'beaker', 'รายการ'], ['calplan', 'clock', 'แผนสอบเทียบ']] as const).map(([key, icon, label]) => (
          <button key={key} onClick={() => setView(key)} className={`eq-view-button ${view === key ? 'is-active' : ''}`}>
            <Icon name={icon} size={14} /> {label}
          </button>
        ))}
      </div>

      {view === 'dashboard' && (
        dashboardLoading || dashboardItems === null ? (
          <div style={{ padding: 42, textAlign: 'center', color: 'var(--muted)' }}>กำลังโหลด Dashboard...</div>
        ) : dashboardError ? (
          <div style={{ padding: 16, borderRadius: 12, border: '1px solid #FCA5A5', color: '#B91C1C', background: '#FEF2F2' }}>{dashboardError}</div>
        ) : (
          <EquipmentDashboard data={dashboardItems ?? []} />
        )
      )}

      {view === 'calplan' && <CalibrationPlanTab canEdit={canEdit} />}

      {view === 'list' && <>

      {/* Summary stat strip */}
      <div className="eq-stat-grid">
        {SUMMARY_STATS.map(s => (
          <div key={s.label} className="eq-stat" style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
            <div className="eq-stat-icon">
              <Icon name={s.icon} size={17} stroke={2} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, lineHeight: 1.2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Status Tabs — underline style */}
      <div className="eq-status-tabs">
        {STATUS_TABS.map(t => {
          const isActive = statusTab === t.value
          return (
            <button
              key={t.value}
              onClick={() => setStatusTab(t.value)}
              className={`eq-status-tab ${isActive ? 'is-active' : ''}`}
            >
              {t.value && (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: TAB_DOT[t.value] ?? 'var(--muted)', display: 'inline-block', flexShrink: 0, opacity: isActive ? 1 : 0.55 }} />
              )}
              {t.label}
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 20,
                background: isActive ? 'var(--primary-soft)' : 'var(--surface-2)',
                color: isActive ? 'var(--primary)' : 'var(--muted)',
                transition: 'all .15s',
              }}>
                {tabCounts[t.value] ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filter row */}
      <div className="eq-filter-panel">
        <Icon name="filter" size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
        <div className="eq-search-box">
          <Input value={search} onChange={setSearch} placeholder="ค้นหาชื่อ, LAB, Serial, ผู้รับผิดชอบ..." />
        </div>
        <select value={department} onChange={e => setDepartment(e.target.value)} className="eq-filter-select" style={{ minWidth: 148 }}>
          <option value="">ทุกแผนก</option>
          {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={classification} onChange={e => setClassification(e.target.value)} className="eq-filter-select" style={{ minWidth: 148 }}>
          <option value="">ทุก Classification</option>
          {classifications.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={riskLevel} onChange={e => setRiskLevel(e.target.value)} className="eq-filter-select" style={{ minWidth: 118 }}>
          <option value="">ทุก Risk</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <select value={needsCal} onChange={e => setNeedsCal(e.target.value)} className="eq-filter-select" style={{ minWidth: 156 }}>
          <option value="">สอบเทียบ: ทั้งหมด</option>
          <option value="true">ต้องการสอบเทียบ</option>
          <option value="false">ไม่ต้องการ</option>
        </select>
        <button
          onClick={() => setPendingReg(v => !v)}
          className={`eq-pending-toggle ${pendingReg ? 'is-active' : ''}`}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: pendingReg ? 'var(--warning)' : 'var(--border)', flexShrink: 0, display: 'inline-block' }} />
          รอขึ้นทะเบียน
        </button>
        <button
          onClick={() => setDuplicateSN(v => !v)}
          className={`eq-pending-toggle ${duplicateSN ? 'is-active' : ''}`}
          style={duplicateSN ? { borderColor: 'rgba(220,38,38,.35)', background: 'rgba(220,38,38,.07)', color: 'var(--danger)' } : undefined}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: duplicateSN ? 'var(--danger)' : 'var(--border)', flexShrink: 0, display: 'inline-block' }} />
          S/N · Asset No. ซ้ำ
        </button>
      </div>

      {renderPagination('top')}

      {/* Bulk selection bar */}
      {canEdit && selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.20)', borderRadius: 10, marginBottom: 10 }}>
          <Icon name="check" size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>เลือก {selectedIds.size} รายการ</span>
          <button onClick={() => setSelectedIds(new Set())} style={{ fontSize: 12, color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 4px', fontFamily: 'inherit' }}>ล้างการเลือก</button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setBulkDeleteOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(220,38,38,.35)', background: 'rgba(220,38,38,.08)', color: 'var(--danger)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,38,38,.14)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(220,38,38,.08)')}
          >
            <Icon name="trash" size={13} /> ลบที่เลือก
          </button>
        </div>
      )}

      {/* Table */}
      <Card padding={0} className="eq-table-card">
        {loading && (
          <div style={{ padding: '20px' }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '13px 14px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                <div style={{ width: 200, height: 13, borderRadius: 4, background: 'var(--surface-2)' }} />
                <div style={{ width: 80, height: 13, borderRadius: 4, background: 'var(--surface-2)' }} />
                <div style={{ flex: 1, height: 13, borderRadius: 4, background: 'var(--surface-2)' }} />
                <div style={{ width: 50, height: 22, borderRadius: 20, background: 'var(--surface-2)' }} />
                <div style={{ width: 60, height: 22, borderRadius: 20, background: 'var(--surface-2)' }} />
              </div>
            ))}
          </div>
        )}
        {!loading && items.length === 0 && (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Icon name="beaker" size={28} style={{ color: 'var(--muted)' }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>ไม่พบข้อมูลเครื่องมือ</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>ลองเปลี่ยนตัวกรองหรือค้นหาด้วยคำอื่น</div>
          </div>
        )}
        {!loading && items.length > 0 && (
          <StickyScroll>
            <table className="eq-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                  {canEdit && (
                    <th style={{ padding: '9px 10px 9px 14px', width: 36 }} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={items.length > 0 && items.every(i => selectedIds.has(i.id))}
                        ref={el => { if (el) el.indeterminate = items.some(i => selectedIds.has(i.id)) && !items.every(i => selectedIds.has(i.id)) }}
                        onChange={() => {
                          const allSelected = items.every(i => selectedIds.has(i.id))
                          setSelectedIds(prev => {
                            const n = new Set(prev)
                            items.forEach(i => allSelected ? n.delete(i.id) : n.add(i.id))
                            return n
                          })
                        }}
                        style={{ cursor: 'pointer', accentColor: 'var(--danger)', width: 15, height: 15 }}
                      />
                    </th>
                  )}
                  <th
                    onClick={() => toggleSort('code')}
                    style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: sortKey === 'code' ? 'var(--primary)' : 'var(--muted)', whiteSpace: 'nowrap', letterSpacing: .6, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                  >
                    รหัส {sortKey === 'code' ? (nameSort === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th
                    onClick={() => toggleSort('name')}
                    style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap', letterSpacing: .6, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                  >
                    ชื่อเครื่องมือ {sortKey === 'name' ? (nameSort === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  {['แผนก', 'Manufacturer / Model', 'Serial No.', 'Risk', 'ผู้รับผิดชอบ', 'PM/CAL', 'สถานะ', ''].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap', letterSpacing: .6, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...items].sort((a, b) => {
                  if (a.id === newItemId) return -1
                  if (b.id === newItemId) return 1
                  return compareEquipment(a, b, sortKey, nameSort)
                }).map((item, idx) => (
                    <tr
                      key={item.id}
                      className="eq-row"
                      onClick={() => setDetailItem(item)}
                      style={{ borderBottom: '1px solid var(--border)', animation: idx < 12 ? `eqFadeUp .2s ease ${idx * 22}ms both` : undefined }}
                    >
                      {/* Checkbox */}
                      {canEdit && (
                        <td style={{ padding: '11px 10px 11px 14px', width: 36 }} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => setSelectedIds(prev => {
                              const n = new Set(prev)
                              n.has(item.id) ? n.delete(item.id) : n.add(item.id)
                              return n
                            })}
                            style={{ cursor: 'pointer', accentColor: 'var(--danger)', width: 15, height: 15 }}
                          />
                        </td>
                      )}
                      {/* LAB Code */}
                      <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                        <span
                          className="eq-code-badge"
                          style={{
                            fontSize: 10.5, fontFamily: item.cbh_code_pending ? 'inherit' : 'monospace',
                            color: item.cbh_code_pending ? 'var(--warning)' : 'var(--primary)',
                            background: item.cbh_code_pending ? 'rgba(217,119,6,.10)' : 'var(--primary-soft)',
                            border: `1px solid ${item.cbh_code_pending ? 'rgba(217,119,6,.24)' : 'transparent'}`,
                            letterSpacing: item.cbh_code_pending ? 0 : .3,
                          }}
                        >
                          {labCodeLabel(item)}
                        </span>
                      </td>
                      {/* Name */}
                      <td style={{ padding: '11px 14px', minWidth: 220, maxWidth: 280 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>{item.equipment_type}</div>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                          {item.hospital_asset_no && (
                            <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: duplicateSN ? 'var(--danger)' : 'var(--muted)', background: duplicateSN ? 'rgba(220,38,38,.08)' : 'transparent', padding: duplicateSN ? '1px 5px' : undefined, borderRadius: duplicateSN ? 3 : undefined, fontWeight: duplicateSN ? 600 : undefined }}>{item.hospital_asset_no}</span>
                          )}
                        </div>
                      </td>
                      {/* Department */}
                      <td style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{item.department}</td>
                      {/* Manufacturer / Model */}
                      <td style={{ padding: '11px 14px', minWidth: 140 }}>
                        <div style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 500 }}>{item.manufacturer ?? <span style={{ color: 'var(--border)' }}>—</span>}</div>
                        {item.model && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{item.model}</div>}
                      </td>
                      {/* Serial */}
                      <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                        {item.serial_number
                          ? <span style={{ fontSize: 11.5, fontFamily: 'monospace', color: duplicateSN ? 'var(--danger)' : 'var(--muted)', background: duplicateSN ? 'rgba(220,38,38,.08)' : 'transparent', padding: duplicateSN ? '2px 6px' : undefined, borderRadius: duplicateSN ? 4 : undefined, fontWeight: duplicateSN ? 600 : undefined }}>{item.serial_number}</span>
                          : <span style={{ color: 'var(--border)', fontFamily: 'monospace', fontSize: 11.5 }}>—</span>}
                      </td>
                      {/* Risk */}
                      <td style={{ padding: '11px 14px' }}>
                        {item.risk_level
                          ? <Badge color={RISK_BADGE[item.risk_level as RiskLevel]}>{item.risk_level}</Badge>
                          : <span style={{ color: 'var(--border)', fontSize: 16 }}>—</span>}
                      </td>
                      {/* Responsible */}
                      <td style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{item.responsible_person ?? <span style={{ color: 'var(--border)' }}>—</span>}</td>
                      {/* Calibration */}
                      <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                        {item.needs_calibration
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--primary)', fontWeight: 600, background: 'var(--primary-soft)', padding: '3px 8px', borderRadius: 6 }}>
                              <Icon name="check" size={11} stroke={2.2} /> ต้องการ
                            </span>
                          : <span style={{ color: 'var(--border)', fontSize: 16 }}>—</span>}
                      </td>
                      {/* Status */}
                      <td style={{ padding: '11px 14px' }}>
                        <Badge color={STATUS_BADGE[item.status]}>{item.status}</Badge>
                      </td>
                      {/* Actions — fade in on row hover */}
                      <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                        <div className="eq-actions" style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => setPmCalItem(item)} title="ดู PM/CAL" style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary)', fontSize: 11.5, fontFamily: 'inherit', fontWeight: 600 }}>
                            <Icon name="clock" size={12} /> PM/CAL
                          </button>
                          {item.photo_url && (
                            <button
                              title="ดูรูปถ่ายเครื่องมือ"
                              onClick={() => setPhotoViewItem(item)}
                              style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}
                            >
                              <Icon name="eye" size={13} />
                            </button>
                          )}
                          {item.pm_cal_data?.certificate_file_url && (
                            <button
                              title="ดาวน์โหลดใบ Certificate"
                              onClick={async () => {
                                const res = await fetch(`/api/admin/equipment/${item.id}/cert`)
                                const { url } = await res.json()
                                if (url) window.open(url, '_blank')
                              }}
                              style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}
                            >
                              <Icon name="download" size={13} />
                            </button>
                          )}
                          {canEdit && (
                            <>
                              <button onClick={() => setEditItem(item)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                                <Icon name="edit" size={13} />
                              </button>
                              <button onClick={() => setDeleteItem(item)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
                                <Icon name="trash" size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </StickyScroll>
        )}
      </Card>

      {items.length > 0 && renderPagination('bottom')}

      </>}

      {/* Modals */}
      {(addModal || editItem) && (
        <EquipmentModal
          item={editItem ?? null}
          onClose={() => { setAddModal(false); setEditItem(null) }}
          onSaved={handleSaved}
          departments={allDepts}
          responsibleUsers={responsibleUsers}
        />
      )}
      {deleteItem && <DeleteConfirm item={deleteItem} onClose={() => setDeleteItem(null)} onDeleted={handleDeleted} />}
      {bulkDeleteOpen && <BulkDeleteConfirm ids={[...selectedIds]} allItems={items} onClose={() => setBulkDeleteOpen(false)} onDeleted={handleBulkDeleted} />}
      {importModal && <ImportModal onClose={() => setImportModal(false)} onImported={handleImported} />}
      {detailItem && <EquipmentDetailModal item={detailItem} onClose={() => setDetailItem(null)} onEdit={canEdit ? (i) => { setDetailItem(null); setEditItem(i) } : undefined} />}
      {photoViewItem && <PhotoViewModal item={photoViewItem} onClose={() => setPhotoViewItem(null)} />}
      {pmCalItem && (
        <PmCalModal
          item={pmCalItem}
          canEdit={canEdit}
          onClose={() => setPmCalItem(null)}
          onSaved={updated => {
            setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
            setPmCalItem(updated)
          }}
        />
      )}

      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 2000 }}>
        {toasts.map(t => (
          <div key={t.id} className="eq-toast" style={{ padding: '12px 18px', borderRadius: 10, background: t.ok ? 'var(--success)' : 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 6px 24px rgba(0,0,0,.22)', minWidth: 200, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name={t.ok ? 'check' : 'alert'} size={14} stroke={2.2} />
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
