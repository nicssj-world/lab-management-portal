'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { fiscalYearMonthToCalendarYear } from '@/lib/equipment/pm-cal-domain'
import { calculateGroupPlannedAmount, type PlanGroupDraft, type PriceMode } from '@/lib/equipment/pm-cal-groups'

export interface PmCalEquipmentChoice {
  id: string; cbh_code: string | null; equipment_type: string; department: string
  classification: string | null; needs_calibration: boolean; status: string
}
export interface PmCalExistingPlan { equipment_id: string; plan_group_id: string | null; fiscal_year: number; calendar_month: number; cal_type: 'PM' | 'CAL'; record_status: 'active' | 'cancelled' }

export interface EditablePlanGroup extends Omit<PlanGroupDraft, 'actual_amount'> { id?: string; version?: number; actual_amount: number | null }

function lastDay(fiscalYear: number, month: number) {
  const year = fiscalYearMonthToCalendarYear(fiscalYear, month)
  const day = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function GroupedPmCalPlanModal({ fiscalYear, initialDraft, equipment, activePlans, onClose, onSaved }: {
  fiscalYear: number; initialDraft?: EditablePlanGroup; equipment: PmCalEquipmentChoice[]; activePlans: PmCalExistingPlan[]
  onClose(): void; onSaved(): Promise<void> | void
}) {
  const [form, setForm] = useState<EditablePlanGroup>(() => initialDraft ?? {
    fiscal_year: fiscalYear, group_name: '', plan_name: '', cal_type: 'CAL', calendar_month: 9,
    due_date: lastDay(fiscalYear, 9), provider: null, price_mode: 'per_unit', unit_price: 0,
    planned_amount: 0, actual_amount: null, equipment_ids: [], status: 'draft',
  })
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase('th'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selected = useMemo(() => new Set(form.equipment_ids), [form.equipment_ids])
  const conflicting = useMemo(() => new Set(activePlans.filter(plan => plan.record_status === 'active' && plan.fiscal_year === fiscalYear && plan.calendar_month === form.calendar_month && plan.cal_type === form.cal_type && plan.plan_group_id !== form.id).map(plan => plan.equipment_id)), [activePlans, fiscalYear, form.calendar_month, form.cal_type, form.id])
  const visible = useMemo(() => equipment.filter(item => {
    if (!deferredQuery) return true
    return `${item.cbh_code ?? ''} ${item.equipment_type} ${item.department}`.toLocaleLowerCase('th').includes(deferredQuery)
  }), [equipment, deferredQuery])
  const total = calculateGroupPlannedAmount(form.price_mode, form.price_mode === 'per_unit' ? Number(form.unit_price ?? 0) : Number(form.planned_amount), selected.size)
  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit' }

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
      const body = { ...form, planned_amount: total, unit_price: form.price_mode === 'per_unit' ? Number(form.unit_price ?? 0) : null }
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
          <label>กลุ่มแผน<input style={input} value={form.group_name} onChange={e => update('group_name', e.target.value)} placeholder="เช่น 1. ตู้ปลอดเชื้อ" /></label>
          <label>ชื่อรายการ<input style={input} value={form.plan_name} onChange={e => update('plan_name', e.target.value)} placeholder="เช่น BSC" /></label>
          <label>ประเภท<select style={input} value={form.cal_type} onChange={e => update('cal_type', e.target.value as 'PM' | 'CAL')}><option>CAL</option><option>PM</option></select></label>
          <label>เดือน<select style={input} value={form.calendar_month} onChange={e => { const month = Number(e.target.value); setForm(current => ({ ...current, calendar_month: month, due_date: lastDay(fiscalYear, month) })) }}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
          <label>วันครบกำหนด<input type="date" style={input} value={form.due_date} onChange={e => update('due_date', e.target.value)} /></label>
          <label>ผู้ให้บริการ<input style={input} value={form.provider ?? ''} onChange={e => update('provider', e.target.value || null)} /></label>
        </section>
        <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: 'var(--card)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {([['per_unit', 'ราคาต่อหน่วย'], ['lump_sum', 'ราคาเหมารวม']] as [PriceMode, string][]).map(([mode, label]) => <button key={mode} onClick={() => setForm(current => ({ ...current, price_mode: mode, unit_price: mode === 'per_unit' ? (current.unit_price ?? 0) : null }))} style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid var(--border)', background: form.price_mode === mode ? 'var(--primary)' : 'var(--card)', color: form.price_mode === mode ? '#fff' : 'var(--ink)', cursor: 'pointer' }}>{label}</button>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
            {form.price_mode === 'per_unit' ? <label>ราคาต่อหน่วย<input type="number" min="0" style={input} value={form.unit_price ?? 0} onChange={e => update('unit_price', Number(e.target.value))} /></label> : <label>ยอดเหมารวม<input type="number" min="0" style={input} value={form.planned_amount} onChange={e => update('planned_amount', Number(e.target.value))} /></label>}
            <label>ค่าใช้จ่ายจริงทั้งกลุ่ม<input type="number" min="0" style={input} value={form.actual_amount ?? ''} onChange={e => update('actual_amount', e.target.value === '' ? null : Number(e.target.value))} /></label>
            <div style={{ padding: '9px 12px', borderRadius: 9, background: 'var(--surface-2)' }}><div style={{ fontSize: 11, color: 'var(--muted)' }}>งบประมาณ</div><strong style={{ fontSize: 20, color: 'var(--primary)' }}>฿{total.toLocaleString()}</strong></div>
          </div>
        </section>
        <section style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--card)' }}>
          <div style={{ padding: 14, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><div><strong>เลือกเครื่องมือ</strong><div style={{ fontSize: 12, color: 'var(--muted)' }}>จำนวนแผน {selected.size} เครื่อง</div></div><input aria-label="ค้นหาเครื่องมือ" style={{ ...input, width: 280 }} value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหารหัส ชื่อ หรือแผนก" /></div>
          <div style={{ maxHeight: 310, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 8, padding: 10, contentVisibility: 'auto' }}>
            {visible.map(item => <label key={item.id} style={{ display: 'flex', gap: 9, padding: 10, borderRadius: 9, border: `1px solid ${selected.has(item.id) ? 'var(--primary)' : 'var(--border)'}`, background: selected.has(item.id) ? 'color-mix(in srgb, var(--primary) 7%, var(--card))' : 'var(--card)', cursor: conflicting.has(item.id) ? 'not-allowed' : 'pointer', opacity: conflicting.has(item.id) ? .55 : 1 }}><input type="checkbox" checked={selected.has(item.id)} disabled={conflicting.has(item.id)} onChange={() => toggle(item.id)} /><span><strong style={{ fontSize: 13 }}>{item.equipment_type}</strong><span style={{ display: 'block', fontSize: 11, color: 'var(--primary)' }}>{item.cbh_code ?? 'ยังไม่มีรหัส'}</span><span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{item.department}{conflicting.has(item.id) ? ' · มีแผนเดือนนี้แล้ว' : ''}</span></span></label>)}
          </div>
        </section>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button onClick={onClose} style={{ padding: '9px 16px' }}>ยกเลิก</button><button onClick={save} disabled={saving} style={{ padding: '9px 18px', border: 0, borderRadius: 8, background: 'var(--primary)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{saving ? 'กำลังบันทึก…' : 'บันทึกแผนกลุ่ม'}</button></div>
      </div>
    </div>
  </div>
}
