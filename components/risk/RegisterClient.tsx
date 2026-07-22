'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilterChips } from '@/components/ui/FilterChips'
import { ModuleSubnav } from '@/components/ui/ModuleSubnav'
import { PageHeader } from '@/components/ui/PageHeader'
import { RISK_NAVIGATION } from '@/lib/navigation'
import { reviewState } from '@/lib/risk/register'
import { RegisterDetailModal, ReviewBadge, type RegisterEntry } from './RegisterDetailModal'
import { RegisterFormModal } from './RegisterFormModal'
import { RiskMatrix } from './RiskMatrix'
import { isMatrixView, type MatrixRisk } from '@/lib/risk/matrix'
import { ExportMenu } from './shared/ExportMenu'
import { ActiveFilterBar, FilterBar, Pagination, SearchFilter, SelectFilter } from './shared/FilterBar'
import { ErrorBanner, LevelBadge, Panel, StatusBadge, TableSkeleton } from './shared/ui'
import { useUrlFilters } from './shared/useUrlFilters'
import {
  FONT, LAB_DEPARTMENTS, LEVEL_LABEL, REGISTER_STATUSES, SPACE, formatThaiDate, tabularNums,
} from './shared/tokens'

const DEFAULTS = {
  q: '', status: '', level: '', residualLevel: '', department: '', reviewDue: '', page: '1',
  likelihood: '', impact: '', residualLikelihood: '', residualImpact: '', matrix: '',
}
const PAGE_SIZE = 20
const COLUMNS = ['รหัส', 'ความเสี่ยง', 'หน่วยงาน', 'ก่อนมาตรการ', 'หลังมาตรการ', 'ผู้รับผิดชอบ', 'ทบทวนครั้งถัดไป', 'สถานะ']
const LEVEL_OPTIONS = (['high', 'medium', 'low'] as const).map(l => ({ value: l, label: LEVEL_LABEL[l] }))

