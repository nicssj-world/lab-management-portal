'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { FilterChips, type FilterChipItem } from '@/components/ui/FilterChips'
import { Button } from '@/components/ui/Button'
import { EquipmentDetailModal } from '@/components/equipment/EquipmentDetailModal'
import { EquipmentPmCalModal } from '@/components/equipment/EquipmentPmCalModal'
import { LabMapStyles } from '@/components/lab-map/LabMapStyles'
import { EquipmentMapStyles } from './EquipmentMapStyles'
import { EquipmentMapCanvas, type EquipmentMapFocus } from './EquipmentMapCanvas'
import { EquipmentPinDialog } from './EquipmentPinDialog'
import { AreaPanel } from './AreaPanel'
import { PlacementFilters } from './PlacementFilters'
import { PlacementPanel } from './PlacementPanel'
import { SurveyRoundBar } from './SurveyRoundBar'
import { useUrlFilters } from '@/components/risk/shared/useUrlFilters'
import { filterPlacementItems } from '@/lib/equipment-map/placement-pagination'
import {
  EQUIPMENT_WORK_GROUPS,
  equipmentSelectionForArea,
  groupEquipmentWalkAreas,
  isEquipmentAreaSelectable,
} from '@/lib/equipment-map/walk-groups'
import type { Equipment } from '@/lib/queries/equipment'
import type { EquipmentAreaDTO, EquipmentMapDTO, EquipmentPinDTO } from '@/lib/equipment-map/types'

interface EquipmentMapClientProps {
  map: EquipmentMapDTO
  canEdit: boolean
}

interface Toast { id: number; msg: string; ok: boolean }
type PinPosition = Partial<Pick<EquipmentPinDTO, 'x' | 'y' | 'rotation'>>

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)
  const add = useCallback((msg: string, ok = true) => {
    const id = ++counter.current
    setToasts((current) => [...current, { id, msg, ok }])
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3500)
  }, [])
  return { toasts, add }
}

const FOCUS_ITEMS: readonly FilterChipItem<EquipmentMapFocus>[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'due', label: 'ใกล้/เกินกำหนด PM-CAL' },
  { value: 'broken', label: 'ชำรุด' },
  { value: 'pending', label: 'รอขึ้นทะเบียน' },
  { value: 'unsurveyed', label: 'ยังไม่สำรวจ' },
]

function pinsForArea(area: EquipmentAreaDTO, areas: readonly EquipmentAreaDTO[], pins: readonly EquipmentPinDTO[]): EquipmentPinDTO[] {
  if (area.kind === 'room') {
    const childZoneCodes = new Set(areas.filter((candidate) => candidate.parentCode === area.code).map((candidate) => candidate.code))
    return pins.filter((pin) => pin.areaCode === area.code || childZoneCodes.has(pin.areaCode))
  }
  return pins.filter((pin) => pin.areaCode === area.code)
}

function countsForPins(pins: readonly EquipmentPinDTO[]): EquipmentAreaDTO['counts'] {
  return {
    total: pins.length,
    active: pins.filter((pin) => pin.status === 'Active').length,
    broken: pins.filter((pin) => pin.status === 'ชำรุด').length,
    dueSoon: pins.filter((pin) => pin.due === 'due_soon').length,
    overdue: pins.filter((pin) => pin.due === 'overdue').length,
    pendingReg: pins.filter((pin) => pin.pendingRegistration).length,
    unsurveyed: pins.filter((pin) => !pin.surveyed).length,
  }
}

async function callApi(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'เกิดข้อผิดพลาด')
  return data
}

