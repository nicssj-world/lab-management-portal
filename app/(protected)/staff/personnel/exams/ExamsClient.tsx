'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Icon } from '@/components/ui/Icon'
import { DEPARTMENTS } from '@/lib/validations/user-schema'
import type { CompetencyExam, ExamDefinition, ExamQuestion } from '@/lib/personnel/exam'

export type ExamRow = CompetencyExam & { assignedCount: number; gradedCount: number }
export type MyAssignment = { id: string; status: string; score: number | null; passed: boolean | null; title: string; description: string | null }
export type RosterPerson = { id: string; name: string; dept: string | null }

const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }
const input: React.CSSProperties = { minHeight: 38, width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 14px', borderRadius: 8, border: 0, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const ghost: React.CSSProperties = { ...btn, background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--border)' }
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`)

const CSS = `
@keyframes exRise{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}
.ex-rise{opacity:0;animation:exRise .4s cubic-bezier(.22,1,.36,1) forwards}
.ex-lift{transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
.ex-lift:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(15,23,42,.08);border-color:color-mix(in srgb,var(--primary) 22%,var(--border))}
@media(prefers-reduced-motion:reduce){.ex-rise{animation:none;opacity:1}.ex-lift:hover{transform:none}}
`
function SectionTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
    <span style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--primary-soft)', color: 'var(--primary)', flexShrink: 0 }}><Icon name={icon} size={16} /></span>
    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{children}</h2>
  </div>
}

export function ExamsClient({ myAssignments, exams, roster, categories, canManage }: {
  myAssignments: MyAssignment[]; exams: ExamRow[]; roster: RosterPerson[]; categories: string[]; canManage: boolean
}) {
  const [list, setList] = useState(exams)
  const [builder, setBuilder] = useState<ExamRow | 'new' | null>(null)
  const [assignFor, setAssignFor] = useState<ExamRow | null>(null)
  const [resultsFor, setResultsFor] = useState<ExamRow | null>(null)
  const [error, setError] = useState('')

  async function remove(exam: ExamRow) {
    if (!confirm(`ปิดใช้งานข้อสอบ “${exam.title}”?`)) return
    const res = await fetch(`/api/admin/personnel/exams/${exam.id}`, { method: 'DELETE' })
    if (res.ok) setList((p) => p.filter((e) => e.id !== exam.id))
    else setError('ลบไม่สำเร็จ')
  }

  const openCount = myAssignments.filter((a) => a.status === 'open').length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{CSS}</style>
      <PageHeader eyebrow="กลุ่มงานเทคนิคการแพทย์" title="ข้อสอบสมรรถนะ" subtitle="ทำแบบทดสอบที่ได้รับมอบหมาย และจัดการข้อสอบของกลุ่มงาน" marginBottom={0} />
      {error && <div role="alert" style={{ padding: 10, borderRadius: 8, background: '#FEF2F2', color: '#B91C1C', fontSize: 13 }}>{error}</div>}

      {/* Assigned to me */}
      {myAssignments.length > 0 && (
        <section className="ex-rise" style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
            <SectionTitle icon="doc">แบบทดสอบที่ได้รับมอบหมาย</SectionTitle>
            {openCount > 0 && <span style={{ padding: '2px 9px', borderRadius: 999, background: 'var(--primary)', color: '#fff', fontSize: 11.5, fontWeight: 800 }}>ต้องทำ {openCount}</span>}
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {myAssignments.map((a) => {
              const open = a.status === 'open'
              return (
                <div key={a.id} className="ex-lift" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', border: '1px solid var(--border)', borderLeft: `3px solid ${open ? 'var(--primary)' : a.passed ? 'var(--success)' : 'var(--danger)'}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{a.title}</div>
                    {a.description && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{a.description}</div>}
                  </div>
                  {open
                    ? <Link href={`/staff/personnel/exams/${a.id}/take`} style={{ ...btn, textDecoration: 'none' }}>ทำข้อสอบ <Icon name="arrowRight" size={14} /></Link>
                    : <span style={{ fontWeight: 800, color: a.passed ? 'var(--success)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>{a.passed ? 'ผ่าน' : 'ไม่ผ่าน'} · {a.score}%</span>}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Manage exams */}
      {canManage && (
        <section className="ex-rise" style={{ ...card, animationDelay: '60ms' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <SectionTitle icon="settings">จัดการข้อสอบ</SectionTitle>
            <button style={btn} onClick={() => setBuilder('new')}><Icon name="plus" size={15} /> สร้างข้อสอบ</button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {list.map((e) => (
              <div key={e.id} className="ex-lift" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{e.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{e.definition.questions.length} คำถาม · เกณฑ์ผ่าน {e.pass_mark}% · มอบหมาย {e.assignedCount} · ทำแล้ว {e.gradedCount}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button style={ghost} onClick={() => setResultsFor(e)}><Icon name="chart" size={14} /> ผล</button>
                  <button style={ghost} onClick={() => setAssignFor(e)}><Icon name="users" size={14} /> มอบหมาย</button>
                  <button style={ghost} onClick={() => setBuilder(e)}><Icon name="edit" size={14} /> แก้ไข</button>
                  <button style={{ ...ghost, color: 'var(--danger)' }} onClick={() => remove(e)}><Icon name="trash" size={14} /></button>
                </div>
              </div>
            ))}
            {list.length === 0 && (
              <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--muted)' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, margin: '0 auto 10px', display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--muted)' }}><Icon name="doc" size={22} /></div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>ยังไม่มีข้อสอบ</div>
                <div style={{ fontSize: 12.5, marginTop: 3 }}>กด “สร้างข้อสอบ” เพื่อเริ่ม</div>
              </div>
            )}
          </div>
        </section>
      )}

      {builder && <ExamBuilderModal exam={builder === 'new' ? null : builder} categories={categories} onClose={() => setBuilder(null)}
        onSaved={(saved) => { setBuilder(null); setList((p) => { const i = p.findIndex((e) => e.id === saved.id); if (i < 0) return [saved, ...p]; const c = [...p]; c[i] = saved; return c }) }}
        onError={setError} />}
      {assignFor && <AssignModal exam={assignFor} roster={roster} onClose={() => setAssignFor(null)}
        onDone={(n) => { setAssignFor(null); alert(`มอบหมายให้ ${n} คนแล้ว`) }} onError={setError} />}
      {resultsFor && <ResultsModal exam={resultsFor} onClose={() => setResultsFor(null)} onError={setError} />}
    </div>
  )
}

// ── Results (per-person) ──
type ResultRow = { id: string; name: string; dept: string | null; status: string; score: number | null; passed: boolean | null; submitted_at: string | null }
function ResultsModal({ exam, onClose, onError }: { exam: ExamRow; onClose: () => void; onError: (m: string) => void }) {
  const [rows, setRows] = useState<ResultRow[] | null>(null)
  useEffect(() => {
    fetch(`/api/admin/personnel/exams/${exam.id}/assignments`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setRows(d.data) })
      .catch((e) => { onError(e instanceof Error ? e.message : 'โหลดไม่สำเร็จ'); onClose() })
  }, [exam.id, onClose, onError])

  const done = rows?.filter((r) => r.status === 'graded') ?? []
  const passed = done.filter((r) => r.passed).length

  return (
    <Overlay title={`ผลข้อสอบ: ${exam.title}`} onClose={onClose} footer={<button style={ghost} onClick={onClose}>ปิด</button>}>
      {rows === null ? <div style={{ color: 'var(--muted)' }}>กำลังโหลด…</div> : (
        <>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>ทำแล้ว {done.length}/{rows.length} คน · ผ่าน {passed} คน</div>
          <div style={{ display: 'grid', gap: 4, maxHeight: 360, overflow: 'auto' }}>
            {rows.map((r) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                {r.status === 'graded'
                  ? <span style={{ fontWeight: 700, color: r.passed ? 'var(--success)' : 'var(--danger)' }}>{r.passed ? 'ผ่าน' : 'ไม่ผ่าน'} · {r.score}%</span>
                  : <span style={{ color: 'var(--muted)' }}>ยังไม่ได้ทำ</span>}
              </div>
            ))}
            {rows.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>ยังไม่ได้มอบหมายให้ใคร</div>}
          </div>
        </>
      )}
    </Overlay>
  )
}

