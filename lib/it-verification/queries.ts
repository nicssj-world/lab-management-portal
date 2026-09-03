import { supabaseAdmin } from '@/lib/supabase/admin'
import { IT_DEPARTMENTS, departmentByCode, type ItDepartment } from './domain'
import { canViewAllVerification, type ItVerificationActor } from './guard'
import { isRoundReady, sampleComplete } from './status'
import type { VerificationDepartmentSummary, VerificationFinding, VerificationRoundDetail, VerificationSample, VerificationSummary } from './types'

function isMissingSchema(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === 'PGRST205' || error?.message?.toLowerCase().includes('could not find the table')
}

function departmentFromId(id: number): ItDepartment | null {
  return IT_DEPARTMENTS.find((department) => department.id === id) ?? null
}

function activeSamples(rows: Array<Record<string, unknown>>, roundId: string) {
  return rows.filter((row) => row.round_id === roundId && row.sample_state === 'active')
}

export async function getVerificationSummary(year: number, quarter: number, actor?: ItVerificationActor): Promise<VerificationSummary> {
  const base = {
    schemaReady: true,
    year,
    quarter,
    departments: [] as VerificationDepartmentSummary[],
    totals: { target: 0, sampled: 0, completed: 0, openFindings: 0, readyDepartments: 0 },
    warnings: [] as string[],
  }

  const { data: rounds, error: roundsError } = await supabaseAdmin
    .from('it_verification_rounds')
    .select('id, year, quarter, department_id, status')
    .eq('year', year)
    .eq('quarter', quarter)

  if (roundsError) {
    if (isMissingSchema(roundsError)) return { ...base, schemaReady: false, warnings: ['ยังไม่ได้ติดตั้งฐานข้อมูลการทวนสอบ กรุณา apply migration ก่อนใช้งาน'] }
    throw roundsError
  }

  const roundRows = (rounds ?? []) as Array<{ id: string; department_id: number; status: 'draft' | 'submitted' | 'reviewed' }>
  const roundIds = roundRows.map((row) => row.id)
  const [samplesRes, findingsRes, runsRes, assigneesRes] = await Promise.all([
    roundIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabaseAdmin.from('it_verification_samples').select('id, round_id, sample_state, lis_to_his, source_to_lis, remark').in('round_id', roundIds),
    roundIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabaseAdmin.from('it_verification_findings').select('round_id, sample_id, status').in('round_id', roundIds),
    roundIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabaseAdmin.from('it_verification_sampling_runs').select('round_id, status, warning, quota, sampled_count, source_month').in('round_id', roundIds).order('created_at', { ascending: false }),
    roundIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabaseAdmin.from('it_verification_assignees').select('round_id, department_id, profile_id').in('round_id', roundIds),
  ])
  const firstError = [samplesRes.error, findingsRes.error, runsRes.error, assigneesRes.error].find(Boolean)
  if (firstError) throw firstError

  const samples = (samplesRes.data ?? []) as Array<Record<string, unknown>>
  const findings = (findingsRes.data ?? []) as Array<{ round_id: string; sample_id: string; status: string }>
  const runs = (runsRes.data ?? []) as Array<{ round_id: string; status: string; warning: string | null; quota: number; sampled_count: number; source_month: number | null }>
  const assignees = (assigneesRes.data ?? []) as Array<{ round_id: string; department_id: number; profile_id: string }>
  const profileIds = [...new Set(assignees.map((row) => row.profile_id))]
  const { data: profiles } = profileIds.length === 0
    ? { data: [] as Array<{ id: string; name: string }> }
    : await supabaseAdmin.from('profiles').select('id, name').in('id', profileIds)
  const profileNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.name]))

  const departments = IT_DEPARTMENTS.map((department) => {
    const round = roundRows.find((row) => row.department_id === department.id)
    const departmentSamples = round ? activeSamples(samples, round.id) : []
    const activeSampleIds = new Set(departmentSamples.map((sample) => String(sample.id)))
    const departmentFindings = round
      ? findings.filter((finding) => finding.round_id === round.id && activeSampleIds.has(String(finding.sample_id)) && finding.status !== 'closed')
      : []
    const departmentRuns = round ? runs.filter((run) => run.round_id === round.id) : []
    const latestRun = departmentRuns[0]
    const target = latestRun?.status === 'no_population' ? 0 : 10
    const completed = departmentSamples.filter((sample) => sampleComplete(sample.lis_to_his as 'pass' | 'fail' | 'na' | null, sample.source_to_lis as 'pass' | 'fail' | 'na' | null, String(sample.remark ?? ''))).length
    const incomplete = departmentSamples.length - completed
    const assignee = round ? assignees.find((row) => row.round_id === round.id && row.department_id === department.id) : null
    const canOpenRound = !actor || canViewAllVerification(actor)
      || (actor.departmentCode === department.code && assignee?.profile_id === actor.id)
    const ready = Boolean(round && isRoundReady({ target, samples: departmentSamples.length, incomplete, openFindings: departmentFindings.length }))
    return {
      departmentId: department.id,
      code: department.code,
      name: department.name,
      roundId: canOpenRound ? round?.id ?? null : null,
      roundStatus: round?.status ?? null,
      samplingStatus: (latestRun?.status as VerificationDepartmentSummary['samplingStatus']) ?? null,
      target,
      sampled: departmentSamples.length,
      completed,
      incomplete,
      openFindings: departmentFindings.length,
      assigneeId: canOpenRound ? assignee?.profile_id ?? null : null,
      assigneeName: canOpenRound && assignee ? profileNames.get(assignee.profile_id) ?? null : null,
      warning: latestRun?.warning ?? null,
      ready,
    }
  })

  base.departments = departments
  base.totals = departments.reduce((total, department) => ({
    target: total.target + department.target,
    sampled: total.sampled + department.sampled,
    completed: total.completed + department.completed,
    openFindings: total.openFindings + department.openFindings,
    readyDepartments: total.readyDepartments + (department.ready ? 1 : 0),
  }), base.totals)
  const warningGroups = new Map<string, string[]>()
  for (const department of departments) {
    if (!department.warning) continue
    const codes = warningGroups.get(department.warning) ?? []
    codes.push(department.code)
    warningGroups.set(department.warning, codes)
  }
  base.warnings = [...warningGroups].map(([warning, codes]) => `${codes.join(', ')}: ${warning}`)
  return base
}

