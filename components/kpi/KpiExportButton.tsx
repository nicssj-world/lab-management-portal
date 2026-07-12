'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { calcResult, getFiscalMonths, getThaiMonthLabel } from '@/lib/kpi-utils'
import type { AnnualKpiRow, Department } from '@/lib/supabase/types'

interface Props {
  year: number
  depts: Department[]
}

const MONTHS = getFiscalMonths()

function targetLabel(row: AnnualKpiRow): string {
  if (row.target_type === 'eq') return `= ${row.target_val} ${row.unit ?? ''}`.trim()
  const op = row.target_type === 'gte' ? '≥' : '≤'
  return `${op} ${row.target_val}${row.unit ?? '%'}`
}

// Build an array-of-arrays sheet mirroring the Google Sheet layout
function rowsToAoa(rows: AnnualKpiRow[]): (string | number)[][] {
  const header = ['KPI', 'Target', ...MONTHS.map(getThaiMonthLabel), 'รวม']
  const aoa: (string | number)[][] = [header]

  for (const row of rows) {
    let totalNum = 0, totalDen = 0, hasTotalDen = false
    for (const m of Object.values(row.months)) {
      totalNum += m.numerator ?? 0
      if (m.denominator !== null) { totalDen += m.denominator; hasTotalDen = true }
    }
    const hasDen = Object.values(row.months).some((m) => m.denominator !== null)

    if (row.target_type === 'eq') {
      aoa.push([
        row.kpi_name, targetLabel(row),
        ...MONTHS.map((m) => row.months[m]?.numerator ?? ''),
        totalNum,
      ])
      continue
    }

    // numerator row
    aoa.push([
      `${row.kpi_name} (ทันเวลา)`, targetLabel(row),
      ...MONTHS.map((m) => row.months[m]?.numerator ?? ''),
      totalNum,
    ])
    if (hasDen) {
      aoa.push([
        'ทั้งหมด', '',
        ...MONTHS.map((m) => row.months[m]?.denominator ?? ''),
        hasTotalDen ? totalDen : '',
      ])
      const totalPct = calcResult(totalNum, hasTotalDen ? totalDen : null)
      aoa.push([
        'ร้อยละ', '',
        ...MONTHS.map((m) => row.months[m]?.result_pct ?? ''),
        totalPct ?? '',
      ])
    }
  }
  return aoa
}

export function KpiExportButton({ year, depts }: Props) {
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    setBusy(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      // "รวม" sheet — group overview (excludes OUT/OPD server-side)
      const overview: AnnualKpiRow[] = await fetch(`/kpi/api/annual?year=${year}`).then((r) => r.json())
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsToAoa(Array.isArray(overview) ? overview : [])), 'รวม')

      // Per-department sheets
      for (const dept of depts) {
        const rows: AnnualKpiRow[] = await fetch(`/kpi/api/annual?year=${year}&dept=${dept.code}`).then((r) => r.json())
        const sheetName = dept.code.slice(0, 31) // Excel sheet name limit
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsToAoa(Array.isArray(rows) ? rows : [])), sheetName)
      }

      XLSX.writeFile(wb, `KPI_${year}.xlsx`)
    } catch {
      alert('ส่งออกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="secondary" icon="download" onClick={handleExport} disabled={busy}>
      {busy ? 'กำลังส่งออก...' : 'Export Excel'}
    </Button>
  )
}
