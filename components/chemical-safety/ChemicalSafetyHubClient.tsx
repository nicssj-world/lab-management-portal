'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Stat } from '@/components/ui/Stat'
import { ViewTabs } from '@/components/ui/ViewTabs'
import { CHEMICAL_HUB_VIEWS, type ChemicalHubView } from '@/lib/navigation'
import { calculateHoldingTotalFromFields } from '@/lib/chemical-safety/domain'
import type { ChemicalHoldingDeleteImpact } from '@/lib/chemical-safety/holding-delete'
import { paginateRegistryItems } from '@/lib/chemical-safety/registry-pagination'
import { resetRegistryFiltersForStorageNavigation } from '@/lib/chemical-safety/registry-navigation'
import { summarizeChemicalRegistry } from '@/lib/chemical-safety/registry-summary'
import { filterDepartmentChemicalCandidates } from '@/lib/chemical-safety/department-chemical-candidates'
import { CHEMICAL_GROUP_SUMMARY } from '@/lib/chemical-safety/storage-manifest'
import type {
  ChemicalProductDTO,
  ChemicalRoomDTO,
  ChemicalRegistryRow,
  ChemicalSdsDTO,
  ChemicalStorageLocationDTO,
  ChemicalUnitDTO,
} from '@/lib/chemical-safety/types'
import { RegistryChangeModal, type RegistryChangeMode } from './RegistryChangeModal'
import { ChemicalDetailsModal, type ChemicalDetailsTab } from './ChemicalDetailsModal'
import { HoldingDeleteImpactDialog } from './HoldingDeleteImpactDialog'
import { BulkHoldingDeleteImpactDialog } from './BulkHoldingDeleteImpactDialog'
import { SdsManagementClient, type SdsProductInfo } from './SdsManagementClient'
import type { DepartmentSdsGroupDTO } from '@/lib/chemical-safety/department-repository'
import { roomPublicationLabel } from '@/lib/chemical-safety/publication-summary'
import { FONT, SDS_ONLY_CAPTURE_LABEL, SPACE, ZONE_META, tabularNums } from './shared/tokens'
import {
  DepartmentPublishBadge,
  GhsRow,
  PositionChip,
  SdsStateBadge,
} from './shared/ui'

interface Props {
  view: ChemicalHubView
  locations: ChemicalStorageLocationDTO[]
  rooms: ChemicalRoomDTO[]
  registry: ChemicalRegistryRow[]
  products: ChemicalProductDTO[]
  units: ChemicalUnitDTO[]
  actorId: string
  canManageChemicals: boolean
  canProposeUnitIds: string[]
  sdsItems: ChemicalSdsDTO[]
  roomSdsItems: ChemicalSdsDTO[]
  sdsProducts: SdsProductInfo[]
  departmentSds: DepartmentSdsGroupDTO[]
  publishableDepartmentCodes: string[]
}

function formatQuantity(value: number): string {
  return value.toLocaleString('th-TH', { maximumFractionDigits: 6 })
}

