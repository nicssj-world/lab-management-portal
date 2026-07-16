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
        .survey-renderer-header{padding:20px;border-radius:16px;background:linear-gradient(135deg,var(--primary-soft),var(--card));border:1px solid var(--border)}
        .survey-renderer-section{border:1px solid var(--border);background:var(--card);border-radius:16px;overflow:hidden}
        .survey-renderer-section-head{padding:15px 18px;background:var(--surface-2);border-bottom:1px solid var(--border)}
        .survey-section-title{display:flex;align-items:center;gap:9px}
        .survey-section-number{width:25px;height:25px;display:grid;place-items:center;border-radius:8px;background:var(--primary-soft);color:var(--primary);font-size:12px;font-weight:800}
        .survey-question{padding:18px;border-bottom:1px solid var(--border)}
        .survey-question:last-child{border-bottom:0}
        .survey-question-label{display:block;font-size:14px;font-weight:700;line-height:1.5;margin-bottom:10px}
        .survey-question-number{display:inline-grid;place-items:center;min-width:23px;height:23px;margin-right:7px;border-radius:7px;background:var(--surface-2);color:var(--muted);font-size:11px;font-weight:800;vertical-align:middle}
        .survey-required{color:var(--danger);margin-left:4px}
        .survey-input{width:100%;border:1px solid var(--border);background:var(--card);color:var(--ink);border-radius:9px;padding:10px 12px;font:inherit;font-size:14px;box-sizing:border-box}
        .survey-input:focus-visible,.survey-choice:focus-within{outline:3px solid color-mix(in srgb,var(--primary) 25%,transparent);outline-offset:2px;border-color:var(--primary)}
        .survey-options{display:flex;flex-wrap:wrap;gap:9px}
        .survey-choice{display:flex;align-items:center;gap:8px;min-height:42px;padding:8px 12px;border:1px solid var(--border);border-radius:9px;background:var(--card);cursor:pointer;font-size:13px}
        .survey-choice:has(input:checked){border-color:var(--primary);background:var(--primary-soft);color:var(--primary);font-weight:600}
        .survey-error{color:var(--danger);font-size:12px;margin-top:8px}
        .survey-renderer-public{gap:16px}
        .survey-renderer-public .survey-renderer-header{padding:24px;border-color:rgba(13,148,136,.22);background:linear-gradient(135deg,rgba(13,148,136,.13),rgba(37,99,235,.07) 56%,var(--card));box-shadow:0 12px 28px rgba(15,118,110,.08)}
        .survey-renderer-public .survey-renderer-section{box-shadow:0 8px 20px rgba(15,23,42,.045)}
        .survey-renderer-public .survey-question{padding:20px}
        .survey-renderer-public .survey-choice{min-height:48px;transition:border-color .16s ease,background .16s ease,box-shadow .16s ease}
        .survey-renderer-public .survey-choice:hover{border-color:color-mix(in srgb,var(--primary) 55%,var(--border));background:color-mix(in srgb,var(--primary-soft) 54%,var(--card))}
        .survey-renderer-public .survey-question[data-question-type="rating_scale"] .survey-options{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
        .survey-renderer-public .survey-question[data-question-type="rating_scale"] .survey-choice{justify-content:center;flex-direction:column;gap:3px;padding:7px 5px;text-align:center;font-size:11px;line-height:1.25}
        .survey-renderer-public .survey-question[data-question-type="rating_scale"] .survey-choice input{margin:0}
        @media(max-width:600px){.survey-renderer{gap:14px}.survey-renderer-header,.survey-renderer-public .survey-renderer-header{padding:18px}.survey-question,.survey-renderer-public .survey-question{padding:16px}.survey-options{flex-direction:column}.survey-choice{width:100%;box-sizing:border-box}.survey-renderer-public .survey-question[data-question-type="rating_scale"] .survey-options{grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}.survey-renderer-public .survey-question[data-question-type="rating_scale"] .survey-choice{min-width:0;font-size:10px;overflow-wrap:anywhere}}
        @media(prefers-reduced-motion:reduce){.survey-renderer-public .survey-choice{transition:none}}
      `}</style>
      <header className="survey-renderer-header">
        <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 800, letterSpacing: '.08em' }}>SATISFACTION SURVEY</div>
        <h1 style={{ margin: '6px 0 0', fontSize: 23, lineHeight: 1.35 }}>{definition.title}</h1>
        {definition.description && <p style={{ color: 'var(--muted)', margin: '7px 0 0', fontSize: 13, lineHeight: 1.6 }}>{definition.description}</p>}
      </header>

      {definition.sections.map((section, sectionIndex) => (
        <section className="survey-renderer-section" key={section.id}>
          <div className="survey-renderer-section-head">
            <div className="survey-section-title"><span className="survey-section-number">{sectionIndex + 1}</span><h2 style={{ margin: 0, fontSize: 16 }}>{section.title}</h2></div>
            {section.description && <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>{section.description}</p>}
          </div>
          {section.questions.map((question, questionIndex) => (
            <QuestionField
              key={question.id}
              question={question}
              number={`${sectionIndex + 1}.${questionIndex + 1}`}
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
  number: string
  answer: SurveyAnswerInput
  error?: string
  onChange: (answer: SurveyAnswerInput) => void
}) {
  const labelledBy = `survey-question-${question.id}`
  return (
    <div className="survey-question" data-question-type={question.type}>
      <label id={labelledBy} className="survey-question-label" htmlFor={`answer-${question.id}`}>
        <span className="survey-question-number">{number}</span>{question.prompt || 'ยังไม่ได้ระบุคำถาม'}
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
