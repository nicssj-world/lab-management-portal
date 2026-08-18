'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { StickyScroll } from '@/components/ui/StickyScroll'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from './StatusBadge'
import { isNoIncidentRate } from '@/lib/kpi-utils'
import type { Department, KpiDefinition, VwKpiDashboardRow } from '@/lib/supabase/types'
import { createRequestGuard, type RequestGuard } from '@/lib/kpi/request-guard'

interface Props {
  year: number
  month: number
}

export function KpiOverviewTable({ year, month }: Props) {
  const router = useRouter()
  const [depts, setDepts] = useState<Department[]>([])
  const [defs, setDefs] = useState<KpiDefinition[]>([])
  const [entries, setEntries] = useState<VwKpiDashboardRow[]>([])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const requestGuard = useRef<RequestGuard | null>(null)
  if (requestGuard.current === null) requestGuard.current = createRequestGuard()

  useEffect(() => {
    const request = requestGuard.current!.begin()
    async function load() {
      setLoading(true)
      try {
        const [deptsRes, defsRes, entriesRes, configRes] = await Promise.all([
          fetch('/kpi/api/departments', { signal: request.signal }).then((r) => r.json()),
          fetch('/kpi/api/definitions', { signal: request.signal }).then((r) => r.json()),
          fetch(`/kpi/api/entries?year=${year}&month=${month}`, { signal: request.signal }).then((r) => r.json()),
          fetch('/kpi/api/config', { signal: request.signal }).then((r) => r.json()).catch(() => ({})),
        ])
        if (!requestGuard.current!.isCurrent(request.id)) return
        const departmentList: Department[] = Array.isArray(deptsRes) ? deptsRes : []
        const visibleDepartments = configRes?.canViewAll === false && Array.isArray(configRes?.assignedDeptIds)
          ? departmentList.filter((department) => configRes.assignedDeptIds.includes(department.id))
          : departmentList
        setDepts(visibleDepartments)
        setDefs(Array.isArray(defsRes) ? defsRes : [])
        setEntries(Array.isArray(entriesRes) ? entriesRes : [])
        setExcluded(new Set(Array.isArray(configRes?.exclusions) ? configRes.exclusions : []))
      } catch {
        if (!requestGuard.current!.isCurrent(request.id)) return
      }
      if (requestGuard.current!.isCurrent(request.id)) setLoading(false)
    }
    load()

    return () => requestGuard.current?.cancel()
  }, [year, month])

  if (loading) {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ height: 32, borderRadius: 6, background: 'var(--surface-2)' }} />
        ))}
      </div>
    )
  }
  if (depts.length === 0 || defs.length === 0) {
    return <EmptyState icon="users" title="ไม่มีข้อมูล" hint="ยังไม่มีแผนกหรือตัวชี้วัด KPI ในระบบ" />
  }

  const entryMap = new Map<string, VwKpiDashboardRow>()
  for (const e of entries) {
    entryMap.set(`${e.dept_code}|${e.kpi_code}`, e)
  }

  return (
    <StickyScroll>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' }}>
        <thead>
          <tr style={{ background: 'var(--surface-2)' }}>
            <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)', position: 'sticky', left: 0, background: 'var(--surface-2)', zIndex: 1, whiteSpace: 'nowrap' }}>
              แผนก
            </th>
            {defs.map((def) => (
              <th key={def.id} style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', maxWidth: 100 }}>
                <div title={def.name_th}>{def.code}</div>
                <div style={{ fontWeight: 400, color: '#94A3B8', fontSize: 10 }}>{def.category}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {depts.map((dept) => (
            <tr key={dept.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td
                onClick={() => router.push(`/kpi/dashboard/${dept.code}`)}
                style={{
                  padding: '10px 16px', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer',
                  position: 'sticky', left: 0, background: 'var(--card)', zIndex: 1, whiteSpace: 'nowrap',
                  borderRight: '1px solid var(--border)',
                }}
              >
                {dept.name_th}
              </td>
              {defs.map((def) => {
                const isExcluded = excluded.has(`${dept.id}|${def.id}`)
                if (isExcluded) {
                  return (
                    <td key={def.id} style={{ padding: '8px 12px', textAlign: 'center', background: 'var(--surface-2)' }}>
                      <span title="ไม่เกี่ยวข้องกับหน่วยงานนี้" style={{ color: '#CBD5E1', fontSize: 11 }}>N/A</span>
                    </td>
                  )
                }
                const entry = entryMap.get(`${dept.code}|${def.code}`)
                const isPass = entry?.is_pass ?? null
                const noIncident = entry ? isNoIncidentRate(entry.numerator, entry.denominator) : false
                return (
                  <td key={def.id} title={noIncident ? 'ไม่มีอุบัติการณ์ (0/0) จึงไม่ประเมินผล' : undefined} style={{ padding: '8px 12px', textAlign: 'center', background: isPass === true ? '#F0FDF4' : isPass === false ? '#FEF2F2' : undefined }}>
                    {entry ? <StatusBadge pass={isPass} emptyLabel={noIncident ? 'ไม่ประเมิน' : undefined} /> : <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </StickyScroll>
  )
}
