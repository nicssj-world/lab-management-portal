'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'
import { computePmCalPlanState, type PmCalPlanState } from '@/lib/equipment/pm-cal-domain'
import { LEGACY_CALIBRATION_TEMPLATE, type PlanGroup, type PlanGroupDraft } from '@/lib/equipment/pm-cal-groups'
import type { Equipment } from '@/lib/queries/equipment'
import { EquipmentDetailModal } from './EquipmentDetailModal'
import { EquipmentPmCalModal } from './EquipmentPmCalModal'
import { GroupedPmCalPlanModal, type EditablePlanGroup, type PmCalEquipmentChoice } from './GroupedPmCalPlanModal'

interface MemberPlan { id: string; equipment_id: string; plan_group_id: string | null; fiscal_year: number; calendar_month: number; cal_type: 'PM' | 'CAL'; due_date: string; record_status: 'active' | 'cancelled'; version: number }
interface Result { id: string; plan_id: string | null; equipment_id: string; cal_type: 'PM' | 'CAL'; completed_date: string | null; result: 'PASS' | 'FAIL' | 'NOT_PERFORMED' | null }
interface Payload { fiscal_year: number; groups: PlanGroup[]; equipment: PmCalEquipmentChoice[]; plans: MemberPlan[]; results: Result[] }
interface LegacyRow { id?: string; group_name: string; name: string; plan: number; actual: number | null; price: number | null; budget: number }

const stateLabel: Record<PmCalPlanState, string> = { completed: 'เสร็จแล้ว', failed: 'FAIL', due_soon: 'ใกล้กำหนด', overdue: 'เกินกำหนด', ok: 'ตามแผน' }

