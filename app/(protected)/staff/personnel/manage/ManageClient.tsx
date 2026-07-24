'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Icon } from '@/components/ui/Icon'
import { DEPARTMENTS } from '@/lib/validations/user-schema'
import type { DeptRole } from '@/lib/supabase/types'

export type ManageRow = {
  id: string
  name: string
  dept: string | null
  dept_role: DeptRole | null
  is_section_head: boolean
  position_title: string | null
  role: string
}
export type CompStat = { overdue: number; dueSoon: number }
export type WorkGroup = { id: string; name: string | null; depts: string[]; created_by: string | null; created_at: string }

type BulkType = 'authorizations' | 'training-plan' | 'competencies'

const GROUP_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '— (ไม่ใช่ระดับกลุ่มงาน)' },
  { value: 'group_lead', label: 'หัวหน้ากลุ่มงานเทคนิคการแพทย์' },
  { value: 'group_deputy', label: 'รองหัวหน้ากลุ่มงานเทคนิคการแพทย์' },
]
const ROLE_TYPE_OPTIONS = [
  { value: 'performer', label: 'ผู้ปฏิบัติ (Performer)' },
  { value: 'reporter', label: 'ผู้รายงานผล (Reporter)' },
  { value: 'approver', label: 'ผู้อนุมัติ (Approver)' },
  { value: 'authorized_signatory', label: 'ผู้ลงนามรับรอง' },
  { value: 'deputy', label: 'ผู้ปฏิบัติแทน (Deputy)' },
]

const input: React.CSSProperties = { minHeight: 38, width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }
const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }
const th: React.CSSProperties = { padding: '9px 12px', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '9px 12px', fontSize: 13, color: 'var(--ink)', verticalAlign: 'middle' }
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, padding: '0 12px', borderRadius: 8, border: 0, background: 'var(--primary)', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const ghost: React.CSSProperties = { ...btn, background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--border)' }

const CSS = `
@keyframes mgRise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.mg-rise{opacity:0;animation:mgRise .38s cubic-bezier(.22,1,.36,1) forwards}
.mg-row{transition:background .12s ease}
.mg-row:hover{background:var(--surface-2)}
@media(prefers-reduced-motion:reduce){.mg-rise{animation:none;opacity:1}}
`

const BULK_TITLE: Record<BulkType, string> = {
  authorizations: 'มอบสิทธิทำการตรวจ',
  'training-plan': 'กำหนดแผนอบรม',
  competencies: 'ประเมิน/กำหนดสมรรถนะ',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{label}</span>{children}</label>
}

