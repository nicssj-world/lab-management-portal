import type { ChemicalRegistryFilters, ChemicalRegistryRow } from './types'

export interface ChemicalExportRow {
  no: string
  chemicalName: string
  packingSize: string
  minimumStock: string
  totalVolume: string
  ghsClassification: string
  status: 'Active' | 'Inactive'
  sdsFile: 'Yes' | 'No'
  highlighted: boolean
}

export interface ChemicalPdfRow extends ChemicalExportRow {
  groupLabel: string
}

export function formatChemicalRegistryScopeLabel(
  filters: ChemicalRegistryFilters,
  rows: readonly ChemicalRegistryRow[],
): string {
  const countLabel = `(${rows.length} รายการ)`

  if (filters.unitId) {
    const unitName = rows.find(row => row.unitId === filters.unitId)?.unitName.trim()
    return `${unitName || 'ไม่ทราบหน่วยงาน'} ${countLabel}`
  }

  if (filters.roomId) {
    const unitNames = [...new Set(rows.map(row => row.unitName.trim()).filter(Boolean))]
    if (unitNames.length === 1) return `${unitNames[0]} ${countLabel}`
  }

  return `${Object.keys(filters).length > 0 ? 'ตามตัวกรองที่เลือก' : 'ทุกหน่วยงานและทุกห้องสารเคมี'} ${countLabel}`
}

const GHS_EXPORT_LABELS: Readonly<Record<string, string>> = {
  GHS01: 'วัตถุระเบิด',
  GHS02: 'ก๊าซไวไฟ',
  GHS03: 'สารออกซิไดซ์',
  GHS04: 'ก๊าซภายใต้ความดัน',
  GHS05: 'สารกัดกร่อน',
  GHS06: 'สารพิษเฉียบพลัน',
  GHS07: 'สารระคายเคือง/เป็นอันตราย',
  GHS08: 'อันตรายต่อสุขภาพ',
  GHS09: 'อันตรายต่อสิ่งแวดล้อม',
}

function show(value: unknown, unit?: string | null): string {
  if (value == null || value === '') return '—'
  return `${value}${unit ? ` ${unit}` : ''}`
}

export function formatGhsClassification(
  pictogramCodes: readonly string[],
  hazards: ReadonlyArray<{ className: string; category?: string }>,
): string {
  const pictogramLabels = [...new Set(pictogramCodes.map(code => GHS_EXPORT_LABELS[code]).filter(Boolean))]
  if (pictogramLabels.length > 0) return pictogramLabels.join(', ')

  const hazardLabels = [...new Set(hazards.map(hazard => hazard.className.trim()).filter(Boolean))]
  return hazardLabels.length > 0 ? hazardLabels.join(', ') : 'ไม่ระบุ'
}

function packageSize(row: ChemicalRegistryRow): string {
  if (row.packageValue != null && row.packageUnit && row.packageValue !== 0) return show(row.packageValue, row.packageUnit)
  return row.packageRaw || '—'
}

function totalVolume(row: ChemicalRegistryRow): string {
  if (row.calculatedTotalValue != null && row.calculatedTotalUnit) {
    return show(row.calculatedTotalValue, row.calculatedTotalUnit)
  }
  return row.reportedTotalRaw || '—'
}

export function toChemicalExportRows(
  rows: ChemicalRegistryRow[],
  highlightedHoldingIds: ReadonlySet<string> = new Set(),
): ChemicalExportRow[] {
  return rows.map((row, index) => ({
    no: String(index + 1),
    chemicalName: row.canonicalName,
    packingSize: packageSize(row),
    minimumStock: show(row.minimumStock),
    totalVolume: totalVolume(row),
    ghsClassification: formatGhsClassification(row.pictogramCodes, row.hazards),
    status: row.lifecycleStatus === 'retired' ? 'Inactive' : 'Active',
    sdsFile: row.hasSdsFile ? 'Yes' : 'No',
    highlighted: highlightedHoldingIds.has(row.holdingId),
  }))
}

export function toChemicalPdfRows(
  rows: ChemicalRegistryRow[],
  highlightedHoldingIds: ReadonlySet<string> = new Set(),
  grouped = false,
): ChemicalPdfRow[] {
  const sourceRows = grouped
    ? [...rows].sort((left, right) => (
      left.unitName.localeCompare(right.unitName, 'th')
      || left.storageScope.localeCompare(right.storageScope)
      || left.canonicalName.localeCompare(right.canonicalName, 'th')
      || left.holdingId.localeCompare(right.holdingId)
    ))
    : rows
  const exportRows = toChemicalExportRows(sourceRows, highlightedHoldingIds)
  return sourceRows.map((row, index) => ({
    ...exportRows[index],
    groupLabel: row.unitName.trim() || 'ไม่ระบุหน่วยงาน',
  }))
}
