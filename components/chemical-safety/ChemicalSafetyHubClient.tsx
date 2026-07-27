'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilterChips, type FilterChipItem } from '@/components/ui/FilterChips'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { ViewTabs } from '@/components/ui/ViewTabs'
import { CHEMICAL_HUB_VIEWS, type ChemicalHubView } from '@/lib/navigation'
import type {
  ChemicalChangeRequestListItemDTO,
  ChemicalProductDTO,
  ChemicalRegistryRow,
  ChemicalStorageLocationDTO,
  ChemicalUnitDTO,
} from '@/lib/chemical-safety/types'
import { ChangeRequestPanel } from './ChangeRequestPanel'
import { RegistryChangeModal, type RegistryChangeMode } from './RegistryChangeModal'
import { FONT, SPACE, ZONE_META, tabularNums } from './shared/tokens'
import {
  GhsRow,
  PositionChip,
  QuantityConflictNote,
  SdsStateBadge,
  ZoneCabinetCard,
} from './shared/ui'

interface Props {
  view: ChemicalHubView
  locations: ChemicalStorageLocationDTO[]
  registry: ChemicalRegistryRow[]
  products: ChemicalProductDTO[]
  changeRequests: ChemicalChangeRequestListItemDTO[]
  units: ChemicalUnitDTO[]
  actorId: string
  /** สิทธิ์จริงตอนนี้คือ Admin เท่านั้น (chemicalAccessDecision ไม่ดู chemical_role_scopes เลย) */
  isAdmin: boolean
  canProposeUnitIds: string[]
  canReviewUnitIds: string[]
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

export function ChemicalSafetyHubClient({
  view, locations, registry, products, changeRequests, units, actorId, isAdmin,
  canProposeUnitIds, canReviewUnitIds,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toasts, add } = useToast()
  const [position, setPosition] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [exporting, setExporting] = useState(false)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [busyProductId, setBusyProductId] = useState<string | null>(null)

  const canPropose = isAdmin || canProposeUnitIds.length > 0
  const canReview = isAdmin || canReviewUnitIds.length > 0
  const productById = useMemo(() => new Map(products.map(product => [product.id, product])), [products])

  function notify(message: string, ok = true) {
    add(message, ok)
    if (ok) router.refresh()
  }

  // กดตู้บนผังแล้วกระโดดไปทะเบียนที่กรองตู้นั้นไว้ — เปลี่ยน view ผ่าน URL
  // เพื่อให้กดย้อนกลับได้เหมือนการกดแท็บ
  function openCabinet(code: string) {
    setPosition(code)
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', 'registry')
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
      if (!needle) return true
      return [row.canonicalName, row.casNumber, ...row.aliases]
        .filter(Boolean).join(' ').toLocaleLowerCase('th').includes(needle)
    })
  }, [registry, position, debouncedSearch])

  const atPosition = useMemo(() => {
    const map = new Map<string, ChemicalRegistryRow[]>()
    for (const row of registry) {
      if (!row.positionCode) continue
      map.set(row.positionCode, [...(map.get(row.positionCode) ?? []), row])
    }
    return map
  }, [registry])

  const positionChips: FilterChipItem<string>[] = [
    { value: '', label: 'ทุกตำแหน่ง', count: registry.length },
    ...locations.map(location => ({
      value: location.code,
      label: location.code,
      count: atPosition.get(location.code)?.length ?? 0,
      color: ZONE_META.find(zone => zone.code === location.zoneCode)?.color,
    })),
  ]

  function exportPdf() {
    setExporting(true)
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('q', debouncedSearch)
    if (position) params.set('positionCode', position)
    window.location.href = `/api/admin/chemical-safety/registry/export?${params}`
    setTimeout(() => setExporting(false), 1200)
  }

  async function toggleLifecycle(row: ChemicalRegistryRow) {
    const product = productById.get(row.productId)
    if (!product) { notify('ไม่พบข้อมูลสาร กรุณารีเฟรชหน้า', false); return }
    const nextStatus = product.lifecycleStatus === 'active' ? 'retired' : 'active'
    const actionLabel = nextStatus === 'retired' ? 'เลิกใช้งาน' : 'เปิดใช้งานอีกครั้ง'
    if (!window.confirm(`ยืนยัน${actionLabel} "${row.canonicalName}"? คำขอจะถูกส่งให้ผู้ทบทวนอนุมัติก่อนมีผลจริง`)) return

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
            aliases: row.aliases,
            casNumber: product.casNumber,
            manufacturer: product.manufacturer,
            supplier: product.supplier,
            productCode: product.productCode,
            concentration: product.concentration,
            physicalState: product.physicalState,
            lifecycleStatus: nextStatus,
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
      if (!submitted.ok) throw new Error(submittedPayload.error || 'ส่งทบทวนไม่สำเร็จ')

      notify(`ส่งคำขอ${actionLabel}เข้าสู่การทบทวนแล้ว`)
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'ดำเนินการไม่สำเร็จ', false)
    } finally {
      setBusyProductId(null)
    }
  }

  return (
    <main style={{ padding: SPACE.lg, maxWidth: 1600, margin: '0 auto' }}>
      <PageHeader
        eyebrow="ความปลอดภัยสารเคมี"
        title="ห้องเก็บสารเคมีและทะเบียน SDS"
        subtitle="ข้อมูลนำเข้าแยกจากข้อมูลที่อนุมัติ · จำแนกอันตรายตามระบบ GHS · ผู้บันทึกและผู้ทบทวนต้องเป็นคนละคน"
        marginBottom={SPACE.md}
      />

      <div style={{ marginBottom: SPACE.md }}>
        <ViewTabs items={CHEMICAL_HUB_VIEWS} value={view} label="มุมมองห้องสารเคมี" />
      </div>

      {view === 'layout' && (
        <div style={{ display: 'grid', gap: SPACE.md }}>
          {ZONE_META.map(zone => {
            const zoneLocations = locations.filter(location => location.zoneCode === zone.code)
            if (zoneLocations.length === 0) return null
            return (
              <section key={zone.code}>
                <h2 style={{ fontSize: FONT.lg, fontWeight: 800, margin: `0 0 ${SPACE.xs}px`, color: 'var(--ink)' }}>
                  <span aria-hidden="true" style={{
                    display: 'inline-block', width: 10, height: 10, borderRadius: 3,
                    background: zone.color, marginRight: 8,
                  }} />
                  {zone.titleTh}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: SPACE.sm }}>
                  {zoneLocations.map(location => (
                    <ZoneCabinetCard
                      key={location.id}
                      code={location.code}
                      zoneCode={location.zoneCode}
                      onSelect={() => openCabinet(location.code)}
                      chemicals={(atPosition.get(location.code) ?? []).map(row => ({
                        key: `${row.productId}-${row.unitId}`,
                        name: row.canonicalName,
                        note: row.quantityConflict
                          ? <> <Icon name="alert" size={11} style={{ color: 'var(--danger)' }} /></>
                          : undefined,
                      }))}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {view === 'registry' && (
        <>
          {canReview && (
            <ChangeRequestPanel
              items={changeRequests}
              actorId={actorId}
              canPropose={canPropose}
              canReview={canReview}
              onDone={notify}
            />
          )}

          <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap', alignItems: 'center', marginBottom: SPACE.sm }}>
            <Input
              icon="search"
              size="lg"
              value={search}
              onChange={setSearch}
              placeholder="ค้นหาชื่อสาร ชื่อพ้อง หรือเลข CAS"
              style={{ flex: '1 1 280px', minWidth: 240 }}
            />
            {canPropose && (
              <Button icon="plus" size="lg" onClick={() => setModal({ mode: 'create' })}>
                เพิ่มสารเคมีใหม่
              </Button>
            )}
            <Button icon="download" variant="secondary" size="lg" disabled={exporting} onClick={exportPdf}>
              {exporting ? 'กำลังสร้าง…' : 'Export PDF'}
            </Button>
          </div>

          <div style={{ marginBottom: SPACE.sm }}>
            <FilterChips items={positionChips} value={position} onChange={setPosition} label="กรองตามตำแหน่งจัดเก็บ" compact />
          </div>

          {visible.length === 0 ? (
            <Card padding={0}><EmptyState icon="flask" title="ไม่พบสารเคมีที่ตรงกับเงื่อนไข" hint="ลองล้างคำค้นหรือเลือกตำแหน่งอื่น" /></Card>
          ) : (
            <Card padding={0}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                  <thead>
                    <tr>
                      {['สารเคมี', 'หน่วยงาน / ตำแหน่ง', 'ปริมาณ', 'สถานะ SDS', 'GHS', ...(canPropose ? ['จัดการ'] : [])].map(heading => (
                        <th key={heading} style={{
                          padding: '11px 14px', textAlign: 'left', fontSize: FONT.xs, fontWeight: 700,
                          letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)',
                          background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                        }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(row => {
                      const product = productById.get(row.productId)
                      const isRetired = product?.lifecycleStatus === 'retired'
                      const busy = busyProductId === row.productId
                      return (
                        <tr
                          key={`${row.productId}-${row.unitId}-${row.positionCode}`}
                          style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s', opacity: isRetired ? 0.55 : 1 }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={cellStyle}>
                            <b style={{ fontSize: FONT.md }}>{row.canonicalName}</b>
                            {isRetired && <span style={{ marginLeft: 6, fontSize: FONT.xs, fontWeight: 700, color: 'var(--muted)' }}>(เลิกใช้งาน)</span>}
                            <div style={{ fontSize: FONT.sm, color: 'var(--muted)' }}>
                              {row.casNumber ? `CAS ${row.casNumber}` : 'ไม่ระบุ CAS'}
                              {row.concentration ? ` · ${row.concentration}` : ''}
                            </div>
                          </td>
                          <td style={cellStyle}>
                            <div style={{ fontSize: FONT.base }}>{row.unitName}</div>
                            <div style={{ marginTop: 4 }}>
                              <PositionChip code={row.positionCode} zoneCode={zoneOf(row.positionCode, locations)} />
                            </div>
                          </td>
                          <td style={cellStyle}>
                            <span style={tabularNums}>{row.reportedTotalRaw || '—'}</span>
                            {row.calculatedTotalValue != null && (
                              <div style={{ fontSize: FONT.sm, color: 'var(--muted)', ...tabularNums }}>
                                คำนวณได้ {row.calculatedTotalValue} {row.calculatedTotalUnit}
                              </div>
                            )}
                            {row.quantityConflict && <div style={{ marginTop: 4 }}><QuantityConflictNote compact /></div>}
                          </td>
                          <td style={cellStyle}><SdsStateBadge state={row.sdsStatus} /></td>
                          <td style={cellStyle}>
                            <GhsRow codes={row.pictogramCodes} hazardClassesTh={row.hazards.map(h => h.className)} size={32} />
                          </td>
                          {canPropose && (
                            <td style={cellStyle}>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                <Button
                                  variant="ghost" size="sm" icon="edit" title="แก้ไขคลัง (ตำแหน่ง/ปริมาณ)"
                                  onClick={() => setModal({ mode: 'edit-holding', registryRow: row })}
                                />
                                <Button
                                  variant="ghost" size="sm" icon="doc" title="แก้ไขข้อมูลสาร"
                                  disabled={!product}
                                  onClick={() => product && setModal({ mode: 'edit-product', product, registryRow: row })}
                                />
                                <Button
                                  variant="ghost" size="sm" icon={isRetired ? 'check' : 'trash'}
                                  title={isRetired ? 'เปิดใช้งานอีกครั้ง' : 'เลิกใช้งาน'}
                                  disabled={busy || !product}
                                  onClick={() => void toggleLifecycle(row)}
                                />
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {modal && (
        <RegistryChangeModal
          mode={modal.mode}
          locations={locations}
          units={units}
          product={modal.product}
          registryRow={modal.registryRow}
          onClose={() => setModal(null)}
          onSaved={notify}
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

function zoneOf(positionCode: string | null, locations: ChemicalStorageLocationDTO[]): string | null {
  if (!positionCode) return null
  return locations.find(location => location.code === positionCode)?.zoneCode ?? null
}
