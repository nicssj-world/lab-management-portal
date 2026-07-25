'use client'

import { useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import {
  HEAD_CONTACT_CATEGORIES,
  HEAD_CONTACT_CATEGORY_LABEL,
  OTHER_SERVICE_UNIT,
} from '@/lib/head-contact/constants'
import type { HeadContactCategory } from '@/lib/head-contact/constants'
import type { HeadContactSubmissionInput, PublicHeadContactFormState } from '@/lib/head-contact/types'
import { validateHeadContactSubmission } from '@/lib/head-contact/validation'

type Field = keyof HeadContactSubmissionInput
const EMPTY: HeadContactSubmissionInput = {
  sender_name: '', contact_channel: '', service_unit_id: '', service_unit_name: '',
  other_service_unit: '', category: 'suggestion', detail: '', wants_reply: false,
}

export function PublicHeadContactForm({ token, initialState, challenge }: {
  token: string
  initialState: PublicHeadContactFormState
  challenge: string
}) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reference, setReference] = useState('')
  const submissionKeyRef = useRef(crypto.randomUUID())
  const honeypotRef = useRef<HTMLInputElement>(null)

  const update = <K extends Field>(key: K, value: HeadContactSubmissionInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  if (!initialState.available) return <Terminal title="ปิดรับเรื่องชั่วคราว" detail="ขณะนี้ยังไม่เปิดรับข้อความผ่านช่องทางนี้ กรุณาติดต่อกลุ่มงานเทคนิคการแพทย์" />
  if (reference) return <Terminal success title="ส่งข้อความเรียบร้อยแล้ว" detail={`เลขอ้างอิงของคุณคือ ${reference} กรุณาเก็บเลขนี้ไว้`} />

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setFormError('')
    const selected = initialState.units.find((unit) => unit.id === form.service_unit_id)
    const input = { ...form, service_unit_name: selected?.name ?? '' }
    const validation = validateHeadContactSubmission(input)
    if (!validation.ok) {
      const next: Partial<Record<Field, string>> = {}
      for (const issue of validation.issues) next[issue.field] = issue.message
      setErrors(next)
      setFormError('กรุณาตรวจสอบข้อมูลที่ยังไม่ครบหรือไม่ถูกต้อง')
      document.querySelector<HTMLElement>(`[data-field="${validation.issues[0]?.field}"] input, [data-field="${validation.issues[0]?.field}"] select, [data-field="${validation.issues[0]?.field}"] textarea`)?.focus()
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch(`/api/head-contact/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionKey: submissionKeyRef.current,
          challenge,
          website: honeypotRef.current?.value ?? '',
          form: input,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'ส่งข้อมูลไม่สำเร็จ')
      setReference(result.reference)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="hc-public">
      <style>{CSS}</style>
      <form className="hc-sheet" onSubmit={submit} noValidate>
        <div aria-hidden="true" className="hc-honeypot">
          <label htmlFor="hc-website">Website</label>
          <input ref={honeypotRef} id="hc-website" tabIndex={-1} autoComplete="off" />
        </div>

        <header className="hc-hero">
          <span className="hc-kicker">ช่องทางตรงถึงหัวหน้ากลุ่มงาน</span>
          <div className="hc-mark"><Icon name="mail" size={26} /></div>
          <h1>สื่อสารถึงหัวหน้า</h1>
          <p>กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี</p>
          <div className="hc-purpose">รับข้อร้องเรียน ข้อเสนอแนะ หรือคำชื่นชม เพื่อนำไปปรับปรุงการให้บริการให้ดียิ่งขึ้น</div>
        </header>

        <section className="hc-section">
          <h2><span>01</span> ข้อมูลผู้ให้ข้อมูล</h2>
          <Field label="ชื่อ-สกุลผู้ป่วย หรือผู้ให้ข้อมูล" hint="ไม่ระบุได้" name="sender_name" error={errors.sender_name}>
            <input value={form.sender_name} onChange={(e) => update('sender_name', e.target.value)} autoComplete="name" placeholder="ชื่อของคุณ (ถ้าต้องการระบุ)" />
          </Field>
          <Field label="เบอร์โทร หรืออีเมลสำหรับติดต่อกลับ" hint="ไม่ระบุได้ หากไม่ต้องการรับแจ้งผล" name="contact_channel" error={errors.contact_channel}>
            <input value={form.contact_channel} onChange={(e) => update('contact_channel', e.target.value)} placeholder="เช่น 08x-xxx-xxxx หรือ name@example.com" />
          </Field>
        </section>

        <section className="hc-section">
          <h2><span>02</span> เรื่องที่ต้องการแจ้ง</h2>
          <Field label="หน่วยรับบริการ" required name="service_unit_id" error={errors.service_unit_id}>
            <select value={form.service_unit_id} onChange={(e) => update('service_unit_id', e.target.value)}>
              <option value="">เลือกหน่วยรับบริการ</option>
              {initialState.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              <option value={OTHER_SERVICE_UNIT}>อื่น ๆ</option>
            </select>
          </Field>
          {form.service_unit_id === OTHER_SERVICE_UNIT && (
            <Field label="ระบุหน่วยรับบริการ" required name="other_service_unit" error={errors.other_service_unit}>
              <input value={form.other_service_unit} onChange={(e) => update('other_service_unit', e.target.value)} />
            </Field>
          )}
          <fieldset className="hc-fieldset">
            <legend>สิ่งที่ต้องการแจ้ง <b>*</b></legend>
            <div className="hc-categories" role="radiogroup" aria-label="ประเภทข้อความ">
              {HEAD_CONTACT_CATEGORIES.map((category) => (
                <label key={category} className={form.category === category ? 'selected' : ''}>
                  <input type="radio" name="category" value={category} checked={form.category === category} onChange={() => update('category', category as HeadContactCategory)} />
                  <Icon name={category === 'complaint' ? 'alert' : category === 'compliment' ? 'sparkle' : 'clipboard'} size={18} />
                  {HEAD_CONTACT_CATEGORY_LABEL[category]}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="รายละเอียดสิ่งที่ต้องการแจ้ง" required name="detail" error={errors.detail} hint={`${form.detail.trim().length.toLocaleString('th-TH')} / 5,000 ตัวอักษร`}>
            <textarea rows={7} value={form.detail} onChange={(e) => update('detail', e.target.value)} placeholder="กรุณาเล่าเหตุการณ์หรือข้อเสนอแนะอย่างน้อย 10 ตัวอักษร" />
          </Field>
        </section>

        <section className="hc-section hc-reply">
          <h2><span>03</span> การแจ้งผล</h2>
          <label className="hc-check">
            <input type="checkbox" checked={form.wants_reply} onChange={(e) => update('wants_reply', e.target.checked)} />
            <span><strong>ต้องการให้ติดต่อกลับเพื่อแจ้งผล</strong><small>กรุณาระบุเบอร์โทรหรืออีเมลด้านบน</small></span>
          </label>
        </section>

        <p className="hc-privacy"><Icon name="lock" size={14} /> ข้อมูลจะเข้าถึงได้เฉพาะหัวหน้ากลุ่มงานและผู้ดูแลระบบ</p>
        {formError && <div className="hc-error" role="alert">{formError}</div>}
        <button className="hc-submit" type="submit" disabled={submitting}>
          {submitting ? 'กำลังส่งข้อมูล…' : <>ส่งถึงหัวหน้ากลุ่มงาน <Icon name="arrowRight" size={17} /></>}
        </button>
      </form>
    </main>
  )
}

function Field({ label, hint, required, name, error, children }: {
  label: string; hint?: string; required?: boolean; name: Field; error?: string; children: React.ReactNode
}) {
  return <label className="hc-field" data-field={name}><span>{label}{required && <b> *</b>}</span>{children}{error ? <small className="hc-field-error">{error}</small> : hint ? <small>{hint}</small> : null}</label>
}

function Terminal({ title, detail, success }: { title: string; detail: string; success?: boolean }) {
  return <main className="hc-public"><style>{CSS}</style><section className="hc-terminal" role="status"><div className={success ? 'success' : ''}><Icon name={success ? 'check' : 'mail'} size={30} /></div><h1>{title}</h1><p>{detail}</p></section></main>
}

const CSS = `
  .hc-public{min-height:100vh;padding:clamp(18px,5vw,52px) 14px 64px;background:radial-gradient(circle at 12% 4%,rgba(8,145,178,.12),transparent 28%),linear-gradient(150deg,#edf7f5 0%,#f8fbfa 48%,#e8f1f4 100%);color:#163c3b;font-family:var(--font-sans),sans-serif}
  .hc-sheet{width:min(760px,100%);margin:auto;background:#fff;border:1px solid #d5e5e2;border-radius:26px;overflow:hidden;box-shadow:0 30px 80px rgba(20,76,73,.13)}
  .hc-hero{position:relative;padding:38px clamp(22px,6vw,52px) 32px;background:#123f3d;color:#fff;overflow:hidden}
  .hc-hero:after{content:'';position:absolute;width:250px;height:250px;border:48px solid rgba(255,255,255,.045);border-radius:50%;right:-95px;top:-110px}
  .hc-kicker{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#9fd8cf;font-weight:700}.hc-mark{width:52px;height:52px;display:grid;place-items:center;background:#e5b85c;color:#163c3b;border-radius:15px;margin:18px 0 14px;box-shadow:0 10px 26px rgba(0,0,0,.17)}
  .hc-hero h1{font-size:clamp(28px,5vw,40px);margin:0;line-height:1.1}.hc-hero>p{margin:7px 0 0;color:#c7dedb}.hc-purpose{margin-top:24px;padding:14px 17px;border-left:3px solid #e5b85c;background:rgba(255,255,255,.07);font-size:14px;line-height:1.7;max-width:620px}
  .hc-section{padding:30px clamp(22px,6vw,52px);border-bottom:1px solid #e6efed}.hc-section h2{font-size:17px;margin:0 0 22px;display:flex;align-items:center;gap:10px}.hc-section h2 span{font-size:10px;letter-spacing:.1em;background:#e4f2ef;color:#176b65;border-radius:999px;padding:5px 8px}
  .hc-field{display:grid;gap:7px;margin-top:18px;font-size:13px;font-weight:650}.hc-field>span b,.hc-fieldset b{color:#c43c32}.hc-field input,.hc-field select,.hc-field textarea{width:100%;box-sizing:border-box;border:1px solid #cddedb;border-radius:11px;padding:12px 13px;background:#fbfdfc;color:#163c3b;font:inherit;font-weight:450;outline:none;transition:.16s}.hc-field textarea{resize:vertical;line-height:1.6}.hc-field input:focus,.hc-field select:focus,.hc-field textarea:focus{border-color:#168079;box-shadow:0 0 0 3px rgba(22,128,121,.12);background:#fff}.hc-field small{font-size:11px;color:#68807e;font-weight:450}.hc-field .hc-field-error{color:#b42318}
  .hc-fieldset{border:0;padding:0;margin:22px 0 0}.hc-fieldset legend{font-size:13px;font-weight:650;margin-bottom:9px}.hc-categories{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.hc-categories label{display:flex;align-items:center;justify-content:center;gap:7px;padding:12px 8px;border:1px solid #ccddda;border-radius:11px;cursor:pointer;font-size:13px;font-weight:600;transition:.15s}.hc-categories label.selected{border-color:#167870;background:#e5f3f0;color:#115f59}.hc-categories input{position:absolute;opacity:0;pointer-events:none}
  .hc-reply{background:#fbfdfc}.hc-check{display:flex;gap:12px;align-items:flex-start;padding:15px;border:1px solid #d5e4e1;border-radius:12px;cursor:pointer}.hc-check input{width:18px;height:18px;accent-color:#167870}.hc-check span{display:grid;gap:3px;font-size:13px}.hc-check small{color:#68807e;font-size:11px}.hc-privacy{margin:24px clamp(22px,6vw,52px) 0;display:flex;align-items:center;gap:6px;color:#607976;font-size:11px}.hc-error{margin:16px clamp(22px,6vw,52px) 0;padding:12px 14px;border-radius:10px;background:#fff0ee;color:#a62d24;font-size:13px}.hc-submit{margin:18px clamp(22px,6vw,52px) 34px;width:calc(100% - clamp(44px,12vw,104px));height:48px;border:0;border-radius:12px;background:#176f69;color:#fff;font:inherit;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;box-shadow:0 10px 24px rgba(23,111,105,.22)}.hc-submit:disabled{opacity:.55;cursor:wait}.hc-honeypot{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}
  .hc-terminal{width:min(520px,100%);margin:10vh auto 0;padding:38px 28px;border:1px solid #d5e5e2;border-radius:24px;background:#fff;text-align:center;box-shadow:0 24px 70px rgba(20,76,73,.13)}.hc-terminal>div{width:62px;height:62px;margin:auto;display:grid;place-items:center;border-radius:18px;background:#e9f3f1;color:#176f69}.hc-terminal>div.success{background:#dff5e9;color:#187345}.hc-terminal h1{margin:18px 0 8px;font-size:25px}.hc-terminal p{margin:0;color:#617a77;line-height:1.65}
  @media(max-width:600px){.hc-public{padding:0 0 40px;background:#fff}.hc-sheet{border:0;border-radius:0;box-shadow:none}.hc-hero{padding:30px 22px}.hc-section{padding:26px 20px}.hc-categories{grid-template-columns:1fr}.hc-categories label{justify-content:flex-start}.hc-privacy{margin-inline:20px}.hc-submit{margin-inline:20px;width:calc(100% - 40px)}}
`
