'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { RoutineTatChart } from './RoutineTatChart'
import { WorkloadTrendChart, type WorkloadOverallTrendRow } from './WorkloadTrendChart'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'
import type { AnnualKpiRow } from '@/lib/supabase/types'

type Tab = 'tat' | 'workload'

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, fontWeight: 700, borderRadius: '8px 8px 0 0',
    borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
    color: active ? 'var(--primary)' : 'var(--muted)',
    display: 'flex', alignItems: 'center', gap: 7,
  }
}

export function AnalyticsTabs() {
  const fiscalYear = getCurrentThaiFiscalYear()
  const [tab, setTab] = useState<Tab>('tat')
  const [tatData, setTatData] = useState<AnnualKpiRow[] | null>(null)
  const [loadingTat, setLoadingTat] = useState(true)
  const [workloadTrend, setWorkloadTrend] = useState<WorkloadOverallTrendRow[] | null>(null)
  const [loadingWorkload, setLoadingWorkload] = useState(false)

  useEffect(() => {
    fetch(`/kpi/api/annual?year=${fiscalYear}`)
      .then(res => res.json())
      .then(json => setTatData(Array.isArray(json) ? json : []))
      .catch(() => setTatData([]))
      .finally(() => setLoadingTat(false))
  }, [fiscalYear])

  async function openWorkloadTab() {
    setTab('workload')
    if (workloadTrend !== null || loadingWorkload) return
    setLoadingWorkload(true)
    try {
      const year = getCurrentThaiFiscalYear()
      const res = await fetch(`/api/admin/lab-workload/annual?year=${year}`)
      const json = await res.json()
      const trend: WorkloadOverallTrendRow[] = Array.isArray(json.trend)
        ? json.trend.map((row: { year: number; month: number; ln_count: number; test_rows: number }) => ({
            year: row.year, month: row.month, ln_count: row.ln_count, test_rows: row.test_rows,
          }))
        : []
      setWorkloadTrend(trend)
    } finally {
      setLoadingWorkload(false)
    }
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      <style>{`
        .dash-tab { transition: background .15s, color .15s; }
        .dash-tab:not(.dash-tab-active):hover { background: var(--card) !important; color: var(--ink) !important; box-shadow: 0 -1px 0 var(--border) inset; }
      `}</style>
      <div role="tablist" style={{ padding: '4px 20px 0', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', gap: 4 }}>
        <button
          role="tab"
          aria-selected={tab === 'tat'}
          onClick={() => setTab('tat')}
          className={`dash-tab${tab === 'tat' ? ' dash-tab-active' : ''}`}
          style={tabStyle(tab === 'tat')}
        >
          <Icon name="trending" size={14} />
          TAT
        </button>
        <button
          role="tab"
          aria-selected={tab === 'workload'}
          onClick={openWorkloadTab}
          className={`dash-tab${tab === 'workload' ? ' dash-tab-active' : ''}`}
          style={tabStyle(tab === 'workload')}
        >
          <Icon name="flask" size={14} />
          Lab Workload
        </button>
      </div>
      <div style={{ padding: 20 }}>
        {tab === 'tat' && (
          loadingTat ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด...</div>
          ) : (
            <RoutineTatChart data={tatData} fiscalYear={fiscalYear} />
          )
        )}
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
