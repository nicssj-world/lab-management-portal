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
import type { Equipment } from '@/lib/queries/equipment'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

// ─── types ────────────────────────────────────────────────────────────────────

type EquipmentStatus = Equipment['status']
type RiskLevel = 'High' | 'Medium' | 'Low'

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

// ─── blank form ───────────────────────────────────────────────────────────────

const BLANK: Partial<Equipment> = {
  item_no: null, cbh_code: '', cbh_code_pending: false, hospital_asset_no: '', hospital_asset_no_pending: false, department: '',
  owner: 'รพ', owner_status: '', risk_level: null, classification: '',
  equipment_type: '', manufacturer: '', model: '', serial_number: '',
  vendor: '', purchase_date: null, warranty_exp: null, purchase_price: null,
  status: 'Active', needs_calibration: false, responsible_person: '', purpose: '', remark: '',
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

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

function EquipmentModal({
  item, onClose, onSaved, departments,
}: {
  item: Partial<Equipment> | null
  onClose: () => void
  onSaved: (eq: Equipment) => void
  departments: string[]
}) {
  const isEdit = !!item?.id
  const [form, setForm] = useState<Partial<Equipment>>(item ?? BLANK)
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
        if (presignErr) { setErr(presignErr); return }
        await fetch(uploadUrl, { method: 'PUT', body: photoFile, headers: { 'Content-Type': photoFile.type } })
        const saveRes = await fetch(`/api/admin/equipment/${json.id}/photo`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        })
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
          if (presignErr) { setErr(presignErr); return }
          await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
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
                <label style={{ ...labelStyle, marginBottom: 0 }}>รหัส CBH</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--warning)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form.cbh_code_pending} onChange={e => { set('cbh_code_pending', e.target.checked); if (e.target.checked) set('cbh_code', null) }} style={{ accentColor: 'var(--warning)', width: 13, height: 13, cursor: 'pointer' }} />
                  รอขึ้นทะเบียน
                </label>
              </div>
              <input style={{ ...inputStyle, opacity: form.cbh_code_pending ? 0.4 : 1 }} disabled={!!form.cbh_code_pending} value={form.cbh_code ?? ''} onChange={e => set('cbh_code', e.target.value || null)} placeholder="CBH3367" />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>เลขทะเบียนสินทรัพย์ รพ.</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--warning)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form.hospital_asset_no_pending} onChange={e => { set('hospital_asset_no_pending', e.target.checked); if (e.target.checked) set('hospital_asset_no', null) }} style={{ accentColor: 'var(--warning)', width: 13, height: 13, cursor: 'pointer' }} />
                  รอขึ้นทะเบียน
                </label>
              </div>
              <input style={{ ...inputStyle, opacity: form.hospital_asset_no_pending ? 0.4 : 1 }} disabled={!!form.hospital_asset_no_pending} value={form.hospital_asset_no ?? ''} onChange={e => set('hospital_asset_no', e.target.value || null)} placeholder="6515-047-0001/1/36" />
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
              <input style={inputStyle} value={form.responsible_person ?? ''} onChange={e => set('responsible_person', e.target.value || null)} placeholder="ชื่อผู้รับผิดชอบ" />
            </div>
            <div>
              <label style={labelStyle}>Classification</label>
              <input style={inputStyle} value={form.classification ?? ''} onChange={e => set('classification', e.target.value || null)} placeholder="Diagnostic / Misc other" />
            </div>
            <div>
              <label style={labelStyle}>ระดับความเสี่ยง</label>
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
              <input style={inputStyle} value={form.owner ?? ''} onChange={e => set('owner', e.target.value || null)} placeholder="รพ" />
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
              <input type="date" style={inputStyle} value={form.purchase_date ?? ''} onChange={e => set('purchase_date', e.target.value || null)} />
            </div>
            <div>
              <label style={labelStyle}>วันหมดประกัน</label>
              <input type="date" style={inputStyle} value={form.warranty_exp ?? ''} onChange={e => set('warranty_exp', e.target.value || null)} />
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
  const [preview, setPreview] = useState<{ count: number; rows: Partial<Equipment>[] } | null>(null)
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
    else setPreview(json)
    setLoading(false)
  }

  async function handleImport() {
    if (!file) return
    setImporting(true); setErr('')
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/admin/equipment/import', { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) { setErr(json.error ?? 'เกิดข้อผิดพลาด'); setImporting(false); return }
    setImporting(false)
    onImported()
  }

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
            <br />Column ที่รองรับ: CBH Code, Hospital Asset No, Department, Risk, Equipment Type, Manufacturer, Model, Serial Number, Equipment Vendor, Purchase Date, Warranty Exp, Purchase Price, Status, Remark, ผู้รับผิดชอบ, ต้องการสอบเทียบ
          </div>

          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => { setFile(e.target.files?.[0] ?? null); setPreview(null) }} />
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
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      {['Equipment Type', 'Department', 'CBH Code', 'Manufacturer', 'Status'].map(h => (
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
            <button onClick={handleImport} disabled={importing} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--success)', color: '#fff', cursor: importing ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', opacity: importing ? 0.6 : 1 }}>
              {importing ? 'กำลังนำเข้า...' : `นำเข้า ${preview.count} รายการ`}
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
          <DetailRow label="CBH Code" value={item.cbh_code ? <span style={{ fontFamily: 'monospace' }}>{item.cbh_code}</span> : null} />
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
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>แผน PM / CAL รายเดือน ปี 2569</div>
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
                <><label style={lbl}>วันที่ PM ล่าสุด</label><input type="date" style={inp} value={form.last_pm_date ?? ''} onChange={e => setForm(f => ({ ...f, last_pm_date: e.target.value || null }))} /></>
              ) : (
                <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>วันที่ PM ล่าสุด</div>
                  <div style={{ fontSize: 13, color: 'var(--ink)' }}>{form.last_pm_date ? formatDate(form.last_pm_date) : '—'}</div>
                </div>
              )}
            </div>
            <div>
              {editing ? (
                <><label style={lbl}>วันที่ CAL ล่าสุด</label><input type="date" style={inp} value={form.last_cal_date ?? ''} onChange={e => setForm(f => ({ ...f, last_cal_date: e.target.value || null }))} /></>
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
    padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)',
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
  canEdit,
  lastUpdated,
}: {
  initialData: Equipment[]
  canEdit: boolean
  lastUpdated: string | null
}) {
  const [items, setItems] = useState<Equipment[]>(initialData)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusTab, setStatusTab] = useState('')
  const [department, setDepartment] = useState('')
  const [riskLevel, setRiskLevel] = useState('')
  const [needsCal, setNeedsCal] = useState('')
  const [pendingReg, setPendingReg] = useState(false)
  const [loading, setLoading] = useState(false)

  const [view, setView] = useState<'list' | 'dashboard' | 'calplan'>('list')
  const [addModal, setAddModal] = useState(false)
  const [editItem, setEditItem] = useState<Equipment | null>(null)
  const [deleteItem, setDeleteItem] = useState<Equipment | null>(null)
  const [importModal, setImportModal] = useState(false)
  const [pmCalItem, setPmCalItem] = useState<Equipment | null>(null)
  const [detailItem, setDetailItem] = useState<Equipment | null>(null)
  const [photoViewItem, setPhotoViewItem] = useState<Equipment | null>(null)
  const [exportMenu, setExportMenu] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  const { toasts, add: addToast } = useToast()

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), search ? 350 : 0)
    return () => clearTimeout(t)
  }, [search])

  // Fetch when filters change
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (statusTab) params.set('status', statusTab)
    if (department) params.set('department', department)
    if (riskLevel) params.set('risk_level', riskLevel)
    if (needsCal) params.set('needs_calibration', needsCal)
    if (pendingReg) params.set('pending_reg', 'true')

    fetch(`/api/admin/equipment?${params}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setItems(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [debouncedSearch, statusTab, department, riskLevel, needsCal, pendingReg])

  // Departments for filter dropdown: merge hardcoded list + actual data (handles import name variants)
  const allDepts = Array.from(new Set([
    ...DEPARTMENTS,
    ...initialData.map(i => i.department),
  ])).sort()

  function handleSaved(eq: Equipment) {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === eq.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = eq; return next }
      return [eq, ...prev]
    })
    setAddModal(false); setEditItem(null)
    addToast(editItem ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มเครื่องมือแล้ว')
  }

  function handleDeleted(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    setDeleteItem(null)
    addToast('ลบเครื่องมือแล้ว')
  }

  function handleImported() {
    setImportModal(false)
    addToast('นำเข้าข้อมูลสำเร็จ')
    // Reload full list
    fetch('/api/admin/equipment')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setItems(d) })
      .catch(() => {})
  }

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportMenu) return
    function handler(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [exportMenu])

  function buildEquipmentMasterListHTML(data: Equipment[], scope: 'filtered' | 'all'): string {
    const fmtD = (s: string | null) =>
      s ? new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
    const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

    const filterParts: string[] = []
    if (scope === 'filtered') {
      if (department) filterParts.push(`แผนก: ${department}`)
      if (statusTab) filterParts.push(`สถานะ: ${statusTab}`)
      if (debouncedSearch) filterParts.push(`ค้นหา: "${debouncedSearch}"`)
    } else if (department) {
      filterParts.push(`แผนก: ${department}`)
    }

    const ROWS_PER_PAGE = 20
    const pages: (Equipment | null)[][] = []
    for (let i = 0; i < Math.max(data.length, 1); i += ROWS_PER_PAGE) {
      pages.push(data.slice(i, i + ROWS_PER_PAGE))
    }

    const theadHtml = `<thead><tr>
      <th class="c" style="width:40px">ลำดับ</th>
      <th class="l col-fill">ชื่อเครื่องมือ</th>
      <th class="c" style="width:130px">Model</th>
      <th class="c" style="width:100px">รหัส CBH</th>
      <th class="c" style="width:75px">สถานะ</th>
      <th class="c" style="width:120px">วันที่สอบเทียบล่าสุด</th>
      <th class="c" style="width:120px">ผู้รับผิดชอบ</th>
    </tr></thead>`

    let rowIdx = 1
    const pagesHtml = pages.map((page, pageIndex) => {
      const isLastPage = pageIndex === pages.length - 1
      const filledRows = [...page]
      if (!isLastPage) {
        while (filledRows.length < ROWS_PER_PAGE) filledRows.push(null)
      }
      const tbodyHtml = filledRows.map((eq) => {
        if (!eq) return `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`
        return `<tr>
          <td class="c muted">${rowIdx++}</td>
          <td class="l wrap col-fill">${eq.equipment_type}</td>
          <td class="c muted">${eq.model ?? '—'}</td>
          <td class="c mono">${eq.cbh_code_pending ? 'รอขึ้นทะเบียน' : (eq.cbh_code ?? '—')}</td>
          <td class="c">${eq.status}</td>
          <td class="c muted">${fmtD(eq.pm_cal_data?.last_cal_date ?? null)}</td>
          <td class="c muted">${eq.responsible_person ?? '—'}</td>
        </tr>`
      }).join('')
      return `
        <div class="page">
          <div class="page-header">
            <div class="main-title">บัญชีรายการเครื่องมือ (Master List)</div>
            <div class="sub-title">กลุ่มงานเทคนิคการแพทย์โรงพยาบาลชลบุรี</div>
            <div class="meta-row">
              <span>${filterParts.length ? filterParts.join(' · ') : 'แสดงเครื่องมือทั้งหมด'}</span>
              <span>วันที่พิมพ์: ${today}</span>
            </div>
          </div>
          <table>${theadHtml}<tbody>${tbodyHtml}</tbody></table>
          <div class="page-footer">
            <span class="footer-spacer"></span>
            <span class="footer-center">เอกสารนี้เป็นสมบัติของกลุ่มงานเทคนิคการแพทย์โรงพยาบาลชลบุรี ห้ามนำออกไปใช้ภายนอกหรือทำซ้ำโดยไม่ได้รับอนุญาต</span>
            <span class="footer-right">Fm-QP-LAB-01/EQ</span>
          </div>
        </div>`
    }).join('')

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>บัญชีรายการเครื่องมือ</title><style>
      @page { size: A4 portrait; margin: 8mm 10mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'TH Sarabun New','Sarabun','Cordia New',Arial,sans-serif; font-size: 10pt; color: #000; }
      .page { page-break-after: always; display: flex; flex-direction: column; height: 277mm; }
      .page:last-child { page-break-after: avoid; }
      .page-header { text-align: center; margin-bottom: 6px; flex-shrink: 0; }
      .main-title { font-size: 16pt; font-weight: bold; line-height: 1.5; }
      .sub-title  { font-size: 13pt; font-weight: bold; line-height: 1.4; }
      .meta-row   { display: flex; justify-content: space-between; font-size: 9pt; color: #555; margin-top: 3px; padding: 0 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 4px; flex-shrink: 0; table-layout: fixed; }
      .col-fill { width: auto; }
      th, td { border: 1px solid #000; padding: 3px 5px; font-size: 10pt; height: 23px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
      th { background: #f0f0f0; font-weight: bold; text-align: center; }
      .c { text-align: center; }
      .l { text-align: left; }
      .wrap { white-space: normal; overflow: visible; text-overflow: clip; word-break: break-word; height: auto; min-height: 23px; vertical-align: top; padding-top: 4px; padding-bottom: 4px; }
      .muted { color: #444; }
      .mono { font-family: monospace; font-size: 9pt; }
      .page-footer { display: flex; align-items: center; font-size: 9pt; color: #666; margin-top: auto; padding-top: 3px; border-top: 1px solid #bbb; flex-shrink: 0; }
      .footer-spacer { flex: 1; }
      .footer-center { flex: 0 1 auto; text-align: center; }
      .footer-right { flex: 1; text-align: right; white-space: nowrap; }
    </style></head><body>${pagesHtml}</body></html>`
  }

  async function downloadEquipmentPDF(scope: 'filtered' | 'all') {
    setExportMenu(false)
    setExportLoading(true)
    try {
      const params = new URLSearchParams({ pageSize: '9999' })
      if (scope === 'filtered') {
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (statusTab) params.set('status', statusTab)
        if (department) params.set('department', department)
        if (riskLevel) params.set('risk_level', riskLevel)
        if (needsCal) params.set('needs_calibration', needsCal)
        if (pendingReg) params.set('pending_reg', 'true')
      }
      const data = await fetch(`/api/admin/equipment?${params}`).then(r => r.json())
      const allItems: Equipment[] = Array.isArray(data) ? data : []
      const html = buildEquipmentMasterListHTML(allItems, scope)
      const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
      const win = window.open(blobUrl, '_blank')
      if (!win) { URL.revokeObjectURL(blobUrl); return }
      win.addEventListener('load', () => { win.print(); URL.revokeObjectURL(blobUrl) }, { once: true })
    } catch {
      addToast('ไม่สามารถ Export PDF ได้', false)
    } finally {
      setExportLoading(false)
    }
  }

  // CSV export
  function handleExport() {
    const headers = ['CBH Code', 'เลขทะเบียนสินทรัพย์', 'แผนก', 'ชื่อเครื่องมือ', 'Manufacturer', 'Model', 'Serial Number', 'Vendor', 'Risk', 'สถานะ', 'ต้องการสอบเทียบ', 'ผู้รับผิดชอบ', 'วันที่ซื้อ', 'วันหมดประกัน', 'ราคา', 'หมายเหตุ']
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
    acc[t.value] = t.value ? initialData.filter(i => i.status === t.value).length : initialData.length
    return acc
  }, {})

  const activeCount = items.filter(i => i.status === 'Active').length
  const highRiskCount = items.filter(i => i.risk_level === 'High').length
  const warrantyAlertCount = items.filter(i => { const ws = warrantyStatus(i.warranty_exp); return ws === 'warn' || ws === 'danger' }).length
  const calCount = items.filter(i => i.needs_calibration).length

  const SUMMARY_STATS = [
    { label: 'ใช้งานอยู่', value: activeCount, color: 'var(--success)', bg: 'rgba(22,163,74,.07)', border: 'rgba(22,163,74,.2)' },
    { label: 'High Risk', value: highRiskCount, color: 'var(--danger)', bg: 'rgba(220,38,38,.07)', border: 'rgba(220,38,38,.2)' },
    { label: 'ประกันใกล้หมด', value: warrantyAlertCount, color: 'var(--warning)', bg: 'rgba(217,119,6,.07)', border: 'rgba(217,119,6,.2)' },
    { label: 'ต้องการ PM/CAL', value: calCount, color: 'var(--primary)', bg: 'var(--primary-soft)', border: 'rgba(30,95,173,.2)' },
  ]

  const TAB_DOT: Record<string, string> = {
    Active: 'var(--success)', Inactive: 'var(--muted)', ชำรุด: 'var(--danger)',
    มาใหม่: 'var(--primary)', ย้าย: '#8B5CF6', สูญหาย: 'var(--warning)',
  }

  return (
    <div style={{ padding: '0 0 48px' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes eqFadeUp { from { opacity: 0; transform: translateY(5px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes toastIn { from { opacity: 0; transform: translateX(12px) } to { opacity: 1; transform: translateX(0) } }
        .eq-row { transition: background .12s, box-shadow .12s; cursor: pointer; }
        .eq-row:hover { background: var(--surface-2) !important; box-shadow: inset 3px 0 0 var(--primary); }
        .eq-actions { opacity: 1; }
        .eq-stat { transition: transform .15s, box-shadow .15s; }
        .eq-stat:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.08) !important; }
        .eq-toast { animation: toastIn .22s ease both; }
        .eq-filter-select { padding: 9px 12px; border-radius: 8px; border: 1px solid var(--border); font-size: 13px; font-family: inherit; color: var(--ink); background: var(--card); cursor: pointer; outline: none; }
        .eq-filter-select:focus { border-color: var(--primary); outline: none; }
      `}</style>

      <PageHeader
        title="ทะเบียนเครื่องมือ"
        eyebrow={lastUpdated ? `${items.length} รายการ · อัปเดตล่าสุด ${new Date(lastUpdated).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}` : `${items.length} รายการ`}
        marginBottom={16}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Export PDF split button */}
            <div ref={exportMenuRef} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <button
                  onClick={() => downloadEquipmentPDF('filtered')}
                  disabled={exportLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'transparent', border: 'none', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', cursor: exportLoading ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: exportLoading ? .6 : 1 }}
                >
                  <Icon name="download" size={13} />
                  {exportLoading ? 'กำลัง Export...' : 'Export PDF'}
                </button>
                <button
                  onClick={() => setExportMenu(v => !v)}
                  disabled={exportLoading}
                  style={{ display: 'flex', alignItems: 'center', padding: '8px 8px', background: 'transparent', border: 'none', borderLeft: '1px solid var(--border)', cursor: exportLoading ? 'not-allowed' : 'pointer', color: 'var(--muted)' }}
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
                <button onClick={() => setImportModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)' }}>
                  <Icon name="upload" size={14} /> นำเข้า Excel
                </button>
                <Button variant="primary" icon="plus" onClick={() => setAddModal(true)}>เพิ่มเครื่องมือ</Button>
              </>
            )}
          </div>
        }
      />

      {/* View switcher */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 20, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, width: 'fit-content' }}>
        {([['dashboard', 'chart', 'Dashboard'], ['list', 'beaker', 'รายการ'], ['calplan', 'clock', 'แผนสอบเทียบ']] as const).map(([key, icon, label]) => (
          <button key={key} onClick={() => setView(key)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 8, border: 'none',
            background: view === key ? 'var(--card)' : 'transparent',
            color: view === key ? 'var(--primary)' : 'var(--muted)',
            fontWeight: view === key ? 700 : 500, fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: view === key ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
            transition: 'all .15s',
          }}>
            <Icon name={icon} size={14} /> {label}
          </button>
        ))}
      </div>

      {view === 'dashboard' && <EquipmentDashboard data={initialData} />}

      {view === 'calplan' && <CalibrationPlanTab canEdit={canEdit} />}

      {view === 'list' && <>

      {/* Summary stat strip */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {SUMMARY_STATS.map(s => (
          <div key={s.label} className="eq-stat" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 10, background: s.bg, border: `1px solid ${s.border}`, boxShadow: '0 1px 3px rgba(0,0,0,.04)', minWidth: 130, flex: '1 1 130px', maxWidth: 200 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, lineHeight: 1.2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Status Tabs — underline style */}
      <div style={{ display: 'flex', gap: 0, flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 0, borderBottom: '1px solid var(--border)' }}>
        {STATUS_TABS.map(t => {
          const isActive = statusTab === t.value
          return (
            <button
              key={t.value}
              onClick={() => setStatusTab(t.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', border: 'none', borderRadius: 0,
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                background: 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--muted)',
                fontWeight: isActive ? 700 : 500, fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'color .15s, border-color .15s',
                whiteSpace: 'nowrap', marginBottom: -1,
              }}
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
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0 14px', padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 10, alignItems: 'center' }}>
        <Icon name="filter" size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
        <div style={{ flex: '1 1 200px', minWidth: 160 }}>
          <Input value={search} onChange={setSearch} placeholder="ค้นหาชื่อ, CBH, Serial, ผู้รับผิดชอบ..." />
        </div>
        <select value={department} onChange={e => setDepartment(e.target.value)} className="eq-filter-select" style={{ minWidth: 148 }}>
          <option value="">ทุกแผนก</option>
          {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
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
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
            border: `1px solid ${pendingReg ? 'var(--warning)' : 'var(--border)'}`,
            background: pendingReg ? 'rgba(217,119,6,.1)' : 'var(--card)',
            color: pendingReg ? 'var(--warning)' : 'var(--muted)',
            fontWeight: pendingReg ? 700 : 400,
            transition: 'all .15s',
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: pendingReg ? 'var(--warning)' : 'var(--border)', flexShrink: 0, display: 'inline-block' }} />
          รอขึ้นทะเบียน
        </button>
      </div>

      {/* Table */}
      <Card padding={0}>
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
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border)' }}>
                  {[
                    'ชื่อเครื่องมือ', 'แผนก', 'Manufacturer / Model',
                    'Serial No.', 'Risk', 'ประกัน', 'ผู้รับผิดชอบ', 'PM/CAL', 'สถานะ', '',
                  ].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap', letterSpacing: .6, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const ws = warrantyStatus(item.warranty_exp)
                  return (
                    <tr
                      key={item.id}
                      className="eq-row"
                      onClick={() => setDetailItem(item)}
                      style={{ borderBottom: '1px solid var(--border)', animation: idx < 12 ? `eqFadeUp .2s ease ${idx * 22}ms both` : undefined }}
                    >
                      {/* Name + codes */}
                      <td style={{ padding: '11px 14px', minWidth: 220, maxWidth: 280 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>{item.equipment_type}</div>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                          {item.cbh_code && (
                            <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--primary)', background: 'var(--primary-soft)', padding: '1px 7px', borderRadius: 4, letterSpacing: .3 }}>{item.cbh_code}</span>
                          )}
                          {item.hospital_asset_no && (
                            <span style={{ fontSize: 10.5, color: 'var(--muted)', fontFamily: 'monospace' }}>{item.hospital_asset_no}</span>
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
                      <td style={{ padding: '11px 14px', fontSize: 11.5, color: 'var(--muted)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{item.serial_number ?? <span style={{ color: 'var(--border)', fontFamily: 'inherit' }}>—</span>}</td>
                      {/* Risk */}
                      <td style={{ padding: '11px 14px' }}>
                        {item.risk_level
                          ? <Badge color={RISK_BADGE[item.risk_level as RiskLevel]}>{item.risk_level}</Badge>
                          : <span style={{ color: 'var(--border)', fontSize: 16 }}>—</span>}
                      </td>
                      {/* Warranty */}
                      <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                        {item.warranty_exp ? (
                          <span style={{ fontSize: 12, color: ws === 'danger' ? 'var(--danger)' : ws === 'warn' ? 'var(--warning)' : 'var(--muted)', fontWeight: (ws === 'warn' || ws === 'danger') ? 600 : 400, display: 'flex', alignItems: 'center', gap: 3 }}>
                            {(ws === 'warn' || ws === 'danger') && <Icon name="alert" size={11} />}
                            {formatDate(item.warranty_exp)}
                          </span>
                        ) : <span style={{ color: 'var(--border)', fontSize: 16 }}>—</span>}
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
                  )
                })}
              </tbody>
            </table>
          </StickyScroll>
        )}
      </Card>

      </>}

      {/* Modals */}
      {(addModal || editItem) && (
        <EquipmentModal
          item={editItem ?? null}
          onClose={() => { setAddModal(false); setEditItem(null) }}
          onSaved={handleSaved}
          departments={allDepts}
        />
      )}
      {deleteItem && <DeleteConfirm item={deleteItem} onClose={() => setDeleteItem(null)} onDeleted={handleDeleted} />}
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
