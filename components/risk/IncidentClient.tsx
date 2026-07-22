'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilterChips } from '@/components/ui/FilterChips'
import { ModuleSubnav } from '@/components/ui/ModuleSubnav'
import { PageHeader } from '@/components/ui/PageHeader'
import { RISK_NAVIGATION } from '@/lib/navigation'
import { IncidentDetailModal } from './IncidentDetailModal'
import { ExportMenu } from './shared/ExportMenu'
import { ActiveFilterBar, FilterBar, FiscalYearFilter, MonthFilter, Pagination, SearchFilter, SelectFilter } from './shared/FilterBar'
import { ErrorBanner, Panel, SeverityBadge, StatusBadge, TableSkeleton } from './shared/ui'
import { useUrlFilters } from './shared/useUrlFilters'
import {
  FONT, INCIDENT_STATUSES, LAB_DEPARTMENTS, SEVERITY_LETTERS, SPACE,
  formatThaiDate, tabularNums,
} from './shared/tokens'

type IncidentRow = {
  id: number
  report_no: string | null
  event_date: string
  event_category: string | null
  event_detail: string
  department_found: string | null
  severity_level: string | null
  status: string
  requires_rca: boolean
  root_cause: string | null
  reporter_name: string | null
}

const DEFAULTS = { q: '', year: '', month: '', status: '', severity: '', department: '', overdueRca: '', page: '1' }
const PAGE_SIZE = 20
const COLUMNS = ['เลขที่', 'วันที่', 'เหตุการณ์', 'หน่วยงาน', 'ระดับ', 'ผู้รายงาน', 'สถานะ']

