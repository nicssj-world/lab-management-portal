'use client'

import { useState, useEffect } from 'react'
import { StickyScroll } from '@/components/ui/StickyScroll'
import { EmptyState } from '@/components/ui/EmptyState'
import { calcResult, isPass, getFiscalMonths, getThaiMonthLabel } from '@/lib/kpi-utils'
import type { AnnualKpiRow } from '@/lib/supabase/types'

interface Props {
  year: number
  deptCode: string | null
}

const MONTHS = getFiscalMonths()

const SECTIONS: { label: string; categories: string[] }[] = [
  { label: 'TAT — ความทันเวลาของการรายงานผล', categories: ['TAT'] },
  { label: 'ความคลาดเคลื่อน / ความเสี่ยง', categories: ['ERROR', 'RISK'] },
]

function fmtNum(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M'
  if (v >= 1000) return (v / 1000).toFixed(0) + 'k'
  return String(v)
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toFixed(2)
}

function passColor(pass: boolean | null): string {
  if (pass === true) return 'rgba(22,163,74,.12)'
  if (pass === false) return 'rgba(220,38,38,.10)'
  return 'transparent'
}
function passTextColor(pass: boolean | null): string {
  if (pass === true) return 'var(--success)'
  if (pass === false) return 'var(--danger)'
  return 'var(--muted)'
}

