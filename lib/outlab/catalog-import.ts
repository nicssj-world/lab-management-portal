import { catalogServiceDefaults } from './domain'

export type NHealthCodeRow = {
  ephisCode: string
  nHealthCode: string
  sheetName: string
  rowNumber: number
}

export type CatalogImportTest = {
  id: number
  code: string
  th: string
  method: string | null
  tube: string | null
  volume: string | null
  transport_condition: string | null
  tat: string | null
  tat_hours: number | null
  tat_minutes: string | null
  price: number | null
}

export type CatalogServiceImportRow = {
  test_id: number
  test_name_snapshot: string
  external_code: string | null
  method: string | null
  specimen: string | null
  transport_condition: string | null
  tat_text: string | null
  price: number | null
  active: true
  is_primary: false
}

const SHEET_PRIORITY = new Map([
  ['สรุปราคา', 0],
  ['ราคาสัญญา', 1],
  ['ราคานอกสัญญา', 2],
])

function normalizeCode(value: string) {
  return value.trim().toLocaleUpperCase()
}

function cleanText(value: string | null | undefined) {
  const text = value?.trim()
  return text || null
}

function specimenText(test: Pick<CatalogImportTest, 'tube' | 'volume'>) {
  return [cleanText(test.tube), cleanText(test.volume)].filter(Boolean).join(' · ') || null
}

export function selectNHealthCodes(rows: readonly NHealthCodeRow[]) {
  const grouped = new Map<string, NHealthCodeRow[]>()
  for (const row of rows) {
    const ephisCode = normalizeCode(row.ephisCode)
    if (!ephisCode) continue
    grouped.set(ephisCode, [...(grouped.get(ephisCode) ?? []), row])
  }

  return new Map([...grouped.entries()].map(([ephisCode, candidates]) => {
    const selected = candidates
      .filter(candidate => cleanText(candidate.nHealthCode))
      .sort((left, right) => (
        (SHEET_PRIORITY.get(left.sheetName) ?? Number.MAX_SAFE_INTEGER) - (SHEET_PRIORITY.get(right.sheetName) ?? Number.MAX_SAFE_INTEGER)
        || left.rowNumber - right.rowNumber
      ))[0]
    return [ephisCode, cleanText(selected?.nHealthCode) ?? null]
  }))
}

export function buildCatalogServiceImport(
  tests: readonly CatalogImportTest[],
  nHealthCodes: ReadonlyMap<string, string | null>,
): CatalogServiceImportRow[] {
  return tests.map(test => {
    const defaults = catalogServiceDefaults(test)
    return {
      test_id: test.id,
      test_name_snapshot: test.th.trim() || test.code.trim(),
      external_code: nHealthCodes.get(normalizeCode(test.code)) ?? null,
      method: cleanText(defaults.method),
      specimen: specimenText(test),
      transport_condition: cleanText(defaults.transportCondition),
      tat_text: cleanText(defaults.tatText),
      price: defaults.price,
      active: true,
      is_primary: false,
    }
  })
}
