'use client'

import { useState, useEffect, useCallback } from 'react'
import { getCurrentThaiFiscalYear, getThaiMonthLabel, getFiscalMonths } from '@/lib/kpi-utils'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { Button } from '@/components/ui/Button'
import { StickyScroll } from '@/components/ui/StickyScroll'

interface TestRow {
  test_id: number
  ephis_code: string
  test_name: string
  price: number | null
  in_time_count: string
  total_count: string
}

interface DeptOption {
  id: number
  code: string
  name: string
}

interface Props {
  departments: DeptOption[]
  userRole: string
}

export function WorkloadInputForm({ departments, userRole }: Props) {
  const canEdit = userRole === 'Medical Technologist' || userRole === 'Admin'

  const [year, setYear] = useState(getCurrentThaiFiscalYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [deptId, setDeptId] = useState<number | null>(departments[0]?.id ?? null)
  const [rows, setRows] = useState<TestRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const load = useCallback(async () => {
    if (!deptId) return
    setLoading(true)
    try {
      const [testsRes, entriesRes] = await Promise.all([
        fetch(`/lab-workload/api/departments?tests=1&dept_id=${deptId}`),
        fetch(`/lab-workload/api/entries?view=detail&year=${year}&month=${month}&dept=${departments.find(d => d.id === deptId)?.code ?? ''}`),
      ])
      const testsData = await testsRes.json()
      const entriesData = await entriesRes.json()

      const entryMap = new Map<number, { in_time_count: number; total_count: number }>()
      if (Array.isArray(entriesData)) {
        for (const e of entriesData) {
          entryMap.set(e.test_id, { in_time_count: e.in_time_count, total_count: e.total_count })
        }
      }

      if (Array.isArray(testsData)) {
        setRows(testsData.map((t: { id: number; ephis_code: string; test_name: string; price: number | null }) => {
          const existing = entryMap.get(t.id)
          return {
            test_id: t.id,
            ephis_code: t.ephis_code,
            test_name: t.test_name,
            price: t.price,
            in_time_count: existing ? String(existing.in_time_count) : '',
            total_count: existing ? String(existing.total_count) : '',
          }
        }))
      }
    } finally {
      setLoading(false)
    }
  }, [deptId, year, month, departments])

  useEffect(() => { load() }, [load])

  function setRowField(idx: number, field: 'in_time_count' | 'total_count', value: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  function rowError(row: TestRow): boolean {
    const inTime = parseInt(row.in_time_count)
    const total = parseInt(row.total_count)
    return !isNaN(inTime) && !isNaN(total) && inTime > total
  }

  const hasError = rows.some(rowError)
  const hasData = rows.some(r => r.in_time_count !== '' || r.total_count !== '')

  async function handleSubmit() {
    if (!canEdit || hasError) return
    setSaving(true)
    setToast(null)
    try {
      const entries = rows
        .filter(r => r.in_time_count !== '' && r.total_count !== '')
        .map(r => ({
          test_id: r.test_id,
          fiscal_year: year,
          month,
          in_time_count: parseInt(r.in_time_count),
          total_count: parseInt(r.total_count),
        }))

      const res = await fetch('/lab-workload/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'บันทึกไม่สำเร็จ')
      }

      setToast({ type: 'success', msg: `บันทึก ${entries.length} รายการเรียบร้อย` })
    } catch (e: unknown) {
      setToast({ type: 'error', msg: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Selectors */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--card)', cursor: 'pointer' }}
        >
          {[getCurrentThaiFiscalYear(), getCurrentThaiFiscalYear() - 1].map(y => (
            <option key={y} value={y}>ปีงบ {y}</option>
          ))}
        </select>
        <MonthSelector value={month} onChange={setMonth} />
        <select
          value={deptId ?? ''}
          onChange={e => setDeptId(Number(e.target.value))}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--card)', cursor: 'pointer' }}
        >
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {!canEdit && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#92400E' }}>
          คุณมีสิทธิ์อ่านเท่านั้น — ต้องมีสิทธิ์ editor หรือ admin จึงจะบันทึกข้อมูลได้
        </div>
      )}

      {toast && (
        <div style={{
          background: toast.type === 'success' ? '#D1FAE5' : '#FEE2E2',
          border: `1px solid ${toast.type === 'success' ? '#6EE7B7' : '#FCA5A5'}`,
          borderRadius: 8, padding: '10px 16px', fontSize: 13,
          color: toast.type === 'success' ? '#065F46' : '#991B1B',
        }}>
          {toast.msg}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด...</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>ไม่พบรายการตรวจในแผนกนี้</div>
      ) : (
        <StickyScroll style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                {['รหัส EPHIS', 'ชื่อรายการตรวจ', 'ราคา', 'ตาม TAT', 'ทั้งหมด', '% live'].map((h, i) => (
                  <th key={i} style={{ padding: '11px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const inTime = parseInt(row.in_time_count)
                const total = parseInt(row.total_count)
                const pct = !isNaN(inTime) && !isNaN(total) && total > 0 ? Math.round(inTime / total * 100 * 10) / 10 : null
                const err = rowError(row)

                return (
                  <tr key={row.test_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)' }}>{row.ephis_code}</td>
                    <td style={{ padding: '8px 16px', color: 'var(--ink)', fontWeight: 500 }}>{row.test_name}</td>
                    <td style={{ padding: '8px 16px', color: 'var(--muted)', fontSize: 12 }}>{row.price ? `฿${row.price}` : '—'}</td>
                    <td style={{ padding: '8px 16px' }}>
                      <input
                        type="number"
                        min={0}
                        value={row.in_time_count}
                        onChange={e => setRowField(idx, 'in_time_count', e.target.value)}
                        disabled={!canEdit}
                        style={{
                          width: 80, padding: '6px 8px', borderRadius: 6,
                          border: `1px solid ${err ? '#DC2626' : 'var(--border)'}`,
                          fontSize: 13, fontFamily: 'inherit', background: canEdit ? 'var(--card)' : 'var(--surface-2)',
                          outline: 'none', color: 'var(--ink)',
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      <input
                        type="number"
                        min={0}
                        value={row.total_count}
                        onChange={e => setRowField(idx, 'total_count', e.target.value)}
                        disabled={!canEdit}
                        style={{
                          width: 80, padding: '6px 8px', borderRadius: 6,
                          border: `1px solid ${err ? '#DC2626' : 'var(--border)'}`,
                          fontSize: 13, fontFamily: 'inherit', background: canEdit ? 'var(--card)' : 'var(--surface-2)',
                          outline: 'none', color: 'var(--ink)',
                        }}
                      />
                      {err && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>in_time &gt; total</div>}
                    </td>
                    <td style={{ padding: '8px 16px', fontWeight: 700, color: pct === null ? 'var(--muted)' : pct >= 95 ? '#16A34A' : pct >= 80 ? '#D97706' : '#DC2626' }}>
                      {pct !== null ? `${pct}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </StickyScroll>
      )}

      {canEdit && rows.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button variant="ghost" size="sm" onClick={load}>รีเซ็ต</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!hasData || hasError || saving}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </Button>
        </div>
      )}
    </div>
  )
}
