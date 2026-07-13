'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { StatusBadge } from './StatusBadge'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { StickyScroll } from '@/components/ui/StickyScroll'
import { calcResult, isPass, getCurrentThaiFiscalYear, getThaiMonthLabel, getFiscalMonths } from '@/lib/kpi-utils'
import type { Department, KpiDefinition, VwKpiDashboardRow } from '@/lib/supabase/types'

interface Config {
  canEditAll: boolean
  assignedDeptIds: number[]
  exclusions: string[] // "dept_id|kpi_id"
}

interface EntryStatusRow {
  dept_id: number
  dept_code: string
  dept_name: string
  months: Record<number, { filled: number; required: number }>
}

type FieldVals = Record<number, { numerator: string; denominator: string }>

const SECTIONS: { key: string; title: string }[] = [
  { key: '1', title: '1. อัตราการรายงานผลการตรวจวิเคราะห์ทันเวลา (TAT)' },
  { key: '2', title: '2. การรายงานผลการตรวจวิเคราะห์คลาดเคลื่อนหรือผิดพลาด' },
  { key: '3', title: '3. จำนวนผู้ป่วยได้รับเลือดผิดคน / ผิดหมู่' },
  { key: '4', title: '4. Risk management' },
]

const MONTHS = getFiscalMonths()

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

function sectionKey(def: KpiDefinition): string {
  return (def.sub_code ?? '').split('.')[0] || def.category
}

function targetLabel(def: KpiDefinition): string {
  if (def.target_type === 'eq') return `= ${def.target_val} ${def.unit ?? ''}`.trim()
  const op = def.target_type === 'gte' ? '≥' : '≤'
  return `${op} ${def.target_val}${def.unit ?? '%'}`
}

