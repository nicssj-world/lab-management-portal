'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, Cell, LabelList, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { ModuleSubnav } from '@/components/ui/ModuleSubnav'
import { RISK_NAVIGATION } from '@/lib/navigation'
import { SmartRmImportModal } from './SmartRmImportModal'
import { FilterBar, FiscalYearFilter, MonthFilter, Pagination, SearchFilter, SelectFilter } from './shared/FilterBar'
import { ErrorBanner, Kpi, Panel, SeverityBadge, TableSkeleton } from './shared/ui'
import { useUrlFilters } from './shared/useUrlFilters'
import {
  FONT, LAB_DEPARTMENTS, SEVERITY_LETTERS, SPACE, formatThaiDate, tabularNums,
} from './shared/tokens'

type SmartRmEvent = {
  id: number
  external_no: string
  event_date: string | null
  recorded_date: string | null
  department_found: string | null
  department_target: string | null
  risk_type: string | null
  event_main_category: string | null
  event_sub_category: string | null
  severity_level: string | null
  event_detail: string | null
  ior_status: string | null
}

type Analytics = {
  total: number
  clinic: number
  nonClinic: number
  severe: number
  monthCount: number
  monthly: { name: string; value: number }[]
  severity: { name: string; value: number }[]
  departments: { name: string; value: number }[]
  categories: { name: string; value: number }[]
  latest: SmartRmEvent[]
}

const DEFAULTS = { q: '', year: '', month: '', severity: '', department: '', riskType: '', page: '1' }
const PAGE_SIZE = 20
const CATEGORY_PALETTE = ['#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']
const TABLE_COLUMNS = ['หมายเลข', 'วันที่เกิดเหตุ', 'สถานที่', 'ประเภท', 'RM', 'เหตุการณ์', 'สถานะ IOR']

function fmt(n: number) {
  return n.toLocaleString('th-TH')
}

