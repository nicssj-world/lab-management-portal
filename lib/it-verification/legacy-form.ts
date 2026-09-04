import type { ItDepartmentCode } from './domain'

export type LegacyFormResult = 'pass' | 'fail' | 'na' | null

export type LegacyFormSample = {
  ln: string
  sourceMonth: null
  sourceLabSection: null
  testName: null
  firstSpcmAt: null
  lastResultAt: null
  sourceRecordCount: 0
  samplingMethod: 'legacy_manual'
  sourceToLis: LegacyFormResult
  lisToHis: LegacyFormResult
  remark: string
}

export type LegacyFormSheetOptions = {
  folderYear: number
  quarter: 1 | 2 | 3 | 4
  departmentCode: ItDepartmentCode
  sourceFileName: string
}

export type LegacyFormSheetResult = LegacyFormSheetOptions & {
  year: number
  samples: LegacyFormSample[]
  warnings: string[]
  issues: string[]
  hasEvidence: boolean
}

export type LegacyFormWorkbook = Record<string, ReadonlyArray<ReadonlyArray<unknown>>>

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function isNonEmpty(value: unknown): boolean {
  return text(value).length > 0
}

function isForbiddenIdentifier(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return normalized === 'hn'
    || normalized === 'patient_name'
    || normalized === 'name'
    || normalized === 'ชื่อผู้ป่วย'
    || normalized === 'ชื่อ_นามสกุล'
    || normalized === 'ชื่อ-นามสกุล'
}

function assertNoPatientIdentifiers(rows: LegacyFormWorkbook[string]): void {
  for (const row of rows) {
    for (const value of row ?? []) {
      const cell = text(value)
      if (isForbiddenIdentifier(cell)) {
        throw new Error(`Legacy verification form contains a patient identifier field: ${cell}`)
      }
    }
  }
}

function resultFromCell(value: unknown, rowNumber: number, columnNumber: number): LegacyFormResult {
  const normalized = text(value).toUpperCase().replace(/[\s.]/g, '')
  if (!normalized) return null
  if (['P', 'PASS', 'ผ่าน'].includes(normalized)) return 'pass'
  if (['X', 'FAIL', 'ไม่ผ่าน'].includes(normalized)) return 'fail'
  if (['NA', 'N/A', 'ไม่เกี่ยวข้อง'].includes(normalized)) return 'na'
  throw new Error(`Unknown legacy verification result "${text(value)}" at row ${rowNumber}, column ${columnNumber}`)
}

function mergeResult(
  current: LegacyFormResult,
  next: LegacyFormResult,
  ln: string,
  transferPoint: string,
  issues: string[],
): LegacyFormResult {
  if (current && next && current !== next) {
    issues.push(`LN ${ln} has conflicting ${transferPoint} results in the source form`)
    return current
  }
  return current ?? next
}

function labIdColumn(row: ReadonlyArray<unknown>): number {
  return row.findIndex((value) => /^lab\s*id$/i.test(text(value)))
}

function isResultLabel(value: unknown): boolean {
  return /ผลการตรวจสอบ/i.test(text(value))
}

function resultRows(rows: LegacyFormWorkbook[string], fromIndex: number): ReadonlyArray<ReadonlyArray<unknown>> {
  return rows.slice(fromIndex + 1).filter((row) => row.some(isResultLabel)).slice(0, 2)
}

export function parseLegacyFormSheet(
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
  options: LegacyFormSheetOptions,
): LegacyFormSheetResult {
  if (!Number.isInteger(options.folderYear) || options.folderYear < 2000 || options.folderYear > 2200) {
    throw new Error('folderYear must be a calendar year in CE')
  }

  assertNoPatientIdentifiers(rows)

  const warnings: string[] = []
  const issues: string[] = []

  const sampleRowIndex = rows.findIndex((row) => labIdColumn(row) >= 0)
  if (sampleRowIndex < 0) {
    warnings.push('ไม่พบรายการ LAB ID ในแท็บนี้; จะสร้างเฉพาะรอบ draft')
    return { ...options, year: options.folderYear, samples: [], warnings, issues, hasEvidence: false }
  }

  const sampleRow = rows[sampleRowIndex]
  const idColumn = labIdColumn(sampleRow)
  const statusRows = resultRows(rows, sampleRowIndex)
  const samplesByLn = new Map<string, LegacyFormSample>()
  const duplicateLns = new Set<string>()

  for (let offset = 1; offset <= 10; offset++) {
    const columnIndex = idColumn + offset
    const ln = text(sampleRow[columnIndex])
    if (!ln) continue

    const sourceToLis = resultFromCell(statusRows[0]?.[columnIndex], statusRows[0] ? rows.indexOf(statusRows[0]) + 1 : 0, columnIndex + 1)
    const lisToHis = resultFromCell(statusRows[1]?.[columnIndex], statusRows[1] ? rows.indexOf(statusRows[1]) + 1 : 0, columnIndex + 1)
    const existing = samplesByLn.get(ln)
    if (existing) {
      duplicateLns.add(ln)
      existing.sourceToLis = mergeResult(existing.sourceToLis, sourceToLis, ln, 'source_to_lis', issues)
      existing.lisToHis = mergeResult(existing.lisToHis, lisToHis, ln, 'lis_to_his', issues)
      continue
    }

    samplesByLn.set(ln, {
      ln,
      sourceMonth: null,
      sourceLabSection: null,
      testName: null,
      firstSpcmAt: null,
      lastResultAt: null,
      sourceRecordCount: 0,
      samplingMethod: 'legacy_manual',
      sourceToLis,
      lisToHis,
      remark: '',
    })
  }

  if (duplicateLns.size > 0) {
    warnings.push(`ตัด LAB ID ซ้ำหลัง trim แล้ว ${duplicateLns.size} รายการ เพื่อคงตัวอย่างแบบ distinct LN`)
  }
  if (statusRows.length < 2 && samplesByLn.size > 0) {
    warnings.push('แบบฟอร์มมีผลตรวจไม่ครบ 2 transfer points; ตัวอย่างที่เหลือจะอยู่ในสถานะ draft')
  }
  if (samplesByLn.size === 0) {
    warnings.push('ไม่พบรายการ LAB ID ในแท็บนี้; จะสร้างเฉพาะรอบ draft')
  }

  for (const sample of samplesByLn.values()) {
    if (sample.sourceToLis === 'fail') issues.push(`LN ${sample.ln}: source_to_lis fail ต้องมี finding ก่อนนำเข้า`)
    if (sample.lisToHis === 'fail') issues.push(`LN ${sample.ln}: lis_to_his fail ต้องมี finding ก่อนนำเข้า`)
    if (sample.sourceToLis === 'na' || sample.lisToHis === 'na') issues.push(`LN ${sample.ln}: N/A ต้องมี remark ก่อนนำเข้า`)
  }

  return {
    ...options,
    year: options.folderYear,
    samples: [...samplesByLn.values()],
    warnings,
    issues,
    hasEvidence: samplesByLn.size > 0,
  }
}

export function parseLegacyFormWorkbook(
  sheets: LegacyFormWorkbook,
  options: Omit<LegacyFormSheetOptions, 'quarter'>,
): LegacyFormSheetResult[] {
  return ([1, 2, 3, 4] as const).map((quarter) => parseLegacyFormSheet(sheets[`Q${quarter}`] ?? [], {
    ...options,
    quarter,
  }))
}
