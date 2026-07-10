'use client'

import { useState } from 'react'
import { TATTrendChart } from '@/components/tat/TATTrendChart'
import { WorkloadTrendChart, type WorkloadOverallTrendRow } from './WorkloadTrendChart'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'

export interface TatTrendRow {
  month: number
  avgTAT: number
  sampleCount: number
}

interface Props {
  tatTrend: TatTrendRow[]
}

type Tab = 'tat' | 'workload'

export function AnalyticsTabs({ tatTrend }: Props) {
  const [tab, setTab] = useState<Tab>('tat')
  const [workloadTrend, setWorkloadTrend] = useState<WorkloadOverallTrendRow[] | null>(null)
  const [loadingWorkload, setLoadingWorkload] = useState(false)

  async function openWorkloadTab() {
    setTab('workload')
    if (workloadTrend !== null || loadingWorkload) return
    setLoadingWorkload(true)
    try {
      const year = getCurrentThaiFiscalYear()
      const res = await fetch(`/api/admin/lab-workload/annual?year=${year}`)
      const json = await res.json()
      const trend: WorkloadOverallTrendRow[] = Array.isArray(json.trend)
        ? json.trend.map((row: { month: number; ln_count: number }) => ({ month: row.month, ln_count: row.ln_count }))
        : []
      setWorkloadTrend(trend)
    } finally {
      setLoadingWorkload(false)
    }
  }

  function tabStyle(active: boolean): React.CSSProperties {
    return {
      padding: '12px 18px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
      fontSize: 13, fontWeight: 700,
      borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
      color: active ? 'var(--primary)' : 'var(--muted)',
    }
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '4px 20px 0', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', gap: 4 }}>
        <button onClick={() => setTab('tat')} style={tabStyle(tab === 'tat')}>TAT</button>
        <button onClick={openWorkloadTab} style={tabStyle(tab === 'workload')}>Lab Workload</button>
      </div>
      <div style={{ padding: 20 }}>
        {tab === 'tat' && <TATTrendChart data={tatTrend} />}
        {tab === 'workload' && (
          loadingWorkload ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด...</div>
          ) : (
            <WorkloadTrendChart data={workloadTrend ?? []} />
          )
        )}
      </div>
    </div>
  )
}
