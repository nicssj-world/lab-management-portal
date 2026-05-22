'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { StickyScroll } from '@/components/ui/StickyScroll'
import { StatusBadge } from './StatusBadge'
import type { Department, KpiDefinition, VwKpiDashboardRow } from '@/lib/supabase/types'

interface Props {
  year: number
  month: number
}

export function KpiOverviewTable({ year, month }: Props) {
  const router = useRouter()
  const [depts, setDepts] = useState<Department[]>([])
  const [defs, setDefs] = useState<KpiDefinition[]>([])
  const [entries, setEntries] = useState<VwKpiDashboardRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [deptsRes, defsRes, entriesRes] = await Promise.all([
        fetch('/kpi/api/departments').then((r) => r.json()),
        fetch('/kpi/api/definitions').then((r) => r.json()),
        fetch(`/kpi/api/entries?year=${year}&month=${month}`).then((r) => r.json()),
      ])
      setDepts(Array.isArray(deptsRes) ? deptsRes : [])
      setDefs(Array.isArray(defsRes) ? defsRes : [])
      setEntries(Array.isArray(entriesRes) ? entriesRes : [])
      setLoading(false)
    }
    load()
  }, [year, month])

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด...</div>
  if (depts.length === 0 || defs.length === 0) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>ไม่มีข้อมูล</div>

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
                const entry = entryMap.get(`${dept.code}|${def.code}`)
                const isPass = entry?.is_pass ?? null
                return (
                  <td key={def.id} style={{ padding: '8px 12px', textAlign: 'center', background: isPass === true ? '#F0FDF4' : isPass === false ? '#FEF2F2' : undefined }}>
                    {entry ? <StatusBadge pass={isPass} /> : <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>}
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
