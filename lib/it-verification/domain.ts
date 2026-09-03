export const IT_DEPARTMENTS = [
  { id: 11, code: 'CHE', name: 'เคมีคลินิก', profileDepartment: 'งานเคมีคลินิก' },
  { id: 12, code: 'IMM', name: 'ภูมิคุ้มกันวิทยา', profileDepartment: 'งานภูมิคุ้มกันวิทยาคลินิก' },
  { id: 13, code: 'HEM', name: 'โลหิตวิทยา', profileDepartment: 'งานโลหิตวิทยาคลินิก' },
  { id: 14, code: 'MIS', name: 'จุลทรรศน์ศาสตร์', profileDepartment: 'งานจุลทรรศนศาสตร์คลินิก' },
  { id: 15, code: 'MIC', name: 'จุลชีววิทยา', profileDepartment: 'งานจุลชีววิทยา' },
  { id: 16, code: 'MOL', name: 'อณูชีววิทยา', profileDepartment: 'งานอณูชีววิทยา' },
  { id: 17, code: 'BLB', name: 'คลังเลือด', profileDepartment: 'งานคลังเลือด' },
] as const

export type ItDepartment = typeof IT_DEPARTMENTS[number]
export type ItDepartmentCode = ItDepartment['code']

export const TARGET_SAMPLES_PER_QUARTER = 10
export const SAMPLING_ALGORITHM = 'ln-hash-v1'
export const VERIFICATION_FORM_CODE = 'FM-QP-LAB-24-02'
export const VERIFICATION_FORM_DISPLAY_CODE = 'Fm-QP-LAB-24/02'
export const VERIFICATION_SAMPLING_GO_LIVE = '2026-09-01'

export const TAT_SECTION_SEEDS: ReadonlyArray<{ source: string; code: ItDepartmentCode }> = [
  { source: 'เคมีคลินิก', code: 'CHE' },
  { source: 'ภูมิคุ้มกันวิทยา', code: 'IMM' },
  { source: 'โลหิตวิทยา', code: 'HEM' },
  { source: 'จุลทรรศน์วิทยาคลินิก', code: 'MIS' },
  { source: 'จุลชีววิทยา', code: 'MIC' },
  { source: 'อณูพันธุศาสตร์', code: 'MOL' },
  { source: 'ธนาคารเลือด', code: 'BLB' },
]

export function getQuarterFromMonth(month: number): 1 | 2 | 3 | 4 {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('เดือนต้องอยู่ระหว่าง 1 ถึง 12')
  return Math.ceil(month / 3) as 1 | 2 | 3 | 4
}

export function getMonthlyQuota(month: number): 3 | 4 {
  getQuarterFromMonth(month)
  return month % 3 === 0 ? 4 : 3
}

export function normalizeLn(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return normalized.length > 0 ? normalized : null
}

// The database RPC uses md5(seed || '|' || ln). This small synchronous ranker is
// intentionally dependency-free for client-side previews and deterministic tests;
// it preserves the same seed/LN ordering contract without shipping a Node crypto
// implementation into the browser bundle.
export function deterministicLnRank(seed: string, ln: string): string {
  let hash = 2166136261
  for (const character of `${seed}|${ln}`) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function pickDeterministicSamples(input: {
  seed: string
  population: Array<string | null | undefined>
  quota: number
  excluded?: ReadonlySet<string>
}): string[] {
  const excluded = input.excluded ?? new Set<string>()
  const distinct = new Set<string>()
  for (const raw of input.population) {
    const ln = normalizeLn(raw)
    if (ln && !excluded.has(ln)) distinct.add(ln)
  }

  return [...distinct]
    .sort((a, b) => deterministicLnRank(input.seed, a).localeCompare(deterministicLnRank(input.seed, b)))
    .slice(0, Math.max(0, input.quota))
}

export function departmentByCode(code: string | null | undefined): ItDepartment | null {
  return IT_DEPARTMENTS.find((department) => department.code === code) ?? null
}

export function departmentCodeForProfileDepartment(department: string | null | undefined): ItDepartmentCode | null {
  const match = IT_DEPARTMENTS.find((item) => item.profileDepartment === department)
  return match?.code ?? null
}
