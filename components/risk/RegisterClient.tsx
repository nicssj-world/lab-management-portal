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
import { ActiveFilterBar, FilterBar, Pagination, SearchFilter, SelectFilter, type ActiveFilterItem } from './shared/FilterBar'
import { ErrorBanner, LevelBadge, Panel, StatusBadge, TableSkeleton } from './shared/ui'
import { useUrlFilters } from './shared/useUrlFilters'
import {
  FONT, LAB_DEPARTMENTS, LEVEL_LABEL, REGISTER_STATUSES, SPACE, formatThaiDate, tabularNums,
} from './shared/tokens'

const DEFAULTS = {
  q: '', status: '', level: '', residualLevel: '', department: '', reviewDue: '', page: '1',
  likelihood: '', impact: '', residualLikelihood: '', residualImpact: '', matrix: '',
  spaceCode: '', active: '',
}
const PAGE_SIZE = 20
const COLUMNS = ['รหัส', 'ความเสี่ยง', 'หน่วยงาน', 'ก่อนมาตรการ', 'หลังมาตรการ', 'ผู้รับผิดชอบ', 'ทบทวนครั้งถัดไป', 'สถานะ']
const LEVEL_OPTIONS = (['high', 'medium', 'low'] as const).map(l => ({ value: l, label: LEVEL_LABEL[l] }))

export function RegisterClient({ canEdit, canReview, canClose, actorName }: {
  canEdit: boolean
  canReview: boolean
  canClose: boolean
  actorName: string | null
}) {
  const { filters, setFilters, clearFilters } = useUrlFilters(DEFAULTS)
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

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      // ตารางความเสี่ยงใช้ตัวกรองชุดเดียวกับรายการ ตัวเลขสองส่วนจึงตรงกันเสมอ
      const [listRes, matrixRes] = await Promise.all([
        fetch(`/api/admin/risk/register?${queryString}`, { signal }),
        fetch(`/api/admin/risk/register?view=matrix&${queryString}`, { signal }),
      ])
      const [json, matrixJson] = await Promise.all([listRes.json(), matrixRes.json()])
      if (!listRes.ok) throw new Error(json.error ?? 'โหลดทะเบียนไม่สำเร็จ')
      if (!matrixRes.ok) throw new Error(matrixJson.error ?? 'โหลดตารางความเสี่ยงไม่สำเร็จ')
      setRows(json.data ?? [])
      setCount(Number(json.count ?? 0))
      setStatusCounts(json.statusCounts ?? {})
      setMatrix(matrixJson.matrix ?? [])
    } catch (err) {
      if (signal?.aborted) return
      setError((err as Error).message)
      setRows([])
      setCount(0)
      setMatrix([])
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  // รวมตัวกรองจากช่องบนหน้าและตัวกรองที่ติดมากับลิงก์/การกดช่องใน Matrix
  // ไว้ในรายการเดียว เพื่อให้ผู้ใช้รู้ว่าผลลัพธ์ถูกจำกัดด้วยอะไรและเอาออกทีละตัวได้
  const activeFilterItems: ActiveFilterItem[] = []
  if (filters.q) activeFilterItems.push({ key: 'q', label: `คำค้น: ${filters.q}`, onRemove: () => setFilters({ q: '' }) })
  if (filters.status) {
    const statusLabel = REGISTER_STATUSES.find(status => status.value === filters.status)?.label ?? filters.status
    activeFilterItems.push({ key: 'status', label: `สถานะ: ${statusLabel}`, onRemove: () => setFilters({ status: '' }) })
  }
  if (filters.level) activeFilterItems.push({ key: 'level', label: `ก่อนมาตรการ: ${LEVEL_LABEL[filters.level as keyof typeof LEVEL_LABEL] ?? filters.level}`, onRemove: () => setFilters({ level: '' }) })
  if (filters.residualLevel) activeFilterItems.push({ key: 'residualLevel', label: `หลังมาตรการ: ${LEVEL_LABEL[filters.residualLevel as keyof typeof LEVEL_LABEL] ?? filters.residualLevel}`, onRemove: () => setFilters({ residualLevel: '' }) })
  if (filters.department) activeFilterItems.push({ key: 'department', label: `หน่วยงาน: ${filters.department}`, onRemove: () => setFilters({ department: '' }) })
  if (filters.reviewDue) activeFilterItems.push({ key: 'reviewDue', label: 'รอบทบทวน: ใกล้ครบหรือเลยกำหนด', onRemove: () => setFilters({ reviewDue: '' }) })
  if (filters.likelihood) activeFilterItems.push({ key: 'likelihood', label: `ก่อนมาตรการ: โอกาสเกิด ${filters.likelihood}`, onRemove: () => setFilters({ likelihood: '' }) })
  if (filters.impact) activeFilterItems.push({ key: 'impact', label: `ก่อนมาตรการ: ผลกระทบ ${filters.impact}`, onRemove: () => setFilters({ impact: '' }) })
  if (filters.residualLikelihood) activeFilterItems.push({ key: 'residualLikelihood', label: `หลังมาตรการ: โอกาสเกิด ${filters.residualLikelihood}`, onRemove: () => setFilters({ residualLikelihood: '' }) })
  if (filters.residualImpact) activeFilterItems.push({ key: 'residualImpact', label: `หลังมาตรการ: ผลกระทบ ${filters.residualImpact}`, onRemove: () => setFilters({ residualImpact: '' }) })
  if (filters.spaceCode) activeFilterItems.push({ key: 'spaceCode', label: `พื้นที่: ${filters.spaceCode}`, onRemove: () => setFilters({ spaceCode: '' }) })
  if (filters.active) activeFilterItems.push({ key: 'active', label: 'เฉพาะรายการที่ยังไม่ปิด', onRemove: () => setFilters({ active: '' }) })

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
            items={activeFilterItems}
            // มุมมอง matrix ไม่ใช่ตัวกรอง จึงคงมุมมองเดิมไว้ตอนล้าง
            onClear={() => clearFilters(['matrix'])}
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
        <div aria-busy={loading} style={{ overflowX: 'auto' }}>
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
                      hint={activeFilterItems.length > 0 ? 'ลองล้างตัวกรองหรือปรับเงื่อนไขให้กว้างขึ้น' : canEdit ? 'เพิ่มความเสี่ยงที่ประเมินไว้ เพื่อเริ่มติดตามมาตรการและรอบทบทวน' : 'ยังไม่มีรายการความเสี่ยงในระบบ'}
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
          canClose={canClose}
          actorName={actorName}
          onClose={() => setOpenId(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  )
}

const td: React.CSSProperties = { padding: '10px 12px', color: 'var(--ink)', verticalAlign: 'top' }