export function ManageClient({ rows: initialRows, categories, compStats, workGroups: initialGroups }: { rows: ManageRow[]; categories: string[]; compStats: Record<string, CompStat>; workGroups: WorkGroup[] }) {
  const [rows, setRows] = useState(initialRows)
  const [groups, setGroups] = useState(initialGroups)
  const [depts, setDepts] = useState<Set<string>>(() => new Set([DEPARTMENTS[0]]))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulk, setBulk] = useState<BulkType | null>(null)

  const deptRows = useMemo(() => rows.filter((r) => r.dept != null && depts.has(r.dept)), [rows, depts])
  const multiDept = depts.size > 1
  const colCount = multiDept ? 5 : 4
  const selectedIds = useMemo(() => deptRows.filter((r) => selected.has(r.id)).map((r) => r.id), [deptRows, selected])
  const deptComp = useMemo(() => deptRows.reduce((acc, r) => {
    const s = compStats[r.id]
    if (s) { acc.overdue += s.overdue; acc.dueSoon += s.dueSoon }
    return acc
  }, { overdue: 0, dueSoon: 0 }), [deptRows, compStats])

  async function patchRole(id: string, body: Record<string, unknown>, apply: (r: ManageRow) => ManageRow) {
    setBusyId(id); setError('')
    try {
      const res = await fetch('/api/admin/personnel/manage/dept-role', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: id, ...body }),
      })
      if (!res.ok) throw new Error((await res.json())?.error ?? 'บันทึกไม่สำเร็จ')
      setRows((prev) => prev.map((r) => (r.id === id ? apply(r) : r)))
    } catch (e) { setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ') } finally { setBusyId(null) }
  }
  const setGroupRole = (id: string, value: string) => {
    const deptRole = (value || null) as DeptRole | null
    return patchRole(id, { deptRole }, (r) => ({ ...r, dept_role: deptRole }))
  }
  const setSectionHead = (id: string, isSectionHead: boolean) =>
    patchRole(id, { isSectionHead }, (r) => ({ ...r, is_section_head: isSectionHead }))

  async function mergeSelectedDepts() {
    setError('')
    const chosen = [...depts]
    if (chosen.length < 2) { setError('เลือกอย่างน้อยสองงานเพื่อรวม'); return }
    try {
      const res = await fetch('/api/admin/personnel/manage/work-groups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depts: chosen }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'รวมงานไม่สำเร็จ')
      setGroups((prev) => [...prev, data])
    } catch (e) { setError(e instanceof Error ? e.message : 'รวมงานไม่สำเร็จ') }
  }
  async function deleteGroup(id: string) {
    if (!confirm('ยกเลิกการรวมงานนี้?')) return
    const res = await fetch(`/api/admin/personnel/manage/work-groups/${id}`, { method: 'DELETE' })
    if (res.ok) setGroups((prev) => prev.filter((g) => g.id !== id))
    else setError('ลบไม่สำเร็จ')
  }

  function toggleDept(d: string) {
    setDepts((prev) => { const next = new Set(prev); next.has(d) ? next.delete(d) : next.add(d); return next })
  }
  function toggle(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  function toggleAll() {
    setSelected((prev) => {
      const allSelected = deptRows.every((r) => prev.has(r.id))
      const next = new Set(prev)
      for (const r of deptRows) allSelected ? next.delete(r.id) : next.add(r.id)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{CSS}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <PageHeader eyebrow="กลุ่มงานเทคนิคการแพทย์" title="จัดการกลุ่มงาน" subtitle="กำหนดหัวหน้างานและมอบหมายงานให้บุคลากรในแต่ละงาน" marginBottom={0} />
        <Link href="/staff/personnel/team-org" style={{ ...ghost, textDecoration: 'none' }}>
          <Icon name="users" size={15} /> ผังองค์กรกลุ่มงาน
        </Link>
      </div>

      {error && <div role="alert" style={{ padding: 10, borderRadius: 8, background: '#FEF2F2', color: '#B91C1C', fontSize: 13 }}>{error}</div>}

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>เลือกงาน — เลือกได้หลายงานเพื่อรวมจัดการพร้อมกัน</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {depts.size >= 2 && <button type="button" onClick={mergeSelectedDepts} style={{ ...btn, minHeight: 28, padding: '0 12px', fontSize: 12 }}><Icon name="users" size={13} /> รวม {depts.size} งานเป็นกลุ่ม</button>}
            <button type="button" onClick={() => setDepts(new Set(DEPARTMENTS))} style={{ ...ghost, minHeight: 28, padding: '0 10px', fontSize: 12 }}>เลือกทุกงาน</button>
            <button type="button" onClick={() => setDepts(new Set())} style={{ ...ghost, minHeight: 28, padding: '0 10px', fontSize: 12 }}>ล้าง</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DEPARTMENTS.map((d) => {
            const on = depts.has(d)
            return (
              <button key={d} type="button" onClick={() => toggleDept(d)} aria-pressed={on} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 34, padding: '0 13px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 12.5, fontWeight: 600, transition: 'background .12s, border-color .12s',
                border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                background: on ? 'var(--primary)' : 'var(--card)', color: on ? '#fff' : 'var(--ink)',
              }}>
                {on && <Icon name="check" size={13} />}{d}
              </button>
            )
          })}
        </div>
        {(deptComp.overdue > 0 || deptComp.dueSoon > 0) && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            {deptComp.overdue > 0 && <span style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(220,38,38,.1)', color: '#DC2626', fontSize: 12.5, fontWeight: 600 }}>เกินกำหนดประเมินสมรรถนะ {deptComp.overdue} รายการ</span>}
            {deptComp.dueSoon > 0 && <span style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(217,119,6,.1)', color: '#D97706', fontSize: 12.5, fontWeight: 600 }}>ใกล้ครบกำหนด {deptComp.dueSoon} รายการ</span>}
          </div>
        )}
      </div>

      {groups.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 10 }}>งานที่รวมเป็นกลุ่มเดียวในผังองค์กร</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {groups.map((g) => (
              <span key={g.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 8px 7px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 12.5 }}>
                {g.name ?? g.depts.join(' + ')}
                <button type="button" onClick={() => deleteGroup(g.id)} title="ยกเลิกการรวม" style={{ border: 0, background: 'transparent', color: 'var(--danger)', cursor: 'pointer', display: 'inline-flex' }}><Icon name="x" size={14} /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'var(--surface-2)' }}>
          <strong style={{ fontSize: 13 }}>เลือก {selectedIds.length} คน</strong>
          <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>มอบหมายทีละหลายคน:</span>
          <button style={btn} onClick={() => setBulk('authorizations')}>มอบสิทธิ</button>
          <button style={btn} onClick={() => setBulk('training-plan')}>แผนอบรม</button>
          <button style={btn} onClick={() => setBulk('competencies')}>สมรรถนะ</button>
        </div>
      )}

      <div className="mg-rise" style={{ ...card, padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 36 }}><input type="checkbox" checked={deptRows.length > 0 && deptRows.every((r) => selected.has(r.id))} onChange={toggleAll} /></th>
              <th style={th}>ชื่อ</th>
              {multiDept && <th style={th}>งาน</th>}
              <th style={th}>ตำแหน่ง</th>
              <th style={th}>บทบาทในผังกลุ่มงาน</th>
            </tr>
          </thead>
          <tbody>
            {deptRows.map((r) => (
              <tr key={r.id} className="mg-row" style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={td}><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td style={{ ...td, fontWeight: 600 }}>
                  <Link href={`/staff/personnel/${r.id}`} style={{ color: 'var(--ink)', textDecoration: 'none' }}>{r.name}</Link>
                  {compStats[r.id]?.overdue ? <span title="เกินกำหนดประเมินสมรรถนะ" style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 999, background: 'rgba(220,38,38,.12)', color: '#DC2626', fontSize: 11, fontWeight: 700 }}>เกิน {compStats[r.id].overdue}</span> : null}
                  {compStats[r.id]?.dueSoon ? <span title="ใกล้ครบกำหนดประเมิน" style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 999, background: 'rgba(217,119,6,.12)', color: '#D97706', fontSize: 11, fontWeight: 700 }}>ใกล้ {compStats[r.id].dueSoon}</span> : null}
                </td>
                {multiDept && <td style={{ ...td, color: 'var(--muted)', fontSize: 12 }}>{r.dept}</td>}
                <td style={{ ...td, color: 'var(--muted)' }}>{r.position_title ?? r.role}</td>
                <td style={td}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <select value={r.dept_role ?? ''} disabled={busyId === r.id} onChange={(e) => setGroupRole(r.id, e.target.value)} style={{ ...input, minHeight: 32, maxWidth: 260 }}>
                      {GROUP_ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink)', cursor: busyId === r.id ? 'default' : 'pointer' }}>
                      <input type="checkbox" checked={r.is_section_head} disabled={busyId === r.id} onChange={(e) => setSectionHead(r.id, e.target.checked)} />
                      เป็นหัวหน้างาน ({r.dept ?? '—'})
                    </label>
                  </div>
                </td>
              </tr>
            ))}
            {deptRows.length === 0 && <tr><td colSpan={colCount} style={{ ...td, textAlign: 'center', color: 'var(--muted)' }}>{depts.size === 0 ? 'เลือกงานอย่างน้อยหนึ่งงาน' : 'ไม่มีบุคลากรในงานที่เลือก'}</td></tr>}
          </tbody>
        </table>
      </div>

      {bulk && (
        <BulkModal
          type={bulk}
          count={selectedIds.length}
          categories={categories}
          assessors={deptRows}
          onClose={() => setBulk(null)}
          onDone={(msg) => { setBulk(null); setSelected(new Set()); setError(''); alert(msg) }}
          onError={setError}
          profileIds={selectedIds}
        />
      )}
    </div>
  )
}

