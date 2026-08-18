'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { StatusBadge } from './StatusBadge'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { StickyScroll } from '@/components/ui/StickyScroll'
import { calcResult, isNoIncidentRate, isPass, getThaiMonthLabel, getFiscalMonths } from '@/lib/kpi-utils'
import { getKpiTargetLabel } from '@/lib/kpi/annual-labels'
import { buildKpiSavePayload, type KpiEntryFormValue } from '@/lib/kpi/entry-save'
import { isKpiEntryComplete } from '@/lib/kpi/entry-completeness'
import { canEditKpiPeriod, getCurrentKpiPeriod, getPreviousKpiPeriod } from '@/lib/kpi/period-validation'
import { createRequestGuard, type RequestGuard } from '@/lib/kpi/request-guard'
import type { Department, KpiDefinition, VwKpiDashboardRow } from '@/lib/supabase/types'

interface Config {
  canEditAll: boolean
  isAdmin: boolean
  assignedDeptIds: number[]
  exclusions: string[] // "dept_id|kpi_id"
}

interface EntryStatusRow {
  dept_id: number
  dept_code: string
  dept_name: string
  months: Record<number, { filled: number; required: number }>
}

type FieldVals = Record<number, KpiEntryFormValue>

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

function isFormValueComplete(def: KpiDefinition, value: KpiEntryFormValue | undefined): boolean {
  if (!value || value.numerator.trim() === '') return false
  const numerator = Number(value.numerator)
  const denominator = def.denominator === null || value.denominator.trim() === ''
    ? null
    : Number(value.denominator)
  return isKpiEntryComplete(numerator, denominator, def)
}

function targetLabel(def: KpiDefinition): string {
  return getKpiTargetLabel(def)
}

