'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilterChips, type FilterChipItem } from '@/components/ui/FilterChips'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Stat } from '@/components/ui/Stat'
import type { ChemicalSdsView } from '@/lib/navigation'
import type { DepartmentSdsGroupDTO } from '@/lib/chemical-safety/department-repository'
import type {
  ChemicalProductDTO,
  ChemicalSdsDTO,
  ChemicalUnitDTO,
  GhsPictogramCode,
} from '@/lib/chemical-safety/types'
import { SdsEditorModal } from './SdsEditorModal'
import { DepartmentChemicalModal } from './DepartmentChemicalModal'
import { SdsDropzone } from './shared/SdsDropzone'
import { FONT, SPACE, tabularNums } from './shared/tokens'
import { DepartmentPublishBadge, GhsRow, SdsStatusBadge } from './shared/ui'

export interface SdsProductInfo {
  productId: string
  name: string
  pictogramCodes: GhsPictogramCode[]
  hazardClassesTh: string[]
}

interface Props {
  view: ChemicalSdsView
  items: ChemicalSdsDTO[]
  products: SdsProductInfo[]
  chemicalProducts: ChemicalProductDTO[]
  units: ChemicalUnitDTO[]
  departments: DepartmentSdsGroupDTO[]
  actorId: string
  canManage: boolean
  canEditUnitIds: string[]
  canReviewUnitIds: string[]
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
  view, items, products, departments, actorId, canManage,
  chemicalProducts, units, canEditUnitIds, canReviewUnitIds, publishableDepartmentCodes,
}: Props) {
  const router = useRouter()
  const { toasts, add } = useToast()
  const canEdit = canManage || canEditUnitIds.length > 0
  const canReview = canManage || canReviewUnitIds.length > 0

  const notify = useCallback((message: string, ok = true) => {
    add(message, ok)
    if (ok) router.refresh()
  }, [add, router])

  return (
    <>
      {view === 'sds-chemicals' ? (
        <ChemicalSdsPanel
          items={items}
          products={products}
          actorId={actorId}
          canEdit={canEdit}
          canReview={canReview}
          onDone={notify}
        />
      ) : (
        <DepartmentSdsPanel
          groups={departments}
          publishableCodes={publishableDepartmentCodes}
          chemicalProducts={chemicalProducts}
          units={units}
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
  items, products, actorId, canEdit, canReview, onDone,
}: {
  items: ChemicalSdsDTO[]
  products: SdsProductInfo[]
  actorId: string
  canEdit: boolean
  canReview: boolean
  onDone: (message: string, ok?: boolean) => void
}) {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [editing, setEditing] = useState<ChemicalSdsDTO | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), search ? 350 : 0)
    return () => clearTimeout(timer)
  }, [search])

  const productById = useMemo(
    () => new Map(products.map(product => [product.productId, product])),
    [products],
  )

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of items) map.set(item.status, (map.get(item.status) ?? 0) + 1)
    return map
  }, [items])

  const rows = useMemo(() => {
    const needle = debouncedSearch.toLocaleLowerCase('th')
    return items.filter(item => {
      if (status && item.status !== status) return false
      if (!needle) return true
      const product = productById.get(item.productId)
      return [product?.name, item.manufacturer, item.supplier, item.revisionLabel]
        .filter(Boolean).join(' ').toLocaleLowerCase('th').includes(needle)
    })
  }, [items, status, debouncedSearch, productById])

  const statusChips: FilterChipItem<string>[] = [
    { value: '', label: 'ทุกสถานะ', count: items.length },
    { value: 'draft', label: 'ฉบับร่าง', count: counts.get('draft') ?? 0 },
    { value: 'in_review', label: 'รอทบทวน', count: counts.get('in_review') ?? 0 },
    { value: 'approved', label: 'อนุมัติแล้ว', count: counts.get('approved') ?? 0 },
    { value: 'rejected', label: 'ไม่อนุมัติ', count: counts.get('rejected') ?? 0 },
    { value: 'superseded', label: 'ถูกแทนที่', count: counts.get('superseded') ?? 0 },
  ]

  async function act(id: string, path: string, body?: unknown, successMessage = 'ดำเนินการแล้ว') {
    setBusyId(id)
    try {
      const response = await fetch(`/api/admin/chemical-safety/sds/${id}${path}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'ดำเนินการไม่สำเร็จ')
      onDone(successMessage)
    } catch (caught) {
      onDone(caught instanceof Error ? caught.message : 'ดำเนินการไม่สำเร็จ', false)
    } finally {
      setBusyId(null)
    }
  }

  function reject(id: string) {
    const reason = window.prompt('เหตุผลที่ไม่อนุมัติ')
    if (reason === null) return
    if (reason.trim() === '') {
      onDone('กรุณาระบุเหตุผลที่ไม่อนุมัติ', false)
      return
    }
    void act(id, '/review', { decision: 'rejected', reason: reason.trim() }, 'บันทึกผลไม่อนุมัติแล้ว')
  }

  return (
    <>
      <SdsPanelIntro
        icon="doc"
        title="SDS ห้องสารเคมี"
        description="จัดการเอกสารของสารในทะเบียน ตั้งแต่แนบไฟล์ แก้ไขข้อมูล จนถึงส่งทบทวน"
        note="แยกผู้ส่งและผู้ทบทวน"
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: SPACE.sm, marginBottom: SPACE.md }}>
        <Stat label="ฉบับร่าง" value={counts.get('draft') ?? 0} icon="edit" color="blue" />
        <Stat label="รอทบทวน" value={counts.get('in_review') ?? 0} icon="clock" color="amber" />
        <Stat label="อนุมัติแล้ว" value={counts.get('approved') ?? 0} icon="shieldCheck" color="green" />
        <Stat label="ไม่อนุมัติ" value={counts.get('rejected') ?? 0} icon="x" color="red" />
      </div>

      <div style={{ marginBottom: SPACE.sm }}>
        <Input
          icon="search"
          size="lg"
          value={search}
          onChange={setSearch}
          placeholder="ค้นหาชื่อสาร ผู้ผลิต หรือฉบับที่"
          style={{ maxWidth: 420 }}
        />
      </div>
      <div style={{ marginBottom: SPACE.md }}>
        <FilterChips items={statusChips} value={status} onChange={setStatus} label="กรองตามสถานะเอกสาร" compact />
      </div>

      {rows.length === 0 ? (
        <Card padding={0}><EmptyState icon="doc" title="ไม่พบเอกสาร SDS ที่ตรงกับเงื่อนไข" /></Card>
      ) : (
        <div style={{ display: 'grid', gap: SPACE.sm }}>
          {rows.map(item => {
            const product = productById.get(item.productId)
            const busy = busyId === item.id
            const ownSubmission = item.submittedBy === actorId
            return (
              <Card key={item.id} padding={SPACE.md}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.sm, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: FONT.lg, color: 'var(--ink)' }}>
                      {product?.name ?? 'ไม่ทราบชื่อสาร'}
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: FONT.base, color: 'var(--muted)' }}>
                      {item.revisionLabel || 'ไม่ระบุฉบับ'} · {item.manufacturer || 'ไม่ระบุผู้ผลิต'} ·{' '}
                      {item.language || 'th'} · มีผล {item.effectiveOn || '—'}
                    </p>
                  </div>
                  <SdsStatusBadge status={item.status} />
                </div>

                <div style={{ marginTop: SPACE.sm }}>
                  <GhsRow
                    codes={item.pictogramCodes}
                    hazardClassesTh={product?.hazardClassesTh ?? []}
                    size={34}
                  />
                </div>

                <div style={{ marginTop: SPACE.xs, fontSize: FONT.sm, color: 'var(--muted)', ...tabularNums }}>
                  H {item.hStatements.length} รายการ · P {item.pStatements.length} รายการ ·{' '}
                  {item.fileId ? 'แนบไฟล์แล้ว' : 'ยังไม่แนบไฟล์'}
                  {item.reviewReason && (
                    <span style={{ color: 'var(--danger)' }}> · เหตุผล: {item.reviewReason}</span>
                  )}
                </div>

                <div style={{ marginTop: SPACE.sm, display: 'flex', gap: SPACE.xs, flexWrap: 'wrap' }}>
                  {item.fileId && (
                    <Button
                      variant="secondary"
                      icon="eye"
                      onClick={() => window.open(`/api/admin/chemical-safety/sds/${item.id}/file`, '_blank', 'noopener')}
                    >
                      เปิดไฟล์
                    </Button>
                  )}
                  {canEdit && item.status === 'draft' && (
                    <>
                      <Button variant="secondary" icon="edit" disabled={busy} onClick={() => setEditing(item)}>
                        แก้ไข
                      </Button>
                      <Button
                        icon="arrowRight"
                        disabled={busy || !item.fileId}
                        title={item.fileId ? undefined : 'ต้องแนบไฟล์ SDS ก่อนจึงจะส่งทบทวนได้'}
                        onClick={() => void act(item.id, '/submit', undefined, 'ส่งทบทวนแล้ว')}
                      >
                        ส่งทบทวน
                      </Button>
                    </>
                  )}
                  {canReview && item.status === 'in_review' && (
                    ownSubmission ? (
                      <span style={{ fontSize: FONT.sm, color: 'var(--muted)', alignSelf: 'center' }}>
                        <Icon name="lock" size={12} /> ผู้ส่งไม่สามารถทบทวนฉบับของตนเอง
                      </span>
                    ) : (
                      <>
                        <Button
                          icon="check"
                          disabled={busy}
                          onClick={() => void act(item.id, '/review', { decision: 'approved', reason: '' }, 'อนุมัติแล้ว')}
                        >
                          อนุมัติ
                        </Button>
                        <Button variant="danger" icon="x" disabled={busy} onClick={() => reject(item.id)}>
                          ไม่อนุมัติ
                        </Button>
                      </>
                    )
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing && (
        <SdsEditorModal
          sds={editing}
          productName={productById.get(editing.productId)?.name ?? 'ไม่ทราบชื่อสาร'}
          seed={{
            pictogramCodes: productById.get(editing.productId)?.pictogramCodes ?? [],
            hazardClassesTh: productById.get(editing.productId)?.hazardClassesTh ?? [],
          }}
          onClose={() => setEditing(null)}
          onSaved={onDone}
        />
      )}
    </>
  )
}

// ── คลังเอกสาร SDS แยกตามงาน ────────────────────────────────────────────────

function DepartmentSdsPanel({
  groups, publishableCodes, chemicalProducts, units, canManageChemicals, canEditUnitIds, onDone,
}: {
  groups: DepartmentSdsGroupDTO[]
  publishableCodes: string[]
  chemicalProducts: ChemicalProductDTO[]
  units: ChemicalUnitDTO[]
  canManageChemicals: boolean
  canEditUnitIds: string[]
  onDone: (message: string, ok?: boolean) => void
}) {
  const [openCode, setOpenCode] = useState<string | null>(null)
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [uploading, setUploading] = useState<{ code: string; department: string } | null>(null)
  const [replacing, setReplacing] = useState<{ id: string; department: string; displayName: string } | null>(null)
  const [registering, setRegistering] = useState<{ group: DepartmentSdsGroupDTO; fileId?: string } | null>(null)

  const totals = useMemo(() => ({
    files: groups.reduce((sum, group) => sum + group.fileCount, 0),
    published: groups.filter(group => group.status === 'published').length,
  }), [groups])

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
        description="รวมเอกสาร SDS ของแต่ละงานให้ตรวจสอบ แก้ไขชื่อ และเผยแพร่เป็นชุดได้จากพื้นที่เดียว"
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
          const unlinkedFiles = group.files.filter(file => file.registryLink.status === 'unlinked')
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
                      <Button variant="secondary" icon="plus" disabled={busy} onClick={() => setUploading({ code: group.code, department: group.department })}>
                        เพิ่ม SDS
                      </Button>
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
                  {canRegister && unlinkedFiles.length > 0 && (
                    <Button
                      variant="soft"
                      icon="flask"
                      disabled={busy}
                      onClick={() => setRegistering({ group })}
                      title="เลือกไฟล์ SDS เพื่อนำสารเข้าทะเบียน"
                    >
                      นำเข้าเป็นสารเคมี
                    </Button>
                  )}
                </div>
              </div>

              {group.fileCount === 0 && (
                <p style={{ margin: `${SPACE.xs}px 0 0`, fontSize: FONT.sm, color: 'var(--warning)' }}>
                  <Icon name="alert" size={12} /> ยังไม่มีเอกสารในระบบ — อัปโหลดไฟล์ SDS ใหม่สำหรับงานนี้ได้
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
                          {file.displayNameEdited && <Badge color="blue" size="sm" style={{ marginLeft: 6 }}>แก้ชื่อแล้ว</Badge>}
                          {file.registryLink.status === 'pending' && <Badge color="amber" size="sm" style={{ marginLeft: 6 }}>รออนุมัติ</Badge>}
                          {file.registryLink.status === 'linked' && <Badge color="green" size="sm" style={{ marginLeft: 6 }}>อยู่ในทะเบียน</Badge>}
                        </span>
                        <span style={{ display: 'flex', gap: 4 }}>
                          <Button
                            variant="ghost"
                            icon="eye"
                            title="เปิดไฟล์"
                            onClick={() => window.open(file.fileUrl, '_blank', 'noopener')}
                          />
                          {canRegister && file.registryLink.status === 'unlinked' && (
                            <Button
                              variant="ghost"
                              icon="flask"
                              size="sm"
                              title="นำเข้าเป็นสารเคมี"
                              onClick={() => setRegistering({ group, fileId: file.id })}
                            >
                              นำเข้าเป็นสารเคมี
                            </Button>
                          )}
                          {canPublish && (
                            <>
                              {file.registryLink.status !== 'linked' && (
                                <Button
                                  variant="ghost"
                                  icon="upload"
                                  size="sm"
                                  title="แทนที่ไฟล์ด้วยฉบับใหม่"
                                  onClick={() => setReplacing({ id: file.id, department: group.department, displayName: file.displayName })}
                                >
                                  แทนที่ไฟล์
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                icon="edit"
                                size="sm"
                                title="แก้ชื่อที่แสดง"
                                onClick={() => void rename(file.id, file.displayName)}
                              >
                                แก้ไขชื่อ
                              </Button>
                              {file.registryLink.status !== 'linked' && (
                                <Button
                                  variant="ghost"
                                  icon="trash"
                                  size="sm"
                                  title="ลบเอกสาร"
                                  onClick={() => void removeFile(file.id, file.displayName)}
                                >
                                  ลบ
                                </Button>
                              )}
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
      {uploading && (
        <DepartmentSdsUploadModal
          departmentCode={uploading.code}
          departmentName={uploading.department}
          onClose={() => setUploading(null)}
          onSaved={(message) => {
            setUploading(null)
            onDone(message)
          }}
        />
      )}
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
      {registering && (
        <DepartmentChemicalModal
          group={registering.group}
          initialFileId={registering.fileId}
          products={chemicalProducts}
          units={units}
          onClose={() => setRegistering(null)}
          onSaved={(message, ok) => {
            setRegistering(null)
            onDone(message, ok)
          }}
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

function DepartmentSdsUploadModal({
  departmentCode, departmentName, onClose, onSaved,
}: {
  departmentCode: string
  departmentName: string
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function selectFile(nextFile: File) {
    setFile(nextFile)
    setError(null)
    if (!displayName.trim()) setDisplayName(nextFile.name.replace(/\.pdf$/i, ''))
  }

  async function upload() {
    if (!file) { setError('กรุณาเลือกไฟล์ PDF'); return }
    if (!displayName.trim()) { setError('กรุณาระบุชื่อเอกสารที่แสดง'); return }

    setBusy(true)
    setError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('displayName', displayName.trim())
      const response = await fetch(`/api/admin/chemical-safety/department-sds/${departmentCode}/upload`, { method: 'POST', body })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'อัปโหลดไฟล์ SDS ไม่สำเร็จ')
      onSaved(payload.republishRequired
        ? 'อัปโหลดไฟล์แล้ว กรุณาเผยแพร่งานนี้อีกครั้งก่อนแสดงต่อสาธารณะ'
        : 'อัปโหลดไฟล์ SDS แล้ว')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'อัปโหลดไฟล์ SDS ไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`อัปโหลด SDS สำหรับ ${departmentName}`} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 620, boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden' }}>
        <header style={{ padding: SPACE.md, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE.sm }}>
          <div>
            <div style={{ fontSize: FONT.xs, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--primary)' }}>SDS แยกตามงาน</div>
            <h2 style={{ margin: '4px 0 0', fontSize: FONT.xl, color: 'var(--ink)' }}>อัปโหลด SDS · {departmentName}</h2>
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
            หากงานนี้เผยแพร่อยู่ ระบบจะยกเลิกการเผยแพร่ชั่วคราว เพื่อให้ตรวจรายการใหม่ก่อนกดเผยแพร่อีกครั้ง
          </p>
          {error && <p role="alert" style={{ margin: 0, padding: SPACE.xs, borderRadius: 8, fontSize: FONT.sm, color: 'var(--danger)', background: 'rgba(220,38,38,.10)' }}>{error}</p>}
        </div>

        <footer style={{ padding: SPACE.md, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: SPACE.xs }}>
          <Button variant="secondary" onClick={onClose} disabled={busy}>ยกเลิก</Button>
          <Button icon="upload" onClick={() => void upload()} disabled={busy}>{busy ? 'กำลังอัปโหลด…' : 'อัปโหลด SDS'}</Button>
        </footer>
      </div>
    </div>
  )
}
