import { supabaseAdmin } from '@/lib/supabase/admin'
import { isRoundReady, sampleComplete } from './status'

export async function getRoundReadiness(roundId: string) {
  const [samplesRes, findingsRes, runsRes] = await Promise.all([
    supabaseAdmin.from('it_verification_samples').select('id, lis_to_his, source_to_lis, remark').eq('round_id', roundId).eq('sample_state', 'active'),
    supabaseAdmin.from('it_verification_findings').select('id, sample_id, status').eq('round_id', roundId),
    supabaseAdmin.from('it_verification_sampling_runs').select('status, quota, sampled_count').eq('round_id', roundId).order('created_at', { ascending: false }),
  ])
  const error = samplesRes.error ?? findingsRes.error ?? runsRes.error
  if (error) throw error

  const samples = samplesRes.data ?? []
  const findings = findingsRes.data ?? []
  const latestRun = runsRes.data?.[0]
  const target = latestRun?.status === 'no_population' ? 0 : 10
  const completed = samples.filter((sample) => sampleComplete(sample.lis_to_his, sample.source_to_lis, sample.remark ?? '')).length
  const incomplete = samples.length - completed
  const activeSampleIds = new Set(samples.map((sample) => String(sample.id)))
  const openFindings = findings.filter((finding) => activeSampleIds.has(String(finding.sample_id)) && finding.status !== 'closed').length
  return {
    target,
    samples: samples.length,
    completed,
    incomplete,
    openFindings,
    ready: isRoundReady({ target, samples: samples.length, incomplete, openFindings }),
  }
}
