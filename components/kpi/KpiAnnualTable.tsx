'use client'

import { useState, useEffect, useRef } from 'react'
import { StickyScroll } from '@/components/ui/StickyScroll'
import { EmptyState } from '@/components/ui/EmptyState'
import { calcResult, isNoIncidentRate, isPass, getFiscalMonths, getThaiMonthLabel } from '@/lib/kpi-utils'
import { getKpiNumeratorLabel, getKpiTargetLabel } from '@/lib/kpi/annual-labels'
import { createRequestGuard, type RequestGuard } from '@/lib/kpi/request-guard'
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

function fmtPct(
  v: number | null | undefined,
  numerator?: number | null,
  denominator?: number | null,
): string {
  if (isNoIncidentRate(numerator, denominator)) return 'N/A'
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
  const requestGuard = useRef<RequestGuard | null>(null)
  if (requestGuard.current === null) requestGuard.current = createRequestGuard()

  useEffect(() => {
    setLoading(true)
    const request = requestGuard.current!.begin()
    const params = new URLSearchParams({ year: String(year) })
    if (deptCode) params.set('dept', deptCode)
    fetch(`/kpi/api/annual?${params}`, { signal: request.signal })
      .then(r => r.json())
      .then(d => {
        if (requestGuard.current!.isCurrent(request.id) && Array.isArray(d)) setRows(d)
      })
      .catch(() => {})
      .finally(() => {
        if (requestGuard.current!.isCurrent(request.id)) setLoading(false)
      })

    return () => requestGuard.current?.cancel()
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
        const hasDenominator = row.denominator_label !== null

        // Calculate totals
        let totalNum = 0, totalDen = 0, hasTotalNum = false, hasTotalDen = false
        for (const m of Object.values(row.months)) {
          if (m.numerator !== null) { totalNum += m.numerator; hasTotalNum = true }
          if (hasDenominator && m.denominator !== null) { totalDen += m.denominator; hasTotalDen = true }
        }
        const hasInvalidTotal = hasDenominator && Object.values(row.months).some(
          (month) => month.numerator !== null && month.denominator === null,
        )
        const totalPct = hasDenominator && !hasInvalidTotal
          ? calcResult(totalNum, hasTotalDen ? totalDen : null)
          : null
        const isCountOnly = !hasDenominator
        const totalPass = !hasTotalNum || hasInvalidTotal
          ? null
          : isPass(totalPct, row.target_type, row.target_val, isCountOnly ? totalNum : undefined, isCountOnly)

        // Target label
        const targetLabel = getKpiTargetLabel(row)

        return (
          <GroupRows
            key={row.kpi_code}
            row={row}
            hasDenominator={hasDenominator}
            totalNum={totalNum}
            hasTotalNum={hasTotalNum}
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

function GroupRows({ row, hasDenominator, totalNum, hasTotalNum, totalDen, totalPct, totalPass, targetLabel, tdNum, tdPct }: {
  row: AnnualKpiRow
  hasDenominator: boolean
  totalNum: number
  hasTotalNum: boolean
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

  const isCountOnly = !hasDenominator

  if (isCountOnly) {
    // Count-only KPI: just one row
    return (
      <tr style={{ borderBottom: borderRow }}>
        <td style={labelCell}>{row.kpi_name}</td>
        <td style={{ ...targetCell, fontWeight: 600, color: 'var(--ink)' }}>{targetLabel}</td>
        {MONTHS.map(m => {
          const d = row.months[m]
          const val = d?.numerator ?? null
          const pass = isPass(null, row.target_type, row.target_val, val ?? undefined, true)
          return <td key={m} style={tdPct(pass)}>{val ?? '—'}</td>
        })}
        <td style={tdPct(totalPass)}>{hasTotalNum ? totalNum : '—'}</td>
      </tr>
    )
  }

  return (
    <>
      {/* Numerator row */}
      <tr style={{ borderBottom: hasDenominator ? 'none' : borderRow }}>
        <td style={{ ...labelCell, paddingTop: 9 }}>
          <span style={{ fontWeight: 600 }}>{row.kpi_name}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>({getKpiNumeratorLabel(row.category)})</span>
        </td>
        <td style={targetCell} rowSpan={hasDenominator ? 3 : 2}>
          <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{targetLabel}</span>
        </td>
        {MONTHS.map(m => {
          const d = row.months[m]
          return <td key={m} style={tdNum}>{fmtNum(d?.numerator)}</td>
        })}
        <td style={tdNum}>{fmtNum(hasTotalNum ? totalNum : null)}</td>
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
          return <td key={m} title={isNoIncidentRate(d?.numerator, d?.denominator) ? 'ไม่มีอุบัติการณ์ (0/0) จึงไม่ประเมินผล' : undefined} style={tdPct(d?.is_pass ?? null)}>{fmtPct(d?.result_pct, d?.numerator, d?.denominator)}</td>
        })}
        <td title={isNoIncidentRate(hasTotalNum ? totalNum : null, totalDen) ? 'ไม่มีอุบัติการณ์ (0/0) จึงไม่ประเมินผล' : undefined} style={tdPct(totalPass)}>{fmtPct(totalPct, hasTotalNum ? totalNum : null, totalDen)}</td>
      </tr>
    </>
  )
}
