import { supabaseAdmin } from '@/lib/supabase/admin'
import { bangkokToday } from './server'
import { certificateUrgency } from '@/lib/outlab/domain'
import { deadlineUrgency, fiscalYearBeForDate } from '@/lib/eqa/domain'

export type ExternalQualityAlertsData = {
  available: boolean
  outlab: { expiring: number; expired: number; missing: number; items: Array<{ id: string; laboratory: string; standard: string; expiresOn: string; urgency: string }> }
  eqa: { due: number; overdue: number; unacceptable: number; openCapas: number; items: Array<{ id: string; name: string; dueOn: string; urgency: string }> }
}

const empty = (): ExternalQualityAlertsData => ({ available: false, outlab: { expiring: 0, expired: 0, missing: 0, items: [] }, eqa: { due: 0, overdue: 0, unacceptable: 0, openCapas: 0, items: [] } })

export async function getExternalQualityAlerts(today = bangkokToday()): Promise<ExternalQualityAlertsData> {
  try {
    const fiscalYearBe = fiscalYearBeForDate(today)
    const [labsResult, certsResult, programsResult] = await Promise.all([
      supabaseAdmin.from('outlab_laboratories').select('id,name').eq('active', true),
      supabaseAdmin.from('outlab_certificates').select('id,laboratory_id,standard_name,expires_on,lifecycle').eq('lifecycle', 'current'),
      supabaseAdmin.from('eqa_programs').select('id,name').eq('fiscal_year_be', fiscalYearBe).eq('active', true),
    ])
    if (labsResult.error || certsResult.error || programsResult.error) return empty()
    const labs = labsResult.data ?? []
    const certs = (certsResult.data ?? []).map(cert => ({ ...cert, urgency: certificateUrgency(cert.expires_on, 'current', today) }))
    const labName = new Map(labs.map(lab => [lab.id, lab.name]))
    const labWithCurrent = new Set(certs.map(cert => cert.laboratory_id))
    const programIds = (programsResult.data ?? []).map(program => program.id)
    const roundsResult = programIds.length
      ? await supabaseAdmin.from('eqa_rounds').select('id,program_id,round_code,submission_due_on,status').in('program_id', programIds).neq('status', 'closed')
      : { data: [], error: null }
    if (roundsResult.error) return empty()
    const rounds = (roundsResult.data ?? []).map(round => ({ ...round, urgency: deadlineUrgency(round.submission_due_on, today) }))
    const roundIds = rounds.map(round => round.id)
    const [resultsResult, capasResult] = roundIds.length ? await Promise.all([
      supabaseAdmin.from('eqa_round_results').select('id').in('round_id', roundIds).eq('outcome', 'unacceptable'),
      supabaseAdmin.from('eqa_capas').select('id').in('round_id', roundIds).neq('status', 'verified'),
    ]) : [{ data: [], error: null }, { data: [], error: null }]
    const programName = new Map((programsResult.data ?? []).map(program => [program.id, program.name]))
    return {
      available: true,
      outlab: {
        expiring: certs.filter(cert => ['watch', 'urgent', 'critical'].includes(cert.urgency)).length,
        expired: certs.filter(cert => cert.urgency === 'expired').length,
        missing: labs.filter(lab => !labWithCurrent.has(lab.id)).length,
        items: certs.filter(cert => cert.urgency !== 'valid').slice(0, 5).map(cert => ({ id: cert.id, laboratory: labName.get(cert.laboratory_id) ?? '—', standard: cert.standard_name, expiresOn: cert.expires_on, urgency: cert.urgency })),
      },
      eqa: {
        due: rounds.filter(round => ['upcoming', 'due-soon', 'critical'].includes(round.urgency)).length,
        overdue: rounds.filter(round => round.urgency === 'overdue').length,
        unacceptable: resultsResult.data?.length ?? 0,
        openCapas: capasResult.data?.length ?? 0,
        items: rounds.filter(round => round.urgency !== 'normal').slice(0, 5).map(round => ({ id: round.id, name: `${programName.get(round.program_id) ?? 'EQA'} · ${round.round_code}`, dueOn: round.submission_due_on, urgency: round.urgency })),
      },
    }
  } catch {
    return empty()
  }
}
