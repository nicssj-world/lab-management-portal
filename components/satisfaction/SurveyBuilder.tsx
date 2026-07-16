'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import type { PermLevel } from '@/lib/permissions'
import { validateDefinitionForPublish, type DefinitionIssue } from '@/lib/surveys/definition'
import type { SurveyQuestion, SurveyQuestionType, SurveySection, SurveyVersionDefinition } from '@/lib/surveys/types'
import type { SurveyWorkspace } from '@/lib/surveys/server'
import { SurveyPreviewModal } from './SurveyPreviewModal'

const TYPE_LABELS: Record<SurveyQuestionType, string> = {
  single_choice: 'ตัวเลือกเดียว',
  short_text: 'ข้อความสั้น',
  number: 'ตัวเลข',
  rating_scale: 'ระดับความพึงพอใจ',
  long_text: 'ข้อความยาว',
  yes_no: 'ใช่ / ไม่ใช่',
}

const id = () => crypto.randomUUID()

function createQuestion(sectionId: string, type: SurveyQuestionType, sortOrder: number): SurveyQuestion {
  const base = { id: id(), questionKey: `question_${id().slice(0, 8)}`, sectionId, prompt: '', type, required: false, sortOrder }
  if (type === 'rating_scale') return { ...base, type, positiveThreshold: 4, options: [1, 2, 3, 4, 5].map((score) => ({ id: id(), optionKey: `score_${score}`, label: ['น้อยที่สุด', 'น้อย', 'ปานกลาง', 'มาก', 'มากที่สุด'][score - 1], value: String(score), score, sortOrder: score })) }
  if (type === 'single_choice') return { ...base, type, options: [1, 2].map((value) => ({ id: id(), optionKey: `option_${value}`, label: `ตัวเลือก ${value}`, value: `option_${value}`, sortOrder: value })) }
  if (type === 'number') return { ...base, type, min: 0, max: 100 }
  if (type === 'short_text') return { ...base, type, maxLength: 500 }
  if (type === 'long_text') return { ...base, type, maxLength: 4_000 }
  return { ...base, type: 'yes_no', options: [
    { id: id(), optionKey: 'yes', label: 'ใช่', value: 'yes', sortOrder: 1 },
    { id: id(), optionKey: 'no', label: 'ไม่ใช่', value: 'no', sortOrder: 2 },
  ] }
}

const renumberSections = (sections: ReadonlyArray<SurveySection>) => sections.map((section, sectionIndex) => ({
  ...section,
  sortOrder: sectionIndex + 1,
  questions: section.questions.map((question, questionIndex) => ({ ...question, sortOrder: questionIndex + 1 })),
}))

