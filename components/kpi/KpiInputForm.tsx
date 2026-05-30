'use client'

import { useState, useEffect } from 'react'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { StatusBadge } from './StatusBadge'
import { Button } from '@/components/ui/Button'
import { calcResult, isPass, getCurrentThaiFiscalYear, getThaiMonthLabel, getFiscalMonths } from '@/lib/kpi-utils'
import type { Department, KpiDefinition, VwKpiDashboardRow } from '@/lib/supabase/types'

export function KpiInputForm() {
  const [depts, setDepts] = useState<Department[]>([])
  const [defs, setDefs] = useState<KpiDefinition[]>([])
  const [year, setYear] = useState(getCurrentThaiFiscalYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [deptId, setDeptId] = useState<number | null>(null)
  const [values, setValues] = useState<Record<number, { numerator: string; denominator: string }>>({})
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/kpi/api/departments').then((r) => r.json()),
      fetch('/kpi/api/definitions').then((r) => r.json()),
    ]).then(([d, k]) => {
      setDepts(Array.isArray(d) ? d : [])
      setDefs(Array.isArray(k) ? k : [])
      if (d.length > 0) setDeptId(d[0].id)
    })
  }, [])

  useEffect(() => {
    if (!deptId) return
    fetch(`/kpi/api/entries?year=${year}&month=${month}&dept=${depts.find((d) => d.id === deptId)?.code ?? ''}`)
      .then((r) => r.json())
      .then((entries: VwKpiDashboardRow[]) => {
        const init: typeof values = {}
        for (const def of defs) {
          const entry = entries.find((e) => e.kpi_code === def.code)
          init[def.id] = {
            numerator: entry?.numerator != null ? String(entry.numerator) : '',
            denominator: entry?.denominator != null ? String(entry.denominator) : '',
          }
        }
        setValues(init)
      })
  }, [deptId, year, month, defs])

  async function handleSubmit() {
    if (!deptId) return
    setLoading(true)
    setError(null)
    try {
      const entries = defs.map((def) => {
        const v = values[def.id] ?? { numerator: '', denominator: '' }
        const num = parseFloat(v.numerator) || 0
        const den = def.denominator !== null ? (parseFloat(v.denominator) || null) : null
        return { dept_id: deptId, kpi_id: def.id, fiscal_year: year, month, numerator: num, denominator: den }
      }).filter((e) => values[e.kpi_id]?.numerator !== '')
      await fetch('/kpi/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries }) })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Selectors */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>ปีงบ</span>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            min="2560" max="2999" step="1"
            style={{ width: 88, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--card)', outline: 'none' }}
          />
        </div>
        <select
          value={deptId ?? ''}
          onChange={(e) => setDeptId(Number(e.target.value))}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--card)', cursor: 'pointer' }}
        >
          {depts.map((d) => <option key={d.id} value={d.id}>{d.name_th}</option>)}
        </select>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {/* Form rows */}
      {defs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {defs.map((def) => {
            const v = values[def.id] ?? { numerator: '', denominator: '' }
            const num = parseFloat(v.numerator)
            const den = def.denominator !== null ? parseFloat(v.denominator) : null
            const result = !isNaN(num) ? calcResult(num, isNaN(den as number) ? null : den) : null
            const pass = result !== null || def.target_type === 'eq' ? isPass(result, def.target_type ?? '', def.target_val ?? 0, !isNaN(num) ? num : undefined) : null

            return (
              <div key={def.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 0, alignItems: 'center', background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{def.name_th}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{def.code} · Target: {def.target_type} {def.target_val}{def.unit ?? '%'}</div>
                </div>
                <div style={{ padding: '8px 12px' }}>
                  <input
                    type="number"
                    value={v.numerator}
                    onChange={(e) => setValues((prev) => ({ ...prev, [def.id]: { ...prev[def.id], numerator: e.target.value } }))}
                    placeholder="จำนวน"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ padding: '8px 12px' }}>
                  {def.denominator !== null ? (
                    <input
                      type="number"
                      value={v.denominator}
                      onChange={(e) => setValues((prev) => ({ ...prev, [def.id]: { ...prev[def.id], denominator: e.target.value } }))}
                      placeholder="จำนวนทั้งหมด"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>
                  )}
                </div>
                <div style={{ padding: '8px 12px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                  {result !== null ? `${result}${def.unit ?? '%'}` : '—'}
                </div>
                <div style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <StatusBadge pass={pass} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {error && <div style={{ padding: '10px 14px', background: '#FEE2E2', borderRadius: 8, fontSize: 13, color: '#B91C1C' }}>{error}</div>}
      {saved && <div style={{ padding: '10px 14px', background: '#DCFCE7', borderRadius: 8, fontSize: 13, color: '#15803D' }}>บันทึกสำเร็จ ✓</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" onClick={handleSubmit} disabled={loading || !deptId}>
          {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
        </Button>
      </div>
    </div>
  )
}
