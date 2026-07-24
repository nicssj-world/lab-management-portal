'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Icon } from '@/components/ui/Icon'
import { DEPARTMENTS } from '@/lib/validations/user-schema'
import type { CompetencyExam, ExamDefinition, ExamQuestion } from '@/lib/personnel/exam'

export type ExamRow = CompetencyExam & { assignedCount: number }
export type MyAssignment = { id: string; status: string; score: number | null; passed: boolean | null; title: string; description: string | null }
export type RosterPerson = { id: string; name: string; dept: string | null }

const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }
const input: React.CSSProperties = { minHeight: 38, width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 14px', borderRadius: 8, border: 0, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const ghost: React.CSSProperties = { ...btn, background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--border)' }
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`)

export function ExamsClient({ myAssignments, exams, roster, canManage }: {
  myAssignments: MyAssignment[]; exams: ExamRow[]; roster: RosterPerson[]; canManage: boolean
}) {
  const [list, setList] = useState(exams)
  const [builder, setBuilder] = useState<ExamRow | 'new' | null>(null)
  const [assignFor, setAssignFor] = useState<ExamRow | null>(null)
  const [error, setError] = useState('')

  async function remove(exam: ExamRow) {
    if (!confirm(`ปิดใช้งานข้อสอบ “${exam.title}”?`)) return
    const res = await fetch(`/api/admin/personnel/exams/${exam.id}`, { method: 'DELETE' })
    if (res.ok) setList((p) => p.filter((e) => e.id !== exam.id))
    else setError('ลบไม่สำเร็จ')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader eyebrow="กลุ่มงานเทคนิคการแพทย์" title="ข้อสอบสมรรถนะ" subtitle="ทำแบบทดสอบที่ได้รับมอบหมาย และจัดการข้อสอบของกลุ่มงาน" marginBottom={0} />
      {error && <div role="alert" style={{ padding: 10, borderRadius: 8, background: '#FEF2F2', color: '#B91C1C', fontSize: 13 }}>{error}</div>}

      {/* Assigned to me */}
      {myAssignments.length > 0 && (
        <section style={card}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>แบบทดสอบที่ได้รับมอบหมาย</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {myAssignments.map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{a.title}</div>
                  {a.description && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{a.description}</div>}
                </div>
                {a.status === 'open'
                  ? <Link href={`/staff/personnel/exams/${a.id}/take`} style={{ ...btn, textDecoration: 'none' }}>ทำข้อสอบ</Link>
                  : <span style={{ fontWeight: 700, color: a.passed ? 'var(--success)' : 'var(--danger)' }}>{a.passed ? 'ผ่าน' : 'ไม่ผ่าน'} · {a.score}%</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Manage exams */}
      {canManage && (
        <section style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>จัดการข้อสอบ</h2>
            <button style={btn} onClick={() => setBuilder('new')}><Icon name="plus" size={15} /> สร้างข้อสอบ</button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {list.map((e) => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{e.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{e.definition.questions.length} คำถาม · เกณฑ์ผ่าน {e.pass_mark}% · มอบหมาย {e.assignedCount} คน</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={ghost} onClick={() => setAssignFor(e)}>มอบหมาย</button>
                  <button style={ghost} onClick={() => setBuilder(e)}>แก้ไข</button>
                  <button style={{ ...ghost, color: 'var(--danger)' }} onClick={() => remove(e)}>ลบ</button>
                </div>
              </div>
            ))}
            {list.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>ยังไม่มีข้อสอบ</div>}
          </div>
        </section>
      )}

      {builder && <ExamBuilderModal exam={builder === 'new' ? null : builder} onClose={() => setBuilder(null)}
        onSaved={(saved) => { setBuilder(null); setList((p) => { const i = p.findIndex((e) => e.id === saved.id); if (i < 0) return [saved, ...p]; const c = [...p]; c[i] = saved; return c }) }}
        onError={setError} />}
      {assignFor && <AssignModal exam={assignFor} roster={roster} onClose={() => setAssignFor(null)}
        onDone={(n) => { setAssignFor(null); alert(`มอบหมายให้ ${n} คนแล้ว`) }} onError={setError} />}
    </div>
  )
}

// ── Exam builder ──
type QDraft = ExamQuestion
function newOption(label = '') { return { id: uid(), label, isCorrect: false } }
function newQuestion(type: 'single_choice' | 'yes_no'): QDraft {
  if (type === 'yes_no') return { id: uid(), prompt: '', type, options: [{ id: uid(), label: 'ใช่', isCorrect: false }, { id: uid(), label: 'ไม่ใช่', isCorrect: false }] }
  return { id: uid(), prompt: '', type, options: [newOption(), newOption()] }
}

function ExamBuilderModal({ exam, onClose, onSaved, onError }: {
  exam: ExamRow | null; onClose: () => void; onSaved: (e: ExamRow) => void; onError: (m: string) => void
}) {
  const [title, setTitle] = useState(exam?.title ?? '')
  const [description, setDescription] = useState(exam?.description ?? '')
  const [passMark, setPassMark] = useState(String(exam?.pass_mark ?? 60))
  const [questions, setQuestions] = useState<QDraft[]>(exam?.definition.questions ?? [])
  const [saving, setSaving] = useState(false)

  const patchQ = (qid: string, patch: Partial<QDraft>) => setQuestions((qs) => qs.map((q) => (q.id === qid ? { ...q, ...patch } : q)))
  const setCorrect = (qid: string, oid: string) => setQuestions((qs) => qs.map((q) => q.id === qid ? { ...q, options: q.options.map((o) => ({ ...o, isCorrect: o.id === oid })) } : q))
  const setOptLabel = (qid: string, oid: string, label: string) => setQuestions((qs) => qs.map((q) => q.id === qid ? { ...q, options: q.options.map((o) => o.id === oid ? { ...o, label } : o) } : q))
  const addOpt = (qid: string) => setQuestions((qs) => qs.map((q) => q.id === qid ? { ...q, options: [...q.options, newOption()] } : q))
  const delOpt = (qid: string, oid: string) => setQuestions((qs) => qs.map((q) => q.id === qid ? { ...q, options: q.options.filter((o) => o.id !== oid) } : q))

  async function save() {
    const definition: ExamDefinition = { questions }
    if (!title.trim()) { onError('กรุณากรอกชื่อข้อสอบ'); return }
    if (questions.length === 0) { onError('เพิ่มอย่างน้อยหนึ่งคำถาม'); return }
    for (const q of questions) {
      if (!q.prompt.trim()) { onError('มีคำถามที่ยังไม่ได้กรอก'); return }
      if (!q.options.some((o) => o.isCorrect)) { onError(`เลือกเฉลยของคำถาม “${q.prompt || '(ว่าง)'}”`); return }
      if (q.options.some((o) => !o.label.trim())) { onError('มีตัวเลือกที่ยังไม่ได้กรอก'); return }
    }
    setSaving(true)
    try {
      const body = { title: title.trim(), description: description.trim() || null, definition, passMark: Number(passMark) }
      const res = await fetch(exam ? `/api/admin/personnel/exams/${exam.id}` : '/api/admin/personnel/exams', {
        method: exam ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'บันทึกไม่สำเร็จ')
      onSaved({ ...data, assignedCount: exam?.assignedCount ?? 0 })
    } catch (e) { onError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ') } finally { setSaving(false) }
  }

  return (
    <Overlay title={exam ? 'แก้ไขข้อสอบ' : 'สร้างข้อสอบ'} onClose={onClose} wide footer={
      <><button style={ghost} onClick={onClose}>ยกเลิก</button><button style={btn} disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button></>
    }>
      <div style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 5 }}><span style={lbl}>ชื่อข้อสอบ</span><input style={input} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label style={{ display: 'grid', gap: 5 }}><span style={lbl}>คำอธิบาย</span><input style={input} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label style={{ display: 'grid', gap: 5, maxWidth: 200 }}><span style={lbl}>เกณฑ์ผ่าน (%)</span><input type="number" style={input} value={passMark} onChange={(e) => setPassMark(e.target.value)} /></label>
      </div>
      <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
        {questions.map((q, qi) => (
          <div key={q.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, color: 'var(--muted)' }}>ข้อ {qi + 1}</span>
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{q.type === 'yes_no' ? 'ถูก/ผิด' : 'ปรนัย'}</span>
              <button style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: 'var(--danger)', cursor: 'pointer' }} onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))}><Icon name="trash" size={14} /></button>
            </div>
            <input style={{ ...input, marginBottom: 8 }} placeholder="คำถาม" value={q.prompt} onChange={(e) => patchQ(q.id, { prompt: e.target.value })} />
            <div style={{ display: 'grid', gap: 6 }}>
              {q.options.map((o) => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="radio" name={`correct-${q.id}`} checked={o.isCorrect} onChange={() => setCorrect(q.id, o.id)} title="เฉลย" />
                  <input style={{ ...input, minHeight: 32 }} value={o.label} disabled={q.type === 'yes_no'} onChange={(e) => setOptLabel(q.id, o.id, e.target.value)} placeholder="ตัวเลือก" />
                  {q.type === 'single_choice' && q.options.length > 2 && <button style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }} onClick={() => delOpt(q.id, o.id)}><Icon name="x" size={14} /></button>}
                </div>
              ))}
            </div>
            {q.type === 'single_choice' && <button style={{ ...ghost, minHeight: 30, marginTop: 8, fontSize: 12 }} onClick={() => addOpt(q.id)}>+ ตัวเลือก</button>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button style={ghost} onClick={() => setQuestions((qs) => [...qs, newQuestion('single_choice')])}>+ คำถามปรนัย</button>
        <button style={ghost} onClick={() => setQuestions((qs) => [...qs, newQuestion('yes_no')])}>+ คำถามถูก/ผิด</button>
      </div>
    </Overlay>
  )
}

// ── Assign modal ──
function AssignModal({ exam, roster, onClose, onDone, onError }: {
  exam: ExamRow; roster: RosterPerson[]; onClose: () => void; onDone: (n: number) => void; onError: (m: string) => void
}) {
  const [dept, setDept] = useState<string>(DEPARTMENTS[0])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const deptRoster = roster.filter((r) => r.dept === dept)
  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  async function submit() {
    if (selected.size === 0) { onError('เลือกบุคลากรอย่างน้อยหนึ่งคน'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/personnel/exams/${exam.id}/assign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileIds: [...selected] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'มอบหมายไม่สำเร็จ')
      onDone(data.count)
    } catch (e) { onError(e instanceof Error ? e.message : 'มอบหมายไม่สำเร็จ'); onClose() } finally { setSaving(false) }
  }

  return (
    <Overlay title={`มอบหมาย: ${exam.title}`} onClose={onClose} footer={
      <><button style={ghost} onClick={onClose}>ยกเลิก</button><button style={btn} disabled={saving} onClick={submit}>{saving ? 'กำลังบันทึก…' : `มอบหมาย ${selected.size} คน`}</button></>
    }>
      <label style={{ display: 'grid', gap: 5, marginBottom: 12 }}><span style={lbl}>งาน (แผนก)</span>
        <select value={dept} onChange={(e) => setDept(e.target.value)} style={input}>{DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}</select>
      </label>
      <div style={{ display: 'grid', gap: 4, maxHeight: 320, overflow: 'auto' }}>
        {deptRoster.map((r) => (
          <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, fontSize: 13 }}>
            <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /> {r.name}
          </label>
        ))}
        {deptRoster.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>ไม่มีบุคลากรในงานนี้</div>}
      </div>
    </Overlay>
  )
}

const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--muted)' }
function Overlay({ title, children, footer, onClose, wide }: { title: string; children: React.ReactNode; footer: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: wide ? 640 : 480, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>{footer}</div>
      </div>
    </div>
  )
}