/** ย่อชื่อยาวให้พออ่านบนแกนกราฟ แต่เก็บชื่อเต็มไว้ใน tooltip */
function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function SmartRmClient({ canEdit }: { canEdit: boolean }) {
  const { filters, setFilters } = useUrlFilters(DEFAULTS)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [rows, setRows] = useState<SmartRmEvent[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const sync = () => setNarrow(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== DEFAULTS[key as keyof typeof DEFAULTS]) params.set(key, value)
  }
  params.set('pageSize', String(PAGE_SIZE))
  const queryString = params.toString()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams(queryString)
    try {
      const [analyticsRes, listRes] = await Promise.all([
        fetch(`/api/admin/risk/smart-rm?view=analytics&${params}`),
        fetch(`/api/admin/risk/smart-rm?${params}`),
      ])
      const [analyticsJson, listJson] = await Promise.all([analyticsRes.json(), listRes.json()])
      if (!analyticsRes.ok) throw new Error(analyticsJson.error ?? 'โหลดข้อมูลสรุปไม่สำเร็จ')
      if (!listRes.ok) throw new Error(listJson.error ?? 'โหลดรายการไม่สำเร็จ')
      setAnalytics(analyticsJson)
      setRows(listJson.data ?? [])
      setCount(Number(listJson.count ?? 0))
    } catch (err) {
      setError((err as Error).message)
      setAnalytics(null)
      setRows([])
      setCount(0)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString])

  useEffect(() => { void load() }, [load])

  const avgPerMonth = analytics && analytics.monthCount > 0
    ? Math.round(analytics.total / analytics.monthCount)
    : analytics?.total ?? 0
  const topBarCount = narrow ? 5 : 10

  return (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      <style>{`
        .smart-grid-2{display:grid;grid-template-columns:1.15fr .85fr;gap:12px}
        .smart-grid-even{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .smart-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
        @media(max-width:900px){.smart-grid-2,.smart-grid-even{grid-template-columns:1fr}}
      `}</style>

      <PageHeader
        eyebrow="SMART-RM"
        title="วิเคราะห์ข้อมูล Smart-RM"
        subtitle="ข้อมูลอุบัติการณ์นำเข้าจากระบบโรงพยาบาล ใช้ดูภาพรวมและแนวโน้ม ไม่มีการติดตามงานในระบบนี้"
        marginBottom={0}
        actions={canEdit ? <Button variant="primary" icon="upload" onClick={() => setImporting(true)}>นำเข้าข้อมูล</Button> : undefined}
      />

      <ModuleSubnav items={RISK_NAVIGATION} label="เมนูทะเบียนความเสี่ยง" />

      <ErrorBanner message={error} />

      <Panel title="ตัวกรอง">
        <FilterBar>
          <SearchFilter
            value={filters.q}
            placeholder="ค้นหาหมายเลข / เหตุการณ์ / หน่วยงาน"
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
            label="ประเภท"
            value={filters.riskType}
            allLabel="ทุกประเภท"
            options={[{ value: 'Clinic', label: 'Clinic' }, { value: 'Non-Clinic', label: 'Non-Clinic' }]}
            onChange={riskType => setFilters({ riskType })}
          />
          <SelectFilter
            label="หน่วยงาน"
            value={filters.department}
            allLabel="ทุกหน่วยงาน"
            options={LAB_DEPARTMENTS.map(d => ({ value: d, label: d }))}
            onChange={department => setFilters({ department })}
          />
        </FilterBar>
      </Panel>

      {loading && !analytics ? (
        <ChartSkeleton />
      ) : analytics && analytics.total === 0 ? (
        <Panel>
          <EmptyState
            icon="chart"
            title="ยังไม่มีข้อมูลในช่วงที่เลือก"
            hint={canEdit ? 'ลองเปลี่ยนตัวกรอง หรือนำเข้าข้อมูลจากไฟล์ Smart-RM' : 'ลองเปลี่ยนตัวกรองเพื่อดูช่วงเวลาอื่น'}
          />
        </Panel>
      ) : analytics && (
        <>
          <div className="smart-kpis">
            <Kpi label="ทั้งหมด" value={analytics.total} sub="เหตุการณ์" icon="inbox" tone="var(--primary)" />
            <Kpi label="Clinic" value={analytics.clinic} sub={`${Math.round(analytics.clinic / analytics.total * 100)}% ของทั้งหมด`} icon="flask" tone="var(--success)" />
            <Kpi label="Non-Clinic" value={analytics.nonClinic} sub={`${Math.round(analytics.nonClinic / analytics.total * 100)}% ของทั้งหมด`} icon="building" tone="var(--warning)" />
            <Kpi label="รุนแรง E–I" value={analytics.severe} sub="ระดับที่ต้องเฝ้าระวัง" icon="alert" tone="var(--danger)" />
            <Kpi label="เฉลี่ยต่อเดือน" value={avgPerMonth} sub="เหตุการณ์" icon="chart" tone="var(--primary)" />
          </div>

          <div className="smart-grid-2">
            <Panel title="แนวโน้มรายเดือน">
              {analytics.monthly.length < 4 ? (
                <SparseNotice points={analytics.monthly} />
              ) : (
                <div
                  style={{ height: 280, minWidth: 0 }}
                  role="img"
                  aria-label={`แนวโน้มรายเดือน ${analytics.monthly.length} เดือน สูงสุด ${fmt(Math.max(...analytics.monthly.map(m => m.value)))} เหตุการณ์`}
                >
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={analytics.monthly} margin={{ top: 8, right: 18, bottom: 0, left: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} width={38} tickFormatter={fmt} />
                      <Tooltip formatter={(v) => [fmt(Number(v)), 'เหตุการณ์']} contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="value" stroke="var(--primary)" fill="var(--primary-soft)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel title="Clinic เทียบกับ Non-Clinic">
              <TypeSplit clinic={analytics.clinic} nonClinic={analytics.nonClinic} total={analytics.total} />
            </Panel>
          </div>

          <div className="smart-grid-even">
            <Panel title={`สถานที่เกิดเหตุสูงสุด ${topBarCount} อันดับ`}>
              <RankedBars data={analytics.departments.slice(0, topBarCount)} singleColor="#06B6D4" />
            </Panel>
            <Panel title="ประเภทเหตุการณ์หลัก">
              <RankedBars data={analytics.categories.slice(0, topBarCount)} />
            </Panel>
          </div>

          <Panel title="ระดับความรุนแรง RM">
            <SeverityBars data={analytics.severity} />
          </Panel>
        </>
      )}

      <Panel title="รายการเหตุการณ์" padding={0}>
        <div style={{ padding: SPACE.md, borderBottom: '1px solid var(--border)' }}>
          <Pagination
            page={Number(filters.page) || 1}
            pageSize={PAGE_SIZE}
            count={count}
            onChange={page => setFilters({ page: String(page) }, { resetPage: false })}
          />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900, fontSize: FONT.base }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {TABLE_COLUMNS.map(h => (
                  <th key={h} scope="col" style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontSize: FONT.xs, fontWeight: 700, borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <TableSkeleton cols={TABLE_COLUMNS.length} />}
              {!loading && rows.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...td, ...tabularNums, fontWeight: 600 }}>{row.external_no}</td>
                  <td style={{ ...td, ...tabularNums }}>{formatThaiDate(row.event_date)}</td>
                  <td style={td}>{row.department_found ?? '—'}</td>
                  <td style={td}>{row.risk_type ?? '—'}</td>
                  <td style={td}><SeverityBadge severity={row.severity_level} /></td>
                  <td style={{ ...td, maxWidth: 340 }}>
                    <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{row.event_main_category ?? '—'}</div>
                    <div style={{ color: 'var(--muted)' }}>{row.event_detail ?? ''}</div>
                  </td>
                  <td style={{ ...td, color: 'var(--muted)' }}>{row.ior_status ?? '—'}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length}>
                    <EmptyState icon="search" title="ไม่พบรายการที่ตรงกับตัวกรอง" hint="ลองล้างคำค้นหรือเลือกช่วงเวลาที่กว้างขึ้น" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {canEdit && importing && (
        <SmartRmImportModal onClose={() => setImporting(false)} onImported={() => { setImporting(false); void load() }} />
      )}
    </div>
  )
}

const td: React.CSSProperties = { padding: '10px 12px', color: 'var(--ink)', verticalAlign: 'top' }
const tooltipStyle: React.CSSProperties = {
  fontSize: 12, borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--card)', color: 'var(--ink)',
}

