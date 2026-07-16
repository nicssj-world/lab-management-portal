'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { CampaignAvailability } from '@/lib/surveys/campaign'
import type { PublicSurveyState } from '@/lib/surveys/public-server'
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

export function PublicSurveyForm({ token, initialState }: { token: string; initialState: PublicSurveyState }) {
  const [answers, setAnswers] = useState<SurveyAnswerMap>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const submissionKeyRef = useRef<string>(crypto.randomUUID())

  if (!initialState.availability.available || !initialState.definition) {
    const copy = STATE_COPY[initialState.availability.code as Exclude<CampaignAvailability['code'], 'open'>]
    return <TerminalState title={copy.title} detail={copy.detail} />
  }
  if (submitted) return <TerminalState title="ส่งคำตอบเรียบร้อยแล้ว" detail="ขอบคุณสำหรับความคิดเห็นของท่าน ข้อมูลถูกบันทึกโดยไม่ระบุตัวบุคคล" success />

  const definition = initialState.definition
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
      const response = await fetch(`/api/satisfaction/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionKey: submissionKeyRef.current, answers: Object.values(answers) }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'ส่งคำตอบไม่สำเร็จ')
      setSubmitted(true)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง')
    } finally { setSubmitting(false) }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div style={{ marginBottom: 12, padding: '10px 13px', borderRadius: 10, background: 'rgba(15,118,110,.08)', color: '#0F766E', fontSize: 12, lineHeight: 1.55 }}>แบบสำรวจนี้ไม่เก็บชื่อ HN หรือข้อมูลระบุตัวบุคคล กรุณาตอบตามความรู้สึกจริง</div>
      <SurveyRenderer definition={definition} mode="public" answers={answers} errors={errors} onAnswer={(questionId, answer) => setAnswers((current) => ({ ...current, [questionId]: answer }))} />
      <div aria-live="polite" style={{ marginTop: 16 }}>{formError && <div role="alert" tabIndex={-1} style={{ padding: 12, borderRadius: 9, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', fontSize: 13 }}>{formError}</div>}</div>
      <Button type="submit" size="lg" full disabled={submitting} style={{ marginTop: 16 }}>{submitting ? 'กำลังส่งคำตอบ…' : 'ส่งคำตอบ'}</Button>
      <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, margin: '12px 0 24px' }}>หากเครือข่ายขัดข้อง สามารถกดส่งซ้ำได้โดยไม่เกิดคำตอบซ้ำ</p>
    </form>
  )
}

function TerminalState({ title, detail, success }: { title: string; detail: string; success?: boolean }) {
  return <section style={{ marginTop: '10vh', textAlign: 'center', padding: '32px 22px', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--card)' }}><div style={{ width: 56, height: 56, margin: '0 auto 14px', borderRadius: 16, display: 'grid', placeItems: 'center', background: success ? 'rgba(22,163,74,.1)' : 'var(--surface-2)', color: success ? 'var(--success)' : 'var(--muted)', fontSize: 26 }}>{success ? '✓' : '⌛'}</div><h1 style={{ margin: 0, fontSize: 22, color: 'var(--ink)' }}>{title}</h1><p style={{ margin: '8px auto 0', maxWidth: 460, color: 'var(--muted)', fontSize: 14, lineHeight: 1.65 }}>{detail}</p></section>
}
