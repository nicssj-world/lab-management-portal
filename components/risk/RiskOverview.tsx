'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { ModuleSubnav } from '@/components/ui/ModuleSubnav'
import { PageHeader } from '@/components/ui/PageHeader'
import { RiskMatrix } from './RiskMatrix'
import { isMatrixView, type MatrixRisk } from '@/lib/risk/matrix'
import { RISK_NAVIGATION } from '@/lib/navigation'
import { ErrorBanner, Kpi, OverdueBadge, Panel, SeverityBadge } from './shared/ui'
import { FONT, SPACE, daysOverdue, formatThaiDate, tabularNums } from './shared/tokens'

type WorklistItem = {
  id: number
  no: string | null
  title: string
  department: string | null
  date?: string | null
  reporter?: string | null
  severity?: string | null
  owner?: string | null
  dueDate?: string | null
}

type OverdueAction = {
  kind: 'incident' | 'register'
  parentId: number
  parentNo: string | null
  title: string
  owner: string | null
  dueDate: string
  department: string | null
}

type Overview = {
  kpis: {
    openIncidents: number
    awaitingReview: number
    closedThisMonth: number
    avgDaysToClose: number
    overdueActions: number
    residualHigh: number
    reviewDue: number
  }
  worklist: {
    awaitingReview: WorklistItem[]
    needsRca: WorklistItem[]
    overdueActions: OverdueAction[]
    reviewDue: WorklistItem[]
  }
  matrix: MatrixRisk[]
}

