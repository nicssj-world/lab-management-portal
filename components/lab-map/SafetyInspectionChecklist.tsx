'use client'

import type { SafetyChecklistAnswer, SafetyChecklistTemplateItem } from '@/lib/lab-map/types'

const choices = [
  { value: 'pass', label: 'ผ่าน' },
  { value: 'fail', label: 'ไม่ผ่าน' },
  { value: 'na', label: 'ไม่เกี่ยวข้อง' },
] as const

export function SafetyInspectionChecklist({ template, answers, showErrors = false, disabled = false, onChange }: {
  template: readonly SafetyChecklistTemplateItem[]
  answers: readonly SafetyChecklistAnswer[]
  showErrors?: boolean
  disabled?: boolean
  onChange: (answers: SafetyChecklistAnswer[]) => void
}) {
  function update(item: SafetyChecklistTemplateItem, patch: Partial<SafetyChecklistAnswer>) {
    const current = answers.find(answer => answer.key === item.key)
    const next: SafetyChecklistAnswer = {
      key: item.key,
      labelTh: item.labelTh,
      answer: patch.answer ?? current?.answer ?? 'pass',
      note: patch.note !== undefined ? patch.note : current?.note ?? null,
    }
    onChange([...answers.filter(answer => answer.key !== item.key), next])
  }

  return <div className="safety-checklist" aria-label="รายการตรวจตามประเภทอุปกรณ์">
    {template.map((item, index) => {
      const answer = answers.find(value => value.key === item.key)
      const missing = showErrors && item.required && !answer
      const errorId = `safety-check-${index}-error`
      return <fieldset className="safety-checklist-row" key={item.key} aria-describedby={missing ? errorId : undefined}>
        <legend>{item.labelTh}{item.required ? ' *' : ''}</legend>
        <div className="safety-checklist-choices">
          {choices.map(choice => <button
            type="button"
            key={choice.value}
            aria-pressed={answer?.answer === choice.value}
            disabled={disabled}
            style={{ minHeight: 44 }}
            onClick={() => update(item, { answer: choice.value, note: choice.value === 'fail' ? answer?.note ?? '' : null })}
          >{choice.label}</button>)}
        </div>
        {answer?.answer === 'fail' ? <label className="safety-checklist-note">
          รายละเอียดที่ไม่ผ่าน
          <input
            value={answer.note ?? ''}
            disabled={disabled}
            onChange={event => update(item, { note: event.target.value })}
          />
        </label> : null}
        {missing ? <p id={errorId} role="alert">กรุณาระบุผลการตรวจหัวข้อนี้</p> : null}
      </fieldset>
    })}
  </div>
}
