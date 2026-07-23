'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import type { CampaignAvailability } from '@/lib/surveys/campaign'
import type { PublicSurveyState } from '@/lib/surveys/public-server'
import type { SurveyAnswerInput } from '@/lib/surveys/types'
import { validateSubmission } from '@/lib/surveys/validation'
import { SurveyRenderer, type SurveyAnswerMap } from './SurveyRenderer'

const STATE_COPY: Record<Exclude<CampaignAvailability['code'], 'open'>, { title: string; detail: string }> = {
  draft: { title: 'แบบสำรวจยังไม่เปิด', detail: 'ผู้ดูแลกำลังเตรียมรอบเก็บข้อมูล' },
  scheduled: { title: 'ยังไม่ถึงเวลาเปิดรับคำตอบ', detail: 'กรุณากลับมาใหม่ตามช่วงเวลาที่ผู้ดูแลกำหนด' },
  closed: { title: 'ปิดรับคำตอบแล้ว', detail: 'ขอบคุณที่ให้ความสนใจแบบสำรวจนี้' },
  expired: { title: 'หมดเวลารับคำตอบแล้ว', detail: 'รอบเก็บข้อมูลนี้สิ้นสุดตามเวลาที่กำหนด' },
  limit_reached: { title: 'ได้รับคำตอบครบแล้ว', detail: 'รอบนี้ได้รับคำตอบครบตามจำนวนที่กำหนด' },
  duplicate: { title: 'อุปกรณ์นี้ตอบแล้ว', detail: 'แบบสำรวจนี้กำหนดให้ตอบได้หนึ่งครั้งต่ออุปกรณ์' },
}

const hasAnswer = (answer: SurveyAnswerInput | undefined) => Boolean(
  answer?.optionId
  || answer?.textValue?.trim()
  || answer?.detailText?.trim()
  || (answer?.numericValue !== null && answer?.numericValue !== undefined),
)

