'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Stat } from '@/components/ui/Stat'
import type { ChemicalSdsView } from '@/lib/navigation'
import type { DepartmentSdsGroupDTO } from '@/lib/chemical-safety/department-repository'
import type {
  ChemicalRegistryRow,
  ChemicalSdsDTO,
  GhsPictogramCode,
} from '@/lib/chemical-safety/types'
import { currentSdsItemsForHolding, summarizeRoomSds } from '@/lib/chemical-safety/sds-room-summary'
import { SdsPdfViewerModal } from './SdsPdfViewerModal'
import { FONT, SDS_ONLY_CAPTURE_LABEL, SPACE, tabularNums } from './shared/tokens'
import { DepartmentPublishBadge, GhsRow, SdsStateBadge, SdsStatusBadge } from './shared/ui'

export interface SdsProductInfo {
  productId: string
  name: string
  pictogramCodes: GhsPictogramCode[]
  hazardClassesTh: string[]
}

function sdsLanguageLabel(language: string | null) {
  const normalized = language?.trim().toLowerCase()
  if (!normalized) return 'ไม่ระบุภาษา'
  if (normalized === 'th' || normalized === 'thai') return 'ภาษาไทย'
  if (normalized === 'en' || normalized === 'english') return 'ภาษาอังกฤษ'
  return normalized
}

interface Props {
  view: ChemicalSdsView
  items: ChemicalSdsDTO[]
  roomRegistry: ChemicalRegistryRow[]
  departmentRegistry: ChemicalRegistryRow[]
  products: SdsProductInfo[]
  departments: DepartmentSdsGroupDTO[]
}

export function SdsManagementClient({
  view, items, products, departments, roomRegistry, departmentRegistry,
}: Props) {
  return (
    <>
      {view === 'sds-chemicals' ? (
        <ChemicalSdsPanel
          items={items}
          roomRegistry={roomRegistry}
          products={products}
        />
      ) : (
        <DepartmentSdsPanel
          groups={departments}
          registry={departmentRegistry}
        />
      )}
    </>
  )
}

// ── SDS ของสารเคมีในห้องเก็บสารเคมี ─────────────────────────────────────────

function SdsPanelIntro({
  icon,
  title,
  description,
  note,
}: {
  icon: string
  title: string
  description: string
  note: string
}) {
  return (
    <section className="chemical-sds-intro" aria-label={title}>
      <div className="chemical-sds-intro-main">
        <span className="chemical-sds-intro-icon" aria-hidden="true"><Icon name={icon} size={18} /></span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <span className="chemical-sds-intro-note"><Icon name="shieldCheck" size={14} /> {note}</span>
    </section>
  )
}

type ChemicalSdsFilter = 'all' | 'with-sds' | 'missing'

