'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Icon } from '@/components/ui/Icon'
import { ReferenceRangePaste, isJsonTable } from './ReferenceRangePaste'
import { TestDocuments } from './TestDocuments'
import type { TestFormData, ReferenceRangeRow } from '@/lib/validations/test-schema' // ReferenceRangeRow used by initialRanges prop
import type { Category } from '@/lib/supabase/types'

interface Props {
  categories: Category[]
  initial?: Partial<TestFormData>
  initialRanges?: ReferenceRangeRow[]
  testId?: number
  existingTests?: { id?: number; code?: string | null; th?: string | null; category_id?: string | null }[]
}

const EMPTY: TestFormData = {
  code: '', category_id: '', th: '', en: '', active: true, contact_staff: false, popular: false, available_24hr: false,
  related_doc_ids: [],
}

const TUBE_OPTIONS: { label: string; color: string }[] = [
  { label: 'Sodium citrate (ฟ้า)',         color: '#25a6eb' },
  { label: 'Clotted blood (แดง)',           color: '#EF4444' },
  { label: 'Lithium heparin (เขียว)',       color: '#10B981' },
  { label: 'EDTA (ม่วง)',                   color: '#9333EA' },
  { label: 'NaF (เทา)',                     color: '#94A3B8' },
  { label: 'Urine',                         color: '#FACC15' },
  { label: 'Stool',                         color: '#92400E' },
  { label: 'Hemoculture aerobic (ผู้ใหญ่)', color: '#B91C1C' },
  { label: 'Hemoculture aerobic (เด็ก)',    color: '#B91C1C' },
  { label: 'Hemoculture fungi/TB',          color: '#B91C1C' },
  { label: 'Blood gas syringe',             color: '#B91C1C' },
  { label: 'Blood gas capillary tube',      color: '#B91C1C' },
  { label: 'Cowin tube',                    color: '#F59E0B' },
  { label: 'Random urine',                  color: '#FACC15' },
  { label: 'Body Fluid',                    color: '#f221ba' },
  { label: 'CSF',                           color: '#fe892a' },
  { label: 'Sputum',                        color: '#001eff' },
  { label: 'อื่นๆ',                         color: '#000000' },
]
const TUBE_PRESET_LABELS = TUBE_OPTIONS.filter(o => o.label !== 'อื่นๆ').map(o => o.label)

const CATEGORY_CONTACT: Record<string, { name: string; phone: string }> = {
  'เคมีคลินิก':                          { name: 'งานเคมีคลินิก',                          phone: '1464' },
  'ภูมิคุ้มกันวิทยาคลินิก':              { name: 'งานภูมิคุ้มกันวิทยาคลินิก',              phone: '1469' },
  'โลหิตวิทยาคลินิก':                    { name: 'งานโลหิตวิทยาคลินิก',                    phone: '1466' },
  'จุลทรรศนศาสตร์คลินิก':               { name: 'งานจุลทรรศนศาสตร์คลินิก',               phone: '1468' },
  'จุลชีววิทยาคลินิก':                   { name: 'งานจุลชีววิทยาคลินิก',                   phone: '1462, 1463' },
  'อณูชีววิทยาคลินิก':                   { name: 'งานอณูชีววิทยาคลินิก',                   phone: '1467, 1452' },
  'คลังเลือด':                           { name: 'งานคลังเลือด',                           phone: '1458' },
  'ตรวจพิเศษและปฏิบัติการตรวจต่อ':      { name: 'งานตรวจพิเศษและปฏิบัติการตรวจต่อ',      phone: '1461' },
  'ศูนย์สุขภาพชุมชนเมืองชลบุรี':        { name: 'ศูนย์สุขภาพชุมชนเมืองชลบุรี',           phone: '1633, 1634' },
}