export function KpiInputForm() {
  const [config, setConfig] = useState<Config | null>(null)
  const [depts, setDepts] = useState<Department[]>([])
  const [defs, setDefs] = useState<KpiDefinition[]>([])
  const [year, setYear] = useState(() => getPreviousKpiPeriod().fiscalYear)
  const [month, setMonth] = useState(() => getPreviousKpiPeriod().month)
  const [deptId, setDeptId] = useState<number | null>(null)
  const [values, setValues] = useState<FieldVals>({})
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rowLoading, setRowLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<EntryStatusRow[]>([])
  const { toasts, add } = useToast()
  const rowRequestGuard = useRef<RequestGuard | null>(null)
  if (rowRequestGuard.current === null) rowRequestGuard.current = createRequestGuard()

  // Departments this user may fill
  const editableDepts = useMemo(() => {
    if (!config) return []
    if (config.canEditAll) return depts
    const allowed = new Set(config.assignedDeptIds)
    return depts.filter((d) => allowed.has(d.id))
  }, [config, depts])

  const excludedSet = useMemo(() => new Set(config?.exclusions ?? []), [config])
  const isExcluded = useCallback((dId: number | null, kId: number) => dId != null && excludedSet.has(`${dId}|${kId}`), [excludedSet])
  const currentPeriod = getCurrentKpiPeriod()
  const periodLocked = !canEditKpiPeriod(config?.isAdmin ?? false, year, month)
  const sections = useMemo(() => {
    const known = new Set(SECTIONS.map((section) => section.key))
    const extras: { key: string; title: string }[] = []
    for (const def of defs) {
      const key = sectionKey(def)
      if (known.has(key) || extras.some((section) => section.key === key)) continue
      extras.push({ key, title: `${def.category} — ตัวชี้วัดจากการตั้งค่า` })
    }
    return [...SECTIONS, ...extras]
  }, [defs])

  // Initial load
  useEffect(() => {
    Promise.all([
      fetch('/kpi/api/config').then((r) => r.json()),
      fetch('/kpi/api/departments').then((r) => r.json()),
      fetch('/kpi/api/definitions').then((r) => r.json()),
    ]).then(([c, d, k]) => {
      const cfg: Config = { canEditAll: !!c?.canEditAll, isAdmin: !!c?.isAdmin, assignedDeptIds: c?.assignedDeptIds ?? [], exclusions: c?.exclusions ?? [] }
      setConfig(cfg)
      const deptList: Department[] = Array.isArray(d) ? d : []
      setDepts(deptList)
      setDefs(Array.isArray(k) ? k : [])
      const editable = cfg.canEditAll ? deptList : deptList.filter((x) => cfg.assignedDeptIds.includes(x.id))
      if (editable.length > 0) setDeptId(editable[0].id)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const statusRequestId = useRef(0)
  const loadStatus = useCallback(() => {
    const requestId = ++statusRequestId.current
    fetch(`/kpi/api/entries/status?year=${year}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        // Ignore out-of-order responses (e.g. the initial mount fetch resolving
        // after a later post-save fetch) so a stale response can't clobber fresh status.
        if (requestId === statusRequestId.current) setStatus(Array.isArray(d) ? d : [])
      })
      .catch(() => {})
  }, [year])

  useEffect(() => { loadStatus() }, [loadStatus])

  // Load entries for current dept/month
  useEffect(() => {
    if (!deptId) return
    setRowLoading(true)
    const deptCode = depts.find((d) => d.id === deptId)?.code ?? ''
    const request = rowRequestGuard.current!.begin()
    fetch(`/kpi/api/entries?year=${year}&month=${month}&dept=${deptCode}`, { signal: request.signal })
      .then((r) => r.json())
      .then((entries: VwKpiDashboardRow[]) => {
        if (!rowRequestGuard.current!.isCurrent(request.id)) return
        const init: FieldVals = {}
        for (const def of defs) {
          const entry = Array.isArray(entries) ? entries.find((e) => e.kpi_code === def.code) : undefined
          init[def.id] = {
            numerator: entry?.numerator != null ? String(entry.numerator) : '',
            denominator: def.denominator !== null && entry?.denominator != null ? String(entry.denominator) : '',
          }
        }
        setValues(init)
        setDirty(false)
      })
      .catch(() => {})
      .finally(() => {
        if (rowRequestGuard.current!.isCurrent(request.id)) setRowLoading(false)
      })

    return () => rowRequestGuard.current?.cancel()
  }, [deptId, year, month, defs, depts])

  // Guarded switching (warn if dirty)
  const guardSwitch = useCallback((action: () => void) => {
    if (dirty && !confirm('มีข้อมูลที่ยังไม่บันทึก ต้องการเปลี่ยนโดยไม่บันทึกหรือไม่?')) return
    action()
  }, [dirty])

  function setField(kpiId: number, field: 'numerator' | 'denominator', v: string) {
    if (periodLocked) return
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
    const filled = applicable.filter((d) => isFormValueComplete(d, values[d.id]))
    return { filled: filled.length, total: applicable.length }
  }, [defs, values, deptId, isExcluded])

  async function handleSubmit() {
    if (!deptId) return
    if (periodLocked) {
      add('งวดเดือนนี้ยังไม่สิ้นสุด ยังไม่สามารถบันทึกข้อมูลได้', false)
      return
    }
    setSaving(true)
    try {
      const payload = buildKpiSavePayload(
        defs.filter((def) => !isExcluded(deptId, def.id)),
        values,
        { dept_id: deptId, fiscal_year: year, month },
      )

      const res = await fetch('/kpi/api/entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
        currentMonth={currentPeriod.month}
        currentFiscalYear={currentPeriod.fiscalYear}
        fiscalYear={year}
        selectedDeptId={deptId}
        selectedMonth={month}
        canPick={(dId) => config?.canEditAll || (config?.assignedDeptIds.includes(dId) ?? false)}
        isMine={(dId) => config?.assignedDeptIds.includes(dId) ?? false}
        isPeriodLocked={(m) => !canEditKpiPeriod(config?.isAdmin ?? false, year, m)}
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
          <MonthSelector
            value={month}
            onChange={(m) => guardSwitch(() => setMonth(m))}
            isMonthDisabled={(m) => !canEditKpiPeriod(config?.isAdmin ?? false, year, m)}
          />
          <div style={{ marginLeft: 'auto' }}>
            <Button variant="primary" icon="check" onClick={handleSubmit} disabled={saving || !dirty || periodLocked}>
              {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </Button>
          </div>
        </div>
        {periodLocked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 12 }}>
            <Icon name="lock" size={13} />
            งวดเดือน {getThaiMonthLabel(month)} ยังไม่สิ้นสุด — จะเปิดให้กรอกเมื่อขึ้นเดือนถัดไป
          </div>
        )}
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
        sections.map((section) => {
          const sectionDefs = defs.filter((d) => sectionKey(d) === section.key)
          if (sectionDefs.length === 0) return null
          const applicable = sectionDefs.filter((d) => !isExcluded(deptId, d.id))
          const doneCount = applicable.filter((d) => isFormValueComplete(d, values[d.id])).length
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
                    locked={periodLocked}
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

function KpiRow({ def, val, excluded, locked, last, onChange }: {
  def: KpiDefinition
  val: { numerator: string; denominator: string }
  excluded: boolean
  locked: boolean
  last: boolean
  onChange: (field: 'numerator' | 'denominator', v: string) => void
}) {
  const [touched, setTouched] = useState(false)
  const hasDen = def.denominator !== null
  const num = parseFloat(val.numerator)
  const den = hasDen ? parseFloat(val.denominator) : null
  const result = !isNaN(num) ? calcResult(num, den != null && !isNaN(den) ? den : null) : null
  const noIncident = hasDen && isNoIncidentRate(
    !isNaN(num) ? num : null,
    den != null && !isNaN(den) ? den : null,
  )
  const pass = isPass(
    result,
    def.target_type ?? '',
    def.target_val ?? 0,
    !isNaN(num) ? num : undefined,
    def.denominator === null,
  )
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
              disabled={locked}
              onChange={(e) => onChange('numerator', e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="จำนวน" aria-label={`${def.name_th} จำนวน`}
              style={{ ...inputStyle, background: locked ? 'var(--surface-2)' : 'var(--card)', cursor: locked ? 'not-allowed' : 'text' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
            />
          </div>
          <div>
            {hasDen ? (
              <>
                <input
                  type="number" inputMode="numeric" value={val.denominator}
                  disabled={locked}
                  onChange={(e) => onChange('denominator', e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="ทั้งหมด" aria-label={`${def.name_th} จำนวนทั้งหมด`}
                  style={{ ...inputStyle, background: locked ? 'var(--surface-2)' : 'var(--card)', cursor: locked ? 'not-allowed' : 'text' }}
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
          <div
            title={noIncident ? 'ไม่มีอุบัติการณ์ (0/0) จึงไม่ประเมินผล' : undefined}
            style={{ textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: noIncident ? 'var(--muted)' : 'var(--ink)' }}
          >
            {noIncident ? 'N/A' : result !== null ? `${result}${def.unit ?? '%'}` : '—'}
          </div>
          <div style={{ textAlign: 'center' }}>
            <StatusBadge pass={pass} emptyLabel={noIncident ? 'ไม่ประเมิน' : undefined} />
          </div>
        </>
      )}
    </div>
  )
}

function EntryStatusMatrix({ status, currentMonth, currentFiscalYear, fiscalYear, selectedDeptId, selectedMonth, canPick, isMine, isPeriodLocked, onPick }: {
  status: EntryStatusRow[]
  currentMonth: number
  currentFiscalYear: number
  fiscalYear: number
  selectedDeptId: number | null
  selectedMonth: number
  canPick: (deptId: number) => boolean
  isMine: (deptId: number) => boolean
  isPeriodLocked: (month: number) => boolean
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
                <th key={m} style={{ ...th, minWidth: 44, color: fiscalYear === currentFiscalYear && m === currentMonth ? 'var(--primary)' : 'var(--muted)', opacity: isPeriodLocked(m) ? 0.55 : 1 }}>{getThaiMonthLabel(m)}</th>
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
                    const periodLocked = isPeriodLocked(m)
                    const clickable = pickable && !periodLocked
                    let bg = 'transparent'; let content: React.ReactNode = '—'; let color = 'var(--muted)'
                    if (cell.required === 0) { content = '—' }
                    else if (cell.filled === 0) { content = '—'; color = '#CBD5E1' }
                    else if (cell.filled >= cell.required) { content = <Icon name="check" size={13} />; color = 'var(--success)'; bg = 'rgba(22,163,74,.10)' }
                    else { content = `${cell.filled}/${cell.required}`; color = 'var(--warning)'; bg = 'rgba(217,119,6,.10)' }
                    return (
                      <td
                        key={m}
                        onClick={clickable ? () => onPick(row.dept_id, m) : undefined}
                        title={periodLocked ? 'ยังไม่ถึงงวดเดือนนี้ ไม่สามารถกรอกล่วงหน้าได้' : cell.required > 0 ? `กรอกแล้ว ${cell.filled}/${cell.required}` : 'ไม่มีตัวชี้วัด'}
                        style={{
                          padding: '5px 6px', textAlign: 'center', color, background: isSelected ? 'var(--primary-soft)' : bg,
                          cursor: clickable ? 'pointer' : 'default', opacity: periodLocked ? 0.55 : 1,
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