function ChemicalSdsPanel({
  items, roomRegistry, products,
}: {
  items: ChemicalSdsDTO[]
  roomRegistry: ChemicalRegistryRow[]
  products: SdsProductInfo[]
}) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter, setFilter] = useState<ChemicalSdsFilter>('all')
  const [openHoldingId, setOpenHoldingId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), search ? 350 : 0)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setOpenHoldingId(null)
  }, [debouncedSearch, filter])

  const productById = useMemo(
    () => new Map(products.map(product => [product.productId, product])),
    [products],
  )

  const summary = useMemo(() => summarizeRoomSds(roomRegistry, items), [roomRegistry, items])

  const rows = useMemo(() => {
    const needle = debouncedSearch.toLocaleLowerCase('th')
    return roomRegistry.map(registryRow => {
      const versions = currentSdsItemsForHolding(items, registryRow.holdingId)
      return { registryRow, versions }
    }).filter(({ registryRow, versions }) => {
      const hasCurrentVersion = versions.length > 0
      const matchesStatus = filter === 'all'
        || (filter === 'with-sds' && hasCurrentVersion)
        || (filter === 'missing' && !hasCurrentVersion)
      if (!matchesStatus) return false
      if (!needle) return true
      const versionText = versions.map(item => {
        const product = productById.get(item.productId)
        return [product?.name, item.manufacturer, item.supplier, item.revisionLabel]
          .filter(Boolean).join(' ')
      }).join(' ')
      return [registryRow.canonicalName, registryRow.casNumber, registryRow.unitName, registryRow.positionCode, versionText]
        .filter(Boolean).join(' ').toLocaleLowerCase('th').includes(needle)
    })
  }, [items, roomRegistry, debouncedSearch, productById, filter])

  return (
    <>
      <SdsPanelIntro
        icon="doc"
        title="SDS ห้องสารเคมี"
        description="แสดงสารจากทะเบียนห้องสารเคมี และเปิดดูเอกสาร SDS ของแต่ละรายการได้เมื่อจำเป็น"
        note="ดูได้อย่างเดียว · แก้ไขที่ทะเบียนสารเคมี"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: SPACE.sm, marginBottom: SPACE.md }}>
        <Stat label="รายการในทะเบียนห้อง" value={summary.holdingCount} icon="flask" color="blue" />
        <Stat label="มี SDS แล้ว" value={summary.linkedHoldingCount} icon="link" color="green" />
        <Stat label="ยังไม่มี SDS" value={summary.missingHoldingCount} icon="inbox" color="amber" />
        <Stat label="ฉบับ SDS" value={summary.versionCount} icon="doc" color="purple" />
      </div>

      <Card padding={SPACE.sm} style={{ marginBottom: SPACE.md, background: 'var(--surface-2)' }}>
        <div style={{ display: 'flex', gap: SPACE.xs, alignItems: 'flex-start', fontSize: FONT.md }}>
          <Icon name="info" size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span>
            <strong>ตัวเลขในหน้านี้:</strong> รายการในทะเบียน = จำนวนสารที่เก็บอยู่ในห้อง · ฉบับ SDS = จำนวนเอกสาร SDS ที่แสดงอยู่
            จึงอาจไม่เท่ากันเมื่อสารหนึ่งรายการมี SDS มากกว่าหนึ่งฉบับ
          </span>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: SPACE.sm }}>
        <label style={{ display: 'grid', gap: 4, flex: '1 1 300px', minWidth: 240, fontSize: FONT.xs, color: 'var(--muted)', fontWeight: 700 }} htmlFor="chemical-sds-search">
          ค้นหาในทะเบียนห้องสารเคมี
          <Input
            id="chemical-sds-search"
            icon="search"
            size="md"
            value={search}
            onChange={setSearch}
            placeholder="ค้นหาชื่อสาร CAS หน่วยงาน ตำแหน่ง หรือผู้ผลิต"
            style={{ maxWidth: 520 }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, minWidth: 180, fontSize: FONT.xs, color: 'var(--muted)', fontWeight: 700 }} htmlFor="chemical-sds-filter">
          กรองสถานะ SDS
          <select
            id="chemical-sds-filter"
            value={filter}
            onChange={event => setFilter(event.target.value as ChemicalSdsFilter)}
            style={{ height: 38, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)', font: 'inherit', fontSize: 13 }}
          >
            <option value="all">ทั้งหมด ({summary.holdingCount})</option>
            <option value="with-sds">มี SDS ({summary.linkedHoldingCount})</option>
            <option value="missing">ยังไม่มี SDS ({summary.missingHoldingCount})</option>
          </select>
        </label>
        <span style={{ paddingBottom: 9, fontSize: FONT.sm, color: 'var(--muted)', ...tabularNums }}>
          แสดง {rows.length} จาก {summary.holdingCount} รายการ
        </span>
      </div>
      {rows.length === 0 ? (
        <Card padding={0}><EmptyState icon="flask" title="ไม่พบสารในทะเบียนห้องสารเคมีที่ตรงกับเงื่อนไข" /></Card>
      ) : (
        <Card padding={0}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.sm, flexWrap: 'wrap', alignItems: 'flex-start', padding: SPACE.md, borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div>
              <strong style={{ fontSize: FONT.base, color: 'var(--ink)' }}>รายการจากทะเบียนห้องสารเคมี</strong>
              <p style={{ margin: '3px 0 0', fontSize: FONT.sm, color: 'var(--muted)' }}>เลือก “ดูรายละเอียด” เพื่อดูข้อมูล GHS และเอกสาร SDS ของรายการนั้น</p>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: FONT.sm, color: 'var(--muted)', ...tabularNums }}>
              <Icon name="shieldCheck" size={14} style={{ color: 'var(--primary)' }} /> ดูได้อย่างเดียว
            </span>
          </div>

          {rows.map(({ registryRow, versions }, index) => {
            const open = openHoldingId === registryRow.holdingId
            return (
              <div key={registryRow.holdingId} style={{ borderBottom: index === rows.length - 1 ? undefined : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.sm, alignItems: 'center', flexWrap: 'wrap', padding: SPACE.md }}>
                  <div style={{ minWidth: 0, flex: '1 1 300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: FONT.lg, color: 'var(--ink)' }}>{registryRow.canonicalName}</strong>
                      {registryRow.inventoryCaptureStatus === 'sds_only' && <Badge color="amber" size="sm">{SDS_ONLY_CAPTURE_LABEL}</Badge>}
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: FONT.base, color: 'var(--muted)' }}>
                      {registryRow.unitName} · ตำแหน่ง {registryRow.positionCode || 'ไม่ระบุ'} · {registryRow.casNumber ? `CAS ${registryRow.casNumber}` : 'ไม่ระบุ CAS'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, flexWrap: 'wrap' }}>
                    <SdsStateBadge state={registryRow.sdsStatus} />
                    <span style={{ fontSize: FONT.sm, color: 'var(--muted)', ...tabularNums }}>{versions.length} ฉบับ</span>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={open ? 'chevDown' : 'chevRight'}
                      onClick={() => setOpenHoldingId(open ? null : registryRow.holdingId)}
                      title={open ? `ซ่อนรายละเอียด ${registryRow.canonicalName}` : `ดูรายละเอียด ${registryRow.canonicalName}`}
                    >
                      {open ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
                    </Button>
                  </div>
                </div>

                {open && (
                  <div style={{ padding: `0 ${SPACE.md}px ${SPACE.md}px`, background: 'var(--surface-2)' }}>
                    {versions.length === 0 ? (
                      <div style={{ padding: SPACE.sm, borderRadius: 10, background: 'var(--card)', color: 'var(--muted)', fontSize: FONT.sm }}>
                        <strong style={{ color: 'var(--ink)' }}>ยังไม่มีเอกสาร SDS สำหรับรายการนี้</strong>
                        <div style={{ marginTop: 3 }}>เพิ่มหรือแก้ไข SDS ได้จากปุ่ม “SDS” ในหน้าทะเบียนสารเคมี</div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: SPACE.xs }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.xs, flexWrap: 'wrap', alignItems: 'center' }}>
                          <strong style={{ fontSize: FONT.sm, color: 'var(--ink)' }}>เอกสาร SDS ของรายการนี้</strong>
                          <span style={{ fontSize: FONT.sm, color: 'var(--muted)', ...tabularNums }}>{versions.length} ฉบับ</span>
                        </div>
                        {versions.map(item => {
                          const product = productById.get(item.productId)
                          return (
                            <div key={item.id} style={{ padding: SPACE.sm, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.xs, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                <div style={{ minWidth: 0, flex: '1 1 280px' }}>
                                  <strong style={{ color: 'var(--ink)' }}>{item.revisionLabel || 'ยังไม่ได้ระบุเลขฉบับ'}</strong>
                                  {item.workflowOrigin === 'registry_v2' && <Badge color="purple" size="sm" style={{ marginLeft: 7 }}>สร้างจากทะเบียน</Badge>}
                                  <div style={{ marginTop: 3, fontSize: FONT.sm, color: 'var(--muted)' }}>
                                    {item.manufacturer || 'ไม่ระบุผู้ผลิต'} · {sdsLanguageLabel(item.language)} · วันที่มีผล {item.effectiveOn || '—'}
                                  </div>
                                </div>
                                <SdsStatusBadge status={item.status} />
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.sm, alignItems: 'center', flexWrap: 'wrap', marginTop: SPACE.xs }}>
                                <GhsRow
                                  codes={item.pictogramCodes}
                                  hazardClassesTh={product?.hazardClassesTh ?? []}
                                  size={30}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: FONT.sm, color: 'var(--muted)', ...tabularNums }}>
                                    ข้อความอันตราย {item.hStatements.length} รายการ · ข้อควรปฏิบัติ {item.pStatements.length} รายการ · {item.fileId ? 'แนบไฟล์แล้ว' : 'ยังไม่แนบไฟล์'}
                                  </span>
                                  {item.fileId && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      icon="eye"
                                      onClick={() => setPreview({
                                        url: `/api/admin/chemical-safety/sds/${item.id}/file`,
                                        title: registryRow.canonicalName,
                                      })}
                                    >
                                      เปิดไฟล์
                                    </Button>
                                  )}
                                </div>
                              </div>
                              {item.reviewReason && (
                                <div style={{ marginTop: SPACE.xs, fontSize: FONT.sm, color: 'var(--danger)' }}>เหตุผลที่ไม่อนุมัติ: {item.reviewReason}</div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </Card>
      )}

      {preview && (
        <SdsPdfViewerModal
          url={preview.url}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  )
}

// ── คลังเอกสาร SDS แยกตามงาน ────────────────────────────────────────────────

type DepartmentSdsFilter = 'all' | 'with-sds' | 'missing'

function linkedFilesByHoldingId(files: DepartmentSdsGroupDTO['files']) {
  const result = new Map<string, DepartmentSdsGroupDTO['files']>()
  for (const file of files) {
    const holdingId = file.registryLink.holdingId
    if (!holdingId) continue
    const linkedFiles = result.get(holdingId) ?? []
    linkedFiles.push(file)
    result.set(holdingId, linkedFiles)
  }
  return result
}

function legacyFilesNotLinkedToRegistry(files: DepartmentSdsGroupDTO['files']) {
  return files.filter(file => file.source === 'current' && file.registryLink.status !== 'linked')
}

function DepartmentSdsPanel({
  groups, registry,
}: {
  groups: DepartmentSdsGroupDTO[]
  registry: ChemicalRegistryRow[]
}) {
  const [openCode, setOpenCode] = useState<string | null>(null)
  const [openSearch, setOpenSearch] = useState('')
  const [openFilter, setOpenFilter] = useState<DepartmentSdsFilter>('all')
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null)

  const registryByUnitId = useMemo(() => {
    const result = new Map<string, ChemicalRegistryRow[]>()
    for (const row of registry) {
      const list = result.get(row.unitId) ?? []
      list.push(row)
      result.set(row.unitId, list)
    }
    return result
  }, [registry])

  const totals = useMemo(() => {
    return groups.reduce((summary, group) => {
      const rows = group.chemicalUnitId ? registryByUnitId.get(group.chemicalUnitId) ?? [] : []
      const legacyBacklog = legacyFilesNotLinkedToRegistry(group.files).length
      summary.registryRows += rows.length
      summary.withSds += rows.filter(row => row.hasSdsFile).length
      summary.missingSds += rows.filter(row => !row.hasSdsFile).length
      summary.legacyBacklog += legacyBacklog
      return summary
    }, {
      registryRows: 0,
      withSds: 0,
      missingSds: 0,
      legacyBacklog: 0,
    })
  }, [groups, registryByUnitId])

  useEffect(() => {
    setOpenSearch('')
    setOpenFilter('all')
  }, [openCode])

  return (
    <>
      <SdsPanelIntro
        icon="users"
        title="SDS แยกตามงาน"
        description="รวมเอกสาร SDS ของแต่ละงานไว้ดูข้อมูลอย่างเดียว · แก้ไข SDS ได้จากทะเบียนสารเคมี และเผยแพร่ทั้งงานจากที่นั่น"
        note="ดูได้อย่างเดียว · แก้ไขที่ทะเบียนสารเคมี"
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: SPACE.sm, marginBottom: SPACE.md }}>
        <Stat label="งานทั้งหมด" value={groups.length} icon="users" color="blue" />
        <Stat label="รายการทะเบียน" value={totals.registryRows} icon="clipboard" color="purple" />
        <Stat label="มี SDS" value={totals.withSds} icon="check" color="green" />
        <Stat label="ยังไม่มี SDS" value={totals.missingSds} icon="alert" color="amber" />
      </div>

      <Card padding={SPACE.sm} style={{ marginBottom: SPACE.md, background: 'var(--surface-2)' }}>
        <div style={{ display: 'flex', gap: SPACE.xs, alignItems: 'flex-start', fontSize: FONT.md }}>
          <Icon name="info" size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span>
            รายการด้านล่างยึดทะเบียนสารเคมีเป็นหลัก จึงแสดงสารที่มีและยังไม่มี SDS ในชุดเดียวกัน
            สถานะเผยแพร่เป็นสถานะของงาน และการจัดการทั้งหมดทำจากทะเบียนสารเคมี
          </span>
          {totals.legacyBacklog > 0 && (
            <span style={{ color: 'var(--warning)', fontWeight: 700 }}>เอกสารเดิมที่ยังไม่เชื่อมกับทะเบียน {totals.legacyBacklog} ฉบับ</span>
          )}
        </div>
      </Card>

      <div style={{ display: 'grid', gap: SPACE.sm }}>
        {groups.map(group => {
          const registryRows = group.chemicalUnitId ? registryByUnitId.get(group.chemicalUnitId) ?? [] : []
          const legacyFiles = legacyFilesNotLinkedToRegistry(group.files)
          const linkedFiles = linkedFilesByHoldingId(group.files)
          const open = openCode === group.code
          const searchNeedle = openSearch.trim().toLocaleLowerCase('th')
          const filteredRegistryRows = registryRows.filter(row => {
            const matchesStatus = openFilter === 'all'
              || (openFilter === 'with-sds' && row.hasSdsFile)
              || (openFilter === 'missing' && !row.hasSdsFile)
            if (!matchesStatus) return false
            if (!searchNeedle) return true
            return [row.canonicalName, row.casNumber, row.unitName, row.positionCode]
              .filter(Boolean)
              .join(' ')
              .toLocaleLowerCase('th')
              .includes(searchNeedle)
          })
          const canOpen = registryRows.length > 0 || group.files.length > 0
          return (
            <Card key={group.code} padding={SPACE.md}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.sm, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, flex: '1 1 360px' }}>
                  <h2 style={{ margin: 0, fontSize: FONT.lg, color: 'var(--ink)' }}>{group.department}</h2>
                  <p style={{ margin: '5px 0 0', fontSize: FONT.base, color: 'var(--muted)', ...tabularNums }}>
                    {registryRows.length} รายการทะเบียน · {registryRows.filter(row => row.hasSdsFile).length} มี SDS · {registryRows.filter(row => !row.hasSdsFile).length} ยังไม่มี SDS
                    {group.publishedAt && group.publishedByName && (
                      <> · เผยแพร่โดย {group.publishedByName} เมื่อ {new Date(group.publishedAt).toLocaleDateString('th-TH')}</>
                    )}
                  </p>
                  {group.fileCount > 0 && (
                    <p style={{ margin: '4px 0 0', fontSize: FONT.sm, color: 'var(--muted)', ...tabularNums }}>
                      เอกสารในคลังเดิม {group.fileCount} ฉบับ
                      {legacyFiles.length > 0 && <> · ยังไม่เชื่อมกับทะเบียน {legacyFiles.length} ฉบับ</>}
                    </p>
                  )}
                  {group.chemicalUnitId && <span style={{ display: 'inline-flex', marginTop: 6, fontSize: FONT.sm, color: 'var(--primary)', fontWeight: 700 }}>รายการของงานนี้ไม่ระบุตำแหน่งตู้หรือชั้นจัดเก็บ</span>}
                </div>
                <div style={{ display: 'flex', gap: SPACE.xs, alignItems: 'center', flexWrap: 'wrap' }}>
                  <DepartmentPublishBadge status={group.status} />
                  <Button
                    variant="secondary"
                    icon={open ? 'chevDown' : 'chevRight'}
                    disabled={!canOpen}
                    onClick={() => setOpenCode(open ? null : group.code)}
                    title={open ? `ซ่อนรายการของ ${group.department}` : `ดูรายการของ ${group.department}`}
                  >
                    {open ? 'ซ่อนรายการ' : `ดูรายการ${registryRows.length > 0 ? ` (${registryRows.length})` : ''}`}
                  </Button>
                </div>
              </div>

              {group.fileCount === 0 && (
                <p style={{ margin: `${SPACE.xs}px 0 0`, fontSize: FONT.sm, color: 'var(--warning)' }}>
                   <Icon name="alert" size={12} /> ยังไม่มีเอกสาร SDS — เพิ่มสารและแนบ SDS ได้จากหน้าทะเบียนสารเคมี
                </p>
              )}

              {open && registryRows.length > 0 && (
                <div style={{ marginTop: SPACE.md, borderTop: '1px solid var(--border)', paddingTop: SPACE.md }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.sm, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: FONT.base, color: 'var(--ink)' }}>รายการสารของงานนี้</h3>
                      <p style={{ margin: '3px 0 0', fontSize: FONT.sm, color: 'var(--muted)' }}>
                        รายการเดียวกับทะเบียนสารเคมี · แสดง {filteredRegistryRows.length} จาก {registryRows.length} รายการ
                      </p>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: FONT.sm, color: 'var(--muted)', ...tabularNums }}>
                      <Icon name="shieldCheck" size={14} style={{ color: 'var(--primary)' }} /> ดูได้อย่างเดียว
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: SPACE.sm }}>
                    <label style={{ display: 'grid', gap: 4, flex: '1 1 260px', minWidth: 220, fontSize: FONT.xs, color: 'var(--muted)', fontWeight: 700 }} htmlFor={`department-sds-search-${group.code}`}>
                      ค้นหาในรายการนี้
                      <Input
                        id={`department-sds-search-${group.code}`}
                        icon="search"
                        size="md"
                        value={openSearch}
                        onChange={setOpenSearch}
                        placeholder="ค้นหารายการในงาน"
                        style={{ maxWidth: 440 }}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: 4, minWidth: 170, fontSize: FONT.xs, color: 'var(--muted)', fontWeight: 700 }} htmlFor={`department-sds-filter-${group.code}`}>
                      กรองตามสถานะ SDS
                      <select
                        id={`department-sds-filter-${group.code}`}
                        value={openFilter}
                        onChange={event => setOpenFilter(event.target.value as DepartmentSdsFilter)}
                        style={{ height: 38, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)', font: 'inherit', fontSize: 13 }}
                      >
                        <option value="all">ทั้งหมด ({registryRows.length})</option>
                        <option value="with-sds">มี SDS ({registryRows.filter(row => row.hasSdsFile).length})</option>
                        <option value="missing">ยังไม่มี SDS ({registryRows.filter(row => !row.hasSdsFile).length})</option>
                      </select>
                    </label>
                  </div>

                  {filteredRegistryRows.length === 0 ? (
                    <div style={{ marginTop: SPACE.sm, padding: SPACE.md, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: FONT.sm }}>
                      ไม่พบรายการทะเบียนที่ตรงกับตัวกรองนี้
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 6, maxHeight: 520, overflowY: 'auto', marginTop: SPACE.sm }}>
                      {filteredRegistryRows.map(row => {
                        const files = linkedFiles.get(row.holdingId) ?? []
                        const file = files[0]
                        return (
                          <div key={row.holdingId} style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.sm, alignItems: 'center', flexWrap: 'wrap', padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--card)' }}>
                            <div style={{ minWidth: 0, flex: '1 1 280px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: FONT.base, color: 'var(--ink)' }}>{row.canonicalName}</strong>
                                {row.inventoryCaptureStatus === 'sds_only' && <Badge color="amber" size="sm">{SDS_ONLY_CAPTURE_LABEL}</Badge>}
                              </div>
                              <div style={{ marginTop: 3, fontSize: FONT.xs, color: 'var(--muted)' }}>
                                {row.casNumber ? `CAS ${row.casNumber}` : 'ไม่ระบุ CAS'} · {row.unitName}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, flexWrap: 'wrap' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: FONT.sm, color: row.hasSdsFile ? 'var(--success)' : 'var(--warning)', fontWeight: 700 }}>
                                <Icon name={row.hasSdsFile ? 'check' : 'alert'} size={14} />
                                {row.hasSdsFile ? 'มี SDS' : 'ยังไม่มี SDS'}
                              </span>
                              {files.length > 1 && <Badge color="purple" size="sm">พบเอกสารซ้ำ {files.length} รายการ</Badge>}
                              {file && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon="eye"
                                  title={`เปิดไฟล์ SDS ของ ${row.canonicalName}`}
                                  onClick={() => setPreview({ url: file.fileUrl, title: row.canonicalName })}
                                >
                                  เปิด SDS
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <p style={{ margin: `${SPACE.sm}px 0 0`, fontSize: FONT.xs, color: 'var(--muted)' }}>
                    ต้องการแก้ไขข้อมูลหรือแนบไฟล์ ให้เปิดรายการนั้นจากหน้าทะเบียนสารเคมี
                  </p>
                </div>
              )}

              {open && legacyFiles.length > 0 && (
                <div style={{ marginTop: SPACE.md, borderTop: '1px solid var(--border)', paddingTop: SPACE.md }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.sm, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: FONT.base, color: 'var(--ink)' }}>เอกสารเดิมที่ยังไม่เชื่อมกับทะเบียน</h3>
                      <p style={{ margin: '3px 0 0', fontSize: FONT.sm, color: 'var(--muted)' }}>
                        เอกสารกลุ่มนี้ยังไม่ได้เชื่อมกับรายการในทะเบียน จึงแสดงแยกไว้ไม่ให้ซ้ำกับรายการด้านบน
                      </p>
                    </div>
                    <Badge color="amber" size="sm">{legacyFiles.length} ฉบับ</Badge>
                  </div>
                  <div style={{ display: 'grid', gap: 6, marginTop: SPACE.sm }}>
                    {legacyFiles.map(file => (
                      <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.sm, alignItems: 'center', flexWrap: 'wrap', padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface-2)' }}>
                        <div style={{ minWidth: 0, flex: '1 1 280px' }}>
                          <strong style={{ fontSize: FONT.base, color: 'var(--ink)' }}>{file.displayName}</strong>
                          {file.displayNameEdited && <Badge color="blue" size="sm" style={{ marginLeft: 6 }}>แก้ชื่อแล้ว</Badge>}
                          <div style={{ marginTop: 3, fontSize: FONT.xs, color: 'var(--muted)' }}>
                            {file.registryLink.status === 'pending' ? 'รอเชื่อมกับทะเบียน' : 'ยังไม่เชื่อมกับรายการทะเบียน'}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="eye"
                          title={`เปิดไฟล์ ${file.displayName}`}
                          onClick={() => setPreview({ url: file.fileUrl, title: file.displayName })}
                        >
                          เปิดไฟล์
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {open && registryRows.length === 0 && legacyFiles.length === 0 && (
                <div style={{ marginTop: SPACE.md, padding: SPACE.md, borderTop: '1px solid var(--border)', color: 'var(--muted)', fontSize: FONT.sm }}>
                  งานนี้ยังไม่มีรายการสารหรือเอกสาร SDS ให้ตรวจสอบ
                </div>
              )}
            </Card>
          )
        })}
      </div>
      {preview && (
        <SdsPdfViewerModal
          url={preview.url}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  )
}