function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([])
  const counter = useRef(0)
  const add = useCallback((msg: string, ok = true) => {
    const id = ++counter.current
    setToasts((t) => [...t, { id, msg, ok }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  return { toasts, add }
}

interface ModalState {
  mode: RegistryChangeMode
  product?: ChemicalProductDTO
  registryRow?: ChemicalRegistryRow
}

interface ChemicalDetailsState {
  row: ChemicalRegistryRow
  product?: ChemicalProductDTO
  tab: ChemicalDetailsTab
}

interface FloatingScrollbarState {
  visible: boolean
  left: number
  width: number
  contentWidth: number
}

function RegistryHorizontalScroll({ children }: { children: ReactNode }) {
  const registryTableScrollRef = useRef<HTMLDivElement | null>(null)
  const registryFloatingScrollRef = useRef<HTMLDivElement | null>(null)
  const [floatingScrollbar, setFloatingScrollbar] = useState<FloatingScrollbarState>({
    visible: false,
    left: 0,
    width: 0,
    contentWidth: 0,
  })

  useEffect(() => {
    const tableScroller = registryTableScrollRef.current
    if (!tableScroller) return

    let animationFrame = 0
    const updateFloatingScrollbar = () => {
      const rect = tableScroller.getBoundingClientRect()
      const viewportWidth = document.documentElement.clientWidth
      const viewportHeight = window.innerHeight
      const left = Math.max(8, rect.left)
      const right = Math.min(viewportWidth - 8, rect.right)
      const width = Math.max(0, right - left)
      const nextState: FloatingScrollbarState = {
        visible: tableScroller.scrollWidth > tableScroller.clientWidth
          && width > 48
          && rect.top < viewportHeight
          && rect.bottom > viewportHeight,
        left,
        width,
        contentWidth: tableScroller.scrollWidth,
      }

      setFloatingScrollbar(current => (
        current.visible === nextState.visible
          && current.left === nextState.left
          && current.width === nextState.width
          && current.contentWidth === nextState.contentWidth
          ? current
          : nextState
      ))
    }
    const scheduleUpdate = () => {
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(updateFloatingScrollbar)
    }

    updateFloatingScrollbar()
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleUpdate)
    resizeObserver?.observe(tableScroller)
    if (tableScroller.firstElementChild) resizeObserver?.observe(tableScroller.firstElementChild)
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate, { passive: true })

    return () => {
      cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [])

  useEffect(() => {
    if (!floatingScrollbar.visible || !registryFloatingScrollRef.current || !registryTableScrollRef.current) return
    registryFloatingScrollRef.current.scrollLeft = registryTableScrollRef.current.scrollLeft
  }, [floatingScrollbar.visible, floatingScrollbar.contentWidth])

  function syncFromTable() {
    const tableScroller = registryTableScrollRef.current
    const floatingScroller = registryFloatingScrollRef.current
    if (tableScroller && floatingScroller && floatingScroller.scrollLeft !== tableScroller.scrollLeft) {
      floatingScroller.scrollLeft = tableScroller.scrollLeft
    }
  }

  function syncFromFloating() {
    const tableScroller = registryTableScrollRef.current
    const floatingScroller = registryFloatingScrollRef.current
    if (tableScroller && floatingScroller && tableScroller.scrollLeft !== floatingScroller.scrollLeft) {
      tableScroller.scrollLeft = floatingScroller.scrollLeft
    }
  }

  return (
    <>
      <div
        ref={registryTableScrollRef}
        className="chemical-registry-table-scroll"
        onScroll={syncFromTable}
        tabIndex={0}
        aria-label="ตารางทะเบียนสารเคมี เลื่อนในแนวนอนเพื่อดูคอลัมน์เพิ่มเติม"
      >
        {children}
      </div>
      {floatingScrollbar.visible && (
        <div
          ref={registryFloatingScrollRef}
          className="chemical-registry-floating-scroll"
          style={{ left: floatingScrollbar.left, width: floatingScrollbar.width }}
          onScroll={syncFromFloating}
          tabIndex={0}
          aria-label="แถบเลื่อนแนวนอนสำหรับตารางทะเบียนสารเคมี"
        >
          <div style={{ width: floatingScrollbar.contentWidth, height: 1 }} />
        </div>
      )}
    </>
  )
}

export function ChemicalSafetyHubClient({
  view, locations, rooms, registry, products, units, actorId, canManageChemicals,
  canProposeUnitIds, sdsItems, roomSdsItems, sdsProducts, departmentSds, publishableDepartmentCodes,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const { toasts, add } = useToast()
  const [position, setPosition] = useState('')
  const [scopeFilter, setScopeFilter] = useState('')
  const [lifecycleFilter, setLifecycleFilter] = useState<'all' | 'active' | 'retired'>('all')
  const [registryPage, setRegistryPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [exporting, setExporting] = useState(false)
  const [newChemicalHoldingIds, setNewChemicalHoldingIds] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<ModalState | null>(null)
  const [chemicalDetails, setChemicalDetails] = useState<ChemicalDetailsState | null>(null)
  const [sdsEditor, setSdsEditor] = useState<{ sds: ChemicalSdsDTO; row: ChemicalRegistryRow } | null>(null)
  const [sdsBusyHoldingId, setSdsBusyHoldingId] = useState<string | null>(null)
  const [busyProductId, setBusyProductId] = useState<string | null>(null)
  const [busyHoldingId, setBusyHoldingId] = useState<string | null>(null)
  const [holdingDeleteImpact, setHoldingDeleteImpact] = useState<ChemicalHoldingDeleteImpact | null>(null)
  const [bulkSelectionMode, setBulkSelectionMode] = useState(false)
  const [selectedHoldingIds, setSelectedHoldingIds] = useState<Set<string>>(new Set())
  const [bulkHoldingDeleteRows, setBulkHoldingDeleteRows] = useState<ChemicalRegistryRow[] | null>(null)
  const [bulkHoldingDeleteBusy, setBulkHoldingDeleteBusy] = useState(false)
  const [departmentPublicationBusyCode, setDepartmentPublicationBusyCode] = useState<string | null>(null)

  const canPropose = canManageChemicals || canProposeUnitIds.length > 0
  const productById = useMemo(() => new Map(products.map(product => [product.id, product])), [products])
  const departmentProductIds = useMemo(
    () => filterDepartmentChemicalCandidates(
      products,
      registry.map(row => ({ productId: row.productId, storageScope: row.storageScope })),
    ).map(product => product.id),
    [products, registry],
  )
  const canEditChemicalRow = useCallback(
    (row: ChemicalRegistryRow) => canManageChemicals || canProposeUnitIds.includes(row.unitId),
    [canManageChemicals, canProposeUnitIds],
  )
  const selectedUnitId = scopeFilter.startsWith('unit:') ? scopeFilter.slice('unit:'.length) : ''
  const selectedRoomId = scopeFilter.startsWith('room:') ? scopeFilter.slice('room:'.length) : ''
  const selectedDepartment = useMemo(
    () => selectedUnitId
      ? departmentSds.find(group => group.chemicalUnitId === selectedUnitId) ?? null
      : null,
    [departmentSds, selectedUnitId],
  )

  function notify(message: string, ok = true) {
    add(message, ok)
    if (ok) router.refresh()
  }

  async function setDepartmentPublicationStatus(status: 'draft' | 'published') {
    if (!selectedDepartment) return
    const publicationAction = selectedDepartment.publicationAction
    setDepartmentPublicationBusyCode(selectedDepartment.code)
    try {
      const response = await fetch('/api/admin/chemical-safety/registry/department-publication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentCode: selectedDepartment.code, status }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'ดำเนินการเผยแพร่ทั้งงานไม่สำเร็จ')
      notify(
        status === 'draft'
          ? 'ยกเลิกเผยแพร่ทั้งงานแล้ว'
          : publicationAction === 'update'
            ? 'อัปเดตการเผยแพร่ของงานแล้ว'
            : 'เผยแพร่ทั้งงานจากทะเบียนสารเคมีแล้ว',
      )
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'ดำเนินการเผยแพร่ทั้งงานไม่สำเร็จ', false)
    } finally {
      setDepartmentPublicationBusyCode(null)
    }
  }

  function openChemicalDetails(row: ChemicalRegistryRow) {
    setChemicalDetails({ row, product: productById.get(row.productId), tab: 'registry' })
    setSdsEditor(null)
  }

  function closeChemicalDetails() {
    setChemicalDetails(null)
    setSdsEditor(null)
  }

  function changeChemicalDetailsTab(tab: ChemicalDetailsTab) {
    const current = chemicalDetails
    if (!current) return
    if (tab === 'registry') {
      setChemicalDetails({ ...current, tab })
      return
    }
    void openSds(current.row)
  }

  /**
   * เปิดหน้าต่างแก้ไข SDS ของรายการทะเบียนหนึ่ง
   *
   * ไม่มีขั้นตอนส่งทบทวน/อนุมัติ/เชื่อมเผยแพร่แล้ว จึงไม่มีหน้าต่างสรุป workflow คั่นอีก
   * บันทึกหรือแนบไฟล์เสร็จเมื่อไหร่ ฝั่ง API จะทำให้ใช้งานได้และเผยแพร่ให้ทันที
   *
   * สำหรับงานต่างหน่วยที่ใช้สารเดียวกัน จะใช้ SDS ฉบับเดียวกันร่วมกัน
   * แต่ยังไม่ข้ามขอบเขตไปหยิบ SDS ของ room holding มาใช้กับงาน
   */
  async function openSds(row: ChemicalRegistryRow) {
    setChemicalDetails(current => current?.row.holdingId === row.holdingId
      ? { ...current, tab: 'sds' }
      : { row, product: productById.get(row.productId), tab: 'sds' })
    const existing = sdsItems
      .filter(item => (
        item.productId === row.productId
        && item.status !== 'superseded'
        && (
          item.sourceHoldingId === row.holdingId
          || item.linkedHoldingIds.includes(row.holdingId)
        )
      ))
      // A new department holding may still have its empty draft while the
      // product's shared approved SDS already has a file. Open the file-backed
      // document instead of creating/editing another empty copy.
      .sort((a, b) => (
        Number(Boolean(b.fileId)) - Number(Boolean(a.fileId))
        || String(b.updatedAt).localeCompare(String(a.updatedAt))
      ))[0]
    if (existing) {
      setSdsEditor({ sds: existing, row })
      return
    }

    setSdsBusyHoldingId(row.holdingId)
    try {
      const response = await fetch('/api/admin/chemical-safety/sds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdingId: row.holdingId, language: 'th' }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'เปิดแบบฟอร์ม SDS ไม่สำเร็จ')
      const product = productById.get(row.productId)
      const timestamp = new Date().toISOString()
      setSdsEditor({
        row,
        sds: {
          id: String(payload.id), productId: row.productId, sourceHoldingId: row.holdingId,
          linkedHoldingIds: [], workflowOrigin: 'registry_v2',
          fileId: null, sourceUrl: null, fileUrl: null,
          manufacturer: product?.manufacturer ?? null, supplier: product?.supplier ?? null,
          productCode: product?.productCode ?? null, concentration: row.concentration,
          language: 'th', revisionLabel: null, effectiveOn: null, reviewDueOn: null,
          signalWord: null, pictogramCodes: [], hStatements: [], pStatements: [],
          storageInstructions: null, incompatibilities: null, emergencySummary: null,
          status: 'draft', submittedBy: null, submittedAt: null, reviewedBy: null,
          reviewedAt: null, reviewReason: null, createdBy: actorId,
          createdAt: String(payload.createdAt ?? timestamp),
          updatedAt: String(payload.updatedAt ?? timestamp),
          hazards: [],
        },
      })
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'เปิดแบบฟอร์ม SDS ไม่สำเร็จ', false)
    } finally {
      setSdsBusyHoldingId(null)
    }
  }

  // กดตู้บนผังแล้วกระโดดไปทะเบียนที่กรองตู้นั้นไว้ — เปลี่ยน view ผ่าน URL
  // เพื่อให้กดย้อนกลับได้เหมือนการกดแท็บ
  function openCabinet(code: string) {
    const next = resetRegistryFiltersForStorageNavigation(code)
    setSelectedHoldingIds(new Set())
    setPosition(next.position)
    setScopeFilter(next.scopeFilter)
    setLifecycleFilter(next.lifecycleFilter)
    setRegistryPage(next.registryPage)
    setSearch(next.search)
    setDebouncedSearch(next.debouncedSearch)

    // A storage click starts a fresh registry context. Do not preserve stale
    // q/search/unit/room parameters from an older registry URL either.
    const params = new URLSearchParams({ view: 'registry' })
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // ล้างคำค้นแล้วต้องกลับมาเห็นรายการเต็มทันที ไม่ต้องรอ debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), search ? 350 : 0)
    return () => clearTimeout(timer)
  }, [search])

  const visible = useMemo(() => {
    const needle = debouncedSearch.toLocaleLowerCase('th')
    return registry.filter(row => {
      if (position && row.positionCode !== position) return false
      if (selectedUnitId && row.unitId !== selectedUnitId) return false
      if (selectedRoomId && row.roomId !== selectedRoomId) return false
      if (lifecycleFilter !== 'all' && productById.get(row.productId)?.lifecycleStatus !== lifecycleFilter) return false
      if (!needle) return true
      return [row.canonicalName, row.casNumber, ...row.aliases]
        .filter(Boolean).join(' ').toLocaleLowerCase('th').includes(needle)
    })
  }, [registry, position, selectedUnitId, selectedRoomId, lifecycleFilter, debouncedSearch, productById])
  const registryPagination = useMemo(
    () => paginateRegistryItems(visible, registryPage),
    [visible, registryPage],
  )
  const selectablePageRows = useMemo(
    () => registryPagination.items.filter(canEditChemicalRow),
    [canEditChemicalRow, registryPagination.items],
  )
  const selectedHoldingRows = useMemo(
    () => registry.filter(row => selectedHoldingIds.has(row.holdingId) && canEditChemicalRow(row)),
    [canEditChemicalRow, registry, selectedHoldingIds],
  )
  useEffect(() => {
    const availableHoldingIds = new Set(registry.filter(canEditChemicalRow).map(row => row.holdingId))
    setSelectedHoldingIds(previous => {
      const next = new Set([...previous].filter(holdingId => availableHoldingIds.has(holdingId)))
      return next.size === previous.size ? previous : next
    })
  }, [canEditChemicalRow, registry])
  const allSelectablePageRowsSelected = selectablePageRows.length > 0
    && selectablePageRows.every(row => selectedHoldingIds.has(row.holdingId))
  const someSelectablePageRowsSelected = selectablePageRows.some(row => selectedHoldingIds.has(row.holdingId))

  const atPosition = useMemo(() => {
    const map = new Map<string, ChemicalRegistryRow[]>()
    for (const row of registry) {
      if (!row.positionCode) continue
      map.set(row.positionCode, [...(map.get(row.positionCode) ?? []), row])
    }
    return map
  }, [registry])

  const unitCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of registry) counts.set(row.unitId, (counts.get(row.unitId) ?? 0) + 1)
    return counts
  }, [registry])

  const unitOptions = [
    ...units.map(unit => ({
      value: unit.id,
      label: `${unit.nameTh} · ${unitCounts.get(unit.id) ?? 0} รายการ`,
    })),
  ]

  const roomCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of registry) {
      if (row.roomId) counts.set(row.roomId, (counts.get(row.roomId) ?? 0) + 1)
    }
    return counts
  }, [registry])

  const roomOptions = [
    ...rooms.map(room => ({
      value: room.id,
      label: `${room.nameTh} · ${roomCounts.get(room.id) ?? 0} รายการ`,
    })),
  ]

  const workspaceSummary = useMemo(() => ({
    products: new Set(registry.filter(row => row.storageScope === 'room').map(row => row.productId)).size,
    cabinets: locations.length,
    sdsAttention: registry.filter(row => row.storageScope === 'room' && ['missing', 'mismatch', 'review_due'].includes(row.sdsStatus)).length,
  }), [locations.length, registry])

  const registrySummary = useMemo(
    () => summarizeChemicalRegistry(registry),
    [registry],
  )

  const productEntryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of registry) counts.set(row.productId, (counts.get(row.productId) ?? 0) + 1)
    return counts
  }, [registry])

  function toggleNewChemical(holdingId: string) {
    setNewChemicalHoldingIds(previous => {
      const next = new Set(previous)
      if (next.has(holdingId)) next.delete(holdingId)
      else next.add(holdingId)
      return next
    })
  }

  function toggleBulkSelectionMode() {
    if (bulkSelectionMode) {
      setBulkSelectionMode(false)
      setSelectedHoldingIds(new Set())
      return
    }
    setBulkSelectionMode(true)
  }

  function toggleHoldingSelection(holdingId: string) {
    setSelectedHoldingIds(previous => {
      const next = new Set(previous)
      if (next.has(holdingId)) next.delete(holdingId)
      else next.add(holdingId)
      return next
    })
  }

  function toggleSelectablePageRows() {
    setSelectedHoldingIds(previous => {
      const next = new Set(previous)
      if (allSelectablePageRowsSelected) {
        selectablePageRows.forEach(row => next.delete(row.holdingId))
      } else {
        selectablePageRows.forEach(row => next.add(row.holdingId))
      }
      return next
    })
  }

  function openBulkHoldingDelete() {
    if (selectedHoldingRows.length === 0) {
      notify('กรุณาเลือกรายการที่มีสิทธิ์จัดการก่อนลบ', false)
      return
    }
    setBulkHoldingDeleteRows(selectedHoldingRows)
  }

  async function exportRegistry(format: 'pdf' | 'xlsx') {
    if (exporting) return
    setExporting(true)
    try {
      const response = await fetch('/api/admin/chemical-safety/registry/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          filters: {
            ...(debouncedSearch ? { q: debouncedSearch } : {}),
            ...(position ? { positionCode: position } : {}),
            ...(selectedUnitId ? { unitId: selectedUnitId } : {}),
            ...(selectedRoomId ? { roomId: selectedRoomId } : {}),
            ...(lifecycleFilter !== 'all' ? { lifecycle: lifecycleFilter } : {}),
          },
          newChemicalHoldingIds: [...newChemicalHoldingIds],
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || 'ส่งออกทะเบียนสารเคมีไม่สำเร็จ')
      }
      const objectUrl = URL.createObjectURL(await response.blob())
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = `chemical-inventory-${new Date().toISOString().slice(0, 10)}.${format}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'ส่งออกทะเบียนสารเคมีไม่สำเร็จ', false)
    } finally {
      setExporting(false)
    }
  }

  async function toggleLifecycle(row: ChemicalRegistryRow) {
    const product = productById.get(row.productId)
    if (!product) { notify('ไม่พบข้อมูลสาร กรุณารีเฟรชหน้า', false); return }
    const nextStatus = product.lifecycleStatus === 'active' ? 'retired' : 'active'
    const actionLabel = nextStatus === 'retired' ? 'Inactive' : 'Active'
    if (!window.confirm(`ยืนยันตั้งสถานะ ${actionLabel} ให้ "${row.canonicalName}"? การเปลี่ยนแปลงมีผลทันที`)) return

    setBusyProductId(row.productId)
    try {
      const created = await fetch('/api/admin/chemical-safety/change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'product',
          entityId: product.id,
          unitId: row.unitId,
          proposedData: {
            canonicalName: product.canonicalName,
            casNumber: product.casNumber,
            manufacturer: product.manufacturer,
            supplier: product.supplier,
            productCode: product.productCode,
            concentration: product.concentration,
            physicalState: product.physicalState,
            lifecycleStatus: nextStatus,
            // Product lifecycle requests do not accept aliases. Keep the
            // current GHS fields so a status-only change cannot clear them.
            ghsSourceText: product.ghsSourceText,
            ghsPictogramCodes: product.ghsPictogramCodes,
            ghsHazardClasses: product.ghsHazardClasses,
          },
        }),
      })
      const createdPayload = await created.json().catch(() => ({}))
      if (!created.ok) throw new Error(createdPayload.error || 'สร้างคำขอไม่สำเร็จ')

      const submitted = await fetch(`/api/admin/chemical-safety/change-requests/${createdPayload.data.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const submittedPayload = await submitted.json().catch(() => ({}))
      if (!submitted.ok) throw new Error(submittedPayload.error || 'บันทึกไม่สำเร็จ')

      notify(`บันทึกสถานะ ${actionLabel} แล้ว`)
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'ดำเนินการไม่สำเร็จ', false)
    } finally {
      setBusyProductId(null)
    }
  }

  async function deleteHolding(row: ChemicalRegistryRow) {
    if (bulkHoldingDeleteBusy) return
    setBusyHoldingId(row.holdingId)
    try {
      const response = await fetch(`/api/admin/chemical-safety/registry/${row.holdingId}/delete`, {
        method: 'GET',
      })
      const payload = await response.json().catch(() => ({})) as { impact?: ChemicalHoldingDeleteImpact; error?: string }
      if (!response.ok && !payload.impact) throw new Error(payload.error || 'โหลดผลกระทบการลบไม่สำเร็จ')
      if (!payload.impact) throw new Error('ไม่พบผลกระทบการลบ กรุณารีเฟรชหน้า')
      setHoldingDeleteImpact(payload.impact)
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'โหลดผลกระทบการลบไม่สำเร็จ', false)
    } finally {
      setBusyHoldingId(null)
    }
  }

  async function confirmHoldingDelete() {
    const impact = holdingDeleteImpact
    if (!impact || !impact.canDelete || busyHoldingId === impact.holdingId) return

    setBusyHoldingId(impact.holdingId)
    try {
      const response = await fetch(`/api/admin/chemical-safety/registry/${impact.holdingId}/delete`, {
        method: 'DELETE',
      })
      const payload = await response.json().catch(() => ({})) as {
        cleanup?: { ok?: boolean; failedKeys?: string[] }
        impact?: ChemicalHoldingDeleteImpact
        error?: string
      }
      if (!response.ok) {
        if (payload.impact) setHoldingDeleteImpact(payload.impact)
        throw new Error(payload.error || 'ลบรายการไม่สำเร็จ')
      }

      setHoldingDeleteImpact(null)
      setSelectedHoldingIds(previous => {
        if (!previous.has(impact.holdingId)) return previous
        const next = new Set(previous)
        next.delete(impact.holdingId)
        return next
      })
      notify(payload.cleanup?.ok === false
        ? 'ลบรายการและ SDS แล้ว แต่มีไฟล์บางส่วนรอการล้างจากระบบ'
        : 'ลบรายการและ SDS ที่เกี่ยวข้องแล้ว')
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'ลบรายการไม่สำเร็จ', false)
    } finally {
      setBusyHoldingId(null)
    }
  }

  async function confirmBulkHoldingDelete() {
    const rows = bulkHoldingDeleteRows
    if (!rows || rows.length === 0 || bulkHoldingDeleteBusy) return

    setBulkHoldingDeleteBusy(true)
    const deletedIds: string[] = []
    const failed: string[] = []
    let cleanupWarnings = 0

    try {
      // Keep the requests sequential: every request uses the same hard-delete
      // endpoint as the single-row action, and shared SDS rows may overlap.
      for (const row of rows) {
        try {
          const response = await fetch(`/api/admin/chemical-safety/registry/${row.holdingId}/delete`, {
            method: 'DELETE',
          })
          const payload = await response.json().catch(() => ({})) as {
            cleanup?: { ok?: boolean }
            error?: string
          }
          if (!response.ok) throw new Error(payload.error || 'ลบรายการไม่สำเร็จ')
          deletedIds.push(row.holdingId)
          if (payload.cleanup?.ok === false) cleanupWarnings += 1
        } catch (caught) {
          failed.push(`${row.canonicalName}: ${caught instanceof Error ? caught.message : 'ลบรายการไม่สำเร็จ'}`)
        }
      }
    } finally {
      setBulkHoldingDeleteBusy(false)
      setBulkHoldingDeleteRows(null)
      setSelectedHoldingIds(previous => {
        if (deletedIds.length === 0) return previous
        const next = new Set(previous)
        deletedIds.forEach(id => next.delete(id))
        return next
      })
    }

    if (deletedIds.length > 0) router.refresh()

    if (failed.length > 0) {
      const failedSummary = failed.slice(0, 2).join(' · ')
      const more = failed.length > 2 ? ` · และอีก ${failed.length - 2} รายการ` : ''
      add(`ลบสำเร็จ ${deletedIds.length} รายการ แต่ลบไม่สำเร็จ ${failed.length} รายการ: ${failedSummary}${more}`, false)
      return
    }

    add(cleanupWarnings > 0
      ? `ลบ ${deletedIds.length} รายการและ SDS แล้ว แต่มีไฟล์บางส่วนรอการล้างจากระบบ`
      : `ลบ ${deletedIds.length} รายการและ SDS ที่เกี่ยวข้องแล้ว`)
  }

  return (
    <main className="chemical-hub">
      <style>{`
        .chemical-hub{width:100%;min-width:0;margin:0;padding:0}
        .chemical-hub .chemical-hub-tabs{position:relative;max-width:100%;overflow:hidden;margin:0 0 20px;padding:5px;border:1px solid var(--border);border-radius:14px;background:var(--surface-2)}
        .chemical-hub .chemical-hub-tabs .view-tabs{width:fit-content;background:transparent;padding:0;gap:5px}
        .chemical-hub .chemical-hub-tabs .view-tab{flex:0 0 auto;padding:9px 14px;border-radius:10px}
        .chemical-hub .chemical-section-lead{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:0 0 14px}
        .chemical-hub .chemical-section-lead h2{margin:0;color:var(--ink);font-size:18px;letter-spacing:-.015em}
        .chemical-hub .chemical-section-lead p{margin:4px 0 0;color:var(--muted);font-size:13px}
        .chemical-hub .chemical-registry-tools{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:10px;padding:12px;background:var(--card);box-shadow:0 4px 16px rgba(15,23,42,.035)}
        .chemical-hub .chemical-registry-tools .input-wrap{margin:0}
        .chemical-hub .chemical-registry-selection-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--danger) 24%,var(--border));border-radius:10px;background:color-mix(in srgb,var(--danger) 5%,var(--card))}
        .chemical-hub .chemical-registry-selection-toolbar strong{color:var(--danger);font-size:13px}
        .chemical-hub .chemical-registry-selection-toolbar span{color:var(--muted);font-size:12px}
        .chemical-hub .chemical-filter-panel{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;padding:10px 12px;background:var(--card)}
        .chemical-hub .chemical-filter-label{display:flex;align-items:center;gap:6px;margin:0;color:var(--muted);font-size:12px;font-weight:700}
        .chemical-hub .chemical-unit-select{position:relative;display:block;min-width:min(320px,100%);flex:0 1 340px}
        .chemical-hub .chemical-unit-select select{width:100%;min-height:40px;padding:7px 34px 7px 11px;border:1px solid var(--border);border-radius:7px;outline:0;background:var(--bg);color:var(--ink);font:inherit;font-size:12px;font-weight:600;cursor:pointer;appearance:auto}
        .chemical-hub .chemical-unit-select select:hover{border-color:color-mix(in srgb,var(--primary) 45%,var(--border))}
        .chemical-hub .chemical-unit-select select:focus-visible{border-color:var(--primary);outline:3px solid color-mix(in srgb,var(--primary) 22%,transparent)}
        .chemical-hub .chemical-registry-table-scroll{overflow-x:auto;scrollbar-gutter:stable;overscroll-behavior-x:contain}
        .chemical-hub .chemical-registry-actions{display:inline-flex;align-items:center;gap:8px;flex-wrap:nowrap;white-space:nowrap}
        .chemical-hub .chemical-registry-actions>button{touch-action:manipulation}
        .chemical-hub .chemical-registry-actions>button:last-child{margin-left:4px}
        @media(pointer:coarse){.chemical-hub .chemical-registry-actions>button{min-width:44px;min-height:44px}}
        .chemical-hub .chemical-registry-floating-scroll{position:fixed;z-index:900;bottom:max(0px,env(safe-area-inset-bottom));height:18px;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;background:var(--card);border-top:1px solid var(--border);box-shadow:0 -4px 14px rgba(15,23,42,.12)}
        .chemical-hub .chemical-registry-pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:11px 14px;border-top:1px solid var(--border);background:var(--surface-2)}
        .chemical-hub .chemical-registry-pagination-info{color:var(--muted);font-size:12px;font-weight:700;font-variant-numeric:tabular-nums}
        .chemical-hub .chemical-registry-pagination-actions{display:flex;align-items:center;gap:8px}
        .chemical-hub .chemical-registry-pagination-page{min-width:86px;text-align:center;color:var(--ink);font-size:12px;font-weight:800;font-variant-numeric:tabular-nums}
        .chemical-hub .chemical-sds-intro{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:0 0 14px;padding:16px 18px;border:1px solid var(--border);border-radius:16px;background:linear-gradient(135deg,var(--card),var(--surface-2))}
        .chemical-hub .chemical-sds-intro-main{display:flex;align-items:flex-start;gap:11px}
        .chemical-hub .chemical-sds-intro-icon{display:grid;place-items:center;width:34px;height:34px;flex:0 0 auto;border-radius:10px;color:var(--primary);background:var(--primary-soft)}
        .chemical-hub .chemical-sds-intro h2{margin:0;color:var(--ink);font-size:18px;letter-spacing:-.015em}
        .chemical-hub .chemical-sds-intro p{margin:4px 0 0;color:var(--muted);font-size:13px;line-height:1.5}
        .chemical-hub .chemical-sds-intro-note{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid var(--border);border-radius:999px;background:var(--card);color:var(--muted);font-size:12px;font-weight:700}
        .chemical-hub .chemical-storage{display:grid;gap:14px}
        .chemical-hub .chemical-storage-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:18px 20px;border:1px solid color-mix(in srgb,var(--primary) 16%,var(--border));border-radius:16px;background:linear-gradient(135deg,var(--card),color-mix(in srgb,var(--primary) 5%,var(--surface-2)));box-shadow:0 8px 24px rgba(15,23,42,.06)}
        .chemical-hub .chemical-storage-title{display:flex;gap:12px;align-items:flex-start}
        .chemical-hub .chemical-storage-icon{display:grid;place-items:center;width:38px;height:38px;flex:0 0 auto;border-radius:11px;color:var(--primary);background:var(--primary-soft)}
        .chemical-hub .chemical-storage-title h2{margin:0;color:var(--ink);font-size:19px;letter-spacing:-.015em}
        .chemical-hub .chemical-storage-title p{margin:4px 0 0;max-width:660px;color:var(--muted);font-size:13px;line-height:1.55}
        .chemical-hub .chemical-storage-metrics{display:flex;gap:8px;flex-wrap:wrap}
        .chemical-hub .chemical-storage-metric{min-width:82px;padding:7px 10px;border:1px solid color-mix(in srgb,var(--primary) 14%,var(--border));border-radius:10px;background:color-mix(in srgb,var(--card) 92%,var(--primary-soft));box-shadow:0 1px 2px rgba(15,23,42,.03)}
        .chemical-hub .chemical-storage-metric b{display:block;color:var(--ink);font-size:15px;line-height:1.1;font-variant-numeric:tabular-nums}
        .chemical-hub .chemical-storage-metric span{display:block;margin-top:3px;color:var(--muted);font-size:11px;font-weight:600}
        .chemical-hub .chemical-storage-zone{position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--zone-color) 26%,var(--border));border-radius:16px;background:var(--card);box-shadow:0 7px 20px rgba(15,23,42,.055)}
        .chemical-hub .chemical-storage-zone::before{content:'';position:absolute;inset:0 auto 0 0;width:5px;background:var(--zone-color)}
        .chemical-hub .chemical-storage-zone-header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 16px 12px 20px;border-bottom:1px solid color-mix(in srgb,var(--zone-color) 20%,var(--border));background:color-mix(in srgb,var(--zone-color) 11%,var(--card))}
        .chemical-hub .chemical-storage-zone-heading{display:flex;align-items:center;gap:9px}
        .chemical-hub .chemical-storage-zone-code{display:grid;place-items:center;min-width:28px;height:28px;padding:0 7px;border-radius:8px;background:var(--zone-color);color:#fff;font-size:12px;font-weight:800}
        .chemical-hub .chemical-storage-zone-heading h3{margin:0;color:var(--ink);font-size:14px}
        .chemical-hub .chemical-cabinet-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;padding:14px 16px 16px 20px}
        .chemical-hub .chemical-cabinet{display:flex;flex-direction:column;min-height:164px;padding:0;overflow:hidden;border:1px solid color-mix(in srgb,var(--zone-color) 14%,var(--border));border-radius:12px;background:color-mix(in srgb,var(--zone-color) 4%,var(--surface-2));font:inherit;text-align:left;color:var(--ink);cursor:pointer;transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease}
        .chemical-hub .chemical-cabinet:hover{border-color:var(--zone-color);box-shadow:0 9px 20px rgba(15,23,42,.08);transform:translateY(-1px)}
        .chemical-hub .chemical-cabinet:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}
        .chemical-hub .chemical-cabinet-top{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid color-mix(in srgb,var(--zone-color) 14%,var(--border));background:var(--card)}
        .chemical-hub .chemical-cabinet-code{color:var(--ink);font-size:15px;font-weight:800;letter-spacing:.02em}
        .chemical-hub .chemical-cabinet-count{padding:3px 7px;border-radius:999px;background:color-mix(in srgb,var(--zone-color) 12%,var(--card));color:var(--ink);font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}
        .chemical-hub .chemical-cabinet-list{display:grid;gap:5px;align-content:start;flex:1;padding:10px 12px}
        .chemical-hub .chemical-cabinet-item{overflow:hidden;color:var(--ink);font-size:12px;line-height:1.35;text-overflow:ellipsis;white-space:nowrap}
        .chemical-hub .chemical-cabinet-item::before{content:'•';margin-right:6px;color:var(--zone-color);font-weight:800}
        .chemical-hub .chemical-cabinet-empty{color:var(--muted);font-size:12px}
        .chemical-hub .chemical-cabinet-footer{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:auto;padding:9px 12px;border-top:1px solid color-mix(in srgb,var(--zone-color) 14%,var(--border));background:color-mix(in srgb,var(--zone-color) 5%,var(--card));color:var(--muted);font-size:11px;font-weight:700}
        .chemical-hub .chemical-cabinet-warning{display:inline-flex;align-items:center;gap:4px;color:var(--danger)}
        .chemical-hub .chemical-storage-summary{overflow:hidden;border:1px solid var(--border);border-radius:16px;background:var(--card);box-shadow:0 4px 16px rgba(15,23,42,.025)}
        .chemical-hub .chemical-storage-summary-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:15px 18px;border-bottom:1px solid var(--border);background:var(--surface-2)}
        .chemical-hub .chemical-storage-summary-head h3{margin:0;color:var(--ink);font-size:16px;letter-spacing:-.01em}
        .chemical-hub .chemical-storage-summary-head p{margin:4px 0 0;color:var(--muted);font-size:12px;line-height:1.45}
        .chemical-hub .chemical-storage-summary-tag{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border:1px solid var(--border);border-radius:999px;background:var(--card);color:var(--muted);font-size:11px;font-weight:700;white-space:nowrap}
        .chemical-hub .chemical-storage-summary-scroll{overflow-x:auto}
        .chemical-hub .chemical-storage-summary table{width:100%;min-width:620px;border-collapse:collapse}
        .chemical-hub .chemical-storage-summary th,.chemical-hub .chemical-storage-summary td{padding:11px 18px;border-bottom:1px solid var(--border);text-align:left;vertical-align:middle;color:var(--ink);font-size:13px}
        .chemical-hub .chemical-storage-summary th{background:color-mix(in srgb,var(--surface-2) 70%,var(--card));color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.055em;text-transform:uppercase}
        .chemical-hub .chemical-storage-summary tbody tr:last-child td{border-bottom:0}
        .chemical-hub .chemical-storage-summary tbody tr:hover{background:var(--surface-2)}
        .chemical-hub .chemical-storage-summary-group{display:flex;align-items:center;gap:9px;font-weight:600}
        .chemical-hub .chemical-storage-summary-dot{width:8px;height:8px;flex:0 0 auto;border-radius:50%;background:var(--summary-color)}
        .chemical-hub .chemical-storage-summary-codes{display:flex;gap:6px;flex-wrap:wrap}
        .chemical-hub .chemical-storage-summary-code{display:inline-flex;align-items:center;gap:4px;min-height:30px;padding:4px 9px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--ink);font:inherit;font-size:12px;font-weight:800;cursor:pointer;transition:border-color .18s ease,background .18s ease}
        .chemical-hub .chemical-storage-summary-code:hover{border-color:var(--summary-color);background:color-mix(in srgb,var(--summary-color) 8%,var(--card))}
        .chemical-hub .chemical-storage-summary-code:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}
        @media(max-width:720px){.chemical-hub .chemical-hub-tabs .view-tab{flex:0 0 auto}.chemical-hub .chemical-cabinet-grid{grid-template-columns:1fr 1fr;padding:12px}.chemical-hub .chemical-storage-zone-header{padding-left:16px}.chemical-hub .chemical-storage-zone::before{width:3px}.chemical-hub .chemical-storage-summary-head{padding:14px 16px}.chemical-hub .chemical-storage-summary th,.chemical-hub .chemical-storage-summary td{padding:10px 14px}.chemical-hub .chemical-unit-select{flex:1 1 100%;min-width:0}}
        @media(max-width:460px){.chemical-hub .chemical-cabinet-grid{grid-template-columns:1fr}.chemical-hub .chemical-storage-hero{padding:16px}.chemical-hub .chemical-storage-metrics{width:100%}.chemical-hub .chemical-storage-metric{flex:1}}
        @media(prefers-reduced-motion:reduce){.chemical-hub .chemical-cabinet{transition:none}.chemical-hub .chemical-cabinet:hover{transform:none}}
      `}</style>
      <PageHeader
        eyebrow="ความปลอดภัยสารเคมี"
        title="สารเคมีและ SDS"
        subtitle="ข้อมูลนำเข้าแยกจากข้อมูลที่ใช้งานจริง · จำแนกอันตรายตามระบบ GHS · การแก้ไขมีผลทันทีและบันทึกผู้แก้ไขไว้ทุกครั้ง"
        marginBottom={SPACE.md}
      />

      <div className="chemical-hub-tabs">
        <ViewTabs items={CHEMICAL_HUB_VIEWS} value={view} label="มุมมองห้องสารเคมี" />
      </div>

      {view === 'layout' && (
        <StorageLayoutPanel
          locations={locations}
          atPosition={atPosition}
          summary={workspaceSummary}
          onOpenCabinet={openCabinet}
        />
      )}

      {view === 'registry' && (
        <>
          <div className="chemical-section-lead">
            <div>
              <h2>ทะเบียนสารเคมี</h2>
              <p>ค้นหา ตรวจสอบสถานะ SDS และจัดการข้อมูลจากทะเบียนสารเคมี</p>
            </div>
          </div>
          <Card padding={SPACE.sm} style={{ marginBottom: SPACE.md, borderLeft: '1px solid var(--primary)' }}>
            <div
              className="chemical-registry-summary-metrics"
              aria-label="สรุปทะเบียนสารเคมี"
              style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'flex-start', gap: SPACE.xs,
                flexWrap: 'wrap', color: 'var(--muted)', fontSize: FONT.sm, fontWeight: 600,
              }}
            >
              <strong style={{ color: 'var(--ink)', fontSize: FONT.lg, fontVariantNumeric: 'tabular-nums' }}>
                {registrySummary.productCount.toLocaleString()}
              </strong>
              <span>สารเคมีหลัก</span>
              <span aria-hidden="true" style={{ margin: `0 ${SPACE.xs}px`, color: 'var(--border)' }}>·</span>
              <strong style={{ color: 'var(--ink)', fontSize: FONT.lg, fontVariantNumeric: 'tabular-nums' }}>
                {registrySummary.registryEntryCount.toLocaleString()}
              </strong>
              <span>รายการของงาน/คลัง</span>
            </div>
          </Card>
          <Card className="chemical-registry-tools" padding={0}>
            <Input
              icon="search"
              size="lg"
              value={search}
              onChange={(value) => { setSearch(value); setRegistryPage(1); setSelectedHoldingIds(new Set()) }}
              placeholder="ค้นหาชื่อสาร ชื่อพ้อง หรือเลข CAS"
              style={{ flex: '1 1 280px', minWidth: 240 }}
            />
            {canPropose && (
              <Button icon="plus" size="lg" onClick={() => setModal({ mode: 'create' })}>
                เพิ่มสารเคมีใหม่
              </Button>
            )}
            {canPropose && (
              <Button
                icon={bulkSelectionMode ? 'x' : 'check'}
                variant={bulkSelectionMode ? 'secondary' : 'soft'}
                size="lg"
                aria-pressed={bulkSelectionMode}
                onClick={toggleBulkSelectionMode}
              >
                {bulkSelectionMode ? 'ยกเลิกเลือกหลายรายการ' : 'เลือกเพื่อลบหลายรายการ'}
              </Button>
            )}
            <Button icon="download" variant="secondary" size="lg" disabled={exporting} onClick={() => void exportRegistry('xlsx')}>
              {exporting ? 'กำลังสร้าง…' : 'Export Excel'}
            </Button>
            <Button icon="download" variant="secondary" size="lg" disabled={exporting} onClick={() => void exportRegistry('pdf')}>
              {exporting ? 'กำลังสร้าง…' : 'Export PDF'}
            </Button>
          </Card>

          {bulkSelectionMode && (
            <Card className="chemical-registry-selection-toolbar" padding={0} style={{ padding: '10px 12px' }}>
              <Icon name="check" size={15} style={{ color: 'var(--danger)' }} />
              <strong>เลือกแล้ว {selectedHoldingRows.length.toLocaleString()} รายการ</strong>
              <span>เลือกได้เฉพาะรายการที่คุณมีสิทธิ์จัดการ · เลือกได้ข้ามหน้า</span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedHoldingIds(new Set())} disabled={selectedHoldingRows.length === 0}>
                ล้างการเลือก
              </Button>
              <Button variant="danger" size="sm" icon="trash" onClick={openBulkHoldingDelete} disabled={selectedHoldingRows.length === 0 || bulkHoldingDeleteBusy}>
                ลบรายการที่เลือก
              </Button>
            </Card>
          )}

          {selectedDepartment && (
            <Card padding={SPACE.sm} style={{ marginBottom: SPACE.md, borderLeft: '4px solid var(--primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, flexWrap: 'wrap' }}>
                  <Icon name="globe" size={16} style={{ color: 'var(--primary)' }} />
                  <strong>การเผยแพร่ทั้งงาน</strong>
                  <span style={{ color: 'var(--muted)', fontSize: FONT.sm }}>{selectedDepartment.department}</span>
                  <DepartmentPublishBadge status={selectedDepartment.status} />
                </div>
                {publishableDepartmentCodes.includes(selectedDepartment.code) && (
                  selectedDepartment.publicationAction === 'unpublish' ? (
                    <Button
                      variant="danger"
                      icon="lock"
                      disabled={departmentPublicationBusyCode === selectedDepartment.code}
                      onClick={() => void setDepartmentPublicationStatus('draft')}
                    >
                      ยกเลิกเผยแพร่ทั้งงาน
                    </Button>
                  ) : (
                    <Button
                      icon="globe"
                      disabled={departmentPublicationBusyCode === selectedDepartment.code || selectedDepartment.fileCount === 0}
                      title={selectedDepartment.fileCount === 0 ? 'งานนี้ยังไม่มีเอกสาร SDS จากทะเบียนสารเคมีที่พร้อมเผยแพร่' : undefined}
                      onClick={() => void setDepartmentPublicationStatus('published')}
                    >
                      {selectedDepartment.publicationButtonLabel}
                    </Button>
                  )
                )}
              </div>
              <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: FONT.sm }}>
                {selectedDepartment.publicationHelperText ?? 'แก้ไขข้อมูลและแนบ SDS ที่แถวสารเคมีด้านล่าง ส่วนการเผยแพร่ทั้งงานทำจากส่วนนี้'}
              </p>
            </Card>
          )}

          <Card className="chemical-filter-panel" padding={0}>
            <div className="chemical-filter-label"><Icon name="filter" size={13} /> หน่วยงาน</div>
            <label className="chemical-unit-select">
              <select value={scopeFilter} onChange={(event) => { setScopeFilter(event.target.value); setRegistryPage(1); setSelectedHoldingIds(new Set()) }} aria-label="กรองตามหน่วยงาน">
                <option value="">ทุกหน่วยงาน / ห้องสารเคมี ({registry.length} รายการ)</option>
                <optgroup label="หน่วยงาน">
                  {unitOptions.map(option => <option key={option.value} value={`unit:${option.value}`}>{option.label}</option>)}
                </optgroup>
                <optgroup label="ห้องสารเคมี">
                  {roomOptions.map(option => <option key={option.value} value={`room:${option.value}`}>{option.label}</option>)}
                </optgroup>
              </select>
            </label>
            <label className="chemical-unit-select">
              <select value={lifecycleFilter} onChange={(event) => { setLifecycleFilter(event.target.value as typeof lifecycleFilter); setRegistryPage(1); setSelectedHoldingIds(new Set()) }} aria-label="กรองตามสถานะการใช้งาน">
                <option value="all">ทุกสถานะการใช้งาน</option>
                <option value="active">Active</option>
                <option value="retired">Inactive</option>
              </select>
            </label>
          </Card>

          {visible.length === 0 ? (
            <Card padding={0}><EmptyState icon="flask" title="ไม่พบสารเคมีที่ตรงกับเงื่อนไข" hint="ลองล้างคำค้นหรือเลือกหน่วยงานหรือห้องสารเคมีอื่น" /></Card>
          ) : (
            <Card padding={0}>
              <RegistryHorizontalScroll>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1080 }}>
                  <thead>
                    <tr>
                      {bulkSelectionMode && (
                        <th style={{
                          width: 58, padding: '11px 10px', textAlign: 'center', fontSize: FONT.xs, fontWeight: 700,
                          color: 'var(--muted)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                        }}>
                          <input
                            type="checkbox"
                            checked={allSelectablePageRowsSelected}
                            ref={element => {
                              if (element) element.indeterminate = someSelectablePageRowsSelected && !allSelectablePageRowsSelected
                            }}
                            disabled={selectablePageRows.length === 0}
                            onChange={toggleSelectablePageRows}
                            aria-label="เลือกทุกรายการที่ลบได้ในหน้านี้"
                            title="เลือกทุกรายการที่ลบได้ในหน้านี้"
                            style={{ width: 16, height: 16, accentColor: 'var(--danger)', cursor: selectablePageRows.length > 0 ? 'pointer' : 'not-allowed' }}
                          />
                        </th>
                      )}
                      {['สารเคมีหลัก', 'งาน / รายการของงาน/คลัง', 'ปริมาณ', 'สถานะการใช้งาน', 'สถานะ SDS', 'GHS', 'สารเคมีนำเข้าใหม่', ...(canPropose ? ['จัดการ'] : [])].map(heading => (
                        <th key={heading} style={{
                          padding: '11px 14px', textAlign: 'left', fontSize: FONT.xs, fontWeight: 700,
                          letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)',
                          background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                        }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {registryPagination.items.map(row => {
                      const product = productById.get(row.productId)
                      const packageCalculation = calculateHoldingTotalFromFields({
                        packageValue: row.packageValue,
                        packageUnit: row.packageUnit,
                        currentContainerCount: row.currentContainerCount,
                      })
                      const canShowPackageFormula = packageCalculation?.value === row.calculatedTotalValue
                        && packageCalculation.unit === row.calculatedTotalUnit
                      const isInactive = product?.lifecycleStatus === 'retired'
                      const isNewChemical = newChemicalHoldingIds.has(row.holdingId)
                      const busy = busyProductId === row.productId
                      const rowBusy = busy || busyHoldingId === row.holdingId || bulkHoldingDeleteBusy
                      const canEditRow = canManageChemicals || canProposeUnitIds.includes(row.unitId)
                      return (
                        <tr
                          key={row.holdingId}
                          style={{
                            borderBottom: '1px solid var(--border)', transition: 'background .1s',
                            background: isNewChemical ? 'color-mix(in srgb,var(--primary) 10%,var(--card))' : 'transparent',
                            opacity: isInactive ? 0.55 : 1,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = isNewChemical ? 'color-mix(in srgb,var(--primary) 10%,var(--card))' : 'transparent')}
                        >
                          {bulkSelectionMode && (
                            <td style={{ ...cellStyle, width: 58, padding: '12px 10px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={selectedHoldingIds.has(row.holdingId)}
                                disabled={!canEditRow || rowBusy}
                                onChange={() => toggleHoldingSelection(row.holdingId)}
                                aria-label={`เลือกรายการ ${row.canonicalName} สำหรับลบ`}
                                title={canEditRow ? `เลือกรายการ ${row.canonicalName} สำหรับลบ` : 'ไม่มีสิทธิ์จัดการรายการนี้'}
                                style={{ width: 16, height: 16, accentColor: 'var(--danger)', cursor: canEditRow && !rowBusy ? 'pointer' : 'not-allowed' }}
                              />
                            </td>
                          )}
                          <td style={cellStyle}>
                            <b style={{ fontSize: FONT.md }}>{row.canonicalName}</b>
                            {isInactive && <span style={{ marginLeft: 6, fontSize: FONT.xs, fontWeight: 700, color: 'var(--muted)' }}>(Inactive)</span>}
                            {row.inventoryCaptureStatus === 'sds_only' && (
                              <Badge color="amber" size="sm" style={{ marginLeft: 6 }}>{SDS_ONLY_CAPTURE_LABEL}</Badge>
                            )}
                            <div style={{ fontSize: FONT.sm, color: 'var(--muted)' }}>
                              {row.casNumber ? `CAS ${row.casNumber}` : 'ไม่ระบุ CAS'}
                              {row.concentration ? ` · ${row.concentration}` : ''}
                            </div>
                            <div style={{ marginTop: 4, fontSize: FONT.xs, color: 'var(--muted)' }}>
                              สารเคมีหลัก · {productEntryCounts.get(row.productId) ?? 1} รายการของงาน/คลัง
                            </div>
                          </td>
                          <td style={cellStyle}>
                            <div style={{ fontSize: FONT.xs, color: 'var(--muted)' }}>รายการของงาน/คลัง</div>
                            <div style={{ fontSize: FONT.base }}>{row.storageScope === 'room' ? 'ห้องเก็บสารเคมี' : row.unitName}</div>
                            {row.storageScope === 'room' && (
                              <div style={{ marginTop: 4 }}>
                                <PositionChip code={row.positionCode} zoneCode={zoneOf(row.positionCode, locations)} />
                              </div>
                            )}
                          </td>
                          <td style={cellStyle}>
                            {row.calculatedTotalValue != null && row.calculatedTotalUnit ? (
                              <>
                                <strong style={{ display: 'block', fontSize: FONT.base, ...tabularNums }}>
                                  {formatQuantity(row.calculatedTotalValue)} {row.calculatedTotalUnit}
                                </strong>
                                {canShowPackageFormula && row.packageValue != null && row.packageUnit && row.currentContainerCount != null && (
                                  <div style={{ marginTop: 2, fontSize: FONT.xs, color: 'var(--muted)', ...tabularNums }}>
                                    {formatQuantity(row.packageValue)} {row.packageUnit} × {formatQuantity(row.currentContainerCount)} ภาชนะ
                                  </div>
                                )}
                              </>
                            ) : row.reportedTotalRaw ? (
                              <>
                                <strong style={{ display: 'block', fontSize: FONT.base, ...tabularNums }}>
                                  {row.reportedTotalRaw}
                                </strong>
                                <div style={{ marginTop: 2, fontSize: FONT.xs, color: 'var(--muted)' }}>ปริมาณตามแบบสำรวจ</div>
                              </>
                            ) : (
                              <span style={tabularNums}>—</span>
                            )}
                          </td>
                          <td style={cellStyle}>
                            {product ? (
                              <Badge color={isInactive ? 'gray' : 'green'} dot>{isInactive ? 'Inactive' : 'Active'}</Badge>
                            ) : <span style={tabularNums}>—</span>}
                          </td>
                          <td style={cellStyle}>
                            <SdsStateBadge state={row.sdsStatus} />
                            <div style={{ marginTop: 5, fontSize: FONT.xs, color: row.publicationStatus === 'stale' ? 'var(--warning)' : 'var(--muted)' }}>
                              {row.storageScope === 'room'
                                ? roomPublicationLabel(row.publicationStatus)
                                : row.publicationStatus === 'active' ? 'เผยแพร่แล้ว' : row.publicationStatus === 'ready' ? 'พร้อมเผยแพร่' : row.publicationStatus === 'stale' ? 'มีฉบับใหม่ · รอเผยแพร่' : 'ยังไม่มีการเผยแพร่'}
                            </div>
                          </td>
                          <td style={cellStyle}>
                            <GhsRow codes={row.pictogramCodes} hazardClassesTh={row.hazards.map(h => h.className)} size={32} />
                          </td>
                          <td style={cellStyle}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={isNewChemical}
                                onChange={() => toggleNewChemical(row.holdingId)}
                                aria-label={`ทำเครื่องหมาย ${row.canonicalName} เป็นสารเคมีนำเข้าใหม่`}
                                style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                              />
                              <span style={{ fontSize: FONT.sm }}>นำเข้าใหม่</span>
                            </label>
                          </td>
                          {canPropose && (
                            <td style={cellStyle}>
                              <div className="chemical-registry-actions" role="group" aria-label={`การจัดการ ${row.canonicalName}`}>
                                {canEditRow && (
                                  <>
                                    <Button
                                      variant="ghost" size="md" icon="edit" style={registryActionIconButtonStyle}
                                      title={`แก้ไขคลัง ${row.canonicalName}: ตำแหน่งและปริมาณ`}
                                      aria-label={`แก้ไขคลัง ${row.canonicalName}`}
                                      disabled={rowBusy}
                                      onClick={() => setModal({ mode: 'edit-holding', registryRow: row })}
                                    />
                                    <Button
                                      variant="ghost" size="md" icon="doc" style={registryActionIconButtonStyle}
                                      title={`เปิดรายละเอียดสาร ${row.canonicalName}: ข้อมูลทะเบียนและเอกสาร SDS`}
                                      aria-label={`เปิดรายละเอียดสาร ${row.canonicalName}`}
                                      disabled={rowBusy || !product}
                                      onClick={() => product && openChemicalDetails(row)}
                                    />
                                  </>
                                )}
                                {canEditRow && (
                                  <Button
                                    variant="ghost" size="md" icon={isInactive ? 'eye' : 'eyeOff'} style={registryActionIconButtonStyle}
                                    title={`${isInactive ? 'ตั้งสถานะเป็น Active' : 'ตั้งสถานะเป็น Inactive'}: ${row.canonicalName}`}
                                    aria-label={`${isInactive ? 'ตั้งสถานะเป็น Active' : 'ตั้งสถานะเป็น Inactive'} สำหรับ ${row.canonicalName}`}
                                    aria-busy={rowBusy}
                                    disabled={rowBusy || !product}
                                    onClick={() => void toggleLifecycle(row)}
                                  />
                                )}
                                {canEditRow && (
                                  <Button
                                    variant="danger" size="md" icon="x" style={registryActionIconButtonStyle}
                                    title={`ลบรายการ ${row.canonicalName} ออกจากทะเบียน`}
                                    aria-label={`ลบรายการ ${row.canonicalName} ออกจากทะเบียน`}
                                    disabled={rowBusy}
                                    onClick={() => void deleteHolding(row)}
                                  />
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </RegistryHorizontalScroll>
              <nav className="chemical-registry-pagination" aria-label="แบ่งหน้าทะเบียนสารเคมี">
                <span className="chemical-registry-pagination-info">
                  รายการ {registryPagination.from.toLocaleString()}–{registryPagination.to.toLocaleString()} จาก {visible.length.toLocaleString()}
                </span>
                <div className="chemical-registry-pagination-actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={registryPagination.currentPage === 1}
                    onClick={() => setRegistryPage(registryPagination.currentPage - 1)}
                  >ก่อนหน้า</Button>
                  <span className="chemical-registry-pagination-page" aria-current="page">
                    หน้า {registryPagination.currentPage.toLocaleString()} / {registryPagination.pageCount.toLocaleString()}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={registryPagination.currentPage === registryPagination.pageCount}
                    onClick={() => setRegistryPage(registryPagination.currentPage + 1)}
                  >ถัดไป</Button>
                </div>
              </nav>
            </Card>
          )}
        </>
      )}

      {(view === 'sds-chemicals' || view === 'sds-departments') && (
        <SdsManagementClient
          view={view}
          items={roomSdsItems}
          roomRegistry={registry.filter(row => row.storageScope === 'room')}
          departmentRegistry={registry.filter(row => row.storageScope === 'department')}
          products={sdsProducts}
          departments={departmentSds}
        />
      )}

      {modal && (
        <RegistryChangeModal
          mode={modal.mode}
          locations={locations}
          units={units}
          products={products}
          departmentProductIds={departmentProductIds}
          product={modal.product}
          registryRow={modal.registryRow}
          onClose={() => setModal(null)}
          onSaved={notify}
        />
      )}

      {chemicalDetails && (
        <ChemicalDetailsModal
          activeTab={chemicalDetails.tab}
          row={chemicalDetails.row}
          product={chemicalDetails.product}
          locations={locations}
          units={units}
          products={products}
          sds={sdsEditor?.row.holdingId === chemicalDetails.row.holdingId ? sdsEditor.sds : null}
          sdsLoading={sdsBusyHoldingId === chemicalDetails.row.holdingId}
          onTabChange={changeChemicalDetailsTab}
          onClose={closeChemicalDetails}
          onSaved={notify}
        />
      )}

      {holdingDeleteImpact && (
        <HoldingDeleteImpactDialog
          impact={holdingDeleteImpact}
          busy={busyHoldingId === holdingDeleteImpact.holdingId}
          onCancel={() => setHoldingDeleteImpact(null)}
          onConfirm={() => void confirmHoldingDelete()}
        />
      )}

      {bulkHoldingDeleteRows && (
        <BulkHoldingDeleteImpactDialog
          rows={bulkHoldingDeleteRows}
          busy={bulkHoldingDeleteBusy}
          onCancel={() => { if (!bulkHoldingDeleteBusy) setBulkHoldingDeleteRows(null) }}
          onConfirm={() => void confirmBulkHoldingDelete()}
        />
      )}

      <div style={{ position: 'fixed', right: 16, bottom: 16, display: 'grid', gap: 8, zIndex: 1100 }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            role="status"
            style={{
              padding: '10px 14px', borderRadius: 10, fontSize: FONT.md, fontWeight: 600,
              color: '#fff', background: toast.ok ? 'var(--success)' : 'var(--danger)',
              boxShadow: '0 10px 30px rgba(0,0,0,.2)', maxWidth: 360,
            }}
          >
            {toast.msg}
          </div>
        ))}
      </div>
    </main>
  )
}

const cellStyle = {
  padding: '12px 14px',
  textAlign: 'left' as const,
  verticalAlign: 'top' as const,
  fontSize: FONT.base,
  color: 'var(--ink)',
}

const registryActionIconButtonStyle: CSSProperties = {
  width: 40,
  minWidth: 40,
  height: 40,
  padding: 0,
  flex: '0 0 40px',
}

function StorageLayoutPanel({
  locations,
  atPosition,
  summary,
  onOpenCabinet,
}: {
  locations: ChemicalStorageLocationDTO[]
  atPosition: Map<string, ChemicalRegistryRow[]>
  summary: { products: number; cabinets: number; sdsAttention: number }
  onOpenCabinet: (code: string) => void
}) {
  return (
    <section className="chemical-storage" aria-labelledby="chemical-storage-heading">
      <div className="chemical-storage-hero">
        <div className="chemical-storage-title">
          <span className="chemical-storage-icon" aria-hidden="true"><Icon name="building" size={20} /></span>
          <div>
            <h2 id="chemical-storage-heading">ผังการจัดเก็บ</h2>
            <p>ดูตู้จัดเก็บตามโซน เลือกตู้เพื่อเปิดทะเบียนที่กรองตำแหน่งนั้นทันที และสังเกตรายการที่ต้องตรวจสอบจากสัญลักษณ์แจ้งเตือน</p>
          </div>
        </div>
        <div className="chemical-storage-metrics" aria-label="สรุปผังการจัดเก็บ">
          <div className="chemical-storage-metric"><b>{summary.cabinets}</b><span>ตู้จัดเก็บ</span></div>
          <div className="chemical-storage-metric"><b>{summary.products}</b><span>สารในทะเบียน</span></div>
          <div className="chemical-storage-metric"><b>{summary.sdsAttention}</b><span>ต้องดู SDS</span></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: SPACE.sm }}>
        <Stat label="สารในทะเบียน" value={summary.products} icon="flask" color="blue" />
        <Stat label="ตู้จัดเก็บ" value={summary.cabinets} icon="building" color="purple" />
        <Stat label="ต้องตรวจสอบ SDS" value={summary.sdsAttention} icon="doc" color={summary.sdsAttention > 0 ? 'amber' : 'green'} />
      </div>

      {ZONE_META.map(zone => {
        const zoneLocations = locations.filter(location => location.zoneCode === zone.code)
        if (zoneLocations.length === 0) return null
        return (
          <section
            key={zone.code}
            className="chemical-storage-zone"
            style={{ '--zone-color': zone.color } as CSSProperties}
            aria-labelledby={`chemical-storage-zone-${zone.code}`}
          >
            <header className="chemical-storage-zone-header">
              <div className="chemical-storage-zone-heading">
                <span className="chemical-storage-zone-code" aria-hidden="true">{zone.code}</span>
                <h3 id={`chemical-storage-zone-${zone.code}`}>{zone.titleTh}</h3>
              </div>
            </header>
            <div className="chemical-cabinet-grid">
              {zoneLocations.map(location => {
                const rows = atPosition.get(location.code) ?? []
                const warningCount = rows.filter(row => ['missing', 'mismatch', 'review_due'].includes(row.sdsStatus)).length
                const shownRows = rows.slice(0, 3)
                return (
                  <button
                    key={location.id}
                    type="button"
                    className="chemical-cabinet"
                    style={{ '--zone-color': zone.color } as CSSProperties}
                    onClick={() => onOpenCabinet(location.code)}
                    aria-label={`เปิดทะเบียนสารเคมีในตู้ ${location.code}`}
                  >
                    <span className="chemical-cabinet-top">
                      <span className="chemical-cabinet-code">{location.code}</span>
                      <span className="chemical-cabinet-count">{rows.length} รายการ</span>
                    </span>
                    <span className="chemical-cabinet-list">
                      {shownRows.length === 0 ? (
                        <span className="chemical-cabinet-empty">ยังไม่มีรายการในทะเบียน</span>
                      ) : (
                        shownRows.map(row => <span className="chemical-cabinet-item" key={row.holdingId}>{row.canonicalName}</span>)
                      )}
                      {rows.length > shownRows.length && <span className="chemical-cabinet-empty">และอีก {rows.length - shownRows.length} รายการ</span>}
                    </span>
                    <span className="chemical-cabinet-footer">
                      {warningCount > 0 ? (
                        <span className="chemical-cabinet-warning"><Icon name="alert" size={13} /> ต้องตรวจ {warningCount}</span>
                      ) : (
                        <span>พร้อมตรวจสอบ</span>
                      )}
                      <Icon name="arrowRight" size={14} />
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}

      <section className="chemical-storage-summary" aria-labelledby="chemical-storage-summary-heading">
        <header className="chemical-storage-summary-head">
          <div>
            <h3 id="chemical-storage-summary-heading">สรุปกลุ่มสารเคมีตามประเภท</h3>
            <p>ตำแหน่งจัดเก็บตามผังมาตรฐาน — เลือกรหัสตู้เพื่อเปิดทะเบียนในตำแหน่งนั้น</p>
          </div>
          <span className="chemical-storage-summary-tag"><Icon name="clipboard" size={14} /> {CHEMICAL_GROUP_SUMMARY.length} กลุ่มสาร</span>
        </header>
        <div className="chemical-storage-summary-scroll">
          <table>
            <thead>
              <tr><th scope="col">กลุ่มสารเคมี</th><th scope="col">หมายเลขตู้</th></tr>
            </thead>
            <tbody>
              {CHEMICAL_GROUP_SUMMARY.map(group => {
                const firstLocation = locations.find(location => location.code === group.locationCodes[0])
                const color = ZONE_META.find(zone => zone.code === firstLocation?.zoneCode)?.color ?? 'var(--primary)'
                return (
                  <tr key={group.groupTh}>
                    <td>
                      <span className="chemical-storage-summary-group" style={{ '--summary-color': color } as CSSProperties}>
                        <span className="chemical-storage-summary-dot" aria-hidden="true" />
                        {group.groupTh}
                      </span>
                    </td>
                    <td>
                      <span className="chemical-storage-summary-codes">
                        {group.locationCodes.map(code => (
                          <button
                            key={code}
                            type="button"
                            className="chemical-storage-summary-code"
                            style={{ '--summary-color': ZONE_META.find(zone => zone.code === locations.find(location => location.code === code)?.zoneCode)?.color ?? 'var(--primary)' } as CSSProperties}
                            onClick={() => onOpenCabinet(code)}
                            aria-label={`เปิดทะเบียนสารเคมีในตู้ ${code}`}
                          >
                            {code}<Icon name="arrowRight" size={12} />
                          </button>
                        ))}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

function zoneOf(positionCode: string | null, locations: ChemicalStorageLocationDTO[]): string | null {
  if (!positionCode) return null
  return locations.find(location => location.code === positionCode)?.zoneCode ?? null
}