// ── Exam builder ──
type QDraft = ExamQuestion
function newOption(label = '') { return { id: uid(), label, isCorrect: false } }
function newQuestion(type: 'single_choice' | 'yes_no'): QDraft {
  if (type === 'yes_no') return { id: uid(), prompt: '', type, options: [{ id: uid(), label: 'ใช่', isCorrect: false }, { id: uid(), label: 'ไม่ใช่', isCorrect: false }] }
  return { id: uid(), prompt: '', type, options: [newOption(), newOption()] }
}

function ExamBuilderModal({ exam, categories, onClose, onSaved, onError }: {
  exam: ExamRow | null; categories: string[]; onClose: () => void; onSaved: (e: ExamRow) => void; onError: (m: string) => void
}) {
  const [title, setTitle] = useState(exam?.title ?? '')
  const [description, setDescription] = useState(exam?.description ?? '')
  const [passMark, setPassMark] = useState(String(exam?.pass_mark ?? 60))
  const [authorizeCategory, setAuthorizeCategory] = useState(exam?.definition.authorizeCategory ?? '')
  const [questions, setQuestions] = useState<QDraft[]>(exam?.definition.questions ?? [])
  const [saving, setSaving] = useState(false)
  // Questions/answer key are frozen once anyone has taken the exam.
  const locked = (exam?.gradedCount ?? 0) > 0

  const patchQ = (qid: string, patch: Partial<QDraft>) => setQuestions((qs) => qs.map((q) => (q.id === qid ? { ...q, ...patch } : q)))
  const setCorrect = (qid: string, oid: string) => setQuestions((qs) => qs.map((q) => q.id === qid ? { ...q, options: q.options.map((o) => ({ ...o, isCorrect: o.id === oid })) } : q))
  const setOptLabel = (qid: string, oid: string, label: string) => setQuestions((qs) => qs.map((q) => q.id === qid ? { ...q, options: q.options.map((o) => o.id === oid ? { ...o, label } : o) } : q))
  const addOpt = (qid: string) => setQuestions((qs) => qs.map((q) => q.id === qid ? { ...q, options: [...q.options, newOption()] } : q))
  const delOpt = (qid: string, oid: string) => setQuestions((qs) => qs.map((q) => q.id === qid ? { ...q, options: q.options.filter((o) => o.id !== oid) } : q))

  async function save() {
    const definition: ExamDefinition = { questions, authorizeCategory: authorizeCategory || null }
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
      onSaved({ ...data, assignedCount: exam?.assignedCount ?? 0, gradedCount: exam?.gradedCount ?? 0 })
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
        <label style={{ display: 'grid', gap: 5 }}><span style={lbl}>เมื่อสอบผ่าน เปิดสิทธิทำการตรวจในหมวด (ถ้าต้องการ)</span>
          <select value={authorizeCategory} onChange={(e) => setAuthorizeCategory(e.target.value)} style={input}>
            <option value="">— ไม่เปิดสิทธิอัตโนมัติ —</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      {locked && <div style={{ marginTop: 14, padding: 10, borderRadius: 8, background: 'rgba(217,119,6,.1)', color: '#B45309', fontSize: 12.5 }}>ข้อสอบนี้มีผู้ทำแล้ว — แก้ได้เฉพาะชื่อ/คำอธิบาย/เกณฑ์ผ่าน/หมวด (คำถามและเฉลยถูกล็อกเพื่อรักษาความถูกต้องของคะแนน)</div>}
      <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
        {questions.map((q, qi) => (
          <div key={q.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, opacity: locked ? 0.75 : 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, color: 'var(--muted)' }}>ข้อ {qi + 1}</span>
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{q.type === 'yes_no' ? 'ถูก/ผิด' : 'ปรนัย'}</span>
              {!locked && <button style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: 'var(--danger)', cursor: 'pointer' }} onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))}><Icon name="trash" size={14} /></button>}
            </div>
            <input style={{ ...input, marginBottom: 8 }} placeholder="คำถาม" value={q.prompt} disabled={locked} onChange={(e) => patchQ(q.id, { prompt: e.target.value })} />
            <div style={{ display: 'grid', gap: 6 }}>
              {q.options.map((o) => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="radio" name={`correct-${q.id}`} checked={o.isCorrect} disabled={locked} onChange={() => setCorrect(q.id, o.id)} title="เฉลย" />
                  <input style={{ ...input, minHeight: 32 }} value={o.label} disabled={locked || q.type === 'yes_no'} onChange={(e) => setOptLabel(q.id, o.id, e.target.value)} placeholder="ตัวเลือก" />
                  {!locked && q.type === 'single_choice' && q.options.length > 2 && <button style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }} onClick={() => delOpt(q.id, o.id)}><Icon name="x" size={14} /></button>}
                </div>
              ))}
            </div>
            {!locked && q.type === 'single_choice' && <button style={{ ...ghost, minHeight: 30, marginTop: 8, fontSize: 12 }} onClick={() => addOpt(q.id)}>+ ตัวเลือก</button>}
          </div>
        ))}
      </div>
      {!locked && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button style={ghost} onClick={() => setQuestions((qs) => [...qs, newQuestion('single_choice')])}>+ คำถามปรนัย</button>
          <button style={ghost} onClick={() => setQuestions((qs) => [...qs, newQuestion('yes_no')])}>+ คำถามถูก/ผิด</button>
        </div>
      )}
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
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>ผู้ที่เคยทำแล้วจะถูกเปิดรอบใหม่ (ผลเดิมยังบันทึกในประวัติสมรรถนะ)</div>
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
