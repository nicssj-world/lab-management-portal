import type { ItDepartmentCode } from './domain'
import { resolveLegacyAssignees, type LegacyAssigneeProfile, type LegacyAssigneeMatch, type LegacyResponsible } from './legacy-assignee'
import type { LegacyFormSample, LegacyFormSheetResult } from './legacy-form'

export type LegacyImportSource = {
  sourceFileId: string
  sourceFileName: string
  responsibleName?: string | null
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
  responsibleName: string | null
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

export type LegacyPlanAssigneeMatch = LegacyAssigneeMatch & { year: number }

export type LegacyPlanAssigneeResolution = {
  assignments: Array<{ runKey: string; year: number; departmentCode: ItDepartmentCode; profileId: string; profileName: string }>
  matches: LegacyPlanAssigneeMatch[]
  warnings: string[]
  issues: string[]
}

export function legacyRunKey(year: number, quarter: number, departmentCode: ItDepartmentCode): string {
  return `${year}:${quarter}:${departmentCode}`
}

export function resolveLegacyPlanAssignees(
  plan: ReadonlyArray<LegacyImportPlanItem>,
  profiles: ReadonlyArray<LegacyAssigneeProfile>,
): LegacyPlanAssigneeResolution {
  const responsibleByYearDepartment = new Map<string, LegacyResponsible>()
  const issues: string[] = []

  for (const item of plan) {
    const key = `${item.year}:${item.departmentCode}`
    if (!item.responsibleName) {
      if (!responsibleByYearDepartment.has(key)) issues.push(`${item.year} ${item.departmentCode}: ไม่พบผู้รับผิดชอบในชีท`)
      continue
    }
    const current = responsibleByYearDepartment.get(key)
    if (current && current.displayName !== item.responsibleName) {
      issues.push(`${item.year} ${item.departmentCode}: พบชื่อผู้รับผิดชอบไม่ตรงกันในปีเดียวกัน`)
      continue
    }
    responsibleByYearDepartment.set(key, {
      departmentCode: item.departmentCode,
      departmentLabel: '',
      displayName: item.responsibleName,
      position: '',
    })
  }

  const matches: LegacyPlanAssigneeMatch[] = []
  for (const [key, responsible] of responsibleByYearDepartment) {
    const year = Number(key.split(':', 1)[0])
    const resolved = resolveLegacyAssignees([responsible], profiles)
    issues.push(...resolved.issues.map((issue) => `${year} ${issue}`))
    matches.push(...resolved.matches.map((match) => ({ ...match, year })))
  }

  const profileIdByYearDepartment = new Map(matches.map((match) => [`${match.year}:${match.departmentCode}`, match.profileId]))
  const assignments = plan.flatMap((item) => {
    const profileId = profileIdByYearDepartment.get(`${item.year}:${item.departmentCode}`)
    return profileId
      ? [{ runKey: item.runKey, year: item.year, departmentCode: item.departmentCode, profileId, profileName: matches.find((match) => match.year === item.year && match.departmentCode === item.departmentCode)?.profileName ?? '' }]
      : []
  })

  return {
    assignments,
    matches,
    warnings: [],
    issues: [...new Set(issues)],
  }
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
        responsibleName: source.responsibleName ?? null,
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
