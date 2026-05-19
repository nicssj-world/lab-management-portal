import { Stat } from '@/components/ui/Stat'
import { formatTAT } from '@/lib/tat-utils'

interface Props {
  avgTAT: number | null
  pctOnTarget: number | null
  totalSamples: number
  peakHour: number | null
  targetMinutes?: number
}

export function TATKpiCards({ avgTAT, pctOnTarget, totalSamples, peakHour, targetMinutes = 240 }: Props) {
  const peakLabel = peakHour !== null ? `${String(peakHour).padStart(2, '0')}:00–${String(peakHour + 1).padStart(2, '0')}:00` : '—'
  const pct = pctOnTarget ?? 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <Stat
        label="TAT เฉลี่ย"
        value={avgTAT !== null ? formatTAT(avgTAT) : '—'}
        color={avgTAT !== null && avgTAT <= targetMinutes ? 'green' : 'red'}
        icon="clock"
      />
      <Stat
        label="% ตามเป้าหมาย TAT"
        value={pctOnTarget !== null ? `${pct}%` : '—'}
        color={pct >= 95 ? 'green' : pct >= 80 ? 'amber' : 'red'}
        icon="chart"
      />
      <Stat
        label="จำนวนตัวอย่างทั้งหมด"
        value={totalSamples.toLocaleString()}
        color="blue"
        icon="flask"
      />
      <Stat
        label="ช่วงเวลาที่ยุ่งที่สุด"
        value={peakLabel}
        color="blue"
        icon="clock"
      />
    </div>
  )
}
