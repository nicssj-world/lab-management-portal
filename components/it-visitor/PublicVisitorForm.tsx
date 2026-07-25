'use client'

import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ActiveVisitCard } from '@/components/it-visitor/ActiveVisitCard'
import { DEPARTMENTS } from '@/lib/validations/user-schema'
import {
  ACTIVITY_TYPES, ACTIVITY_LABEL, APPOINTMENTS, APPOINTMENT_LABEL,
  BADGE_STATES, BADGE_LABEL, CONTACT_DEPT_OTHER, ORG_TYPES, ORG_TYPE_LABEL,
  SAFETY_ACKS, SAFETY_LABEL, SAFETY_POLICY_PROMPT,
} from '@/lib/it-visitor/constants'
import type {
  ActivityType, Appointment, BadgeState, OrgType, SafetyAck, VisitType,
} from '@/lib/it-visitor/constants'
import type {
  ActiveVisitorDTO,
  PublicVisitorFormState,
  VisitorSubmissionInput,
} from '@/lib/it-visitor/types'
import { validateVisitorSubmission } from '@/lib/it-visitor/validation'

type FieldKey = keyof VisitorSubmissionInput

/** ค่าฟอร์มเก็บเป็น string ทั้งหมด แล้วแปลงตอนส่ง — input ของเบราว์เซอร์คืน string เสมอ */
type FormValues = {
  visit_date: string
  visitor_name: string
  group_name: string
  member_names: string
  head_count: string
  phone: string
  email: string
  org_type: OrgType | ''
  org_name: string
  contact_dept: string
  contact_dept_other: string
  entered_at: string
  activity_type: ActivityType | ''
  activity_other: string
  appointment: Appointment | ''
  badge_exchanged: BadgeState | ''
  safety_ack: SafetyAck | ''
}

