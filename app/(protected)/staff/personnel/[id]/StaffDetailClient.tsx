'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { Card } from '@/components/ui/Card'
import type {
  Profile, StaffCertification, StaffTraining, StaffCompetency, StaffAuthorization,
  StaffJd, StaffJdRevision, StaffTrainingPlan, OrientationItem,
  StaffHealthRecord, StaffConfidentialityAgreement,
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
    healthRecords: StaffHealthRecord[]
    confidentiality: StaffConfidentialityAgreement[]
  }
  canEdit: boolean
  tests: TestOption[]
  categories: string[]
  staff: StaffOption[]
  officialPhotoUrl?: string | null
}

type TabKey = 'profile' | 'training' | 'plan' | 'competency' | 'cert' | 'auth' | 'jd' | 'orient' | 'health'

const TABS: { key: TabKey; th: string; icon: string }[] = [
  { key: 'profile',    th: 'ประวัติ',        icon: 'users' },
  { key: 'training',   th: 'การอบรม',       icon: 'book' },
  { key: 'plan',       th: 'แผนอบรม',       icon: 'chart' },
  { key: 'competency', th: 'สมรรถนะ',       icon: 'check' },
  { key: 'cert',       th: 'ใบรับรอง',      icon: 'doc' },
  { key: 'auth',       th: 'มอบหมายงาน',   icon: 'shieldCheck' },
  { key: 'jd',         th: 'JDJS',          icon: 'edit' },
  { key: 'health',     th: 'สุขภาพ & ข้อตกลง', icon: 'syringe' },
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

export function StaffDetailClient({ detail, canEdit, tests, categories, staff, officialPhotoUrl }: DetailProps) {
  const { profile } = detail
  const [tab, setTab] = useState<TabKey>('profile')
  const { toasts, add } = useToast()

  const [certs, setCerts] = useState(detail.certifications)
  const [training, setTraining] = useState(detail.training)
  const [comps, setComps] = useState(detail.competencies)
  const [auths, setAuths] = useState(detail.authorizations)
  const [jds, setJds] = useState(detail.jds)
  const [plan, setPlan] = useState(detail.trainingPlan)
  const [health, setHealth] = useState(detail.healthRecords)
  const [confid, setConfid] = useState(detail.confidentiality)
  const [prof, setProf] = useState(profile)

  const testById = useMemo(() => new Map(tests.map((t) => [t.id, t])), [tests])
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s.name])), [staff])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @keyframes sd-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .sd-rise { opacity: 0; animation: sd-rise .4s cubic-bezier(.22,.68,0,1) forwards; }
        .sd-widget:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(15,23,42,.08); }
        @media (prefers-color-scheme: dark) { .sd-widget:hover { box-shadow: 0 12px 28px rgba(0,0,0,.35); } }
        @media (prefers-reduced-motion: reduce) {
          .sd-rise { animation: none; opacity: 1; }
          .sd-widget:hover { transform: none; }
        }
      `}</style>
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
          const count = t.key === 'training' ? training.length : t.key === 'competency' ? comps.length : t.key === 'cert' ? certs.length : t.key === 'auth' ? auths.length : t.key === 'jd' ? jds.length : t.key === 'plan' ? plan.length : t.key === 'health' ? health.length + confid.length : null
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

      {tab === 'profile' && (
        <>
          <ProfileTab prof={prof} canEdit={canEdit} officialPhotoUrl={officialPhotoUrl} onSaved={(p) => { setProf(p); add('บันทึกประวัติแล้ว') }} onError={(m) => add(m, false)} />
          <OverviewSection prof={prof} training={training} plan={plan} comps={comps} certs={certs} auths={auths} jds={jds} onNavigate={setTab} />
        </>
      )}
      {tab === 'training' && <TrainingTab profileId={prof.id} items={training} setItems={setTraining} plans={plan} canEdit={canEdit} toast={add} />}
      {tab === 'plan' && <TrainingPlanTab profileId={prof.id} items={plan} setItems={setPlan} training={training} canEdit={canEdit} toast={add} />}
      {tab === 'competency' && <CompetencyTab profileId={prof.id} items={comps} setItems={setComps} canEdit={canEdit} tests={tests} testById={testById} staff={staff} staffById={staffById} toast={add} />}
      {tab === 'cert' && <CertTab profileId={prof.id} items={certs} setItems={setCerts} canEdit={canEdit} toast={add} />}
      {tab === 'auth' && <AuthTab profileId={prof.id} items={auths} setItems={setAuths} canEdit={canEdit} tests={tests} testById={testById} categories={categories} competencies={comps} toast={add} />}
      {tab === 'jd' && <JdTab profileId={prof.id} items={jds} setItems={setJds} canEdit={canEdit} toast={add} />}
      {tab === 'health' && <HealthTab profileId={prof.id} health={health} setHealth={setHealth} confid={confid} setConfid={setConfid} canEdit={canEdit} toast={add} />}
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
const miniSelectStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 6px', fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  const content = (
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
  // Portal to <body> so a transformed ancestor (e.g. the .sd-rise card) can't become the
  // containing block for this position:fixed overlay and clip/offset it.
  return typeof document === 'undefined' ? content : createPortal(content, document.body)
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

const DATE_POPUP_WIDTH = 306
const DATE_POPUP_MARGIN = 8

function DateInputBE({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const selected = dateFromIso(value)
  const today = new Date()
  const initial = selected ?? today
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)

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
      const target = event.target as Node
      if (wrapRef.current?.contains(target)) return
      if (popupRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // Popup is portaled to <body> with viewport-clamped fixed coordinates so a narrow
  // grid column or a scrollable modal ancestor can't clip it (same issue Modal itself
  // solves with a portal — here the calendar could otherwise render partly off-screen).
  useEffect(() => {
    if (!open) return
    function updatePos() {
      const rect = wrapRef.current?.getBoundingClientRect()
      if (!rect) return
      const maxLeft = window.innerWidth - DATE_POPUP_WIDTH - DATE_POPUP_MARGIN
      const left = Math.max(DATE_POPUP_MARGIN, Math.min(rect.right - DATE_POPUP_WIDTH, maxLeft))
      setPos({ top: rect.bottom + 6, left })
    }
    updatePos()
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
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
  // Wide range so long-tenured staff (start dates decades back) or license expiry years
  // ahead don't require clicking the month arrow dozens of times.
  const yearOptions = Array.from({ length: 91 }, (_, i) => today.getFullYear() + 10 - i)

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

      {open && pos && typeof document !== 'undefined' && createPortal(
        <div ref={popupRef} style={{
          position: 'fixed',
          zIndex: 1200,
          top: pos.top,
          left: pos.left,
          width: DATE_POPUP_WIDTH,
          maxWidth: 'min(306px, calc(100vw - 16px))',
          padding: 12,
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--card)',
          boxShadow: '0 18px 44px rgba(15,23,42,.18)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 10 }}>
            <button type="button" onClick={() => moveMonth(-1)} style={iconBtn} aria-label="เดือนก่อนหน้า">
              <Icon name="arrowLeft" size={14} />
            </button>
            <div style={{ display: 'flex', gap: 5, flex: 1, justifyContent: 'center' }}>
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                style={miniSelectStyle}
                aria-label="เลือกเดือน"
              >
                {TH_MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                style={miniSelectStyle}
                aria-label="เลือกปี พ.ศ."
              >
                {yearOptions.map((y) => <option key={y} value={y}>{y + 543}</option>)}
              </select>
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
        </div>,
        document.body,
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

// Official photo is always stored as a small, fixed-aspect portrait JPEG — never the raw
// upload (raw phone/camera photos can be 10+ MB and any aspect ratio). PhotoCropDialog lets
// the user pan/zoom to pick the crop window themselves before it's baked into this size.
const OFFICIAL_PHOTO_WIDTH = 480
const OFFICIAL_PHOTO_HEIGHT = 610

interface CropOffset { x: number; y: number }

function PhotoCropDialog({ src, busy, onCancel, onConfirm }: {
  src: string
  busy: boolean
  onCancel: () => void
  onConfirm: (file: File) => void
}) {
  const VW = 240
  const VH = Math.round((VW * OFFICIAL_PHOTO_HEIGHT) / OFFICIAL_PHOTO_WIDTH)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 })
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const baseScale = natural ? Math.max(VW / natural.w, VH / natural.h) : 1
  const scale = baseScale * zoom
  const dispW = natural ? natural.w * scale : 0
  const dispH = natural ? natural.h * scale : 0

  function clamp(o: CropOffset, dw: number, dh: number): CropOffset {
    const minX = Math.min(0, VW - dw)
    const minY = Math.min(0, VH - dh)
    return { x: Math.min(0, Math.max(minX, o.x)), y: Math.min(0, Math.max(minY, o.y)) }
  }

  function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const w = e.currentTarget.naturalWidth
    const h = e.currentTarget.naturalHeight
    const bScale = Math.max(VW / w, VH / h)
    const dW = w * bScale
    const dH = h * bScale
    // Default framing is biased toward the top of the image (not centered) — a
    // head-and-shoulders portrait usually has the face in the upper portion.
    setOffset(clamp({ x: (VW - dW) / 2, y: (VH - dH) * 0.15 }, dW, dH))
    setZoom(1)
    setNatural({ w, h })
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y }
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setOffset(clamp({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy }, dispW, dispH))
  }
  function onPointerUp() { dragRef.current = null }

  function handleZoomChange(z: number) {
    if (!natural) { setZoom(z); return }
    const bScale = Math.max(VW / natural.w, VH / natural.h)
    const s = bScale * z
    setZoom(z)
    setOffset((o) => clamp(o, natural.w * s, natural.h * s))
  }

  function handleConfirm() {
    const img = imgRef.current
    if (!img || !natural) return
    const canvas = document.createElement('canvas')
    canvas.width = OFFICIAL_PHOTO_WIDTH
    canvas.height = OFFICIAL_PHOTO_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const sourceX = -offset.x / scale
    const sourceY = -offset.y / scale
    const sourceW = VW / scale
    const sourceH = VH / scale
    ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, OFFICIAL_PHOTO_WIDTH, OFFICIAL_PHOTO_HEIGHT)
    canvas.toBlob((blob) => { if (blob) onConfirm(new File([blob], 'official-photo.jpg', { type: 'image/jpeg' })) }, 'image/jpeg', 0.85)
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 320, boxShadow: '0 24px 70px rgba(0,0,0,.35)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>ปรับตำแหน่งรูป</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.4 }}>ลากรูปเพื่อขยับ และเลื่อนแถบเพื่อซูม ให้ใบหน้าอยู่ในกรอบ</div>
        <div
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          style={{ width: VW, height: VH, margin: '0 auto', borderRadius: 10, overflow: 'hidden', position: 'relative', background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
        >
          <img
            ref={imgRef}
            src={src}
            onLoad={handleImgLoad}
            draggable={false}
            alt="ปรับตำแหน่งรูปทางการ"
            style={{ position: 'absolute', left: offset.x, top: offset.y, width: dispW || undefined, height: dispH || undefined, maxWidth: 'none', userSelect: 'none', pointerEvents: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <Icon name="search" size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <input type="range" min={1} max={2.5} step={0.02} value={zoom} onChange={(e) => handleZoomChange(Number(e.target.value))} style={{ flex: 1 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onCancel} disabled={busy} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink)', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
            ยกเลิก
          </button>
          <button onClick={handleConfirm} disabled={busy || !natural} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, opacity: busy || !natural ? .7 : 1 }}>
            {busy ? 'กำลังอัปโหลด…' : 'ยืนยันและอัปโหลด'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ════════════ Profile tab ════════════
function ProfileTab({ prof, canEdit, officialPhotoUrl, onSaved, onError }: { prof: Profile; canEdit: boolean; officialPhotoUrl?: string | null; onSaved: (p: Profile) => void; onError: (m: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(officialPhotoUrl ?? null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  function openCropForFile(file: File) {
    if (!file.type.startsWith('image/')) { onError('รูปทางการรองรับเฉพาะไฟล์รูปภาพ (PNG, JPG, WebP)'); return }
    if (file.size > 10 * 1024 * 1024) { onError('รูปต้องไม่เกิน 10 MB'); return }
    setCropSrc(URL.createObjectURL(file))
  }

  async function openCropForCurrentPhoto() {
    if (!photoUrl) return
    try {
      const res = await fetch(photoUrl)
      const blob = await res.blob()
      setCropSrc(URL.createObjectURL(blob))
    } catch { onError('โหลดรูปเดิมไม่สำเร็จ') }
  }

  function closeCropDialog() {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  async function uploadOfficialPhoto(file: File) {
    setPhotoBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('kind', 'official-photo')
      const up = await fetch(`/api/admin/personnel/${prof.id}/files`, { method: 'POST', body: fd })
      const upJson = await up.json()
      if (!up.ok) throw new Error(upJson.error ?? 'อัปโหลดรูปไม่สำเร็จ')
      const res = await fetch(`/api/admin/personnel/${prof.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ official_photo_url: upJson.file_url }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'บันทึกรูปไม่สำเร็จ')
      onSaved(json as Profile)
      setPhotoUrl(upJson.signed_url ?? null)
      closeCropDialog()
    } catch (e) { onError(e instanceof Error ? e.message : 'error') } finally { setPhotoBusy(false) }
  }
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
    <div className="sd-rise" style={{
      position: 'relative',
      background: 'linear-gradient(135deg, var(--card) 0%, var(--surface-2) 130%)',
      border: '1px solid var(--border)', borderRadius: 16,
      boxShadow: '0 14px 36px rgba(15,23,42,.06)',
    }}>
      {/* overflow:hidden is scoped to this decorative wrapper only, so the fixed-position
          Modal below (a sibling, not a descendant) is never at risk of being clipped/contained. */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, padding: 22 }}>
        <div style={{
          position: 'absolute', top: -70, right: -50, width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, var(--primary-soft) 0%, transparent 70%)', pointerEvents: 'none',
        }} />
        <SectionHeader title="ประวัติบุคลากร" sub="ข้อมูลส่วนบุคคล · คุณสมบัติวิชาชีพ" canEdit={canEdit} onAdd={canEdit ? () => setEditing(true) : undefined} />
        <div style={{ position: 'relative', display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Official photo (formal / uniform), separate from display avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ position: 'relative', width: 140, height: 178, borderRadius: 13, overflow: 'hidden', border: `2px solid ${photoUrl ? 'var(--primary)' : 'var(--border)'}`, background: 'var(--surface-2)', boxShadow: photoUrl ? '0 8px 22px var(--primary-soft)' : 'none' }}>
            {photoUrl ? (
              <img src={photoUrl} alt="รูปทางการ" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg viewBox="0 0 140 178" style={{ width: '100%', height: '100%' }} aria-hidden="true">
                <rect width="140" height="178" fill="var(--surface-2)" />
                <circle cx="70" cy="68" r="32" fill="var(--border)" />
                <path d="M16 178 C16 132 42 114 70 114 C98 114 124 132 124 178 Z" fill="var(--border)" />
              </svg>
            )}
            {canEdit && (
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={photoBusy}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '7px 0', border: 'none', background: 'rgba(15,23,42,.66)', color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: photoBusy ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
              >
                <Icon name={photoBusy ? 'clock' : 'upload'} size={12} /> {photoBusy ? 'กำลังอัปโหลด…' : photoUrl ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
              </button>
            )}
          </div>
          {canEdit && photoUrl && (
            <button
              onClick={openCropForCurrentPhoto}
              disabled={photoBusy}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 11, fontFamily: 'inherit', cursor: photoBusy ? 'default' : 'pointer' }}
            >
              <Icon name="edit" size={11} /> แก้ไขรูป
            </button>
          )}
          <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) openCropForFile(f); e.target.value = '' }} />
          {cropSrc && (
            <PhotoCropDialog src={cropSrc} busy={photoBusy} onCancel={closeCropDialog} onConfirm={uploadOfficialPhoto} />
          )}
        </div>

        {/* Facts */}
        <div style={{ flex: '1 1 420px', maxWidth: 620, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(140px, 1fr))', columnGap: 22, rowGap: 18 }}>
          {rows.map(([k, v], i) => (
            <div key={k} style={{ paddingTop: i >= 3 ? 14 : 0, borderTop: i >= 3 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 14.5, color: 'var(--ink)', fontWeight: 600 }}>
                {k === 'วันหมดอายุใบอนุญาต' && v
                  ? <span style={{ color: EXPIRY_COLOR[expiryStatus(v)] }}>{fmtDate(v)} · {EXPIRY_LABEL_TH[expiryStatus(v)]}</span>
                  : (v ?? <span style={{ color: 'var(--muted)', fontWeight: 400 }}>—</span>)}
              </div>
            </div>
          ))}
        </div>
        </div>
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
    </div>
  )
}