function EquipmentSymbolLegendMark({ kind }: { kind: 'refrigerator' | 'centrifuge' | 'microscope' | 'bsc' | 'code' }) {
  if (kind === 'code') return <i className="equipment-symbol-swatch">EQ</i>

  if (kind === 'refrigerator') {
    return <svg className="equipment-symbol-preview equipment-symbol-preview--refrigerator" viewBox="0 0 22 38" aria-hidden="true">
      <rect className="equipment-symbol-preview-body" x="1" y="1" width="20" height="36" rx="3" />
      <path className="equipment-symbol-preview-detail" d="M 2 20 H 20 M 10 4 V 17" />
    </svg>
  }

  if (kind === 'centrifuge') {
    return <svg className="equipment-symbol-preview equipment-symbol-preview--centrifuge" viewBox="0 0 30 28" aria-hidden="true">
      <rect className="equipment-symbol-preview-body" x="1" y="1" width="28" height="26" rx="6" />
      <circle className="equipment-symbol-preview-detail" cx="15" cy="14" r="7" />
      <circle className="equipment-symbol-preview-dot" cx="11" cy="12" r="1.8" />
      <circle className="equipment-symbol-preview-dot" cx="19" cy="12" r="1.8" />
      <circle className="equipment-symbol-preview-dot" cx="15" cy="19" r="1.8" />
    </svg>
  }

  if (kind === 'microscope') {
    return <svg className="equipment-symbol-preview equipment-symbol-preview--microscope" viewBox="0 0 48 48" aria-hidden="true">
      <path className="equipment-symbol-preview-body equipment-symbol-preview-outline" d="M 11 39 H 38 M 18 35 L 28 25 L 19 11 L 13 16 L 22 27 L 15 35" />
      <circle className="equipment-symbol-preview-body" cx="29" cy="16" r="5" />
      <path className="equipment-symbol-preview-detail" d="M 18 35 H 35 M 19 11 L 24 8" />
    </svg>
  }

  return <svg className="equipment-symbol-preview equipment-symbol-preview--bsc" viewBox="0 0 48 48" aria-hidden="true">
    <rect className="equipment-symbol-preview-body" x="4" y="10" width="40" height="28" rx="4" />
    <path className="equipment-symbol-preview-detail" d="M 9 18 H 39 M 9 24 H 39 M 9 30 H 39" />
  </svg>
}