export function PublicSurveyForm({ token, initialState, challenge }: { token: string; initialState: PublicSurveyState; challenge: string }) {
  const [answers, setAnswers] = useState<SurveyAnswerMap>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const submissionKeyRef = useRef<string>(crypto.randomUUID())
  const honeypotRef = useRef<HTMLInputElement>(null)

  if (!initialState.availability.available || !initialState.definition) {
    const copy = STATE_COPY[initialState.availability.code as Exclude<CampaignAvailability['code'], 'open'>]
    return <TerminalState title={copy.title} detail={copy.detail} />
  }
  if (submitted) return <TerminalState title="ส่งคำตอบเรียบร้อยแล้ว" detail="ขอบคุณสำหรับความคิดเห็นของท่าน ข้อมูลถูกบันทึกโดยไม่ระบุตัวบุคคล" success />

  const definition = initialState.definition
  const questionCount = definition.sections.reduce((total, section) => total + section.questions.length, 0)
  const answeredCount = definition.sections.flatMap((section) => section.questions).filter((question) => hasAnswer(answers[question.id])).length
  const progress = questionCount === 0 ? 0 : Math.round((answeredCount / questionCount) * 100)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setFormError('')
    const validation = validateSubmission(definition, Object.values(answers))
    if (!validation.ok) {
      setErrors(Object.fromEntries(validation.issues.filter((issue) => issue.questionId).map((issue) => [issue.questionId!, issue.message])))
      setFormError('กรุณาตรวจสอบคำตอบที่ยังไม่ครบหรือไม่ถูกต้อง')
      document.querySelector<HTMLElement>('[role="alert"]')?.focus()
      return
    }
    setErrors({}); setSubmitting(true)
    try {
      const response = await fetch(`/api/satisfaction/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionKey: submissionKeyRef.current, challenge, website: honeypotRef.current?.value ?? '', answers: Object.values(answers) }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'ส่งคำตอบไม่สำเร็จ')
      setSubmitted(true)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง')
    } finally { setSubmitting(false) }
  }

  return (
    <form className="public-survey-form" onSubmit={submit} noValidate>
      <style>{`
        .public-survey-form{color:var(--ink)}
        .public-survey-trust{display:flex;align-items:flex-start;gap:10px;margin-bottom:14px;padding:12px 14px;border:1px solid rgba(13,148,136,.22);border-radius:13px;background:rgba(13,148,136,.08);color:#0F766E;font-size:12.5px;line-height:1.55}
        .public-survey-trust svg{flex:0 0 auto;margin-top:1px}
        .public-survey-progress{margin:14px 0 18px;padding:13px 14px;border:1px solid var(--border);border-radius:13px;background:color-mix(in srgb,var(--card) 92%,var(--primary-soft))}
        .public-survey-progress-copy{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:12px;color:var(--muted)}
        .public-survey-progress-copy strong{color:var(--ink);font-size:13px}
        .public-survey-progress-track{height:7px;margin-top:9px;border-radius:999px;background:var(--surface-2);overflow:hidden}
        .public-survey-progress-value{height:100%;border-radius:inherit;background:linear-gradient(90deg,#0F766E,#0D9488);transition:width .2s ease}
        .public-survey-submit{position:sticky;bottom:12px;margin-top:18px;padding:10px;border:1px solid color-mix(in srgb,var(--border) 72%,transparent);border-radius:14px;background:color-mix(in srgb,var(--card) 92%,transparent);backdrop-filter:blur(10px);box-shadow:0 8px 22px rgba(15,23,42,.08)}
        .public-survey-submit button{box-shadow:0 10px 20px rgba(15,118,110,.22)}
        @media(max-width:600px){.public-survey-progress-copy{align-items:flex-start;flex-direction:column;gap:3px}.public-survey-submit{bottom:8px;padding:8px}}
        @media(prefers-reduced-motion:reduce){.public-survey-progress-value{transition:none}}
      `}</style>
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}><label htmlFor="survey-website">Website</label><input ref={honeypotRef} id="survey-website" name="website" type="text" tabIndex={-1} autoComplete="off" /></div>
      <div className="public-survey-trust"><Icon name="shieldCheck" size={17} /><span>แบบสำรวจนี้ไม่เก็บชื่อ HN หรือข้อมูลระบุตัวบุคคล กรุณาตอบตามความรู้สึกจริง</span></div>
      <div className="public-survey-progress">
        <div className="public-survey-progress-copy"><span>ความคืบหน้าการตอบ</span><strong>{answeredCount} / {questionCount} ข้อ</strong></div>
        <div className="public-survey-progress-track" role="progressbar" aria-label="ความคืบหน้าการตอบแบบสำรวจ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="public-survey-progress-value" style={{ width: `${progress}%` }} /></div>
      </div>
      <SurveyRenderer definition={definition} mode="public" answers={answers} errors={errors} onAnswer={(questionId, answer) => setAnswers((current) => ({ ...current, [questionId]: answer }))} />
      <div aria-live="polite" style={{ marginTop: 16 }}>{formError && <div role="alert" tabIndex={-1} style={{ padding: 12, borderRadius: 9, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', fontSize: 13 }}>{formError}</div>}</div>
      <div className="public-survey-submit"><Button type="submit" size="lg" full disabled={submitting}>{submitting ? 'กำลังส่งคำตอบ…' : 'ส่งคำตอบ'}</Button></div>
      <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, margin: '12px 0 24px' }}>หากเครือข่ายขัดข้อง สามารถกดส่งซ้ำได้โดยไม่เกิดคำตอบซ้ำ</p>
    </form>
  )
}

function TerminalState({ title, detail, success }: { title: string; detail: string; success?: boolean }) {
  return <section className="public-survey-terminal"><style>{`.public-survey-terminal{margin-top:10vh;text-align:center;padding:34px 22px;border-radius:20px;border:1px solid var(--border);background:var(--card);box-shadow:0 16px 40px rgba(15,23,42,.08)}.public-survey-terminal-icon{width:58px;height:58px;margin:0 auto 15px;border-radius:18px;display:grid;place-items:center;background:rgba(22,163,74,.10);color:var(--success)}.public-survey-terminal:not(:has(.public-survey-terminal-success)) .public-survey-terminal-icon{background:var(--surface-2);color:var(--muted)}`}</style><div className={`public-survey-terminal-icon${success ? ' public-survey-terminal-success' : ''}`}><Icon name={success ? 'check' : 'clipboard'} size={25} /></div><h1 style={{ margin: 0, fontSize: 22, color: 'var(--ink)' }}>{title}</h1><p style={{ margin: '8px auto 0', maxWidth: 460, color: 'var(--muted)', fontSize: 14, lineHeight: 1.65 }}>{detail}</p></section>
}