// ════════════ Overview section (profile tab) ════════════
function OverviewWidget({ icon, title, count, iconTone, children, onOpen, openLabel, delay = 0 }: {
  icon: string; title: string; count?: React.ReactNode; iconTone?: 'primary' | 'success' | 'warning' | 'danger';
  children: React.ReactNode; onOpen: () => void; openLabel: string; delay?: number
}) {
  const toneBg = iconTone === 'success' ? 'rgba(22,163,74,.10)'
    : iconTone === 'warning' ? 'rgba(217,119,6,.10)'
    : iconTone === 'danger' ? 'rgba(220,38,38,.10)'
    : 'var(--primary-soft)'
  const toneColor = iconTone === 'success' ? 'var(--success)'
    : iconTone === 'warning' ? 'var(--warning)'
    : iconTone === 'danger' ? 'var(--danger)'
    : 'var(--primary)'
  return (
    <div className="sd-rise sd-widget" style={{
      animationDelay: `${delay}ms`,
      background: 'var(--card)', border: '1px solid var(--border)', borderTop: `2.5px solid ${toneColor}55`,
      borderRadius: 14, padding: '16px 17px 13px', display: 'flex', flexDirection: 'column', minHeight: 152,
      transition: 'transform .18s, box-shadow .18s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: toneBg, color: toneColor }}>
          <Icon name={icon} size={18} />
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{title}</span>
        {count !== undefined && <span style={{ marginLeft: 'auto', fontSize: 21, fontWeight: 800, lineHeight: 1, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>{children}</div>
      <div style={{ marginTop: 11, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <button onClick={onOpen} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {openLabel} <Icon name="arrowRight" size={12} />
        </button>
      </div>
    </div>
  )
}

function OverviewRow({ date, text }: { date?: string | null; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12.5 }}>
      {date && <span style={{ color: 'var(--muted)', fontSize: 11.5, whiteSpace: 'nowrap' }}>{fmtDate(date)}</span>}
      <span style={{ color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
    </div>
  )
}

function OverviewPill({ tone, children }: { tone: 'ok' | 'warn' | 'crit' | 'info'; children: React.ReactNode }) {
  const map = {
    ok: ['var(--success)', 'rgba(22,163,74,.10)'],
    warn: ['var(--warning)', 'rgba(217,119,6,.10)'],
    crit: ['var(--danger)', 'rgba(220,38,38,.10)'],
    info: ['var(--primary)', 'var(--primary-soft)'],
  }[tone]
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99, color: map[0], background: map[1], width: 'fit-content' }}>{children}</span>
}

function OverviewEmpty({ text }: { text: string }) {
  return <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: '4px 0' }}>{text}</div>
}

function OverviewSection({ prof, training, plan, comps, certs, auths, jds, onNavigate }: {
  prof: Profile
  training: StaffTraining[]
  plan: StaffTrainingPlan[]
  comps: StaffCompetency[]
  certs: StaffCertification[]
  auths: StaffAuthorization[]
  jds: StaffJd[]
  onNavigate: (tab: TabKey) => void
}) {
  const hasMtLicenseScope = hasMedicalTechnologistLicenseScope(prof.role)

  const alerts = useMemo(() => {
    const list: { tone: 'crit' | 'warn'; msg: React.ReactNode; go: TabKey | null }[] = []
    // MT license
    if (hasMtLicenseScope) {
      const st = expiryStatus(prof.mt_license_expiry)
      if (st === 'expired') list.push({ tone: 'crit', msg: <><b>ใบอนุญาต ทนพ. หมดอายุแล้ว</b> ({fmtDate(prof.mt_license_expiry)})</>, go: null })
      else if (st === 'expiring') list.push({ tone: 'warn', msg: <><b>ใบอนุญาต ทนพ. ใกล้หมดอายุ</b> ({fmtDate(prof.mt_license_expiry)})</>, go: null })
      else if (!prof.mt_license_expiry || !prof.mt_license_no) list.push({ tone: 'warn', msg: <><b>ยังไม่ได้บันทึกเลขใบอนุญาต ทนพ. หรือวันหมดอายุ</b></>, go: null })
    }
    // Certifications
    const certExpired = certs.filter((c) => expiryStatus(c.expiry_date) === 'expired').length
    const certExpiring = certs.filter((c) => expiryStatus(c.expiry_date) === 'expiring').length
    if (certExpired > 0) list.push({ tone: 'crit', msg: <><b>ใบรับรองหมดอายุ {certExpired} รายการ</b></>, go: 'cert' })
    else if (certExpiring > 0) list.push({ tone: 'warn', msg: <><b>ใบรับรองใกล้หมดอายุ {certExpiring} รายการ</b></>, go: 'cert' })
    // Competency due
    const compOverdue = comps.filter((c) => expiryStatus(c.next_due_date) === 'expired').length
    const compDue = comps.filter((c) => expiryStatus(c.next_due_date) === 'expiring').length
    if (compOverdue > 0) list.push({ tone: 'crit', msg: <><b>ค้างประเมินสมรรถนะ {compOverdue} รายการ</b> (เกินกำหนดทบทวน)</>, go: 'competency' })
    else if (compDue > 0) list.push({ tone: 'warn', msg: <><b>สมรรถนะใกล้ถึงรอบทบทวน {compDue} รายการ</b></>, go: 'competency' })
    // Planned training pending
    const planned = plan.filter((p) => p.status === 'planned').length
    if (planned > 0) list.push({ tone: 'warn', msg: <><b>แผนอบรมรอดำเนินการ {planned} รายการ</b></>, go: 'plan' })
    return list
  }, [prof, certs, comps, plan, hasMtLicenseScope])

  const latestComp = comps[0]
  const plannedCount = plan.filter((p) => p.status === 'planned').length
  const activeAuths = auths.filter((a) => a.status === 'active')
  const activeJd = jds.find((j) => j.status === 'Active') ?? jds[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>ต้องดำเนินการ / แจ้งเตือน</div>
          {alerts.map((a, i) => (
            <div key={i} className="sd-rise" style={{
              animationDelay: `${i * 40}ms`,
              display: 'flex', alignItems: 'center', gap: 13, padding: '12px 16px', borderRadius: 12,
              border: '1px solid var(--border)', borderLeft: `3px solid ${a.tone === 'crit' ? 'var(--danger)' : 'var(--warning)'}`,
              background: 'var(--card)', boxShadow: '0 2px 8px rgba(15,23,42,.03)',
            }}>
              <span style={{
                width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: a.tone === 'crit' ? 'rgba(220,38,38,.10)' : 'rgba(217,119,6,.10)',
                color: a.tone === 'crit' ? 'var(--danger)' : 'var(--warning)',
              }}><Icon name="alert" size={15} /></span>
              <span style={{ fontSize: 13, flex: 1, color: 'var(--ink)' }}>{a.msg}</span>
              {a.go && (
                <button onClick={() => onNavigate(a.go as TabKey)} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>ดูรายละเอียด →</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Overview widgets */}
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>ภาพรวม</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))', gap: 12 }}>

        <OverviewWidget icon="book" title="ประชุม / อบรม" count={training.length} onOpen={() => onNavigate('training')} openLabel={`ดูทั้งหมด ${training.length} รายการ`} delay={0}>
          {training.length === 0 ? <OverviewEmpty text="ยังไม่มีบันทึกการอบรม" /> : training.slice(0, 3).map((t) => <OverviewRow key={t.id} date={t.training_date} text={t.topic} />)}
        </OverviewWidget>

        <OverviewWidget icon="chart" title="แผนพัฒนา / อบรม" count={plan.length} iconTone={plannedCount > 0 ? 'warning' : 'primary'} onOpen={() => onNavigate('plan')} openLabel="ดูแผนพัฒนา" delay={40}>
          {plan.length === 0 ? <OverviewEmpty text="ยังไม่มีแผนอบรม" /> : <>
            {plannedCount > 0 && <OverviewPill tone="warn">⏰ รอดำเนินการ {plannedCount}</OverviewPill>}
            {plan.slice(0, 2).map((p) => <OverviewRow key={p.id} text={`${p.topic} (${p.year})`} />)}
          </>}
        </OverviewWidget>

        <OverviewWidget icon="check" title="สมรรถนะ" count={comps.length} iconTone={latestComp?.result === 'pass' ? 'success' : latestComp?.result === 'fail' ? 'danger' : 'primary'} onOpen={() => onNavigate('competency')} openLabel="ดูผลประเมิน" delay={80}>
          {comps.length === 0 ? <OverviewEmpty text="ยังไม่มีการประเมินสมรรถนะ" /> : <>
            {latestComp?.result === 'pass' && <OverviewPill tone="ok">✓ ผ่านเกณฑ์ (ล่าสุด)</OverviewPill>}
            {latestComp?.result === 'fail' && <OverviewPill tone="crit">ไม่ผ่านเกณฑ์ (ล่าสุด)</OverviewPill>}
            {latestComp && <OverviewRow date={latestComp.assessment_date} text={latestComp.area ?? 'การประเมินสมรรถนะ'} />}
          </>}
        </OverviewWidget>

        <OverviewWidget icon="doc" title="ใบอนุญาต / ใบรับรอง" count={certs.length} onOpen={() => onNavigate('cert')} openLabel={certs.length === 0 ? '+ เพิ่มใบรับรอง' : 'ดูใบรับรอง'} delay={120}>
          {certs.length === 0 ? <OverviewEmpty text="ยังไม่มีใบรับรอง" /> : certs.slice(0, 3).map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
              <span style={{ color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.cert_name}</span>
              {c.expiry_date && <span style={{ fontSize: 11, fontWeight: 700, color: EXPIRY_COLOR[expiryStatus(c.expiry_date)], whiteSpace: 'nowrap' }}>{EXPIRY_LABEL_TH[expiryStatus(c.expiry_date)]}</span>}
            </div>
          ))}
        </OverviewWidget>

        <OverviewWidget icon="shieldCheck" title="มอบหมายงาน" count={activeAuths.length} onOpen={() => onNavigate('auth')} openLabel="ดูการมอบหมาย" delay={160}>
          {auths.length === 0 ? <OverviewEmpty text="ยังไม่มีการมอบหมาย" /> : <>
            <OverviewPill tone="info">มอบหมายที่ใช้งานอยู่ {activeAuths.length}</OverviewPill>
            {activeAuths.slice(0, 2).map((a) => <OverviewRow key={a.id} text={a.category ?? a.role_type} />)}
          </>}
        </OverviewWidget>

        <OverviewWidget icon="edit" title="JDJS / ใบกำหนดหน้าที่" count={jds.length} iconTone={activeJd?.status === 'Active' ? 'success' : 'primary'} onOpen={() => onNavigate('jd')} openLabel="ดูเอกสาร JD" delay={200}>
          {jds.length === 0 ? <OverviewEmpty text="ยังไม่มีเอกสาร JD" /> : <>
            {activeJd?.status === 'Active' && <OverviewPill tone="ok">✓ JD ใช้งานอยู่ (v{activeJd.version})</OverviewPill>}
            {activeJd && <OverviewRow date={activeJd.effective_date} text={activeJd.position_title ?? 'ใบกำหนดหน้าที่งาน'} />}
          </>}
        </OverviewWidget>

        <OverviewWidget icon="clock" title="ปฐมนิเทศ / ทดลองปฏิบัติงาน" onOpen={() => onNavigate('orient')} openLabel="ดูรายละเอียด" delay={240}>
          <OverviewRow text="แผนปฐมนิเทศและทดลองปฏิบัติงาน" />
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>เปิดแท็บเพื่อดู/บันทึกความคืบหน้า</div>
        </OverviewWidget>

      </div>
    </div>
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
const TRAINING_TYPE_LABEL: Record<string, string> = { in_plan: 'ในแผนอบรม', out_of_plan: 'นอกแผนอบรม' }
const EMPTY_TRAINING = { topic: '', training_date: '', training_end_date: '', hours: '', provider: '', location: '', training_type: '', cpd_credits: '', notes: '' }

// Multi-day training hours auto-fill: 8 hours per day of the date range (inclusive of both ends).
function trainingDayCount(startIso: string, endIso: string): number {
  const start = dateFromIso(startIso)
  if (!start) return 1
  const end = dateFromIso(endIso)
  if (!end || end < start) return 1
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1
}
function withAutoHours(f: typeof EMPTY_TRAINING): typeof EMPTY_TRAINING {
  if (!f.training_date) return f
  return { ...f, hours: String(trainingDayCount(f.training_date, f.training_end_date) * 8) }
}
function TrainingTab({ profileId, items, setItems, plans, canEdit, toast }: { profileId: string; items: StaffTraining[]; setItems: (f: (p: StaffTraining[]) => StaffTraining[]) => void; plans: StaffTrainingPlan[]; canEdit: boolean; toast: (m: string, ok?: boolean) => void }) {
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<StaffTraining | null>(null)
  const [form, setForm] = useState(EMPTY_TRAINING)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const doneTopics = useMemo(() => new Set(items.map((t) => t.topic.trim().toLowerCase())), [items])
  const pendingPlans = useMemo(
    () => plans.filter((p) => p.status === 'planned' && !doneTopics.has(p.topic.trim().toLowerCase())),
    [plans, doneTopics],
  )

  function openAdd() { setEditing(null); setForm(EMPTY_TRAINING); setFile(null); setModal(true) }
  function openEdit(t: StaffTraining) {
    setEditing(t)
    setForm({ topic: t.topic, training_date: t.training_date ?? '', training_end_date: t.training_end_date ?? '', hours: t.hours != null ? String(t.hours) : '', provider: t.provider ?? '', location: t.location ?? '', training_type: t.training_type ?? '', cpd_credits: t.cpd_credits != null ? String(t.cpd_credits) : '', notes: t.notes ?? '' })
    setFile(null); setModal(true)
  }

  async function save() {
    if (!form.topic.trim()) { toast('กรุณากรอกหัวข้อ', false); return }
    if (form.training_end_date && form.training_date && form.training_end_date < form.training_date) {
      toast('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม', false); return
    }
    setSaving(true)
    try {
      let evidence_url: string | undefined
      if (file) {
        const fd = new FormData(); fd.append('file', file); fd.append('kind', 'training')
        const up = await fetch(`/api/admin/personnel/${profileId}/files`, { method: 'POST', body: fd })
        const uj = await up.json(); if (!up.ok) throw new Error(uj.error); evidence_url = uj.file_url
      }
      const base = {
        topic: form.topic, training_date: form.training_date, training_end_date: form.training_end_date, hours: form.hours ? Number(form.hours) : null,
        provider: form.provider, location: form.location,
        training_type: form.training_type || null, cpd_credits: form.cpd_credits ? Number(form.cpd_credits) : null,
        notes: form.notes,
      }
      const payload = evidence_url ? { ...base, evidence_url } : base
      if (editing) {
        const updated = await apiSend(`/api/admin/personnel/${profileId}/training/${editing.id}`, 'PATCH', payload)
        setItems((p) => p.map((x) => (x.id === updated.id ? updated : x)))
      } else {
        const created = await apiSend(`/api/admin/personnel/${profileId}/training`, 'POST', payload)
        setItems((p) => [created, ...p])
      }
      setModal(false); setEditing(null); setForm(EMPTY_TRAINING); setFile(null)
      toast(editing ? 'แก้ไขการอบรมแล้ว' : 'บันทึกการอบรมแล้ว')
    } catch (e) { toast(e instanceof Error ? e.message : 'error', false) } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('ลบรายการนี้?')) return
    try { await apiSend(`/api/admin/personnel/${profileId}/training/${id}`, 'DELETE'); setItems((p) => p.filter((x) => x.id !== id)); toast('ลบแล้ว') }
    catch (e) { toast(e instanceof Error ? e.message : 'error', false) }
  }

  return (
    <Card padding={20}>
      <SectionHeader title="ประวัติการฝึกอบรม" sub="บันทึกการพัฒนาความรู้และทักษะ" canEdit={canEdit} onAdd={openAdd} />
      <ChildTable
        cols={['หัวข้อ', 'วันที่', 'ชั่วโมง', 'ประเภท', 'ผู้จัด', 'หลักฐาน', '']}
        empty="ยังไม่มีบันทึกการอบรม"
        rows={items.map((t) => (
          <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={{ ...td, fontWeight: 600 }}>{t.topic}{t.notes && <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 400 }}>{t.notes}</div>}</td>
            <td style={td}>{t.training_end_date && t.training_end_date !== t.training_date ? `${fmtDate(t.training_date)} – ${fmtDate(t.training_end_date)}` : fmtDate(t.training_date)}</td>
            <td style={td}>{t.hours ?? '—'}</td>
            <td style={td}>{t.training_type ? TRAINING_TYPE_LABEL[t.training_type] : '—'}{t.cpd_credits ? <span style={{ color: 'var(--muted)' }}> · {t.cpd_credits} หน่วย</span> : ''}</td>
            <td style={td}>{t.provider ?? '—'}</td>
            <td style={td}>{t.evidence_url ? <button onClick={() => openAttachment(profileId, t.evidence_url!)} style={iconBtn}><Icon name="eye" size={14} /></button> : '—'}</td>
            <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
              {canEdit && <button onClick={() => openEdit(t)} title="แก้ไข" style={iconBtn}><Icon name="edit" size={14} /></button>}
              {canEdit && <button onClick={() => remove(t.id)} style={{ ...iconBtn, marginLeft: 4 }}><Icon name="trash" size={14} /></button>}
            </td>
          </tr>
        ))}
      />
      {modal && (
        <Modal title={editing ? 'แก้ไขการอบรม' : 'เพิ่มการอบรม'} onClose={() => setModal(false)}
          footer={<><button onClick={() => setModal(false)} style={ghostBtn}>ยกเลิก</button><button onClick={save} disabled={saving} style={primaryBtn}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button></>}>
          {!editing && pendingPlans.length > 0 && (
            <Field label="เลือกจากแผนอบรม (ไม่บังคับ)">
              <select style={inputStyle} value="" onChange={(e) => { const p = pendingPlans.find((x) => x.id === e.target.value); if (p) setForm({ ...form, topic: p.topic }) }}>
                <option value="">— เลือกหัวข้อจากแผน —</option>
                {pendingPlans.map((p) => <option key={p.id} value={p.id}>{p.year} · {p.topic}</option>)}
              </select>
            </Field>
          )}
          <Field label="หัวข้อการอบรม *"><input style={inputStyle} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="วันที่เริ่ม"><DateInputBE value={form.training_date} onChange={(value) => setForm(withAutoHours({ ...form, training_date: value }))} /></Field>
            <Field label="วันที่สิ้นสุด"><DateInputBE value={form.training_end_date} onChange={(value) => setForm(withAutoHours({ ...form, training_end_date: value }))} /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="จำนวนชั่วโมง"><input type="number" style={inputStyle} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></Field>
            <Field label="ประเภท"><select style={inputStyle} value={form.training_type} onChange={(e) => setForm({ ...form, training_type: e.target.value })}><option value="">—</option><option value="in_plan">ในแผนอบรม</option><option value="out_of_plan">นอกแผนอบรม</option></select></Field>
          </div>
          <Field label="CMTE (ถ้าไม่มีให้เว้นว่าง)"><input type="number" placeholder="ใส่แต่ตัวเลข" style={inputStyle} value={form.cpd_credits} onChange={(e) => setForm({ ...form, cpd_credits: e.target.value })} /></Field>
          <Field label="ผู้จัด/วิทยากร"><input style={inputStyle} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></Field>
          <Field label="สถานที่"><input style={inputStyle} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          <Field label="หมายเหตุ"><input style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <Field label="ไฟล์หลักฐาน (PDF/รูป ≤10MB)">
            <FileDropZone file={file} accept=".pdf,image/*" note={editing?.evidence_url ? 'มีไฟล์เดิมแล้ว · ลากไฟล์ใหม่มาวางเพื่อแทนที่' : 'รองรับ PDF และรูปภาพ ขนาดไม่เกิน 10MB'} onFile={setFile} />
            {editing?.evidence_url && !file && (
              <button type="button" onClick={() => openAttachment(profileId, editing.evidence_url!)} style={{ ...ghostBtn, marginTop: 8, fontSize: 12 }}><Icon name="eye" size={13} /> ดูไฟล์ปัจจุบัน</button>
            )}
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
  const [editing, setEditing] = useState<StaffCompetency | null>(null)
  const empty = { assessment_type: 'initial', area: '', test_id: '', assessor_id: '', assessment_date: '', next_due_date: '', score_knowledge: '', score_safety: '', score_practical: '', result: '', notes: '' }
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  const overdue = items.filter((c) => expiryStatus(c.next_due_date) === 'expired').length
  const dueSoon = items.filter((c) => expiryStatus(c.next_due_date) === 'expiring').length

  function openAdd() { setEditing(null); setForm(empty); setModal(true) }
  function openEdit(c: StaffCompetency) {
    setEditing(c)
    setForm({
      assessment_type: c.assessment_type, area: c.area ?? '', test_id: c.test_id != null ? String(c.test_id) : '', assessor_id: c.assessor_id ?? '',
      assessment_date: c.assessment_date ?? '', next_due_date: c.next_due_date ?? '',
      score_knowledge: c.score_knowledge != null ? String(c.score_knowledge) : '', score_safety: c.score_safety != null ? String(c.score_safety) : '', score_practical: c.score_practical != null ? String(c.score_practical) : '',
      result: c.result ?? '', notes: c.notes ?? '',
    })
    setModal(true)
  }

  async function save() {
    setSaving(true)
    try {
      const payload = {
        assessment_type: form.assessment_type, area: form.area,
        test_id: form.test_id ? Number(form.test_id) : null, assessor_id: form.assessor_id || null,
        assessment_date: form.assessment_date, next_due_date: form.next_due_date,
        score_knowledge: form.score_knowledge ? Number(form.score_knowledge) : null,
        score_safety: form.score_safety ? Number(form.score_safety) : null,
        score_practical: form.score_practical ? Number(form.score_practical) : null,
        result: form.result || null, notes: form.notes,
      }
      if (editing) {
        const updated = await apiSend(`/api/admin/personnel/${profileId}/competencies/${editing.id}`, 'PATCH', payload)
        setItems((p) => p.map((x) => (x.id === updated.id ? updated : x)))
      } else {
        const created = await apiSend(`/api/admin/personnel/${profileId}/competencies`, 'POST', payload)
        setItems((p) => [created, ...p])
      }
      setModal(false); setEditing(null); setForm(empty); toast(editing ? 'แก้ไขการประเมินแล้ว' : 'บันทึกการประเมินแล้ว')
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
      <SectionHeader title="การประเมินสมรรถนะ" sub="สมรรถนะวิชาชีพ · ยืนยันโดยผู้ประเมิน" canEdit={canEdit} onAdd={openAdd} />
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
              <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {canEdit && <button onClick={() => openEdit(c)} title="แก้ไข" style={iconBtn}><Icon name="edit" size={14} /></button>}
                {canEdit && <button onClick={() => remove(c.id)} style={{ ...iconBtn, marginLeft: 4 }}><Icon name="trash" size={14} /></button>}
              </td>
            </tr>
          )
        })}
      />
      {modal && (
        <Modal title={editing ? 'แก้ไขการประเมินสมรรถนะ' : 'ประเมินสมรรถนะ'} onClose={() => setModal(false)}
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
const EMPTY_CERT = { cert_type: '', cert_name: '', cert_no: '', issuer: '', issue_date: '', expiry_date: '', remark: '' }
function CertTab({ profileId, items, setItems, canEdit, toast }: { profileId: string; items: StaffCertification[]; setItems: (f: (p: StaffCertification[]) => StaffCertification[]) => void; canEdit: boolean; toast: (m: string, ok?: boolean) => void }) {
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<StaffCertification | null>(null)
  const [form, setForm] = useState(EMPTY_CERT)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  function openAdd() { setEditing(null); setForm(EMPTY_CERT); setFile(null); setModal(true) }
  function openEdit(c: StaffCertification) {
    setEditing(c)
    setForm({ cert_type: c.cert_type ?? '', cert_name: c.cert_name, cert_no: c.cert_no ?? '', issuer: c.issuer ?? '', issue_date: c.issue_date ?? '', expiry_date: c.expiry_date ?? '', remark: c.remark ?? '' })
    setFile(null); setModal(true)
  }

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
      const base = editing ? { ...form } : { ...form, status: 'active' as const }
      const payload = file_url ? { ...base, file_url } : base
      if (editing) {
        const updated = await apiSend(`/api/admin/personnel/${profileId}/certifications/${editing.id}`, 'PATCH', payload)
        setItems((p) => p.map((x) => (x.id === updated.id ? updated : x)))
      } else {
        const created = await apiSend(`/api/admin/personnel/${profileId}/certifications`, 'POST', payload)
        setItems((p) => [created, ...p])
      }
      setModal(false); setEditing(null); setForm(EMPTY_CERT); setFile(null); toast(editing ? 'แก้ไขใบรับรองแล้ว' : 'บันทึกใบรับรองแล้ว')
    } catch (e) { toast(e instanceof Error ? e.message : 'error', false) } finally { setSaving(false) }
  }
  async function remove(id: string) {
    if (!confirm('ลบรายการนี้?')) return
    try { await apiSend(`/api/admin/personnel/${profileId}/certifications/${id}`, 'DELETE'); setItems((p) => p.filter((x) => x.id !== id)); toast('ลบแล้ว') }
    catch (e) { toast(e instanceof Error ? e.message : 'error', false) }
  }

  return (
    <Card padding={20}>
      <SectionHeader title="ใบอนุญาต / ใบรับรอง" sub="ใบอนุญาตและใบรับรองวิชาชีพ" canEdit={canEdit} onAdd={openAdd} />
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
              <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {canEdit && <button onClick={() => openEdit(c)} title="แก้ไข" style={iconBtn}><Icon name="edit" size={14} /></button>}
                {canEdit && <button onClick={() => remove(c.id)} style={{ ...iconBtn, marginLeft: 4 }}><Icon name="trash" size={14} /></button>}
              </td>
            </tr>
          )
        })}
      />
      {modal && (
        <Modal title={editing ? 'แก้ไขใบรับรอง' : 'เพิ่มใบรับรอง'} onClose={() => setModal(false)}
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
            <FileDropZone file={file} accept=".pdf,image/*" note={editing?.file_url ? 'มีไฟล์เดิมแล้ว · ลากไฟล์ใหม่มาวางเพื่อแทนที่' : 'รองรับ PDF และรูปภาพ ขนาดไม่เกิน 10MB'} onFile={setFile} />
            {editing?.file_url && !file && (
              <button type="button" onClick={() => openAttachment(profileId, editing.file_url!)} style={{ ...ghostBtn, marginTop: 8, fontSize: 12 }}><Icon name="eye" size={13} /> ดูไฟล์ปัจจุบัน</button>
            )}
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
  const [editing, setEditing] = useState<StaffAuthorization | null>(null)
  const [scope, setScope] = useState<'test' | 'category'>('test')
  const empty = { test_id: '', category: '', role_type: 'performer', competency_id: '', authorized_date: '', status: 'active', revoked_date: '', notes: '' }
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  function openAdd() { setEditing(null); setScope('test'); setForm(empty); setModal(true) }
  function openEdit(a: StaffAuthorization) {
    setEditing(a)
    setScope(a.test_id != null ? 'test' : 'category')
    setForm({
      test_id: a.test_id != null ? String(a.test_id) : '', category: a.category ?? '', role_type: a.role_type,
      competency_id: a.competency_id ?? '', authorized_date: a.authorized_date ?? '',
      status: a.status, revoked_date: a.revoked_date ?? '', notes: a.notes ?? '',
    })
    setModal(true)
  }

  async function save() {
    if (scope === 'test' && !form.test_id) { toast('กรุณาเลือก test', false); return }
    if (scope === 'category' && !form.category) { toast('กรุณาเลือกหมวด', false); return }
    setSaving(true)
    try {
      const payload = {
        test_id: scope === 'test' ? Number(form.test_id) : null,
        category: scope === 'category' ? form.category : '',
        role_type: form.role_type, competency_id: form.competency_id || null,
        authorized_date: form.authorized_date,
        status: form.status as 'active' | 'revoked',
        revoked_date: form.status === 'revoked' ? form.revoked_date : '',
        notes: form.notes,
      }
      if (editing) {
        const updated = await apiSend(`/api/admin/personnel/${profileId}/authorizations/${editing.id}`, 'PATCH', payload)
        setItems((p) => p.map((x) => (x.id === updated.id ? updated : x)))
      } else {
        const created = await apiSend(`/api/admin/personnel/${profileId}/authorizations`, 'POST', payload)
        setItems((p) => [created, ...p])
      }
      setModal(false); setEditing(null); setForm(empty); toast(editing ? 'แก้ไขการมอบหมายแล้ว' : 'มอบหมายสิทธิ์แล้ว')
    } catch (e) { toast(e instanceof Error ? e.message : 'error', false) } finally { setSaving(false) }
  }
  async function remove(id: string) {
    if (!confirm('ถอนการมอบหมายนี้?')) return
    try { await apiSend(`/api/admin/personnel/${profileId}/authorizations/${id}`, 'DELETE'); setItems((p) => p.filter((x) => x.id !== id)); toast('ถอนแล้ว') }
    catch (e) { toast(e instanceof Error ? e.message : 'error', false) }
  }

  return (
    <Card padding={20}>
      <SectionHeader title="มอบหมายสิทธิ์ทำการตรวจ" sub="สิทธิ์ปฏิบัติงาน · เชื่อมกับรายการตรวจ" canEdit={canEdit} onAdd={openAdd} />
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
              <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {canEdit && <button onClick={() => openEdit(a)} title="แก้ไข" style={iconBtn}><Icon name="edit" size={14} /></button>}
                {canEdit && <button onClick={() => remove(a.id)} title="ถอน" style={{ ...iconBtn, marginLeft: 4 }}><Icon name="trash" size={14} /></button>}
              </td>
            </tr>
          )
        })}
      />
      {modal && (
        <Modal title={editing ? 'แก้ไขการมอบหมายสิทธิ์' : 'มอบหมายสิทธิ์ทำการตรวจ'} onClose={() => setModal(false)}
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
          <div style={{ display: 'grid', gridTemplateColumns: form.status === 'revoked' ? '1fr 1fr' : '1fr', gap: 12 }}>
            <Field label="สถานะ"><select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">ใช้งาน</option><option value="revoked">ถอนแล้ว</option></select></Field>
            {form.status === 'revoked' && <Field label="วันที่ถอน"><DateInputBE value={form.revoked_date} onChange={(value) => setForm({ ...form, revoked_date: value })} /></Field>}
          </div>
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

// ════════════ Health & Confidentiality tab (ISO 6.2 — staff health) ════════════
const HEALTH_TYPE_LABEL: Record<string, string> = { vaccination: 'วัคซีน', health_check: 'ตรวจสุขภาพ', other: 'อื่นๆ' }

function HealthTab({ profileId, health, setHealth, confid, setConfid, canEdit, toast }: {
  profileId: string
  health: StaffHealthRecord[]; setHealth: (f: (p: StaffHealthRecord[]) => StaffHealthRecord[]) => void
  confid: StaffConfidentialityAgreement[]; setConfid: (f: (p: StaffConfidentialityAgreement[]) => StaffConfidentialityAgreement[]) => void
  canEdit: boolean; toast: (m: string, ok?: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <HealthRecordsSection profileId={profileId} items={health} setItems={setHealth} canEdit={canEdit} toast={toast} />
      <ConfidentialitySection profileId={profileId} items={confid} setItems={setConfid} canEdit={canEdit} toast={toast} />
    </div>
  )
}

const EMPTY_HEALTH = { record_type: 'vaccination', name: '', record_date: '', next_due_date: '', result: '', notes: '' }
function HealthRecordsSection({ profileId, items, setItems, canEdit, toast }: { profileId: string; items: StaffHealthRecord[]; setItems: (f: (p: StaffHealthRecord[]) => StaffHealthRecord[]) => void; canEdit: boolean; toast: (m: string, ok?: boolean) => void }) {
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<StaffHealthRecord | null>(null)
  const [form, setForm] = useState(EMPTY_HEALTH)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  function openAdd() { setEditing(null); setForm(EMPTY_HEALTH); setFile(null); setModal(true) }
  function openEdit(r: StaffHealthRecord) {
    setEditing(r)
    setForm({ record_type: r.record_type, name: r.name, record_date: r.record_date ?? '', next_due_date: r.next_due_date ?? '', result: r.result ?? '', notes: r.notes ?? '' })
    setFile(null); setModal(true)
  }

  async function save() {
    if (!form.name.trim()) { toast('กรุณากรอกชื่อรายการ', false); return }
    setSaving(true)
    try {
      let evidence_url: string | undefined
      if (file) {
        const fd = new FormData(); fd.append('file', file); fd.append('kind', 'health')
        const up = await fetch(`/api/admin/personnel/${profileId}/files`, { method: 'POST', body: fd })
        const uj = await up.json(); if (!up.ok) throw new Error(uj.error); evidence_url = uj.file_url
      }
      const base = { record_type: form.record_type, name: form.name, record_date: form.record_date, next_due_date: form.next_due_date, result: form.result, notes: form.notes }
      const payload = evidence_url ? { ...base, evidence_url } : base
      if (editing) {
        const updated = await apiSend(`/api/admin/personnel/${profileId}/health/${editing.id}`, 'PATCH', payload)
        setItems((p) => p.map((x) => (x.id === updated.id ? updated : x)))
      } else {
        const created = await apiSend(`/api/admin/personnel/${profileId}/health`, 'POST', payload)
        setItems((p) => [created, ...p])
      }
      setModal(false); setEditing(null); setForm(EMPTY_HEALTH); setFile(null); toast(editing ? 'แก้ไขบันทึกสุขภาพแล้ว' : 'บันทึกสุขภาพแล้ว')
    } catch (e) { toast(e instanceof Error ? e.message : 'error', false) } finally { setSaving(false) }
  }
  async function remove(id: string) {
    if (!confirm('ลบรายการนี้?')) return
    try { await apiSend(`/api/admin/personnel/${profileId}/health/${id}`, 'DELETE'); setItems((p) => p.filter((x) => x.id !== id)); toast('ลบแล้ว') }
    catch (e) { toast(e instanceof Error ? e.message : 'error', false) }
  }

  return (
    <Card padding={20}>
      <SectionHeader title="บันทึกสุขภาพ / วัคซีน" sub="ประวัติวัคซีนและการตรวจสุขภาพประจำปี" canEdit={canEdit} onAdd={openAdd} />
      <ChildTable
        cols={['รายการ', 'วันที่', 'ครบกำหนดถัดไป', 'ผล', 'หลักฐาน', '']}
        empty="ยังไม่มีบันทึกสุขภาพ"
        rows={items.map((r) => {
          const s = expiryStatus(r.next_due_date)
          return (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ ...td, fontWeight: 600 }}>{r.name}<div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{HEALTH_TYPE_LABEL[r.record_type] ?? r.record_type}</div></td>
              <td style={td}>{fmtDate(r.record_date)}</td>
              <td style={td}>{r.next_due_date ? <span style={{ color: EXPIRY_COLOR[s], fontWeight: s === 'valid' ? 400 : 600 }}>{fmtDate(r.next_due_date)}{s !== 'valid' && s !== 'none' ? ` · ${EXPIRY_LABEL_TH[s]}` : ''}</span> : '—'}</td>
              <td style={td}>{r.result ?? '—'}</td>
              <td style={td}>{r.evidence_url ? <button onClick={() => openAttachment(profileId, r.evidence_url!)} style={iconBtn}><Icon name="eye" size={14} /></button> : '—'}</td>
              <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {canEdit && <button onClick={() => openEdit(r)} title="แก้ไข" style={iconBtn}><Icon name="edit" size={14} /></button>}
                {canEdit && <button onClick={() => remove(r.id)} style={{ ...iconBtn, marginLeft: 4 }}><Icon name="trash" size={14} /></button>}
              </td>
            </tr>
          )
        })}
      />
      {modal && (
        <Modal title={editing ? 'แก้ไขบันทึกสุขภาพ' : 'เพิ่มบันทึกสุขภาพ'} onClose={() => setModal(false)}
          footer={<><button onClick={() => setModal(false)} style={ghostBtn}>ยกเลิก</button><button onClick={save} disabled={saving} style={primaryBtn}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button></>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <Field label="ประเภท"><select style={inputStyle} value={form.record_type} onChange={(e) => setForm({ ...form, record_type: e.target.value })}><option value="vaccination">วัคซีน</option><option value="health_check">ตรวจสุขภาพ</option><option value="other">อื่นๆ</option></select></Field>
            <Field label="ชื่อรายการ *"><input style={inputStyle} placeholder="เช่น วัคซีน HBV เข็ม 3, ตรวจสุขภาพประจำปี" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="วันที่"><DateInputBE value={form.record_date} onChange={(value) => setForm({ ...form, record_date: value })} /></Field>
            <Field label="ครบกำหนดถัดไป"><DateInputBE value={form.next_due_date} onChange={(value) => setForm({ ...form, next_due_date: value })} /></Field>
          </div>
          <Field label="ผล/รายละเอียด"><input style={inputStyle} value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} /></Field>
          <Field label="หมายเหตุ"><input style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <Field label="ไฟล์หลักฐาน (PDF/รูป ≤10MB)">
            <FileDropZone file={file} accept=".pdf,image/*" note={editing?.evidence_url ? 'มีไฟล์เดิมแล้ว · ลากไฟล์ใหม่มาวางเพื่อแทนที่' : 'รองรับ PDF และรูปภาพ ขนาดไม่เกิน 10MB'} onFile={setFile} />
            {editing?.evidence_url && !file && (
              <button type="button" onClick={() => openAttachment(profileId, editing.evidence_url!)} style={{ ...ghostBtn, marginTop: 8, fontSize: 12 }}><Icon name="eye" size={13} /> ดูไฟล์ปัจจุบัน</button>
            )}
          </Field>
        </Modal>
      )}
    </Card>
  )
}

const EMPTY_CONFID = { signed_date: '', notes: '' }
function ConfidentialitySection({ profileId, items, setItems, canEdit, toast }: { profileId: string; items: StaffConfidentialityAgreement[]; setItems: (f: (p: StaffConfidentialityAgreement[]) => StaffConfidentialityAgreement[]) => void; canEdit: boolean; toast: (m: string, ok?: boolean) => void }) {
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<StaffConfidentialityAgreement | null>(null)
  const [form, setForm] = useState(EMPTY_CONFID)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  function openAdd() { setEditing(null); setForm(EMPTY_CONFID); setFile(null); setModal(true) }
  function openEdit(a: StaffConfidentialityAgreement) {
    setEditing(a)
    setForm({ signed_date: a.signed_date ?? '', notes: a.notes ?? '' })
    setFile(null); setModal(true)
  }

  async function save() {
    setSaving(true)
    try {
      let file_url: string | undefined
      if (file) {
        const fd = new FormData(); fd.append('file', file); fd.append('kind', 'confidentiality')
        const up = await fetch(`/api/admin/personnel/${profileId}/files`, { method: 'POST', body: fd })
        const uj = await up.json(); if (!up.ok) throw new Error(uj.error); file_url = uj.file_url
      }
      const base = { signed_date: form.signed_date, notes: form.notes }
      const payload = file_url ? { ...base, file_url } : base
      if (editing) {
        const updated = await apiSend(`/api/admin/personnel/${profileId}/confidentiality/${editing.id}`, 'PATCH', payload)
        setItems((p) => p.map((x) => (x.id === updated.id ? updated : x)))
      } else {
        const created = await apiSend(`/api/admin/personnel/${profileId}/confidentiality`, 'POST', payload)
        setItems((p) => [created, ...p])
      }
      setModal(false); setEditing(null); setForm(EMPTY_CONFID); setFile(null); toast(editing ? 'แก้ไขข้อตกลงแล้ว' : 'บันทึกข้อตกลงแล้ว')
    } catch (e) { toast(e instanceof Error ? e.message : 'error', false) } finally { setSaving(false) }
  }
  async function remove(id: string) {
    if (!confirm('ลบรายการนี้?')) return
    try { await apiSend(`/api/admin/personnel/${profileId}/confidentiality/${id}`, 'DELETE'); setItems((p) => p.filter((x) => x.id !== id)); toast('ลบแล้ว') }
    catch (e) { toast(e instanceof Error ? e.message : 'error', false) }
  }

  return (
    <Card padding={20}>
      <SectionHeader title="ข้อตกลงรักษาความลับ (Confidentiality)" sub="เอกสารลงนามรักษาความลับ · ลงนามซ้ำรายปีได้" canEdit={canEdit} onAdd={openAdd} />
      <ChildTable
        cols={['วันที่ลงนาม', 'หมายเหตุ', 'ไฟล์', '']}
        empty="ยังไม่มีข้อตกลงรักษาความลับ"
        rows={items.map((a) => (
          <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={{ ...td, fontWeight: 600 }}>{fmtDate(a.signed_date)}</td>
            <td style={td}>{a.notes ?? '—'}</td>
            <td style={td}>{a.file_url ? <button onClick={() => openAttachment(profileId, a.file_url!)} style={iconBtn}><Icon name="eye" size={14} /></button> : '—'}</td>
            <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
              {canEdit && <button onClick={() => openEdit(a)} title="แก้ไข" style={iconBtn}><Icon name="edit" size={14} /></button>}
              {canEdit && <button onClick={() => remove(a.id)} style={{ ...iconBtn, marginLeft: 4 }}><Icon name="trash" size={14} /></button>}
            </td>
          </tr>
        ))}
      />
      {modal && (
        <Modal title={editing ? 'แก้ไขข้อตกลงรักษาความลับ' : 'เพิ่มข้อตกลงรักษาความลับ'} onClose={() => setModal(false)}
          footer={<><button onClick={() => setModal(false)} style={ghostBtn}>ยกเลิก</button><button onClick={save} disabled={saving} style={primaryBtn}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button></>}>
          <Field label="วันที่ลงนาม"><DateInputBE value={form.signed_date} onChange={(value) => setForm({ ...form, signed_date: value })} /></Field>
          <Field label="หมายเหตุ"><input style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <Field label="ไฟล์เอกสารลงนาม (PDF/รูป ≤10MB)">
            <FileDropZone file={file} accept=".pdf,image/*" note={editing?.file_url ? 'มีไฟล์เดิมแล้ว · ลากไฟล์ใหม่มาวางเพื่อแทนที่' : 'รองรับ PDF และรูปภาพ ขนาดไม่เกิน 10MB'} onFile={setFile} />
            {editing?.file_url && !file && (
              <button type="button" onClick={() => openAttachment(profileId, editing.file_url!)} style={{ ...ghostBtn, marginTop: 8, fontSize: 12 }}><Icon name="eye" size={13} /> ดูไฟล์ปัจจุบัน</button>
            )}
          </Field>
        </Modal>
      )}
    </Card>
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
