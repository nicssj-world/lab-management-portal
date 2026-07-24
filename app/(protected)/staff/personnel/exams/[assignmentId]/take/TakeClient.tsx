'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Icon } from '@/components/ui/Icon'
import type { ExamQuestion } from '@/lib/personnel/exam'

const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 22px', borderRadius: 10, border: 0, background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

const CSS = `
@keyframes tkRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.tk-rise{opacity:0;animation:tkRise .45s cubic-bezier(.22,1,.36,1) forwards}
.tk-opt{transition:border-color .15s,background .15s,transform .12s}
.tk-opt:hover{border-color:color-mix(in srgb,var(--primary) 45%,var(--border))}
.tk-opt:active{transform:scale(.99)}
.tk-submit{transition:transform .15s,box-shadow .15s}
.tk-submit:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 20px rgba(30,95,173,.25)}
@media(prefers-reduced-motion:reduce){.tk-rise{animation:none;opacity:1}.tk-submit:hover{transform:none}}
`

export function TakeClient({ assignmentId, title, description, questions }: {
  assignmentId: string; title: string; description: string | null; questions: ExamQuestion[]
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ score: number; passed: boolean; correct: number; total: number; answerKey: Record<string, string> } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const answered = Object.keys(answers).length
  const pct = questions.length ? Math.round((answered / questions.length) * 100) : 0

  async function submit() {
    if (answered < questions.length && !confirm('ยังตอบไม่ครบทุกข้อ ต้องการส่งเลยหรือไม่?')) return
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/personnel/exams/${assignmentId}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'ส่งไม่สำเร็จ')
      setResult({ score: data.score, passed: data.passed, correct: data.correct, total: data.total, answerKey: data.answerKey ?? {} })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) { setError(e instanceof Error ? e.message : 'ส่งไม่สำเร็จ') } finally { setSaving(false) }
  }

  if (result) {
    const tone = result.passed ? 'var(--success)' : 'var(--danger)'
    const ring = result.passed ? '#16A34A' : '#DC2626'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640, margin: '0 auto' }}>
        <style>{CSS}</style>
        <div className="tk-rise" style={{ ...card, textAlign: 'center', padding: '34px 24px', position: 'relative', overflow: 'hidden', borderTop: `3px solid ${ring}` }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${ring}14 0%, transparent 60%)`, pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{title}</div>
            <div style={{ width: 120, height: 120, margin: '16px auto 8px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: `conic-gradient(${ring} ${result.score}%, var(--surface-2) 0)` }}>
              <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--card)', display: 'grid', placeItems: 'center' }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: tone, fontVariantNumeric: 'tabular-nums' }}>{result.score}%</span>
              </div>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 17, fontWeight: 800, color: tone }}>
              <Icon name={result.passed ? 'check' : 'x'} size={19} /> {result.passed ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'}
            </div>
            <div style={{ color: 'var(--muted)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>ตอบถูก {result.correct}/{result.total} ข้อ</div>
            <Link href="/staff/personnel/exams" className="tk-submit" style={{ ...btn, textDecoration: 'none', marginTop: 22 }} onClick={() => router.refresh()}>
              <Icon name="arrowLeft" size={16} /> กลับไปหน้าแบบทดสอบ
            </Link>
          </div>
        </div>

        <h2 style={{ fontSize: 15, margin: '4px 0 0' }}>ทบทวนคำตอบ</h2>
        {questions.map((q, i) => {
          const correctId = result.answerKey[q.id]
          const chosenId = answers[q.id]
          const gotIt = chosenId === correctId
          return (
            <div key={q.id} className="tk-rise" style={{ ...card, animationDelay: `${i * 40}ms`, borderLeft: `3px solid ${gotIt ? 'var(--success)' : 'var(--danger)'}` }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
                <span style={{ color: gotIt ? 'var(--success)' : 'var(--danger)', flexShrink: 0, marginTop: 1 }}><Icon name={gotIt ? 'check' : 'x'} size={17} /></span>
                <span style={{ fontWeight: 700 }}>{i + 1}. {q.prompt}</span>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {q.options.map((o) => {
                  const isCorrect = o.id === correctId
                  const isChosen = o.id === chosenId
                  const bg = isCorrect ? 'rgba(22,163,74,.12)' : isChosen ? 'rgba(220,38,38,.12)' : 'transparent'
                  return (
                    <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: bg, fontSize: 13.5 }}>
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
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720, margin: '0 auto', paddingBottom: 88 }}>
      <style>{CSS}</style>
      <PageHeader eyebrow="ข้อสอบสมรรถนะ" title={title} subtitle={description ?? undefined} marginBottom={0} />

      {/* Sticky progress */}
      <div style={{ position: 'sticky', top: 8, zIndex: 5, ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 6px 20px rgba(15,23,42,.06)' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>ตอบแล้ว {answered}/{questions.length}</span>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} style={{ flex: 1, height: 7, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: 'var(--primary)', transition: 'width .3s ease' }} />
        </div>
      </div>

      {error && <div role="alert" style={{ padding: 10, borderRadius: 8, background: '#FEF2F2', color: '#B91C1C', fontSize: 13 }}>{error}</div>}

      {questions.map((q, i) => (
        <div key={q.id} className="tk-rise" style={{ ...card, animationDelay: `${i * 45}ms` }}>
          <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', gap: 8 }}>
            <span style={{ color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}.</span>
            <span>{q.prompt}</span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {q.options.map((o) => {
              const sel = answers[q.id] === o.id
              return (
                <label key={o.id} className="tk-opt" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: `1.5px solid ${sel ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', background: sel ? 'var(--primary-soft)' : 'var(--card)', minHeight: 44 }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${sel ? 'var(--primary)' : 'var(--border)'}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {sel && <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)' }} />}
                  </span>
                  <input type="radio" name={q.id} checked={sel} onChange={() => setAnswers((p) => ({ ...p, [q.id]: o.id }))} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                  <span style={{ fontSize: 14 }}>{o.label}</span>
                </label>
              )
            })}
          </div>
        </div>
      ))}

      {/* Sticky submit bar */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '12px 16px', background: 'color-mix(in srgb, var(--card) 88%, transparent)', backdropFilter: 'blur(8px)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', zIndex: 10 }}>
        <div style={{ width: '100%', maxWidth: 720, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="tk-submit" style={btn} disabled={saving} onClick={submit}>{saving ? 'กำลังส่ง…' : <><Icon name="check" size={16} /> ส่งคำตอบ</>}</button>
        </div>
      </div>
    </div>
  )
}