export function PmCalPlanWorkspace({ canEdit }: { canEdit: boolean }) {
  const currentYear = getCurrentThaiFiscalYear()
  const [mode, setMode] = useState<'current' | 'legacy'>('current')
  const [fiscalYearText, setFiscalYearText] = useState(String(currentYear))
  const fiscalYear = Number(fiscalYearText)
  const validYear = Number.isInteger(fiscalYear) && fiscalYear >= 2500 && fiscalYear <= 3000
  const [payload, setPayload] = useState<Payload | null>(null)
  const [drafts, setDrafts] = useState<PlanGroupDraft[]>([])
  const [editing, setEditing] = useState<EditablePlanGroup | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [copyYear, setCopyYear] = useState(currentYear - 1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [legacy, setLegacy] = useState<LegacyRow[]>([])
  const [individual, setIndividual] = useState<Equipment | null>(null)
  const [deptFilter, setDeptFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [completionFilter, setCompletionFilter] = useState<'all' | 'incomplete'>('all')
  const [page, setPage] = useState(1)
  const [detailEquipmentId, setDetailEquipmentId] = useState<string | null>(null)
  const PAGE_SIZE = 30

  const load = useCallback(async () => {
    if (!validYear) return
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/admin/equipment/pm-cal/groups?fiscalYear=${fiscalYear}`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'โหลดแผนไม่สำเร็จ')
      setPayload(json)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'โหลดแผนไม่สำเร็จ') }
    finally { setLoading(false) }
  }, [fiscalYear, validYear])

  useEffect(() => { void load() }, [load])
  // Without this, changing ปีงบประมาณ to a year with fewer pages leaves `page` at its old, now
  // out-of-range value — the display clamps via safePage but "‹ ก่อนหน้า" still decrements the
  // raw (unclamped) page number, so the first click or two visibly does nothing.
  useEffect(() => { setPage(1) }, [fiscalYear])
  useEffect(() => {
    if (mode !== 'legacy' || legacy.length) return
    fetch('/api/admin/equipment/calplan').then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length) setLegacy(data)
      else setLegacy(LEGACY_CALIBRATION_TEMPLATE.map(row => ({ group_name: row.group_name, name: row.plan_name, plan: 0, actual: null, price: row.unit_price, budget: row.planned_amount })))
    }).catch(() => setLegacy(LEGACY_CALIBRATION_TEMPLATE.map(row => ({ group_name: row.group_name, name: row.plan_name, plan: 0, actual: null, price: row.unit_price, budget: row.planned_amount }))))
  }, [legacy.length, mode])

  const equipmentById = useMemo(() => new Map((payload?.equipment ?? []).map(item => [item.id, item])), [payload?.equipment])
  const departments = useMemo(() => [...new Set((payload?.equipment ?? []).map(item => item.department))].sort((a, b) => a.localeCompare(b, 'th')), [payload?.equipment])
  const classifications = useMemo(() => [...new Set((payload?.equipment ?? []).map(item => item.classification).filter((value): value is string => !!value))].sort((a, b) => a.localeCompare(b, 'th')), [payload?.equipment])
  function equipmentMatchesFilter(equipmentId: string) {
    if (!deptFilter && !classFilter) return true
    const item = equipmentById.get(equipmentId)
    if (!item) return false
    if (deptFilter && item.department !== deptFilter) return false
    if (classFilter && item.classification !== classFilter) return false
    return true
  }
  // Grouped by equipment (not plan_id): legacy-imported results are intentionally unlinked
  // (plan_id null), and computePmCalPlanState matches those to a plan by fiscal_year/month/cal_type
  // itself — grouping by plan_id here would filter them out before that matching ever runs, which
  // is exactly what kept "ทำจริง" stuck at 0 despite a completed legacy result existing.
  const resultsByEquipment = useMemo(() => {
    const map = new Map<string, Result[]>()
    for (const result of payload?.results ?? []) map.set(result.equipment_id, [...(map.get(result.equipment_id) ?? []), result])
    return map
  }, [payload?.results])

  async function loadDrafts(source: 'legacy_template' | 'fiscal_year') {
    if (!validYear) return
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ targetFiscalYear: String(fiscalYear), source })
      if (source === 'fiscal_year') params.set('sourceFiscalYear', String(copyYear))
      const response = await fetch(`/api/admin/equipment/pm-cal/drafts?${params}`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'สร้างแบบร่างไม่สำเร็จ')
      setDrafts(json.drafts)
      if (source === 'fiscal_year') {
        window.alert(json.drafts.length ? `พบ ${json.drafts.length} แผนกลุ่มจากปีงบประมาณ ${copyYear} — เลื่อนลงไปกด "ตั้งค่า" เพื่อเลือกเครื่องมือก่อนบันทึกจริง` : `ไม่พบแผนกลุ่มในปีงบประมาณ ${copyYear}`)
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'สร้างแบบร่างไม่สำเร็จ') }
    finally { setLoading(false) }
  }
  function editGroup(group: PlanGroup) {
    const equipment_ids = (payload?.plans ?? []).filter(plan => plan.plan_group_id === group.id).map(plan => plan.equipment_id)
    setEditing({ ...group, actual_amount: group.actual_amount, equipment_ids, status: 'draft' }); setModalOpen(true)
  }
  async function openIndividual(id: string) {
    setError('')
    const response = await fetch(`/api/admin/equipment/${id}`)
    const json = await response.json()
    if (!response.ok) { setError(json.error ?? 'โหลดเครื่องมือไม่สำเร็จ'); return }
    setIndividual(json as Equipment)
  }
  async function cancelGroup(group: PlanGroup) {
    if (!window.confirm(`ยกเลิกกลุ่ม ${group.plan_name}?`)) return
    setError('')
    const response = await fetch(`/api/admin/equipment/pm-cal/groups/${group.id}?version=${group.version}`, { method: 'DELETE' })
    const json = await response.json()
    if (!response.ok) { setError(json.error ?? 'ยกเลิกกลุ่มไม่สำเร็จ'); return }
    await load()
  }
  const tab = (active: boolean): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, background: active ? 'var(--primary)' : 'var(--card)', color: active ? '#fff' : 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit' })
  const cellButton: React.CSSProperties = { padding: '5px 10px', minHeight: 28, borderRadius: 7, border: '1px solid var(--border)', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer', transition: 'background .15s, border-color .15s' }
  const filterPill = (active: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: active ? 'var(--primary-soft)' : 'var(--card)', color: active ? 'var(--primary)' : 'var(--ink)', cursor: 'pointer', transition: 'background .15s, border-color .15s' })
  const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }
  if (mode === 'legacy') return <div style={{ display: 'grid', gap: 14 }}>
    <div style={{ display: 'flex', gap: 8 }}><button style={tab(false)} onClick={() => setMode('current')}>แผนตามปีงบประมาณ</button><button style={tab(true)}>Legacy ปี 2566</button></div>
    <div style={{ padding: 10, borderRadius: 8, background: '#FFF7ED', color: '#9A3412', fontSize: 12 }}>ข้อมูล Legacy ใช้เป็นแม่แบบและดูย้อนหลังเท่านั้น ไม่รวมในยอดปีปัจจุบัน</div>
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}><thead><tr style={{ background: 'var(--surface-2)' }}>{['กลุ่ม', 'รายการ', 'แผน', 'ทำจริง', 'ราคา', 'งบประมาณ'].map(x => <th key={x} style={{ padding: 10, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{x}</th>)}</tr></thead><tbody>{legacy.map((row, index) => <tr key={row.id ?? `${row.group_name}-${row.name}-${index}`} style={{ borderTop: '1px solid var(--border)', transition: 'background .1s' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}><td style={{ padding: '8px 10px', fontSize: 13 }}>{row.group_name}</td><td style={{ padding: '8px 10px', fontSize: 13 }}>{row.name}</td><td style={{ padding: '8px 10px', fontSize: 13 }}>{row.plan}</td><td style={{ padding: '8px 10px', fontSize: 13 }}>{row.actual ?? '—'}</td><td style={{ padding: '8px 10px', fontSize: 13 }}>{row.price == null ? 'เหมา' : `฿${Number(row.price).toLocaleString()}`}</td><td style={{ padding: '8px 10px', fontSize: 13 }}>฿{Number(row.budget).toLocaleString()}</td></tr>)}</tbody></table></div>
  </div>

  const groups = payload?.groups ?? []
  const ungrouped = (payload?.plans ?? []).filter(plan => !plan.plan_group_id)
  const summary = groups.reduce((sum, group) => ({ plan: sum.plan + (payload?.plans ?? []).filter(plan => plan.plan_group_id === group.id).length, budget: sum.budget + Number(group.planned_amount), actual: sum.actual + Number(group.actual_amount ?? 0) }), { plan: ungrouped.length, budget: 0, actual: 0 })
  const ungroupedByEquipment = new Map<string, MemberPlan[]>()
  for (const plan of ungrouped) ungroupedByEquipment.set(plan.equipment_id, [...(ungroupedByEquipment.get(plan.equipment_id) ?? []), plan])
  const statePriority: PmCalPlanState[] = ['overdue', 'failed', 'due_soon', 'ok', 'completed']

  const groupsWithStats = groups.map(group => {
    const members = (payload?.plans ?? []).filter(plan => plan.plan_group_id === group.id)
    const completed = members.filter(plan => computePmCalPlanState(plan, resultsByEquipment.get(plan.equipment_id) ?? []) === 'completed').length
    return { group, members, completed }
  })
  const ungroupedWithStats = [...ungroupedByEquipment.entries()].map(([equipmentId, plans]) => {
    const states = plans.map(plan => computePmCalPlanState(plan, resultsByEquipment.get(plan.equipment_id) ?? []))
    const completed = states.filter(state => state === 'completed').length
    const worst = statePriority.find(state => states.includes(state)) ?? 'ok'
    return { equipmentId, plans, completed, worst }
  })
  // Scoped by the department/classification filters (but not completionFilter itself) so the badge
  // number always matches what "มีแผน ทำจริงยังไม่ครบ" would actually show if clicked right now,
  // instead of a global count that looks wrong the moment a dept/class filter narrows the table.
  const incompleteCount = groupsWithStats.filter(({ members, completed }) => members.some(plan => equipmentMatchesFilter(plan.equipment_id)) && completed < members.length).length
    + ungroupedWithStats.filter(({ equipmentId, plans, completed }) => equipmentMatchesFilter(equipmentId) && completed < plans.length).length

  // Groups first, then ungrouped equipment — one combined 30-row page spanning both sections.
  const filteredGroups = groupsWithStats.filter(({ members, completed }) =>
    members.some(plan => equipmentMatchesFilter(plan.equipment_id)) && (completionFilter !== 'incomplete' || completed < members.length))
  const filteredUngrouped = ungroupedWithStats.filter(({ equipmentId, plans, completed }) =>
    equipmentMatchesFilter(equipmentId) && (completionFilter !== 'incomplete' || completed < plans.length))
  const totalRows = filteredGroups.length + filteredUngrouped.length
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const endIndex = startIndex + PAGE_SIZE
  const pagedGroups = filteredGroups.slice(startIndex, endIndex)
  const pagedUngrouped = filteredUngrouped.slice(Math.max(0, startIndex - filteredGroups.length), Math.max(0, endIndex - filteredGroups.length))
  return <div style={{ display: 'grid', gap: 14 }}>
    <div style={{ display: 'flex', gap: 8 }}><button style={tab(true)}>แผนตามปีงบประมาณ</button><button style={tab(false)} onClick={() => setMode('legacy')}>Legacy ปี 2566</button></div>
    <section style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap', padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)' }}>
      <label style={labelStyle}>ปีงบประมาณ<input type="number" min="2500" max="3000" value={fiscalYearText} onChange={e => setFiscalYearText(e.target.value)} style={{ display: 'block', width: 130, marginTop: 4, padding: 8, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: 'var(--card)', color: 'var(--ink)' }} /></label>
      {canEdit ? <><button style={tab(false)} onClick={() => void loadDrafts('legacy_template')} disabled={!validYear}>เริ่มจากแม่แบบเดิม</button><label style={labelStyle}>ปีต้นทาง<input type="number" min="2500" max="3000" value={copyYear} onChange={e => setCopyYear(Number(e.target.value))} style={{ display: 'block', width: 120, marginTop: 4, padding: 8, border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)' }} /></label><button style={tab(false)} onClick={() => void loadDrafts('fiscal_year')} disabled={!validYear}>คัดลอกจากแผนปีก่อน</button><button style={tab(true)} onClick={() => { setEditing(undefined); setModalOpen(true) }}>+ สร้างแผนแบบกลุ่ม</button></> : null}
    </section>
    {!validYear ? <div style={{ color: '#B91C1C', fontSize: 13 }}>ปีงบประมาณต้องอยู่ระหว่าง 2500–3000</div> : null}{error ? <div style={{ color: '#B91C1C', fontSize: 13 }}>{error}</div> : null}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>{[['จำนวนแผน', summary.plan], ['งบประมาณ', `฿${summary.budget.toLocaleString()}`], ['ใช้จริงแบบกลุ่ม', `฿${summary.actual.toLocaleString()}`]].map(([label, value]) => <div key={String(label)} style={{ padding: 13, border: '1px solid var(--border)', borderRadius: 11, background: 'var(--card)' }}><strong style={{ fontSize: 20, color: 'var(--primary)' }}>{value}</strong><div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{label}</div></div>)}</div>
    {drafts.length ? <section style={{ padding: 14, borderRadius: 12, background: '#FFFBEB', border: '1px solid #FDE68A' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><div><strong style={{ fontSize: 13 }}>แบบร่างสำหรับปีงบ {fiscalYear}</strong><div style={{ fontSize: 12, color: '#92400E' }}>เลือก “ตั้งค่า” เพื่อเลือกเครื่องมือก่อนบันทึกจริง</div></div><button onClick={() => setDrafts([])} style={cellButton} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>ล้างแบบร่าง</button></div><div style={{ display: 'grid', gap: 7 }}>{drafts.map((draft, index) => <div key={`${draft.group_name}-${draft.plan_name}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: 9, background: 'var(--card)', borderRadius: 8 }}><span><strong style={{ fontSize: 13 }}>{draft.plan_name}</strong><span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{draft.group_name}</span></span><button onClick={() => { setEditing(draft); setModalOpen(true) }} style={cellButton} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>ตั้งค่า</button></div>)}</div></section> : null}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <label style={labelStyle}>แผนก<select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1) }} style={{ display: 'block', marginTop: 4, width: 180, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--card)', color: 'var(--ink)' }}><option value="">ทุกแผนก</option>{departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}</select></label>
      <label style={labelStyle}>Classification<select value={classFilter} onChange={e => { setClassFilter(e.target.value); setPage(1) }} style={{ display: 'block', marginTop: 4, width: 180, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--card)', color: 'var(--ink)' }}><option value="">ทุก Classification</option>{classifications.map(cls => <option key={cls} value={cls}>{cls}</option>)}</select></label>
      <div role="group" aria-label="กรองตามความคืบหน้า" style={{ display: 'flex', gap: 6, alignItems: 'end' }}>
        <button type="button" aria-pressed={completionFilter === 'all'} onClick={() => { setCompletionFilter('all'); setPage(1) }} style={filterPill(completionFilter === 'all')}>ทั้งหมด</button>
        <button type="button" aria-pressed={completionFilter === 'incomplete'} onClick={() => { setCompletionFilter('incomplete'); setPage(1) }} style={filterPill(completionFilter === 'incomplete')}>มีแผน ทำจริงยังไม่ครบ{incompleteCount ? <span style={{ padding: '1px 7px', borderRadius: 999, background: completionFilter === 'incomplete' ? 'var(--card)' : 'var(--surface-2)', fontSize: 11 }}>{incompleteCount}</span> : null}</button>
      </div>
    </div>
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)' }}><table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 850 }}><thead><tr style={{ background: 'var(--surface-2)' }}>{([['กลุ่ม', '11%'], ['รายการ', '27%'], ['แผน', '7%'], ['ทำจริง', '8%'], ['ราคา', '12%'], ['งบประมาณ', '12%'], ['ใช้จริง', '10%'], ['จัดการ', '13%']] as [string, string][]).map(([label, width]) => <th key={label} style={{ width, padding: 10, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{label}</th>)}</tr></thead><tbody>
      {loading ? <tr><td colSpan={8} style={{ padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>กำลังโหลด…</td></tr> : pagedGroups.map(({ group, members, completed }) => {
        return <tr key={group.id} style={{ borderTop: '1px solid var(--border)', transition: 'background .1s' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}><td style={{ padding: '8px 10px', fontSize: 13 }}>{group.group_name}</td><td style={{ padding: '8px 10px' }}><strong style={{ fontSize: 13 }}>{group.plan_name}</strong><div style={{ fontSize: 11, color: 'var(--muted)' }}>{group.cal_type} · เดือน {group.calendar_month} · {group.provider || 'ยังไม่ระบุผู้ให้บริการ'}</div></td><td style={{ padding: '8px 10px', fontSize: 13 }}>{members.length}</td><td style={{ padding: '8px 10px', fontSize: 13 }}>{completed}</td><td style={{ padding: '8px 10px', fontSize: 13 }}>{group.price_mode === 'per_unit' ? `฿${Number(group.unit_price).toLocaleString()}/เครื่อง` : 'ราคาเหมา'}</td><td style={{ padding: '8px 10px', fontSize: 13 }}>฿{Number(group.planned_amount).toLocaleString()}</td><td style={{ padding: '8px 10px', fontSize: 13 }}>{group.actual_amount == null ? '—' : `฿${Number(group.actual_amount).toLocaleString()}`}</td><td style={{ padding: '8px 10px' }}>{canEdit ? <div style={{ display: 'flex', gap: 8 }}><button onClick={() => editGroup(group)} style={cellButton} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>แก้ไข</button><button onClick={() => void cancelGroup(group)} style={{ ...cellButton, color: '#B91C1C' }} onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>ยกเลิกกลุ่ม</button></div> : <span style={{ fontSize: 13, color: 'var(--muted)' }}>—</span>}</td></tr>
      })}
      {pagedUngrouped.map(({ equipmentId, plans, completed, worst }) => {
        const item = equipmentById.get(equipmentId)
        return <tr key={equipmentId} style={{ borderTop: '1px solid var(--border)', transition: 'background .1s' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}><td style={{ padding: '8px 10px', fontSize: 13 }}>รายเครื่อง</td><td style={{ padding: '8px 10px' }}><button onClick={() => setDetailEquipmentId(equipmentId)} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}><strong style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'underline', textUnderlineOffset: 2 }}>{item?.equipment_type ?? equipmentId}</strong></button><div style={{ fontSize: 11, color: 'var(--muted)' }}>{item?.cbh_code ?? '—'} · {plans.length} แผน · {stateLabel[worst]}</div></td><td style={{ padding: '8px 10px', fontSize: 13 }}>{plans.length}</td><td style={{ padding: '8px 10px', fontSize: 13 }}>{completed}</td><td style={{ padding: '8px 10px', fontSize: 13 }}>รายเครื่อง</td><td style={{ padding: '8px 10px', fontSize: 13 }}>—</td><td style={{ padding: '8px 10px', fontSize: 13 }}>—</td><td style={{ padding: '8px 10px' }}><button onClick={() => void openIndividual(equipmentId)} style={cellButton} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>ดู PM/CAL</button></td></tr>
      })}
      {!loading && groups.length === 0 && ungrouped.length === 0 ? <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>ยังไม่มีแผนในปีงประมาณนี้ เลือกแม่แบบเดิม คัดลอกปีก่อน หรือสร้างใหม่ได้</td></tr>
        : !loading && totalRows === 0 ? <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>ไม่พบแผนที่ตรงกับตัวกรอง</td></tr> : null}
    </tbody></table></div>
    {!loading && totalPages > 1 ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 4 }}>
      <button type="button" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage <= 1} style={{ ...cellButton, cursor: safePage <= 1 ? 'not-allowed' : 'pointer', opacity: safePage <= 1 ? .5 : 1 }}>‹ ก่อนหน้า</button>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>หน้า {safePage} / {totalPages} · {totalRows} รายการ</span>
      <button type="button" onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages} style={{ ...cellButton, cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', opacity: safePage >= totalPages ? .5 : 1 }}>ถัดไป ›</button>
    </div> : null}
    {modalOpen && payload ? <GroupedPmCalPlanModal fiscalYear={fiscalYear} initialDraft={editing} equipment={payload.equipment} activePlans={payload.plans} onClose={() => setModalOpen(false)} onSaved={async () => { setDrafts([]); await load() }} /> : null}
    {individual ? <EquipmentPmCalModal item={individual} canEdit={canEdit} onClose={() => setIndividual(null)} onSaved={() => void load()} /> : null}
    {detailEquipmentId ? <EquipmentDetailModal equipmentId={detailEquipmentId} onClose={() => setDetailEquipmentId(null)} /> : null}
  </div>
}
