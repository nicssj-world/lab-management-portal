'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { Card } from '@/components/ui/Card'
import type {
  Profile, StaffCertification, StaffTraining, StaffCompetency, StaffAuthorization,
  StaffJd, StaffJdRevision, StaffTrainingPlan, OrientationItem,
} from '@/lib/supabase/types'
import { expiryStatus, EXPIRY_COLOR, EXPIRY_LABEL_TH, daysLeft } from '@/lib/personnel/expiry'
import { hasMedicalTechnologistLicenseScope } from '@/lib/personnel/roles'
import { DEPARTMENTS } from '@/lib/validations/user-schema'

export interface TestOption { id: number; code: string; th: string; category_id: string | null }
export interface StaffOption { id: string; name: string }

interface DetailProps {
  detail: {
    profile: Profile
    certifications: StaffCertification[]
    training: StaffTraining[]
    competencies: StaffCompetency[]
    authorizations: StaffAuthorization[]
    jds: StaffJd[]
    trainingPlan: StaffTrainingPlan[]
  }
  canEdit: boolean
  tests: TestOption[]
  categories: string[]
  staff: StaffOption[]
}

type TabKey = 'profile' | 'training' | 'plan' | 'competency' | 'cert' | 'auth' | 'jd' | 'orient'

const TABS: { key: TabKey; th: string; icon: string }[] = [
  { key: 'profile',    th: 'ประวัติ',        icon: 'users' },
  { key: 'training',   th: 'การอบรม',       icon: 'book' },
  { key: 'plan',       th: 'แผนอบรม',       icon: 'chart' },
  { key: 'competency', th: 'สมรรถนะ',       icon: 'check' },
  { key: 'cert',       th: 'ใบรับรอง',      icon: 'doc' },
  { key: 'auth',       th: 'มอบหมายงาน',   icon: 'shieldCheck' },
  { key: 'jd',         th: 'JDJS',          icon: 'edit' },
  { key: 'orient',     th: 'ปฐมนิเทศ',      icon: 'clock' },
]

// ── toast ──
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

export function StaffDetailClient({ detail, canEdit, tests, categories, staff }: DetailProps) {
  const { profile } = detail
  const [tab, setTab] = useState<TabKey>('profile')
  const { toasts, add } = useToast()

  const [certs, setCerts] = useState(detail.certifications)
  const [training, setTraining] = useState(detail.training)
  const [comps, setComps] = useState(detail.competencies)
  const [auths, setAuths] = useState(detail.authorizations)
  const [jds, setJds] = useState(detail.jds)
  const [plan, setPlan] = useState(detail.trainingPlan)
  const [prof, setProf] = useState(profile)

  const testById = useMemo(() => new Map(tests.map((t) => [t.id, t])), [tests])
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s.name])), [staff])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/staff/personnel" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', textDecoration: 'none', fontSize: 13 }}>
          <Icon name="arrowLeft" size={16} /> บุคลากร
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink)' }}>{prof.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            {prof.role}{prof.position_title ? ` · ${prof.position_title}` : ''}{(prof.dept ?? prof.unit) ? ` · ${prof.dept ?? prof.unit}` : ''}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 2 }}>
        {TABS.map((t) => {
          const active = tab === t.key
          const count = t.key === 'training' ? training.length : t.key === 'competency' ? comps.length : t.key === 'cert' ? certs.length : t.key === 'auth' ? auths.length : t.key === 'jd' ? jds.length : t.key === 'plan' ? plan.length : null
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px',
              border: 'none', borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'transparent', color: active ? 'var(--primary)' : 'var(--muted)',
              fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: -2,
            }}>
              <Icon name={t.icon} size={15} /> {t.th}
              {count !== null && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{count}</span>}
            </button>
          )
        })}
      </div>

      {tab === 'profile' && <ProfileTab prof={prof} canEdit={canEdit} onSaved={(p) => { setProf(p); add('บันทึกประวัติแล้ว') }} onError={(m) => add(m, false)} />}
      {tab === 'training' && <TrainingTab profileId={prof.id} items={training} setItems={setTraining} canEdit={canEdit} toast={add} />}
      {tab === 'plan' && <TrainingPlanTab profileId={prof.id} items={plan} setItems={setPlan} training={training} canEdit={canEdit} toast={add} />}
      {tab === 'competency' && <CompetencyTab profileId={prof.id} items={comps} setItems={setComps} canEdit={canEdit} tests={tests} testById={testById} staff={staff} staffById={staffById} toast={add} />}
      {tab === 'cert' && <CertTab profileId={prof.id} items={certs} setItems={setCerts} canEdit={canEdit} toast={add} />}
      {tab === 'auth' && <AuthTab profileId={prof.id} items={auths} setItems={setAuths} canEdit={canEdit} tests={tests} testById={testById} categories={categories} competencies={comps} toast={add} />}
      {tab === 'jd' && <JdTab profileId={prof.id} items={jds} setItems={setJds} canEdit={canEdit} toast={add} />}
      {tab === 'orient' && <OrientationTab profileId={prof.id} canEdit={canEdit} toast={add} />}

      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 2000 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ padding: '10px 16px', borderRadius: 8, background: t.ok ? 'var(--success)' : 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.2)' }}>{t.msg}</div>
        ))}
      </div>
    </div>
  )
}

// ════════════ shared styles ════════════
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block' }
const th: React.CSSProperties = { padding: '9px 14px', fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', textAlign: 'left' }
const td: React.CSSProperties = { padding: '10px 14px', color: 'var(--ink)', verticalAlign: 'top', fontSize: 13 }
const primaryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const ghostBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const iconBtn: React.CSSProperties = { padding: 5, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', cursor: 'pointer', display: 'inline-flex' }

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
          <button onClick={onClose} style={{ ...iconBtn, border: 'none' }}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>{footer}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={labelStyle}>{label}</label>{children}</div>
}

function FileDropZone({ file, accept, note, onFile }: { file: File | null; accept: string; note: string; onFile: (file: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)

  function selectFile(next: File | undefined) {
    if (next) onFile(next)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
      onDragEnter={(e) => { e.preventDefault(); setDragging(true) }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={(e) => { e.preventDefault(); setDragging(false) }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); selectFile(e.dataTransfer.files?.[0]) }}
      style={{
        border: `1.5px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`,
        borderRadius: 12,
        background: dragging ? 'var(--primary-soft)' : 'var(--surface-2)',
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        transition: 'background .15s, border-color .15s, box-shadow .15s',
        boxShadow: dragging ? '0 0 0 4px var(--primary-soft)' : 'none',
        outline: 'none',
      }}
    >
      <input ref={inputRef} type="file" accept={accept} onChange={(e) => selectFile(e.target.files?.[0])} style={{ display: 'none' }} />
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: 'var(--card)', color: file ? 'var(--success)' : 'var(--primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name={file ? 'check' : 'upload'} size={18} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file ? file.name : 'ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์'}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
          {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : note}
        </div>
      </div>
      {file && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onFile(null) }}
          style={{ ...iconBtn, color: 'var(--danger)' }}
          aria-label="ล้างไฟล์"
        >
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  )
}

function SectionHeader({ title, sub, onAdd, canEdit }: { title: string; sub?: string; onAdd?: () => void; canEdit: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      {canEdit && onAdd && <button onClick={onAdd} style={primaryBtn}><Icon name="plus" size={15} /> เพิ่ม</button>}
    </div>
  )
}

function parseIsoDate(value: string | null | undefined) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return { year, month, day }
}

function formatDateBE(value: string | null | undefined) {
  const parsed = parseIsoDate(value)
  if (!parsed) return null
  return `${String(parsed.day).padStart(2, '0')}/${String(parsed.month).padStart(2, '0')}/${parsed.year + 543}`
}