export function RiskOverview() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const matrixParam = searchParams.get('matrix')
  const matrixView = isMatrixView(matrixParam) ? matrixParam : 'residual'

  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/risk/overview')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'โหลดภาพรวมไม่สำเร็จ')
      setData(json)
      setError('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      <style>{`
        .risk-overview-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
        .risk-overview-work{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        @media(max-width:900px){.risk-overview-work{grid-template-columns:1fr}}
      `}</style>

      <PageHeader
        eyebrow="RISK MANAGEMENT"
        title="ภาพรวมความเสี่ยง"
        subtitle="งานที่ค้างอยู่ในระบบของห้องปฏิบัติการ นับเฉพาะรายงานอุบัติการณ์และทะเบียนความเสี่ยง"
        marginBottom={0}
        actions={
          <Link
            href="/staff/risk/smart-rm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: FONT.md, fontWeight: 600, textDecoration: 'none' }}
          >
            <Icon name="chart" size={15} />
            ดูวิเคราะห์ข้อมูล Smart-RM
          </Link>
        }
      />

      <ModuleSubnav items={RISK_NAVIGATION} label="เมนูทะเบียนความเสี่ยง" />

      <ErrorBanner message={error} />

      {loading && !data ? (
        <div className="risk-overview-kpis">
          {Array.from({ length: 6 }, (_, i) => <div key={i} style={{ height: 84, borderRadius: 10, background: 'var(--surface-2)' }} />)}
        </div>
      ) : data && (
        <>
          <div className="risk-overview-kpis">
            <Kpi label="อุบัติการณ์ที่ยังไม่ปิด" value={data.kpis.openIncidents} sub="ทุกขั้นตอน" icon="shield" tone="var(--primary)" href="/staff/risk/ior" />
            <Kpi label="รอทบทวน" value={data.kpis.awaitingReview} sub="ยังไม่มีใครรับเรื่อง" icon="inbox" tone="var(--warning)" href="/staff/risk/ior?status=reported" />
            <Kpi label="ปิดได้เดือนนี้" value={data.kpis.closedThisMonth} sub="เรื่อง" icon="shieldCheck" tone="var(--success)" href="/staff/risk/ior?status=closed" />
            <Kpi label="เฉลี่ยวันปิดเรื่อง" value={data.kpis.avgDaysToClose} sub="วันนับจากวันเกิดเหตุ" icon="clock" tone="var(--primary)" />
            <Kpi label="มาตรการเกินกำหนด" value={data.kpis.overdueActions} sub="ต้องเร่งติดตาม" icon="alert" tone="var(--danger)" />
            <Kpi label="ความเสี่ยงคงเหลือสูง" value={data.kpis.residualHigh} sub="ในทะเบียน" icon="trending" tone="var(--danger)" href="/staff/risk/register?residualLevel=high" />
            <Kpi label="ถึงรอบทบทวน" value={data.kpis.reviewDue} sub="รายการในทะเบียน" icon="calendar" tone="var(--warning)" href="/staff/risk/register?reviewDue=1" />
          </div>

          <div className="risk-overview-work">
            <WorkPanel
              title="รอทบทวน"
              icon="inbox"
              href="/staff/risk/ior?status=reported"
              emptyText="ไม่มีเรื่องที่รอทบทวน"
              items={data.worklist.awaitingReview.map(item => ({
                key: item.id,
                href: `/staff/risk/ior?q=${encodeURIComponent(item.no ?? '')}`,
                title: item.title,
                meta: [item.no, item.department, formatThaiDate(item.date)].filter(Boolean).join(' · '),
                extra: item.reporter ? `รายงานโดย ${item.reporter}` : undefined,
              }))}
            />

            <WorkPanel
              title="ต้องวิเคราะห์รากของปัญหา"
              icon="search"
              href="/staff/risk/ior?overdueRca=1"
              emptyText="ไม่มีเรื่องที่ค้างการวิเคราะห์"
              items={data.worklist.needsRca.map(item => ({
                key: item.id,
                href: `/staff/risk/ior?q=${encodeURIComponent(item.no ?? '')}`,
                title: item.title,
                meta: [item.no, item.department, formatThaiDate(item.date)].filter(Boolean).join(' · '),
                badge: <SeverityBadge severity={item.severity} />,
              }))}
            />

            <WorkPanel
              title="มาตรการเกินกำหนด"
              icon="alert"
              emptyText="ไม่มีมาตรการที่เกินกำหนด"
              items={data.worklist.overdueActions.map((action, i) => ({
                key: i,
                href: action.kind === 'incident'
                  ? `/staff/risk/ior?q=${encodeURIComponent(action.parentNo ?? '')}`
                  : `/staff/risk/register?q=${encodeURIComponent(action.parentNo ?? '')}`,
                title: action.title,
                meta: [action.parentNo, action.department, `ผู้รับผิดชอบ ${action.owner || 'ไม่ระบุ'}`].filter(Boolean).join(' · '),
                badge: <OverdueBadge days={daysOverdue(action.dueDate)} />,
              }))}
            />

            <WorkPanel
              title="ทะเบียนที่ถึงรอบทบทวน"
              icon="calendar"
              href="/staff/risk/register?reviewDue=1"
              emptyText="ยังไม่มีรายการที่ถึงรอบทบทวน"
              items={data.worklist.reviewDue.map(item => ({
                key: item.id,
                href: `/staff/risk/register?q=${encodeURIComponent(item.no ?? '')}`,
                title: item.title,
                meta: [item.no, item.department, `ผู้รับผิดชอบ ${item.owner || 'ไม่ระบุ'}`].filter(Boolean).join(' · '),
                extra: `กำหนดทบทวน ${formatThaiDate(item.dueDate)}`,
              }))}
            />
          </div>

          <Panel title="ตารางความเสี่ยง (Risk Matrix)">
            <RiskMatrix
              risks={data.matrix}
              view={matrixView}
              onSelectCell={(likelihood, impact) => {
                // เจาะไปที่ทะเบียนที่กรองช่องนั้นไว้แล้ว — พารามิเตอร์ต่างกันตามมุมมองที่เปิดอยู่
                const params = matrixView === 'residual'
                  ? `residualLikelihood=${likelihood}&residualImpact=${impact}`
                  : `likelihood=${likelihood}&impact=${impact}`
                router.push(`/staff/risk/register?${params}`)
              }}
            />
          </Panel>
        </>
      )}
    </div>
  )
}

type WorkItem = {
  key: number
  href: string
  title: string
  meta: string
  extra?: string
  badge?: React.ReactNode
}

function WorkPanel({ title, icon, href, items, emptyText }: {
  title: string
  icon: string
  href?: string
  items: WorkItem[]
  emptyText: string
}) {
  return (
    <Panel
      title={title}
      action={href && items.length > 0
        ? <Link href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44, padding: '4px 8px', color: 'var(--primary)', fontSize: FONT.base, fontWeight: 600, textDecoration: 'none' }}>
            ดูทั้งหมด <Icon name="arrowRight" size={13} />
          </Link>
        : undefined}
    >
      {items.length === 0 ? (
        <EmptyState icon={icon} title={emptyText} />
      ) : (
        <>
          <style>{`
            .risk-work-item{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;min-height:44px;padding:9px 10px;border-radius:8px;color:inherit;text-decoration:none;transition:background .15s ease}
            .risk-work-item:hover{background:var(--surface-2)}
            .risk-work-item:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:-2px}
            @media(prefers-reduced-motion:reduce){.risk-work-item{transition:none}}
          `}</style>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {items.map(item => (
              <li key={item.key}>
                <Link href={item.href} className="risk-work-item">
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: FONT.md, fontWeight: 600, color: 'var(--ink)' }}>{item.title}</span>
                    <span style={{ display: 'block', fontSize: FONT.base, color: 'var(--muted)', ...tabularNums }}>{item.meta}</span>
                    {item.extra && <span style={{ display: 'block', fontSize: FONT.xs, color: 'var(--muted)', ...tabularNums }}>{item.extra}</span>}
                  </span>
                  {item.badge && <span style={{ flex: '0 0 auto' }}>{item.badge}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}