function BulkModal({ type, count, categories, assessors, profileIds, onClose, onDone, onError }: {
  type: BulkType; count: number; categories: string[]; assessors: ManageRow[]; profileIds: string[]
  onClose: () => void; onDone: (msg: string) => void; onError: (m: string) => void
}) {
  const yearBe = new Date().getFullYear() + 543
  const [form, setForm] = useState<Record<string, string>>({
    year: String(yearBe), topic: '', source: '', notes: '',
    category: categories[0] ?? '', role_type: 'performer', authorized_date: '',
    assessment_type: 'initial', area: '', assessor_id: '', assessment_date: '', next_due_date: '', result: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  function buildPayload(): Record<string, unknown> | string {
    if (type === 'training-plan') {
      if (!form.topic.trim()) return 'กรุณากรอกหัวข้อ'
      return { year: Number(form.year), topic: form.topic.trim(), source: form.source || null, notes: form.notes || null, status: 'planned' }
    }
    if (type === 'authorizations') {
      if (!form.category) return 'กรุณาเลือกหมวด'
      return { category: form.category, role_type: form.role_type, authorized_date: form.authorized_date || null, notes: form.notes || null, status: 'active' }
    }
    // competencies
    return {
      assessment_type: form.assessment_type, area: form.area || null, assessor_id: form.assessor_id || null,
      assessment_date: form.assessment_date || null, next_due_date: form.next_due_date || null,
      result: form.result || null, notes: form.notes || null,
    }
  }

  async function submit() {
    const payload = buildPayload()
    if (typeof payload === 'string') { onError(payload); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/personnel/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, profileIds, payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'บันทึกไม่สำเร็จ')
      onDone(`บันทึกให้ ${data.count} คนแล้ว`)
    } catch (e) { onError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ'); onClose() } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{BULK_TITLE[type]} · {count} คน</div>
          <button onClick={onClose} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {type === 'training-plan' && <>
            <Field label="ปี (พ.ศ.)"><input type="number" value={form.year} onChange={(e) => set('year', e.target.value)} style={input} /></Field>
            <Field label="หัวข้อการอบรม"><input value={form.topic} onChange={(e) => set('topic', e.target.value)} style={input} /></Field>
            <Field label="ที่มา"><input value={form.source} onChange={(e) => set('source', e.target.value)} placeholder="เช่น แผนประจำปี / competency gap" style={input} /></Field>
            <Field label="หมายเหตุ"><input value={form.notes} onChange={(e) => set('notes', e.target.value)} style={input} /></Field>
          </>}
          {type === 'authorizations' && <>
            <Field label="หมวดรายการตรวจ"><select value={form.category} onChange={(e) => set('category', e.target.value)} style={input}><option value="">— เลือก —</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
            <Field label="บทบาท"><select value={form.role_type} onChange={(e) => set('role_type', e.target.value)} style={input}>{ROLE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
            <Field label="วันที่มอบหมาย"><input type="date" value={form.authorized_date} onChange={(e) => set('authorized_date', e.target.value)} style={input} /></Field>
            <Field label="หมายเหตุ"><input value={form.notes} onChange={(e) => set('notes', e.target.value)} style={input} /></Field>
          </>}
          {type === 'competencies' && <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="ประเภทการประเมิน"><select value={form.assessment_type} onChange={(e) => set('assessment_type', e.target.value)} style={input}><option value="initial">ครั้งแรก</option><option value="periodic">ประเมินซ้ำ</option></select></Field>
              <Field label="ผล"><select value={form.result} onChange={(e) => set('result', e.target.value)} style={input}><option value="">—</option><option value="pass">ผ่าน</option><option value="fail">ไม่ผ่าน</option></select></Field>
            </div>
            <Field label="หัวข้อสมรรถนะ"><input value={form.area} onChange={(e) => set('area', e.target.value)} style={input} /></Field>
            <Field label="ผู้ประเมิน"><select value={form.assessor_id} onChange={(e) => set('assessor_id', e.target.value)} style={input}><option value="">—</option>{assessors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="วันที่ประเมิน"><input type="date" value={form.assessment_date} onChange={(e) => set('assessment_date', e.target.value)} style={input} /></Field>
              <Field label="ครบกำหนดครั้งถัดไป"><input type="date" value={form.next_due_date} onChange={(e) => set('next_due_date', e.target.value)} style={input} /></Field>
            </div>
            <Field label="หมายเหตุ"><input value={form.notes} onChange={(e) => set('notes', e.target.value)} style={input} /></Field>
          </>}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={ghost}>ยกเลิก</button>
          <button onClick={submit} disabled={saving} style={btn}>{saving ? 'กำลังบันทึก…' : `บันทึกให้ ${count} คน`}</button>
        </div>
      </div>
    </div>
  )
}