export function KpiInputForm() {
  const [config, setConfig] = useState<Config | null>(null)
  const [depts, setDepts] = useState<Department[]>([])
  const [defs, setDefs] = useState<KpiDefinition[]>([])
  const [year, setYear] = useState(getCurrentThaiFiscalYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [deptId, setDeptId] = useState<number | null>(null)
  const [values, setValues] = useState<FieldVals>({})
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rowLoading, setRowLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<EntryStatusRow[]>([])
  const { toasts, add } = useToast()

  // Departments this user may fill
  const editableDepts = useMemo(() => {
    if (!config) return []
    if (config.canEditAll) return depts
    const allowed = new Set(config.assignedDeptIds)
    return depts.filter((d) => allowed.has(d.id))
  }, [config, depts])

  const excludedSet = useMemo(() => new Set(config?.exclusions ?? []), [config])
  const isExcluded = useCallback((dId: number | null, kId: number) => dId != null && excludedSet.has(`${dId}|${kId}`), [excludedSet])

  // Initial load
  useEffect(() => {
    Promise.all([
      fetch('/kpi/api/config').then((r) => r.json()),
      fetch('/kpi/api/departments').then((r) => r.json()),
      fetch('/kpi/api/definitions').then((r) => r.json()),
    ]).then(([c, d, k]) => {
      const cfg: Config = { canEditAll: !!c?.canEditAll, assignedDeptIds: c?.assignedDeptIds ?? [], exclusions: c?.exclusions ?? [] }
      setConfig(cfg)
      const deptList: Department[] = Array.isArray(d) ? d : []
      setDepts(deptList)
      setDefs(Array.isArray(k) ? k : [])
      const editable = cfg.canEditAll ? deptList : deptList.filter((x) => cfg.assignedDeptIds.includes(x.id))
      if (editable.length > 0) setDeptId(editable[0].id)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const loadStatus = useCallback(() => {
    fetch(`/kpi/api/entries/status?year=${year}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setStatus(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [year])

  useEffect(() => { loadStatus() }, [loadStatus])

  // Load entries for current dept/month
  useEffect(() => {
    if (!deptId) return
    setRowLoading(true)
    const deptCode = depts.find((d) => d.id === deptId)?.code ?? ''
    fetch(`/kpi/api/entries?year=${year}&month=${month}&dept=${deptCode}`)
      .then((r) => r.json())
      .then((entries: VwKpiDashboardRow[]) => {
        const init: FieldVals = {}
        for (const def of defs) {
          const entry = Array.isArray(entries) ? entries.find((e) => e.kpi_code === def.code) : undefined
          init[def.id] = {
            numerator: entry?.numerator != null ? String(entry.numerator) : '',
            denominator: entry?.denominator != null ? String(entry.denominator) : '',
          }
        }
        setValues(init)
        setDirty(false)
      })
      .finally(() => setRowLoading(false))
  }, [deptId, year, month, defs, depts])

  // Guarded switching (warn if dirty)
  const guardSwitch = useCallback((action: () => void) => {
    if (dirty && !confirm('มีข้อมูลที่ยังไม่บันทึก ต้องการเปลี่ยนโดยไม่บันทึกหรือไม่?')) return
    action()
  }, [dirty])

  function setField(kpiId: number, field: 'numerator' | 'denominator', v: string) {
    setDirty(true)
    setValues((prev) => {
      const next = { ...prev, [kpiId]: { ...prev[kpiId], [field]: v } }
      // Auto-fill ERR_REPORT denominator from TAT_ROUTINE denominator when empty
      if (field === 'denominator') {
        const routine = defs.find((d) => d.code === 'TAT_ROUTINE')
        const err = defs.find((d) => d.code === 'ERR_REPORT')
        if (routine && err && kpiId === routine.id) {
          const errVal = next[err.id]?.denominator ?? ''
          if (!errVal && !isExcluded(deptId, err.id)) {
            next[err.id] = { ...next[err.id], denominator: v }
          }
        }
      }
      return next
    })
  }

  const progress = useMemo(() => {
    const applicable = defs.filter((d) => !isExcluded(deptId, d.id))
    const filled = applicable.filter((d) => (values[d.id]?.numerator ?? '') !== '')
    return { filled: filled.length, total: applicable.length }
  }, [defs, values, deptId, isExcluded])

  async function handleSubmit() {
    if (!deptId) return
    setSaving(true)
    try {
      const entries = defs
        .filter((def) => !isExcluded(deptId, def.id))
        .map((def) => {
          const v = values[def.id] ?? { numerator: '', denominator: '' }
          if (v.numerator === '') return null
          const num = parseFloat(v.numerator) || 0
          const den = def.denominator !== null ? (parseFloat(v.denominator) || null) : null
          return { dept_id: deptId, kpi_id: def.id, fiscal_year: year, month, numerator: num, denominator: den }
        })
        .filter((e): e is NonNullable<typeof e> => e !== null)

      const res = await fetch('/kpi/api/entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'บันทึกไม่สำเร็จ')
      }
      setDirty(false)
      add('บันทึกสำเร็จ ✓', true)
      loadStatus()
    } catch (e) {
      add(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง', false)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด...</div>
  }

  if (editableDepts.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
        คุณยังไม่ได้รับมอบหมายให้กรอก KPI ของแผนกใด — ติดต่อผู้ดูแลระบบ
      </div>
    )
  }

  const pct = progress.total > 0 ? Math.round((progress.filled / progress.total) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Status matrix */}
      <EntryStatusMatrix
        status={status}
        currentMonth={new Date().getMonth() + 1}
        selectedDeptId={deptId}
        selectedMonth={month}
        canPick={(dId) => config?.canEditAll || (config?.assignedDeptIds.includes(dId) ?? false)}
        isMine={(dId) => config?.assignedDeptIds.includes(dId) ?? false}
        onPick={(dId, m) => guardSwitch(() => { setDeptId(dId); setMonth(m) })}
      />

      {/* Sticky header: selectors + progress */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--card)', padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>ปีงบ</span>
            <input
              type="number" value={year}
              onChange={(e) => guardSwitch(() => setYear(Number(e.target.value)))}
              min="2560" max="2999" step="1"
              style={{ width: 88, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--card)', color: 'var(--ink)', outline: 'none' }}
            />
          </div>
          <select
            value={deptId ?? ''}
            onChange={(e) => { const v = Number(e.target.value); guardSwitch(() => setDeptId(v)) }}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer' }}
          >
            {editableDepts.map((d) => <option key={d.id} value={d.id}>{d.name_th}</option>)}
          </select>
          <MonthSelector value={month} onChange={(m) => guardSwitch(() => setMonth(m))} />
          <div style={{ marginLeft: 'auto' }}>
            <Button variant="primary" icon="check" onClick={handleSubmit} disabled={saving || !dirty}>
              {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </Button>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--success)' : 'var(--primary)', transition: 'width .2s' }} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            กรอกแล้ว {progress.filled}/{progress.total} ตัวชี้วัด
          </span>
        </div>
      </div>

      {/* Sections */}
      {rowLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ height: 56, borderRadius: 10, background: 'var(--surface-2)' }} />
          ))}
        </div>
      ) : (
        SECTIONS.map((section) => {
          const sectionDefs = defs.filter((d) => sectionKey(d) === section.key)
          if (sectionDefs.length === 0) return null
          const applicable = sectionDefs.filter((d) => !isExcluded(deptId, d.id))
          const doneCount = applicable.filter((d) => (values[d.id]?.numerator ?? '') !== '').length
          return (
            <div key={section.key} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '11px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{section.title}</span>
                {applicable.length > 0 && (
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: doneCount === applicable.length ? 'var(--success)' : 'var(--muted)', background: 'var(--card)', padding: '2px 9px', borderRadius: 12, whiteSpace: 'nowrap' }}>
                    {doneCount}/{applicable.length}
                  </span>
                )}
              </div>
              <div>
                {sectionDefs.map((def, idx) => (
                  <KpiRow
                    key={def.id}
                    def={def}
                    val={values[def.id] ?? { numerator: '', denominator: '' }}
                    excluded={isExcluded(deptId, def.id)}
                    last={idx === sectionDefs.length - 1}
                    onChange={(field, v) => setField(def.id, field, v)}
                  />
                ))}
              </div>
            </div>
          )
        })
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

function KpiRow({ def, val, excluded, last, onChange }: {
  def: KpiDefinition
  val: { numerator: string; denominator: string }
  excluded: boolean
  last: boolean
  onChange: (field: 'numerator' | 'denominator', v: string) => void
}) {
  const [touched, setTouched] = useState(false)
  const hasDen = def.denominator !== null
  const num = parseFloat(val.numerator)
  const den = hasDen ? parseFloat(val.denominator) : null
  const result = !isNaN(num) ? calcResult(num, den != null && !isNaN(den) ? den : null) : null
  const pass = (result !== null || def.target_type === 'eq')
    ? isPass(result, def.target_type ?? '', def.target_val ?? 0, !isNaN(num) ? num : undefined)
    : null
  const overflow = hasDen && !isNaN(num) && den != null && !isNaN(den) && num > den

  const inputStyle: React.CSSProperties = {
    width: '100%', minHeight: 44, padding: '9px 12px', borderRadius: 8,
    border: `1px solid ${touched && overflow ? 'var(--danger)' : 'var(--border)'}`,
    fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)',
    boxSizing: 'border-box', outline: 'none',
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '2.2fr 1fr 1fr 0.9fr 0.9fr', gap: 10, alignItems: 'center',
      padding: '10px 16px', borderBottom: last ? 'none' : '1px solid var(--border)',
      background: excluded ? 'var(--surface-2)' : 'transparent',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: excluded ? 'var(--muted)' : 'var(--ink)' }}>
          {excluded && <Icon name="lock" size={13} />}
          <span>{def.sub_code ? `${def.sub_code} ` : ''}{def.name_th}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
          {excluded ? 'ไม่เกี่ยวข้องกับหน่วยงานนี้' : <>Target: {targetLabel(def)}</>}
        </div>
      </div>

      {excluded ? (
        <div style={{ gridColumn: '2 / 6', textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>—</div>
      ) : (
        <>
          <div>
            <input
              type="number" inputMode="numeric" value={val.numerator}
              onChange={(e) => onChange('numerator', e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="จำนวน" aria-label={`${def.name_th} จำนวน`}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
            />
          </div>
          <div>
            {hasDen ? (
              <>
                <input
                  type="number" inputMode="numeric" value={val.denominator}
                  onChange={(e) => onChange('denominator', e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="ทั้งหมด" aria-label={`${def.name_th} จำนวนทั้งหมด`}
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
                />
                {touched && overflow && (
                  <div style={{ fontSize: 10.5, color: 'var(--danger)', marginTop: 3 }}>จำนวนมากกว่าทั้งหมด</div>
                )}
              </>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>
            )}
          </div>
          <div style={{ textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
            {result !== null ? `${result}${def.unit ?? '%'}` : '—'}
          </div>
          <div style={{ textAlign: 'center' }}>
            <StatusBadge pass={pass} />
          </div>
        </>
      )}
    </div>
  )
}

function EntryStatusMatrix({ status, currentMonth, selectedDeptId, selectedMonth, canPick, isMine, onPick }: {
  status: EntryStatusRow[]
  currentMonth: number
  selectedDeptId: number | null
  selectedMonth: number
  canPick: (deptId: number) => boolean
  isMine: (deptId: number) => boolean
  onPick: (deptId: number, month: number) => void
}) {
  if (status.length === 0) return null

  const th: React.CSSProperties = {
    padding: '7px 8px', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)',
    textAlign: 'center', whiteSpace: 'nowrap', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>
        สถานะการกรอกรายแผนก
        <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>คลิกช่องเพื่อไปกรอก</span>
      </div>
      <StickyScroll>
        <table style={{ borderCollapse: 'collapse', fontSize: 11.5, minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left', position: 'sticky', left: 0, zIndex: 2, minWidth: 130 }}>แผนก</th>
              {MONTHS.map((m) => (
                <th key={m} style={{ ...th, minWidth: 44, color: m === currentMonth ? 'var(--primary)' : 'var(--muted)' }}>{getThaiMonthLabel(m)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {status.map((row) => {
              const pickable = canPick(row.dept_id)
              const mine = isMine(row.dept_id)
              return (
                <tr key={row.dept_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{
                    padding: '6px 12px 6px 9px', fontWeight: mine ? 800 : 600, color: 'var(--ink)',
                    position: 'sticky', left: 0, zIndex: 1, whiteSpace: 'nowrap',
                    background: mine ? 'var(--primary-soft)' : 'var(--card)',
                    borderRight: '1px solid var(--border)',
                    borderLeft: mine ? '3px solid var(--primary)' : '3px solid transparent',
                  }}>
                    {row.dept_name}
                    {mine && (
                      <span style={{
                        marginLeft: 7, fontSize: 9.5, fontWeight: 700, color: 'var(--primary)',
                        background: 'var(--card)', border: '1px solid var(--primary)',
                        borderRadius: 20, padding: '1px 6px', verticalAlign: 'middle', whiteSpace: 'nowrap',
                      }}>ของคุณ</span>
                    )}
                  </td>
                  {MONTHS.map((m) => {
                    const cell = row.months[m] ?? { filled: 0, required: 0 }
                    const isSelected = row.dept_id === selectedDeptId && m === selectedMonth
                    let bg = 'transparent'; let content: React.ReactNode = '—'; let color = 'var(--muted)'
                    if (cell.required === 0) { content = '—' }
                    else if (cell.filled === 0) { content = '—'; color = '#CBD5E1' }
                    else if (cell.filled >= cell.required) { content = <Icon name="check" size={13} />; color = 'var(--success)'; bg = 'rgba(22,163,74,.10)' }
                    else { content = `${cell.filled}/${cell.required}`; color = 'var(--warning)'; bg = 'rgba(217,119,6,.10)' }
                    return (
                      <td
                        key={m}
                        onClick={pickable ? () => onPick(row.dept_id, m) : undefined}
                        title={cell.required > 0 ? `กรอกแล้ว ${cell.filled}/${cell.required}` : 'ไม่มีตัวชี้วัด'}
                        style={{
                          padding: '5px 6px', textAlign: 'center', color, background: isSelected ? 'var(--primary-soft)' : bg,
                          cursor: pickable ? 'pointer' : 'default',
                          outline: isSelected ? '2px solid var(--primary)' : 'none', outlineOffset: -2,
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{content}</span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </StickyScroll>
    </div>
  )
}