export function KpiAnnualTable({ year, deptCode }: Props) {
  const [rows, setRows] = useState<AnnualKpiRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ year: String(year) })
    if (deptCode) params.set('dept', deptCode)
    fetch(`/kpi/api/annual?${params}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRows(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [year, deptCode])

  if (loading) {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{ height: 28, borderRadius: 6, background: 'var(--surface-2)' }} />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return <EmptyState icon="chart" title="ยังไม่มีข้อมูล KPI" hint="ยังไม่มีข้อมูลสำหรับปีงบนี้" />
  }

  const thStyle: React.CSSProperties = {
    padding: '9px 10px', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    textAlign: 'center', whiteSpace: 'nowrap', background: 'var(--surface-2)',
    borderBottom: '2px solid var(--border)', letterSpacing: .5,
  }
  const tdNum: React.CSSProperties = { padding: '6px 10px', textAlign: 'right', fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'nowrap' }
  const tdPct = (pass: boolean | null): React.CSSProperties => ({
    padding: '7px 10px', textAlign: 'right', fontSize: 12.5, fontWeight: 700,
    color: passTextColor(pass), background: passColor(pass), whiteSpace: 'nowrap',
  })

  return (
    <StickyScroll>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: 'left', minWidth: 220, position: 'sticky', left: 0, zIndex: 2 }}>KPI</th>
            <th style={{ ...thStyle, minWidth: 70 }}>Target</th>
            {MONTHS.map(m => (
              <th key={m} style={{ ...thStyle, minWidth: 68 }}>{getThaiMonthLabel(m)}</th>
            ))}
            <th style={{ ...thStyle, minWidth: 72, color: 'var(--primary)' }}>รวม</th>
          </tr>
        </thead>
        <tbody>
          {SECTIONS.map(section => {
            const sectionRows = rows.filter(r => section.categories.includes(r.category))
            if (sectionRows.length === 0) return null
            return (
              <SectionRows
                key={section.label}
                label={section.label}
                rows={sectionRows}
                thStyle={thStyle}
                tdNum={tdNum}
                tdPct={tdPct}
              />
            )
          })}
        </tbody>
      </table>
    </StickyScroll>
  )
}

function SectionRows({ label, rows, thStyle, tdNum, tdPct }: {
  label: string
  rows: AnnualKpiRow[]
  thStyle: React.CSSProperties
  tdNum: React.CSSProperties
  tdPct: (pass: boolean | null) => React.CSSProperties
}) {
  return (
    <>
      {/* Section header */}
      <tr>
        <td colSpan={MONTHS.length + 3} style={{
          padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--primary)',
          textTransform: 'uppercase', letterSpacing: .8, background: 'rgba(30,95,173,.04)',
          borderTop: '2px solid var(--border)', borderBottom: '1px solid var(--border)',
        }}>
          {label}
        </td>
      </tr>

      {rows.map(row => {
        const hasDenominator = Object.values(row.months).some(m => m.denominator !== null)

        // Calculate totals
        let totalNum = 0, totalDen = 0, hasTotalDen = false
        for (const m of Object.values(row.months)) {
          totalNum += m.numerator ?? 0
          if (m.denominator !== null) { totalDen += m.denominator; hasTotalDen = true }
        }
        const totalPct = calcResult(totalNum, hasTotalDen ? totalDen : null)
        const totalPass = isPass(totalPct, row.target_type, row.target_val, row.target_type === 'eq' ? totalNum : undefined)

        // Target label
        const targetLabel = row.target_type === 'eq'
          ? `= 0`
          : row.target_type === 'gte'
          ? `≥ ${row.target_val}${row.unit ?? '%'}`
          : `≤ ${row.target_val}${row.unit ?? '%'}`

        return (
          <GroupRows
            key={row.kpi_code}
            row={row}
            hasDenominator={hasDenominator}
            totalNum={totalNum}
            totalDen={hasTotalDen ? totalDen : null}
            totalPct={totalPct}
            totalPass={totalPass}
            targetLabel={targetLabel}
            tdNum={tdNum}
            tdPct={tdPct}
          />
        )
      })}
    </>
  )
}

function GroupRows({ row, hasDenominator, totalNum, totalDen, totalPct, totalPass, targetLabel, tdNum, tdPct }: {
  row: AnnualKpiRow
  hasDenominator: boolean
  totalNum: number
  totalDen: number | null
  totalPct: number | null
  totalPass: boolean | null
  targetLabel: string
  tdNum: React.CSSProperties
  tdPct: (pass: boolean | null) => React.CSSProperties
}) {
  const labelCell: React.CSSProperties = {
    padding: '6px 16px', fontSize: 12.5, color: 'var(--ink)',
    position: 'sticky', left: 0, background: 'var(--card)', whiteSpace: 'nowrap',
    borderRight: '1px solid var(--border)',
  }
  const labelCellMuted: React.CSSProperties = { ...labelCell, color: 'var(--muted)', fontSize: 12 }
  const targetCell: React.CSSProperties = { padding: '6px 10px', textAlign: 'center', fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }
  const borderRow = '1px solid var(--border)'

  if (row.target_type === 'eq') {
    // Count-only KPI: just one row
    return (
      <tr style={{ borderBottom: borderRow }}>
        <td style={labelCell}>{row.kpi_name}</td>
        <td style={{ ...targetCell, fontWeight: 600, color: 'var(--ink)' }}>{targetLabel}</td>
        {MONTHS.map(m => {
          const d = row.months[m]
          const val = d?.numerator ?? null
          const pass = val === null ? null : val === 0 ? true : false
          return <td key={m} style={tdPct(pass)}>{val ?? '—'}</td>
        })}
        <td style={tdPct(totalPass)}>{totalNum}</td>
      </tr>
    )
  }

  return (
    <>
      {/* Numerator row */}
      <tr style={{ borderBottom: hasDenominator ? 'none' : borderRow }}>
        <td style={{ ...labelCell, paddingTop: 9 }}>
          <span style={{ fontWeight: 600 }}>{row.kpi_name}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>(ทันเวลา)</span>
        </td>
        <td style={targetCell} rowSpan={hasDenominator ? 3 : 2}>
          <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{targetLabel}</span>
        </td>
        {MONTHS.map(m => {
          const d = row.months[m]
          return <td key={m} style={tdNum}>{fmtNum(d?.numerator)}</td>
        })}
        <td style={tdNum}>{fmtNum(totalNum)}</td>
      </tr>

      {/* Denominator row */}
      {hasDenominator && (
        <tr>
          <td style={labelCellMuted}>ทั้งหมด</td>
          {MONTHS.map(m => {
            const d = row.months[m]
            return <td key={m} style={{ ...tdNum, color: 'var(--muted)', fontSize: 12 }}>{fmtNum(d?.denominator)}</td>
          })}
          <td style={{ ...tdNum, color: 'var(--muted)', fontSize: 12 }}>{fmtNum(totalDen)}</td>
        </tr>
      )}

      {/* Percentage row */}
      <tr style={{ borderBottom: borderRow }}>
        <td style={{ ...labelCellMuted, paddingBottom: 9 }}>ร้อยละ</td>
        {MONTHS.map(m => {
          const d = row.months[m]
          return <td key={m} style={tdPct(d?.is_pass ?? null)}>{fmtPct(d?.result_pct)}</td>
        })}
        <td style={tdPct(totalPass)}>{fmtPct(totalPct)}</td>
      </tr>
    </>
  )
}
