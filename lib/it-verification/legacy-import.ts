import type { ItDepartmentCode } from './domain'
import type { LegacyFormSample, LegacyFormSheetResult } from './legacy-form'

export type LegacyImportSource = {
  sourceFileId: string
  sourceFileName: string
  quarters: LegacyFormSheetResult[]
}

export type LegacyImportPlanItem = {
  action: 'import' | 'skip'
  runKey: string
  year: number
  quarter: 1 | 2 | 3 | 4
  departmentCode: ItDepartmentCode
  sourceFileId: string
  sourceFileName: string
  samples: LegacyFormSample[]
  sampleCount: number
  roundStatus: 'draft'
  warning: string | null
  issues: string[]
}

export type LegacySampleRow = {
  round_id: string
  sampling_run_id: string
  department_id: number
  ln: string
  source_month: null
  source_lab_section: null
  test_name: null
  first_spcm_at: null
  last_result_at: null
  source_record_count: 0
  sampling_method: 'legacy_manual'
  lis_to_his: LegacyFormSample['lisToHis']
  source_to_lis: LegacyFormSample['sourceToLis']
  remark: string
}

export function legacyRunKey(year: number, quarter: number, departmentCode: ItDepartmentCode): string {
  return `${year}:${quarter}:${departmentCode}`
}

export function buildLegacyImportPlan(
  sources: LegacyImportSource[],
  existingRunKeys: ReadonlySet<string> = new Set(),
): LegacyImportPlanItem[] {
  return sources
    .flatMap((source) => source.quarters.map((quarter) => ({ source, quarter })))
    .map(({ source, quarter }) => {
      const runKey = legacyRunKey(quarter.year, quarter.quarter, quarter.departmentCode)
      return {
        action: existingRunKeys.has(runKey) ? 'skip' : 'import',
        runKey,
        year: quarter.year,
        quarter: quarter.quarter,
        departmentCode: quarter.departmentCode,
        sourceFileId: source.sourceFileId,
        sourceFileName: quarter.sourceFileName,
        samples: quarter.samples,
        sampleCount: quarter.samples.length,
        roundStatus: 'draft' as const,
        warning: quarter.warnings.length > 0 ? quarter.warnings.join(' · ') : null,
        issues: quarter.issues,
      }
    })
}

export function toLegacySampleRow(
  roundId: string,
  runId: string,
  departmentId: number,
  sample: LegacyFormSample,
): LegacySampleRow {
  return {
    round_id: roundId,
    sampling_run_id: runId,
    department_id: departmentId,
    ln: sample.ln,
    source_month: null,
    source_lab_section: null,
    test_name: null,
    first_spcm_at: null,
    last_result_at: null,
    source_record_count: 0,
    sampling_method: 'legacy_manual',
    lis_to_his: sample.lisToHis,
    source_to_lis: sample.sourceToLis,
    remark: sample.remark,
  }
}