export function IncidentClient({ canEdit, canReview, actorName }: {
  canEdit: boolean
  canReview: boolean
  actorName: string | null
}) {
  const { filters, setFilters } = useUrlFilters(DEFAULTS)
  const [rows, setRows] = useState<IncidentRow[]>([])
  const [count, setCount] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== DEFAULTS[key as keyof typeof DEFAULTS]) params.set(key, value)
  }
  params.set('pageSize', String(PAGE_SIZE))
  const queryString = params.toString()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/risk/incidents?${queryString}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'โหลดรายการไม่สำเร็จ')
      setRows(json.data ?? [])
      setCount(Number(json.count ?? 0))
      setStatusCounts(json.statusCounts ?? {})
    } catch (err) {
      setError((err as Error).message)
      setRows([])
      setCount(0)
    } finally {
      setLoading(false)
    }
  }, [queryString])

  useEffect(() => { void load() }, [load])

  const activeFilters = (Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[])
    .filter(key => key !== 'page')
    .filter(key => filters[key] !== DEFAULTS[key])

  // overdueRca ตั้งมาจากลิงก์บนหน้าภาพรวม และไม่มีช่องควบคุมบนหน้าจอให้ตั้งกลับ
  const linkFilter = filters.overdueRca === '1' ? 'เฉพาะเรื่องที่ค้างการวิเคราะห์รากของปัญหา' : ''

  const chips = [
    { value: '', label: 'ทั้งหมด', count: Object.values(statusCounts).reduce((a, b) => a + b, 0) },
    ...INCIDENT_STATUSES.map(s => ({ value: s.value as string, label: s.label, count: statusCounts[s.value] ?? 0 })),
  ]

  return (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      {/* ปุ่มหลักเป็นลิงก์จริง ไม่ใช่ modal — ฟอร์มรายงานมีที่เดียวคือ /staff/risk/report */}
      <style>{`
        .risk-report-cta{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:8px 14px;border:1px solid var(--primary);border-radius:8px;background:var(--primary);color:#fff;font-size:13px;font-weight:600;text-decoration:none;transition:opacity .15s ease,box-shadow .15s ease}
        .risk-report-cta:hover{opacity:.9}
        .risk-report-cta:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}
        @media(prefers-reduced-motion:reduce){.risk-report-cta{transition:none}}
      `}</style>
      <PageHeader
        eyebrow="INCIDENT REPORTS"
        title="รายงานอุบัติการณ์ (IOR)"
        subtitle="รายงาน → ทบทวน → วิเคราะห์สาเหตุ → แก้ไข → ติดตามประสิทธิผล → ปิดเรื่อง ตาม ISO 15189 ข้อ 8.7"
        marginBottom={0}
        actions={
          <>
            <ExportMenu target="incidents" query={queryString} />
            {canEdit && (
              <Link href="/staff/risk/report" className="risk-report-cta">
                <Icon name="plus" size={16} />บันทึกอุบัติการณ์
              </Link>
            )}
          </>
        }
      />

      <ModuleSubnav items={RISK_NAVIGATION} label="เมนูทะเบียนความเสี่ยง" />

      <ErrorBanner message={error} />

      <Panel title="ตัวกรอง">
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
          <FilterChips
            label="กรองตามสถานะ"
            items={chips}
            value={filters.status}
            onChange={status => setFilters({ status })}
          />
          <FilterBar>
            <SearchFilter
              value={filters.q}
              placeholder="ค้นหาเลขที่ / เหตุการณ์ / ผู้รายงาน"
              onCommit={q => setFilters({ q })}
            />
            <FiscalYearFilter value={filters.year} onChange={year => setFilters({ year })} />
            <MonthFilter value={filters.month} onChange={month => setFilters({ month })} />
            <SelectFilter
              label="ระดับความรุนแรง"
              value={filters.severity}
              allLabel="ทุกระดับ"
              options={SEVERITY_LETTERS.map(s => ({ value: s, label: s }))}
              onChange={severity => setFilters({ severity })}
            />
            <SelectFilter
              label="หน่วยงาน"
              value={filters.department}
              allLabel="ทุกหน่วยงาน"
              options={LAB_DEPARTMENTS.map(d => ({ value: d, label: d }))}
              onChange={department => setFilters({ department })}
            />
          </FilterBar>

          <ActiveFilterBar
            count={activeFilters.length}
            detail={linkFilter || undefined}
            onClear={() => setFilters(DEFAULTS)}
          />
        </div>
      </Panel>

      <Panel padding={0}>
        <div style={{ padding: SPACE.md, borderBottom: '1px solid var(--border)' }}>
          <Pagination
            page={Number(filters.page) || 1}
            pageSize={PAGE_SIZE}
            count={count}
            onChange={page => setFilters({ page: String(page) }, { resetPage: false })}
          />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940, fontSize: FONT.base }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {COLUMNS.map(h => (
                  <th key={h} scope="col" style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontSize: FONT.xs, fontWeight: 700, borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <TableSkeleton cols={COLUMNS.length} />}
              {!loading && rows.map(row => (
                <tr
                  key={row.id}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => setOpenId(row.id)}
                >
                  <td style={{ ...td, ...tabularNums, fontWeight: 600 }}>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setOpenId(row.id) }}
                      style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', color: 'var(--primary)', cursor: 'pointer', textAlign: 'left' }}
                    >
                      {row.report_no ?? `#${row.id}`}
                    </button>
                  </td>
                  <td style={{ ...td, ...tabularNums }}>{formatThaiDate(row.event_date)}</td>
                  <td style={{ ...td, maxWidth: 320 }}>
                    <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{row.event_category || '—'}</div>
                    <div style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.event_detail}</div>
                  </td>
                  <td style={td}>{row.department_found ?? '—'}</td>
                  <td style={td}><SeverityBadge severity={row.severity_level} /></td>
                  <td style={td}>{row.reporter_name ?? '—'}</td>
                  <td style={td}><StatusBadge statuses={INCIDENT_STATUSES} value={row.status} /></td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length}>
                    <EmptyState
                      icon="shield"
                      title="ไม่พบรายงานอุบัติการณ์"
                      hint={filters.q || filters.status ? 'ลองล้างตัวกรองเพื่อดูรายการทั้งหมด' : 'ยังไม่มีการรายงานอุบัติการณ์ในระบบ'}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {openId !== null && (
        <IncidentDetailModal
          incidentId={openId}
          canEdit={canEdit}
          canReview={canReview}
          actorName={actorName}
          onClose={() => setOpenId(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  )
}

const td: React.CSSProperties = { padding: '10px 12px', color: 'var(--ink)', verticalAlign: 'top' }
