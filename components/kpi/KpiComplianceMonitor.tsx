'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Stat } from '@/components/ui/Stat'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { StickyScroll } from '@/components/ui/StickyScroll'
import { getThaiMonthLabel } from '@/lib/kpi-utils'
import { getKpiTargetLabel } from '@/lib/kpi/annual-labels'
import { getSubmissionStatusLabel, type SubmissionStatus } from '@/lib/kpi/compliance'
import type {
  KpiComplianceDetail,
  KpiComplianceDetailRequirement,
  KpiCompliancePeriod,
  KpiComplianceResponse,
} from '@/lib/queries/kpi-compliance'
import type { Department } from '@/lib/supabase/types'

const MONTHS = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9]
const STATUS_FILTERS: Array<{ value: '' | SubmissionStatus; label: string }> = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'on_time', label: 'ทันเวลา' },
  { value: 'missed', label: 'ขาด' },
  { value: 'pending', label: 'รอส่ง' },
  { value: 'not_open', label: 'ยังไม่ถึงงวด' },
]

const STATUS_STYLE: Record<SubmissionStatus, { color: string; background: string; icon: string }> = {
  on_time: { color: 'var(--success)', background: 'rgba(22,163,74,.08)', icon: 'check' },
  missed: { color: 'var(--danger)', background: 'rgba(220,38,38,.08)', icon: 'alert' },
  pending: { color: 'var(--warning)', background: 'rgba(217,119,6,.10)', icon: 'clock' },
  not_open: { color: 'var(--primary)', background: 'rgba(37,99,235,.08)', icon: 'calendar' },
  not_tracked: { color: 'var(--muted)', background: 'var(--surface-2)', icon: 'lock' },
  not_applicable: { color: 'var(--muted)', background: 'var(--surface-2)', icon: 'filter' },
}

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : '—'
}

function formatDeadline(value: string): string {
  const date = new Date(`${value}T00:00:00+07:00`)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium' }).format(date)
    : value
}

function statusColor(status: SubmissionStatus): 'gray' | 'green' | 'red' | 'amber' | 'blue' {
  if (status === 'on_time') return 'green'
  if (status === 'missed') return 'red'
  if (status === 'pending') return 'amber'
  if (status === 'not_open') return 'blue'
  return 'gray'
}

function getCellStatusLabel(status: SubmissionStatus): string {
  return status === 'not_open' ? '--' : getSubmissionStatusLabel(status)
}

