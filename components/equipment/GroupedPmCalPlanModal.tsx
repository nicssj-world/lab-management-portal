'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { CALENDAR_MONTH_LABELS_TH, compareByFiscalMonth, FISCAL_MONTH_ORDER, lastDayOfFiscalMonth } from '@/lib/equipment/pm-cal-domain'
import { calculateGroupPlannedAmount, type PlanGroupDraft, type PriceMode } from '@/lib/equipment/pm-cal-groups'

export interface PmCalEquipmentChoice {
  id: string; cbh_code: string | null; equipment_type: string; department: string
  classification: string | null; needs_calibration: boolean; status: string
}
export interface PmCalExistingPlan { equipment_id: string; plan_group_id: string | null; fiscal_year: number; calendar_month: number; cal_type: 'PM' | 'CAL'; record_status: 'active' | 'cancelled' }

export interface EditablePlanGroup extends Omit<PlanGroupDraft, 'actual_amount'> { id?: string; version?: number; actual_amount: number | null }

const EQUIPMENT_PICKER_PAGE_SIZE = 30

export function GroupedPmCalPlanModal({ fiscalYear, initialDraft, equipment, activePlans, onClose, onSaved }: {
  fiscalYear: number; initialDraft?: EditablePlanGroup; equipment: PmCalEquipmentChoice[]; activePlans: PmCalExistingPlan[]
  onClose(): void; onSaved(): Promise<void> | void
}) {
  const [form, setForm] = useState<EditablePlanGroup>(() => initialDraft ?? {
    fiscal_year: fiscalYear, group_name: '', plan_name: '', cal_type: 'CAL', calendar_month: 9,
    due_date: lastDayOfFiscalMonth(fiscalYear, 9), provider: null, price_mode: 'per_unit', unit_price: 0,
    planned_amount: 0, actual_amount: null, equipment_ids: [], status: 'draft',
  })
  // Only meaningful when creating (no form.id): lets one save spin off sibling groups in other
  // months, for PM/CAL that legitimately happens more than once a year (e.g. quarterly CAL).
  // Editing an existing group always targets a single month (form.calendar_month).
  const [selectedMonths, setSelectedMonths] = useState<number[]>(() => [initialDraft?.calendar_month ?? 9])
  function toggleMonth(month: number) {
    // Sorted in fiscal order (Oct..Sep), not numeric order — otherwise picking Oct+Jan would make
    // Jan (numerically 1, but fiscally later) the "primary" month instead of Oct.
    const next = selectedMonths.includes(month) ? selectedMonths.filter(value => value !== month) : [...selectedMonths, month].sort(compareByFiscalMonth)
    const finalMonths = next.length ? next : selectedMonths
    setSelectedMonths(finalMonths)
    const primary = finalMonths[0]
    setForm(prev => ({ ...prev, calendar_month: primary, due_date: lastDayOfFiscalMonth(fiscalYear, primary) }))
  }
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase('th'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selected = useMemo(() => new Set(form.equipment_ids), [form.equipment_ids])
  // PM recurs monthly by design, so only the same month counts as a conflict. CAL is meant to
  // happen once a year per equipment (unless deliberately scheduled more via selectedMonths above),
  // so any existing active CAL plan blocks selection regardless of its month — otherwise picking a
  // different month here would create a second, unplanned, overlapping CAL schedule.
  const conflictingMonth = useMemo(() => {
    const map = new Map<string, number>()
    for (const plan of activePlans) {
      if (plan.record_status !== 'active' || plan.fiscal_year !== fiscalYear || plan.cal_type !== form.cal_type || plan.plan_group_id === form.id) continue
      if (form.cal_type === 'PM' && !selectedMonths.includes(plan.calendar_month)) continue
      map.set(plan.equipment_id, plan.calendar_month)
    }
    return map
  }, [activePlans, fiscalYear, form.cal_type, form.id, selectedMonths])
  const conflicting = useMemo(() => new Set(conflictingMonth.keys()), [conflictingMonth])
  const [deptFilter, setDeptFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const departments = useMemo(() => [...new Set(equipment.map(item => item.department))].sort((a, b) => a.localeCompare(b, 'th')), [equipment])
  const classifications = useMemo(() => [...new Set(equipment.map(item => item.classification).filter((value): value is string => !!value))].sort((a, b) => a.localeCompare(b, 'th')), [equipment])
  // `equipment` now includes retired/non-calibrated items too (so the workspace table can show
  // real names on their existing plan rows) — only offer eligible equipment as NEW picks here, but
  // never hide an already-selected member, or editing a group could silently drop it on save.
  const visible = useMemo(() => equipment.filter(item => {
    if (!selected.has(item.id) && (!item.needs_calibration || item.status !== 'Active')) return false
    if (deptFilter && item.department !== deptFilter) return false
    if (classFilter && item.classification !== classFilter) return false
    if (!deferredQuery) return true
    return `${item.cbh_code ?? ''} ${item.equipment_type} ${item.department}`.toLocaleLowerCase('th').includes(deferredQuery)
  }), [equipment, deferredQuery, deptFilter, classFilter, selected])
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(visible.length / EQUIPMENT_PICKER_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = useMemo(() => visible.slice((safePage - 1) * EQUIPMENT_PICKER_PAGE_SIZE, safePage * EQUIPMENT_PICKER_PAGE_SIZE), [visible, safePage])
  const total = calculateGroupPlannedAmount(form.price_mode, form.price_mode === 'per_unit' ? Number(form.unit_price ?? 0) : Number(form.planned_amount), selected.size)
  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit' }
  const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block' }
  const pillButton = (active: boolean): React.CSSProperties => ({ padding: '8px 12px', borderRadius: 999, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', background: active ? 'var(--primary)' : 'var(--card)', color: active ? '#fff' : 'var(--ink)', cursor: 'pointer' })

  function update<K extends keyof EditablePlanGroup>(key: K, value: EditablePlanGroup[K]) {
    setForm(current => ({ ...current, [key]: value }))
  }
  function toggle(id: string) {
    setForm(current => ({ ...current, equipment_ids: current.equipment_ids.includes(id) ? current.equipment_ids.filter(value => value !== id) : [...current.equipment_ids, id] }))
  }
  async function save() {
    if (!form.group_name.trim() || !form.plan_name.trim() || selected.size === 0) { setError('กรุณาระบุชื่อแผนและเลือกเครื่องมืออย่างน้อย 1 เครื่อง'); return }
    if (form.equipment_ids.some(id => conflicting.has(id))) { setError('เครื่องมือที่เลือกบางรายการมีแผนในเดือนนี้แล้ว กรุณาเอารายการที่ซ้ำออก'); return }
    setSaving(true); setError('')
    try {
      const extraMonths = form.id ? [] : selectedMonths.filter(month => month !== form.calendar_month)
      const body = { ...form, planned_amount: total, unit_price: form.price_mode === 'per_unit' ? Number(form.unit_price ?? 0) : null, extra_months: extraMonths.length ? extraMonths : undefined }
      const response = await fetch(form.id ? `/api/admin/equipment/pm-cal/groups/${form.id}` : '/api/admin/equipment/pm-cal/groups', {
        method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'บันทึกแผนกลุ่มไม่สำเร็จ')
      await onSaved(); onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกแผนกลุ่มไม่สำเร็จ') }
    finally { setSaving(false) }
  }

  return <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(15,23,42,.64)', display: 'grid', placeItems: 'center', padding: 16 }}>
    <div style={{ width: 'min(980px,100%)', maxHeight: '94vh', overflow: 'auto', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 70px rgba(15,23,42,.28)' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', justifyContent: 'space-between', gap: 12, padding: '16px 20px', background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
        <div><div style={{ fontWeight: 800, fontSize: 17 }}>{form.id ? 'แก้ไขแผนแบบกลุ่ม' : 'สร้างแผนแบบกลุ่ม'}</div><div style={{ color: 'var(--muted)', fontSize: 12 }}>ปีงบประมาณ {fiscalYear} · กำหนดครั้งเดียวให้เครื่องมือทั้งหมด</div></div>
        <button onClick={onClose} aria-label="ปิด" style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
      </header>
      <div style={{ padding: 20, display: 'grid', gap: 16 }}>
        {error ? <div style={{ padding: 10, borderRadius: 8, background: '#FEF2F2', color: '#B91C1C' }}>{error}</div> : null}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
          <label style={labelStyle}>กลุ่มแผน<input style={input} value={form.group_name} onChange={e => update('group_name', e.target.value)} placeholder="เช่น 1. ตู้ปลอดเชื้อ" /></label>
          <label style={labelStyle}>ชื่อรายการ<input style={input} value={form.plan_name} onChange={e => update('plan_name', e.target.value)} placeholder="เช่น BSC" /></label>
          <label style={labelStyle}>ประเภท<select style={input} value={form.cal_type} onChange={e => update('cal_type', e.target.value as 'PM' | 'CAL')}><option>CAL</option><option>PM</option></select></label>
          {form.id ? (
            <label style={labelStyle}>เดือน<select style={input} value={form.calendar_month} onChange={e => { const month = Number(e.target.value); setSelectedMonths([month]); setForm(current => ({ ...current, calendar_month: month, due_date: lastDayOfFiscalMonth(fiscalYear, month) })) }}>{FISCAL_MONTH_ORDER.map(month => <option key={month} value={month}>{CALENDAR_MONTH_LABELS_TH[month - 1]}</option>)}</select></label>
          ) : (
            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>เดือน <span style={{ fontWeight: 400 }}>(เลือกได้หลายเดือน ถ้าต้อง PM/CAL มากกว่า 1 ครั้งต่อปี)</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {FISCAL_MONTH_ORDER.map(month => {
                  const active = selectedMonths.includes(month)
                  return <button key={month} type="button" onClick={() => toggleMonth(month)} style={{ padding: '6px 11px', borderRadius: 999, border: '1px solid var(--border)', background: active ? 'var(--primary)' : 'var(--card)', color: active ? '#fff' : 'var(--ink)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}>{CALENDAR_MONTH_LABELS_TH[month - 1]}</button>
                })}
              </div>
            </label>
          )}
          <label style={labelStyle}>วันครบกำหนด<input type="date" style={input} value={form.due_date} onChange={e => update('due_date', e.target.value)} /></label>
          <label style={labelStyle}>ผู้ให้บริการ<input style={input} value={form.provider ?? ''} onChange={e => update('provider', e.target.value || null)} /></label>
        </section>
        <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: 'var(--card)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {([['per_unit', 'ราคาต่อหน่วย'], ['lump_sum', 'ราคาเหมารวม']] as [PriceMode, string][]).map(([mode, label]) => <button key={mode} onClick={() => setForm(current => ({ ...current, price_mode: mode, unit_price: mode === 'per_unit' ? (current.unit_price ?? 0) : null }))} style={pillButton(form.price_mode === mode)}>{label}</button>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
            {form.price_mode === 'per_unit' ? <label style={labelStyle}>ราคาต่อหน่วย<input type="number" min="0" style={input} value={form.unit_price ?? 0} onChange={e => update('unit_price', Number(e.target.value))} /></label> : <label style={labelStyle}>ยอดเหมารวม<input type="number" min="0" style={input} value={form.planned_amount} onChange={e => update('planned_amount', Number(e.target.value))} /></label>}
            <label style={labelStyle}>ค่าใช้จ่ายจริงทั้งกลุ่ม<input type="number" min="0" style={input} value={form.actual_amount ?? ''} onChange={e => update('actual_amount', e.target.value === '' ? null : Number(e.target.value))} /></label>
            <div style={{ padding: '9px 12px', borderRadius: 9, background: 'var(--surface-2)' }}><div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>งบประมาณ</div><strong style={{ fontSize: 20, color: 'var(--primary)' }}>฿{total.toLocaleString()}</strong></div>
          </div>
        </section>
        <section style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--card)' }}>
          <div style={{ padding: 14, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div><strong style={{ fontSize: 14 }}>เลือกเครื่องมือ</strong><div style={{ fontSize: 12, color: 'var(--muted)' }}>จำนวนแผน {selected.size} เครื่อง · พบ {visible.length} รายการ</div></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select aria-label="กรองตามแผนก" style={{ ...input, width: 170 }} value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1) }}><option value="">ทุกแผนก</option>{departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}</select>
              <select aria-label="กรองตาม classification" style={{ ...input, width: 170 }} value={classFilter} onChange={e => { setClassFilter(e.target.value); setPage(1) }}><option value="">ทุก Classification</option>{classifications.map(cls => <option key={cls} value={cls}>{cls}</option>)}</select>
              <input aria-label="ค้นหาเครื่องมือ" style={{ ...input, width: 280 }} value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} placeholder="ค้นหารหัส ชื่อ หรือแผนก" />
            </div>
          </div>
          <div style={{ maxHeight: 310, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 8, padding: 10, contentVisibility: 'auto' }}>
            {paged.map(item => <label key={item.id} style={{ display: 'flex', gap: 9, padding: 10, borderRadius: 9, border: `1px solid ${selected.has(item.id) ? 'var(--primary)' : 'var(--border)'}`, background: selected.has(item.id) ? 'color-mix(in srgb, var(--primary) 7%, var(--card))' : 'var(--card)', cursor: conflicting.has(item.id) ? 'not-allowed' : 'pointer', opacity: conflicting.has(item.id) ? .55 : 1 }}><input type="checkbox" checked={selected.has(item.id)} disabled={conflicting.has(item.id)} onChange={() => toggle(item.id)} /><span><strong style={{ fontSize: 13 }}>{item.equipment_type}</strong><span style={{ display: 'block', fontSize: 11, color: 'var(--primary)' }}>{item.cbh_code ?? 'ยังไม่มีรหัส'}</span><span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{item.department}{conflicting.has(item.id) ? ` · มีแผน ${form.cal_type} เดือน ${conflictingMonth.get(item.id)} แล้ว` : ''}</span></span></label>)}
          </div>
          {totalPages > 1 ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 10, borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', background: 'var(--card)', cursor: safePage <= 1 ? 'not-allowed' : 'pointer', opacity: safePage <= 1 ? .5 : 1 }}>‹ ก่อนหน้า</button>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>หน้า {safePage} / {totalPages}</span>
            <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', background: 'var(--card)', cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', opacity: safePage >= totalPages ? .5 : 1 }}>ถัดไป ›</button>
          </div> : null}
        </section>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>ยกเลิก</button><button onClick={save} disabled={saving} style={{ padding: '9px 18px', border: 0, borderRadius: 8, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1 }}>{saving ? 'กำลังบันทึก…' : 'บันทึกแผนกลุ่ม'}</button></div>
      </div>
    </div>
  </div>
}
