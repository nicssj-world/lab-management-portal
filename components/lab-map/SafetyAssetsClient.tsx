'use client'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Badge, type BadgeColor } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { uploadFileWithProgress } from '@/lib/documents/upload-with-progress'
import { normalizeRole } from '@/lib/roles'
import { buildSafetyInspectionQueue, nextSafetyAssetCode, previousSafetyAssetCode } from '@/lib/lab-map/safety-inspection-workflow'
import type {
  AssemblyPointDTO, AssemblyPointVerificationDTO, LabMapDTO, LabPointType, SafetyAssetDTO, SafetyInspectionDTO,
  SafetyInspectionRoundDTO,
} from '@/lib/lab-map/types'
import { LabMapCanvas } from './LabMapCanvas'
import { LabMapStyles } from './LabMapStyles'
import { SafetyAssetsStyles } from './SafetyAssetsStyles'
import { SafetyPhotoPicker } from './SafetyPhotoPicker'
import { SafetyInspectionMobile } from './SafetyInspectionMobile'
import { SafetyInspectionProgress } from './SafetyInspectionProgress'
import { SafetyAssetScanner } from './SafetyAssetScanner'

type StaffOption = { id: string; name: string | null; role: string }
type EditorOption = { user_id: string }
type Tab = 'assets' | 'assembly' | 'editors'
type SafetyMobileView = 'list' | 'map' | 'inspect'

const KIND_LABELS: Record<string, string> = {
  'fire-extinguisher': 'ถังดับเพลิง', 'fire-hose': 'สายฉีดน้ำดับเพลิง',
  'manual-call-point': 'จุดกดแจ้งเหตุ', aed: 'AED', 'first-aid-kit': 'ชุดปฐมพยาบาล',
  eyewash: 'อ่างล้างตา', 'emergency-shower': 'ฝักบัวฉุกเฉิน', 'spill-kit': 'Spill Kit',
  'emergency-shutoff': 'จุดตัดฉุกเฉิน',
}
const STATUS_LABELS: Record<string, string> = {
  unverified: 'รอยืนยันตำแหน่ง', verified: 'ยืนยันตำแหน่งแล้ว', passed: 'ผ่าน',
  needs_attention: 'ต้องติดตาม', failed: 'ไม่พร้อมใช้', overdue: 'เกินกำหนดตรวจ', due_soon: 'ใกล้ครบกำหนด',
}
const STATUS_COLORS: Record<string, BadgeColor> = {
  unverified: 'amber', verified: 'blue', passed: 'green', needs_attention: 'amber',
  failed: 'red', overdue: 'red', due_soon: 'amber',
}
const POINT_TYPE_LABELS: Record<LabPointType, string> = {
  assembly: 'จุดรวมพล', safe: 'จุดปลอดภัย',
}
const POINT_TYPE_COLORS: Record<LabPointType, BadgeColor> = {
  assembly: 'blue', safe: 'green',
}
const EXIT_OPTIONS = ['exit-3a', 'exit-3b', 'exit-3c']

function pointTypeLabel(pointType?: LabPointType) {
  return POINT_TYPE_LABELS[pointType ?? 'assembly']
}

function pointTypeColor(pointType?: LabPointType) {
  return POINT_TYPE_COLORS[pointType ?? 'assembly']
}

function todayIso() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) }

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json.error ?? 'ดำเนินการไม่สำเร็จ')
  return json
}