export function SurveyBuilder({ workspace, level }: { workspace: SurveyWorkspace; level: PermLevel }) {
  const router = useRouter()
  const [definition, setDefinition] = useState(workspace.definition)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [publishIssues, setPublishIssues] = useState<DefinitionIssue[]>([])
  const [publishing, setPublishing] = useState(false)
  const [cloning, setCloning] = useState(false)
  const initialRender = useRef(true)
  const readOnly = level !== 'edit' || definition.status !== 'draft'

  useEffect(() => {
    if (readOnly) return
    if (initialRender.current) { initialRender.current = false; return }
    setSaveState('saving')
    setSaveMessage('กำลังบันทึก…')
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/satisfaction/surveys/${workspace.survey.id}/draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ definition }),
          signal: controller.signal,
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'บันทึกไม่สำเร็จ')
        setSaveState('saved')
        setSaveMessage(`บันทึกแล้ว ${new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`)
      } catch (error) {
        if (controller.signal.aborted) return
        setSaveState('error')
        setSaveMessage(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ')
      }
    }, 600)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [definition, readOnly, workspace.survey.id])

  const updateSections = (updater: (sections: ReadonlyArray<SurveySection>) => ReadonlyArray<SurveySection>) => {
    setDefinition((current) => ({ ...current, sections: renumberSections(updater(current.sections)) }))
  }

  const updateSection = (sectionId: string, patch: Partial<SurveySection>) => updateSections((sections) => sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section))
  const updateQuestion = (sectionId: string, questionId: string, updater: (question: SurveyQuestion) => SurveyQuestion) => updateSections((sections) => sections.map((section) => section.id === sectionId ? { ...section, questions: section.questions.map((question) => question.id === questionId ? updater(question) : question) } : section))

  const addSection = () => updateSections((sections) => [...sections, { id: id(), sectionKey: `section_${id().slice(0, 8)}`, title: 'ส่วนใหม่', sortOrder: sections.length + 1, questions: [] }])
  const moveSection = (index: number, offset: number) => updateSections((sections) => {
    const next = [...sections]; const target = index + offset
    if (target < 0 || target >= next.length) return next
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    return next
  })
  const moveQuestion = (sectionId: string, index: number, offset: number) => updateSections((sections) => sections.map((section) => {
    if (section.id !== sectionId) return section
    const questions = [...section.questions]; const target = index + offset
    if (target < 0 || target >= questions.length) return section
    ;[questions[index], questions[target]] = [questions[target]!, questions[index]!]
    return { ...section, questions }
  }))

  const cloneDraft = async () => {
    setCloning(true); setSaveMessage('กำลังสร้างฉบับร่าง…')
    try {
      const response = await fetch(`/api/admin/satisfaction/surveys/${workspace.survey.id}/draft`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceVersionId: definition.id }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'สร้างฉบับร่างไม่สำเร็จ')
      router.refresh()
      window.location.reload()
    } catch (error) {
      setSaveState('error'); setSaveMessage(error instanceof Error ? error.message : 'สร้างฉบับร่างไม่สำเร็จ')
    } finally { setCloning(false) }
  }

  const publish = async () => {
    const issues = validateDefinitionForPublish(definition)
    setPublishIssues(issues)
    if (issues.length) {
      document.querySelector<HTMLElement>('[data-definition-issues]')?.focus()
      return
    }
    setPublishing(true); setSaveMessage('กำลังเผยแพร่…')
    try {
      const response = await fetch(`/api/admin/satisfaction/surveys/${workspace.survey.id}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ versionId: definition.id }) })
      const result = await response.json()
      if (!response.ok) {
        setPublishIssues(result.issues ?? [{ path: 'definition', message: result.error ?? 'เผยแพร่ไม่สำเร็จ' }])
        throw new Error(result.error ?? 'เผยแพร่ไม่สำเร็จ')
      }
      router.refresh(); window.location.reload()
    } catch (error) {
      setSaveState('error'); setSaveMessage(error instanceof Error ? error.message : 'เผยแพร่ไม่สำเร็จ')
    } finally { setPublishing(false) }
  }

  return (
    <main className="survey-builder-page" style={{ padding: 24, minWidth: 0 }}>
      <style>{`
        .survey-builder-page{max-width:1180px;margin:0 auto}.builder-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}.builder-grid{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:16px;align-items:start}.builder-section{scroll-margin-top:80px}.builder-question{border:1px solid var(--border);border-radius:11px;padding:14px;background:var(--card)}.builder-question+.builder-question{margin-top:10px}.builder-field{display:flex;flex-direction:column;gap:5px}.builder-field label{font-size:11.5px;color:var(--muted);font-weight:700}.builder-input{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--ink);padding:9px 10px;font:inherit;font-size:13px}.builder-input:focus-visible,.builder-icon-button:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 25%,transparent);outline-offset:2px;border-color:var(--primary)}.builder-icon-button{width:30px;height:30px;border:1px solid var(--border);border-radius:7px;background:var(--card);color:var(--muted);display:grid;place-items:center;cursor:pointer}.builder-icon-button:disabled{opacity:.35;cursor:not-allowed}.builder-option{display:grid;grid-template-columns:32px 1fr 88px 30px;gap:7px;align-items:center;margin-top:7px}.builder-sticky{position:sticky;top:72px}.builder-issue{padding:8px 10px;border-radius:8px;background:rgba(220,38,38,.08);color:var(--danger);font-size:12px;margin-top:6px}@media(max-width:900px){.builder-grid{grid-template-columns:1fr}.builder-sticky{position:static}}@media(max-width:767px){.survey-builder-page{padding:16px!important}.builder-option{grid-template-columns:28px 1fr 30px}.builder-option .builder-score{display:none}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
      `}</style>

      <div className="builder-toolbar">
        <div>
          <Link href="/staff/satisfaction" style={{ color: 'var(--muted)', fontSize: 12, textDecoration: 'none' }}>← กลับไปหน้ารวม</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' }}><h1 style={{ margin: 0, fontSize: 22, color: 'var(--ink)' }}>{workspace.survey.code}</h1><Badge color={definition.status === 'draft' ? 'amber' : 'green'}>Version {definition.versionNumber} · {definition.status === 'draft' ? 'ฉบับร่าง' : 'เผยแพร่แล้ว'}</Badge></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" icon="eye" onClick={() => setPreviewOpen(true)}>ดูตัวอย่าง</Button>
          {level === 'edit' && definition.status !== 'draft' && <Button icon="edit" onClick={cloneDraft} disabled={cloning}>{cloning ? 'กำลังสร้าง…' : 'สร้างฉบับร่างใหม่'}</Button>}
          {!readOnly && <Button icon="check" onClick={publish} disabled={publishing || saveState === 'saving'}>{publishing ? 'กำลังเผยแพร่…' : 'เผยแพร่เวอร์ชันนี้'}</Button>}
        </div>
      </div>

      <div aria-live="polite" style={{ minHeight: 20, fontSize: 12, color: saveState === 'error' ? 'var(--danger)' : 'var(--muted)', marginBottom: 8 }}>{readOnly ? (level === 'edit' ? 'เวอร์ชันที่เผยแพร่แล้วเป็นแบบอ่านอย่างเดียว' : 'คุณมีสิทธิ์ดูแบบสำรวจเท่านั้น') : saveMessage || 'การเปลี่ยนแปลงจะบันทึกอัตโนมัติ'}</div>

      <div className="builder-grid">
        <div>
          <Card style={{ marginBottom: 14 }}>
            <div className="builder-field"><label htmlFor="survey-title">ชื่อแบบสำรวจ</label><input id="survey-title" className="builder-input" disabled={readOnly} value={definition.title} onChange={(event) => setDefinition((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="builder-field" style={{ marginTop: 10 }}><label htmlFor="survey-description">คำอธิบาย</label><textarea id="survey-description" className="builder-input" rows={2} disabled={readOnly} value={definition.description ?? ''} onChange={(event) => setDefinition((current) => ({ ...current, description: event.target.value }))} /></div>
          </Card>

          {definition.sections.map((section, sectionIndex) => (
            <Card key={section.id} className="builder-section" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontWeight: 800, flexShrink: 0 }}>{sectionIndex + 1}</div>
                <div className="builder-field" style={{ flex: 1 }}><label htmlFor={`section-${section.id}`}>ชื่อส่วน</label><input id={`section-${section.id}`} className="builder-input" disabled={readOnly} value={section.title} onChange={(event) => updateSection(section.id, { title: event.target.value })} /></div>
                {!readOnly && <><button type="button" className="builder-icon-button" aria-label="เลื่อนขึ้น" disabled={sectionIndex === 0} onClick={() => moveSection(sectionIndex, -1)}><Icon name="chevDown" size={14} style={{ transform: 'rotate(180deg)' }} /></button><button type="button" className="builder-icon-button" aria-label="เลื่อนลง" disabled={sectionIndex === definition.sections.length - 1} onClick={() => moveSection(sectionIndex, 1)}><Icon name="chevDown" size={14} /></button><button type="button" className="builder-icon-button" aria-label="ลบส่วน" onClick={() => updateSections((sections) => sections.filter((item) => item.id !== section.id))}><Icon name="trash" size={14} /></button></>}
              </div>

              <div style={{ marginTop: 14 }}>
                {section.questions.map((question, questionIndex) => (
                  <QuestionEditor key={question.id} question={question} index={questionIndex} count={section.questions.length} readOnly={readOnly} onChange={(next) => updateQuestion(section.id, question.id, () => next)} onMove={(offset) => moveQuestion(section.id, questionIndex, offset)} onDelete={() => updateSection(section.id, { questions: section.questions.filter((item) => item.id !== question.id) })} />
                ))}
              </div>
              {!readOnly && <div style={{ marginTop: 12 }}><Button size="sm" variant="soft" icon="plus" onClick={() => updateSection(section.id, { questions: [...section.questions, createQuestion(section.id, 'rating_scale', section.questions.length + 1)] })}>เพิ่มคำถาม</Button></div>}
            </Card>
          ))}
          {!readOnly && <Button variant="secondary" icon="plus" full onClick={addSection}>เพิ่มส่วนใหม่</Button>}
        </div>

        <aside className="builder-sticky">
          <Card>
            <h2 style={{ margin: 0, fontSize: 14, color: 'var(--ink)' }}>ความพร้อมก่อนเผยแพร่</h2>
            <p style={{ margin: '5px 0 12px', fontSize: 11.5, color: 'var(--muted)' }}>ตรวจชื่อส่วน คำถาม ตัวเลือก และเกณฑ์คะแนน</p>
            <div data-definition-issues tabIndex={-1}>
              {publishIssues.length === 0 ? <div style={{ padding: 10, borderRadius: 8, background: 'rgba(22,163,74,.08)', color: 'var(--success)', fontSize: 12 }}>ยังไม่พบข้อผิดพลาดจากการตรวจล่าสุด</div> : publishIssues.map((issue, index) => <div key={`${issue.path}-${index}`} className="builder-issue"><strong>{issue.path}</strong><br />{issue.message}</div>)}
            </div>
          </Card>
        </aside>
      </div>
      {previewOpen && <SurveyPreviewModal definition={definition} onClose={() => setPreviewOpen(false)} />}
    </main>
  )
}

function QuestionEditor({ question, index, count, readOnly, onChange, onMove, onDelete }: { question: SurveyQuestion; index: number; count: number; readOnly: boolean; onChange: (question: SurveyQuestion) => void; onMove: (offset: number) => void; onDelete: () => void }) {
  const changeType = (type: SurveyQuestionType) => {
    const next = createQuestion(question.sectionId, type, question.sortOrder)
    onChange({ ...next, id: question.id, questionKey: question.questionKey, prompt: question.prompt, required: question.required })
  }
  return (
    <div className="builder-question">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(150px,210px) auto', gap: 8, alignItems: 'end' }}>
        <div className="builder-field"><label htmlFor={`question-${question.id}`}>คำถาม {index + 1}</label><input id={`question-${question.id}`} className="builder-input" disabled={readOnly} value={question.prompt} placeholder="พิมพ์คำถาม" onChange={(event) => onChange({ ...question, prompt: event.target.value })} /></div>
        <div className="builder-field"><label htmlFor={`type-${question.id}`}>รูปแบบคำตอบ</label><select id={`type-${question.id}`} className="builder-input" disabled={readOnly} value={question.type} onChange={(event) => changeType(event.target.value as SurveyQuestionType)}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        {!readOnly && <div style={{ display: 'flex', gap: 5 }}><button type="button" className="builder-icon-button" aria-label="เลื่อนขึ้น" disabled={index === 0} onClick={() => onMove(-1)}><Icon name="chevDown" size={13} style={{ transform: 'rotate(180deg)' }} /></button><button type="button" className="builder-icon-button" aria-label="เลื่อนลง" disabled={index === count - 1} onClick={() => onMove(1)}><Icon name="chevDown" size={13} /></button><button type="button" className="builder-icon-button" aria-label="ลบคำถาม" onClick={onDelete}><Icon name="trash" size={13} /></button></div>}
      </div>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 10, fontSize: 12, color: 'var(--muted)' }}><input type="checkbox" checked={question.required} disabled={readOnly} onChange={(event) => onChange({ ...question, required: event.target.checked })} /> จำเป็นต้องตอบ</label>
      {(question.type === 'single_choice' || question.type === 'rating_scale') && <OptionsEditor question={question} readOnly={readOnly} onChange={onChange} />}
      {question.type === 'number' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}><div className="builder-field"><label>ค่าต่ำสุด</label><input className="builder-input" type="number" disabled={readOnly} value={question.min} onChange={(event) => onChange({ ...question, min: Number(event.target.value) })} /></div><div className="builder-field"><label>ค่าสูงสุด</label><input className="builder-input" type="number" disabled={readOnly} value={question.max} onChange={(event) => onChange({ ...question, max: Number(event.target.value) })} /></div></div>}
      {question.type === 'rating_scale' && <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, fontSize: 12, color: 'var(--muted)' }}><input type="checkbox" disabled={readOnly} checked={Boolean(question.allowDetailText)} onChange={(event) => onChange({ ...question, allowDetailText: event.target.checked })} /> เปิดช่องรายละเอียดเพิ่มเติม</label>}
      {question.type === 'long_text' && <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, fontSize: 12, color: 'var(--muted)' }}><input type="checkbox" disabled={readOnly} checked={Boolean(question.isComment)} onChange={(event) => onChange({ ...question, isComment: event.target.checked })} /> จัดเป็นความคิดเห็นสำหรับหน้าความคิดเห็น</label>}
    </div>
  )
}

function OptionsEditor({ question, readOnly, onChange }: { question: Extract<SurveyQuestion, { type: 'single_choice' | 'rating_scale' }>; readOnly: boolean; onChange: (question: SurveyQuestion) => void }) {
  return <div style={{ marginTop: 10 }}>{question.options.map((option, index) => <div className="builder-option" key={option.id}><span style={{ width: 26, height: 26, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 11 }}>{index + 1}</span><input className="builder-input" disabled={readOnly} value={option.label} aria-label={`ชื่อตัวเลือก ${index + 1}`} onChange={(event) => onChange({ ...question, options: question.options.map((item) => item.id === option.id ? { ...item, label: event.target.value } : item) })} />{question.type === 'rating_scale' && <input className="builder-input builder-score" type="number" disabled={readOnly} value={option.score ?? ''} aria-label={`คะแนนตัวเลือก ${index + 1}`} onChange={(event) => onChange({ ...question, options: question.options.map((item) => item.id === option.id ? { ...item, score: Number(event.target.value) } : item) })} />}{!readOnly && <button type="button" className="builder-icon-button" aria-label="ลบตัวเลือก" onClick={() => onChange({ ...question, options: question.options.filter((item) => item.id !== option.id) })}><Icon name="x" size={12} /></button>}</div>)}{!readOnly && question.type === 'single_choice' && <Button variant="ghost" size="sm" icon="plus" style={{ marginTop: 7 }} onClick={() => onChange({ ...question, options: [...question.options, { id: id(), optionKey: `option_${id().slice(0, 6)}`, label: `ตัวเลือก ${question.options.length + 1}`, value: `option_${question.options.length + 1}`, sortOrder: question.options.length + 1 }] })}>เพิ่มตัวเลือก</Button>}</div>
}