function fmtDate(d: string | null | undefined) { return formatDateBE(d) ?? '—' }

function fmtDateTimeDateBE(value: string | null | undefined) {
  return formatDateBE(value?.slice(0, 10)) ?? ''
}

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const TH_WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

function isoFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateFromIso(value: string | null | undefined) {
  const parsed = parseIsoDate(value)
  return parsed ? new Date(parsed.year, parsed.month - 1, parsed.day) : null
}

function sameDate(a: Date | null, b: Date | null) {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function DateInputBE({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const selected = dateFromIso(value)
  const today = new Date()
  const initial = selected ?? today
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const next = selected ?? today
    if (!open) {
      setViewYear(next.getFullYear())
      setViewMonth(next.getMonth())
    }
  }, [value, open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function moveMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  function selectDate(date: Date) {
    onChange(isoFromDate(date))
    setOpen(false)
  }

  const firstDay = new Date(viewYear, viewMonth, 1)
  const start = new Date(viewYear, viewMonth, 1 - firstDay.getDay())
  const cells = Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index))

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        style={{
          ...inputStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: selected ? 'var(--ink)' : 'var(--muted)',
        }}
      >
        <span>{formatDateBE(value) ?? 'เลือกวันที่ (พ.ศ.)'}</span>
        <Icon name="clock" size={15} />
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          zIndex: 1200,
          top: 'calc(100% + 6px)',
          right: 0,
          width: 306,
          maxWidth: 'min(306px, calc(100vw - 48px))',
          padding: 12,
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--card)',
          boxShadow: '0 18px 44px rgba(15,23,42,.18)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" onClick={() => moveMonth(-1)} style={iconBtn} aria-label="เดือนก่อนหน้า">
              <Icon name="arrowLeft" size={14} />
            </button>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>
              {TH_MONTHS[viewMonth]} {viewYear + 543}
            </div>
            <button type="button" onClick={() => moveMonth(1)} style={iconBtn} aria-label="เดือนถัดไป">
              <Icon name="arrowRight" size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
            {TH_WEEKDAYS.map((day) => (
              <div key={day} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--muted)', padding: '4px 0' }}>{day}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {cells.map((date) => {
              const inMonth = date.getMonth() === viewMonth
              const active = sameDate(date, selected)
              const isToday = sameDate(date, today)
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => selectDate(date)}
                  style={{
                    height: 34,
                    borderRadius: 8,
                    border: active ? '1px solid var(--primary)' : isToday ? '1px solid var(--border)' : '1px solid transparent',
                    background: active ? 'var(--primary)' : isToday ? 'var(--primary-soft)' : 'transparent',
                    color: active ? '#fff' : inMonth ? 'var(--ink)' : 'var(--muted)',
                    opacity: inMonth ? 1 : .45,
                    fontSize: 12.5,
                    fontWeight: active || isToday ? 800 : 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={() => { onChange(''); setOpen(false) }} style={ghostBtn}>ล้างค่า</button>
            <button type="button" onClick={() => selectDate(today)} style={primaryBtn}>วันนี้ {today.getFullYear() + 543}</button>
          </div>
        </div>
      )}
    </div>
  )
}

const POSITION_OPTIONS = [
  'นักเทคนิคการแพทย์',
  'นักเทคนิคการแพทย์ปฏิบัติการ',
  'นักเทคนิคการแพทย์ชำนาญการ',
  'นักเทคนิคการแพทย์ชำนาญการพิเศษ',
  'จพง.วิทยาศาสตร์การแพทย์ชำนาญงาน',
  'จพง.วิทยาศาสตร์การแพทย์ปฏิบัติงาน',
  'พนักงานประจำห้องทดลอง',
  'พนักงานบริการ',
]

const EMPLOYMENT_TYPE_OPTIONS = [
  'ข้าราชการ',
  'พนักงานราชการ',
  'พนักงานกระทรวงฯ',
  'ลูกจ้างชั่วคราว รายเดือน',
  'ลูกจ้างชั่วคราว รายวัน',
]

const EDUCATION_OPTIONS = [
  'ปริญญาเอก',
  'ปริญญาโท',
  'ปริญญาตรี',
  'อนุปริญญา / ประกาศนียบัตรวิชาชีพชั้นสูง',
  'ประกาศนียบัตรวิชาชีพ',
  'มัธยมศึกษาตอนปลาย',
]

const JDJS_DEFAULT_EFFECTIVE_DATE = '2026-03-09'
const JDJS_DEFAULT_APPROVER_NAME = 'นางเกศสิรี กรสิทธิกุล'
const JDJS_DEFAULT_APPROVER_POSITION = 'รองผู้อำนวยการด้านพัฒนาระบบบริการและสนับสนุนบริการสุขภาพ'

function jdjsApproverPosition(jd: { approver_position?: string | null; effective_date?: string | null; approver_name?: string | null }) {
  if (jd.approver_position) return jd.approver_position
  if (jd.effective_date === JDJS_DEFAULT_EFFECTIVE_DATE && jd.approver_name === JDJS_DEFAULT_APPROVER_NAME) {
    return JDJS_DEFAULT_APPROVER_POSITION
  }
  return null
}

function licenseDigits(value: string | null | undefined) {
  return (value ?? '').replace(/\D/g, '')
}

function optionsWithCurrent(options: string[], current: string) {
  return current && !options.includes(current) ? [current, ...options] : options
}

function formatMtLicense(value: string | null | undefined) {
  const digits = licenseDigits(value)
  return digits ? `ทน.${digits}` : null
}

