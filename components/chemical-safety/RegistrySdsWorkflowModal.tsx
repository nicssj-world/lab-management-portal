'use client'

import { useMemo, useState } from 'react'
import { Badge, type BadgeColor } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { ChemicalProductDTO, ChemicalRegistryRow, ChemicalSdsDTO } from '@/lib/chemical-safety/types'
import { SdsEditorModal } from './SdsEditorModal'
import { FONT, SPACE } from './shared/tokens'

const PUBLICATION_LABELS = {
  unlinked: 'ยังไม่มี SDS',
  ready: 'พร้อมเชื่อม',
  active: 'เผยแพร่แล้ว',
  stale: 'ต้องเชื่อมฉบับใหม่',
} as const

function versionLabel(item: ChemicalSdsDTO | null) {
  if (!item) return 'ยังไม่มี SDS'
  if (item.status === 'draft') return 'ฉบับร่าง'
  if (item.status === 'in_review') return 'รอทบทวน'
  if (item.status === 'approved') return 'อนุมัติแล้ว'
  if (item.status === 'rejected') return 'ไม่อนุมัติ'
  return 'ถูกแทนที่'
}

function statusColor(status: ChemicalSdsDTO['status'] | undefined): BadgeColor {
  if (status === 'approved') return 'green'
  if (status === 'in_review') return 'amber'
  if (status === 'rejected') return 'red'
  if (status === 'draft') return 'blue'
  return 'gray'
}

