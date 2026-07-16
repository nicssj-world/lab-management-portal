'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { SurveyVersionDefinition } from '@/lib/surveys/types'
import { SurveyRenderer, type SurveyAnswerMap } from './SurveyRenderer'

export function SurveyPreviewModal({ definition, onClose }: { definition: SurveyVersionDefinition; onClose: () => void }) {
  const [answers, setAnswers] = useState<SurveyAnswerMap>({})
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15,23,42,.58)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="survey-preview-title" style={{ width: 'min(760px,100%)', maxHeight: 'calc(100vh - 32px)', overflow: 'auto', borderRadius: 16, background: 'var(--surface)', boxShadow: '0 24px 80px rgba(0,0,0,.28)' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 16px', background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
          <div><div id="survey-preview-title" style={{ fontWeight: 800, color: 'var(--ink)' }}>ตัวอย่างแบบสำรวจ</div><div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>การตอบในหน้าต่างนี้จะไม่ถูกบันทึก</div></div>
          <Button variant="secondary" size="sm" icon="x" onClick={onClose}>ปิด</Button>
        </header>
        <div style={{ padding: 18 }}>
          <SurveyRenderer definition={definition} mode="preview" answers={answers} onAnswer={(questionId, answer) => setAnswers((current) => ({ ...current, [questionId]: answer }))} />
        </div>
      </div>
    </div>
  )
}
