'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { StickyScroll } from '@/components/ui/StickyScroll'
import type { Department, KpiDefinition } from '@/lib/supabase/types'

interface UserRow { id: string; name: string | null; role: string | null }
interface Assignee { dept_id: number; user_id: string }
interface Exclusion { dept_id: number; kpi_id: number }

function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([])
  const counter = useRef(0)
  const add = useCallback((msg: string, ok = true) => {
    const id = ++counter.current
    setToasts((t) => [...t, { id, msg, ok }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  return { toasts, add }
}

export function KpiSettingsClient() {
  const [depts, setDepts] = useState<Department[]>([])
  const [defs, setDefs] = useState<KpiDefinition[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [excluded, setExcluded] = useState<Set<string>>(new Set()) // "dept_id|kpi_id"
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [defModal, setDefModal] = useState<{ mode: 'new' } | { mode: 'edit'; def: KpiDefinition } | null>(null)
  const { toasts, add } = useToast()

  useEffect(() => {
    Promise.all([
      fetch('/kpi/api/departments').then((r) => r.json()),
      fetch('/kpi/api/definitions').then((r) => r.json()),
      fetch('/kpi/api/settings').then((r) => r.json()),
    ]).then(([d, k, s]) => {
      setDepts(Array.isArray(d) ? d : [])
      setDefs(Array.isArray(k) ? k : [])
      setUsers(Array.isArray(s?.users) ? s.users : [])
      setAssignees(Array.isArray(s?.assignees) ? s.assignees : [])
      setExcluded(new Set((s?.exclusions ?? []).map((e: Exclusion) => `${e.dept_id}|${e.kpi_id}`)))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  function toggleAssignee(deptId: number, userId: string) {
    setAssignees((prev) => {
      const exists = prev.some((a) => a.dept_id === deptId && a.user_id === userId)
      return exists
        ? prev.filter((a) => !(a.dept_id === deptId && a.user_id === userId))
        : [...prev, { dept_id: deptId, user_id: userId }]
    })
  }

  function toggleExclusion(deptId: number, kpiId: number) {
    setExcluded((prev) => {
      const next = new Set(prev)
      const key = `${deptId}|${kpiId}`
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function save() {
    setSaving(true)
    try {
      const exclusions = Array.from(excluded).map((k) => {
        const [dept_id, kpi_id] = k.split('|').map(Number)
        return { dept_id, kpi_id }
      })
      const res = await fetch('/kpi/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignees, exclusions }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'บันทึกไม่สำเร็จ')
      }
      add('บันทึกการตั้งค่าสำเร็จ ✓', true)
    } catch (e) {
      add(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด', false)
    } finally {
      setSaving(false)
    }
  }

  // ── Definition CRUD (immediate, own API calls) ──────────────────
  function upsertDefInState(def: KpiDefinition) {
    setDefs((prev) => {
      const exists = prev.some((d) => d.id === def.id)
      const next = exists ? prev.map((d) => (d.id === def.id ? def : d)) : [...prev, def]
      return next.sort((a, b) => a.sort_order - b.sort_order)
    })
  }

  async function handleSaveDef(payload: Record<string, unknown>, id?: number) {
    const res = await fetch(id ? `/kpi/api/definitions/${id}` : '/kpi/api/definitions', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { add(j.error ?? 'บันทึกตัวชี้วัดไม่สำเร็จ', false); return }
    upsertDefInState(j as KpiDefinition)
    add(id ? 'แก้ไขตัวชี้วัดสำเร็จ ✓' : 'เพิ่มตัวชี้วัดสำเร็จ ✓', true)
    setDefModal(null)
  }

  async function handleDeleteDef(def: KpiDefinition) {
    if (!confirm(`ลบตัวชี้วัด "${def.name_th}" ?\nการลบจะมีผลทันที`)) return
    const res = await fetch(`/kpi/api/definitions/${def.id}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { add(j.error ?? 'ลบไม่สำเร็จ', false); return }
    setDefs((prev) => prev.filter((d) => d.id !== def.id))
    setExcluded((prev) => {
      const next = new Set(prev)
      for (const k of next) if (k.endsWith(`|${def.id}`)) next.delete(k)
      return next
    })
    add('ลบตัวชี้วัดสำเร็จ ✓', true)
  }

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Definitions manager */}
      <Card padding={24}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Icon name="chart" size={18} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>จัดการตัวชี้วัด KPI</h3>
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>เพิ่ม แก้ไข หรือลบตัวชี้วัด — การเปลี่ยนแปลงมีผลกับทุกแผนกและทุกหน้าจอทันที</p>
          </div>
          <Button variant="primary" size="sm" icon="plus" onClick={() => setDefModal({ mode: 'new' })}>เพิ่มตัวชี้วัด</Button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {defs.map((def) => (
            <div key={def.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: '10px 14px', background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                  {def.sub_code ? <span style={{ color: 'var(--muted)', marginRight: 6 }}>{def.sub_code}</span> : null}
                  {def.name_th}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {def.code} · {def.category} · เป้า {def.target_type === 'eq' ? '=' : def.target_type === 'gte' ? '≥' : '≤'} {def.target_val}{def.unit ?? '%'}
                  {def.denominator !== null ? ' · คำนวณ %' : ' · นับจำนวน'}
                </div>
              </div>
              <button onClick={() => setDefModal({ mode: 'edit', def })} title="แก้ไข" aria-label="แก้ไข"
                style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                <Icon name="edit" size={15} />
              </button>
              <button onClick={() => handleDeleteDef(def)} title="ลบ" aria-label="ลบ"
                style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
                <Icon name="trash" size={15} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Assignees */}
      <Card padding={24}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Icon name="users" size={18} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>ผู้ได้รับมอบหมายกรอก KPI</h3>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--muted)' }}>
          เลือกผู้กรอกรายแผนก — ผู้ที่มีสิทธิ์ KPI (แก้ไข) กรอกได้ทุกแผนกอยู่แล้ว
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {depts.map((dept) => (
            <AssigneeRow
              key={dept.id}
              dept={dept}
              users={users}
              selected={assignees.filter((a) => a.dept_id === dept.id).map((a) => a.user_id)}
              userMap={userMap}
              onToggle={(uid) => toggleAssignee(dept.id, uid)}
            />
          ))}
        </div>
      </Card>

      {/* Exclusions matrix */}
      <Card padding={0}>
        <div style={{ padding: '20px 24px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Icon name="filter" size={18} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>ตัวชี้วัดที่แต่ละแผนกต้องกรอก</h3>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
            ติ๊ก = แผนกต้องกรอก · เอาติ๊กออก = ไม่เกี่ยวข้อง (ช่องกรอกจะถูกล็อก)
          </p>
        </div>
        <StickyScroll>
          <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--border)', position: 'sticky', left: 0, background: 'var(--surface-2)', zIndex: 2, whiteSpace: 'nowrap', minWidth: 220 }}>
                  ตัวชี้วัด
                </th>
                {depts.map((d) => (
                  <th key={d.id} title={d.name_th} style={{ padding: '8px 6px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', minWidth: 52 }}>
                    {d.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {defs.map((def) => (
                <tr key={def.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 16px', color: 'var(--ink)', position: 'sticky', left: 0, background: 'var(--card)', zIndex: 1, whiteSpace: 'nowrap', borderRight: '1px solid var(--border)' }}>
                    <span style={{ fontWeight: 600 }}>{def.sub_code ?? ''}</span> {def.name_th}
                  </td>
                  {depts.map((d) => {
                    const key = `${d.id}|${def.id}`
                    const required = !excluded.has(key)
                    return (
                      <td key={d.id} style={{ padding: '6px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={required}
                          onChange={() => toggleExclusion(d.id, def.id)}
                          aria-label={`${d.code} · ${def.name_th}`}
                          style={{ width: 17, height: 17, cursor: 'pointer', accentColor: 'var(--primary)' }}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </StickyScroll>
      </Card>

      <div style={{ position: 'sticky', bottom: 0, display: 'flex', justifyContent: 'flex-end', padding: '12px 0', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
        <Button variant="primary" icon="check" onClick={save} disabled={saving}>
          {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </Button>
      </div>

      {/* Definition add/edit modal */}
      {defModal && (
        <DefinitionModal
          def={defModal.mode === 'edit' ? defModal.def : null}
          onClose={() => setDefModal(null)}
          onSave={handleSaveDef}
        />
      )}

      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 2000 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ padding: '10px 16px', borderRadius: 8, fontSize: 13, color: '#fff', background: t.ok ? 'var(--success)' : 'var(--danger)', boxShadow: '0 8px 24px rgba(0,0,0,.2)' }}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
  fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block',
}

function DefinitionModal({ def, onClose, onSave }: {
  def: KpiDefinition | null
  onClose: () => void
  onSave: (payload: Record<string, unknown>, id?: number) => Promise<void>
}) {
  const [code, setCode] = useState(def?.code ?? '')
  const [nameTh, setNameTh] = useState(def?.name_th ?? '')
  const [category, setCategory] = useState<'TAT' | 'ERROR' | 'RISK'>((def?.category as 'TAT' | 'ERROR' | 'RISK') ?? 'TAT')
  const [subCode, setSubCode] = useState(def?.sub_code ?? '')
  const [unit, setUnit] = useState(def?.unit ?? '%')
  const [targetType, setTargetType] = useState<'gte' | 'lte' | 'eq'>(def?.target_type ?? 'gte')
  const [targetVal, setTargetVal] = useState(def ? String(def.target_val) : '')
  const [hasDen, setHasDen] = useState(def ? def.denominator !== null : true)
  const [denLabel, setDenLabel] = useState(def?.denominator ?? 'จำนวนทั้งหมด')
  const [sortOrder, setSortOrder] = useState(def ? String(def.sort_order) : '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    setErr('')
    if (!def && !/^[A-Z0-9_]+$/.test(code.trim())) { setErr('รหัส (code) ใช้ได้เฉพาะ A-Z, 0-9 และ _'); return }
    if (!nameTh.trim()) { setErr('กรุณากรอกชื่อตัวชี้วัด'); return }
    const tv = parseFloat(targetVal)
    if (isNaN(tv)) { setErr('กรุณากรอกค่าเป้าหมายเป็นตัวเลข'); return }
    const payload: Record<string, unknown> = {
      category, sub_code: subCode.trim() || null, name_th: nameTh.trim(),
      unit: unit.trim() || null, target_type: targetType, target_val: tv,
      denominator: hasDen ? (denLabel.trim() || 'จำนวนทั้งหมด') : null,
    }
    if (sortOrder.trim() !== '') payload.sort_order = parseInt(sortOrder, 10)
    if (!def) payload.code = code.trim().toUpperCase()
    setSaving(true)
    await onSave(payload, def?.id)
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{def ? 'แก้ไขตัวชี้วัด' : 'เพิ่มตัวชี้วัด'}</div>
          <button onClick={onClose} aria-label="ปิด" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><Icon name="x" size={18} /></button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', fontSize: 13 }}>{err}</div>}

          <div>
            <label style={labelStyle}>ชื่อตัวชี้วัด (ไทย) <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input style={inputStyle} value={nameTh} onChange={(e) => setNameTh(e.target.value)} placeholder="เช่น Routine LAB ทันเวลา" autoFocus />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>รหัส (code) <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                style={{ ...inputStyle, textTransform: 'uppercase', opacity: def ? 0.6 : 1 }}
                value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="เช่น TAT_ROUTINE" disabled={!!def}
              />
              {def && <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 3 }}>แก้รหัสไม่ได้หลังสร้างแล้ว</div>}
            </div>
            <div>
              <label style={labelStyle}>หมวด</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={category} onChange={(e) => setCategory(e.target.value as 'TAT' | 'ERROR' | 'RISK')}>
                <option value="TAT">TAT (ความทันเวลา)</option>
                <option value="ERROR">ERROR (ความคลาดเคลื่อน)</option>
                <option value="RISK">RISK (ความเสี่ยง)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>เลขข้อ (sub-code)</label>
              <input style={inputStyle} value={subCode} onChange={(e) => setSubCode(e.target.value)} placeholder="เช่น 1.5" />
            </div>
            <div>
              <label style={labelStyle}>ลำดับการแสดง</label>
              <input type="number" style={inputStyle} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="เว้นว่าง = ต่อท้าย" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>เงื่อนไขเป้า</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={targetType} onChange={(e) => setTargetType(e.target.value as 'gte' | 'lte' | 'eq')}>
                <option value="gte">≥ (มากกว่าเท่ากับ)</option>
                <option value="lte">≤ (น้อยกว่าเท่ากับ)</option>
                <option value="eq">= (เท่ากับ)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>ค่าเป้า <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="number" style={inputStyle} value={targetVal} onChange={(e) => setTargetVal(e.target.value)} placeholder="เช่น 95" />
            </div>
            <div>
              <label style={labelStyle}>หน่วย</label>
              <input style={inputStyle} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="% หรือ ครั้ง" />
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>
              <input type="checkbox" checked={hasDen} onChange={(e) => setHasDen(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }} />
              คำนวณเป็นร้อยละ (มีตัวตั้ง / ตัวหาร)
            </label>
            {hasDen ? (
              <div style={{ marginTop: 8 }}>
                <label style={labelStyle}>ป้ายกำกับตัวหาร</label>
                <input style={inputStyle} value={denLabel} onChange={(e) => setDenLabel(e.target.value)} placeholder="เช่น จำนวนส่งตรวจทั้งหมด" />
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>นับจำนวนอย่างเดียว (เช่น จำนวนครั้งของอุบัติการณ์)</div>
            )}
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
          <Button variant="primary" icon="check" onClick={submit} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
        </div>
      </div>
    </div>
  )
}

function AssigneeRow({ dept, users, selected, userMap, onToggle }: {
  dept: Department
  users: UserRow[]
  selected: string[]
  userMap: Map<string, UserRow>
  onToggle: (userId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users
      .filter((u) => !q || (u.name ?? '').toLowerCase().includes(q) || (u.role ?? '').toLowerCase().includes(q))
  }, [users, search])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, alignItems: 'start' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', paddingTop: 8 }}>
        {dept.name_th}
        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>{dept.code}</span>
      </div>
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <div
          onClick={() => setOpen(true)}
          style={{ minHeight: 40, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'text' }}
        >
          {selected.map((uid) => (
            <span key={uid} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 14, background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: 12, fontWeight: 600 }}>
              {userMap.get(uid)?.name ?? 'ไม่ทราบชื่อ'}
              <span
                onClick={(e) => { e.stopPropagation(); onToggle(uid) }}
                style={{ cursor: 'pointer', display: 'inline-flex' }}
                aria-label="ลบ"
              >
                <Icon name="x" size={12} />
              </span>
            </span>
          ))}
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
            placeholder={selected.length === 0 ? 'ค้นหาชื่อผู้กรอก...' : ''}
            style={{ flex: 1, minWidth: 120, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)' }}
          />
        </div>
        {open && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 240, overflowY: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 50 }}>
            {matches.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--muted)' }}>ไม่พบผู้ใช้</div>
            ) : matches.map((u) => {
              const isSel = selected.includes(u.id)
              return (
                <div
                  key={u.id}
                  onClick={() => onToggle(u.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--ink)', background: isSel ? 'var(--primary-soft)' : 'transparent' }}
                  onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = 'var(--surface-2)' }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                >
                  <span>{u.name ?? 'ไม่ทราบชื่อ'} <span style={{ color: 'var(--muted)', fontSize: 11 }}>{u.role ?? ''}</span></span>
                  {isSel && <Icon name="check" size={14} />}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
