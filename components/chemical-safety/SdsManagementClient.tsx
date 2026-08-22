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
import { sdsItemsForHolding, summarizeRoomSds } from '@/lib/chemical-safety/sds-room-summary'
import { SdsPdfViewerModal } from './SdsPdfViewerModal'
import { FONT, SPACE, tabularNums } from './shared/tokens'
import { DepartmentPublishBadge, GhsRow, SdsStateBadge, SdsStatusBadge } from './shared/ui'

export interface SdsProductInfo {
  productId: string
  name: string
  pictogramCodes: GhsPictogramCode[]
  hazardClassesTh: string[]
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

function ChemicalSdsPanel({
  items, roomRegistry, products,
}: {
  items: ChemicalSdsDTO[]
  roomRegistry: ChemicalRegistryRow[]
  products: SdsProductInfo[]
}) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), search ? 350 : 0)
    return () => clearTimeout(timer)
  }, [search])

  const productById = useMemo(
    () => new Map(products.map(product => [product.productId, product])),
    [products],
  )

  const summary = useMemo(() => summarizeRoomSds(roomRegistry, items), [roomRegistry, items])

  const rows = useMemo(() => {
    const needle = debouncedSearch.toLocaleLowerCase('th')
    return roomRegistry.map(registryRow => {
      const versions = sdsItemsForHolding(items, registryRow.holdingId)
      return { registryRow, versions }
    }).filter(({ registryRow, versions }) => {
      if (!needle) return true
      const versionText = versions.map(item => {
        const product = productById.get(item.productId)
        return [product?.name, item.manufacturer, item.supplier, item.revisionLabel]
          .filter(Boolean).join(' ')
      }).join(' ')
      return [registryRow.canonicalName, registryRow.unitName, registryRow.positionCode, versionText]
        .filter(Boolean).join(' ').toLocaleLowerCase('th').includes(needle)
    })
  }, [items, roomRegistry, debouncedSearch, productById])

  return (
    <>
      <SdsPanelIntro
        icon="doc"
        title="SDS ห้องสารเคมี"
        description="แสดงสารจากทะเบียนห้องสารเคมีเป็นหลัก แล้วรวม SDS ทุกเวอร์ชันไว้ใต้สารเดียวกัน"
        note="จำนวนรายการอ้างอิงทะเบียน · จัดการ workflow ที่ทะเบียนสารเคมี"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: SPACE.sm, marginBottom: SPACE.md }}>
        <Stat label="รายการในทะเบียนห้อง" value={summary.holdingCount} icon="flask" color="blue" />
        <Stat label="มี SDS ผูกทะเบียน" value={summary.linkedHoldingCount} icon="link" color="green" />
        <Stat label="ยังไม่มี SDS" value={summary.missingHoldingCount} icon="inbox" color="amber" />
        <Stat label="เวอร์ชัน SDS" value={summary.versionCount} icon="doc" color="purple" />
      </div>

      <Card padding={SPACE.sm} style={{ marginBottom: SPACE.md, borderLeft: '4px solid var(--primary)' }}>
        <div style={{ display: 'flex', gap: SPACE.xs, alignItems: 'flex-start', fontSize: FONT.md }}>
          <Icon name="info" size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span>
            <strong>การนับรายการและเวอร์ชัน SDS:</strong> รายการในทะเบียนคือจำนวนสารที่เก็บอยู่ในห้อง ส่วนเวอร์ชัน SDS คือจำนวนเอกสารทั้งหมด
            จึงอาจไม่เท่ากันเมื่อสารหนึ่งรายการมี SDS มากกว่าหนึ่งฉบับ
          </span>
        </div>
      </Card>

      <div style={{ marginBottom: SPACE.sm }}>
        <Input
          icon="search"
          size="lg"
          value={search}
          onChange={setSearch}
          placeholder="ค้นหาชื่อสาร หน่วยงาน ตำแหน่ง ผู้ผลิต หรือฉบับที่"
          style={{ maxWidth: 420 }}
        />
      </div>
      {rows.length === 0 ? (
        <Card padding={0}><EmptyState icon="flask" title="ไม่พบสารในทะเบียนห้องสารเคมีที่ตรงกับเงื่อนไข" /></Card>
      ) : (
        <div style={{ display: 'grid', gap: SPACE.sm }}>
          {rows.map(({ registryRow, versions }) => {
            return (
              <Card key={registryRow.holdingId} padding={SPACE.md}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.sm, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: FONT.lg, color: 'var(--ink)' }}>
                      {registryRow.canonicalName}
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: FONT.base, color: 'var(--muted)' }}>
                      {registryRow.unitName} · ตำแหน่ง {registryRow.positionCode || 'ไม่ระบุ'}
                    </p>
                  </div>
                  <SdsStateBadge state={registryRow.sdsStatus} />
                </div>

                {versions.length === 0 ? (
                  <div style={{ marginTop: SPACE.sm, padding: SPACE.sm, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: FONT.sm }}>
                    <strong style={{ color: 'var(--ink)' }}>ยังไม่มี SDS ที่ผูกกับรายการนี้</strong>
                    <div style={{ marginTop: 3 }}>เพิ่มหรือผูก SDS จากปุ่ม SDS ในทะเบียนสารเคมี</div>
                  </div>
                ) : (
                  <div style={{ marginTop: SPACE.sm, display: 'grid', gap: SPACE.xs }}>
                    <div style={{ fontSize: FONT.sm, fontWeight: 800, color: 'var(--ink)' }}>
                      SDS ที่ผูกกับทะเบียน · {versions.length} เวอร์ชัน
                    </div>
                    {versions.map(item => {
                      const product = productById.get(item.productId)
                      return (
                        <div key={item.id} style={{ padding: SPACE.sm, border: '1px solid var(--border)', borderRadius: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.xs, flexWrap: 'wrap' }}>
                            <div style={{ minWidth: 0 }}>
                              <strong style={{ color: 'var(--ink)' }}>{item.revisionLabel || 'ไม่ระบุฉบับ'}</strong>
                              {item.workflowOrigin === 'registry_v2' && <Badge color="purple" size="sm" style={{ marginLeft: 7 }}>จากทะเบียน</Badge>}
                              <div style={{ marginTop: 3, fontSize: FONT.sm, color: 'var(--muted)' }}>
                                {item.manufacturer || 'ไม่ระบุผู้ผลิต'} · {item.language || 'th'} · มีผล {item.effectiveOn || '—'}
                              </div>
                            </div>
                            <SdsStatusBadge status={item.status} />
                          </div>

                          <div style={{ marginTop: SPACE.xs }}>
                            <GhsRow
                              codes={item.pictogramCodes}
                              hazardClassesTh={product?.hazardClassesTh ?? []}
                              size={30}
                            />
                          </div>

                          <div style={{ marginTop: SPACE.xs, fontSize: FONT.sm, color: 'var(--muted)', ...tabularNums }}>
                            H {item.hStatements.length} รายการ · P {item.pStatements.length} รายการ ·{' '}
                            {item.fileId ? 'แนบไฟล์แล้ว' : 'ยังไม่แนบไฟล์'}
                            {item.reviewReason && (
                              <span style={{ color: 'var(--danger)' }}> · เหตุผล: {item.reviewReason}</span>
                            )}
                          </div>

                          {item.fileId && (
                            <div style={{ marginTop: SPACE.xs, display: 'flex', gap: SPACE.xs, flexWrap: 'wrap' }}>
                              <Button
                                variant="secondary"
                                icon="eye"
                                onClick={() => setPreview({
                                  url: `/api/admin/chemical-safety/sds/${item.id}/file`,
                                  title: registryRow.canonicalName,
                                })}
                              >
                                เปิดไฟล์
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
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

function DepartmentSdsPanel({
  groups, registry,
}: {
  groups: DepartmentSdsGroupDTO[]
  registry: ChemicalRegistryRow[]
}) {
  const [openCode, setOpenCode] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null)

  const totals = useMemo(() => ({
    files: groups.reduce((sum, group) => sum + group.fileCount, 0),
    published: groups.filter(group => group.status === 'published').length,
  }), [groups])

  const registryByUnitId = useMemo(() => {
    const result = new Map<string, ChemicalRegistryRow[]>()
    for (const row of registry) {
      const list = result.get(row.unitId) ?? []
      list.push(row)
      result.set(row.unitId, list)
    }
    return result
  }, [registry])

  return (
    <>
      <SdsPanelIntro
        icon="users"
        title="SDS แยกตามงาน"
        description="รวมเอกสาร SDS ของแต่ละงานไว้ตรวจสอบแบบ read-only การแก้ไข SDS ให้ทำในทะเบียนสารเคมี และเผยแพร่ทั้งงานจากทะเบียน"
        note="ดูอย่างเดียว · จัดการที่ทะเบียนสารเคมี"
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: SPACE.sm, marginBottom: SPACE.md }}>
        <Stat label="งานทั้งหมด" value={groups.length} icon="users" color="blue" />
        <Stat label="เผยแพร่แล้ว" value={totals.published} icon="globe" color="green" />
        <Stat label="เอกสารทั้งหมด" value={totals.files} icon="doc" color="purple" />
      </div>

      <Card padding={SPACE.sm} style={{ marginBottom: SPACE.md, borderLeft: '4px solid var(--primary)' }}>
        <div style={{ display: 'flex', gap: SPACE.xs, alignItems: 'flex-start', fontSize: FONT.md }}>
          <Icon name="alert" size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span>
            หน้านี้ใช้ตรวจสอบรายการและสถานะเท่านั้น การแก้ไขหรือแนบ SDS ต้องเปิดจากแถวสารเคมีในทะเบียน
            และการเผยแพร่ทั้งงานต้องเลือกหน่วยงานในทะเบียนสารเคมีก่อน
          </span>
        </div>
      </Card>

      <div style={{ display: 'grid', gap: SPACE.sm }}>
        {groups.map(group => {
          const registryRows = group.chemicalUnitId ? registryByUnitId.get(group.chemicalUnitId) ?? [] : []
          const open = openCode === group.code
          return (
            <Card key={group.code} padding={SPACE.md}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.sm, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: FONT.lg, color: 'var(--ink)' }}>{group.department}</h2>
                  <p style={{ margin: '4px 0 0', fontSize: FONT.base, color: 'var(--muted)', ...tabularNums }}>
                    {group.fileCount} ฉบับ
                    {group.publishedAt && group.publishedByName && (
                      <> · เผยแพร่โดย {group.publishedByName} เมื่อ {new Date(group.publishedAt).toLocaleDateString('th-TH')}</>
                    )}
                  </p>
                  {group.chemicalUnitId && <span style={{ display: 'inline-flex', marginTop: 6, fontSize: FONT.sm, color: 'var(--primary)', fontWeight: 700 }}>ทะเบียน: storageScope = department · ไม่มีตำแหน่งจัดเก็บ</span>}
                </div>
                <div style={{ display: 'flex', gap: SPACE.xs, alignItems: 'center', flexWrap: 'wrap' }}>
                  <DepartmentPublishBadge status={group.status} />
                  <Button
                    variant="secondary"
                    icon={open ? 'chevDown' : 'chevRight'}
                    disabled={group.fileCount === 0}
                    onClick={() => setOpenCode(open ? null : group.code)}
                  >
                    {open ? 'ซ่อนรายการ' : 'ดูรายการ'}
                  </Button>
                </div>
              </div>

              {registryRows.length > 0 && (
                <div style={{ marginTop: SPACE.sm, padding: SPACE.sm, borderRadius: 10, background: 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.xs, flexWrap: 'wrap', alignItems: 'center' }}>
                    <strong style={{ fontSize: FONT.base }}>รายการทะเบียนของงาน</strong>
                    <span style={{ fontSize: FONT.sm, color: 'var(--muted)' }}>{registryRows.length} รายการ · SDS เริ่มจากทะเบียนสารเคมี</span>
                  </div>
                  <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                    {registryRows.map(row => (
                      <div key={row.holdingId} style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.xs, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: FONT.sm }}>{row.canonicalName}</span>
                        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: FONT.xs, color: row.hasSdsFile ? 'var(--success)' : 'var(--warning)' }}>
                          {row.hasSdsFile ? 'มีไฟล์ SDS' : 'ยังไม่มีไฟล์ SDS'}
                          {row.inventoryCaptureStatus === 'sds_only' && <Badge color="amber" size="sm">SDS-only — ยังไม่ระบุปริมาณ</Badge>}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: FONT.xs, color: 'var(--muted)' }}>
                    แก้ไขข้อมูลและแนบไฟล์ SDS จากหน้าทะเบียนสารเคมีของรายการนั้น
                  </p>
                </div>
              )}

              {group.fileCount === 0 && (
                <p style={{ margin: `${SPACE.xs}px 0 0`, fontSize: FONT.sm, color: 'var(--warning)' }}>
                  <Icon name="alert" size={12} /> ยังไม่มีเอกสาร — กรุณาเพิ่มสารและจัดการ SDS จากหน้าทะเบียนสารเคมี
                </p>
              )}

              {open && group.files.length > 0 && (
                <div style={{ marginTop: SPACE.sm, borderTop: '1px solid var(--border)', paddingTop: SPACE.sm }}>
                  <div style={{ display: 'grid', gap: 4, maxHeight: 420, overflowY: 'auto' }}>
                    {group.files.map(file => (
                      <div
                        key={file.id}
                        style={{
                          display: 'flex', justifyContent: 'space-between', gap: SPACE.xs,
                          alignItems: 'center', flexWrap: 'wrap', padding: '6px 8px', borderRadius: 8,
                        }}
                      >
                        <span style={{ fontSize: FONT.base, minWidth: 0 }}>
                          {file.displayName}
                          {file.source === 'registry_v2' && <Badge color="purple" size="sm" style={{ marginLeft: 6 }}>จากทะเบียน</Badge>}
                          {file.displayNameEdited && <Badge color="blue" size="sm" style={{ marginLeft: 6 }}>แก้ชื่อแล้ว</Badge>}
                          {file.registryLink.status === 'pending' && <Badge color="amber" size="sm" style={{ marginLeft: 6 }}>รอเพิ่มเข้าทะเบียน</Badge>}
                          {file.registryLink.status === 'linked' && <Badge color="green" size="sm" style={{ marginLeft: 6 }}>อยู่ในทะเบียน · ผูกไฟล์แล้ว</Badge>}
                        </span>
                        <span style={{ display: 'flex', gap: 4 }}>
                          <Button
                            variant="ghost"
                            icon="eye"
                            title="เปิดไฟล์"
                            onClick={() => setPreview({ url: file.fileUrl, title: file.displayName })}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
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