export function KpiComplianceMonitor({ year, deptCode = '', depts = [] }: {
  year: number
  deptCode?: string
  depts?: Department[]
}) {
  const [statusFilter, setStatusFilter] = useState<'' | SubmissionStatus>('')
  const [data, setData] = useState<KpiComplianceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailPeriod, setDetailPeriod] = useState<KpiCompliancePeriod | null>(null)
  const [detail, setDetail] = useState<KpiComplianceDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ year: String(year) })
    if (deptCode) params.set('dept', deptCode)
    if (statusFilter) params.set('status', statusFilter)
    try {
      const response = await fetch(`/kpi/api/compliance?${params.toString()}`, { signal })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error ?? 'โหลดสถานะการส่งไม่สำเร็จ')
      setData(json as KpiComplianceResponse)
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      setError(loadError instanceof Error ? loadError.message : 'โหลดสถานะการส่งไม่สำเร็จ')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [deptCode, statusFilter, year])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  useEffect(() => {
    if (!detailPeriod) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setDetailPeriod(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [detailPeriod])

  async function openDetail(period: KpiCompliancePeriod) {
    if (period.status === 'not_open') return
    setDetailPeriod(period)
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    try {
      const params = new URLSearchParams({
        year: String(period.fiscal_year),
        month: String(period.month),
        dept: period.dept_code,
      })
      const response = await fetch(`/kpi/api/compliance/detail?${params.toString()}`)
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error ?? 'โหลดรายละเอียดไม่สำเร็จ')
      setDetail(json as KpiComplianceDetail)
    } catch (detailLoadError) {
      setDetailError(detailLoadError instanceof Error ? detailLoadError.message : 'โหลดรายละเอียดไม่สำเร็จ')
    } finally {
      setDetailLoading(false)
    }
  }

  const emptyMessage = useMemo(() => {
    if (statusFilter === 'missed') return 'ไม่พบรายการขาดตามตัวกรองนี้'
    if (statusFilter) return `ไม่พบรายการ${getSubmissionStatusLabel(statusFilter)}`
    return 'ยังไม่มีข้อมูลแผนกสำหรับติดตาม'
  }, [statusFilter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        .kpi-compliance-stat-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
        .kpi-compliance-matrix-cell{width:100%;min-width:86px;min-height:58px;border:1px solid var(--border);border-radius:8px;padding:6px 5px;background:var(--card);font:inherit;cursor:pointer;text-align:center;transition:border-color .15s ease,background .15s ease,transform .15s ease}
        .kpi-compliance-matrix-cell:hover{border-color:var(--primary);transform:translateY(-1px)}
        .kpi-compliance-matrix-cell:disabled{cursor:not-allowed;transform:none;opacity:.78}
        .kpi-compliance-matrix-cell:disabled:hover{border-color:var(--border);transform:none}
        .kpi-compliance-matrix-cell:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}
        .kpi-compliance-late-row{cursor:pointer}
        .kpi-compliance-late-row:hover{background:var(--surface-2)}
        @media(max-width:900px){.kpi-compliance-stat-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media(max-width:560px){.kpi-compliance-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(prefers-reduced-motion:reduce){.kpi-compliance-matrix-cell{transition:none}.kpi-compliance-matrix-cell:hover{transform:none}}
      `}</style>

      <Card padding={12}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)', fontWeight: 700, fontSize: 14 }}>
              <Icon name="calendar" size={17} />
              ติดตามการส่งรายเดือน
            </div>
            <div style={{ marginTop: 3, color: 'var(--muted)', fontSize: 12 }}>
              สถานะระดับแผนก/งาน · ครบภายในวันที่ 15 ของเดือนถัดไปจึงนับว่าทันเวลา
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 12 }}>
            <span>กรองสถานะ</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as '' | SubmissionStatus)}
              aria-label="กรองสถานะการส่ง KPI"
              style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)', font: 'inherit', cursor: 'pointer' }}
            >
              {STATUS_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
            </select>
          </label>
        </div>
      </Card>

      {loading && <ComplianceLoading />}

      {!loading && error && (
        <Card padding={24}>
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--danger)', fontSize: 13 }}>
            <Icon name="alert" size={18} />
            <span style={{ flex: 1 }}>{error}</span>
            <Button variant="secondary" size="sm" icon="route" onClick={() => void load()}>ลองใหม่</Button>
          </div>
        </Card>
      )}

      {!loading && !error && data && (
        <>
          <div className="kpi-compliance-stat-grid" aria-label="สรุปสถานะการส่ง KPI">
            <Stat label="ทันเวลา" value={data.summary.on_time} color="green" icon="check" />
            <Stat label="ขาด" value={data.summary.missed} color="red" icon="alert" />
            <Stat label="รอส่ง" value={data.summary.pending} color="amber" icon="clock" />
            <Stat label="ยังไม่ถึงงวด" value={data.summary.not_open} color="blue" icon="calendar" />
            <Stat
              label="อัตราส่งทันเวลา"
              value={data.summary.compliance_rate === null ? '—' : `${data.summary.compliance_rate}%`}
              color="blue"
              icon="trending"
            />
          </div>

          {data.rows.length === 0 ? (
            <Card padding={0}><EmptyState title={emptyMessage} hint="ลองเปลี่ยนปีงบประมาณหรือกรองสถานะ" icon="search" /></Card>
          ) : (
            <>
              <Card padding={0}>
                <div style={{ padding: '18px 20px 12px', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-end' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 15, color: 'var(--ink)' }}>Matrix สถานะการส่ง · ปีงบประมาณ {year}</h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>คลิกเซลล์เพื่อดู deadline, progress และ KPI ที่ยังขาด</p>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 11.5, whiteSpace: 'nowrap' }}>ต.ค. – ก.ย.</div>
                </div>
                <StickyScroll>
                  <table style={{ width: '100%', minWidth: 1080, borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th scope="col" style={{ position: 'sticky', left: 0, zIndex: 3, minWidth: 210, padding: '10px 16px', textAlign: 'left', color: 'var(--muted)', background: 'var(--surface-2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                          แผนก / งาน
                        </th>
                        {MONTHS.map((month) => (
                          <th key={month} scope="col" style={{ minWidth: 86, padding: '10px 5px', textAlign: 'center', color: 'var(--muted)', background: 'var(--surface-2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                            {getThaiMonthLabel(month)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row) => (
                        <tr key={row.dept_id}>
                          <th scope="row" style={{ position: 'sticky', left: 0, zIndex: 2, padding: '10px 16px', textAlign: 'left', background: 'var(--card)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                            <div style={{ color: 'var(--ink)', fontWeight: 700 }}>{row.dept_code}</div>
                            <div style={{ marginTop: 2, color: 'var(--muted)', fontWeight: 400, fontSize: 11 }}>{row.dept_name}</div>
                          </th>
                          {MONTHS.map((month) => {
                            const period = row.months[month]
                            return (
                              <td key={month} style={{ padding: 5, borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
                                <SubmissionStatusCell period={period} onClick={() => void openDetail(period)} />
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </StickyScroll>
              </Card>

              <LateList items={data.late_items} onOpen={openDetail} />
            </>
          )}
        </>
      )}

      {detailPeriod && (
        <ComplianceDetailDialog
          period={detailPeriod}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={() => setDetailPeriod(null)}
          onRetry={() => void openDetail(detailPeriod)}
        />
      )}
    </div>
  )
}

function SubmissionStatusCell({ period, onClick }: { period: KpiCompliancePeriod; onClick: () => void }) {
  const style = STATUS_STYLE[period.status]
  const isNotOpen = period.status === 'not_open'
  const showProgress = period.required_count > 0
  const statusLabel = getCellStatusLabel(period.status)
  const accessibleStatusLabel = isNotOpen ? 'ยังไม่เปิด' : statusLabel
  return (
    <button
      type="button"
      className="kpi-compliance-matrix-cell"
      onClick={isNotOpen ? undefined : onClick}
      disabled={isNotOpen}
      aria-disabled={isNotOpen}
      aria-label={`${period.dept_name} ${getThaiMonthLabel(period.month)}: ${accessibleStatusLabel}${showProgress ? ` ${period.filled_count}/${period.required_count}` : ''}`}
      title={isNotOpen ? 'งวดนี้ยังไม่เปิดให้กรอก' : undefined}
      style={{ color: style.color, background: style.background, cursor: isNotOpen ? 'not-allowed' : 'pointer' }}
    >
      <span style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}><Icon name={style.icon} size={15} /></span>
      <span style={{ display: 'block', fontSize: 10.5, lineHeight: 1.2, fontWeight: 700 }}>{statusLabel}</span>
      {showProgress && <span style={{ display: 'block', marginTop: 3, color: 'var(--muted)', fontSize: 10 }}>{period.filled_count}/{period.required_count}</span>}
    </button>
  )
}

function LateList({ items, onOpen }: { items: KpiCompliancePeriod[]; onOpen: (period: KpiCompliancePeriod) => void }) {
  return (
    <Card padding={0}>
      <div style={{ padding: '18px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="alert" size={17} style={{ color: 'var(--danger)' }} />
          <h2 style={{ margin: 0, fontSize: 15, color: 'var(--ink)' }}>รายการขาด</h2>
          <Badge color="red" size="sm">{items.length}</Badge>
        </div>
        <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>เรียงจาก deadline ที่เก่าที่สุด · การกรอกภายหลังยังคงสถานะขาด</p>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: '20px', borderTop: '1px solid var(--border)', color: 'var(--muted)', fontSize: 12.5 }}>ไม่พบรายการขาดในช่วงที่เลือก</div>
      ) : (
        <StickyScroll>
          <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['แผนก / งาน', 'งวด', 'กำหนดส่ง', 'ความคืบหน้า', 'ส่งครั้งแรก', 'ส่ง/แก้ไขล่าสุด'].map((label) => <th key={label} scope="col" style={{ padding: '9px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 700, fontSize: 11, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.dept_id}-${item.fiscal_year}-${item.month}`} className="kpi-compliance-late-row" onClick={() => onOpen(item)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(item) } }} tabIndex={0}>
                  <td style={{ padding: '10px 12px', color: 'var(--ink)', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{item.dept_code} · {item.dept_name}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{getThaiMonthLabel(item.month)} {item.fiscal_year}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--danger)' }}>{formatDeadline(item.deadline)}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{item.filled_count}/{item.required_count}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--muted)' }}>{formatDate(item.first_completed_at)}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--muted)' }}>{formatDate(item.last_entry_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </StickyScroll>
      )}
    </Card>
  )
}

