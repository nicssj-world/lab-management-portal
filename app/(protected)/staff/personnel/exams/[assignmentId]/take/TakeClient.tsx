'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import type { ExamQuestion } from '@/lib/personnel/exam'

const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 18px', borderRadius: 8, border: 0, background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

export function TakeClient({ assignmentId, title, description, questions }: {
  assignmentId: string; title: string; description: string | null; questions: ExamQuestion[]
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ score: number; passed: boolean; correct: number; total: number; answerKey: Record<string, string> } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (Object.keys(answers).length < questions.length && !confirm('ยังตอบไม่ครบทุกข้อ ต้องการส่งเลยหรือไม่?')) return
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/personnel/exams/${assignmentId}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'ส่งไม่สำเร็จ')
      setResult({ score: data.score, passed: data.passed, correct: data.correct, total: data.total, answerKey: data.answerKey ?? {} })
    } catch (e) { setError(e instanceof Error ? e.message : 'ส่งไม่สำเร็จ') } finally { setSaving(false) }
  }

  if (result) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560, margin: '0 auto' }}>
        <div style={{ ...card, textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 15, color: 'var(--muted)' }}>{title}</div>
          <div style={{ fontSize: 44, fontWeight: 800, color: result.passed ? 'var(--success)' : 'var(--danger)', margin: '8px 0' }}>{result.score}%</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: result.passed ? 'var(--success)' : 'var(--danger)' }}>{result.passed ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}</div>
          <div style={{ color: 'var(--muted)', marginTop: 6 }}>ตอบถูก {result.correct}/{result.total} ข้อ</div>
          <Link href="/staff/personnel/exams" style={{ ...btn, textDecoration: 'none', marginTop: 20 }} onClick={() => router.refresh()}>กลับไปหน้าแบบทดสอบ</Link>
        </div>

        {/* Answer review */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ fontSize: 15, margin: 0 }}>ทบทวนคำตอบ</h2>
          {questions.map((q, i) => {
            const correctId = result.answerKey[q.id]
            const chosenId = answers[q.id]
            const gotIt = chosenId === correctId
            return (
              <div key={q.id} style={{ ...card, borderColor: gotIt ? 'var(--success)' : 'var(--danger)' }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{i + 1}. {q.prompt} {gotIt ? '✓' : '✗'}</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {q.options.map((o) => {
                    const isCorrect = o.id === correctId
                    const isChosen = o.id === chosenId
                    const bg = isCorrect ? 'rgba(22,163,74,.12)' : isChosen ? 'rgba(220,38,38,.12)' : 'transparent'
                    return (
                      <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: bg, fontSize: 13.5 }}>
                        <span style={{ flex: 1 }}>{o.label}</span>
                        {isCorrect && <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: 12 }}>เฉลย</span>}
                        {isChosen && !isCorrect && <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 12 }}>คำตอบของคุณ</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720, margin: '0 auto' }}>
      <PageHeader eyebrow="ข้อสอบสมรรถนะ" title={title} subtitle={description ?? undefined} marginBottom={0} />
      {error && <div role="alert" style={{ padding: 10, borderRadius: 8, background: '#FEF2F2', color: '#B91C1C', fontSize: 13 }}>{error}</div>}
      {questions.map((q, i) => (
        <div key={q.id} style={card}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>{i + 1}. {q.prompt}</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {q.options.map((o) => (
              <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${answers[q.id] === o.id ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', background: answers[q.id] === o.id ? 'var(--primary-soft)' : 'var(--card)' }}>
                <input type="radio" name={q.id} checked={answers[q.id] === o.id} onChange={() => setAnswers((p) => ({ ...p, [q.id]: o.id }))} />
                <span style={{ fontSize: 14 }}>{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button style={btn} disabled={saving} onClick={submit}>{saving ? 'กำลังส่ง…' : 'ส่งคำตอบ'}</button>
      </div>
    </div>
  )
}
