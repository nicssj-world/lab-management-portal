'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { KpiOverviewTable } from '@/components/kpi/KpiOverviewTable'
import { KpiAnnualTable } from '@/components/kpi/KpiAnnualTable'
import { KpiPresentationDashboard } from '@/components/kpi/KpiPresentationDashboard'
import { KpiSatisfactionPanel } from '@/components/kpi/KpiSatisfactionPanel'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { usePermission } from '@/context/PermissionContext'
import type { Department } from '@/lib/supabase/types'

type Tab = 'dashboard' | 'annual' | 'compare' | 'satisfaction'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard',    label: 'Dashboard' },
  { id: 'annual',       label: 'ภาพรวมรายปี' },
  { id: 'compare',      label: 'เปรียบเทียบแผนก' },
  { id: 'satisfaction', label: 'ความพึงพอใจ' },
]

const selectStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
  fontSize: 13, fontFamily: 'inherit', background: 'var(--card)', cursor: 'pointer', outline: 'none',
}

export default function KpiDashboardPage() {
  const [year, setYear]     = useState(getCurrentThaiFiscalYear())
  const [month, setMonth]   = useState(new Date().getMonth() + 1)
  const [deptCode, setDeptCode] = useState('')
  const [tab, setTab]       = useState<Tab>('dashboard')
  const [depts, setDepts]   = useState<Department[]>([])
  const [satAddOpen, setSatAddOpen] = useState(false)
  const { canEdit }         = usePermission('KPI')

  useEffect(() => {
    fetch('/kpi/api/departments')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setDepts(d) })
      .catch(() => {})
  }, [])


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="KPI"
        title="KPI Dashboard"
        subtitle="ภาพรวม KPI ประจำปีงบประมาณ"
        marginBottom={0}
        actions={canEdit && tab !== 'satisfaction' ? (
          <Link href="/kpi/input">
            <Button variant="primary" icon="plus">บันทึกข้อมูล</Button>
          </Link>
        ) : undefined}
      />

      {/* Global selectors (year + dept — visible on annual & compare tabs) */}
      {tab !== 'satisfaction' && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>ปีงบ</span>
            <input
              type="number" value={year} onChange={e => setYear(Number(e.target.value))}
              min="2560" max="2999" step="1"
              style={{ ...selectStyle, width: 88 }}
            />
          </div>
          {(tab === 'annual' || tab === 'dashboard') && (
            <select value={deptCode} onChange={e => setDeptCode(e.target.value)} style={selectStyle}>
              <option value="">ทุกแผนก (ภาพรวม)</option>
              {depts.map(d => <option key={d.id} value={d.code}>{d.name_th}</option>)}
            </select>
          )}
          {tab === 'compare' && (
            <MonthSelector value={month} onChange={setMonth} />
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '9px 20px', border: 'none', borderRadius: 0,
                borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                background: 'transparent',
                color: active ? 'var(--primary)' : 'var(--muted)',
                fontWeight: active ? 700 : 500, fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'color .15s, border-color .15s',
                whiteSpace: 'nowrap', marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

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
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>คลิกชื่อแผนกเพื่อดู Trend Chart รายแผนก</p>
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