function ComplianceDetailDialog({ period, detail, loading, error, onClose, onRetry }: {
  period: KpiCompliancePeriod
  detail: KpiComplianceDetail | null
  loading: boolean
  error: string
  onClose: () => void
  onRetry: () => void
}) {
  return (
    <div
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1800, display: 'flex', justifyContent: 'flex-end', background: 'rgba(15,23,42,.34)' }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="kpi-compliance-detail-title"
        style={{ width: 'min(560px, 100%)', height: '100%', overflowY: 'auto', background: 'var(--card)', boxShadow: '-12px 0 32px rgba(15,23,42,.16)', padding: 24 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
          <div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>รายละเอียดสถานะการส่ง</div>
            <h2 id="kpi-compliance-detail-title" style={{ margin: '4px 0 0', color: 'var(--ink)', fontSize: 18 }}>{period.dept_code} · {getThaiMonthLabel(period.month)} {period.fiscal_year}</h2>
            <div style={{ marginTop: 3, color: 'var(--muted)', fontSize: 12 }}>{period.dept_name}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิดรายละเอียด" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', background: 'var(--card)', cursor: 'pointer' }}><Icon name="x" size={17} /></button>
        </div>

        {loading && <div aria-live="polite" style={{ padding: '36px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>กำลังโหลดรายละเอียด…</div>}
        {!loading && error && (
          <div role="alert" style={{ padding: '24px 0', color: 'var(--danger)', fontSize: 13 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="alert" size={17} />{error}</div>
            <Button variant="secondary" size="sm" icon="route" onClick={onRetry} style={{ marginTop: 12 }}>ลองใหม่</Button>
          </div>
        )}
        {!loading && !error && detail && <DetailContent detail={detail} />}
      </aside>
    </div>
  )
}

function DetailContent({ detail }: { detail: KpiComplianceDetail }) {
  const period = detail.period
  const statusStyle = STATUS_STYLE[period.status]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, color: statusStyle.color, background: statusStyle.background, fontSize: 12, fontWeight: 700 }}>
          <Icon name={statusStyle.icon} size={14} />
          {getSubmissionStatusLabel(period.status)}
        </span>
        {period.status_source === 'baseline' && <Badge color="blue" size="sm">baseline</Badge>}
      </div>

      <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', margin: 0 }}>
        <DetailMetric label="กำหนดส่ง" value={formatDeadline(period.deadline)} />
        <DetailMetric label="ความคืบหน้า" value={`${period.filled_count}/${period.required_count} KPI`} />
        <DetailMetric label="ส่งครบครั้งแรก" value={formatDate(period.first_completed_at)} />
        <DetailMetric label="ส่ง/แก้ไขล่าสุด" value={formatDate(period.last_entry_at)} />
      </dl>

      {detail.submitted_after_deadline_at && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '11px 12px', borderRadius: 9, background: 'rgba(220,38,38,.07)', color: 'var(--danger)', fontSize: 12.5 }}>
          <Icon name="alert" size={16} />
          <span>มีการส่งหรือแก้ไขหลัง deadline: <strong>{formatDate(detail.submitted_after_deadline_at)}</strong> (สถานะยังเป็นขาด)</span>
        </div>
      )}

      <section aria-labelledby="kpi-compliance-missing-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <h3 id="kpi-compliance-missing-title" style={{ margin: 0, fontSize: 14, color: 'var(--ink)' }}>KPI ที่ขาด</h3>
          <Badge color={detail.missing.length > 0 ? 'red' : 'green'} size="sm">{detail.missing.length}</Badge>
        </div>
        {detail.missing.length === 0 ? (
          <div style={{ padding: '14px 12px', borderRadius: 8, background: 'rgba(22,163,74,.07)', color: 'var(--success)', fontSize: 12.5 }}>กรอก KPI ที่ต้องส่งครบแล้ว</div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
            {detail.missing.map((requirement) => <MissingRequirement key={requirement.kpi_id} requirement={requirement} />)}
          </div>
        )}
      </section>

      <section aria-labelledby="kpi-compliance-requirements-title">
        <h3 id="kpi-compliance-requirements-title" style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--ink)' }}>รายการ KPI ใน snapshot ({detail.requirements.length})</h3>
        <div style={{ border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
          {detail.requirements.map((requirement) => (
            <div key={requirement.kpi_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <Icon name={requirement.filled ? 'check' : 'alert'} size={14} style={{ color: requirement.filled ? 'var(--success)' : 'var(--danger)', flex: '0 0 auto' }} />
              <span style={{ flex: 1, color: 'var(--ink)' }}>{requirement.code} · {requirement.name_th}</span>
              <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{requirement.filled ? 'กรอกแล้ว' : 'ยังไม่ครบ'}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function MissingRequirement({ requirement }: { requirement: KpiComplianceDetailRequirement }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 12px', borderBottom: '1px solid var(--border)' }}>
      <Icon name="alert" size={15} style={{ color: 'var(--danger)', marginTop: 2, flex: '0 0 auto' }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ color: 'var(--ink)', fontSize: 12.5, fontWeight: 700 }}>{requirement.code} · {requirement.name_th}</div>
        <div style={{ marginTop: 3, color: 'var(--muted)', fontSize: 11 }}>เป้า {getKpiTargetLabel(requirement)} · ยังไม่มีค่าที่ครบเงื่อนไข</div>
      </div>
    </div>
  )
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '11px 12px', background: 'var(--surface-2)' }}>
      <dt style={{ margin: 0, color: 'var(--muted)', fontSize: 10.5 }}>{label}</dt>
      <dd style={{ margin: '3px 0 0', color: 'var(--ink)', fontSize: 12.5, fontWeight: 700 }}>{value}</dd>
    </div>
  )
}

function ComplianceLoading() {
  return (
    <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="kpi-compliance-stat-grid">
        {Array.from({ length: 5 }, (_, index) => <Card key={index} padding={18}><div style={{ height: 12, width: '55%', background: 'var(--surface-2)', borderRadius: 5 }} /><div style={{ height: 28, width: '35%', marginTop: 12, background: 'var(--surface-2)', borderRadius: 5 }} /></Card>)}
      </div>
      <Card padding={24}><div style={{ height: 220, background: 'var(--surface-2)', borderRadius: 8 }} /></Card>
      <span style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>กำลังประมวลผลสถานะการส่ง…</span>
    </div>
  )
}
