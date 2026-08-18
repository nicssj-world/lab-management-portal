'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { calcResult, getFiscalMonths, getThaiMonthLabel } from '@/lib/kpi-utils'
import { getKpiTargetLabel } from '@/lib/kpi/annual-labels'
import { getUniqueWorksheetName } from '@/lib/kpi/export-sheet-names'
import type { AnnualKpiRow, Department } from '@/lib/supabase/types'

interface Props {
  year: number
  depts: Department[]
}

const MONTHS = getFiscalMonths()

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
    const hasDen = row.denominator_label !== null

    if (!hasDen) {
      aoa.push([
        row.kpi_name, getKpiTargetLabel(row),
        ...MONTHS.map((m) => row.months[m]?.numerator ?? ''),
        Object.values(row.months).some((m) => m.numerator !== null) ? totalNum : '',
      ])
      continue
    }

    // numerator row
    aoa.push([
      `${row.kpi_name} (ทันเวลา)`, getKpiTargetLabel(row),
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
      const usedSheetNames = new Set<string>(['รวม'])

      // "รวม" sheet — group overview (excludes OUT/OPD server-side)
      const overviewResponse = await fetch(`/kpi/api/annual?year=${year}`)
      if (!overviewResponse.ok) throw new Error('โหลดข้อมูลภาพรวมไม่สำเร็จ')
      const overview: AnnualKpiRow[] = await overviewResponse.json()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsToAoa(Array.isArray(overview) ? overview : [])), 'รวม')

      // Per-department sheets
      for (const dept of depts) {
        const response = await fetch(`/kpi/api/annual?year=${year}&dept=${dept.code}`)
        if (!response.ok) throw new Error(`โหลดข้อมูล ${dept.code} ไม่สำเร็จ`)
        const rows: AnnualKpiRow[] = await response.json()
        const sheetName = getUniqueWorksheetName(dept.code, usedSheetNames)
        usedSheetNames.add(sheetName)
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
