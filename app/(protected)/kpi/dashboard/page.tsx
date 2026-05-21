'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { KpiOverviewTable } from '@/components/kpi/KpiOverviewTable'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { usePermission } from '@/context/PermissionContext'

export default function KpiDashboardPage() {
  const [year, setYear] = useState(getCurrentThaiFiscalYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const { canEdit } = usePermission('KPI')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="KPI"
        title="KPI Dashboard"
        subtitle="ภาพรวม KPI ทุกแผนก"
        actions={canEdit ? (
          <Link href="/kpi/input">
            <Button variant="primary" icon="plus">บันทึกข้อมูล</Button>
          </Link>
        ) : undefined}
      />

      {/* Selectors */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--card)', cursor: 'pointer' }}
        >
          {[getCurrentThaiFiscalYear(), getCurrentThaiFiscalYear() - 1, getCurrentThaiFiscalYear() - 2].map((y) => (
            <option key={y} value={y}>ปีงบ {y}</option>
          ))}
        </select>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      <Card padding={0}>
        <KpiOverviewTable year={year} month={month} />
      </Card>

      <p style={{ fontSize: 12, color: 'var(--muted)' }}>คลิกชื่อแผนกเพื่อดู Trend Chart รายแผนก</p>
    </div>
  )
}
