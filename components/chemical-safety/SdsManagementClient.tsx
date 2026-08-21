'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { SdsDropzone } from './shared/SdsDropzone'
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
  canManage: boolean
  canEditUnitIds: string[]
  publishableDepartmentCodes: string[]
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

export function SdsManagementClient({
  view, items, products, departments, canManage,
  roomRegistry, departmentRegistry, canEditUnitIds, publishableDepartmentCodes,
}: Props) {
  const router = useRouter()
  const { toasts, add } = useToast()

  const notify = useCallback((message: string, ok = true) => {
    add(message, ok)
    if (ok) router.refresh()
  }, [add, router])

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
          publishableCodes={publishableDepartmentCodes}
          canManageChemicals={canManage}
          canEditUnitIds={canEditUnitIds}
          onDone={notify}
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
  groups, registry, publishableCodes, canManageChemicals, canEditUnitIds, onDone,
}: {
  groups: DepartmentSdsGroupDTO[]
  registry: ChemicalRegistryRow[]
  publishableCodes: string[]
  canManageChemicals: boolean
  canEditUnitIds: string[]
  onDone: (message: string, ok?: boolean) => void
}) {
  const [openCode, setOpenCode] = useState<string | null>(null)
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [registeringFileId, setRegisteringFileId] = useState<string | null>(null)
  const [replacing, setReplacing] = useState<{ id: string; department: string; displayName: string } | null>(null)
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

  async function setStatus(code: string, status: 'draft' | 'published') {
    setBusyCode(code)
    try {
      const response = await fetch(`/api/admin/chemical-safety/department-sds/${code}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'ดำเนินการไม่สำเร็จ')
      onDone(status === 'published' ? 'เผยแพร่คลัง SDS ของงานแล้ว' : 'ยกเลิกการเผยแพร่แล้ว')
    } catch (caught) {
      onDone(caught instanceof Error ? caught.message : 'ดำเนินการไม่สำเร็จ', false)
    } finally {
      setBusyCode(null)
    }
  }

  async function registerSdsOnly(file: DepartmentSdsGroupDTO['files'][number]) {
    setRegisteringFileId(file.id)
    try {
      const response = await fetch(`/api/admin/chemical-safety/department-sds/${file.id}/register-sds-only`, {
        method: 'POST',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'เพิ่มรายการ SDS-only ไม่สำเร็จ')
      onDone('เพิ่มเข้าทะเบียนแล้ว · SDS-only — ยังไม่ระบุปริมาณ')
    } catch (caught) {
      onDone(caught instanceof Error ? caught.message : 'เพิ่มรายการ SDS-only ไม่สำเร็จ', false)
    } finally {
      setRegisteringFileId(null)
    }
  }

  async function rename(id: string, current: string) {
    const next = window.prompt('ชื่อที่จะแสดงบนหน้าสาธารณะ', current)
    if (next === null || next.trim() === '' || next.trim() === current) return
    try {
      const response = await fetch(`/api/admin/chemical-safety/department-sds/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: next.trim() }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'แก้ชื่อไม่สำเร็จ')
      onDone('แก้ชื่อเอกสารแล้ว')
    } catch (caught) {
      onDone(caught instanceof Error ? caught.message : 'แก้ชื่อไม่สำเร็จ', false)
    }
  }

  async function removeFile(id: string, displayName: string) {
    if (!window.confirm(`ลบเอกสาร "${displayName}" ออกจากงานนี้?`)) return
    try {
      const response = await fetch(`/api/admin/chemical-safety/department-sds/${id}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'ลบเอกสารไม่สำเร็จ')
      onDone(payload.republishRequired
        ? 'ลบเอกสารแล้ว กรุณาเผยแพร่งานนี้อีกครั้งก่อนแสดงต่อสาธารณะ'
        : 'ลบเอกสารแล้ว')
    } catch (caught) {
      onDone(caught instanceof Error ? caught.message : 'ลบเอกสารไม่สำเร็จ', false)
    }
  }

  return (
    <>
      <SdsPanelIntro
        icon="users"
        title="SDS แยกตามงาน"
        description="รวมเอกสาร SDS ของแต่ละงานให้ตรวจสอบและเผยแพร่เป็นชุดได้จากพื้นที่เดียว การแก้ไข SDS ให้ทำในทะเบียนสารเคมี"
        note="เผยแพร่ทั้งงานพร้อมกัน"
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
            การเผยแพร่ทำทั้งงานพร้อมกัน หัวหน้างานเป็นผู้รับรองว่าเอกสารชุดนี้เป็นของงานและใช้งานได้จริง
            งานที่ยังไม่เผยแพร่จะไม่ปรากฏบนหน้าสาธารณะเลย
          </span>
        </div>
      </Card>

      <div style={{ display: 'grid', gap: SPACE.sm }}>
        {groups.map(group => {
          const canPublish = publishableCodes.includes(group.code)
          const canRegister = canManageChemicals || (group.chemicalUnitId !== null && canEditUnitIds.includes(group.chemicalUnitId))
          const registryRows = group.chemicalUnitId ? registryByUnitId.get(group.chemicalUnitId) ?? [] : []
          const open = openCode === group.code
          const busy = busyCode === group.code
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
                  {canRegister && <span style={{ display: 'inline-flex', marginTop: 6, fontSize: FONT.sm, color: 'var(--primary)', fontWeight: 700 }}>ทะเบียน: storageScope = department · ไม่มีตำแหน่งจัดเก็บ</span>}
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
                  {canPublish && (
                    <>
                      {group.status === 'published' ? (
                        <Button variant="danger" icon="lock" disabled={busy} onClick={() => void setStatus(group.code, 'draft')}>
                          ยกเลิกเผยแพร่
                        </Button>
                      ) : (
                        <Button
                          icon="globe"
                          disabled={busy || group.fileCount === 0}
                          title={group.fileCount === 0 ? 'งานนี้ยังไม่มีเอกสารให้เผยแพร่' : undefined}
                          onClick={() => void setStatus(group.code, 'published')}
                        >
                          เผยแพร่ทั้งงาน
                        </Button>
                      )}
                    </>
                  )}
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
                          {file.source === 'current' && canRegister && file.registryLink.status === 'unlinked' && (
                            <Button
                              variant="ghost"
                              icon="flask"
                              size="sm"
                              disabled={registeringFileId === file.id}
                              title="เพิ่มเข้าทะเบียนเป็น SDS-only — ยังไม่ระบุปริมาณ"
                              onClick={() => void registerSdsOnly(file)}
                            >
                              {registeringFileId === file.id ? 'กำลังเพิ่ม…' : 'เพิ่มเข้าทะเบียนสารเคมี · SDS-only'}
                            </Button>
                          )}
                          {file.source === 'current' && canPublish && (
                            <>
                              <Button
                                variant="ghost"
                                icon="upload"
                                size="sm"
                                disabled={file.registryLink.status === 'linked'}
                                title={file.registryLink.status === 'linked'
                                  ? 'ไฟล์นี้ผูกกับทะเบียนสารเคมีแล้ว จึงต้องจัดการ SDS จากทะเบียนสารเคมี'
                                  : 'แทนที่ไฟล์ด้วยฉบับใหม่'}
                                onClick={() => setReplacing({ id: file.id, department: group.department, displayName: file.displayName })}
                              >
                                แทนที่ไฟล์
                              </Button>
                              <Button
                                variant="ghost"
                                icon="edit"
                                size="sm"
                                title="แก้ชื่อที่แสดง"
                                onClick={() => void rename(file.id, file.displayName)}
                              >
                                แก้ไขชื่อ
                              </Button>
                              <Button
                                variant="ghost"
                                icon="trash"
                                size="sm"
                                disabled={file.registryLink.status === 'linked'}
                                title={file.registryLink.status === 'linked'
                                  ? 'ไฟล์นี้ผูกกับทะเบียนสารเคมีแล้ว จึงไม่สามารถลบจากรายการ SDS แยกตามงานได้'
                                  : 'ลบเอกสาร'}
                                onClick={() => void removeFile(file.id, file.displayName)}
                              >
                                ลบ
                              </Button>
                            </>
                          )}
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
      {replacing && (
        <DepartmentSdsReplaceModal
          id={replacing.id}
          departmentName={replacing.department}
          currentDisplayName={replacing.displayName}
          onClose={() => setReplacing(null)}
          onSaved={(message) => {
            setReplacing(null)
            onDone(message)
          }}
        />
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

function DepartmentSdsReplaceModal({
  id, departmentName, currentDisplayName, onClose, onSaved,
}: {
  id: string
  departmentName: string
  currentDisplayName: string
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [displayName, setDisplayName] = useState(currentDisplayName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function selectFile(nextFile: File) {
    setFile(nextFile)
    setError(null)
  }

  async function replace() {
    if (!file) { setError('กรุณาเลือกไฟล์ PDF ฉบับใหม่'); return }
    if (!displayName.trim()) { setError('กรุณาระบุชื่อเอกสารที่แสดง'); return }

    setBusy(true)
    setError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('displayName', displayName.trim())
      const response = await fetch(`/api/admin/chemical-safety/department-sds/${id}/replace`, { method: 'POST', body })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'แทนที่ไฟล์ SDS ไม่สำเร็จ')
      onSaved(payload.republishRequired
        ? 'แทนที่ไฟล์แล้ว กรุณาเผยแพร่งานนี้อีกครั้งก่อนแสดงต่อสาธารณะ'
        : 'แทนที่ไฟล์ SDS แล้ว')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'แทนที่ไฟล์ SDS ไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`แทนที่ไฟล์ SDS สำหรับ ${departmentName}`} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 620, boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden' }}>
        <header style={{ padding: SPACE.md, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE.sm }}>
          <div>
            <div style={{ fontSize: FONT.xs, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--primary)' }}>SDS แยกตามงาน</div>
            <h2 style={{ margin: '4px 0 0', fontSize: FONT.xl, color: 'var(--ink)' }}>แทนที่ไฟล์ · {currentDisplayName}</h2>
          </div>
          <Button variant="ghost" icon="x" title="ปิด" onClick={onClose} disabled={busy} />
        </header>

        <div style={{ padding: SPACE.md, display: 'grid', gap: SPACE.sm }}>
          <SdsDropzone onFile={selectFile} disabled={busy} hint="รับเฉพาะ PDF ขนาดไม่เกิน 50 MB" />
          {file && <p style={{ margin: 0, fontSize: FONT.sm, color: 'var(--success)' }}><Icon name="check" size={13} /> เลือกไฟล์: {file.name}</p>}
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', marginBottom: 4, fontSize: FONT.sm, fontWeight: 600, color: 'var(--muted)' }}>ชื่อเอกสารที่แสดง *</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={300}
              disabled={busy}
              style={{ width: '100%', minHeight: 44, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', boxSizing: 'border-box', font: 'inherit', color: 'var(--ink)', background: 'var(--card)' }}
              placeholder="เช่น SDS น้ำยาตรวจ..."
            />
          </label>
          <p style={{ margin: 0, fontSize: FONT.sm, color: 'var(--muted)', lineHeight: 1.55 }}>
            ลิงก์สาธารณะของเอกสารนี้ยังคงเดิม มีผลเฉพาะเนื้อหาไฟล์และชื่อที่แสดง
            หากงานนี้เผยแพร่อยู่ ระบบจะยกเลิกการเผยแพร่ชั่วคราว เพื่อให้ตรวจรายการใหม่ก่อนกดเผยแพร่อีกครั้ง
          </p>
          {error && <p role="alert" style={{ margin: 0, padding: SPACE.xs, borderRadius: 8, fontSize: FONT.sm, color: 'var(--danger)', background: 'rgba(220,38,38,.10)' }}>{error}</p>}
        </div>

        <footer style={{ padding: SPACE.md, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: SPACE.xs }}>
          <Button variant="secondary" onClick={onClose} disabled={busy}>ยกเลิก</Button>
          <Button icon="upload" onClick={() => void replace()} disabled={busy}>{busy ? 'กำลังแทนที่…' : 'แทนที่ไฟล์'}</Button>
        </footer>
      </div>
    </div>
  )
}
