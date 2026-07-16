'use client'

import type { SurveyAnswerInput, SurveyQuestion, SurveyVersionDefinition } from '@/lib/surveys/types'

export type SurveyAnswerMap = Record<string, SurveyAnswerInput>

export function SurveyRenderer({
  definition,
  mode,
  answers,
  errors = {},
  onAnswer,
}: {
  definition: SurveyVersionDefinition
  mode: 'preview' | 'public'
  answers: SurveyAnswerMap
  errors?: Record<string, string>
  onAnswer: (questionId: string, answer: SurveyAnswerInput) => void
}) {
  return (
    <div className={`survey-renderer survey-renderer-${mode}`}>
      <style>{`
        .survey-renderer{display:flex;flex-direction:column;gap:20px;color:var(--ink)}
        .survey-renderer-header{padding:20px;border-radius:14px;background:linear-gradient(135deg,var(--primary-soft),var(--card));border:1px solid var(--border)}
        .survey-renderer-section{border:1px solid var(--border);background:var(--card);border-radius:14px;overflow:hidden}
        .survey-renderer-section-head{padding:15px 18px;background:var(--surface-2);border-bottom:1px solid var(--border)}
        .survey-question{padding:18px;border-bottom:1px solid var(--border)}
        .survey-question:last-child{border-bottom:0}
        .survey-question-label{display:block;font-size:14px;font-weight:700;line-height:1.5;margin-bottom:10px}
        .survey-required{color:var(--danger);margin-left:4px}
        .survey-input{width:100%;border:1px solid var(--border);background:var(--card);color:var(--ink);border-radius:9px;padding:10px 12px;font:inherit;font-size:14px;box-sizing:border-box}
        .survey-input:focus-visible,.survey-choice:focus-within{outline:3px solid color-mix(in srgb,var(--primary) 25%,transparent);outline-offset:2px;border-color:var(--primary)}
        .survey-options{display:flex;flex-wrap:wrap;gap:9px}
        .survey-choice{display:flex;align-items:center;gap:8px;min-height:42px;padding:8px 12px;border:1px solid var(--border);border-radius:9px;background:var(--card);cursor:pointer;font-size:13px}
        .survey-choice:has(input:checked){border-color:var(--primary);background:var(--primary-soft);color:var(--primary);font-weight:600}
        .survey-error{color:var(--danger);font-size:12px;margin-top:8px}
        @media(max-width:600px){.survey-renderer{gap:14px}.survey-renderer-header{padding:17px}.survey-question{padding:16px}.survey-options{flex-direction:column}.survey-choice{width:100%;box-sizing:border-box}}
      `}</style>
      <header className="survey-renderer-header">
        <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 800, letterSpacing: '.08em' }}>SATISFACTION SURVEY</div>
        <h1 style={{ margin: '6px 0 0', fontSize: 23, lineHeight: 1.35 }}>{definition.title}</h1>
        {definition.description && <p style={{ color: 'var(--muted)', margin: '7px 0 0', fontSize: 13, lineHeight: 1.6 }}>{definition.description}</p>}
      </header>

      {definition.sections.map((section, sectionIndex) => (
        <section className="survey-renderer-section" key={section.id}>
          <div className="survey-renderer-section-head">
            <h2 style={{ margin: 0, fontSize: 16 }}>{sectionIndex + 1}. {section.title}</h2>
            {section.description && <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>{section.description}</p>}
          </div>
          {section.questions.map((question, questionIndex) => (
            <QuestionField
              key={question.id}
              question={question}
              number={questionIndex + 1}
              answer={answers[question.id] ?? { questionId: question.id }}
              error={errors[question.id]}
              onChange={(answer) => onAnswer(question.id, answer)}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

function QuestionField({
  question,
  number,
  answer,
  error,
  onChange,
}: {
  question: SurveyQuestion
  number: number
  answer: SurveyAnswerInput
  error?: string
  onChange: (answer: SurveyAnswerInput) => void
}) {
  const labelledBy = `survey-question-${question.id}`
  return (
    <div className="survey-question">
      <label id={labelledBy} className="survey-question-label" htmlFor={`answer-${question.id}`}>
        {number}. {question.prompt || 'ยังไม่ได้ระบุคำถาม'}
        {question.required && <span className="survey-required" aria-label="จำเป็น">*</span>}
      </label>
      {question.helpText && <p style={{ color: 'var(--muted)', fontSize: 12, margin: '-5px 0 10px' }}>{question.helpText}</p>}

      {(question.type === 'single_choice' || question.type === 'rating_scale' || question.type === 'yes_no') && (
        <div className="survey-options" role="radiogroup" aria-labelledby={labelledBy}>
          {(question.options ?? []).map((option) => (
            <label className="survey-choice" key={option.id}>
              <input
                type="radio"
                name={`answer-${question.id}`}
                value={option.id}
                checked={answer.optionId === option.id}
                onChange={() => onChange({ ...answer, questionId: question.id, optionId: option.id })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === 'single_choice' && question.options.find((option) => option.id === answer.optionId)?.allowsOtherText && (
        <input id={`answer-${question.id}`} className="survey-input" style={{ marginTop: 10 }} value={answer.textValue ?? ''} maxLength={500} placeholder="โปรดระบุ" onChange={(event) => onChange({ ...answer, questionId: question.id, textValue: event.target.value })} />
      )}
      {question.type === 'rating_scale' && question.allowDetailText && (
        <input id={`answer-${question.id}`} className="survey-input" style={{ marginTop: 10 }} value={answer.detailText ?? ''} maxLength={500} placeholder={question.detailLabel ?? 'รายละเอียดเพิ่มเติม (ถ้ามี)'} onChange={(event) => onChange({ ...answer, questionId: question.id, detailText: event.target.value })} />
      )}
      {question.type === 'short_text' && (
        <input id={`answer-${question.id}`} className="survey-input" value={answer.textValue ?? ''} maxLength={Math.min(question.maxLength ?? 500, 500)} placeholder={question.placeholder ?? ''} onChange={(event) => onChange({ questionId: question.id, textValue: event.target.value })} />
      )}
      {question.type === 'number' && (
        <input id={`answer-${question.id}`} className="survey-input" type="number" inputMode="numeric" min={question.min} max={question.max} value={answer.numericValue ?? ''} placeholder={question.placeholder ?? ''} onChange={(event) => onChange({ questionId: question.id, numericValue: event.target.value === '' ? null : Number(event.target.value) })} />
      )}
      {question.type === 'long_text' && (
        <textarea id={`answer-${question.id}`} className="survey-input" rows={4} value={answer.textValue ?? ''} maxLength={Math.min(question.maxLength ?? 4_000, 4_000)} placeholder={question.placeholder ?? ''} onChange={(event) => onChange({ questionId: question.id, textValue: event.target.value })} />
      )}
      {error && <div className="survey-error" role="alert">{error}</div>}
    </div>
  )
}
