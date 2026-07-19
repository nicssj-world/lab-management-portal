import { supabaseAdmin } from '@/lib/supabase/admin'
import { bangkokToday, listExternalQualityCatalogTests, listExternalQualityPeople } from '@/lib/external-quality/server'
import { deadlineUrgency, roundClosureBlockers, summarizeCoverage } from './domain'
import type { EqaOverview } from './types'

type Row = Record<string, any>

export async function getEqaOverview(fiscalYearBe: number, today = bangkokToday()): Promise<EqaOverview> {
  const [providersResult, programsResult, ownersResult, testsResult, coverageResult, roundsResult, resultsResult, capasResult, linksResult, attachmentsResult, categoriesResult, people, tests] = await Promise.all([
    supabaseAdmin.from('eqa_providers').select('*').order('name'),
    supabaseAdmin.from('eqa_programs').select('*').eq('fiscal_year_be', fiscalYearBe).order('name'),
    supabaseAdmin.from('eqa_program_owners').select('*'),
    supabaseAdmin.from('eqa_program_tests').select('*'),
    supabaseAdmin.from('eqa_coverage_requirements').select('*').eq('fiscal_year_be', fiscalYearBe),
    supabaseAdmin.from('eqa_rounds').select('*').order('submission_due_on'),
    supabaseAdmin.from('eqa_round_results').select('*'),
    supabaseAdmin.from('eqa_capas').select('*').order('due_on'),
    supabaseAdmin.from('eqa_capa_results').select('*'),
    supabaseAdmin.from('eqa_attachments').select('*').order('uploaded_at'),
    supabaseAdmin.from('categories').select('id, th, sort_order').eq('active', true).order('sort_order').order('th'),
    listExternalQualityPeople(),
    listExternalQualityCatalogTests(),
  ])
  for (const result of [providersResult, programsResult, ownersResult, testsResult, coverageResult, roundsResult, resultsResult, capasResult, linksResult, attachmentsResult, categoriesResult]) {
    if (result.error) throw result.error
  }
  const programIds = new Set(((programsResult.data ?? []) as Row[]).map(program => String(program.id)))
  const programTests = ((testsResult.data ?? []) as Row[]).filter(row => programIds.has(String(row.program_id)))
  const rawRounds = ((roundsResult.data ?? []) as Row[]).filter(row => programIds.has(String(row.program_id)))
  const roundIds = new Set(rawRounds.map(round => String(round.id)))
  const results = ((resultsResult.data ?? []) as Row[]).filter(row => roundIds.has(String(row.round_id)))
  const capas = ((capasResult.data ?? []) as Row[]).filter(row => roundIds.has(String(row.round_id)))
  const capaIds = new Set(capas.map(capa => String(capa.id)))
  const links = ((linksResult.data ?? []) as Row[]).filter(row => capaIds.has(String(row.capa_id)))
  const attachments = ((attachmentsResult.data ?? []) as Row[]).filter(row =>
    (row.round_id && roundIds.has(String(row.round_id))) || (row.capa_id && capaIds.has(String(row.capa_id))))

  const verifiedResultIds = new Set(links.filter(link => capas.find(capa => capa.id === link.capa_id)?.status === 'verified').map(link => String(link.result_id)))
  const rounds: EqaOverview['rounds'] = rawRounds.map((round: Row) => {
    const expected = programTests.filter(item => item.program_id === round.program_id && item.active !== false).length
    const roundResults = results.filter(result => result.round_id === round.id)
    const unacceptable = roundResults.filter(result => result.outcome === 'unacceptable').map(result => String(result.id))
    return {
      ...round,
      urgency: deadlineUrgency(round.submission_due_on, today),
      blockers: roundClosureBlockers({
        expectedResultCount: expected,
        recordedResultCount: roundResults.length,
        reportAttachmentCount: attachments.filter(file => file.round_id === round.id && file.attachment_kind === 'provider_report').length,
        unacceptableResultIds: unacceptable,
        resolvedUnacceptableResultIds: unacceptable.filter(id => verifiedResultIds.has(id)),
      }),
    } as EqaOverview['rounds'][number]
  })

  const programs: Row[] = ((programsResult.data ?? []) as Row[]).map((program: Row): Row => {
    const owners = ((ownersResult.data ?? []) as Row[]).filter(owner => owner.program_id === program.id)
    return { ...program, ownerIds: owners.map(owner => owner.user_id), primaryOwnerId: owners.find(owner => owner.owner_role === 'primary')?.user_id ?? null }
  })
  const coverageRows = ((coverageResult.data ?? []) as Row[]).map((requirement: Row) => {
    const linkedProgramIds = new Set(programTests.filter(item => item.test_id === requirement.test_id && item.active !== false).map(item => String(item.program_id)))
    return {
      mode: requirement.mode,
      linkedProgram: linkedProgramIds.size > 0,
      completedRound: rounds.some(round => linkedProgramIds.has(String(round.program_id)) && round.status === 'closed'),
    }
  })
  const coverageSummary = summarizeCoverage(coverageRows)
  return {
    providers: providersResult.data ?? [], programs, programTests,
    coverageRequirements: coverageResult.data ?? [], rounds, results, capas, attachments,
    people, tests, categories: categoriesResult.data ?? [], coverageSummary,
    summary: {
      activePrograms: programs.filter(program => program.active).length,
      urgentRounds: rounds.filter(round => round.status !== 'closed' && ['upcoming', 'due-soon', 'critical', 'overdue'].includes(round.urgency)).length,
      unacceptableResults: results.filter(result => result.outcome === 'unacceptable').length,
      openCapas: capas.filter(capa => capa.status !== 'verified').length,
    },
  }
}