function formatTenure(startDate: string | null | undefined) {
  if (!startDate) return null
  const start = new Date(`${startDate}T00:00:00`)
  const today = new Date()
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (Number.isNaN(start.getTime()) || start > end) return null

  let years = end.getFullYear() - start.getFullYear()
  let months = end.getMonth() - start.getMonth()
  let days = end.getDate() - start.getDate()

  if (days < 0) {
    months -= 1
    days += new Date(end.getFullYear(), end.getMonth(), 0).getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  const parts = [
    years > 0 ? `${years} ปี` : '',
    months > 0 ? `${months} เดือน` : '',
    days > 0 ? `${days} วัน` : '',
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : '0 วัน'
}

// ════════════ Profile tab ════════════
function ProfileTab({ prof, canEdit, onSaved, onError }: { prof: Profile; canEdit: boolean; onSaved: (p: Profile) => void; onError: (m: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    ephis_id: licenseDigits(prof.ephis_id),
    position_title: prof.position_title ?? '', dept: prof.dept ?? '', employment_type: prof.employment_type ?? '',
    start_date: prof.start_date ?? '', education: prof.education ?? '',
    mt_license_no: licenseDigits(prof.mt_license_no), mt_license_expiry: prof.mt_license_expiry ?? '',
  })
  const [saving, setSaving] = useState(false)
  const hasMtLicenseScope = hasMedicalTechnologistLicenseScope(prof.role)

  async function save() {
    setSaving(true)
    try {
      const payload = hasMtLicenseScope
        ? form
        : {
            ephis_id: form.ephis_id,
            position_title: form.position_title,
            dept: form.dept,
            employment_type: form.employment_type,
            start_date: form.start_date,
            education: form.education,
          }
      const res = await fetch(`/api/admin/personnel/${prof.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'บันทึกไม่สำเร็จ')
      onSaved(json as Profile)
      setEditing(false)
    } catch (e) { onError(e instanceof Error ? e.message : 'error') } finally { setSaving(false) }
  }

  const rows: [string, string | null][] = [
    ['เลขประจำตัวพนักงาน', prof.ephis_id ?? null],
    ['ตำแหน่ง', prof.position_title ?? null], ['หน่วยงาน', prof.dept ?? prof.unit ?? null],
    ['ประเภทการจ้าง', prof.employment_type ?? null], ['วันเริ่มงาน', fmtDate(prof.start_date)],
    ['อายุงาน', formatTenure(prof.start_date)],
    ['วุฒิการศึกษา', prof.education ?? null],
    ...(hasMtLicenseScope
      ? [
          ['เลขใบประกอบวิชาชีพ (ทนพ.)', formatMtLicense(prof.mt_license_no)],
          ['วันหมดอายุใบอนุญาต', prof.mt_license_expiry ?? null],
        ] satisfies [string, string | null][]
      : []),
  ]

  return (
    <Card padding={20}>
      <SectionHeader title="ประวัติบุคลากร" sub="ข้อมูลส่วนบุคคล · คุณสมบัติวิชาชีพ" canEdit={canEdit} onAdd={canEdit ? () => setEditing(true) : undefined} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 3 }}>{k}</div>
            <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500 }}>
              {k === 'วันหมดอายุใบอนุญาต' && v
                ? <span style={{ color: EXPIRY_COLOR[expiryStatus(v)] }}>{fmtDate(v)} · {EXPIRY_LABEL_TH[expiryStatus(v)]}</span>
                : (v ?? <span style={{ color: 'var(--muted)' }}>—</span>)}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal title="แก้ไขประวัติบุคลากร" onClose={() => setEditing(false)}
          footer={<><button onClick={() => setEditing(false)} style={ghostBtn}>ยกเลิก</button><button onClick={save} disabled={saving} style={primaryBtn}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button></>}>
          <Field label="เลขประจำตัวพนักงาน">
            <input
              style={inputStyle}
              value={form.ephis_id}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="เลข Ephis"
              onChange={(e) => setForm({ ...form, ephis_id: licenseDigits(e.target.value) })}
            />
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>เลข Ephis</div>
          </Field>
          <Field label="ตำแหน่ง">
            <select style={inputStyle} value={form.position_title} onChange={(e) => setForm({ ...form, position_title: e.target.value })}>
              <option value="">— เลือกตำแหน่ง —</option>
              {optionsWithCurrent(POSITION_OPTIONS, form.position_title).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="หน่วยงาน">
            <select style={inputStyle} value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })}>
              <option value="">— เลือกหน่วยงาน —</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="ประเภทการจ้าง">
              <select style={inputStyle} value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })}>
                <option value="">— เลือกประเภทการจ้าง —</option>
                {optionsWithCurrent(EMPLOYMENT_TYPE_OPTIONS, form.employment_type).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="วันเริ่มงาน"><DateInputBE value={form.start_date} onChange={(value) => setForm({ ...form, start_date: value })} /></Field>
          </div>
          <Field label="วุฒิการศึกษา">
            <select style={inputStyle} value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })}>
              <option value="">— เลือกวุฒิการศึกษา —</option>
              {optionsWithCurrent(EDUCATION_OPTIONS, form.education).map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </Field>
          {hasMtLicenseScope && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="เลขใบประกอบวิชาชีพ">
                <input
                  style={inputStyle}
                  value={form.mt_license_no}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="ใส่เฉพาะตัวเลข"
                  onChange={(e) => setForm({ ...form, mt_license_no: licenseDigits(e.target.value) })}
                />
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>ระบบจะแสดงผลเป็น ทน.ตามด้วยเลขที่กรอก</div>
              </Field>
              <Field label="วันหมดอายุใบอนุญาต"><DateInputBE value={form.mt_license_expiry} onChange={(value) => setForm({ ...form, mt_license_expiry: value })} /></Field>
            </div>
          )}
        </Modal>
      )}
    </Card>
  )
}

// ── generic delete confirm + API helpers ──
async function apiSend(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? 'การดำเนินการล้มเหลว')
  return json
}

function openAttachment(profileId: string, path: string) {
  const encodedPath = encodeURIComponent(path)
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const url = isIos
    ? `/staff/personnel/${profileId}/attachments/preview?path=${encodedPath}`
    : `/api/admin/personnel/${profileId}/files?path=${encodedPath}&inline=1`
  window.open(url, '_blank', 'noopener,noreferrer')
}

// ════════════ Training tab ════════════
function TrainingTab({ profileId, items, setItems, canEdit, toast }: { profileId: string; items: StaffTraining[]; setItems: (f: (p: StaffTraining[]) => StaffTraining[]) => void; canEdit: boolean; toast: (m: string, ok?: boolean) => void }) {
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ topic: '', training_date: '', hours: '', provider: '', location: '', training_type: '', cpd_credits: '', notes: '' })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.topic.trim()) { toast('กรุณากรอกหัวข้อ', false); return }
    setSaving(true)
    try {
      let evidence_url: string | undefined
      if (file) {
        const fd = new FormData(); fd.append('file', file); fd.append('kind', 'training')
        const up = await fetch(`/api/admin/personnel/${profileId}/files`, { method: 'POST', body: fd })
        const uj = await up.json(); if (!up.ok) throw new Error(uj.error); evidence_url = uj.file_url
      }
      const payload = {
        topic: form.topic, training_date: form.training_date || undefined, hours: form.hours ? Number(form.hours) : null,
        provider: form.provider || undefined, location: form.location || undefined,
        training_type: form.training_type || null, cpd_credits: form.cpd_credits ? Number(form.cpd_credits) : null,
        evidence_url, notes: form.notes || undefined,
      }
      const created = await apiSend(`/api/admin/personnel/${profileId}/training`, 'POST', payload)
      setItems((p) => [created, ...p])
      setModal(false); setForm({ topic: '', training_date: '', hours: '', provider: '', location: '', training_type: '', cpd_credits: '', notes: '' }); setFile(null)
      toast('บันทึกการอบรมแล้ว')
    } catch (e) { toast(e instanceof Error ? e.message : 'error', false) } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('ลบรายการนี้?')) return
    try { await apiSend(`/api/admin/personnel/${profileId}/training/${id}`, 'DELETE'); setItems((p) => p.filter((x) => x.id !== id)); toast('ลบแล้ว') }
    catch (e) { toast(e instanceof Error ? e.message : 'error', false) }
  }

  return (
    <Card padding={20}>
      <SectionHeader title="ประวัติการฝึกอบรม" sub="บันทึกการพัฒนาความรู้และทักษะ" canEdit={canEdit} onAdd={() => setModal(true)} />
      <ChildTable
        cols={['หัวข้อ', 'วันที่', 'ชั่วโมง', 'ประเภท', 'ผู้จัด', 'หลักฐาน', '']}
        empty="ยังไม่มีบันทึกการอบรม"
        rows={items.map((t) => (
          <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={{ ...td, fontWeight: 600 }}>{t.topic}{t.notes && <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 400 }}>{t.notes}</div>}</td>
            <td style={td}>{fmtDate(t.training_date)}</td>
            <td style={td}>{t.hours ?? '—'}</td>
            <td style={td}>{t.training_type ?? '—'}{t.cpd_credits ? <span style={{ color: 'var(--muted)' }}> · {t.cpd_credits} หน่วย</span> : ''}</td>
            <td style={td}>{t.provider ?? '—'}</td>
            <td style={td}>{t.evidence_url ? <button onClick={() => openAttachment(profileId, t.evidence_url!)} style={iconBtn}><Icon name="eye" size={14} /></button> : '—'}</td>
            <td style={{ ...td, textAlign: 'right' }}>{canEdit && <button onClick={() => remove(t.id)} style={iconBtn}><Icon name="trash" size={14} /></button>}</td>
          </tr>
        ))}
      />
      {modal && (
        <Modal title="เพิ่มการอบรม" onClose={() => setModal(false)}
          footer={<><button onClick={() => setModal(false)} style={ghostBtn}>ยกเลิก</button><button onClick={save} disabled={saving} style={primaryBtn}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button></>}>
          <Field label="หัวข้อการอบรม *"><input style={inputStyle} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="วันที่"><DateInputBE value={form.training_date} onChange={(value) => setForm({ ...form, training_date: value })} /></Field>
            <Field label="จำนวนชั่วโมง"><input type="number" style={inputStyle} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="ประเภท"><select style={inputStyle} value={form.training_type} onChange={(e) => setForm({ ...form, training_type: e.target.value })}><option value="">—</option><option value="internal">Internal</option><option value="external">External</option><option value="CME">CME</option><option value="CPD">CPD</option></select></Field>
            <Field label="หน่วยกิต CME/CPD"><input type="number" style={inputStyle} value={form.cpd_credits} onChange={(e) => setForm({ ...form, cpd_credits: e.target.value })} /></Field>
          </div>
          <Field label="ผู้จัด/วิทยากร"><input style={inputStyle} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></Field>
          <Field label="สถานที่"><input style={inputStyle} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          <Field label="หมายเหตุ"><input style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <Field label="ไฟล์หลักฐาน (PDF/รูป ≤10MB)">
            <FileDropZone file={file} accept=".pdf,image/*" note="รองรับ PDF และรูปภาพ ขนาดไม่เกิน 10MB" onFile={setFile} />
          </Field>
        </Modal>
      )}
    </Card>
  )
}

// ════════════ Competency tab ════════════
function CompetencyTab({ profileId, items, setItems, canEdit, tests, testById, staff, staffById, toast }: {
  profileId: string; items: StaffCompetency[]; setItems: (f: (p: StaffCompetency[]) => StaffCompetency[]) => void; canEdit: boolean
  tests: TestOption[]; testById: Map<number, TestOption>; staff: StaffOption[]; staffById: Map<string, string>; toast: (m: string, ok?: boolean) => void
}) {
  const [modal, setModal] = useState(false)
  const empty = { assessment_type: 'initial', area: '', test_id: '', assessor_id: '', assessment_date: '', next_due_date: '', score_knowledge: '', score_safety: '', score_practical: '', result: '', notes: '' }
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  const overdue = items.filter((c) => expiryStatus(c.next_due_date) === 'expired').length
  const dueSoon = items.filter((c) => expiryStatus(c.next_due_date) === 'expiring').length

  async function save() {
    setSaving(true)
    try {
      const payload = {
        assessment_type: form.assessment_type, area: form.area || undefined,
        test_id: form.test_id ? Number(form.test_id) : null, assessor_id: form.assessor_id || null,
        assessment_date: form.assessment_date || undefined, next_due_date: form.next_due_date || undefined,
        score_knowledge: form.score_knowledge ? Number(form.score_knowledge) : null,
        score_safety: form.score_safety ? Number(form.score_safety) : null,
        score_practical: form.score_practical ? Number(form.score_practical) : null,
        result: form.result || null, notes: form.notes || undefined,
      }
      const created = await apiSend(`/api/admin/personnel/${profileId}/competencies`, 'POST', payload)
      setItems((p) => [created, ...p]); setModal(false); setForm(empty); toast('บันทึกการประเมินแล้ว')
    } catch (e) { toast(e instanceof Error ? e.message : 'error', false) } finally { setSaving(false) }
  }
  async function remove(id: string) {
    if (!confirm('ลบรายการนี้?')) return
    try { await apiSend(`/api/admin/personnel/${profileId}/competencies/${id}`, 'DELETE'); setItems((p) => p.filter((x) => x.id !== id)); toast('ลบแล้ว') }
    catch (e) { toast(e instanceof Error ? e.message : 'error', false) }
  }
  async function signoff(id: string, role: 'assessor' | 'assessee', value: boolean) {
    try {
      const updated = await apiSend(`/api/admin/personnel/${profileId}/competencies/${id}/signoff`, 'POST', { role, value })
      setItems((p) => p.map((x) => (x.id === id ? updated : x)))
      toast(value ? 'ลงนามแล้ว' : 'ยกเลิกการลงนาม')
    } catch (e) { toast(e instanceof Error ? e.message : 'error', false) }
  }

  return (
    <Card padding={20}>
      <SectionHeader title="การประเมินสมรรถนะ" sub="สมรรถนะวิชาชีพ · ยืนยันโดยผู้ประเมิน" canEdit={canEdit} onAdd={() => setModal(true)} />
      {(overdue > 0 || dueSoon > 0) && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          {overdue > 0 && <span style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(220,38,38,.1)', color: 'var(--danger)', fontSize: 12.5, fontWeight: 600 }}>เกินกำหนดประเมิน {overdue} รายการ</span>}
          {dueSoon > 0 && <span style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(217,119,6,.1)', color: 'var(--warning)', fontSize: 12.5, fontWeight: 600 }}>ใกล้ครบกำหนด {dueSoon} รายการ</span>}
        </div>
      )}
      <ChildTable
        cols={['รายการ/Test', 'ประเภท', 'ผู้ประเมิน', 'วันที่', 'ครบกำหนด', 'ผล', 'Sign-off', '']}
        empty="ยังไม่มีการประเมินสมรรถนะ"
        rows={items.map((c) => {
          const dueS = expiryStatus(c.next_due_date)
          const t = c.test_id ? testById.get(c.test_id) : null
          return (
            <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ ...td, fontWeight: 600 }}>{t ? `${t.code} · ${t.th}` : (c.area ?? '—')}</td>
              <td style={td}>{c.assessment_type === 'periodic' ? 'ประเมินซ้ำ' : 'ครั้งแรก'}</td>
              <td style={td}>{c.assessor_id ? (staffById.get(c.assessor_id) ?? '—') : '—'}</td>
              <td style={td}>{fmtDate(c.assessment_date)}</td>
              <td style={td}>{c.next_due_date
                ? <span style={{ color: EXPIRY_COLOR[dueS], fontWeight: dueS === 'valid' ? 400 : 600 }}>{fmtDate(c.next_due_date)}{dueS !== 'valid' && dueS !== 'none' ? ` · ${EXPIRY_LABEL_TH[dueS]}` : ''}</span>
                : '—'}</td>
              <td style={td}>{c.result ? <span style={{ fontWeight: 700, color: c.result === 'pass' ? 'var(--success)' : 'var(--danger)' }}>{c.result === 'pass' ? 'ผ่าน' : 'ไม่ผ่าน'}</span> : '—'}</td>
              <td style={td}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <SignoffChip label="ผู้ประเมิน" done={!!c.assessor_signoff} canEdit={canEdit} onToggle={() => signoff(c.id, 'assessor', !c.assessor_signoff)} />
                  <SignoffChip label="ผู้รับการประเมิน" done={!!c.assessee_ack} canEdit={canEdit} onToggle={() => signoff(c.id, 'assessee', !c.assessee_ack)} />
                </div>
              </td>
              <td style={{ ...td, textAlign: 'right' }}>{canEdit && <button onClick={() => remove(c.id)} style={iconBtn}><Icon name="trash" size={14} /></button>}</td>
            </tr>
          )
        })}
      />
      {modal && (
        <Modal title="ประเมินสมรรถนะ" onClose={() => setModal(false)}
          footer={<><button onClick={() => setModal(false)} style={ghostBtn}>ยกเลิก</button><button onClick={save} disabled={saving} style={primaryBtn}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button></>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="ประเภทการประเมิน"><select style={inputStyle} value={form.assessment_type} onChange={(e) => setForm({ ...form, assessment_type: e.target.value })}><option value="initial">ครั้งแรก</option><option value="periodic">ประเมินซ้ำ</option></select></Field>
            <Field label="ผล"><select style={inputStyle} value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}><option value="">—</option><option value="pass">ผ่าน</option><option value="fail">ไม่ผ่าน</option></select></Field>
          </div>
          <Field label="รายการตรวจ (Test) — ไม่บังคับ"><select style={inputStyle} value={form.test_id} onChange={(e) => setForm({ ...form, test_id: e.target.value })}><option value="">— เลือก —</option>{tests.map((t) => <option key={t.id} value={t.id}>{t.code} · {t.th}</option>)}</select></Field>
          <Field label="หรือระบุหัวข้อสมรรถนะ (อิสระ)"><input style={inputStyle} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></Field>
          <Field label="ผู้ประเมิน"><select style={inputStyle} value={form.assessor_id} onChange={(e) => setForm({ ...form, assessor_id: e.target.value })}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="วันที่ประเมิน"><DateInputBE value={form.assessment_date} onChange={(value) => setForm({ ...form, assessment_date: value })} /></Field>
            <Field label="ครบกำหนดประเมินครั้งถัดไป"><DateInputBE value={form.next_due_date} onChange={(value) => setForm({ ...form, next_due_date: value })} /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Field label="คะแนนความรู้"><input type="number" style={inputStyle} value={form.score_knowledge} onChange={(e) => setForm({ ...form, score_knowledge: e.target.value })} /></Field>
            <Field label="คะแนน Safety"><input type="number" style={inputStyle} value={form.score_safety} onChange={(e) => setForm({ ...form, score_safety: e.target.value })} /></Field>
            <Field label="คะแนนปฏิบัติ"><input type="number" style={inputStyle} value={form.score_practical} onChange={(e) => setForm({ ...form, score_practical: e.target.value })} /></Field>
          </div>
          <Field label="หมายเหตุ"><input style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </Modal>
      )}
    </Card>
  )
}

// ════════════ Certification tab ════════════
function CertTab({ profileId, items, setItems, canEdit, toast }: { profileId: string; items: StaffCertification[]; setItems: (f: (p: StaffCertification[]) => StaffCertification[]) => void; canEdit: boolean; toast: (m: string, ok?: boolean) => void }) {
  const [modal, setModal] = useState(false)
  const empty = { cert_type: '', cert_name: '', cert_no: '', issuer: '', issue_date: '', expiry_date: '', remark: '' }
  const [form, setForm] = useState(empty)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.cert_name.trim()) { toast('กรุณากรอกชื่อใบรับรอง', false); return }
    setSaving(true)
    try {
      let file_url: string | undefined
      if (file) {
        const fd = new FormData(); fd.append('file', file); fd.append('kind', 'cert')
        const up = await fetch(`/api/admin/personnel/${profileId}/files`, { method: 'POST', body: fd })
        const uj = await up.json(); if (!up.ok) throw new Error(uj.error); file_url = uj.file_url
      }
      const payload = { ...form, file_url, status: 'active' as const }
      const created = await apiSend(`/api/admin/personnel/${profileId}/certifications`, 'POST', payload)
      setItems((p) => [created, ...p]); setModal(false); setForm(empty); setFile(null); toast('บันทึกใบรับรองแล้ว')
    } catch (e) { toast(e instanceof Error ? e.message : 'error', false) } finally { setSaving(false) }
  }
  async function remove(id: string) {
    if (!confirm('ลบรายการนี้?')) return
    try { await apiSend(`/api/admin/personnel/${profileId}/certifications/${id}`, 'DELETE'); setItems((p) => p.filter((x) => x.id !== id)); toast('ลบแล้ว') }
    catch (e) { toast(e instanceof Error ? e.message : 'error', false) }
  }

  return (
    <Card padding={20}>
      <SectionHeader title="ใบอนุญาต / ใบรับรอง" sub="ใบอนุญาตและใบรับรองวิชาชีพ" canEdit={canEdit} onAdd={() => setModal(true)} />
      <ChildTable
        cols={['ชื่อใบรับรอง', 'เลขที่', 'ผู้ออก', 'ออกเมื่อ', 'หมดอายุ', 'ไฟล์', '']}
        empty="ยังไม่มีใบรับรอง"
        rows={items.map((c) => {
          const s = expiryStatus(c.expiry_date)
          return (
            <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ ...td, fontWeight: 600 }}>{c.cert_name}{c.cert_type && <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{c.cert_type}</div>}</td>
              <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{c.cert_no ?? '—'}</td>
              <td style={td}>{c.issuer ?? '—'}</td>
              <td style={td}>{fmtDate(c.issue_date)}</td>
              <td style={td}>{c.expiry_date ? <span style={{ color: EXPIRY_COLOR[s], fontWeight: s === 'valid' ? 400 : 600 }}>{fmtDate(c.expiry_date)}{s !== 'valid' && s !== 'none' ? ` · ${EXPIRY_LABEL_TH[s]}` : ''}{s === 'expiring' && daysLeft(c.expiry_date) !== null ? ` (${daysLeft(c.expiry_date)} วัน)` : ''}</span> : '—'}</td>
              <td style={td}>{c.file_url ? <button onClick={() => openAttachment(profileId, c.file_url!)} style={iconBtn}><Icon name="eye" size={14} /></button> : '—'}</td>
              <td style={{ ...td, textAlign: 'right' }}>{canEdit && <button onClick={() => remove(c.id)} style={iconBtn}><Icon name="trash" size={14} /></button>}</td>
            </tr>
          )
        })}
      />
      {modal && (
        <Modal title="เพิ่มใบรับรอง" onClose={() => setModal(false)}
          footer={<><button onClick={() => setModal(false)} style={ghostBtn}>ยกเลิก</button><button onClick={save} disabled={saving} style={primaryBtn}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button></>}>
          <Field label="ชื่อใบรับรอง *"><input style={inputStyle} value={form.cert_name} onChange={(e) => setForm({ ...form, cert_name: e.target.value })} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="ประเภท"><input style={inputStyle} placeholder="license / certificate / training" value={form.cert_type} onChange={(e) => setForm({ ...form, cert_type: e.target.value })} /></Field>
            <Field label="เลขที่"><input style={inputStyle} value={form.cert_no} onChange={(e) => setForm({ ...form, cert_no: e.target.value })} /></Field>
          </div>
          <Field label="ผู้ออก"><input style={inputStyle} value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="วันที่ออก"><DateInputBE value={form.issue_date} onChange={(value) => setForm({ ...form, issue_date: value })} /></Field>
            <Field label="วันหมดอายุ"><DateInputBE value={form.expiry_date} onChange={(value) => setForm({ ...form, expiry_date: value })} /></Field>
          </div>
          <Field label="หมายเหตุ"><input style={inputStyle} value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></Field>
          <Field label="ไฟล์ใบรับรอง (PDF/รูป ≤10MB)">
            <FileDropZone file={file} accept=".pdf,image/*" note="รองรับ PDF และรูปภาพ ขนาดไม่เกิน 10MB" onFile={setFile} />
          </Field>
        </Modal>
      )}
    </Card>
  )
}

// ════════════ Authorization tab (work assignment matrix) ════════════
const ROLE_LABEL: Record<string, string> = { performer: 'ผู้ปฏิบัติ', reporter: 'ผู้รายงานผล', approver: 'ผู้รับรองผล', authorized_signatory: 'Authorized Signatory', deputy: 'ผู้ปฏิบัติแทน' }

function AuthTab({ profileId, items, setItems, canEdit, tests, testById, categories, competencies, toast }: {
  profileId: string; items: StaffAuthorization[]; setItems: (f: (p: StaffAuthorization[]) => StaffAuthorization[]) => void; canEdit: boolean
  tests: TestOption[]; testById: Map<number, TestOption>; categories: string[]; competencies: StaffCompetency[]; toast: (m: string, ok?: boolean) => void
}) {
  const [modal, setModal] = useState(false)
  const [scope, setScope] = useState<'test' | 'category'>('test')
  const empty = { test_id: '', category: '', role_type: 'performer', competency_id: '', authorized_date: '', notes: '' }
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (scope === 'test' && !form.test_id) { toast('กรุณาเลือก test', false); return }
    if (scope === 'category' && !form.category) { toast('กรุณาเลือกหมวด', false); return }
    setSaving(true)
    try {
      const payload = {
        test_id: scope === 'test' ? Number(form.test_id) : null,
        category: scope === 'category' ? form.category : undefined,
        role_type: form.role_type, competency_id: form.competency_id || null,
        authorized_date: form.authorized_date || undefined, status: 'active' as const, notes: form.notes || undefined,
      }
      const created = await apiSend(`/api/admin/personnel/${profileId}/authorizations`, 'POST', payload)
      setItems((p) => [created, ...p]); setModal(false); setForm(empty); toast('มอบหมายสิทธิ์แล้ว')
    } catch (e) { toast(e instanceof Error ? e.message : 'error', false) } finally { setSaving(false) }
  }
  async function remove(id: string) {
    if (!confirm('ถอนการมอบหมายนี้?')) return
    try { await apiSend(`/api/admin/personnel/${profileId}/authorizations/${id}`, 'DELETE'); setItems((p) => p.filter((x) => x.id !== id)); toast('ถอนแล้ว') }
    catch (e) { toast(e instanceof Error ? e.message : 'error', false) }
  }

  return (
    <Card padding={20}>
      <SectionHeader title="มอบหมายสิทธิ์ทำการตรวจ" sub="สิทธิ์ปฏิบัติงาน · เชื่อมกับรายการตรวจ" canEdit={canEdit} onAdd={() => setModal(true)} />
      <ChildTable
        cols={['ขอบเขต', 'บทบาท', 'อ้างอิงสมรรถนะ', 'วันที่มอบหมาย', 'สถานะ', '']}
        empty="ยังไม่มีการมอบหมาย"
        rows={items.map((a) => {
          const t = a.test_id ? testById.get(a.test_id) : null
          return (
            <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ ...td, fontWeight: 600 }}>
                {t ? `${t.code} · ${t.th}` : a.category ? <span>หมวด: {a.category}</span> : '—'}
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{a.test_id ? 'รายการตรวจ' : 'ทั้งหมวด'}</div>
              </td>
              <td style={td}>{ROLE_LABEL[a.role_type] ?? a.role_type}</td>
              <td style={td}>{a.competency_id ? <span style={{ color: 'var(--success)', fontSize: 12 }}>✓ มีหลักฐาน</span> : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
              <td style={td}>{fmtDate(a.authorized_date)}</td>
              <td style={td}><span style={{ fontWeight: 600, color: a.status === 'active' ? 'var(--success)' : 'var(--muted)' }}>{a.status === 'active' ? 'ใช้งาน' : 'ถอนแล้ว'}</span></td>
              <td style={{ ...td, textAlign: 'right' }}>{canEdit && <button onClick={() => remove(a.id)} style={iconBtn}><Icon name="trash" size={14} /></button>}</td>
            </tr>
          )
        })}
      />
      {modal && (
        <Modal title="มอบหมายสิทธิ์ทำการตรวจ" onClose={() => setModal(false)}
          footer={<><button onClick={() => setModal(false)} style={ghostBtn}>ยกเลิก</button><button onClick={save} disabled={saving} style={primaryBtn}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button></>}>
          <Field label="ขอบเขตการมอบหมาย">
            <div style={{ display: 'flex', gap: 8 }}>
              {(['test', 'category'] as const).map((s) => (
                <button key={s} onClick={() => setScope(s)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: scope === s ? 'var(--primary)' : 'transparent', color: scope === s ? '#fff' : 'var(--ink)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {s === 'test' ? 'รายการตรวจ (Test)' : 'ทั้งหมวด'}
                </button>
              ))}
            </div>
          </Field>
          {scope === 'test'
            ? <Field label="เลือก Test"><select style={inputStyle} value={form.test_id} onChange={(e) => setForm({ ...form, test_id: e.target.value })}><option value="">— เลือก —</option>{tests.map((t) => <option key={t.id} value={t.id}>{t.code} · {t.th}</option>)}</select></Field>
            : <Field label="เลือกหมวด"><select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="">— เลือก —</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>}
          <Field label="บทบาท"><select style={inputStyle} value={form.role_type} onChange={(e) => setForm({ ...form, role_type: e.target.value })}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="อ้างอิงหลักฐานสมรรถนะ (ไม่บังคับ)"><select style={inputStyle} value={form.competency_id} onChange={(e) => setForm({ ...form, competency_id: e.target.value })}><option value="">—</option>{competencies.map((c) => <option key={c.id} value={c.id}>{(c.test_id ? testById.get(c.test_id)?.code : c.area) ?? 'สมรรถนะ'} · {fmtDate(c.assessment_date)} {c.result === 'pass' ? '(ผ่าน)' : ''}</option>)}</select></Field>
          <Field label="วันที่มอบหมาย"><DateInputBE value={form.authorized_date} onChange={(value) => setForm({ ...form, authorized_date: value })} /></Field>
          <Field label="หมายเหตุ"><input style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </Modal>
      )}
    </Card>
  )
}

// ── reusable child table shell ──
function ChildTable({ cols, rows, empty }: { cols: string[]; rows: React.ReactNode[]; empty: string }) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: 'var(--surface-2)' }}>{cols.map((c, i) => <th key={i} style={th}>{c}</th>)}</tr></thead>
        <tbody>{rows.length === 0 ? <tr><td colSpan={cols.length} style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{empty}</td></tr> : rows}</tbody>
      </table>
    </div>
  )
}

function SignoffChip({ label, done, canEdit, onToggle }: { label: string; done: boolean; canEdit: boolean; onToggle: () => void }) {
  return (
    <button onClick={canEdit ? onToggle : undefined} disabled={!canEdit} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 10.5, fontWeight: 600,
      border: '1px solid var(--border)', cursor: canEdit ? 'pointer' : 'default', fontFamily: 'inherit',
      background: done ? 'rgba(22,163,74,.12)' : 'transparent', color: done ? 'var(--success)' : 'var(--muted)',
    }}>
      <Icon name={done ? 'check' : 'x'} size={11} /> {label}
    </button>
  )
}

// ════════════ Training Plan tab (ISO 6.2.4) ════════════
function TrainingPlanTab({ profileId, items, setItems, training, canEdit, toast }: {
  profileId: string; items: StaffTrainingPlan[]; setItems: (f: (p: StaffTrainingPlan[]) => StaffTrainingPlan[]) => void
  training: StaffTraining[]; canEdit: boolean; toast: (m: string, ok?: boolean) => void
}) {
  const [modal, setModal] = useState(false)
  const thisYear = new Date().getFullYear() + 543
  const empty = { year: String(thisYear), topic: '', source: '', notes: '' }
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.topic.trim()) { toast('กรุณากรอกหัวข้อ', false); return }
    setSaving(true)
    try {
      const created = await apiSend(`/api/admin/personnel/${profileId}/training-plan`, 'POST', {
        year: Number(form.year), topic: form.topic, source: form.source || undefined, status: 'planned', notes: form.notes || undefined,
      })
      setItems((p) => [created, ...p]); setModal(false); setForm(empty); toast('เพิ่มแผนอบรมแล้ว')
    } catch (e) { toast(e instanceof Error ? e.message : 'error', false) } finally { setSaving(false) }
  }
  async function setStatus(id: string, status: 'planned' | 'done' | 'cancelled') {
    try { const u = await apiSend(`/api/admin/personnel/${profileId}/training-plan/${id}`, 'PATCH', { status }); setItems((p) => p.map((x) => x.id === id ? u : x)) }
    catch (e) { toast(e instanceof Error ? e.message : 'error', false) }
  }
  async function remove(id: string) {
    if (!confirm('ลบแผนนี้?')) return
    try { await apiSend(`/api/admin/personnel/${profileId}/training-plan/${id}`, 'DELETE'); setItems((p) => p.filter((x) => x.id !== id)) }
    catch (e) { toast(e instanceof Error ? e.message : 'error', false) }
  }

  const doneTopics = new Set(training.map((t) => t.topic.trim().toLowerCase()))

  return (
    <Card padding={20}>
      <SectionHeader title="แผนการฝึกอบรมรายปี" sub="แผนพัฒนาทักษะ · อิงผลการประเมินสมรรถนะ" canEdit={canEdit} onAdd={() => setModal(true)} />
      <ChildTable
        cols={['ปี (พ.ศ.)', 'หัวข้อ', 'ที่มา', 'สถานะ', '']}
        empty="ยังไม่มีแผนอบรม"
        rows={items.map((p) => {
          const matched = doneTopics.has(p.topic.trim().toLowerCase())
          return (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={td}>{p.year}</td>
              <td style={{ ...td, fontWeight: 600 }}>{p.topic}{matched && p.status !== 'done' && <span style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--success)' }}>• มีบันทึกอบรมแล้ว</span>}</td>
              <td style={td}>{p.source ?? '—'}</td>
              <td style={td}>
                {canEdit
                  ? <select value={p.status} onChange={(e) => setStatus(p.id, e.target.value as 'planned' | 'done' | 'cancelled')} style={{ ...inputStyle, padding: '4px 8px', width: 'auto', fontSize: 12 }}>
                      <option value="planned">วางแผน</option><option value="done">เสร็จสิ้น</option><option value="cancelled">ยกเลิก</option>
                    </select>
                  : <span style={{ fontWeight: 600, color: p.status === 'done' ? 'var(--success)' : p.status === 'cancelled' ? 'var(--muted)' : 'var(--warning)' }}>{p.status === 'done' ? 'เสร็จสิ้น' : p.status === 'cancelled' ? 'ยกเลิก' : 'วางแผน'}</span>}
              </td>
              <td style={{ ...td, textAlign: 'right' }}>{canEdit && <button onClick={() => remove(p.id)} style={iconBtn}><Icon name="trash" size={14} /></button>}</td>
            </tr>
          )
        })}
      />
      {modal && (
        <Modal title="เพิ่มแผนอบรม" onClose={() => setModal(false)}
          footer={<><button onClick={() => setModal(false)} style={ghostBtn}>ยกเลิก</button><button onClick={save} disabled={saving} style={primaryBtn}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button></>}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
            <Field label="ปี (พ.ศ.)"><input type="number" style={inputStyle} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></Field>
            <Field label="หัวข้อ *"><input style={inputStyle} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></Field>
          </div>
          <Field label="ที่มา (เช่น ช่องว่างสมรรถนะ)"><input style={inputStyle} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></Field>
          <Field label="หมายเหตุ"><input style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </Modal>
      )}
    </Card>
  )
}

// ════════════ JDJS tab (ISO 6.2.2) ════════════
function JdTab({ profileId, items, setItems, canEdit, toast }: { profileId: string; items: StaffJd[]; setItems: (f: (p: StaffJd[]) => StaffJd[]) => void; canEdit: boolean; toast: (m: string, ok?: boolean) => void }) {
  const [modal, setModal] = useState<StaffJd | 'new' | null>(null)
  const [revOf, setRevOf] = useState<StaffJd | null>(null)

  async function remove(id: string) {
    if (!confirm('ลบ JDJS นี้?')) return
    try { await apiSend(`/api/admin/personnel/${profileId}/jd/${id}`, 'DELETE'); setItems((p) => p.filter((x) => x.id !== id)); toast('ลบแล้ว') }
    catch (e) { toast(e instanceof Error ? e.message : 'error', false) }
  }

  return (
    <Card padding={20}>
      <SectionHeader title="JDJS / Job Description & Job Specification" sub="คำบรรยายลักษณะงาน · มี version control" canEdit={canEdit} onAdd={() => setModal('new')} />
      <ChildTable
        cols={['มีผล', 'ผู้อนุมัติ', 'ตำแหน่งผู้อนุมัติ', 'ไฟล์ PDF', 'สถานะ', '']}
        empty="ยังไม่มี JDJS"
        rows={items.map((j) => (
          <tr key={j.id} style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={td}>{fmtDate(j.effective_date)}</td>
            <td style={td}>{j.approver_name ?? '—'}</td>
            <td style={td}>{jdjsApproverPosition(j) ?? '—'}</td>
            <td style={td}>{j.file_url ? <button onClick={() => openAttachment(profileId, j.file_url!)} style={iconBtn}><Icon name="eye" size={14} /></button> : '—'}</td>
            <td style={td}><span style={{ fontWeight: 600, color: j.status === 'Active' ? 'var(--success)' : j.status === 'Obsolete' ? 'var(--muted)' : 'var(--warning)' }}>{j.status}</span></td>
            <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
              <button onClick={() => setRevOf(j)} title="ประวัติฉบับแก้ไข" style={iconBtn}><Icon name="clock" size={14} /></button>
              {canEdit && <button onClick={() => setModal(j)} title="แก้ไข" style={{ ...iconBtn, marginLeft: 4 }}><Icon name="edit" size={14} /></button>}
              {canEdit && <button onClick={() => remove(j.id)} style={{ ...iconBtn, marginLeft: 4 }}><Icon name="trash" size={14} /></button>}
            </td>
          </tr>
        ))}
      />
      {modal && <JdModal profileId={profileId} jd={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSaved={(saved, isNew) => { setItems((p) => isNew ? [saved, ...p] : p.map((x) => x.id === saved.id ? saved : x)); setModal(null); toast('บันทึก JDJS แล้ว') }} onError={(m) => toast(m, false)} />}
      {revOf && <JdRevisionsModal profileId={profileId} jd={revOf} onClose={() => setRevOf(null)} />}
    </Card>
  )
}

function JdModal({ profileId, jd, onClose, onSaved, onError }: { profileId: string; jd: StaffJd | null; onClose: () => void; onSaved: (j: StaffJd, isNew: boolean) => void; onError: (m: string) => void }) {
  const [form, setForm] = useState({
    jd_code: jd?.jd_code ?? '', position_title: jd?.position_title ?? '', version: jd?.version ?? '1',
    content: jd?.content ?? '',
    effective_date: jd?.effective_date ?? JDJS_DEFAULT_EFFECTIVE_DATE,
    approver_name: jd?.approver_name ?? JDJS_DEFAULT_APPROVER_NAME,
    approver_position: jd ? jdjsApproverPosition(jd) ?? '' : JDJS_DEFAULT_APPROVER_POSITION,
    status: jd?.status ?? 'Active',
    revision_note: '',
  })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  async function save() {
    setSaving(true)
    try {
      let file_url: string | undefined
      if (file) {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        if (!isPdf) throw new Error('JDJS รองรับเฉพาะไฟล์ PDF')
        const fd = new FormData(); fd.append('file', file); fd.append('kind', 'jdjs')
        const up = await fetch(`/api/admin/personnel/${profileId}/files`, { method: 'POST', body: fd })
        const uj = await up.json(); if (!up.ok) throw new Error(uj.error); file_url = uj.file_url
      }
      const url = jd ? `/api/admin/personnel/${profileId}/jd/${jd.id}` : `/api/admin/personnel/${profileId}/jd`
      const payload = file_url ? { ...form, file_url } : form
      const saved = await apiSend(url, jd ? 'PATCH' : 'POST', payload)
      onSaved(saved, !jd)
    } catch (e) { onError(e instanceof Error ? e.message : 'error') } finally { setSaving(false) }
  }
  return (
    <Modal title={jd ? `แก้ไข JDJS (Rev. ${jd.version})` : 'เพิ่ม JDJS'} onClose={onClose}
      footer={<><button onClick={onClose} style={ghostBtn}>ยกเลิก</button><button onClick={save} disabled={saving} style={primaryBtn}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="วันที่มีผล"><DateInputBE value={form.effective_date} onChange={(value) => setForm({ ...form, effective_date: value })} /></Field>
        <Field label="ผู้อนุมัติ"><input style={inputStyle} value={form.approver_name} onChange={(e) => setForm({ ...form, approver_name: e.target.value })} /></Field>
      </div>
      <Field label="ตำแหน่งผู้อนุมัติ"><input style={inputStyle} value={form.approver_position} onChange={(e) => setForm({ ...form, approver_position: e.target.value })} /></Field>
      <Field label="สถานะ"><select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StaffJd['status'] })}><option value="Draft">Draft</option><option value="Active">Active</option><option value="Obsolete">Obsolete</option></select></Field>
      <Field label="ไฟล์ PDF JDJS">
        <FileDropZone file={file} accept=".pdf,application/pdf" note={jd?.file_url ? 'มีไฟล์เดิมแล้ว · ลาก PDF ใหม่มาวางเพื่อแทนที่' : 'รองรับ PDF ขนาดไม่เกิน 10MB'} onFile={setFile} />
        {jd?.file_url && !file && (
          <button type="button" onClick={() => openAttachment(profileId, jd.file_url!)} style={{ ...ghostBtn, marginTop: 8, fontSize: 12 }}>
            <Icon name="eye" size={13} /> ดูไฟล์ PDF ปัจจุบัน
          </button>
        )}
      </Field>
      {jd && <Field label="หมายเหตุการแก้ไข (เก็บใน revision)"><input style={inputStyle} value={form.revision_note} onChange={(e) => setForm({ ...form, revision_note: e.target.value })} placeholder="ระบุเมื่อเปลี่ยน version/เนื้อหา" /></Field>}
    </Modal>
  )
}

function JdRevisionsModal({ profileId, jd, onClose }: { profileId: string; jd: StaffJd; onClose: () => void }) {
  const [revs, setRevs] = useState<StaffJdRevision[] | null>(null)
  useEffect(() => {
    fetch(`/api/admin/personnel/${profileId}/jd/${jd.id}/revisions`).then((r) => r.json()).then((j) => setRevs(j.data ?? [])).catch(() => setRevs([]))
  }, [profileId, jd.id])
  return (
    <Modal title={`ประวัติฉบับแก้ไข — ${jd.jd_code ?? 'JDJS'}`} onClose={onClose} footer={<button onClick={onClose} style={ghostBtn}>ปิด</button>}>
      {revs === null ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด…</div>
        : revs.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>ยังไม่มีประวัติการแก้ไข (ฉบับปัจจุบัน Rev. {jd.version})</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {revs.map((r) => (
              <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <strong style={{ color: 'var(--ink)' }}>Rev. {r.version}</strong>
                  <span style={{ color: 'var(--muted)' }}>{fmtDateTimeDateBE(r.created_at)}</span>
                </div>
                {(r.approver_name || jdjsApproverPosition(r)) && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    ผู้อนุมัติ: {r.approver_name ?? '—'}{jdjsApproverPosition(r) ? ` · ${jdjsApproverPosition(r)}` : ''}
                  </div>
                )}
                {r.revision_note && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>หมายเหตุ: {r.revision_note}</div>}
                {r.content && <div style={{ fontSize: 12.5, color: 'var(--ink)', marginTop: 6, whiteSpace: 'pre-wrap' }}>{r.content}</div>}
              </div>
            ))}
          </div>}
    </Modal>
  )
}

// ════════════ Orientation tab (ISO 6.2.4) ════════════
function OrientationTab({ profileId, canEdit, toast }: { profileId: string; canEdit: boolean; toast: (m: string, ok?: boolean) => void }) {
  const [items, setItems] = useState<OrientationItem[] | null>(null)
  const [completedAt, setCompletedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newItem, setNewItem] = useState('')

  useEffect(() => {
    fetch(`/api/admin/personnel/${profileId}/orientation`).then((r) => r.json()).then((j) => { setItems(j.data?.items ?? []); setCompletedAt(j.data?.completed_at ?? null) }).catch(() => setItems([]))
  }, [profileId])

  async function persist(next: OrientationItem[]) {
    setItems(next)
    if (!canEdit) return
    setSaving(true)
    try {
      const saved = await apiSend(`/api/admin/personnel/${profileId}/orientation`, 'PUT', { items: next })
      setCompletedAt(saved.completed_at ?? null)
    } catch (e) { toast(e instanceof Error ? e.message : 'error', false) } finally { setSaving(false) }
  }
  function toggle(key: string) {
    if (!items) return
    persist(items.map((i) => i.key === key ? { ...i, done: !i.done } : i))
  }
  function addItem() {
    if (!newItem.trim() || !items) return
    persist([...items, { key: `c${Date.now()}`, label: newItem.trim(), done: false }]); setNewItem('')
  }
  function removeItem(key: string) {
    if (!items) return
    if (!confirm('ลบหัวข้อนี้ออกจากรายการปฐมนิเทศของทุกคน?')) return
    persist(items.filter((i) => i.key !== key))
  }

  const done = items?.filter((i) => i.done).length ?? 0
  const total = items?.length ?? 0

  return (
    <Card padding={20}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>การปฐมนิเทศพนักงานใหม่</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>หัวข้อเป็นชุดกลางใช้ร่วมกันทุกคน · สถานะติ๊กเก็บแยกตามบุคคล{saving && ' · กำลังบันทึก…'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: total > 0 && done === total ? 'var(--success)' : 'var(--ink)' }}>{done}/{total}</div>
          {completedAt && <div style={{ fontSize: 11, color: 'var(--success)' }}>เสร็จสมบูรณ์ {fmtDateTimeDateBE(completedAt)}</div>}
        </div>
      </div>
      {items === null ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด…</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((i) => (
              <div key={i.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: i.done ? 'rgba(22,163,74,.06)' : 'var(--card)' }}>
                <input type="checkbox" checked={i.done} disabled={!canEdit} onChange={() => toggle(i.key)} style={{ width: 16, height: 16, cursor: canEdit ? 'pointer' : 'default' }} />
                <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)', textDecoration: i.done ? 'line-through' : 'none' }}>{i.label}</span>
                {canEdit && <button onClick={() => removeItem(i.key)} style={iconBtn}><Icon name="trash" size={13} /></button>}
              </div>
            ))}
            {canEdit && (
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="เพิ่มหัวข้อปฐมนิเทศ" style={inputStyle} onKeyDown={(e) => { if (e.key === 'Enter') addItem() }} />
                <button onClick={addItem} style={primaryBtn}><Icon name="plus" size={15} /> เพิ่ม</button>
              </div>
            )}
          </div>}
    </Card>
  )
}
