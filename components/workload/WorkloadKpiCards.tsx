import { Stat } from '@/components/ui/Stat'
import type { WorkloadSummaryRow } from '@/lib/queries/workload'

interface Props {
  summary: WorkloadSummaryRow[]
  prevSummary?: WorkloadSummaryRow[]
}

export function WorkloadKpiCards({ summary, prevSummary }: Props) {
  const totalTests = summary.reduce((s, d) => s + d.total_count, 0)
  const totalInTime = summary.reduce((s, d) => s + d.in_time_count, 0)
  const overallPct = totalTests > 0 ? Math.round((totalInTime / totalTests) * 100 * 10) / 10 : 0

  const prevTotal = prevSummary?.reduce((s, d) => s + d.total_count, 0) ?? 0
  const prevInTime = prevSummary?.reduce((s, d) => s + d.in_time_count, 0) ?? 0
  const prevPct = prevTotal > 0 ? Math.round((prevInTime / prevTotal) * 100 * 10) / 10 : 0
  const change = prevPct > 0 ? `${overallPct >= prevPct ? '+' : ''}${(overallPct - prevPct).toFixed(1)}%` : undefined

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <Stat label="จำนวนทดสอบทั้งหมด" value={totalTests.toLocaleString()} color="blue" icon="flask" />
      <Stat label="ทำได้ตาม TAT" value={totalInTime.toLocaleString()} color="green" icon="clock" />
      <Stat label="% ตาม TAT" value={`${overallPct}%`} change={change} color={overallPct >= 95 ? 'green' : overallPct >= 80 ? 'amber' : 'red'} icon="chart" />
      <Stat label="จำนวนแผนก" value={String(summary.length)} color="blue" icon="building" />
    </div>
  )
}
