'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Badge, type BadgeColor } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { uploadFileWithProgress } from '@/lib/documents/upload-with-progress'
import { normalizeRole } from '@/lib/roles'
import { safetyExpiryLabel } from '@/lib/lab-map/safety-domain'
import { buildSafetyInspectionQueue, nextSafetyAssetCode, previousSafetyAssetCode } from '@/lib/lab-map/safety-inspection-workflow'
import { nextSafetyInspectionDate, SAFETY_INSPECTION_SCHEDULE_LABEL } from '@/lib/lab-map/safety-inspection-schedule'
import type {
  AssemblyPointDTO, AssemblyPointVerificationDTO, LabMapDTO, LabPointType, SafetyAssetDTO, SafetyInspectionDTO,
  SafetyInspectionRoundDTO,
} from '@/lib/lab-map/types'
import { GoogleMapEmbed } from './GoogleMapEmbed'
import { LabMapCanvas } from './LabMapCanvas'
import { LabMapStyles } from './LabMapStyles'
import { SafetyAssetsStyles } from './SafetyAssetsStyles'
import { SafetyPhotoPicker } from './SafetyPhotoPicker'
import { SafetyInspectionMobile } from './SafetyInspectionMobile'
import { SafetyInspectionProgress, type SafetyInspectionRoundKindOption } from './SafetyInspectionProgress'
import { SafetyAssetScanner } from './SafetyAssetScanner'
import { SafetyAssetStatusBadges } from './SafetyAssetStatusBadges'
import { SafetyPositionVerification } from './SafetyPositionVerification'

type StaffOption = { id: string; name: string | null; role: string }
type EditorOption = { user_id: string }
type Tab = 'assets' | 'assembly' | 'editors'
type SafetyMobileView = 'list' | 'map' | 'inspect'
type MonthlyProfile = 'biohazard_spill_kit' | 'chemical_spill_kit' | 'nss_eyewash'
type MonthlyConfigSupply = {
  id?: string; templateItemId: string | null; supplyType: 'spill_item' | 'nss_bottle'; internalCode: string; labelTh: string
  manufacturedOrPackedOn: string; purchasedOn: string; expiresOn: string; supplier: string
}
type MonthlyConfigResponse = {
  asset: { inspection_profile: MonthlyProfile | null; activated_on: string }
  assignments: { user_id: string; assignment_role: 'primary' | 'backup' }[]
  supplies: { id: string; template_item_id: string | null; supply_type: 'spill_item' | 'nss_bottle'; internal_code: string; label_th: string; manufactured_or_packed_on: string | null; purchased_on: string | null; expires_on: string | null; supplier: string | null }[]
  people: { id: string; name: string | null; dept: string | null }[]
  template: { id: string; version: number; title_th: string } | null
  templateItems: { id: string; item_key: string; label_th: string; sort_order: number }[]
}

const KIND_LABELS: Record<string, string> = {
  'fire-extinguisher': 'ถังดับเพลิง', 'fire-hose': 'สายฉีดน้ำดับเพลิง',
  'manual-call-point': 'จุดกดแจ้งเหตุ', aed: 'AED', 'first-aid-kit': 'ชุดปฐมพยาบาล',
  eyewash: 'อ่างล้างตา', 'nss-eyewash': 'น้ำยาล้างตา NSS', 'emergency-shower': 'ฝักบัวฉุกเฉิน', 'spill-kit': 'Spill Kit',
  'emergency-shutoff': 'จุดตัดฉุกเฉิน',
}
const ASSET_FILTER_KIND_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(KIND_LABELS).filter(([value]) => value !== 'emergency-shutoff'),
)
const STATUS_LABELS: Record<string, string> = {
  unverified: 'รอยืนยันตำแหน่ง', verified: 'ยืนยันตำแหน่งแล้ว', passed: 'ผ่าน',
  needs_attention: 'ต้องติดตาม', failed: 'ไม่พร้อมใช้', not_found: 'ไม่พบอุปกรณ์', overdue: 'เกินกำหนดตรวจ', due_soon: 'ใกล้ครบกำหนด',
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
function nextMonthStart() { const today = new Date(`${todayIso()}T00:00:00Z`); return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1)).toISOString().slice(0, 10) }

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json.error ?? 'ดำเนินการไม่สำเร็จ')
  return json
}