export function RegisterClient({ canEdit, canReview, actorName }: {
  canEdit: boolean
  canReview: boolean
  actorName: string | null
}) {
  const { filters, setFilters } = useUrlFilters(DEFAULTS)
  const [rows, setRows] = useState<RegisterEntry[]>([])
  const [count, setCount] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [matrix, setMatrix] = useState<MatrixRisk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    // matrix เป็นมุมมองการแสดงผลล้วน ไม่ใช่ตัวกรอง — ส่งไปด้วยจะทำให้สลับมุมมองแล้วยิง request ใหม่ฟรี ๆ
    if (key === 'matrix') continue
    if (value && value !== DEFAULTS[key as keyof typeof DEFAULTS]) params.set(key, value)
  }
  params.set('pageSize', String(PAGE_SIZE))
  const queryString = params.toString()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // ตารางความเสี่ยงใช้ตัวกรองชุดเดียวกับรายการ ตัวเลขสองส่วนจึงตรงกันเสมอ
      const [listRes, matrixRes] = await Promise.all([
        fetch(`/api/admin/risk/register?${queryString}`),
        fetch(`/api/admin/risk/register?view=matrix&${queryString}`),
      ])
      const [json, matrixJson] = await Promise.all([listRes.json(), matrixRes.json()])
      if (!listRes.ok) throw new Error(json.error ?? 'โหลดทะเบียนไม่สำเร็จ')
      if (!matrixRes.ok) throw new Error(matrixJson.error ?? 'โหลดตารางความเสี่ยงไม่สำเร็จ')
      setRows(json.data ?? [])
      setCount(Number(json.count ?? 0))
      setStatusCounts(json.statusCounts ?? {})
      setMatrix(matrixJson.matrix ?? [])
    } catch (err) {
      setError((err as Error).message)
      setRows([])
      setCount(0)
      setMatrix([])
    } finally {
      setLoading(false)
    }
  }, [queryString])

  useEffect(() => { void load() }, [load])

  // page กับ matrix ไม่ใช่ตัวกรอง จึงไม่นับว่าทำให้ผลลัพธ์แคบลง
  const activeFilters = (Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[])
    .filter(key => key !== 'page' && key !== 'matrix')
    .filter(key => filters[key] !== DEFAULTS[key])

  // L/S ตั้งได้จากการกดช่องในตารางเท่านั้น ไม่มีช่องควบคุมบนหน้าจอ
  // ถ้าไม่บอกว่ากรองอยู่ ผู้ใช้จะงงว่าทำไมรายการหายไปและหาทางเอากลับไม่เจอ
  const cellFilter = [
    filters.likelihood && `โอกาสเกิด ${filters.likelihood}`,
    filters.impact && `ผลกระทบ ${filters.impact}`,
    filters.residualLikelihood && `โอกาสเกิดหลังมาตรการ ${filters.residualLikelihood}`,
    filters.residualImpact && `ผลกระทบหลังมาตรการ ${filters.residualImpact}`,
  ].filter(Boolean).join(' · ')

  const chips = [
    { value: '', label: 'ทั้งหมด', count: Object.values(statusCounts).reduce((a, b) => a + b, 0) },
    ...REGISTER_STATUSES.map(s => ({ value: s.value as string, label: s.label, count: statusCounts[s.value] ?? 0 })),
  ]

  return (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      <PageHeader
        eyebrow="RISK REGISTER"
        title="ทะเบียนความเสี่ยง"
        subtitle="ประเมินความเสี่ยงเชิงรุกด้วยโอกาสเกิด × ผลกระทบ พร้อมมาตรการและรอบทบทวนประจำปี ตาม ISO 15189 ข้อ 8.5"
        marginBottom={0}
        actions={
          <>
            <ExportMenu target="register" query={queryString} />
            {canEdit && <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>เพิ่มความเสี่ยง</Button>}
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
              placeholder="ค้นหารหัส / ความเสี่ยง / ผู้รับผิดชอบ"
              onCommit={q => setFilters({ q })}
            />
            <SelectFilter
              label="ระดับก่อนมาตรการ"
              value={filters.level}
              allLabel="ทุกระดับ"
              options={LEVEL_OPTIONS}
              onChange={level => setFilters({ level })}
            />
            <SelectFilter
              label="ระดับหลังมาตรการ"
              value={filters.residualLevel}
              allLabel="ทุกระดับ"
              options={LEVEL_OPTIONS}
              onChange={residualLevel => setFilters({ residualLevel })}
            />
            <SelectFilter
              label="หน่วยงาน"
              value={filters.department}
              allLabel="ทุกหน่วยงาน"
              options={LAB_DEPARTMENTS.map(d => ({ value: d, label: d }))}
              onChange={department => setFilters({ department })}
            />
            <SelectFilter
              label="รอบทบทวน"
              value={filters.reviewDue}
              allLabel="ทั้งหมด"
              options={[{ value: '1', label: 'ใกล้ครบหรือเลยกำหนด' }]}
              onChange={reviewDue => setFilters({ reviewDue })}
            />
          </FilterBar>

          <ActiveFilterBar
            count={activeFilters.length}
            detail={cellFilter || undefined}
            // มุมมองตารางไม่ใช่ตัวกรอง จึงต้องคงไว้ตอนล้าง
            onClear={() => setFilters({ ...DEFAULTS, matrix: filters.matrix })}
          />
        </div>
      </Panel>

      <Panel title="ตารางความเสี่ยง (Risk Matrix)">
        <RiskMatrix
          risks={matrix}
          view={isMatrixView(filters.matrix) ? filters.matrix : 'residual'}
          onSelectCell={(likelihood, impact) => setFilters(
            isMatrixView(filters.matrix) && filters.matrix === 'residual'
              ? { residualLikelihood: String(likelihood), residualImpact: String(impact) }
              : { likelihood: String(likelihood), impact: String(impact) },
          )}
        />
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
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1040, fontSize: FONT.base }}>
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
                      {row.risk_no ?? `#${row.id}`}
                    </button>
                  </td>
                  <td style={{ ...td, maxWidth: 340 }}>
                    <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{row.process_step || row.hazard_category || '—'}</div>
                    <div style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.risk_statement}</div>
                  </td>
                  <td style={td}>{row.department ?? '—'}</td>
                  <td style={td}><LevelBadge level={row.level} score={row.score} /></td>
                  <td style={td}><LevelBadge level={row.residual_level} score={row.residual_score} /></td>
                  <td style={td}>{row.owner ?? '—'}</td>
                  <td style={{ ...td, ...tabularNums }}>
                    <div>{formatThaiDate(row.next_review_date)}</div>
                    <ReviewBadge state={reviewState(row.next_review_date)} nextReview={row.next_review_date} />
                  </td>
                  <td style={td}><StatusBadge statuses={REGISTER_STATUSES} value={row.status} /></td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length}>
                    <EmptyState
                      icon="clipboard"
                      title="ยังไม่มีรายการในทะเบียน"
                      hint={canEdit ? 'เพิ่มความเสี่ยงที่ประเมินไว้ เพื่อเริ่มติดตามมาตรการและรอบทบทวน' : 'ลองล้างตัวกรองเพื่อดูรายการทั้งหมด'}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {canEdit && creating && (
        <RegisterFormModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void load() }} />
      )}
      {openId !== null && (
        <RegisterDetailModal
          entryId={openId}
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