export function SafetyAssetsClient({ map, initialAssets, initialAssemblyPoints, canEdit, canManage, isAdmin, staff, initialEditors }: {
  map: LabMapDTO
  initialAssets: SafetyAssetDTO[]
  initialAssemblyPoints: AssemblyPointDTO[]
  canEdit: boolean
  canManage: boolean
  isAdmin: boolean
  staff: StaffOption[]
  initialEditors: EditorOption[]
}) {
  const [tab, setTab] = useState<Tab>('assets')
  const [assets, setAssets] = useState(initialAssets)
  const [points, setPoints] = useState(initialAssemblyPoints)
  const [editors, setEditors] = useState(new Set(initialEditors.map(item => item.user_id)))
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [kind, setKind] = useState('')
  const [spaceCode, setSpaceCode] = useState('')
  const [mobileView, setMobileView] = useState<SafetyMobileView>('list')
  const [activeRound, setActiveRound] = useState<SafetyInspectionRoundDTO | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [assetDraft, setAssetDraft] = useState<Partial<SafetyAssetDTO> | null>(null)
  const [pointDraft, setPointDraft] = useState<Partial<AssemblyPointDTO> | null>(null)
  const [editorQuery, setEditorQuery] = useState('')
  const [positionFailure, setPositionFailure] = useState<{
    message: string
    input: { id: string; code: string; x: number; y: number; spaceCode: string | null }
  } | null>(null)
  const listScrollTopRef = useRef(0)
  const listContainerRef = useRef<HTMLDivElement>(null)

  const workingMap = useMemo<LabMapDTO>(() => ({ ...map, safetyEquipment: assets, assemblyPoints: points }), [map, assets, points])
  const selectedAsset = assets.find(item => item.code === selectedCode) ?? null
  const selectedPoint = points.find(item => item.code === selectedCode) ?? null
  const selectedLocationLabel = selectedAsset
    ? map.spaces.find(space => space.code === selectedAsset.spaceCode)?.nameTh ?? selectedAsset.spaceCode ?? 'ไม่ระบุห้อง'
    : 'ไม่ระบุห้อง'
  const selectedRoundItem = selectedAsset
    ? activeRound?.items.find(item => item.assetId === selectedAsset.id) ?? null
    : null
  const completedAssetIds = useMemo(() => new Set(
    activeRound?.items.filter(item => item.status === 'completed').map(item => item.assetId) ?? [],
  ), [activeRound])
  const roundAssetIds = useMemo(() => activeRound
    ? new Set(activeRound.items.map(item => item.assetId))
    : null, [activeRound])
  const queueAssets = roundAssetIds ? assets.filter(item => roundAssetIds.has(item.id)) : assets
  const inspectionQueue = useMemo(() => buildSafetyInspectionQueue({
    assets: queueAssets,
    filters: { query, status, kind, spaceCode },
    completedAssetIds,
  }), [queueAssets, completedAssetIds, kind, query, spaceCode, status])
  const filteredAssets = inspectionQueue.items.map(item => item.asset)
  const inspectionResultCounts = useMemo(() => inspectionQueue.items.reduce((counts, queueItem) => {
    if (!queueItem.completed) return counts
    const result = queueItem.asset.latestInspection?.result
    if (result === 'passed') counts.passed += 1
    else if (result === 'needs_attention') counts.needsAttention += 1
    else if (result === 'failed') counts.failed += 1
    else if (result === 'not_found') counts.notFound += 1
    return counts
  }, { passed: 0, needsAttention: 0, failed: 0, notFound: 0 }), [inspectionQueue])
  const automaticEditors = useMemo(
    () => staff.filter(person => ['Admin', 'Manager'].includes(normalizeRole(person.role))),
    [staff],
  )
  const assignableStaff = useMemo(
    () => staff.filter(person => !['Admin', 'Manager'].includes(normalizeRole(person.role))),
    [staff],
  )
  const visibleAssignableStaff = useMemo(() => {
    const normalized = editorQuery.trim().toLocaleLowerCase('th')
    if (!normalized) return assignableStaff
    return assignableStaff.filter(person => `${person.name ?? ''} ${person.role}`.toLocaleLowerCase('th').includes(normalized))
  }, [assignableStaff, editorQuery])
  const assignedEditorCount = assignableStaff.filter(person => editors.has(person.id)).length

  useEffect(() => {
    if (!canEdit) return
    let active = true
    void jsonRequest('/api/admin/lab-map/safety-inspection-rounds')
      .then(result => {
        if (!active || !result.data) return
        setActiveRound(result.data)
        setQuery(result.data.filters.query)
        setStatus(result.data.filters.status)
        setKind(result.data.filters.kind)
        setSpaceCode(result.data.filters.spaceCode)
      })
      .catch(reason => { if (active) setError((reason as Error).message) })
    return () => { active = false }
  }, [canEdit])

  useEffect(() => {
    if (!selectedAsset) return
    if (!inspectionQueue.items.some(item => item.asset.id === selectedAsset.id)) {
      setSelectedCode(null)
      setMobileView('list')
    }
  }, [inspectionQueue, selectedAsset])

  async function reload() {
    const [assetResult, pointResult] = await Promise.all([
      jsonRequest('/api/admin/lab-map/safety-assets'),
      jsonRequest('/api/admin/lab-map/assembly-points'),
    ])
    setAssets(assetResult.items)
    setPoints(pointResult.items)
  }

  async function run(action: () => Promise<void>) {
    setBusy(true); setError('')
    try { await action() } catch (reason) { setError((reason as Error).message) } finally { setBusy(false) }
  }

  function selectMap(code: string) {
    setAssetDraft(null)
    setSelectedCode(code)
    if (assets.some(item => item.code === code)) {
      setTab('assets')
      if (window.matchMedia('(max-width: 767px)').matches) setMobileView('inspect')
    }
  }

  function selectAssetFromList(code: string | null) {
    setAssetDraft(null)
    setSelectedCode(code)
    if (code && window.matchMedia('(max-width: 767px)').matches) {
      listScrollTopRef.current = listContainerRef.current?.scrollTop ?? 0
      setMobileView('inspect')
    }
  }

  function beginAssetPlacement() {
    setSelectedCode(null)
    setAssetDraft({
      code: '', nameTh: '', kind: 'fire-extinguisher', shutoffFor: null,
      x: 739, y: 446, spaceCode: null,
    })
    setMobileView('map')
  }

  function openAssetByCode(code: string) {
    const asset = assets.find(item => item.code.toLocaleLowerCase('en-US') === code.trim().toLocaleLowerCase('en-US'))
    if (!asset) {
      setError(`ไม่พบอุปกรณ์รหัส ${code}`)
      return
    }
    setError('')
    selectAssetFromList(asset.code)
  }

  function updateAssetFilter(setter: (v: string) => void) {
    return (value: string) => {
      setter(value)
      setAssetDraft(null)
    }
  }

  function backToList() {
    setMobileView('list')
    requestAnimationFrame(() => {
      if (listContainerRef.current) listContainerRef.current.scrollTop = listScrollTopRef.current
    })
  }

  function adjacentPendingCode(direction: 'next' | 'previous') {
    if (!selectedCode || inspectionQueue.items.length < 2) return null
    let candidate = selectedCode
    for (let index = 0; index < inspectionQueue.items.length - 1; index += 1) {
      candidate = direction === 'next'
        ? nextSafetyAssetCode(inspectionQueue, candidate) ?? selectedCode
        : previousSafetyAssetCode(inspectionQueue, candidate) ?? selectedCode
      const queueItem = inspectionQueue.items.find(item => item.asset.code === candidate)
      if (queueItem && !queueItem.completed && queueItem.asset.code !== selectedCode) return queueItem.asset.code
    }
    return null
  }

  async function startInspectionRound() {
    const result = await jsonRequest('/api/admin/lab-map/safety-inspection-rounds', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nameTh: `รอบตรวจ ${todayIso()}`,
        filters: { query, status, kind, spaceCode },
        orderedAssetIds: inspectionQueue.items.map(item => item.asset.id),
      }),
    })
    setActiveRound(result.data)
  }

  async function closeInspectionRound() {
    if (!activeRound) return
    await jsonRequest(`/api/admin/lab-map/safety-inspection-rounds/${activeRound.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ close: true }),
    })
    setActiveRound(null)
    setSelectedCode(null)
    setMobileView('list')
  }

  async function inspectionSaved(mode: 'stay' | 'next', result: string) {
    if (!selectedAsset) return
    if (activeRound) {
      setActiveRound(current => current ? {
        ...current,
        items: current.items.map(item => item.assetId === selectedAsset.id
          ? { ...item, status: 'completed' as const }
          : item),
      } : current)
    }
    await reload()
    if (mode === 'next') {
      const nextCode = adjacentPendingCode('next')
      if (nextCode) setSelectedCode(nextCode)
    }
    void result
  }

  async function moveSafetyEquipment(input: { id: string; code: string; x: number; y: number; spaceCode: string | null }) {
    const previous = assets.find(item => item.id === input.id)
    if (!previous) return
    setPositionFailure(null)
    setAssets(current => current.map(item => item.id === input.id ? {
      ...item, x: input.x, y: input.y, spaceCode: input.spaceCode,
      verified: false, positionStatus: 'unverified' as const,
    } : item))
    try {
      const result = await jsonRequest(`/api/admin/lab-map/safety-assets/${input.id}/position`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: input.x, y: input.y, spaceCode: input.spaceCode, updatedAt: previous.updatedAt }),
      })
      setAssets(current => current.map(item => item.id === input.id ? {
        ...item,
        x: result.data.x,
        y: result.data.y,
        spaceCode: result.data.spaceCode,
        verified: false,
        positionStatus: result.data.positionStatus,
        updatedAt: result.data.updatedAt,
      } : item))
      void reload().catch(reason => setError((reason as Error).message))
    } catch (reason) {
      setAssets(current => current.map(item => item.id === input.id ? previous : item))
      setPositionFailure({ message: (reason as Error).message, input })
    }
  }

  return (
    <div className="safety-page lab-map-shell">
      <LabMapStyles /><SafetyAssetsStyles />
      <PageHeader eyebrow="SAFETY ASSET CONTROL" title="ตรวจสอบอุปกรณ์และจุดรวมพล"
        subtitle="ข้อมูลหน้างานเป็นฉบับร่างจนกว่าจะยืนยันหลักฐานและเผยแพร่แผนที่ฉบับใหม่" marginBottom={0} />
      {error ? <p role="alert" style={{ margin: 0, padding: 10, borderRadius: 8, background: 'color-mix(in srgb,var(--danger) 10%,transparent)', color: 'var(--danger)' }}>{error}</p> : null}
      <div className="safety-tabs" role="tablist" aria-label="ข้อมูลความปลอดภัย">
        <button role="tab" aria-selected={tab === 'assets'} onClick={() => setTab('assets')}>อุปกรณ์ความปลอดภัย</button>
        <button role="tab" aria-selected={tab === 'assembly'} onClick={() => setTab('assembly')}>จุดรวมพล</button>
        {isAdmin ? <button role="tab" aria-selected={tab === 'editors'} onClick={() => setTab('editors')}>ผู้รับผิดชอบ</button> : null}
      </div>

      {tab === 'editors' ? (
        <section className="safety-responsible" aria-label="กำหนด Safety Editor">
          <div className="safety-responsible-heading">
            <div>
              <p>SAFETY EDITOR ACCESS</p>
              <h2>ผู้รับผิดชอบการตรวจและยืนยันหน้างาน</h2>
              <span>แต่งตั้งเฉพาะผู้ปฏิบัติงานที่ต้องเพิ่มหรือแก้ไขข้อมูล อำนาจเผยแพร่และเลิกใช้ยังอยู่กับ Admin/Manager</span>
            </div>
            <div className="safety-responsible-count" aria-label={`แต่งตั้งแล้ว ${assignedEditorCount} คน`}>
              <strong>{assignedEditorCount}</strong><span>Safety Editor</span>
            </div>
          </div>

          <div className="safety-auto-editors">
            <div><strong>ผู้มีสิทธิ์อัตโนมัติ</strong><span>Admin และ Manager ใช้สิทธิ์ Safety Editor ได้เสมอ จึงไม่ต้องแต่งตั้งซ้ำ</span></div>
            {automaticEditors.length ? <ul>{automaticEditors.map(person => <li key={person.id}><span className="safety-avatar" aria-hidden="true">{(person.name ?? '?').trim().slice(0, 1)}</span><span><strong>{person.name ?? person.id}</strong><small>{normalizeRole(person.role)}</small></span><Badge color="blue">อัตโนมัติ</Badge></li>)}</ul> : <p className="safety-muted">ไม่พบ Admin หรือ Manager ในรายชื่อบุคลากร</p>}
          </div>

          <label className="safety-editor-search">ค้นหาบุคลากร
            <input type="search" value={editorQuery} onChange={event => setEditorQuery(event.target.value)} placeholder="ชื่อหรือบทบาท" />
          </label>
          <div className="safety-editor-list" role="list" aria-label="รายชื่อที่แต่งตั้งเป็น Safety Editor ได้">
            {visibleAssignableStaff.map(person => {
              const assigned = editors.has(person.id)
              return <article key={person.id} role="listitem">
                <span className="safety-avatar" aria-hidden="true">{(person.name ?? '?').trim().slice(0, 1)}</span>
                <div><strong>{person.name ?? person.id}</strong><small>{normalizeRole(person.role)}</small></div>
                <Badge color={assigned ? 'green' : 'gray'}>{assigned ? 'ได้รับมอบหมาย' : 'ยังไม่มอบหมาย'}</Badge>
                <Button variant={assigned ? 'secondary' : 'primary'} size="lg" disabled={busy} onClick={() => void run(async () => {
                  await jsonRequest('/api/admin/lab-map/safety-editors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: person.id, enabled: !assigned }) })
                  setEditors(current => { const next = new Set(current); assigned ? next.delete(person.id) : next.add(person.id); return next })
                })}>{assigned ? 'ถอนการมอบหมาย' : 'มอบหมาย'}</Button>
              </article>
            })}
            {!visibleAssignableStaff.length ? <EmptyState title="ไม่พบบุคลากร" hint="ลองค้นหาด้วยชื่อหรือบทบาทอื่น" /> : null}
          </div>
        </section>
      ) : (
        <>
          <div className="safety-mobile-switch safety-tabs" aria-label="มุมมองบนมือถือ">
            <button aria-selected={mobileView === 'list'} onClick={() => setMobileView('list')}>รายการ</button>
            <button aria-selected={mobileView === 'map'} onClick={() => setMobileView('map')}>แผนที่</button>
          </div>
          <div className="safety-workspace" data-mobile-view={mobileView}>
            <div className="safety-map-pane">
              <LabMapCanvas map={workingMap} mode="safety" selectedCode={selectedCode} activeRouteCodes={[]}
                showAllSafetyEquipment
                onSelect={selectMap} onMoveSafetyEquipment={canEdit ? input => void moveSafetyEquipment(input) : undefined}
                draftSafetyEquipment={assetDraft && !assetDraft.id ? {
                  code: 'draft-safety-equipment', nameTh: assetDraft.nameTh || 'อุปกรณ์ใหม่',
                  kind: assetDraft.kind ?? 'fire-extinguisher', x: assetDraft.x ?? 739, y: assetDraft.y ?? 446,
                } : null}
                onMoveDraftSafetyEquipment={assetDraft && !assetDraft.id ? position => setAssetDraft(current => ({ ...current, ...position })) : undefined} />
              {assetDraft && !assetDraft.id ? <section className="safety-map-placement" aria-label="วางหมุดอุปกรณ์">
                <strong>วางหมุดอุปกรณ์</strong>
                <span>กดหมุดค้าง 250ms แล้วลากหมุดไปยังตำแหน่งจริง</span>
                <small>{map.spaces.find(space => space.code === assetDraft.spaceCode)?.nameTh ?? 'ทางเดิน/ไม่ระบุห้อง'} · {Math.round(assetDraft.x ?? 739)}, {Math.round(assetDraft.y ?? 446)}</small>
                <div>
                  <button type="button" onClick={() => { setAssetDraft(null); setMobileView('list') }}>ยกเลิก</button>
                  <button type="button" onClick={() => setMobileView('list')}>ยืนยันตำแหน่งนี้</button>
                </div>
              </section> : null}
              {positionFailure ? <p className="safety-position-error" role="alert">
                {positionFailure.message}
                <button type="button" onClick={() => void moveSafetyEquipment(positionFailure.input)}>ลองบันทึกตำแหน่งอีกครั้ง</button>
              </p> : null}
            </div>
            <aside className="safety-sidebar">
              {tab === 'assets' ? (
                <>
                  <div className="safety-registry-panel">
                    <SafetyAssetScanner active={mobileView === 'list'} onCode={openAssetByCode} />
                    <SafetyInspectionProgress queue={inspectionQueue} roundName={activeRound?.nameTh}
                      canStart={canEdit && !activeRound} canClose={Boolean(activeRound && inspectionQueue.progress.remaining === 0)} busy={busy}
                      onStart={() => void run(startInspectionRound)} onClose={() => void run(closeInspectionRound)} />
                    <AssetsPanel assets={filteredAssets} selected={selectedAsset} query={query} status={status} kind={kind} spaceCode={spaceCode} canEdit={canEdit} canManage={canManage}
                      busy={busy} draft={assetDraft} map={map} listRef={listContainerRef} onQuery={updateAssetFilter(setQuery)} onStatus={updateAssetFilter(setStatus)} onKind={updateAssetFilter(setKind)} onSpaceCode={updateAssetFilter(setSpaceCode)} onSelect={selectAssetFromList}
                      onAdd={beginAssetPlacement} onDraft={setAssetDraft} onShowMap={() => setMobileView('map')} onRun={run} onReload={reload} />
                  </div>
                  {selectedAsset ? <SafetyInspectionMobile key={selectedAsset.id} item={selectedAsset} locationLabel={selectedLocationLabel}
                    queue={inspectionQueue} roundName={activeRound?.nameTh} roundId={activeRound?.id} roundItemId={selectedRoundItem?.id}
                    resultCounts={inspectionResultCounts} canEdit={canEdit}
                    onBack={backToList} onPrevious={() => { const code = adjacentPendingCode('previous'); if (code) setSelectedCode(code) }}
                    onShowMap={() => setMobileView('map')} onSaved={inspectionSaved}
                    onCloseRound={() => run(closeInspectionRound)} /> : null}
                </>
              ) : (
                <AssemblyPanel points={points} selected={selectedPoint} canEdit={canEdit} canManage={canManage} busy={busy}
                  draft={pointDraft} onSelect={code => { setPointDraft(null); setSelectedCode(code) }} onDraft={setPointDraft} onRun={run} onReload={reload} />
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  )
}

function AssetsPanel({ assets, selected, query, status, kind, spaceCode, canEdit, canManage, busy, draft, map, listRef, onQuery, onStatus, onKind, onSpaceCode, onSelect, onAdd, onDraft, onShowMap, onRun, onReload }: {
  assets: SafetyAssetDTO[]; selected: SafetyAssetDTO | null; query: string; status: string; kind: string; spaceCode: string; canEdit: boolean; canManage: boolean; busy: boolean
  draft: Partial<SafetyAssetDTO> | null; map: LabMapDTO; listRef: RefObject<HTMLDivElement | null>; onQuery: (v: string) => void; onStatus: (v: string) => void
  onKind: (v: string) => void; onSpaceCode: (v: string) => void
  onSelect: (v: string | null) => void; onAdd: () => void; onDraft: (v: Partial<SafetyAssetDTO> | null) => void; onShowMap: () => void; onRun: (f: () => Promise<void>) => Promise<void>; onReload: () => Promise<void>
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const spaceNameByCode = useMemo(() => new Map(map.spaces.map(space => [space.code, space.nameTh])), [map.spaces])

  useEffect(() => {
    if (!draft && !selected) return
    if (window.matchMedia('(min-width: 768px)').matches) {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [draft, selected])

  return <>
    <div className="safety-toolbar"><input type="search" value={query} onChange={e => onQuery(e.target.value)} placeholder="ค้นหาอุปกรณ์" aria-label="ค้นหาอุปกรณ์" />
      {canEdit ? <Button size="lg" icon="plus" onClick={onAdd}>เพิ่ม</Button> : null}</div>
    <div className="safety-filter-grid">
      <select value={status} onChange={e => onStatus(e.target.value)} aria-label="กรองสถานะ"><option value="">ทุกสถานะ</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select value={kind} onChange={e => onKind(e.target.value)} aria-label="กรองประเภท"><option value="">ทุกประเภท</option>{Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select value={spaceCode} onChange={e => onSpaceCode(e.target.value)} aria-label="กรองห้อง"><option value="">ทุกห้อง</option>{map.spaces.map(space => <option key={space.code} value={space.code}>{space.nameTh}</option>)}</select>
    </div>
    <div className="safety-editor-focus" ref={editorRef}>
      {draft ? <AssetEditor key={`${draft.id ?? 'new'}-${draft.x}-${draft.y}`} draft={draft} spaces={map.spaces} busy={busy} onCancel={() => onDraft(null)} onSave={value => onRun(async () => {
        const editing = Boolean(value.id)
        await jsonRequest(editing ? `/api/admin/lab-map/safety-assets/${value.id}` : '/api/admin/lab-map/safety-assets', {
          method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editing ? { ...value, code: undefined, updatedAt: value.updatedAt } : value),
        }); await onReload(); onDraft(null)
      })} /> : selected ? <AssetDetail key={selected.id} item={selected} locationLabel={spaceNameByCode.get(selected.spaceCode ?? '') ?? selected.spaceCode ?? 'ไม่ระบุห้อง'} canEdit={canEdit} canManage={canManage} busy={busy}
        onEdit={() => onDraft(selected)} onShowMap={onShowMap} onRun={onRun} onReload={onReload} /> : null}
    </div>
    <div className="safety-list" ref={listRef}>{assets.map(item => <button key={item.id} className="safety-card" data-selected={selected?.id === item.id} aria-pressed={selected?.id === item.id} onClick={() => onSelect(item.code)}>
      <span className="safety-card-head"><strong>{item.nameTh}</strong><Badge color={STATUS_COLORS[item.operationalStatus ?? 'unverified']}>{STATUS_LABELS[item.operationalStatus ?? 'unverified']}</Badge></span>
      <small>{KIND_LABELS[item.kind]} · {spaceNameByCode.get(item.spaceCode ?? '') ?? item.spaceCode ?? 'ไม่ระบุห้อง'} · {item.code}</small>
    </button>)}</div>
    {assets.length === 0 ? <EmptyState title="ไม่พบอุปกรณ์" /> : null}
  </>
}

function AssetEditor({ draft, spaces, busy, onCancel, onSave }: { draft: Partial<SafetyAssetDTO>; spaces: LabMapDTO['spaces']; busy: boolean; onCancel: () => void; onSave: (v: Partial<SafetyAssetDTO>) => void }) {
  const [value, setValue] = useState({ ...draft })
  return <section className="safety-form"><h2 style={{ margin: 0, fontSize: 16 }}>{draft.id ? 'แก้ไขอุปกรณ์' : 'เพิ่มอุปกรณ์'}</h2>
    <div className="safety-form-grid">
      <label>รหัส<input value={value.code ?? ''} disabled={Boolean(draft.id)} onChange={e => setValue({ ...value, code: e.target.value })} /></label>
      <label>ชื่อ<input value={value.nameTh ?? ''} onChange={e => setValue({ ...value, nameTh: e.target.value })} /></label>
      <label>ประเภท<select value={value.kind ?? ''} onChange={e => setValue({ ...value, kind: e.target.value as SafetyAssetDTO['kind'] })}>{Object.entries(KIND_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>ห้อง<select value={value.spaceCode ?? ''} onChange={e => setValue({ ...value, spaceCode: e.target.value || null })}><option value="">ไม่ระบุ</option>{spaces.map(space => <option key={space.code} value={space.code}>{space.nameTh}</option>)}</select></label>
      <details className="safety-advanced-coordinates">
        <summary>พิกัดขั้นสูง</summary>
        <div>
          <label>พิกัด X<input type="number" min={0} max={1477} value={value.x ?? 0} onChange={e => setValue({ ...value, x: Number(e.target.value) })} /></label>
          <label>พิกัด Y<input type="number" min={0} max={892} value={value.y ?? 0} onChange={e => setValue({ ...value, y: Number(e.target.value) })} /></label>
        </div>
      </details>
      {value.kind === 'emergency-shutoff' ? <label>ตัดระบบ<select value={value.shutoffFor ?? ''} onChange={e => setValue({ ...value, shutoffFor: e.target.value as 'electricity' | 'gas' })}><option value="">เลือก</option><option value="electricity">ไฟฟ้า</option><option value="gas">ก๊าซ</option></select></label> : null}
    </div>
    <label>จุดสังเกต<textarea value={value.sourceNoteTh ?? ''} onChange={e => setValue({ ...value, sourceNoteTh: e.target.value })} /></label>
    <div className="safety-actions"><Button variant="secondary" size="lg" onClick={onCancel}>ยกเลิก</Button><Button size="lg" icon="check" disabled={busy || !value.code || !value.nameTh} onClick={() => onSave(value)}>บันทึก</Button></div>
  </section>
}

function AssetDetail({ item, locationLabel, canEdit, canManage, busy, onEdit, onShowMap, onRun, onReload }: { item: SafetyAssetDTO; locationLabel: string; canEdit: boolean; canManage: boolean; busy: boolean; onEdit: () => void; onShowMap: () => void; onRun: (f: () => Promise<void>) => Promise<void>; onReload: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null); const [result, setResult] = useState('passed'); const [note, setNote] = useState('')
  const [nextDate, setNextDate] = useState(''); const [expires, setExpires] = useState('')
  async function inspect() {
    if (!file) throw new Error('กรุณาถ่ายหรือเลือกรูปหลักฐาน')
    const signed = await jsonRequest(`/api/admin/lab-map/safety-assets/${item.id}/inspection-photo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, contentType: file.type, sizeBytes: file.size }) })
    await uploadFileWithProgress(signed.uploadUrl, file, file.type, () => {})
    await jsonRequest(`/api/admin/lab-map/safety-assets/${item.id}/inspection-photo`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: signed.key, fileName: file.name, result, inspectedOn: todayIso(), nextInspectionDate: nextDate || null, expiresOn: expires || null, note: note || null }) })
    setFile(null); setNote(''); await onReload()
  }
  return <section className="safety-form"><span className="safety-card-head"><h2 style={{ margin: 0, fontSize: 17 }}>{item.nameTh}</h2><Badge color={STATUS_COLORS[item.operationalStatus ?? 'unverified']}>{STATUS_LABELS[item.operationalStatus ?? 'unverified']}</Badge></span>
    <p className="safety-muted" style={{ margin: 0 }}>{KIND_LABELS[item.kind]} · {item.code}<br />ตำแหน่ง: {locationLabel}<br />พิกัด {item.x}, {item.y}</p>
    <div className="safety-actions"><Button variant="secondary" size="lg" onClick={onShowMap}>ดูตำแหน่งบนผัง</Button></div>
    {item.latestInspection ? <><p style={{ margin: 0 }}>ตรวจล่าสุด {item.latestInspection.inspectedOn} · {STATUS_LABELS[item.latestInspection.result]}</p><img className="safety-photo" src={item.latestInspection.photoUrl} alt={`หลักฐานการตรวจ ${item.nameTh}`} /></> : <p className="safety-muted">ยังไม่มีประวัติการตรวจ</p>}
    <AssetHistory assetId={item.id} />
    {canEdit ? <><h3 style={{ margin: '6px 0 0', fontSize: 14 }}>บันทึกผลตรวจ</h3><div className="safety-form-grid">
      <label>ผลตรวจ<select value={result} onChange={e => setResult(e.target.value)}><option value="passed">ผ่าน</option><option value="needs_attention">ต้องติดตาม</option><option value="failed">ไม่พร้อมใช้</option><option value="not_found">ไม่พบอุปกรณ์</option></select></label>
      <SafetyPhotoPicker label="รูปหลักฐาน" file={file} disabled={busy} onChange={setFile} />
      <label>ตรวจครั้งถัดไป<input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} /></label><label>วันหมดอายุ<input type="date" value={expires} onChange={e => setExpires(e.target.value)} /></label>
    </div><label>หมายเหตุ<textarea value={note} onChange={e => setNote(e.target.value)} /></label>
    <div className="safety-actions"><Button variant="secondary" size="lg" icon="edit" onClick={onEdit}>แก้ข้อมูล</Button><Button size="lg" icon="check" disabled={busy || !file} onClick={() => void onRun(inspect)}>ยืนยันผลตรวจ</Button></div></> : null}
    {canManage ? <Button variant="danger" size="lg" disabled={busy} onClick={() => { if (confirm('เลิกใช้อุปกรณ์นี้หรือไม่')) void onRun(async () => { await jsonRequest(`/api/admin/lab-map/safety-assets/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updatedAt: item.updatedAt, retire: true }) }); await onReload() }) }}>เลิกใช้งาน</Button> : null}
  </section>
}

function AssetHistory({ assetId }: { assetId: string }) {
  const [items, setItems] = useState<SafetyInspectionDTO[]>([])
  useEffect(() => {
    let active = true
    void jsonRequest(`/api/admin/lab-map/safety-assets/${assetId}/inspections`)
      .then(result => { if (active) setItems(result.items ?? []) })
      .catch(() => { if (active) setItems([]) })
    return () => { active = false }
  }, [assetId])
  if (!items.length) return null
  return <details><summary>ประวัติการตรวจทั้งหมด ({items.length})</summary><div className="safety-history">
    {items.map(entry => <article key={entry.id}><strong>{entry.inspectedOn} · {STATUS_LABELS[entry.result]}</strong><small>{entry.inspectorName ?? entry.inspectedBy}{entry.note ? ` · ${entry.note}` : ''}</small><img className="safety-photo" src={entry.photoUrl} alt={`หลักฐานการตรวจวันที่ ${entry.inspectedOn}`} /></article>)}
  </div></details>
}

function AssemblyPanel({ points, selected, canEdit, canManage, busy, draft, onSelect, onDraft, onRun, onReload }: { points: AssemblyPointDTO[]; selected: AssemblyPointDTO | null; canEdit: boolean; canManage: boolean; busy: boolean; draft: Partial<AssemblyPointDTO> | null; onSelect: (v: string | null) => void; onDraft: (v: Partial<AssemblyPointDTO> | null) => void; onRun: (f: () => Promise<void>) => Promise<void>; onReload: () => Promise<void> }) {
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  function startDraft(pointType: LabPointType) {
    setAddMenuOpen(false)
    onSelect(null)
    onDraft({ pointType, exitCodes: [], latitude: null, longitude: null })
  }
  return <>{canEdit ? <div className="safety-point-add" role="group" aria-label="เพิ่มจุดความปลอดภัย">
      <Button size="lg" icon="plus" onClick={() => setAddMenuOpen(open => !open)}>เพิ่มจุด</Button>
      {addMenuOpen ? <div className="safety-point-add-options" role="group" aria-label="เลือกประเภทจุด">
        <Button variant="secondary" size="lg" onClick={() => startDraft('assembly')}>จุดรวมพล</Button>
        <Button variant="secondary" size="lg" onClick={() => startDraft('safe')}>จุดปลอดภัย</Button>
      </div> : null}
    </div> : null}
    <div className="safety-list">{points.map(point => <button key={point.id} className="safety-card" data-selected={selected?.id === point.id} onClick={() => onSelect(point.code)}><span className="safety-card-head"><strong>{point.nameTh}</strong><span className="safety-card-badges"><Badge color={pointTypeColor(point.pointType)}>{pointTypeLabel(point.pointType)}</Badge><Badge color={point.verified ? 'green' : 'amber'}>{point.verified ? 'ยืนยันแล้ว' : 'รอยืนยัน'}</Badge></span></span><small>{point.detailTh} · {point.exitCodes.join(', ')}</small></button>)}</div>
    {draft ? <AssemblyEditor key={`point-${draft.id ?? 'new'}-${draft.pointType ?? 'assembly'}`} draft={draft} busy={busy} onCancel={() => onDraft(null)} onSave={value => onRun(async () => { const editing = Boolean(value.id); await jsonRequest(editing ? `/api/admin/lab-map/assembly-points/${value.id}` : '/api/admin/lab-map/assembly-points', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing ? { ...value, code: undefined, updatedAt: value.updatedAt } : value) }); await onReload(); onDraft(null) })} /> : selected ? <AssemblyDetail key={selected.id} point={selected} canEdit={canEdit} canManage={canManage} busy={busy} onEdit={() => onDraft(selected)} onRun={onRun} onReload={onReload} /> : null}
  </>
}

function AssemblyEditor({ draft, busy, onCancel, onSave }: { draft: Partial<AssemblyPointDTO>; busy: boolean; onCancel: () => void; onSave: (v: Partial<AssemblyPointDTO>) => void }) {
  const [value, setValue] = useState({ ...draft }); const [accuracy, setAccuracy] = useState<number | null>(null); const [geoError, setGeoError] = useState('')
  function locate() { setGeoError(''); navigator.geolocation.getCurrentPosition(position => { setValue(current => ({ ...current, latitude: Number(position.coords.latitude.toFixed(6)), longitude: Number(position.coords.longitude.toFixed(6)) })); setAccuracy(Math.round(position.coords.accuracy)) }, error => setGeoError(error.message), { enableHighAccuracy: true, timeout: 15000 }) }
  const currentPointType = value.pointType ?? 'assembly'
  return <section className="safety-form"><h2 style={{ margin: 0, fontSize: 16 }}>{draft.id ? `แก้ไข${pointTypeLabel(currentPointType)}` : `เพิ่ม${pointTypeLabel(currentPointType)}`}</h2>
    <fieldset><legend>ประเภทจุด</legend><div className="safety-point-type-options">{(['assembly', 'safe'] as const).map(pointType => <label key={pointType} style={{ flexDirection: 'row', alignItems: 'center' }}><input type="radio" name={`point-type-${draft.id ?? 'new'}`} checked={currentPointType === pointType} onChange={() => setValue({ ...value, pointType })} style={{ width: 20, minHeight: 20 }} />{POINT_TYPE_LABELS[pointType]}</label>)}</div></fieldset>
    <div className="safety-form-grid"><label>รหัส<input value={value.code ?? ''} disabled={Boolean(draft.id)} onChange={e => setValue({ ...value, code: e.target.value })} /></label><label>ชื่อ<input value={value.nameTh ?? ''} onChange={e => setValue({ ...value, nameTh: e.target.value })} /></label><label>Latitude<input type="number" step="0.000001" value={value.latitude ?? ''} onChange={e => setValue({ ...value, latitude: e.target.value ? Number(e.target.value) : null })} /></label><label>Longitude<input type="number" step="0.000001" value={value.longitude ?? ''} onChange={e => setValue({ ...value, longitude: e.target.value ? Number(e.target.value) : null })} /></label></div>
    <Button variant="secondary" size="lg" icon="globe" onClick={locate}>ใช้พิกัดปัจจุบันของอุปกรณ์</Button>{accuracy != null ? <p className="safety-coordinate-note">ความแม่นยำประมาณ {accuracy} เมตร — ตรวจสอบก่อนบันทึก</p> : null}{geoError ? <p role="alert" className="safety-muted">อ่าน GPS ไม่สำเร็จ: {geoError} คุณยังกรอกพิกัดเองได้</p> : null}
    <label>รายละเอียด/จุดสังเกต<textarea value={value.detailTh ?? ''} onChange={e => setValue({ ...value, detailTh: e.target.value })} /></label>
    <fieldset><legend>ทางออกที่เชื่อม</legend>{EXIT_OPTIONS.map(exit => <label key={exit} style={{ flexDirection: 'row', alignItems: 'center' }}><input type="checkbox" checked={(value.exitCodes ?? []).includes(exit)} onChange={e => setValue({ ...value, exitCodes: e.target.checked ? [...(value.exitCodes ?? []), exit] : (value.exitCodes ?? []).filter(v => v !== exit) })} style={{ width: 20, minHeight: 20 }} />{exit.replace('exit-', '').toUpperCase()}</label>)}</fieldset>
    <div className="safety-actions"><Button variant="secondary" size="lg" onClick={onCancel}>ยกเลิก</Button><Button size="lg" icon="check" disabled={busy || !value.code || !value.nameTh} onClick={() => onSave(value)}>บันทึกแบบร่าง</Button></div>
  </section>
}

function AssemblyDetail({ point, canEdit, canManage, busy, onEdit, onRun, onReload }: { point: AssemblyPointDTO; canEdit: boolean; canManage: boolean; busy: boolean; onEdit: () => void; onRun: (f: () => Promise<void>) => Promise<void>; onReload: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null); const [note, setNote] = useState(''); const [accuracy, setAccuracy] = useState<number | null>(null)
  const coordinates = point.latitude != null && point.longitude != null ? `${point.latitude},${point.longitude}` : null
  const typeLabel = pointTypeLabel(point.pointType)
  async function verify() { if (!file || point.latitude == null || point.longitude == null) throw new Error('ต้องมีพิกัดและรูปหลักฐาน'); const signed = await jsonRequest(`/api/admin/lab-map/assembly-points/${point.id}/verification-photo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, contentType: file.type, sizeBytes: file.size }) }); await uploadFileWithProgress(signed.uploadUrl, file, file.type, () => {}); await jsonRequest(`/api/admin/lab-map/assembly-points/${point.id}/verification-photo`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: signed.key, fileName: file.name, latitude: point.latitude, longitude: point.longitude, accuracyMeters: accuracy, note: note || null }) }); await onReload() }
  return <section className="safety-form"><span className="safety-card-head"><h2 style={{ margin: 0, fontSize: 17 }}>{point.nameTh}</h2><span className="safety-card-badges"><Badge color={pointTypeColor(point.pointType)}>{typeLabel}</Badge><Badge color={point.verified ? 'green' : 'amber'}>{point.verified ? 'ยืนยันแล้ว' : 'รอยืนยัน'}</Badge></span></span><p style={{ margin: 0 }}>{point.detailTh || 'ไม่ระบุจุดสังเกต'}</p><p className="safety-muted" style={{ margin: 0 }}>ประเภท: {typeLabel} · ทางออก: {point.exitCodes.join(', ')}</p>
    {coordinates ? <div className="safety-actions"><Button variant="secondary" size="lg" onClick={() => void navigator.clipboard.writeText(coordinates)}>คัดลอกพิกัด</Button><a href={`https://www.google.com/maps?q=${coordinates}`} target="_blank" rel="noreferrer" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', color: 'var(--primary)', fontWeight: 650 }}>เปิด Google Maps</a></div> : <p className="safety-muted">ยังไม่มีพิกัด GPS</p>}
    {point.latestVerification ? <img className="safety-photo" src={point.latestVerification.photoUrl} alt={`หลักฐาน${typeLabel} ${point.nameTh}`} /> : null}
    <AssemblyHistory assemblyPointId={point.id} />
    {canEdit ? <><SafetyPhotoPicker label="รูปยืนยัน" file={file} disabled={busy} onChange={setFile} /><label>ความแม่นยำ GPS (เมตร)<input type="number" min={0} value={accuracy ?? ''} onChange={e => setAccuracy(e.target.value ? Number(e.target.value) : null)} /></label><label>หมายเหตุ<textarea value={note} onChange={e => setNote(e.target.value)} /></label>{point.exitCodes.length === 0 ? <p className="safety-coordinate-note">ต้องเชื่อมทางออกอย่างน้อยหนึ่งจุดก่อนยืนยันหน้างาน</p> : null}<div className="safety-actions"><Button variant="secondary" size="lg" icon="edit" onClick={onEdit}>แก้ข้อมูล</Button><Button size="lg" icon="check" disabled={busy || !file || !coordinates || point.exitCodes.length === 0} onClick={() => void onRun(verify)}>ยืนยัน{typeLabel}</Button></div></> : null}
    {canManage ? <Button variant="danger" size="lg" disabled={busy} onClick={() => { if (confirm(`เลิกใช้${typeLabel}นี้หรือไม่`)) void onRun(async () => { await jsonRequest(`/api/admin/lab-map/assembly-points/${point.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updatedAt: point.updatedAt, retire: true }) }); await onReload() }) }}>เลิกใช้งาน</Button> : null}
  </section>
}

function AssemblyHistory({ assemblyPointId }: { assemblyPointId: string }) {
  const [items, setItems] = useState<AssemblyPointVerificationDTO[]>([])
  useEffect(() => {
    let active = true
    void jsonRequest(`/api/admin/lab-map/assembly-points/${assemblyPointId}/verifications`)
      .then(result => { if (active) setItems(result.items ?? []) })
      .catch(() => { if (active) setItems([]) })
    return () => { active = false }
  }, [assemblyPointId])
  if (!items.length) return null
  return <details><summary>ประวัติการยืนยันทั้งหมด ({items.length})</summary><div className="safety-history">
    {items.map(entry => <article key={entry.id}><strong>{new Date(entry.verifiedAt).toLocaleString('th-TH')} · {entry.latitude.toFixed(6)}, {entry.longitude.toFixed(6)}</strong><small>{entry.verifierName ?? entry.verifiedBy}{entry.accuracyMeters != null ? ` · ±${entry.accuracyMeters} เมตร` : ''}{entry.note ? ` · ${entry.note}` : ''}</small><img className="safety-photo" src={entry.photoUrl} alt={`หลักฐานการยืนยันวันที่ ${entry.verifiedAt}`} /></article>)}
  </div></details>
}
