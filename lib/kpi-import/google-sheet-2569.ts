export type Kpi2569SourceEntry = {
  deptCode: string
  kpiCode: string
  month: number
  numerator: number
  denominator: number | null
}

type SourceRow = {
  kpiCode: string
  numeratorRow: number
  denominatorRow?: number
}

const MONTHS = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9]

// Rows are one-indexed and follow the KPI 2569 source workbook. Formula rows
// such as percentage/total rows are intentionally excluded from this mapping.
const SOURCE_ROWS: SourceRow[] = [
  { kpiCode: 'TAT_ROUTINE', numeratorRow: 3, denominatorRow: 4 },
  { kpiCode: 'TAT_STROKE', numeratorRow: 6, denominatorRow: 7 },
  { kpiCode: 'TAT_CRITICAL', numeratorRow: 9, denominatorRow: 10 },
  { kpiCode: 'TAT_UNCROSS', numeratorRow: 12, denominatorRow: 13 },
  { kpiCode: 'ERR_REPORT', numeratorRow: 15, denominatorRow: 4 },
  { kpiCode: 'RISK_BLOOD', numeratorRow: 17 },
  { kpiCode: 'RISK_ID_OPD', numeratorRow: 18 },
  { kpiCode: 'RISK_ID_WARD', numeratorRow: 19 },
  { kpiCode: 'RISK_STICKER', numeratorRow: 20 },
  { kpiCode: 'RISK_NEARMISS', numeratorRow: 21, denominatorRow: 22 },
  { kpiCode: 'RISK_LOWRISK', numeratorRow: 24, denominatorRow: 25 },
  { kpiCode: 'RISK_MODERATE', numeratorRow: 27 },
  { kpiCode: 'RISK_SENTINEL', numeratorRow: 28 },
]

const SOURCE_ROWS_2568: SourceRow[] = [
  { kpiCode: 'TAT_ROUTINE', numeratorRow: 3, denominatorRow: 4 },
  { kpiCode: 'TAT_STROKE', numeratorRow: 6, denominatorRow: 7 },
  { kpiCode: 'TAT_CRITICAL', numeratorRow: 9, denominatorRow: 10 },
  { kpiCode: 'TAT_UNCROSS', numeratorRow: 12, denominatorRow: 13 },
  { kpiCode: 'ERR_REPORT', numeratorRow: 15, denominatorRow: 4 },
  { kpiCode: 'RISK_BLOOD', numeratorRow: 17 },
  { kpiCode: 'RISK_ID_OPD', numeratorRow: 18 },
  { kpiCode: 'RISK_ID_WARD', numeratorRow: 19 },
  { kpiCode: 'RISK_STICKER', numeratorRow: 20 },
  { kpiCode: 'RISK_NEARMISS', numeratorRow: 21, denominatorRow: 22 },
  { kpiCode: 'RISK_SENTINEL', numeratorRow: 24 },
]

function getNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || value.trim() === '') return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getCell(rows: Array<Array<unknown>>, row: number, column: number): number | null {
  return getNumber(rows[row - 1]?.[column])
}

function extractKpiSheet(
  deptCode: string,
  rows: Array<Array<unknown>>,
  sourceRows: SourceRow[],
): Kpi2569SourceEntry[] {
  const entries: Kpi2569SourceEntry[] = []

  for (let monthIndex = 0; monthIndex < MONTHS.length; monthIndex += 1) {
    const column = monthIndex + 4 // E:P

    for (const source of sourceRows) {
      const numerator = getCell(rows, source.numeratorRow, column)
      if (numerator === null) continue

      entries.push({
        deptCode,
        kpiCode: source.kpiCode,
        month: MONTHS[monthIndex],
        numerator,
        denominator: source.denominatorRow
          ? getCell(rows, source.denominatorRow, column)
          : null,
      })
    }
  }

  return entries
}

export function extractKpi2569Sheet(
  deptCode: string,
  rows: Array<Array<unknown>>,
): Kpi2569SourceEntry[] {
  return extractKpiSheet(deptCode, rows, SOURCE_ROWS)
}

export function extractKpi2568Sheet(
  deptCode: string,
  rows: Array<Array<unknown>>,
): Kpi2569SourceEntry[] {
  return extractKpiSheet(deptCode, rows, SOURCE_ROWS_2568)
}