const inp: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 10px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--card)',
  color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
}
const ta: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--card)',
  color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit',
  resize: 'vertical', minHeight: 80, boxSizing: 'border-box',
}
function normCode(v: string | null | undefined) {
  return (v ?? '').trim().toLowerCase()
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
      {title}
    </div>
  )
}

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
        {label}{required && <span style={{ color: '#DC2626', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && <div style={{ fontSize: 11.5, color: '#DC2626' }}>{error}</div>}
    </div>
  )
}

export function TestForm({ categories, initial, initialRanges, testId, existingTests = [] }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<TestFormData>(() => {
    const merged: Record<string, unknown> = { ...EMPTY }
    if (initial) {
      for (const [k, v] of Object.entries(initial)) {
        merged[k] = v === null ? undefined : v
      }
    }
    // Convert old structured ranges to JSON table in ref
    if ((initialRanges?.length ?? 0) > 0 && !isJsonTable((initial?.ref) as string)) {
      const headers = ['เพศ', 'อายุต่ำสุด', 'อายุสูงสุด', 'ค่าต่ำสุด', 'ค่าสูงสุด', 'หน่วย', 'หมายเหตุ']
      const rows = initialRanges!.map(r => [
        r.gender ?? 'All',
        r.min_age?.toString() ?? '',
        r.max_age?.toString() ?? '',
        r.lower_limit?.toString() ?? '',
        r.upper_limit?.toString() ?? '',
        r.unit ?? '',
        r.note ?? '',
      ])
      merged.ref = JSON.stringify({ h: headers, r: rows })
    }
    // If tube is custom (อื่นๆ), ensure color defaults to black
    if (initial?.tube && !TUBE_PRESET_LABELS.includes(initial.tube)) {
      if (!merged.tube_color || merged.tube_color === '#94A3B8') {
        merged.tube_color = '#000000'
      }
    }
    return merged as TestFormData
  })
  const [refMode, setRefMode] = useState<'text' | 'table'>(
    (initialRanges?.length ?? 0) > 0 || isJsonTable((initial?.ref) as string) ? 'table' : 'text'
  )
  const [tubeSelect, setTubeSelect] = useState<string>(() => {
    const t = initial?.tube
    if (!t) return ''
    return TUBE_PRESET_LABELS.includes(t) ? t : 'อื่นๆ'
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [savedTestId, setSavedTestId] = useState<number | undefined>(testId)

  // Related documents (from quality docs module)
  const [allDocs, setAllDocs] = useState<{ id: string; title: string; document_code: string; type: string }[]>([])
  const [docSearch, setDocSearch] = useState('')
  const [showDocDrop, setShowDocDrop] = useState(false)
  const docInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/admin/documents?pageSize=500&sortBy=document_code&sortDir=asc')
      .then(r => r.json())
      .then(j => setAllDocs(j.data ?? []))
      .catch(() => {})
  }, [])

  const isEdit = testId != null
  const duplicateInCategory = existingTests.find(test =>
    test.id !== testId
    && (test.category_id ?? '') === (form.category_id ?? '')
    && (
      (!!form.code?.trim() && normCode(test.code) === normCode(form.code))
      || (!!form.th?.trim() && normCode(test.th) === normCode(form.th))
    )
  )
  const duplicateCodeMsg = duplicateInCategory
    ? `รหัสหรือชื่อรายการตรวจนี้มีอยู่แล้วในหมวดหมู่เดียวกัน`
    : ''

  function set<K extends keyof TestFormData>(key: K, value: TestFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => { const next = { ...prev }; delete next[key]; return next })
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.code?.trim()) errs.code = 'กรุณากรอกรหัสรายการตรวจ'
    else if (duplicateCodeMsg) errs.code = duplicateCodeMsg
    if (!form.category_id) errs.category_id = 'กรุณาเลือกหมวดหมู่'
    if (!form.th?.trim()) errs.th = 'กรุณากรอกชื่อภาษาไทย'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    if (duplicateCodeMsg) {
      alert(duplicateCodeMsg)
      return
    }
    setSaving(true)
    try {
      const url = isEdit ? `/api/admin/tests/${testId}` : '/api/admin/tests'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          referenceRanges: [],
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'เกิดข้อผิดพลาด')
      const id = isEdit ? testId! : (json as { id: number }).id
      if (isEdit) {
        showToast('บันทึกการแก้ไขสำเร็จ', 'success')
        setTimeout(() => router.push(`/staff/tests/${id}`), 1200)
      } else {
        setSavedTestId(id)
        showToast('เพิ่มรายการตรวจสำเร็จ — อัพโหลดเอกสารแนบได้ด้านล่าง', 'success')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setSaving(false)
    }
  }

  const catOptions = [
    { value: '', label: 'เลือกหมวดหมู่' },
    ...categories.map((c) => ({ value: c.id, label: c.th })),
  ]

  const relatedDocIds = (form.related_doc_ids ?? []) as string[]
  const filteredDocs = allDocs
    .filter(d =>
      !relatedDocIds.includes(d.id) &&
      (docSearch === '' ||
        d.title.toLowerCase().includes(docSearch.toLowerCase()) ||
        d.document_code.toLowerCase().includes(docSearch.toLowerCase()))
    )
    .slice(0, 25)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '11px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: toast.type === 'success' ? '#166534' : '#B91C1C', color: '#fff',
          boxShadow: '0 4px 16px rgba(0,0,0,.18)', maxWidth: 320,
        }}>
          {toast.type === 'success' ? '✓ ' : '✕ '}{toast.msg}
        </div>
      )}

      {/* A: ข้อมูลพื้นฐาน */}
      <Card>
        <SectionHeader title="A. ข้อมูลพื้นฐาน" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="รหัสรายการตรวจ" required error={errors.code}>
            <input
              style={{
                ...inp,
                borderColor: duplicateCodeMsg ? 'rgba(220,38,38,.55)' : 'var(--border)',
                background: duplicateCodeMsg ? 'rgba(220,38,38,.04)' : 'var(--card)',
              }}
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
              onBlur={() => {
                if (duplicateCodeMsg) {
                  alert(duplicateCodeMsg)
                  setErrors(prev => ({ ...prev, code: duplicateCodeMsg }))
                }
              }}
              placeholder="รหัสใน E-phis"
            />
          </Field>
          <Field label="รหัสกรมบัญชีกลาง (CGD)">
            <input style={inp} value={form.cgd ?? ''} onChange={(e) => set('cgd', e.target.value || null)} placeholder="รหัส CGD" />
          </Field>
          <Field label="หมวดหมู่" required error={errors.category_id}>
            <Select
              value={form.category_id}
              onChange={(v) => {
                set('category_id', v)
                const cat = categories.find(c => c.id === v)
                const preset = cat ? CATEGORY_CONTACT[cat.th] : undefined
                if (preset) {
                  if (!form.contact_name) set('contact_name', preset.name)
                  if (!form.contact_phone) set('contact_phone', preset.phone)
                }
              }}
              options={catOptions}
            />
          </Field>
          <Field label="รหัส LOINC">
            <input style={inp} value={form.loinc ?? ''} onChange={(e) => set('loinc', e.target.value || null)} placeholder="เช่น 58410-2" />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="ชื่อรายการตรวจวิเคราะห์" required error={errors.th}>
              <input style={inp} value={form.th} onChange={(e) => set('th', e.target.value)} placeholder="ชื่อรายการตรวจ" />
            </Field>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="ชื่อเต็ม/ชื่ออื่นๆ">
              <input style={inp} value={form.en ?? ''} onChange={(e) => set('en', e.target.value || '')} placeholder="Full name / Alias" />
            </Field>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
            เปิดใช้งาน (Active)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={form.contact_staff ?? false} onChange={(e) => set('contact_staff', e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
            ติดต่อเจ้าหน้าที่
          </label>
        </div>
      </Card>

      {/* B: ราคา & TAT */}
      <Card>
        <SectionHeader title="B. ราคา & TAT" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <Field label="ราคา (บาท)">
            <input type="number" min={0} style={inp} value={form.price ?? ''} onChange={(e) => set('price', e.target.value ? Number(e.target.value) : null)} placeholder="0" />
          </Field>
          <Field label="TAT">
            <input type="text" style={inp} value={form.tat_minutes ?? ''} onChange={(e) => set('tat_minutes', e.target.value || null)} placeholder="เช่น 60 นาที, 1-2 ชั่วโมง" />
          </Field>
          <Field label="TAT เร่งด่วน">
            <input type="text" style={inp} value={form.urgent_tat_minutes ?? ''} onChange={(e) => set('urgent_tat_minutes', e.target.value || null)} placeholder="เช่น 30 นาที" />
          </Field>
        </div>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={form.available_24hr} onChange={(e) => set('available_24hr', e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
            ตลอด 24 ชั่วโมง
          </label>
          {!form.available_24hr && (
            <Field label="วัน-เวลาที่ตรวจวิเคราะห์">
              <input style={inp} value={form.service ?? ''} onChange={(e) => set('service', e.target.value || null)} placeholder="เช่น จันทร์–ศุกร์ 08:00–16:00 น." />
            </Field>
          )}
        </div>
      </Card>

      {/* C: วิธีการตรวจ */}
      <Card>
        <SectionHeader title="C. วิธีการตรวจวิเคราะห์" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="วิธีการตรวจ (Method)">
            <input style={inp} value={form.method ?? ''} onChange={(e) => set('method', e.target.value || null)} placeholder="เช่น Flow Cytometry, HPLC" />
          </Field>
<Field label="วัตถุประสงค์ของการตรวจ/ข้อบ่งชี้ (Indication)">
            <textarea style={ta} value={form.methodology_note ?? ''} onChange={(e) => set('methodology_note', e.target.value || null)} placeholder="คำอธิบายเพิ่มเติม..." />
          </Field>
        </div>
      </Card>

      {/* D: Specimen */}
      <Card>
        <SectionHeader title="D. Specimen" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="ชนิด Specimen">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Select
                  style={{ flex: 1 }}
                  placeholder="— เลือกชนิด Specimen —"
                  value={tubeSelect}
                  onChange={(val) => {
                    setTubeSelect(val)
                    if (val === 'อื่นๆ') {
                      set('tube', null)
                      set('tube_color', '#000000')
                    } else if (val === '') {
                      set('tube', null)
                      set('tube_color', null)
                    } else {
                      set('tube', val)
                      const color = TUBE_OPTIONS.find(o => o.label === val)?.color
                      if (color) set('tube_color', color)
                    }
                  }}
                  options={TUBE_OPTIONS.map(o => o.label)}
                />
                <div style={{ width: 28, height: 28, borderRadius: 6, background: form.tube_color ?? '#94A3B8', flexShrink: 0, border: '1px solid var(--border)' }} />
              </div>
              {tubeSelect === 'อื่นๆ' && (
                <input
                  style={inp}
                  value={form.tube ?? ''}
                  onChange={(e) => set('tube', e.target.value || null)}
                  placeholder="ระบุชนิด Specimen..."
                />
              )}
            </div>
          </Field>
          <Field label="สีหลอด (Hex color)">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input style={{ ...inp, flex: 1 }} value={form.tube_color ?? ''} onChange={(e) => set('tube_color', e.target.value || null)} placeholder="#9333EA" />
              <input type="color" value={form.tube_color ?? '#94A3B8'} onChange={(e) => set('tube_color', e.target.value)} style={{ width: 36, height: 36, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }} />
            </div>
          </Field>
          <Field label="ปริมาตร (Volume)">
            <input style={inp} value={form.volume ?? ''} onChange={(e) => set('volume', e.target.value || null)} placeholder="เช่น 3 mL" />
          </Field>
          <Field label="การเก็บรักษาตัวอย่างก่อนนำส่ง">
            <input style={inp} value={form.transport_condition ?? ''} onChange={(e) => set('transport_condition', e.target.value || null)} placeholder="เช่น ส่งทันทีหลังเก็บ" />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="การเก็บรักษาตัวอย่างหลังการตรวจวิเคราะห์">
              <textarea style={ta} value={form.stability ?? ''} onChange={(e) => set('stability', e.target.value || null)} placeholder="เงื่อนไขการเก็บรักษาตัวอย่าง..." />
            </Field>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="เงื่อนไขปฏิเสธ (Rejection Criteria)">
              <textarea style={ta} value={form.reject ?? ''} onChange={(e) => set('reject', e.target.value || null)} placeholder="เหตุผลที่ตัวอย่างถูกปฏิเสธ..." />
            </Field>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="รายละเอียดอื่นๆ">
              <RichTextEditor
                value={form.specimen_note ?? ''}
                onChange={v => set('specimen_note', v || null)}
                placeholder="ข้อมูลเพิ่มเติมเกี่ยวกับตัวอย่าง..."
              />
            </Field>
          </div>
        </div>
      </Card>

      {/* E: Reference Range */}
      <Card>
        <SectionHeader title="E. ค่าอ้างอิง (Reference Range)" />
        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 4, border: '1px solid var(--border)', borderRadius: 8, padding: 3, width: 'fit-content', marginBottom: 16 }}>
          {(['text', 'table'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setRefMode(m)}
              style={{
                padding: '5px 14px', fontSize: 13, border: 'none', borderRadius: 5,
                background: refMode === m ? 'var(--primary)' : 'transparent',
                color: refMode === m ? '#fff' : 'var(--muted)',
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
              }}
            >
              {m === 'text' ? 'ข้อความอิสระ' : 'ตาราง'}
            </button>
          ))}
        </div>

        {refMode === 'text' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="ค่าอ้างอิง">
              <textarea style={ta} value={form.ref ?? ''} onChange={(e) => set('ref', e.target.value || null)} placeholder="เช่น 4.0–11.0 × 10⁹/L (WBC)" />
            </Field>
            <Field label="หมายเหตุ">
              <textarea style={ta} value={form.ref_note ?? ''} onChange={(e) => set('ref_note', e.target.value || null)} placeholder="เช่น ค่าอ้างอิงนี้ใช้สำหรับผู้ใหญ่ทั่วไป กรณีเด็ก ตั้งครรภ์ หรือสูงอายุ กรุณาดูเอกสารคู่มือฉบับเต็ม" />
            </Field>
          </div>
        ) : (
          <ReferenceRangePaste
            value={form.ref}
            onChange={(v) => set('ref', v)}
            note={form.ref_note}
            onNoteChange={(v) => set('ref_note', v)}
          />
        )}
      </Card>

      {/* F: ติดต่อ */}
      <Card>
        <SectionHeader title="F. ข้อมูลติดต่อ" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="ชื่อหน่วยงาน">
              <input style={inp} value={form.contact_name ?? ''} onChange={(e) => set('contact_name', e.target.value || null)} placeholder="เช่น กลุ่มงานเทคนิคการแพทย์" />
            </Field>
          </div>
          <Field label="โทรศัพท์">
            <input style={inp} value={form.contact_phone ?? ''} onChange={(e) => set('contact_phone', e.target.value || null)} placeholder="เช่น 038-931-XXX" />
          </Field>
          <Field label="อีเมล">
            <input style={inp} value={form.contact_email ?? ''} onChange={(e) => set('contact_email', e.target.value || null)} placeholder="เช่น lab@hospital.go.th" />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="ที่อยู่ / หมายเหตุ">
              <textarea style={ta} value={form.contact_note ?? ''} onChange={(e) => set('contact_note', e.target.value || null)} placeholder="เช่น ชั้น 1 อาคารผู้ป่วยนอก" />
            </Field>
          </div>
        </div>
      </Card>

      {/* G: เอกสารที่เกี่ยวข้อง */}
      <Card>
        <SectionHeader title="G. เอกสารที่เกี่ยวข้อง" />

        {/* Searchable document selector */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
            <input
              ref={docInputRef}
              value={docSearch}
              onChange={e => { setDocSearch(e.target.value); setShowDocDrop(true) }}
              onFocus={() => setShowDocDrop(true)}
              onBlur={() => setTimeout(() => setShowDocDrop(false), 150)}
              placeholder="ค้นหาหรือเลือกเอกสารที่เกี่ยวข้อง..."
              style={{ ...inp, paddingLeft: 32 }}
            />
          </div>

          {showDocDrop && (filteredDocs.length > 0 || allDocs.length === 0) && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
              boxShadow: '0 8px 28px rgba(0,0,0,.13)', maxHeight: 260, overflowY: 'auto', marginTop: 4,
            }}>
              {allDocs.length === 0 ? (
                <div style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--muted)', textAlign: 'center' }}>กำลังโหลดเอกสาร...</div>
              ) : filteredDocs.length === 0 ? (
                <div style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--muted)', textAlign: 'center' }}>ไม่พบเอกสาร</div>
              ) : (
                filteredDocs.map(doc => (
                  <button
                    key={doc.id}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault()
                      set('related_doc_ids', [...relatedDocIds, doc.id])
                      setDocSearch('')
                      docInputRef.current?.focus()
                    }}
                    style={{
                      width: '100%', padding: '9px 14px', border: 'none', background: 'transparent',
                      cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', flexShrink: 0, minWidth: 80 }}>{doc.document_code}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>{doc.type}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Selected document chips */}
        {relatedDocIds.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: isEdit && testId != null ? 20 : 0 }}>
            {relatedDocIds.map(id => {
              const doc = allDocs.find(d => d.id === id)
              return (
                <div key={id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 6px 3px 10px', borderRadius: 20,
                  border: '1px solid var(--border)', background: 'var(--surface-2)',
                  fontSize: 12, color: 'var(--ink)', maxWidth: 340,
                }}>
                  <Icon name="doc" size={11} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc ? `${doc.document_code} — ${doc.title}` : id.slice(0, 8) + '…'}
                  </span>
                  <button
                    type="button"
                    onClick={() => set('related_doc_ids', relatedDocIds.filter(x => x !== id))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '0 2px', display: 'flex', lineHeight: 1, flexShrink: 0 }}
                  >
                    <Icon name="x" size={10} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* File upload area — shows after test is saved (new or edit) */}
        {savedTestId != null && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>ไฟล์แนบโดยตรง</div>
            <TestDocuments testId={savedTestId} />
          </div>
        )}
      </Card>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingBottom: 40 }}>
        {savedTestId != null && !isEdit ? (
          <Button variant="primary" onClick={() => router.push(`/staff/tests/${savedTestId}`)} icon="arrowRight">
            ไปหน้ารายละเอียด
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => router.back()}>ยกเลิก</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={saving || !!duplicateCodeMsg} icon="check">
              {saving ? 'กำลังบันทึก...' : (isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มรายการตรวจ')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Rich Text Editor ─────────────────────────────────────────────────────────

const RICH_COLORS = [
  { hex: '#0F172A', label: 'ดำ' },
  { hex: '#1E5FAD', label: 'น้ำเงิน' },
  { hex: '#DC2626', label: 'แดง' },
  { hex: '#059669', label: 'เขียว' },
  { hex: '#D97706', label: 'ส้ม' },
  { hex: '#7C3AED', label: 'ม่วง' },
]

function RichTextEditor({ value, onChange, placeholder }: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)
  const [showColors, setShowColors] = useState(false)

  useEffect(() => {
    if (editorRef.current && !initialized.current) {
      editorRef.current.innerHTML = value || ''
      initialized.current = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function exec(cmd: string, val?: string) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val)
    onChange(editorRef.current?.innerHTML ?? '')
  }

  function handleLink(e: React.MouseEvent) {
    e.preventDefault()
    const url = window.prompt('URL:', 'https://')
    if (url) exec('createLink', url)
  }

  const btnStyle: React.CSSProperties = {
    width: 30, height: 28, borderRadius: 6, border: 'none',
    background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--ink)', fontSize: 13, transition: 'background .12s',
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'visible' }}>
      <style>{`
        .rich-editor [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: var(--muted);
          pointer-events: none;
        }
        .rich-editor [contenteditable] a { color: #1E5FAD; text-decoration: underline; }
        .rich-tool-btn:hover { background: var(--border) !important; }
      `}</style>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '5px 8px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface-2)', flexWrap: 'wrap',
      }}>
        {/* Bold */}
        <button type="button" className="rich-tool-btn" title="ตัวหนา"
          style={{ ...btnStyle, fontWeight: 800 }}
          onMouseDown={e => { e.preventDefault(); exec('bold') }}>
          B
        </button>

        {/* Italic */}
        <button type="button" className="rich-tool-btn" title="ตัวเอียง"
          style={{ ...btnStyle, fontStyle: 'italic', fontWeight: 600 }}
          onMouseDown={e => { e.preventDefault(); exec('italic') }}>
          I
        </button>

        <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />

        {/* Color */}
        <div style={{ position: 'relative' }}>
          <button type="button" className="rich-tool-btn" title="สีข้อความ"
            style={btnStyle}
            onMouseDown={e => { e.preventDefault(); setShowColors(p => !p) }}>
            <span style={{ fontWeight: 800, fontSize: 14, borderBottom: '2.5px solid #DC2626', lineHeight: 1.1 }}>A</span>
          </button>
          {showColors && (
            <div style={{
              position: 'absolute', top: 34, left: 0, zIndex: 200,
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '8px 10px',
              boxShadow: '0 4px 20px rgba(0,0,0,.12)',
              display: 'flex', gap: 6, alignItems: 'center',
            }}>
              {RICH_COLORS.map(c => (
                <button key={c.hex} type="button" title={c.label}
                  style={{
                    width: 22, height: 22, borderRadius: 6,
                    border: '2px solid rgba(0,0,0,.08)',
                    background: c.hex, cursor: 'pointer',
                  }}
                  onMouseDown={e => { e.preventDefault(); exec('foreColor', c.hex); setShowColors(false) }}
                />
              ))}
              <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
              <button type="button" title="ล้างการจัดรูปแบบ"
                style={{ ...btnStyle, width: 26, fontSize: 11, color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 6 }}
                onMouseDown={e => { e.preventDefault(); exec('removeFormat'); setShowColors(false) }}>
                ✕
              </button>
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />

        {/* Link */}
        <button type="button" className="rich-tool-btn" title="เพิ่มลิ้งค์"
          style={btnStyle}
          onMouseDown={handleLink}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </button>

        {/* Unlink */}
        <button type="button" className="rich-tool-btn" title="ลบลิ้งค์"
          style={btnStyle}
          onMouseDown={e => { e.preventDefault(); exec('unlink') }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            <line x1="2" y1="2" x2="22" y2="22"/>
          </svg>
        </button>
      </div>

      {/* Editable area */}
      <div className="rich-editor">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={() => onChange(editorRef.current?.innerHTML ?? '')}
          onBlur={() => setShowColors(false)}
          style={{
            minHeight: 96, padding: '10px 12px', fontSize: 13,
            color: 'var(--ink)', fontFamily: 'inherit', outline: 'none',
            lineHeight: 1.7, background: 'var(--card)',
            borderRadius: '0 0 7px 7px',
          }}
        />
      </div>
    </div>
  )
}
