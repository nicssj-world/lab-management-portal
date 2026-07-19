'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { KpiOverviewTable } from '@/components/kpi/KpiOverviewTable'
import { KpiAnnualTable } from '@/components/kpi/KpiAnnualTable'
import { KpiPresentationDashboard } from '@/components/kpi/KpiPresentationDashboard'
import { KpiSatisfactionPanel } from '@/components/kpi/KpiSatisfactionPanel'
import { KpiExportButton } from '@/components/kpi/KpiExportButton'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { ViewTabs } from '@/components/ui/ViewTabs'
import { usePermission } from '@/context/PermissionContext'
import { normalizeNavigationValue } from '@/lib/navigation'
import type { Department } from '@/lib/supabase/types'

type Tab = 'dashboard' | 'annual' | 'compare' | 'satisfaction'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard',    label: 'Dashboard',        icon: 'chart' },
  { id: 'annual',       label: 'ภาพรวมรายปี',      icon: 'dash' },
  { id: 'compare',      label: 'เปรียบเทียบแผนก',  icon: 'users' },
  { id: 'satisfaction', label: 'ความพึงพอใจ',      icon: 'shieldCheck' },
]

const selectStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
  fontSize: 13, fontFamily: 'inherit', background: 'var(--card)', color: 'var(--ink)',
  cursor: 'pointer', outline: 'none',
}

export default function KpiDashboardPage() {
  const [year, setYear]     = useState(getCurrentThaiFiscalYear())
  const [month, setMonth]   = useState(new Date().getMonth() + 1)
  const [deptCode, setDeptCode] = useState('')
  const searchParams = useSearchParams()
  const tab = normalizeNavigationValue(searchParams.get('view'), TABS.map(item => item.id), 'dashboard')
  const [depts, setDepts]   = useState<Department[]>([])
  const [satAddOpen, setSatAddOpen] = useState(false)
  const [assignedDeptIds, setAssignedDeptIds] = useState<number[]>([])
  const { canEdit }         = usePermission('KPI')
  // Users assigned as a filler for at least one dept (kpi_dept_assignees) can also
  // reach the input form, even without the global KPI edit permission.
  const canFillAny = canEdit || assignedDeptIds.length > 0

  useEffect(() => {
    fetch('/kpi/api/departments')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setDepts(d) })
      .catch(() => {})
    fetch('/kpi/api/config')
      .then(r => r.json())
      .then(c => { if (Array.isArray(c?.assignedDeptIds)) setAssignedDeptIds(c.assignedDeptIds) })
      .catch(() => {})
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="KPI"
        title="KPI Dashboard"
        subtitle="ภาพรวม KPI ประจำปีงบประมาณ"
        marginBottom={0}
        actions={canFillAny && tab !== 'satisfaction' ? (
          <Link href="/kpi/input">
            <Button variant="primary" icon="plus">บันทึกข้อมูล</Button>
          </Link>
        ) : undefined}
      />

      <ViewTabs items={TABS} value={tab} label="มุมมอง KPI" />

      {/* Toolbar: selectors (year + dept — visible on annual & compare tabs) */}
      {tab !== 'satisfaction' && (
        <Card padding={12}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
              <Icon name="clock" size={14} />
              <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>ปีงบ</span>
            </div>
            <input
              type="number" value={year} onChange={e => setYear(Number(e.target.value))}
              min="2560" max="2999" step="1"
              style={{ ...selectStyle, width: 88 }}
              aria-label="ปีงบประมาณ"
            />
            {(tab === 'annual' || tab === 'dashboard') && (
              <select value={deptCode} onChange={e => setDeptCode(e.target.value)} style={selectStyle} aria-label="แผนก">
                <option value="">ทุกแผนก (ภาพรวม)</option>
                {depts.map(d => <option key={d.id} value={d.code}>{d.name_th}</option>)}
              </select>
            )}
            {tab === 'compare' && (
              <MonthSelector value={month} onChange={setMonth} />
            )}
            {tab === 'annual' && (
              <div style={{ marginLeft: 'auto' }}>
                <KpiExportButton year={year} depts={depts} />
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tab content */}
      {tab === 'dashboard' && (
        <KpiPresentationDashboard year={year} deptCode={deptCode || null} />
      )}

      {tab === 'annual' && (
        <Card padding={0}>
          <KpiAnnualTable year={year} deptCode={deptCode || null} />
        </Card>
      )}

      {tab === 'compare' && (
        <>
          <Card padding={0}>
            <KpiOverviewTable year={year} month={month} />
          </Card>
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', margin: 0 }}>
            <Icon name="eye" size={13} />
            คลิกชื่อแผนกเพื่อดู Trend Chart รายแผนก
          </p>
        </>
      )}

      {tab === 'satisfaction' && (
        <Card padding={24}>
          {canEdit && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Button variant="primary" icon="plus" onClick={() => setSatAddOpen(true)}>บันทึกข้อมูล</Button>
            </div>
          )}
          <KpiSatisfactionPanel canEdit={canEdit} addOpen={satAddOpen} onAddClose={() => setSatAddOpen(false)} />
        </Card>
      )}
    </div>
  )
}