export function SafetyAssetsClient({ map, initialAssets, initialAssemblyPoints, canEdit, canManage, isAdmin, initialInspectionRoundId = null, staff, initialEditors }: {
  map: LabMapDTO
  initialAssets: SafetyAssetDTO[]
  initialAssemblyPoints: AssemblyPointDTO[]
  canEdit: boolean
  canManage: boolean
  isAdmin: boolean
  initialInspectionRoundId?: string | null
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
  const [roundLoading, setRoundLoading] = useState(Boolean(initialInspectionRoundId))
  const [roundLoadFailed, setRoundLoadFailed] = useState(false)
  const [selectedRoundKind, setSelectedRoundKind] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [assetDraft, setAssetDraft] = useState<Partial<SafetyAssetDTO> | null>(null)
  const [pointDraft, setPointDraft] = useState<Partial<AssemblyPointDTO> | null>(null)
  const [editorQuery, setEditorQuery] = useState('')
  const runLockRef = useRef(false)
  const [positionFailure, setPositionFailure] = useState<{
    message: string
    input: { id: string; code: string; x: number; y: number; spaceCode: string | null }
  } | null>(null)
  const listScrollTopRef = useRef(0)
  const listContainerRef = useRef<HTMLDivElement>(null)

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
  const roundKindOptions = useMemo<SafetyInspectionRoundKindOption[]>(() => {
    if (!activeRound) return []
    const kindByAssetId = new Map(assets.map(asset => [asset.id, asset.kind]))
    const snapshotKinds = activeRound.filters.kinds ?? []
    const itemKinds = [...new Set(activeRound.items.map(item => item.kind ?? kindByAssetId.get(item.assetId)).filter((kind): kind is string => Boolean(kind)))]
    const kinds = itemKinds.length ? itemKinds : snapshotKinds
    const closedKinds = new Set(activeRound.filters.closedKinds ?? [])
    return kinds.map(kind => {
      const items = activeRound.items.filter(item => (item.kind ?? kindByAssetId.get(item.assetId)) === kind)
      return {
        kind,
        label: KIND_LABELS[kind] ?? kind,
        completed: items.filter(item => item.status === 'completed').length,
        total: items.length,
        closed: closedKinds.has(kind),
      }
    })
  }, [activeRound, assets])
  useEffect(() => {
    if (!activeRound || !roundKindOptions.length) {
      setSelectedRoundKind('')
      return
    }
    setSelectedRoundKind(current => {
      if (roundKindOptions.some(option => option.kind === current && !option.closed)) return current
      return roundKindOptions.find(option => !option.closed)?.kind ?? roundKindOptions[0].kind
    })
  }, [activeRound, roundKindOptions])
  const selectedRoundKindOption = roundKindOptions.find(option => option.kind === selectedRoundKind) ?? null
  const roundAssetIds = useMemo(() => activeRound
    ? new Set(activeRound.items.filter(item => {
      if (!selectedRoundKind || !roundKindOptions.length) return true
      const asset = assets.find(candidate => candidate.id === item.assetId)
      return (item.kind ?? asset?.kind) === selectedRoundKind
    }).map(item => item.assetId))
    : null, [activeRound, assets, roundKindOptions, selectedRoundKind])
  const queueAssets = roundLoading || roundLoadFailed ? [] : roundAssetIds ? assets.filter(item => roundAssetIds.has(item.id)) : assets
  const inspectionQueue = useMemo(() => buildSafetyInspectionQueue({
    assets: queueAssets,
    filters: { query, status, kind, spaceCode },
    completedAssetIds,
    countLatestInspections: !activeRound && !roundLoading && !roundLoadFailed,
  }), [activeRound, queueAssets, completedAssetIds, kind, query, roundLoadFailed, roundLoading, spaceCode, status])
  const filteredAssets = inspectionQueue.items.map(item => item.asset)
  // Keep the map in sync with the sidebar's filters — without this, the canvas always draws
  // every asset regardless of the kind/status/query/space filters, which gets crowded fast as
  // more equipment kinds (spill-kit, nss-eyewash, ...) get pinned alongside the fire extinguishers.
  const mapSafetyEquipment = assetDraft && !assetDraft.id ? assets : filteredAssets
  const workingMap = useMemo<LabMapDTO>(() => ({ ...map, safetyEquipment: mapSafetyEquipment, assemblyPoints: points }), [map, mapSafetyEquipment, points])
  // จุดรวมพล/จุดปลอดภัยอยู่นอกอาคาร ไม่มี x/y บนผังพื้น — ตอนอยู่แท็บนี้จึงโชว์พิกัดของจุดที่กำลังแก้ไข (ถ้ามี) ก่อนจุดที่เลือกดูอยู่
  // ยังไม่ได้เลือก/แก้ไขอะไรเลยก็ยังอยากเห็นแผนที่ทันที — จุดรวมพล (pointType: 'assembly') ปกติมีแค่จุดเดียวในไซต์
  // (ที่เหลือเป็นจุดปลอดภัย) จึงใช้จุดนั้นเป็นค่าเริ่มต้นได้โดยไม่ต้องรองรับหลายหมุดพร้อมกัน
  const assemblyMapPoint = pointDraft ?? selectedPoint ?? points.find(point => point.pointType === 'assembly') ?? null
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
    if (!initialInspectionRoundId) { setRoundLoading(false); setRoundLoadFailed(false); return }
    setRoundLoading(true)
    setRoundLoadFailed(false)
    // ผู้ใช้สิทธิ์ดูอย่างเดียวตามลิงก์ "เปิดอุปกรณ์และรอบตรวจ" มาได้เหมือนกัน
    // ถ้าเงียบไปเฉย ๆ จะเห็นแค่รายการอุปกรณ์ธรรมดาโดยไม่รู้ว่าทำไมรอบตรวจไม่ขึ้น
    if (!canEdit) {
      setRoundLoading(false)
      setRoundLoadFailed(false)
      setError('ต้องเป็น Safety Editor จึงจะเปิดรอบตรวจนี้ได้ กำลังแสดงทะเบียนอุปกรณ์แบบดูอย่างเดียว')
      return
    }
    let active = true
    const roundUrl = `/api/admin/lab-map/safety-inspection-rounds?roundId=${encodeURIComponent(initialInspectionRoundId)}`
    void jsonRequest(roundUrl)
      .then(result => {
        if (!active || !result.data) {
          if (active) {
            setRoundLoadFailed(true)
            setError('ไม่พบ Inspection Round ของงานนี้ จึงยังไม่แสดงรายการอุปกรณ์รวม')
          }
          return
        }
        const filters = result.data.filters ?? {}
        setActiveRound(result.data)
        setQuery(typeof filters.query === 'string' ? filters.query : '')
        setStatus(typeof filters.status === 'string' ? filters.status : '')
        setKind(typeof filters.kind === 'string' ? filters.kind : '')
        setSpaceCode(typeof filters.spaceCode === 'string' ? filters.spaceCode : '')
      })
      .catch(reason => { if (active) { setRoundLoadFailed(true); setError((reason as Error).message) } })
      .finally(() => { if (active) setRoundLoading(false) })
    return () => { active = false }
  }, [canEdit, initialInspectionRoundId])

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
    if (runLockRef.current) return
    runLockRef.current = true
    setBusy(true); setError('')
    try { await action() } catch (reason) { setError((reason as Error).message) } finally { setBusy(false); runLockRef.current = false }
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

  async function closeInspectionRound() {
    if (!activeRound) return
    const result = await jsonRequest(`/api/admin/lab-map/safety-inspection-rounds/${activeRound.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectedRoundKind ? { close: true, kind: selectedRoundKind } : { close: true }),
    })
    if (result.data?.status === 'closed' && result.taskSync?.status === 'pending') {
      throw new Error(result.taskSync.error
        ? `ปิดรอบแล้ว แต่ยังส่งงานไม่สำเร็จ: ${result.taskSync.error}`
        : 'ปิดรอบแล้ว แต่ยังส่งงานไม่สำเร็จ กรุณาลองอีกครั้ง')
    }
    if (result.data?.status === 'open') {
      const refreshed = await jsonRequest(`/api/admin/lab-map/safety-inspection-rounds?roundId=${encodeURIComponent(activeRound.id)}`)
      if (refreshed.data) setActiveRound(refreshed.data)
      setSelectedCode(null)
      setMobileView('list')
      return
    }
    setActiveRound(null)
    setSelectedRoundKind('')
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
      <PageHeader eyebrow="SAFETY ASSET CONTROL" title="ทะเบียนอุปกรณ์ความปลอดภัย"
        subtitle="ข้อมูลหน้างานเป็นฉบับร่างจนกว่าจะยืนยันหลักฐานและเผยแพร่แผนที่ฉบับใหม่" marginBottom={0}
        actions={<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><Link href="/staff/lab-map/evacuation" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', minHeight: 44, borderRadius: 8, border: '1px solid var(--primary)', background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}><Icon name="shield" size={15} />จุดรวมพล / แผนอพยพ</Link><Link href="/staff/safety" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', minHeight: 44, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}><Icon name="clipboard" size={15} />งานความปลอดภัย</Link></div>} />
      {error ? <p role="alert" style={{ margin: 0, padding: 10, borderRadius: 8, background: 'color-mix(in srgb,var(--danger) 10%,transparent)', color: 'var(--danger)' }}>{error}</p> : null}
      <div className="safety-tabs" role="tablist" aria-label="ข้อมูลความปลอดภัย">
        <button role="tab" aria-selected={tab === 'assets'} onClick={() => setTab('assets')}>อุปกรณ์ความปลอดภัย</button>
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
              {tab === 'assembly' ? (
                // จุดรวมพล/จุดปลอดภัยเป็นตำแหน่งนอกอาคาร (มีแค่ latitude/longitude ไม่มี x/y บนผังพื้น)
                // ผังพื้นห้องปฏิบัติการจึงไม่มีความหมายเชิงตำแหน่งสำหรับจุดเหล่านี้ — สลับไปแสดงแผนที่จริงแทน
                assemblyMapPoint?.latitude != null && assemblyMapPoint?.longitude != null ? (
                  <GoogleMapEmbed latitude={assemblyMapPoint.latitude} longitude={assemblyMapPoint.longitude} nameTh={assemblyMapPoint.nameTh} style={{ height: 640, aspectRatio: 'auto' }} />
                ) : (
                  <div className="safety-map-empty">
                    <Icon name="globe" size={28} />
                    <p>{pointDraft ? 'กรอกพิกัด หรือกดใช้พิกัดปัจจุบันของอุปกรณ์ เพื่อดูตำแหน่งบนแผนที่' : 'เลือกหรือเพิ่มจุดรวมพล/จุดปลอดภัยเพื่อดูตำแหน่งบนแผนที่'}</p>
                  </div>
                )
              ) : (
                <>
                  <LabMapCanvas map={workingMap} mode="safety" selectedCode={selectedCode} activeRouteCodes={[]}
                    showSafetyEquipment showAllSafetyEquipment
                    onSelect={selectMap} onMoveSafetyEquipment={canEdit ? input => void moveSafetyEquipment(input) : undefined}
                    draftSafetyEquipment={assetDraft && !assetDraft.id ? {
                      code: 'draft-safety-equipment', nameTh: assetDraft.nameTh || 'อุปกรณ์ใหม่',
                      kind: assetDraft.kind ?? 'fire-extinguisher', x: assetDraft.x ?? 739, y: assetDraft.y ?? 446,
                    } : null}
                    onMoveDraftSafetyEquipment={assetDraft && !assetDraft.id ? position => setAssetDraft(current => ({ ...current, ...position })) : undefined} />
                  {assetDraft && !assetDraft.id ? <section className="safety-map-placement" aria-label="วางหมุดอุปกรณ์">
                    <strong>วางหมุดอุปกรณ์</strong>
                    <span>ลากหมุดไปยังตำแหน่งจริง หรือกดค้าง 250ms แล้วลาก</span>
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
                </>
              )}
            </div>
            <aside className="safety-sidebar">
              {tab === 'assets' ? (
                <>
                  <div className="safety-registry-panel">
                    <SafetyAssetScanner active={mobileView === 'list'} onCode={openAssetByCode} />
                    <SafetyInspectionProgress queue={inspectionQueue} roundName={activeRound?.nameTh}
                      roundKinds={roundKindOptions} selectedRoundKind={selectedRoundKind} roundKindLabel={selectedRoundKindOption?.label}
                      loading={roundLoading} canStart={false} canClose={Boolean(activeRound && !roundLoading && !selectedRoundKindOption?.closed && inspectionQueue.progress.remaining === 0)} busy={busy}
                      startHint="หน้านี้รวมอุปกรณ์ทุกประเภท · เริ่มงานตรวจจากแท็บ “งานความปลอดภัย” เพื่อเชื่อม Task กับอุปกรณ์ และจำกัดเฉพาะอุปกรณ์ในรอบตรวจ"
                      onRoundKindChange={setSelectedRoundKind}
                      onClose={() => void run(closeInspectionRound)} />
                    <AssetsPanel assets={filteredAssets} selected={selectedAsset} query={query} status={status} kind={kind} spaceCode={spaceCode} canEdit={canEdit} canManage={canManage}
                      busy={busy} draft={assetDraft} map={map} listRef={listContainerRef} onQuery={updateAssetFilter(setQuery)} onStatus={updateAssetFilter(setStatus)} onKind={updateAssetFilter(setKind)} onSpaceCode={updateAssetFilter(setSpaceCode)} onSelect={selectAssetFromList}
                      onAdd={beginAssetPlacement} onDraft={setAssetDraft} onShowMap={() => setMobileView('map')} onRun={run} onReload={reload}
                      selectedRoundItemId={selectedRoundItem?.id ?? null}
                      onInspectionSaved={result => inspectionSaved('stay', result)} />
                  </div>
                  {selectedAsset ? <SafetyInspectionMobile key={selectedAsset.id} item={selectedAsset} locationLabel={selectedLocationLabel}
                    queue={inspectionQueue} roundName={activeRound?.nameTh} roundId={activeRound?.id} roundItemId={selectedRoundItem?.id}
                    resultCounts={inspectionResultCounts} canEdit={canEdit} loading={roundLoading}
                    onBack={backToList} onPrevious={() => { const code = adjacentPendingCode('previous'); if (code) setSelectedCode(code) }}
                    onShowMap={() => setMobileView('map')} onSaved={inspectionSaved} onPositionVerified={reload}
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

function AssetsPanel({ assets, selected, query, status, kind, spaceCode, canEdit, canManage, busy, draft, map, listRef, onQuery, onStatus, onKind, onSpaceCode, onSelect, onAdd, onDraft, onShowMap, onRun, onReload, selectedRoundItemId, onInspectionSaved }: {
  assets: SafetyAssetDTO[]; selected: SafetyAssetDTO | null; query: string; status: string; kind: string; spaceCode: string; canEdit: boolean; canManage: boolean; busy: boolean
  draft: Partial<SafetyAssetDTO> | null; map: LabMapDTO; listRef: RefObject<HTMLDivElement | null>; onQuery: (v: string) => void; onStatus: (v: string) => void
  onKind: (v: string) => void; onSpaceCode: (v: string) => void
  onSelect: (v: string | null) => void; onAdd: () => void; onDraft: (v: Partial<SafetyAssetDTO> | null) => void; onShowMap: () => void; onRun: (f: () => Promise<void>) => Promise<void>; onReload: () => Promise<void>
  selectedRoundItemId: string | null; onInspectionSaved: (result: string) => Promise<void>
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
      <select value={kind} onChange={e => onKind(e.target.value)} aria-label="กรองประเภท"><option value="">ทุกประเภท</option>{Object.entries(ASSET_FILTER_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
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
        onEdit={() => onDraft(selected)} onShowMap={onShowMap} onRun={onRun} onReload={onReload} roundItemId={selectedRoundItemId} onInspectionSaved={onInspectionSaved} /> : null}
    </div>
    <div className="safety-list" ref={listRef}>{assets.map(item => <button key={item.id} className="safety-card" data-selected={selected?.id === item.id} aria-pressed={selected?.id === item.id} onClick={() => onSelect(item.code)}>
      <span className="safety-card-head"><strong>{item.nameTh}</strong><SafetyAssetStatusBadges item={item} /></span>
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
      <label>หน่วยงาน<input value={value.department ?? ''} onChange={e => setValue({ ...value, department: e.target.value || null })} /></label>
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

function AssetDetail({ item, locationLabel, canEdit, canManage, busy, onEdit, onShowMap, onRun, onReload, roundItemId, onInspectionSaved }: { item: SafetyAssetDTO; locationLabel: string; canEdit: boolean; canManage: boolean; busy: boolean; onEdit: () => void; onShowMap: () => void; onRun: (f: () => Promise<void>) => Promise<void>; onReload: () => Promise<void>; roundItemId: string | null; onInspectionSaved: (result: string) => Promise<void> }) {
  const latestInspection = item.latestInspection
  const [file, setFile] = useState<File | null>(null); const [result, setResult] = useState('passed'); const [note, setNote] = useState('')
  const [expires, setExpires] = useState(latestInspection?.expiresOn ?? '')
  const inspectedOn = todayIso()
  const nextDate = nextSafetyInspectionDate(inspectedOn)
  async function correctExpiry() {
    if (!latestInspection || expires === (latestInspection.expiresOn ?? '')) return
    await jsonRequest(`/api/admin/lab-map/safety-assets/${item.id}/inspection-expiry`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionId: latestInspection.id, expiresOn: expires || null, updatedAt: item.updatedAt }),
    })
    await onReload()
  }
  async function inspect() {
    if (!file) throw new Error('กรุณาถ่ายหรือเลือกรูปหลักฐาน')
    const signed = await jsonRequest(`/api/admin/lab-map/safety-assets/${item.id}/inspection-photo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, contentType: file.type, sizeBytes: file.size }) })
    await uploadFileWithProgress(signed.uploadUrl, file, file.type, () => {})
    await jsonRequest(`/api/admin/lab-map/safety-assets/${item.id}/inspection-photo`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: signed.key, fileName: file.name, result, inspectedOn, expiresOn: expires || null, note: note || null, roundItemId: roundItemId ?? null, checklist: [] }) })
    setFile(null); setNote(''); await onInspectionSaved(result)
  }
  return <section className="safety-form"><span className="safety-card-head"><h2 style={{ margin: 0, fontSize: 17 }}>{item.nameTh}</h2><SafetyAssetStatusBadges item={item} /></span>
    <p className="safety-muted" style={{ margin: 0 }}>{KIND_LABELS[item.kind]} · {item.code}<br />ตำแหน่ง: {locationLabel}<br />พิกัด {item.x}, {item.y}</p>
    <div className="safety-actions"><Button variant="secondary" size="lg" onClick={onShowMap}>ดูตำแหน่งบนผัง</Button></div>
    <SafetyPositionVerification item={item} disabled={busy} onVerified={onReload} />
    {item.latestInspection ? <><p style={{ margin: 0 }}>ตรวจล่าสุด {item.latestInspection.inspectedOn} · {STATUS_LABELS[item.latestInspection.result]}</p>{item.latestInspection.photoUrl ? <img className="safety-photo" src={item.latestInspection.photoUrl} alt={`หลักฐานการตรวจ ${item.nameTh}`} /> : null}</> : <p className="safety-muted">ยังไม่มีประวัติการตรวจ</p>}
    <AssetHistory assetId={item.id} />
    {canEdit && ['spill-kit', 'nss-eyewash'].includes(item.kind) ? <MonthlySafetyAssetConfig asset={item} onSaved={onReload} /> : null}
    {canEdit ? <><h3 style={{ margin: '6px 0 0', fontSize: 14 }}>บันทึกผลตรวจ</h3><div className="safety-form-grid">
      <label>ผลตรวจ<select value={result} onChange={e => setResult(e.target.value)}><option value="passed">ผ่าน</option><option value="needs_attention">ต้องติดตาม</option><option value="failed">ไม่พร้อมใช้</option><option value="not_found">ไม่พบอุปกรณ์</option></select></label>
      <SafetyPhotoPicker label="รูปหลักฐาน" file={file} disabled={busy} onChange={setFile} />
      <label>{SAFETY_INSPECTION_SCHEDULE_LABEL}<input type="date" value={nextDate} readOnly disabled /></label><label>{safetyExpiryLabel(item.kind)}<input type="date" value={expires} onChange={e => setExpires(e.target.value)} /></label>
    </div><label>หมายเหตุ<textarea value={note} onChange={e => setNote(e.target.value)} /></label>
    <div className="safety-actions"><Button variant="secondary" size="lg" icon="edit" onClick={onEdit}>แก้ข้อมูล</Button><Button variant="secondary" size="lg" icon="check" disabled={busy || !latestInspection || expires === (latestInspection.expiresOn ?? '')} onClick={() => void onRun(correctExpiry)}>บันทึกการแก้ไข</Button><Button size="lg" icon="check" disabled={busy || !file} onClick={() => void onRun(inspect)}>ยืนยันผลตรวจ</Button></div></> : null}
    {canManage ? <Button variant="danger" size="lg" disabled={busy} onClick={() => { if (confirm('เลิกใช้อุปกรณ์นี้หรือไม่')) void onRun(async () => { await jsonRequest(`/api/admin/lab-map/safety-assets/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updatedAt: item.updatedAt, retire: true }) }); await onReload() }) }}>เลิกใช้งาน</Button> : null}
  </section>
}

function MonthlySafetyAssetConfig({ asset, onSaved }: { asset: SafetyAssetDTO; onSaved: () => Promise<void> }) {
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [profile, setProfile] = useState<MonthlyProfile | null>(asset.inspectionProfile)
  const [activatedOn, setActivatedOn] = useState(nextMonthStart())
  const [primaryId, setPrimaryId] = useState('')
  const [backupId, setBackupId] = useState('')
  const [people, setPeople] = useState<MonthlyConfigResponse['people']>([])
  const [template, setTemplate] = useState<MonthlyConfigResponse['template']>(null)
  const [supplies, setSupplies] = useState<MonthlyConfigSupply[]>([])

  function existingSupplies(data: MonthlyConfigResponse): MonthlyConfigSupply[] {
    return data.supplies.map(item => ({
      id: item.id, templateItemId: item.template_item_id, supplyType: item.supply_type,
      internalCode: item.internal_code, labelTh: item.label_th,
      manufacturedOrPackedOn: item.manufactured_or_packed_on ?? '', purchasedOn: item.purchased_on ?? '',
      expiresOn: item.expires_on ?? '', supplier: item.supplier ?? '',
    }))
  }
  function suppliesFromTemplate(data: MonthlyConfigResponse): MonthlyConfigSupply[] {
    return data.templateItems.map(item => ({
      templateItemId: item.id, supplyType: 'spill_item', internalCode: item.item_key.toUpperCase(), labelTh: item.label_th,
      manufacturedOrPackedOn: '', purchasedOn: '', expiresOn: '', supplier: '',
    }))
  }
  async function load(profileOverride?: MonthlyProfile) {
    setError('')
    const suffix = profileOverride ? `?profile=${encodeURIComponent(profileOverride)}` : ''
    try {
      const data = await jsonRequest(`/api/admin/lab-map/safety-assets/${asset.id}/monthly-profile${suffix}`) as MonthlyConfigResponse
      setPeople(data.people); setTemplate(data.template)
      if (!profileOverride) {
        const current = data.asset.inspection_profile
        setProfile(current); setActivatedOn(nextMonthStart())
        setPrimaryId(data.assignments.find(item => item.assignment_role === 'primary')?.user_id ?? '')
        setBackupId(data.assignments.find(item => item.assignment_role === 'backup')?.user_id ?? '')
        setSupplies(existingSupplies(data))
      } else if (profileOverride === data.asset.inspection_profile) setSupplies(existingSupplies(data))
      else setSupplies(profileOverride === 'nss_eyewash' ? [] : suppliesFromTemplate(data))
    } catch (reason) { setError((reason as Error).message) }
    finally { setLoaded(true) }
  }
  useEffect(() => { void load() }, [asset.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function changeProfile(next: MonthlyProfile | null) {
    setProfile(next); setNotice('')
    if (!next) { setTemplate(null); setSupplies([]); return }
    await load(next)
  }
  function updateSupply(index: number, patch: Partial<MonthlyConfigSupply>) {
    setSupplies(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }
  function addBottle() {
    setSupplies(items => [...items, { templateItemId: null, supplyType: 'nss_bottle', internalCode: `NSS-${String(items.length + 1).padStart(3, '0')}`, labelTh: `NSS ขวดที่ ${items.length + 1}`, manufacturedOrPackedOn: '', purchasedOn: '', expiresOn: '', supplier: '' }])
  }
  async function save() {
    setSaving(true); setError(''); setNotice('')
    try {
      const assignments = [primaryId ? { userId: primaryId, assignmentRole: 'primary' } : null, backupId ? { userId: backupId, assignmentRole: 'backup' } : null].filter(Boolean)
      const body = {
        profile, activatedOn, assignments,
        supplies: profile ? supplies.map(item => ({
          id: item.id, templateItemId: item.templateItemId, supplyType: item.supplyType,
          internalCode: item.internalCode, labelTh: item.labelTh,
          manufacturedOrPackedOn: item.manufacturedOrPackedOn || null, purchasedOn: item.purchasedOn || null,
          expiresOn: item.expiresOn || null, supplier: item.supplier.trim() || null,
        })) : [],
      }
      const data = await jsonRequest(`/api/admin/lab-map/safety-assets/${asset.id}/monthly-profile`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) as MonthlyConfigResponse
      setSupplies(existingSupplies(data)); setNotice('บันทึกทะเบียนแล้ว จุดนี้จะเข้ารอบตามวันที่เริ่มใช้'); await onSaved()
    } catch (reason) { setError((reason as Error).message) }
    finally { setSaving(false) }
  }

  const profileOptions = asset.kind === 'nss-eyewash'
    ? [{ value: 'nss_eyewash', label: 'NSS Eyewash' }]
    : [{ value: 'biohazard_spill_kit', label: 'Biohazard Spill Kit' }, { value: 'chemical_spill_kit', label: 'Chemical Spill Kit' }]
  return <details className="safety-monthly-config" open={Boolean(asset.inspectionProfile)}>
    <summary>Profile ตรวจประจำเดือน</summary>
    {!loaded ? <p className="safety-muted">กำลังโหลดทะเบียน…</p> : <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
      {error ? <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: 12 }}>{error}</p> : null}
      {notice ? <p role="status" style={{ margin: 0, color: 'var(--success)', fontSize: 12 }}>{notice}</p> : null}
      <div className="safety-form-grid">
        <label>Profile ตรวจประจำเดือน<select value={profile ?? ''} onChange={event => void changeProfile((event.target.value || null) as MonthlyProfile | null)}><option value="">ไม่เข้ารอบตรวจประจำเดือน</option>{profileOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>เริ่มใช้<input type="date" value={activatedOn} onChange={event => setActivatedOn(event.target.value)} /><small className="safety-muted">จุดใหม่ควรเริ่มวันที่ 1 ของเดือนถัดไป</small></label>
        {profile ? <><label>ผู้รับผิดชอบหลัก<select value={primaryId} onChange={event => setPrimaryId(event.target.value)}><option value="">เลือกผู้รับผิดชอบหลัก</option>{people.map(person => <option key={person.id} value={person.id} disabled={person.id === backupId}>{person.name ?? person.id}{person.dept ? ` · ${person.dept}` : ''}</option>)}</select></label>
        <label>ผู้รับผิดชอบสำรอง<select value={backupId} onChange={event => setBackupId(event.target.value)}><option value="">ไม่ระบุ</option>{people.map(person => <option key={person.id} value={person.id} disabled={person.id === primaryId}>{person.name ?? person.id}{person.dept ? ` · ${person.dept}` : ''}</option>)}</select></label></> : null}
      </div>
      {profile ? <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div className="safety-card-head"><div><strong>Inventory / ขวด NSS</strong><small style={{ display: 'block' }}>{template ? `${template.title_th} · Version ${template.version}` : 'แม่แบบนี้ยัง inactive จึงยังเปิดใช้ไม่ได้'}</small></div>{profile === 'nss_eyewash' ? <Button variant="secondary" size="lg" icon="plus" onClick={addBottle}>เพิ่มขวด NSS</Button> : null}</div>
        {supplies.map((item, index) => <article key={item.id ?? item.templateItemId ?? index} style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
          <div className="safety-card-head"><strong>{index + 1}. {item.labelTh}</strong>{profile === 'nss_eyewash' ? <button type="button" onClick={() => setSupplies(items => items.filter((_, itemIndex) => itemIndex !== index))} style={{ minHeight: 44, border: 0, background: 'transparent', color: 'var(--danger)' }}>นำขวดออก</button> : null}</div>
          <div className="safety-form-grid">
            <label>รหัส<input value={item.internalCode} onChange={event => updateSupply(index, { internalCode: event.target.value })} /></label>
            <label>ชื่อรายการ<input value={item.labelTh} onChange={event => updateSupply(index, { labelTh: event.target.value })} /></label>
            <label>วันผลิต/บรรจุ หรือวันที่รับ<input type="date" value={item.manufacturedOrPackedOn} onChange={event => updateSupply(index, { manufacturedOrPackedOn: event.target.value })} /></label>
            <label>วันที่ซื้อ<input type="date" value={item.purchasedOn} onChange={event => updateSupply(index, { purchasedOn: event.target.value })} /></label>
            <label>วันหมดอายุ<input type="date" value={item.expiresOn} onChange={event => updateSupply(index, { expiresOn: event.target.value })} /></label>
            <label>ผู้ขาย<input value={item.supplier} onChange={event => updateSupply(index, { supplier: event.target.value })} /></label>
          </div>
        </article>)}
        {!supplies.length ? <p className="safety-muted" style={{ margin: 0 }}>ยังไม่มีรายการ inventory — เพิ่มขวดหรือเปิดใช้แม่แบบก่อนบันทึก</p> : null}
      </section> : null}
      <div className="safety-actions"><Button size="lg" icon="check" disabled={saving || !activatedOn || Boolean(profile && (!primaryId || !supplies.length || !template))} onClick={() => void save()}>{saving ? 'กำลังบันทึก…' : 'บันทึกทะเบียนรายเดือน'}</Button></div>
    </div>}
  </details>
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
    {items.map(entry => <article key={entry.id}><strong>{entry.inspectedOn} · {STATUS_LABELS[entry.result]}</strong><small>{entry.inspectorName ?? entry.inspectedBy}{entry.note ? ` · ${entry.note}` : ''}</small>{entry.photoUrl ? <img className="safety-photo" src={entry.photoUrl} alt={`หลักฐานการตรวจวันที่ ${entry.inspectedOn}`} /> : null}</article>)}
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
    {draft ? <AssemblyEditor key={`point-${draft.id ?? 'new'}-${draft.pointType ?? 'assembly'}`} draft={draft} busy={busy} onCancel={() => onDraft(null)} onChange={onDraft} onSave={value => onRun(async () => { const editing = Boolean(value.id); await jsonRequest(editing ? `/api/admin/lab-map/assembly-points/${value.id}` : '/api/admin/lab-map/assembly-points', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing ? { ...value, code: undefined, updatedAt: value.updatedAt } : value) }); await onReload(); onDraft(null) })} /> : selected ? <AssemblyDetail key={selected.id} point={selected} canEdit={canEdit} canManage={canManage} busy={busy} onEdit={() => onDraft(selected)} onRun={onRun} onReload={onReload} /> : null}
  </>
}

function AssemblyEditor({ draft, busy, onCancel, onSave, onChange }: { draft: Partial<AssemblyPointDTO>; busy: boolean; onCancel: () => void; onSave: (v: Partial<AssemblyPointDTO>) => void; onChange?: (v: Partial<AssemblyPointDTO>) => void }) {
  const [value, setValue] = useState({ ...draft }); const [accuracy, setAccuracy] = useState<number | null>(null); const [geoError, setGeoError] = useState('')
  useEffect(() => { onChange?.(value) }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  function locate() { setGeoError(''); navigator.geolocation.getCurrentPosition(position => { setValue(current => ({ ...current, latitude: Number(position.coords.latitude.toFixed(6)), longitude: Number(position.coords.longitude.toFixed(6)) })); setAccuracy(Math.round(position.coords.accuracy)) }, error => setGeoError(error.message), { enableHighAccuracy: true, timeout: 15000 }) }
  const currentPointType = value.pointType ?? 'assembly'
  return <section className="safety-form"><h2 style={{ margin: 0, fontSize: 16 }}>{draft.id ? `แก้ไข${pointTypeLabel(currentPointType)}` : `เพิ่ม${pointTypeLabel(currentPointType)}`}</h2>
    <fieldset><legend>ประเภทจุด</legend><div className="safety-point-type-options">{(['assembly', 'safe'] as const).map(pointType => <label key={pointType} style={{ flexDirection: 'row', alignItems: 'center' }}><input type="radio" name={`point-type-${draft.id ?? 'new'}`} checked={currentPointType === pointType} onChange={() => setValue({ ...value, pointType })} style={{ width: 20, minHeight: 20 }} />{POINT_TYPE_LABELS[pointType]}</label>)}</div></fieldset>
    <div className="safety-form-grid"><label>รหัส<input value={value.code ?? ''} disabled={Boolean(draft.id)} onChange={e => setValue({ ...value, code: e.target.value })} /></label><label>ชื่อ<input value={value.nameTh ?? ''} onChange={e => setValue({ ...value, nameTh: e.target.value })} /></label><label>Latitude<input type="number" step="0.000001" value={value.latitude ?? ''} onChange={e => setValue({ ...value, latitude: e.target.value ? Number(e.target.value) : null })} /></label><label>Longitude<input type="number" step="0.000001" value={value.longitude ?? ''} onChange={e => setValue({ ...value, longitude: e.target.value ? Number(e.target.value) : null })} /></label></div>
    <Button variant="secondary" size="lg" icon="globe" onClick={locate}>ใช้พิกัดปัจจุบันของอุปกรณ์</Button>{accuracy != null ? <p className="safety-coordinate-note">ความแม่นยำประมาณ {accuracy} เมตร — ตรวจสอบก่อนบันทึก</p> : null}{geoError ? <p role="alert" className="safety-muted">อ่าน GPS ไม่สำเร็จ: {geoError} คุณยังกรอกพิกัดเองได้</p> : null}
    <GoogleMapEmbed latitude={value.latitude} longitude={value.longitude} nameTh={value.nameTh} />
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
    {coordinates ? <><GoogleMapEmbed latitude={point.latitude} longitude={point.longitude} nameTh={point.nameTh} /><div className="safety-actions"><Button variant="secondary" size="lg" onClick={() => void navigator.clipboard.writeText(coordinates)}>คัดลอกพิกัด</Button><a href={`https://www.google.com/maps?q=${coordinates}`} target="_blank" rel="noreferrer" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', color: 'var(--primary)', fontWeight: 650 }}>เปิด Google Maps</a></div></> : <p className="safety-muted">ยังไม่มีพิกัด GPS</p>}
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