export function RegistrySdsWorkflowModal({
  row, product, items, actorId, canEdit, canReview, onClose, onDone,
}: {
  row: ChemicalRegistryRow
  product?: ChemicalProductDTO
  items: ChemicalSdsDTO[]
  actorId: string
  canEdit: boolean
  canReview: boolean
  onClose: () => void
  onDone: (message: string, ok?: boolean) => void
}) {
  const [createdDraft, setCreatedDraft] = useState<ChemicalSdsDTO | null>(null)
  const [editing, setEditing] = useState<ChemicalSdsDTO | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const productVersions = useMemo(
    () => items.filter(item => item.productId === row.productId),
    [items, row.productId],
  )
  const ownVersion = createdDraft ?? productVersions.find(item => (
    item.sourceHoldingId === row.holdingId
    && ['draft', 'in_review', 'rejected'].includes(item.status)
  )) ?? null
  const approvedVersions = productVersions.filter(item => item.status === 'approved' && item.fileId)
  const approved = approvedVersions[0] ?? null
  const current = ownVersion ?? approved
  const destinationLabel = row.publicationDestination === 'room'
    ? 'SDS ห้องสารเคมี · เปิดสาธารณะทันทีหลังเชื่อม'
    : `SDS แยกตามงาน · ${row.unitName} · รอเผยแพร่ทั้งชุดหลังเชื่อม`

  async function action(path: string, body: unknown, success: string) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || payload.message || 'ดำเนินการไม่สำเร็จ')
      onDone(success)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ดำเนินการไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  async function createDraft() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/chemical-safety/sds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdingId: row.holdingId, language: 'th' }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'สร้างฉบับร่าง SDS ไม่สำเร็จ')
      const timestamp = new Date().toISOString()
      const draft: ChemicalSdsDTO = {
        id: String(payload.id), productId: row.productId, sourceHoldingId: row.holdingId,
        workflowOrigin: 'registry_v2', fileId: null, sourceUrl: null, fileUrl: null,
        manufacturer: product?.manufacturer ?? null, supplier: product?.supplier ?? null,
        productCode: product?.productCode ?? null, concentration: row.concentration,
        language: 'th', revisionLabel: null, effectiveOn: null, reviewDueOn: null,
        signalWord: null, pictogramCodes: [], hStatements: [], pStatements: [],
        storageInstructions: null, incompatibilities: null, emergencySummary: null,
        status: 'draft', submittedBy: null, submittedAt: null, reviewedBy: null,
        reviewedAt: null, reviewReason: null, createdBy: actorId,
        createdAt: String(payload.createdAt ?? timestamp), updatedAt: String(payload.updatedAt ?? timestamp),
        hazards: [],
      }
      setCreatedDraft(draft)
      setEditing(draft)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'สร้างฉบับร่าง SDS ไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  function reject(version: ChemicalSdsDTO) {
    const reason = window.prompt('เหตุผลที่ไม่อนุมัติ')
    if (reason === null) return
    if (!reason.trim()) { setError('กรุณาระบุเหตุผลที่ไม่อนุมัติ'); return }
    void action(`/api/admin/chemical-safety/sds/${version.id}/review`, {
      decision: 'rejected', reason: reason.trim(),
    }, 'บันทึกผลไม่อนุมัติแล้ว')
  }

  if (editing) {
    return (
      <SdsEditorModal
        sds={editing}
        productName={row.canonicalName}
        seed={{
          pictogramCodes: row.pictogramCodes,
          hazardClassesTh: row.hazards.map(hazard => hazard.className),
        }}
        onClose={() => setEditing(null)}
        onSaved={(message, ok) => {
          onDone(message, ok)
          onClose()
        }}
      />
    )
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`SDS ของ ${row.canonicalName}`} style={{
      position: 'fixed', inset: 0, zIndex: 1000, padding: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.5)',
    }}>
      <div style={{ width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'auto', borderRadius: 16, background: 'var(--card)', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.sm, padding: SPACE.md, borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ color: 'var(--primary)', fontSize: FONT.xs, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Registry-first SDS workflow</div>
            <h2 style={{ margin: '4px 0 0', color: 'var(--ink)', fontSize: FONT.xl }}>{row.canonicalName}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: FONT.sm }}>{row.unitName}</p>
          </div>
          <Button variant="ghost" icon="x" title="ปิด" onClick={onClose} disabled={busy} />
        </header>

        <div style={{ display: 'grid', gap: SPACE.md, padding: SPACE.md }}>
          <section style={{ padding: SPACE.sm, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, flexWrap: 'wrap' }}>
              <Badge color={statusColor(current?.status)}>{versionLabel(current)}</Badge>
              <span aria-hidden="true">→</span>
              <Badge color={row.publicationStatus === 'active' ? 'green' : row.publicationStatus === 'stale' ? 'amber' : 'blue'}>
                {PUBLICATION_LABELS[row.publicationStatus]}
              </Badge>
            </div>
            <p style={{ margin: `${SPACE.xs}px 0 0`, color: 'var(--muted)', fontSize: FONT.sm, lineHeight: 1.55 }}>
              ขั้นตอน: ยังไม่มี SDS → ฉบับร่าง → รอทบทวน → อนุมัติแล้ว → พร้อมเชื่อม → เผยแพร่แล้ว/ต้องเชื่อมฉบับใหม่
            </p>
          </section>

          <section>
            <h3 style={{ margin: `0 0 ${SPACE.xs}px`, color: 'var(--ink)', fontSize: FONT.md }}>ปลายทางเผยแพร่</h3>
            <div style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--ink)', fontSize: FONT.sm }}>
              {destinationLabel}
            </div>
            <p style={{ margin: '5px 0 0', color: 'var(--muted)', fontSize: FONT.xs }}>ระบบคำนวณปลายทางจากประเภทจัดเก็บ แก้ไขจากหน้าต่างนี้ไม่ได้</p>
          </section>

          {approvedVersions.length > 0 && (
            <section>
              <h3 style={{ margin: `0 0 ${SPACE.xs}px`, color: 'var(--ink)', fontSize: FONT.md }}>SDS ที่อนุมัติแล้วของ product เดียวกัน</h3>
              <div style={{ display: 'grid', gap: SPACE.xs }}>
                {approvedVersions.map(version => (
                  <div key={version.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: SPACE.xs, padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <span style={{ fontSize: FONT.sm }}>{version.revisionLabel || 'ไม่ระบุฉบับ'} · {version.language || 'th'}</span>
                    {canEdit && row.publicationStatus !== 'active' && (
                      <Button size="sm" icon="check" disabled={busy} onClick={() => void action(
                        `/api/admin/chemical-safety/registry/${row.holdingId}/sds-publication`,
                        { sdsVersionId: version.id },
                        row.publicationDestination === 'room' ? 'เชื่อมและเผยแพร่ SDS ห้องสารเคมีแล้ว' : 'เชื่อม SDS แล้ว กรุณาเผยแพร่ทั้งชุดของงาน',
                      )}>
                        {row.publicationStatus === 'stale' ? 'เชื่อมฉบับใหม่' : 'ใช้ซ้ำและเชื่อม'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section style={{ display: 'flex', gap: SPACE.xs, flexWrap: 'wrap' }}>
            {canEdit && (!ownVersion || ownVersion.status === 'rejected') && (
              <Button icon="plus" disabled={busy} onClick={() => void createDraft()}>
                {approved ? 'สร้างฉบับแก้ไขใหม่' : 'สร้างฉบับร่าง SDS'}
              </Button>
            )}
            {canEdit && ownVersion?.status === 'draft' && (
              <>
                <Button variant="secondary" icon="edit" disabled={busy} onClick={() => setEditing(ownVersion)}>แก้ไข/แนบไฟล์</Button>
                <Button icon="arrowRight" disabled={busy || !ownVersion.fileId} title={!ownVersion.fileId ? 'ต้องแนบไฟล์ PDF ก่อนส่งทบทวน' : undefined} onClick={() => void action(
                  `/api/admin/chemical-safety/sds/${ownVersion.id}/submit`, {}, 'ส่ง SDS ให้ผู้ทบทวนแล้ว',
                )}>ส่งทบทวน</Button>
              </>
            )}
            {canReview && ownVersion?.status === 'in_review' && ownVersion.submittedBy !== actorId && (
              <>
                <Button icon="check" disabled={busy} onClick={() => void action(
                  `/api/admin/chemical-safety/sds/${ownVersion.id}/review`, { decision: 'approved', reason: '' }, 'อนุมัติ SDS แล้ว',
                )}>อนุมัติ</Button>
                <Button variant="danger" icon="x" disabled={busy} onClick={() => reject(ownVersion)}>ไม่อนุมัติ</Button>
              </>
            )}
            {canReview && ownVersion?.status === 'in_review' && ownVersion.submittedBy === actorId && (
              <span style={{ color: 'var(--warning)', fontSize: FONT.sm }}>ผู้ส่งไม่สามารถอนุมัติรายการของตนเอง</span>
            )}
          </section>

          {error && <p role="alert" style={{ margin: 0, padding: SPACE.xs, borderRadius: 8, color: 'var(--danger)', background: 'rgba(220,38,38,.1)', fontSize: FONT.sm }}>{error}</p>}
        </div>

        <footer style={{ display: 'flex', justifyContent: 'flex-end', padding: SPACE.md, borderTop: '1px solid var(--border)' }}>
          <Button variant="secondary" onClick={onClose} disabled={busy}>ปิด</Button>
        </footer>
      </div>
    </div>
  )
}

