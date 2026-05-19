'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TATMonthFilter } from '@/components/tat/TATMonthFilter'
import { TATKpiCards } from '@/components/tat/TATKpiCards'
import { TATTrendChart } from '@/components/tat/TATTrendChart'
import { TATDeptChart } from '@/components/tat/TATDeptChart'
import { TATHistogram } from '@/components/tat/TATHistogram'
import { TATHeatmap } from '@/components/tat/TATHeatmap'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'

interface TATSummary {
  avgTAT: number | null
  pctOnTarget: number | null
  totalSamples: number
  peakHour: number | null
}

interface TrendRow { month: number; avgTAT: number; sampleCount: number }
interface DeptRow { deptCode: string; avgTAT: number; sampleCount: number }
interface BucketRow { bucket: string; count: number }
interface HeatEntry { received_at: string }

export default function TATDashboardPage() {
  const [year, setYear] = useState(getCurrentThaiFiscalYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [dept, setDept] = useState('')

  const [summary, setSummary] = useState<TATSummary>({ avgTAT: null, pctOnTarget: null, totalSamples: 0, peakHour: null })
  const [trend, setTrend] = useState<TrendRow[]>([])
  const [deptData, setDeptData] = useState<DeptRow[]>([])
  const [dist, setDist] = useState<BucketRow[]>([])
  const [heatEntries, setHeatEntries] = useState<HeatEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const deptParam = dept ? `&dept=${dept}` : ''
        const [s, t, d, dist_, heat_] = await Promise.all([
          fetch(`/tat/api/entries?view=summary&year=${year}&month=${month}${deptParam}`).then(r => r.json()),
          fetch(`/tat/api/entries?view=trend&year=${year}${deptParam}`).then(r => r.json()),
          fetch(`/tat/api/entries?view=dept&year=${year}&month=${month}`).then(r => r.json()),
          fetch(`/tat/api/entries?view=dist&year=${year}&month=${month}${deptParam}`).then(r => r.json()),
          fetch(`/tat/api/entries?view=heatmap&year=${year}&month=${month}${deptParam}`).then(r => r.json()),
        ])
        setSummary(s)
        setTrend(Array.isArray(t) ? t : [])
        setDeptData(Array.isArray(d) ? d : [])
        setDist(Array.isArray(dist_) ? dist_ : [])
        setHeatEntries(Array.isArray(heat_) ? heat_ : [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [year, month, dept])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="TAT"
        title="Turnaround Time"
        subtitle="วิเคราะห์ระยะเวลารายงานผล"
        actions={
          <Link href="/tat/import">
            <Button variant="primary" icon="plus">นำเข้าข้อมูล</Button>
          </Link>
        }
      />

      <TATMonthFilter
        year={year}
        month={month}
        dept={dept}
        onYearChange={setYear}
        onMonthChange={setMonth}
        onDeptChange={setDept}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด...</div>
      ) : (
        <>
          <TATKpiCards
            avgTAT={summary.avgTAT}
            pctOnTarget={summary.pctOnTarget}
            totalSamples={summary.totalSamples}
            peakHour={summary.peakHour}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Card padding={20}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>Trend รายเดือน</div>
              <TATTrendChart data={trend} />
            </Card>
            <Card padding={20}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>TAT เฉลี่ยต่อแผนก</div>
              <TATDeptChart data={deptData} />
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 12 }}>
            <Card padding={20}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>การกระจาย TAT</div>
              <TATHistogram data={dist} />
            </Card>
            <Card padding={20}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>Heatmap เวลารับตัวอย่าง</div>
              <TATHeatmap entries={heatEntries} />
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