/** ข้อมูลน้อยเกินกว่าจะอ่านเป็นเส้นแนวโน้ม จึงแสดงเป็นตัวเลขตรง ๆ แทน */
function SparseNotice({ points }: { points: { name: string; value: number }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.sm }}>
      {points.length === 0 && <p style={{ margin: 0, color: 'var(--muted)', fontSize: FONT.md }}>ยังไม่มีข้อมูลในช่วงที่เลือก</p>}
      {points.map(point => (
        <div key={point.name} style={{ padding: SPACE.sm, borderRadius: 10, background: 'var(--surface-2)', minWidth: 110 }}>
          <div style={{ color: 'var(--muted)', fontSize: FONT.xs, fontWeight: 600 }}>{point.name}</div>
          <div style={{ ...tabularNums, color: 'var(--ink)', fontSize: FONT.xl, fontWeight: 700 }}>{fmt(point.value)}</div>
        </div>
      ))}
      {points.length > 0 && (
        <p style={{ width: '100%', margin: 0, color: 'var(--muted)', fontSize: FONT.xs }}>
          มีข้อมูลน้อยกว่า 4 เดือน จึงแสดงเป็นตัวเลขแทนกราฟเส้น
        </p>
      )}
    </div>
  )
}

function TypeSplit({ clinic, nonClinic, total }: { clinic: number; nonClinic: number; total: number }) {
  const data = [
    { name: 'Clinic', value: clinic, color: '#0EA5E9' },
    { name: 'Non-Clinic', value: nonClinic, color: '#F59E0B' },
  ].filter(d => d.value > 0)

  if (data.length === 0) {
    return <p style={{ margin: 0, color: 'var(--muted)', fontSize: FONT.md }}>ยังไม่มีข้อมูลในช่วงที่เลือก</p>
  }

  return (
    <>
      <div
        style={{ height: 240, minWidth: 0 }}
        role="img"
        aria-label={`Clinic ${fmt(clinic)} รายการ Non-Clinic ${fmt(nonClinic)} รายการ`}
      >
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
              {data.map(d => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip formatter={(v, n) => [fmt(Number(v)), String(n)]} contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* ตัวเลขและร้อยละอยู่บนหน้าจอตลอด ไม่ต้องชี้เมาส์ถึงจะเห็น */}
      <ul style={{ display: 'flex', justifyContent: 'center', gap: SPACE.md, listStyle: 'none', margin: 0, padding: 0, flexWrap: 'wrap' }}>
        {data.map(d => (
          <li key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT.base, color: 'var(--ink)' }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: d.color, display: 'inline-block' }} />
            {d.name}
            <strong style={tabularNums}>{fmt(d.value)}</strong>
            <span style={{ color: 'var(--muted)', ...tabularNums }}>({Math.round(d.value / total * 100)}%)</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function RankedBars({ data, singleColor }: { data: { name: string; value: number }[]; singleColor?: string }) {
  if (data.length === 0) {
    return <p style={{ margin: 0, color: 'var(--muted)', fontSize: FONT.md }}>ยังไม่มีข้อมูลในช่วงที่เลือก</p>
  }
  const shaped = data.map(d => ({ ...d, short: truncate(d.name, 24) }))
  return (
    <div
      style={{ height: 280, minWidth: 0 }}
      role="img"
      aria-label={`${data.length} อันดับแรก สูงสุดคือ ${data[0].name} ที่ ${fmt(data[0].value)} เหตุการณ์`}
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart layout="vertical" data={shaped} margin={{ top: 2, right: 40, bottom: 0, left: 8 }}>
          <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickFormatter={fmt} />
          <YAxis type="category" dataKey="short" width={170} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
          <Tooltip
            formatter={(v) => [fmt(Number(v)), 'เหตุการณ์']}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''}
            contentStyle={tooltipStyle}
          />
          <Bar dataKey="value" radius={[0, 5, 5, 0]}>
            {shaped.map((_, i) => <Cell key={i} fill={singleColor ?? CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]} />)}
            {/* ตัวเลขกำกับท้ายแท่ง เพื่อไม่ต้องกะค่าจากความยาว */}
            <LabelList dataKey="value" position="right" formatter={(v) => fmt(Number(v ?? 0))} style={{ fontSize: 11, fill: 'var(--muted)' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function SeverityBars({ data }: { data: { name: string; value: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <ul style={{ display: 'flex', flexDirection: 'column', gap: 9, listStyle: 'none', margin: 0, padding: 0 }}>
      {data.map(item => (
        <li key={item.name} style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
          <span style={{ width: 30, flex: '0 0 auto' }}><SeverityBadge severity={item.name} /></span>
          <span aria-hidden="true" style={{ flex: 1, height: 10, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${Math.round(item.value / max * 100)}%`, background: 'var(--primary)', borderRadius: 999 }} />
          </span>
          <span style={{ ...tabularNums, width: 52, textAlign: 'right', color: 'var(--muted)', fontSize: FONT.base }}>{fmt(item.value)}</span>
        </li>
      ))}
    </ul>
  )
}

function ChartSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} style={{ height: 84, borderRadius: 10, background: 'var(--surface-2)' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ height: 320, borderRadius: 12, background: 'var(--surface-2)' }} />
        <div style={{ height: 320, borderRadius: 12, background: 'var(--surface-2)' }} />
      </div>
    </div>
  )
}
