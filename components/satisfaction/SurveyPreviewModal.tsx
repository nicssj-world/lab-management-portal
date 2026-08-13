'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { SurveyVersionDefinition } from '@/lib/surveys/types'
import { SatisfactionDialog } from './SatisfactionDialog'
import { SurveyRenderer, type SurveyAnswerMap } from './SurveyRenderer'

export function SurveyPreviewModal({ definition, onClose }: { definition: SurveyVersionDefinition; onClose: () => void }) {
  const [answers, setAnswers] = useState<SurveyAnswerMap>({})

  return (
    <SatisfactionDialog labelledBy="survey-preview-title" onClose={onClose} className="survey-preview-dialog">
      <header className="survey-preview-header">
        <div><div id="survey-preview-title">ตัวอย่างแบบสำรวจ</div><div>การตอบในหน้าต่างนี้จะไม่ถูกบันทึก</div></div>
        <Button variant="secondary" size="sm" icon="x" onClick={onClose} data-dialog-autofocus>ปิด</Button>
      </header>
      <div className="survey-preview-content">
        <SurveyRenderer definition={definition} mode="preview" answers={answers} onAnswer={(questionId, answer) => setAnswers((current) => ({ ...current, [questionId]: answer }))} />
      </div>
    </SatisfactionDialog>
  )
}