function pad(n: number) { return String(n).padStart(2, '0') }
function localDateValue(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function localDateTimeValue(d: Date) { return `${localDateValue(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}` }

function emptyValues(): FormValues {
  const now = new Date()
  return {
    visit_date: localDateValue(now),
    visitor_name: '', group_name: '', member_names: '', head_count: '',
    phone: '', email: '', org_type: '', org_name: '',
    contact_dept: '', contact_dept_other: '',
    entered_at: localDateTimeValue(now),
    activity_type: '', activity_other: '',
    appointment: '', badge_exchanged: '', safety_ack: '',
  }
}

export function PublicVisitorForm({ token, initialState, challenge, initialActiveVisit }: {
  token: string
  initialState: PublicVisitorFormState
  challenge: string
  initialActiveVisit?: ActiveVisitorDTO | null
}) {
  const [mode, setMode] = useState<VisitType | null>(null)
  const [values, setValues] = useState<FormValues>(emptyValues)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activeVisit, setActiveVisit] = useState<ActiveVisitorDTO | null>(initialActiveVisit ?? null)
  // สร้างครั้งเดียวตอน mount — กดส่งซ้ำ/เน็ตหลุดแล้วยิงใหม่จึงไม่เกิดแถวซ้ำ
  const submissionKeyRef = useRef<string>(crypto.randomUUID())
  const honeypotRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
  }

  const isGroup = mode === 'group'

  const toInput = useMemo(() => (): VisitorSubmissionInput => ({
    visit_type: (mode ?? 'individual') as VisitType,
    visit_date: values.visit_date,
    visitor_name: values.visitor_name,
    group_name: isGroup ? values.group_name : null,
    member_names: isGroup ? values.member_names : null,
    head_count: values.head_count.trim() === '' ? Number.NaN : Number(values.head_count),
    phone: values.phone,
    email: values.email,
    org_type: values.org_type as OrgType,
    org_name: values.org_name,
    contact_dept: values.contact_dept === CONTACT_DEPT_OTHER ? values.contact_dept_other : values.contact_dept,
    entered_at: values.entered_at ? new Date(values.entered_at).toISOString() : '',
    activity_type: values.activity_type as ActivityType,
    activity_other: values.activity_other,
    appointment: values.appointment as Appointment,
    badge_exchanged: values.badge_exchanged as BadgeState,
    safety_ack: values.safety_ack as SafetyAck,
  }), [mode, isGroup, values])

  if (!initialState.available) {
    return <TerminalState title="ปิดรับแบบฟอร์มชั่วคราว" detail="ขณะนี้ยังไม่เปิดรับการบันทึกผ่านแบบฟอร์มนี้ กรุณาติดต่อเจ้าหน้าที่กลุ่มงานเทคนิคการแพทย์" />
  }
  if (activeVisit) {
    return <ActiveVisitCard token={token} visit={activeVisit} />
  }

  // ── หน้าจอ 1: เลือกประเภทฟอร์ม ──
  if (mode === null) {
    return (
      <section className="pv-choose">
        <style>{CHOOSE_CSS}</style>
        <header className="pv-head">
          <div className="pv-head-icon"><Icon name="users" size={24} /></div>
          <h1>บันทึกการเข้า-ออก</h1>
          <p>กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี</p>
          <p className="pv-head-hint">กรุณาเลือกรูปแบบการเข้าพื้นที่ก่อนกรอกข้อมูล</p>
        </header>
        <div className="pv-choose-grid">
          <button type="button" className="pv-choose-card" onClick={() => setMode('individual')}>
            <span className="pv-choose-icon"><Icon name="user" size={22} /></span>
            <strong>รายบุคคล</strong>
            <span className="pv-choose-detail">มาคนเดียว หรือมีผู้ติดตามไม่กี่คน</span>
            <span className="pv-choose-go">เริ่มกรอก <Icon name="arrowRight" size={14} /></span>
          </button>
          <button type="button" className="pv-choose-card" onClick={() => setMode('group')}>
            <span className="pv-choose-icon"><Icon name="users" size={22} /></span>
            <strong>หมู่คณะ</strong>
            <span className="pv-choose-detail">มาเป็นกลุ่ม คณะดูงาน หรือคณะตรวจประเมิน</span>
            <span className="pv-choose-go">เริ่มกรอก <Icon name="arrowRight" size={14} /></span>
          </button>
        </div>
      </section>
    )
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')
    // ตรวจด้วยฟังก์ชันตัวเดียวกับที่ API route ใช้ กฎจึงตรงกันเสมอ
    const validation = validateVisitorSubmission(toInput())
    if (!validation.ok) {
      const next: Partial<Record<FieldKey, string>> = {}
      for (const issue of validation.issues) next[issue.field] = issue.message
      setErrors(next)
      setFormError('กรุณาตรวจสอบข้อมูลที่ยังไม่ครบหรือไม่ถูกต้อง')
      const firstField = validation.issues[0]?.field
      const target = firstField === 'head_count' && !isGroup ? 'head_count' : firstField
      document.querySelector<HTMLElement>(`[data-field="${target}"] input, [data-field="${target}"] select, [data-field="${target}"] textarea, [data-field="${target}"] button`)?.focus()
      return
    }
    setErrors({})
    setSubmitting(true)
    try {
      const response = await fetch(`/api/it-visitors/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionKey: submissionKeyRef.current,
          challenge,
          website: honeypotRef.current?.value ?? '',
          form: toInput(),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'บันทึกไม่สำเร็จ')
      if (!result.activeVisit) throw new Error('ไม่พบข้อมูลการเข้า กรุณาติดต่อเจ้าหน้าที่')
      setActiveVisit(result.activeVisit)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  const deptOptions = [...DEPARTMENTS, CONTACT_DEPT_OTHER]

  return (
    <form className="pv-form" onSubmit={submit} noValidate>
      <style>{FORM_CSS}</style>

      {/* honeypot — บอทกรอกช่องนี้ คนไม่เห็น */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="visitor-website">Website</label>
        <input ref={honeypotRef} id="visitor-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <header className="pv-head">
        <div className="pv-head-icon"><Icon name="users" size={24} /></div>
        <h1>บันทึกการเข้า-ออก</h1>
        <p>กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี</p>
      </header>

      <div className="pv-modebar">
        <span className="pv-modebar-tag">{isGroup ? 'แบบหมู่คณะ' : 'แบบรายบุคคล'}</span>
        <button type="button" className="pv-modebar-change" onClick={() => { setMode(null); setErrors({}); setFormError('') }}>
          <Icon name="arrowLeft" size={13} /> เปลี่ยนประเภทฟอร์ม
        </button>
      </div>

      <Section title="ข้อมูลผู้เข้าพื้นที่">
        <Field label="วันที่" required name="visit_date" error={errors.visit_date}>
          <input type="date" value={values.visit_date} onChange={(e) => set('visit_date', e.target.value)} />
        </Field>

        {isGroup && (
          <Field label="ชื่อคณะ / กลุ่ม" required name="group_name" error={errors.group_name}>
            <input type="text" value={values.group_name} onChange={(e) => set('group_name', e.target.value)} placeholder="เช่น คณะศึกษาดูงาน วิทยาลัยเทคนิคการแพทย์" />
          </Field>
        )}

        <Field
          label={isGroup ? 'ชื่อ-สกุล หัวหน้าคณะ / ผู้ประสานงาน' : 'ชื่อ-สกุล'}
          required name="visitor_name" error={errors.visitor_name}
        >
          <input type="text" value={values.visitor_name} onChange={(e) => set('visitor_name', e.target.value)} autoComplete="name" />
        </Field>

        <div className="pv-row">
          <Field label="เบอร์โทรศัพท์" required name="phone" error={errors.phone}>
            <input type="tel" inputMode="tel" value={values.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" />
          </Field>
          <Field label="อีเมล" name="email" error={errors.email} hint="ไม่บังคับ">
            <input type="email" inputMode="email" value={values.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
          </Field>
        </div>

        <Field
          label={isGroup ? 'จำนวนผู้มาทั้งหมด (คน)' : 'จำนวนผู้ติดตาม (คน)'}
          required name="head_count" error={errors.head_count}
          hint={isGroup ? 'นับรวมผู้ประสานงานด้วย' : 'กรอก 0 หากมาคนเดียว'}
        >
          <input type="number" inputMode="numeric" min={isGroup ? 1 : 0} max={500}
            value={values.head_count} onChange={(e) => set('head_count', e.target.value)} />
        </Field>

        {isGroup && (
          <Field label="รายชื่อผู้มา" name="member_names" error={errors.member_names} hint="ไม่บังคับ — กรอก 1 คนต่อบรรทัด">
            <textarea rows={5} value={values.member_names} onChange={(e) => set('member_names', e.target.value)}
              placeholder={'นายสมชาย ใจดี\nนางสาวสมหญิง รักงาน'} />
          </Field>
        )}
      </Section>

      <Section title="หน่วยงาน">
        <Field label="ประเภทหน่วยงาน" required name="org_type" error={errors.org_type}>
          <RadioGroup name="org_type" value={values.org_type}
            options={ORG_TYPES.map((v) => ({ value: v, label: ORG_TYPE_LABEL[v] }))}
            onChange={(v) => set('org_type', v as OrgType)} />
        </Field>

        <Field label="ชื่อหน่วยงาน / บริษัท" required name="org_name" error={errors.org_name}>
          <input type="text" value={values.org_name} onChange={(e) => set('org_name', e.target.value)} autoComplete="organization" />
        </Field>

        <Field label="หน่วยงานที่ต้องการติดต่อ" required name="contact_dept" error={errors.contact_dept}>
          <select value={values.contact_dept} onChange={(e) => set('contact_dept', e.target.value)}>
            <option value="">— เลือกหน่วยงาน —</option>
            {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          {values.contact_dept === CONTACT_DEPT_OTHER && (
            <input type="text" style={{ marginTop: 8 }} value={values.contact_dept_other}
              onChange={(e) => set('contact_dept_other', e.target.value)} placeholder="กรุณาระบุหน่วยงาน" />
          )}
        </Field>
      </Section>

      <Section title="รายละเอียดการเข้าพื้นที่">
        <Field label="เวลาเข้า" required name="entered_at" error={errors.entered_at} hint="ระบบกรอกเวลาปัจจุบันให้แล้ว แก้ไขได้">
          <input type="datetime-local" value={values.entered_at} onChange={(e) => set('entered_at', e.target.value)} />
        </Field>

        <Field label="ประเภทกิจกรรมที่เข้ามาดำเนินการ" required name="activity_type" error={errors.activity_type}>
          <RadioGroup name="activity_type" value={values.activity_type}
            options={ACTIVITY_TYPES.map((v) => ({ value: v, label: ACTIVITY_LABEL[v] }))}
            onChange={(v) => set('activity_type', v as ActivityType)} />
        </Field>

        {values.activity_type === 'other' && (
          <Field label="ระบุประเภทกิจกรรม" required name="activity_other" error={errors.activity_other}>
            <input type="text" value={values.activity_other} onChange={(e) => set('activity_other', e.target.value)} />
          </Field>
        )}

        <Field label="นัดหมายก่อนเข้าห้องปฏิบัติการล่วงหน้าหรือไม่" required name="appointment" error={errors.appointment}>
          <RadioGroup name="appointment" value={values.appointment}
            options={APPOINTMENTS.map((v) => ({ value: v, label: APPOINTMENT_LABEL[v] }))}
            onChange={(v) => set('appointment', v as Appointment)} />
        </Field>

        <Field label="ท่านแลกบัตรที่สำนักงานหรือไม่" required name="badge_exchanged" error={errors.badge_exchanged}>
          <RadioGroup name="badge_exchanged" value={values.badge_exchanged}
            options={BADGE_STATES.map((v) => ({ value: v, label: BADGE_LABEL[v] }))}
            onChange={(v) => set('badge_exchanged', v as BadgeState)} />
        </Field>

        <Field label={SAFETY_POLICY_PROMPT} required name="safety_ack" error={errors.safety_ack}>
          <RadioGroup name="safety_ack" value={values.safety_ack}
            options={SAFETY_ACKS.map((v) => ({ value: v, label: SAFETY_LABEL[v] }))}
            onChange={(v) => set('safety_ack', v as SafetyAck)} />
        </Field>
      </Section>

      <div aria-live="polite" style={{ marginTop: 16 }}>
        {formError && (
          <div role="alert" tabIndex={-1} style={{ padding: 12, borderRadius: 9, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', fontSize: 13 }}>
            {formError}
          </div>
        )}
      </div>

      <div className="pv-submit">
        <Button type="submit" size="lg" full disabled={submitting}>
          {submitting ? 'กำลังบันทึก…' : 'บันทึกการเข้า'}
        </Button>
      </div>
      <p className="pv-foot">หากเครือข่ายขัดข้อง สามารถกดส่งซ้ำได้โดยไม่เกิดบันทึกซ้ำ</p>
    </form>
  )
}

// ── ชิ้นส่วนย่อย ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pv-section">
      <h2>{title}</h2>
      <div className="pv-section-body">{children}</div>
    </section>
  )
}

function Field({ label, name, required, hint, error, children }: {
  label: string; name: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode
}) {
  return (
    <div className="pv-field" data-field={name}>
      {/* คำอธิบายอยู่บรรทัดเดียวกับหัวข้อ — กล่องกรอกของทุกช่องจึงเริ่มที่ระดับเดียวกันเสมอ
          ไม่ว่าช่องนั้นจะมีคำอธิบายหรือไม่ (สำคัญกับช่องคู่อย่างเบอร์โทร/อีเมล) */}
      <label className="pv-label">
        <span>
          {label}{required && <span className="pv-req" aria-hidden="true"> *</span>}
          {required && <span className="pv-sr">(จำเป็น)</span>}
        </span>
        {hint && <span className="pv-hint">{hint}</span>}
      </label>
      {children}
      {error && <div className="pv-error" role="alert">{error}</div>}
    </div>
  )
}

function RadioGroup({ name, value, options, onChange }: {
  name: string; value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div className="pv-radios" role="radiogroup">
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <label key={opt.value} className={`pv-radio${active ? ' pv-radio-on' : ''}`}>
            <input type="radio" name={name} value={opt.value} checked={active} onChange={() => onChange(opt.value)} />
            <span className="pv-radio-dot" aria-hidden="true" />
            <span>{opt.label}</span>
          </label>
        )
      })}
    </div>
  )
}

function TerminalState({ title, detail, success }: { title: string; detail: string; success?: boolean }) {
  return (
    <section className="pv-terminal">
      <style>{`
        .pv-terminal{margin-top:10vh;text-align:center;padding:34px 22px;border-radius:20px;border:1px solid var(--border);background:var(--card);box-shadow:0 16px 40px rgba(15,23,42,.08)}
        .pv-terminal-icon{width:58px;height:58px;margin:0 auto 15px;border-radius:18px;display:grid;place-items:center;background:var(--surface-2);color:var(--muted)}
        .pv-terminal-icon.pv-ok{background:rgba(22,163,74,.10);color:var(--success)}
      `}</style>
      <div className={`pv-terminal-icon${success ? ' pv-ok' : ''}`}><Icon name={success ? 'check' : 'clock'} size={25} /></div>
      <h1 style={{ margin: 0, fontSize: 22, color: 'var(--ink)' }}>{title}</h1>
      <p style={{ margin: '8px auto 0', maxWidth: 460, color: 'var(--muted)', fontSize: 14, lineHeight: 1.65 }}>{detail}</p>
    </section>
  )
}

const HEAD_CSS = `
.pv-head{text-align:center;margin-bottom:18px}
.pv-head-icon{width:52px;height:52px;margin:0 auto 12px;border-radius:16px;display:grid;place-items:center;background:rgba(3,105,161,.12);color:#0369A1}
.pv-head h1{margin:0;font-size:clamp(20px,4vw,25px);color:var(--ink);letter-spacing:-.01em}
.pv-head p{margin:6px 0 0;color:var(--muted);font-size:13.5px}
.pv-head-hint{font-size:12.5px!important;margin-top:10px!important}
`

const CHOOSE_CSS = `${HEAD_CSS}
.pv-choose{padding-top:6vh}
.pv-choose-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:6px}
.pv-choose-card{display:flex;flex-direction:column;align-items:flex-start;gap:7px;min-height:150px;padding:20px;border:1.5px solid var(--border);border-radius:18px;background:var(--card);cursor:pointer;text-align:left;font-family:inherit;color:var(--ink);box-shadow:0 8px 24px rgba(15,23,42,.05);transition:border-color .16s,box-shadow .16s,transform .16s}
.pv-choose-card:hover{border-color:#0369A1;box-shadow:0 14px 32px rgba(3,105,161,.16);transform:translateY(-2px)}
.pv-choose-card:focus-visible{outline:3px solid #0369A1;outline-offset:2px}
.pv-choose-icon{width:44px;height:44px;border-radius:13px;display:grid;place-items:center;background:rgba(3,105,161,.12);color:#0369A1}
.pv-choose-card strong{font-size:17px}
.pv-choose-detail{color:var(--muted);font-size:12.5px;line-height:1.5}
.pv-choose-go{margin-top:auto;display:inline-flex;align-items:center;gap:5px;color:#0369A1;font-size:12.5px;font-weight:700}
@media(prefers-reduced-motion:reduce){.pv-choose-card{transition:none}.pv-choose-card:hover{transform:none}}
`

const FORM_CSS = `${HEAD_CSS}
.pv-form{color:var(--ink)}
.pv-modebar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:16px;padding:10px 14px;border:1px solid var(--border);border-radius:13px;background:var(--surface-2)}
.pv-modebar-tag{font-size:12.5px;font-weight:800;color:#0369A1}
.pv-modebar-change{display:inline-flex;align-items:center;gap:5px;min-height:32px;padding:5px 11px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--ink);font-size:12px;font-family:inherit;cursor:pointer}
.pv-modebar-change:hover{border-color:#0369A1;color:#0369A1}
.pv-modebar-change:focus-visible{outline:3px solid #0369A1;outline-offset:2px}
.pv-section{margin-bottom:14px;border:1px solid var(--border);border-radius:16px;background:var(--card);overflow:hidden;box-shadow:0 6px 18px rgba(15,23,42,.04)}
.pv-section h2{margin:0;padding:13px 16px;font-size:13.5px;font-weight:800;color:var(--ink);background:var(--surface-2);border-bottom:1px solid var(--border)}
.pv-section-body{padding:16px;display:grid;gap:16px}
.pv-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:560px){.pv-row{grid-template-columns:1fr}}
.pv-field{min-width:0}
.pv-label{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 8px;font-size:12.5px;font-weight:700;color:var(--ink);margin-bottom:6px;line-height:1.5}
.pv-req{color:var(--danger)}
.pv-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.pv-hint{font-size:11.5px;font-weight:400;color:var(--muted)}
.pv-field input[type=text],.pv-field input[type=tel],.pv-field input[type=email],.pv-field input[type=number],.pv-field input[type=date],.pv-field input[type=datetime-local],.pv-field select,.pv-field textarea{width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--card);color:var(--ink);font-size:14px;font-family:inherit;outline:none;box-sizing:border-box}
.pv-field textarea{min-height:110px;resize:vertical;line-height:1.6}
.pv-field input:focus-visible,.pv-field select:focus-visible,.pv-field textarea:focus-visible{outline:3px solid #0369A1;outline-offset:1px;border-color:#0369A1}
.pv-error{margin-top:6px;font-size:12px;color:var(--danger);font-weight:600}
.pv-radios{display:grid;gap:8px}
.pv-radio{display:flex;align-items:center;gap:10px;min-height:44px;padding:10px 13px;border:1px solid var(--border);border-radius:11px;background:var(--card);cursor:pointer;font-size:13.5px;line-height:1.45;transition:border-color .15s,background .15s}
.pv-radio:hover{border-color:#0369A1}
.pv-radio input{position:absolute;opacity:0;width:1px;height:1px}
.pv-radio:focus-within{outline:3px solid #0369A1;outline-offset:2px}
.pv-radio-dot{flex:0 0 auto;width:19px;height:19px;border:2px solid var(--border);border-radius:50%;display:grid;place-items:center}
.pv-radio-on{border-color:#0369A1;background:rgba(3,105,161,.07)}
.pv-radio-on .pv-radio-dot{border-color:#0369A1}
.pv-radio-on .pv-radio-dot::after{content:'';width:9px;height:9px;border-radius:50%;background:#0369A1}
.pv-submit{position:sticky;bottom:12px;margin-top:18px;padding:10px;border:1px solid color-mix(in srgb,var(--border) 72%,transparent);border-radius:14px;background:color-mix(in srgb,var(--card) 92%,transparent);backdrop-filter:blur(10px);box-shadow:0 8px 22px rgba(15,23,42,.08)}
.pv-foot{text-align:center;color:var(--muted);font-size:11px;margin:12px 0 24px}
@media(max-width:600px){.pv-submit{bottom:8px;padding:8px}}
@media(prefers-reduced-motion:reduce){.pv-radio{transition:none}}
`