export function EquipmentMapClient({ map, canEdit }: EquipmentMapClientProps) {
  const router = useRouter()
  const { toasts, add: addToast } = useToast()
  const { filters, setFilters } = useUrlFilters({ area: '', focus: 'all', q: '' })
  const focus = (filters.focus as EquipmentMapFocus) || 'all'

  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)
  const [detailEquipmentId, setDetailEquipmentId] = useState<string | null>(null)
  const [pmCalItem, setPmCalItem] = useState<Equipment | null>(null)
  const [showPlacement, setShowPlacement] = useState(false)
  const [placingId, setPlacingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState(filters.q)
  const [placementDepartment, setPlacementDepartment] = useState('')
  const [placementClassification, setPlacementClassification] = useState('')
  const [placementCalibrationOnly, setPlacementCalibrationOnly] = useState(false)
  const [placementFilterRevision, setPlacementFilterRevision] = useState(0)
  const [optimisticPinPositions, setOptimisticPinPositions] = useState<Record<string, PinPosition>>({})

  const mapPins = useMemo(
    () => map.pins.map((pin) => optimisticPinPositions[pin.id] ? { ...pin, ...optimisticPinPositions[pin.id] } : pin),
    [map.pins, optimisticPinPositions],
  )

  useEffect(() => {
    setOptimisticPinPositions((current) => {
      const next = { ...current }
      let changed = false
      for (const [id, position] of Object.entries(current)) {
        const pin = map.pins.find((candidate) => candidate.id === id)
        if (pin && pin.x === position.x && pin.y === position.y && (position.rotation === undefined || pin.rotation === position.rotation)) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [map.pins])

  const selectedAreaCode = filters.area ? equipmentSelectionForArea(filters.area) : ''
  const selectedArea = selectedAreaCode && isEquipmentAreaSelectable(selectedAreaCode)
    ? map.areas.find((area) => area.code === selectedAreaCode) ?? null
    : null
  const selectedPin = selectedPinId ? mapPins.find((pin) => pin.id === selectedPinId) ?? null : null
  const selectedPinAreaName = selectedPin ? map.areas.find((area) => area.code === selectedPin.areaCode)?.nameTh ?? selectedPin.areaCode : ''
  const filteredUnplaced = useMemo(
    () => filterPlacementItems(
      map.unplaced,
      placementDepartment,
      placementClassification,
      placementCalibrationOnly,
    ),
    [map.unplaced, placementDepartment, placementClassification, placementCalibrationOnly],
  )

  const globalCounts = useMemo(() => {
    let due = 0, broken = 0, pending = 0, unsurveyed = 0
    for (const pin of map.pins) {
      if (pin.due === 'due_soon' || pin.due === 'overdue') due += 1
      if (pin.status === 'ชำรุด') broken += 1
      if (pin.pendingRegistration) pending += 1
      if (!pin.surveyed) unsurveyed += 1
    }
    return { all: map.pins.length, due, broken, pending, unsurveyed }
  }, [map.pins])

  const walkAreas = useMemo(() => map.areas
    .filter((area) => area.isActive && area.hasGeometry)
    .map((area) => {
      // ห้องแม่เป็น roll-up ทางภาพ: ห้ามนำยอดที่รวมโซนลูกแล้วไปบวกกับโซนลูกอีกครั้ง.
      const directPins = mapPins.filter((pin) => pin.areaCode === area.code)
      const unsurveyed = directPins.filter((pin) => !pin.surveyed).length
      const overdue = directPins.filter((pin) => pin.due === 'overdue').length
      const dueSoon = directPins.filter((pin) => pin.due === 'due_soon').length
      return { area, total: directPins.length, unsurveyed, overdue, dueSoon }
    }), [map.areas, mapPins])
  // ห้องแม่รวมเครื่องมือจากทุกโซนลูกไว้เพื่อให้เปิดดูภาพรวมได้ แต่การนับความคืบหน้า
  // และปุ่มพื้นที่ถัดไปต้องใช้เฉพาะพื้นที่ปลายทาง เพื่อไม่ให้นับเครื่องมือซ้ำสองครั้ง.
  const inspectionAreas = walkAreas.filter((item) => !walkAreas.some((candidate) => candidate.area.parentCode === item.area.code))
  const groupedWalkAreas = useMemo(() => groupEquipmentWalkAreas(walkAreas), [walkAreas])
  const selectedWorkGroup = groupedWalkAreas.groups.find((group) => group.summary?.selectionCode === selectedAreaCode) ?? null
  const selectedWorkGroupAreaCodes = selectedWorkGroup?.items.map((item) => item.area.code) ?? []
  const selectedWorkGroupPins = useMemo(() => {
    if (!selectedWorkGroup) return []
    const areaCodes = new Set(selectedWorkGroup.items.map((item) => item.area.code))
    return mapPins.filter((pin) => areaCodes.has(pin.areaCode))
  }, [selectedWorkGroup, mapPins])
  const selectedWorkGroupArea = useMemo<EquipmentAreaDTO | null>(() => selectedWorkGroup ? ({
    code: selectedWorkGroup.summary!.selectionCode,
    nameTh: `ทั้ง ${selectedWorkGroup.nameTh}`,
    kind: 'room',
    parentCode: null,
    workGroupCode: selectedWorkGroup.code,
    workGroupNameTh: selectedWorkGroup.nameTh,
    workGroupOrder: selectedWorkGroup.order,
    isWorkGroupSummary: true,
    rect: null,
    polygon: null,
    label: null,
    fillTone: null,
    hasGeometry: false,
    isActive: true,
    counts: countsForPins(selectedWorkGroupPins),
  }) : null, [selectedWorkGroup, selectedWorkGroupPins])
  const inspectionProgress = useMemo(() => {
    const total = inspectionAreas.reduce((sum, item) => sum + item.total, 0)
    const unsurveyed = inspectionAreas.reduce((sum, item) => sum + item.unsurveyed, 0)
    return { total, surveyed: total - unsurveyed, unsurveyed }
  }, [inspectionAreas])
  const selectedWalkArea = selectedArea ? walkAreas.find((item) => item.area.code === selectedArea.code) ?? null : null
  const selectedWalkSummary = selectedWorkGroup?.summary ?? (selectedWalkArea ? {
    nameTh: selectedWalkArea.area.nameTh,
    total: selectedWalkArea.total,
    unsurveyed: selectedWalkArea.unsurveyed,
    overdue: selectedWalkArea.overdue,
    dueSoon: selectedWalkArea.dueSoon,
  } : null)

  const searchResults = useMemo(() => {
    const text = query.trim().toLocaleLowerCase('th')
    if (!text) return []
    const workGroupMatches = EQUIPMENT_WORK_GROUPS
      .filter((group) => group.nameTh.toLocaleLowerCase('th').includes(text))
      .map((group) => ({ kind: 'work-group' as const, code: `work-group:${group.code}`, label: `ทั้ง ${group.nameTh}` }))
    const areaMatches = map.areas
      .filter((area) => area.hasGeometry && isEquipmentAreaSelectable(area.code) && area.nameTh.toLocaleLowerCase('th').includes(text))
      .map((area) => ({ kind: 'area' as const, code: area.code, label: area.nameTh }))
    const pinMatches = map.pins
      .filter((pin) => pin.name.toLocaleLowerCase('th').includes(text) || (pin.code ?? '').toLocaleLowerCase('th').includes(text))
      .map((pin) => ({ kind: 'pin' as const, code: pin.id, label: `${pin.name}${pin.code ? ' · ' + pin.code : ''}` }))
    return [...workGroupMatches, ...areaMatches, ...pinMatches].slice(0, 8)
  }, [query, map.areas, map.pins])

  function selectSearchResult(result: { kind: 'area' | 'work-group' | 'pin'; code: string }) {
    if (result.kind === 'area' || result.kind === 'work-group') {
      setFilters({ area: result.code })
    } else {
      const pin = map.pins.find((item) => item.id === result.code)
      if (pin) { setFilters({ area: pin.areaCode }); setSelectedPinId(pin.id) }
    }
    setQuery('')
  }

  function selectNextWalkArea() {
    if (inspectionAreas.length === 0) return
    const currentIndex = selectedWalkArea ? inspectionAreas.findIndex((item) => item.area.code === selectedWalkArea.area.code) : -1
    const ordered = [...inspectionAreas.slice(currentIndex + 1), ...inspectionAreas.slice(0, currentIndex + 1)]
    const next = ordered.find((item) => item.unsurveyed > 0 || item.overdue > 0 || item.dueSoon > 0) ?? ordered[0]
    if (next) setFilters({ area: next.area.code })
  }

  async function run(action: () => Promise<void>, successMsg?: string, onError?: () => void) {
    setBusy(true)
    try {
      await action()
      if (successMsg) addToast(successMsg)
      router.refresh()
    } catch (error) {
      onError?.()
      addToast((error as Error).message, false)
    } finally {
      setBusy(false)
    }
  }

  function handleCoordinateSelect(result: { areaCode: string; x: number; y: number } | { error: 'outside_area' }) {
    if (!placingId) return
    if ('error' in result) {
      addToast('กรุณาคลิกภายในห้องหรือโซนที่มีบนแผนที่', false)
      return
    }
    const id = placingId
    setPlacingId(null)
    void run(() => callApi(`/api/admin/equipment/${id}/position`, 'PATCH', { areaCode: result.areaCode, x: result.x, y: result.y }), 'ปักหมุดสำเร็จ')
  }

  function handleCategorize(id: string, areaCode: string) {
    void run(() => callApi(`/api/admin/equipment/${id}/position`, 'PATCH', { areaCode, x: null, y: null }), 'กำหนดพื้นที่แล้ว — ปักหมุดได้เมื่อพร้อม')
  }

  function handleToggleSurveyed(surveyed: boolean) {
    if (!selectedPin) return
    void run(() => callApi(`/api/admin/equipment/${selectedPin.id}/survey`, 'POST', { surveyed }))
  }

  function handleStartMove() {
    if (!selectedPin) return
    setPlacingId(selectedPin.id)
    setSelectedPinId(null)
  }

  function handleRemoveFromMap() {
    if (!selectedPin) return
    const id = selectedPin.id
    void run(async () => {
      await callApi(`/api/admin/equipment/${id}/position`, 'PATCH', { areaCode: null, x: null, y: null })
      setSelectedPinId(null)
    }, 'เอาเครื่องมือออกจากแผนผังแล้ว')
  }

  function handleMoveToArea(areaCode: string) {
    if (!selectedPin) return
    const id = selectedPin.id
    void run(async () => {
      await callApi(`/api/admin/equipment/${id}/position`, 'PATCH', { areaCode, x: null, y: null })
      setSelectedPinId(null)
    }, 'ย้ายเครื่องมือไปพื้นที่ที่เลือกแล้ว')
  }

  function handleMovePin(input: { id: string; areaCode: string; x: number; y: number }) {
    setOptimisticPinPositions((current) => ({ ...current, [input.id]: { ...current[input.id], x: input.x, y: input.y } }))
    void run(
      () => callApi(`/api/admin/equipment/${input.id}/position`, 'PATCH', { areaCode: input.areaCode, x: input.x, y: input.y }),
      'ย้ายตำแหน่งบนแผนผังแล้ว',
      () => setOptimisticPinPositions((current) => {
        const { [input.id]: _failedPosition, ...remaining } = current
        return remaining
      }),
    )
  }

  function handleRotatePin(rotation: number) {
    if (!selectedPin || selectedPin.x == null || selectedPin.y == null) return
    const pin = selectedPin
    setOptimisticPinPositions((current) => ({ ...current, [pin.id]: { ...current[pin.id], rotation: rotation as EquipmentPinDTO['rotation'] } }))
    void run(
      () => callApi(`/api/admin/equipment/${pin.id}/position`, 'PATCH', { areaCode: pin.areaCode, x: pin.x, y: pin.y, rotation }),
      'หมุนสัญลักษณ์บนแผนผังแล้ว',
      () => setOptimisticPinPositions((current) => {
        const { [pin.id]: _failedRotation, ...remaining } = current
        return remaining
      }),
    )
  }

  function handleOpenPmCal(id: string) {
    void (async () => {
      try {
        const item = await callApi(`/api/admin/equipment/${id}`, 'GET') as Equipment
        setPmCalItem(item)
      } catch (error) {
        addToast((error as Error).message, false)
      }
    })()
  }

  function handleRenameArea(nameTh: string) {
    if (!selectedArea) return
    void run(() => callApi(`/api/admin/equipment/areas/${selectedArea.code}`, 'PATCH', { nameTh }), 'บันทึกชื่อพื้นที่แล้ว')
  }

  function handleOpenRound(nameTh: string) {
    void run(() => callApi('/api/admin/equipment/survey-rounds', 'POST', { nameTh }), 'เปิดรอบสำรวจแล้ว')
  }

  function handleCloseRound() {
    if (!map.activeRound) return
    void run(() => callApi(`/api/admin/equipment/survey-rounds/${map.activeRound!.id}`, 'PATCH', { closed: true }), 'ปิดรอบสำรวจแล้ว')
  }

  function resetPlacementPage() {
    setPlacementFilterRevision((current) => current + 1)
  }

  function clearPlacementFilters() {
    setPlacementDepartment('')
    setPlacementClassification('')
    setPlacementCalibrationOnly(false)
    resetPlacementPage()
  }

  return (
    <div className="lab-map-shell equipment-map-shell">
      <LabMapStyles />
      <EquipmentMapStyles />

      <PageHeader
        title="แผนผังเครื่องมือ"
        subtitle="วางแผน PM/CAL โดยเดินตรวจทีละพื้นที่ — ปักหมุด ติ๊กสำรวจ และดูสถานะเครื่องมือบนแผนที่"
        eyebrow="ทะเบียนเครื่องมือ"
        actions={
          <Button variant="secondary" icon="inbox" onClick={() => setShowPlacement(true)}>
            ยังไม่กำหนดตำแหน่ง ({map.unplaced.length})
          </Button>
        }
      />

      <SurveyRoundBar
        activeRound={map.activeRound}
        canEdit={canEdit}
        busy={busy}
        onOpenRound={handleOpenRound}
        onCloseRound={handleCloseRound}
      />

      <section className="equipment-mobile-walk-bar" aria-label="การเดินตรวจ PM/CAL บนมือถือ">
        <div className="equipment-mobile-walk-status">
          <span>{map.activeRound ? `รอบสำรวจ: ${map.activeRound.nameTh}` : 'ยังไม่ได้เปิดรอบสำรวจ'}</span>
          <strong>{map.activeRound ? `สำรวจแล้ว ${inspectionProgress.surveyed}/${inspectionProgress.total}` : `งาน PM/CAL ที่ต้องติดตาม ${globalCounts.due}`}</strong>
        </div>
        <div className="equipment-mobile-walk-controls">
          <label>
            <span>พื้นที่ที่กำลังตรวจ</span>
            <select value={selectedWalkArea || selectedWorkGroup ? filters.area : ''} onChange={(event) => setFilters({ area: event.target.value })}>
              <option value="">เลือกพื้นที่…</option>
              {groupedWalkAreas.groups.map((group) => (
                <optgroup key={group.code} label={group.nameTh}>
                  {group.summary ? (
                    <option value={group.summary.selectionCode}>
                      ทั้ง {group.summary.nameTh} · {group.summary.total} เครื่องมือ · เหลือ {group.summary.unsurveyed} · PM/CAL {group.summary.overdue + group.summary.dueSoon}
                    </option>
                  ) : null}
                  {group.items.filter(({ area }) => !area.isWorkGroupSummary).map(({ area, total, unsurveyed, overdue, dueSoon }) => (
                      <option key={area.code} value={area.code}>
                        — {area.nameTh} · {total} เครื่องมือ · เหลือ {unsurveyed} · PM/CAL {overdue + dueSoon}
                      </option>
                  ))}
                </optgroup>
              ))}
              {groupedWalkAreas.standalone.map(({ area, total, unsurveyed, overdue, dueSoon }) => (
                <option key={area.code} value={area.code}>
                  {area.nameTh} · {total} เครื่องมือ · เหลือ {unsurveyed} · PM/CAL {overdue + dueSoon}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" variant="secondary" iconRight="arrowRight" onClick={selectNextWalkArea} disabled={inspectionAreas.length === 0}>
            เลือกพื้นที่ถัดไป
          </Button>
        </div>
        {selectedWalkSummary ? (
          <p className="equipment-mobile-walk-summary">
            <b>{selectedWalkSummary.nameTh}</b>
            <span>เหลือสำรวจ {selectedWalkSummary.unsurveyed}/{selectedWalkSummary.total} · เกินกำหนด {selectedWalkSummary.overdue} · ใกล้ครบ {selectedWalkSummary.dueSoon}</span>
          </p>
        ) : (
          <p className="equipment-mobile-walk-summary">เลือกห้องเพื่อดูรายการเครื่องมือและบันทึกการสำรวจของพื้นที่นั้น</p>
        )}
      </section>

      <div className="lab-map-toolbar equipment-map-toolbar">
        <FilterChips
          label="ตัวกรองแผนที่"
          value={focus}
          onChange={(value) => setFilters({ focus: value })}
          items={FOCUS_ITEMS.map((item) => ({ ...item, count: globalCounts[item.value] }))}
        />
        <div className="equipment-map-search-wrap" style={{ position: 'relative' }}>
          <div className="equipment-map-search">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาห้อง โซน หรือเครื่องมือ…"
              aria-label="ค้นหาบนแผนผังเครื่องมือ"
            />
          </div>
          {searchResults.length > 0 ? (
            <ul className="lab-map-search-results">
              {searchResults.map((result) => (
                <li key={`${result.kind}-${result.code}`}>
                  <button type="button" onClick={() => selectSearchResult(result)}>
                    <span>{result.label}</span>
                    <small>{result.kind === 'pin' ? 'เครื่องมือ' : result.kind === 'work-group' ? 'กลุ่มงาน' : 'พื้นที่'}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {showPlacement ? (
        <PlacementFilters
          unplaced={map.unplaced}
          department={placementDepartment}
          classification={placementClassification}
          calibrationOnly={placementCalibrationOnly}
          onDepartmentChange={(value) => { setPlacementDepartment(value); resetPlacementPage() }}
          onClassificationChange={(value) => { setPlacementClassification(value); resetPlacementPage() }}
          onCalibrationOnlyChange={(value) => { setPlacementCalibrationOnly(value); resetPlacementPage() }}
          onClear={clearPlacementFilters}
        />
      ) : null}

      <div className="lab-map-workspace">
        <EquipmentMapCanvas
          key={showPlacement ? 'placement' : 'map'}
          viewBox={map.viewBox}
          walls={map.walls}
          doors={map.doors}
          areas={map.areas}
          pins={mapPins}
          selectedAreaCode={selectedArea?.code ?? null}
          highlightedAreaCodes={selectedWorkGroupAreaCodes}
          selectedPinId={selectedPinId}
          onSelectArea={(code) => setFilters({ area: equipmentSelectionForArea(code) })}
          onSelectPin={(id) => setSelectedPinId(id)}
          onCoordinateSelect={placingId ? handleCoordinateSelect : undefined}
          onMovePin={canEdit ? handleMovePin : undefined}
          focus={focus}
          hasActiveRound={Boolean(map.activeRound)}
        />

        {showPlacement ? (
          <PlacementPanel
            key={placementFilterRevision}
            items={filteredUnplaced}
            areas={map.areas}
            placingId={placingId}
            busy={busy}
            onClose={() => { setShowPlacement(false); setPlacingId(null) }}
            onCategorize={handleCategorize}
            onViewDetails={setDetailEquipmentId}
            onStartPlacement={(id) => setPlacingId(id)}
            onCancelPlacement={() => setPlacingId(null)}
          />
          ) : selectedArea ? (
            <AreaPanel
              key={selectedArea.code}
              area={selectedArea}
              pins={pinsForArea(selectedArea, map.areas, map.pins)}
            canEdit={canEdit}
            busy={busy}
            onClose={() => setFilters({ area: '' })}
            onSelectPin={(id) => setSelectedPinId(id)}
              onRename={handleRenameArea}
            />
          ) : selectedWorkGroupArea ? (
            <AreaPanel
              key={selectedWorkGroupArea.code}
              area={selectedWorkGroupArea}
              pins={selectedWorkGroupPins}
              canEdit={false}
              busy={busy}
              onClose={() => setFilters({ area: '' })}
              onSelectPin={(id) => setSelectedPinId(id)}
              onRename={() => undefined}
              kindLabel="กลุ่มงาน"
              showRegistryLink={false}
            />
          ) : (
          <div className="lab-map-detail-panel">
            <div className="lab-map-empty-detail">
              <span>?</span>
              <h2>เลือกห้องหรือโซน</h2>
              <p>คลิกที่พื้นที่บนแผนที่เพื่อดูรายการเครื่องมือ หรือคลิกที่หมุดเพื่อดูรายละเอียด</p>
            </div>
          </div>
        )}
      </div>

      <div className="equipment-map-legend">
        <span><i style={{ background: '#fff', borderColor: 'var(--success)' }} /> วงแหวนเขียว = สำรวจแล้ว</span>
        <span><i style={{ background: '#fff', borderColor: 'var(--danger)' }} /> วงแหวนแดง = ยังไม่สำรวจ</span>
        <span><i className="equipment-map-legend-badge equipment-map-legend-badge--pending">?</i> รอขึ้นทะเบียน</span>
        <span><i className="equipment-map-legend-badge equipment-map-legend-badge--due-soon">◐</i> ใกล้ครบกำหนด PM/CAL</span>
        <span><i className="equipment-map-legend-badge equipment-map-legend-badge--overdue">!</i> เกินกำหนด PM/CAL</span>
      </div>
      <div className="equipment-map-symbol-legend" aria-label="คำอธิบายสัญลักษณ์เครื่องมือ">
        <span><EquipmentSymbolLegendMark kind="refrigerator" /> ตู้เย็น</span>
        <span><EquipmentSymbolLegendMark kind="centrifuge" /> เครื่องปั่นเหวี่ยง</span>
        <span><EquipmentSymbolLegendMark kind="microscope" /> กล้องจุลทรรศน์</span>
        <span><EquipmentSymbolLegendMark kind="bsc" /> ตู้ชีวนิรภัย</span>
        <span><EquipmentSymbolLegendMark kind="code" /> รหัสย่อ = อุปกรณ์อื่น</span>
      </div>

      {selectedPin ? (
        <EquipmentPinDialog
          pin={selectedPin}
          areas={map.areas}
          areaNameTh={selectedPinAreaName}
          canEdit={canEdit}
          hasActiveRound={Boolean(map.activeRound)}
          busy={busy}
          onClose={() => setSelectedPinId(null)}
          onToggleSurveyed={handleToggleSurveyed}
          onStartMove={handleStartMove}
          onOpenPmCal={handleOpenPmCal}
          onRemoveFromMap={handleRemoveFromMap}
          onMoveToArea={handleMoveToArea}
          onRotate={handleRotatePin}
        />
      ) : null}

      {detailEquipmentId ? (
        <EquipmentDetailModal
          key={detailEquipmentId}
          equipmentId={detailEquipmentId}
          onClose={() => setDetailEquipmentId(null)}
        />
      ) : null}

      {pmCalItem ? (
        <EquipmentPmCalModal
          item={pmCalItem}
          canEdit={canEdit}
          onClose={() => setPmCalItem(null)}
          onSaved={(updated) => { setPmCalItem(updated); router.refresh() }}
        />
      ) : null}

      <div style={{ position: 'fixed', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 1100 }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{ background: toast.ok ? 'var(--success)' : 'var(--danger)', color: '#fff', padding: '10px 16px', borderRadius: 8, fontSize: '.84rem', boxShadow: '0 8px 20px rgba(0,0,0,.18)' }}
          >
            {toast.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
