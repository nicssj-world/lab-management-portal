'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'
import { computePmCalPlanState, type PmCalPlanState } from '@/lib/equipment/pm-cal-domain'
import { LEGACY_CALIBRATION_TEMPLATE, type PlanGroup, type PlanGroupDraft } from '@/lib/equipment/pm-cal-groups'
import type { Equipment } from '@/lib/queries/equipment'
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
  const [individualId, setIndividualId] = useState('')

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
  useEffect(() => {
    if (mode !== 'legacy' || legacy.length) return
    fetch('/api/admin/equipment/calplan').then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length) setLegacy(data)
      else setLegacy(LEGACY_CALIBRATION_TEMPLATE.map(row => ({ group_name: row.group_name, name: row.plan_name, plan: 0, actual: null, price: row.unit_price, budget: row.planned_amount })))
    }).catch(() => setLegacy(LEGACY_CALIBRATION_TEMPLATE.map(row => ({ group_name: row.group_name, name: row.plan_name, plan: 0, actual: null, price: row.unit_price, budget: row.planned_amount }))))
  }, [legacy.length, mode])

  const equipmentById = useMemo(() => new Map((payload?.equipment ?? []).map(item => [item.id, item])), [payload?.equipment])
  const resultsByPlan = useMemo(() => {
    const map = new Map<string, Result[]>()
    for (const result of payload?.results ?? []) if (result.plan_id) map.set(result.plan_id, [...(map.get(result.plan_id) ?? []), result])
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
  const tab = (active: boolean): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: active ? 'var(--primary)' : 'var(--card)', color: active ? '#fff' : 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit' })
  if (mode === 'legacy') return <div style={{ display: 'grid', gap: 14 }}>
    <div style={{ display: 'flex', gap: 8 }}><button style={tab(false)} onClick={() => setMode('current')}>แผนตามปีงบประมาณ</button><button style={tab(true)}>Legacy ปี 2566</button></div>
    <div style={{ padding: 10, borderRadius: 8, background: '#FFF7ED', color: '#9A3412', fontSize: 12 }}>ข้อมูล Legacy ใช้เป็นแม่แบบและดูย้อนหลังเท่านั้น ไม่รวมในยอดปีปัจจุบัน</div>
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}><thead><tr style={{ background: 'var(--surface-2)' }}>{['กลุ่ม', 'รายการ', 'แผน', 'ทำจริง', 'ราคา', 'งบประมาณ'].map(x => <th key={x} style={{ padding: 10, textAlign: 'left' }}>{x}</th>)}</tr></thead><tbody>{legacy.map((row, index) => <tr key={row.id ?? `${row.group_name}-${row.name}-${index}`} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: 10 }}>{row.group_name}</td><td>{row.name}</td><td>{row.plan}</td><td>{row.actual ?? '—'}</td><td>{row.price == null ? 'เหมา' : `฿${Number(row.price).toLocaleString()}`}</td><td>฿{Number(row.budget).toLocaleString()}</td></tr>)}</tbody></table></div>
  </div>

  const groups = payload?.groups ?? []
  const ungrouped = (payload?.plans ?? []).filter(plan => !plan.plan_group_id)
  const summary = groups.reduce((sum, group) => ({ plan: sum.plan + (payload?.plans ?? []).filter(plan => plan.plan_group_id === group.id).length, budget: sum.budget + Number(group.planned_amount), actual: sum.actual + Number(group.actual_amount ?? 0) }), { plan: ungrouped.length, budget: 0, actual: 0 })
  return <div style={{ display: 'grid', gap: 14 }}>
    <div style={{ display: 'flex', gap: 8 }}><button style={tab(true)}>แผนตามปีงบประมาณ</button><button style={tab(false)} onClick={() => setMode('legacy')}>Legacy ปี 2566</button></div>
    <section style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap', padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)' }}>
      <label style={{ fontSize: 12 }}>ปีงบประมาณ<input type="number" min="2500" max="3000" value={fiscalYearText} onChange={e => setFiscalYearText(e.target.value)} style={{ display: 'block', width: 130, marginTop: 4, padding: 8, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)' }} /></label>
      {canEdit ? <><button style={tab(false)} onClick={() => void loadDrafts('legacy_template')} disabled={!validYear}>เริ่มจากแม่แบบเดิม</button><label style={{ fontSize: 12 }}>ปีต้นทาง<input type="number" min="2500" max="3000" value={copyYear} onChange={e => setCopyYear(Number(e.target.value))} style={{ display: 'block', width: 120, marginTop: 4, padding: 8, border: '1px solid var(--border)', borderRadius: 8 }} /></label><button style={tab(false)} onClick={() => void loadDrafts('fiscal_year')} disabled={!validYear}>คัดลอกจากแผนปีก่อน</button><button style={tab(true)} onClick={() => { setEditing(undefined); setModalOpen(true) }}>+ สร้างแผนแบบกลุ่ม</button><select aria-label="เลือกเครื่องมือสำหรับแผนรายเครื่อง" value={individualId} onChange={e => setIndividualId(e.target.value)} style={{ padding: 8, border: '1px solid var(--border)', borderRadius: 8, maxWidth: 230 }}><option value="">เลือกเครื่องมือรายเครื่อง</option>{(payload?.equipment ?? []).map(item => <option key={item.id} value={item.id}>{item.cbh_code ?? '—'} · {item.equipment_type}</option>)}</select><button style={tab(false)} disabled={!individualId} onClick={() => void openIndividual(individualId)}>เพิ่มแผนรายเครื่องมือ</button></> : null}
    </section>
    {!validYear ? <div style={{ color: '#B91C1C' }}>ปีงบประมาณต้องอยู่ระหว่าง 2500–3000</div> : null}{error ? <div style={{ color: '#B91C1C' }}>{error}</div> : null}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>{[['จำนวนแผน', summary.plan], ['งบประมาณ', `฿${summary.budget.toLocaleString()}`], ['ใช้จริงแบบกลุ่ม', `฿${summary.actual.toLocaleString()}`]].map(([label, value]) => <div key={String(label)} style={{ padding: 13, border: '1px solid var(--border)', borderRadius: 11, background: 'var(--card)' }}><strong style={{ fontSize: 20, color: 'var(--primary)' }}>{value}</strong><div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div></div>)}</div>
    {drafts.length ? <section style={{ padding: 14, borderRadius: 12, background: '#FFFBEB', border: '1px solid #FDE68A' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><div><strong>แบบร่างสำหรับปีงบ {fiscalYear}</strong><div style={{ fontSize: 12, color: '#92400E' }}>เลือก “ตั้งค่า” เพื่อเลือกเครื่องมือก่อนบันทึกจริง</div></div><button onClick={() => setDrafts([])}>ล้างแบบร่าง</button></div><div style={{ display: 'grid', gap: 7 }}>{drafts.map((draft, index) => <div key={`${draft.group_name}-${draft.plan_name}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: 9, background: 'var(--card)', borderRadius: 8 }}><span><strong>{draft.plan_name}</strong><span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{draft.group_name}</span></span><button onClick={() => { setEditing(draft); setModalOpen(true) }}>ตั้งค่า</button></div>)}</div></section> : null}
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 850 }}><thead><tr style={{ background: 'var(--surface-2)' }}>{['กลุ่ม', 'รายการ', 'แผน', 'ทำจริง', 'ราคา', 'งบประมาณ', 'ใช้จริง', 'จัดการ'].map(label => <th key={label} style={{ padding: 10, textAlign: 'left', fontSize: 12 }}>{label}</th>)}</tr></thead><tbody>
      {loading ? <tr><td colSpan={8} style={{ padding: 28, textAlign: 'center' }}>กำลังโหลด…</td></tr> : groups.map(group => {
        const members = (payload?.plans ?? []).filter(plan => plan.plan_group_id === group.id)
        const completed = members.filter(plan => computePmCalPlanState(plan, resultsByPlan.get(plan.id) ?? []) === 'completed').length
        return <tr key={group.id} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: 10 }}>{group.group_name}</td><td><strong>{group.plan_name}</strong><div style={{ fontSize: 11, color: 'var(--muted)' }}>{group.cal_type} · เดือน {group.calendar_month} · {group.provider || 'ยังไม่ระบุผู้ให้บริการ'}</div></td><td>{members.length}</td><td>{completed}</td><td>{group.price_mode === 'per_unit' ? `฿${Number(group.unit_price).toLocaleString()}/เครื่อง` : 'ราคาเหมา'}</td><td>฿{Number(group.planned_amount).toLocaleString()}</td><td>{group.actual_amount == null ? '—' : `฿${Number(group.actual_amount).toLocaleString()}`}</td><td>{canEdit ? <div style={{ display: 'flex', gap: 6 }}><button onClick={() => editGroup(group)}>แก้ไข</button><button onClick={() => void cancelGroup(group)} style={{ color: '#B91C1C' }}>ยกเลิกกลุ่ม</button></div> : '—'}</td></tr>
      })}
      {ungrouped.map(plan => { const item = equipmentById.get(plan.equipment_id); const state = computePmCalPlanState(plan, resultsByPlan.get(plan.id) ?? []); return <tr key={plan.id} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: 10 }}>รายเครื่อง</td><td><strong>{item?.equipment_type ?? plan.equipment_id}</strong><div style={{ fontSize: 11, color: 'var(--muted)' }}>{item?.cbh_code ?? '—'} · {stateLabel[state]}</div></td><td>1</td><td>{state === 'completed' ? 1 : 0}</td><td>รายเครื่อง</td><td>—</td><td>—</td><td><button onClick={() => void openIndividual(plan.equipment_id)}>ดู PM/CAL</button></td></tr> })}
      {!loading && groups.length === 0 && ungrouped.length === 0 ? <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>ยังไม่มีแผนในปีงประมาณนี้ เลือกแม่แบบเดิม คัดลอกปีก่อน หรือสร้างใหม่ได้</td></tr> : null}
    </tbody></table></div>
    {modalOpen && payload ? <GroupedPmCalPlanModal fiscalYear={fiscalYear} initialDraft={editing} equipment={payload.equipment} activePlans={payload.plans} onClose={() => setModalOpen(false)} onSaved={async () => { setDrafts([]); await load() }} /> : null}
    {individual ? <EquipmentPmCalModal item={individual} canEdit={canEdit} onClose={() => setIndividual(null)} onSaved={() => void load()} /> : null}
  </div>
}