export async function getVerificationRoundDetail(roundId: string): Promise<VerificationRoundDetail> {
  const empty: VerificationRoundDetail = { schemaReady: true, round: null, samples: [], assigneeName: null, warnings: [] }
  const { data: round, error } = await supabaseAdmin
    .from('it_verification_rounds')
    .select('id, year, quarter, department_id, status, submitted_at, reviewed_at, review_note')
    .eq('id', roundId)
    .maybeSingle()
  if (error) {
    if (isMissingSchema(error)) return { ...empty, schemaReady: false, warnings: ['ยังไม่ได้ติดตั้งฐานข้อมูลการทวนสอบ กรุณา apply migration ก่อนใช้งาน'] }
    throw error
  }
  if (!round) return empty

  const department = departmentFromId(round.department_id)
  if (!department) return { ...empty, warnings: ['ไม่พบหน่วยงานของรอบการทวนสอบ'] }
  const [samplesRes, findingsRes, assigneeRes, runsRes] = await Promise.all([
    supabaseAdmin.from('it_verification_samples').select('*').eq('round_id', roundId).eq('sample_state', 'active').order('source_month').order('ln'),
    supabaseAdmin.from('it_verification_findings').select('*').eq('round_id', roundId).order('opened_at'),
    supabaseAdmin.from('it_verification_assignees').select('profile_id').eq('round_id', roundId).eq('department_id', round.department_id).maybeSingle(),
    supabaseAdmin.from('it_verification_sampling_runs').select('status, warning, attempt').eq('round_id', roundId).order('attempt', { ascending: false }),
  ])
  const detailError = [samplesRes.error, findingsRes.error, assigneeRes.error, runsRes.error].find(Boolean)
  if (detailError) throw detailError
  const findings = (findingsRes.data ?? []) as VerificationFinding[]
  const profileId = assigneeRes.data?.profile_id as string | undefined
  const { data: profile } = profileId ? await supabaseAdmin.from('profiles').select('name').eq('id', profileId).maybeSingle() : { data: null }
  const sampleRows = (samplesRes.data ?? []) as unknown as VerificationSample[]
  return {
    schemaReady: true,
    round: {
      id: round.id,
      year: round.year,
      quarter: round.quarter,
      departmentId: round.department_id,
      code: department.code,
      name: department.name,
      status: round.status,
      submittedAt: round.submitted_at,
      reviewedAt: round.reviewed_at,
      reviewNote: round.review_note,
    },
    samples: sampleRows.map((sample) => ({ ...sample, findings: findings.filter((finding) => finding.sample_id === sample.id) })),
    assigneeName: profile?.name ?? null,
    warnings: [...new Set((runsRes.data ?? []).flatMap((run) => [run.warning, run.status === 'no_population' ? 'ไม่มีข้อมูล TAT สำหรับหน่วยงานนี้' : null].filter((value): value is string => Boolean(value))))],
  }
}

export { isMissingSchema }
