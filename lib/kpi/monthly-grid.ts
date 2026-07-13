export interface MonthlyChartTableLayout {
  labelColumnWidth: number
  chartRightGutter: number
  minimumContentWidth: number
  tableWidth: string
  columns: string[]
}

/**
 * Keeps a monthly table on the same horizontal track as its Recharts plot:
 * the first column reserves the Y-axis, and the trailing gutter mirrors the
 * chart's right margin.
 */
export function getMonthlyChartTableLayout(monthCount: number): MonthlyChartTableLayout {
  if (!Number.isInteger(monthCount) || monthCount < 1) {
    throw new Error('A monthly chart requires at least one month')
  }

  const labelColumnWidth = 56
  const chartRightGutter = 16
  const monthColumnMinimum = 64

  return {
    labelColumnWidth,
    chartRightGutter,
    minimumContentWidth: labelColumnWidth + chartRightGutter + monthCount * monthColumnMinimum,
    tableWidth: `calc(100% - ${chartRightGutter}px)`,
    columns: [`${labelColumnWidth}px`, ...Array(monthCount).fill('auto')],
  }
}

/** Positions the first and last chart points at the centres of the table's edge months. */
export function getMonthlyXAxisCenterPadding(chartWidth: number, layout: MonthlyChartTableLayout): number {
  if (!Number.isFinite(chartWidth) || chartWidth <= 0) return 0

  const monthCount = layout.columns.length - 1
  const plotWidth = chartWidth - layout.labelColumnWidth - layout.chartRightGutter

  return plotWidth > 0 ? plotWidth / (monthCount * 2) : 0
}
