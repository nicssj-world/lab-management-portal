'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import type { ChemicalChangeRequestListItemDTO } from '@/lib/chemical-safety/types'
import { FONT, SPACE } from './shared/tokens'

const ENTITY_LABEL: Record<string, string> = {
  new_chemical: 'เพิ่มสารเคมีใหม่',
  department_chemical: 'เพิ่มสารจาก SDS งาน',
  product: 'แก้ไขข้อมูลสาร',
  holding: 'แก้ไขคลัง',
}

function summarize(item: ChemicalChangeRequestListItemDTO): string {
  const data = item.proposedData
  if (item.entityType === 'new_chemical' || item.entityType === 'department_chemical' || item.entityType === 'product') {
    const parts = [
      typeof data.casNumber === 'string' ? `CAS ${data.casNumber}` : null,
      typeof data.lifecycleStatus === 'string'
        ? data.lifecycleStatus === 'retired' ? 'Inactive' : 'Active'
        : null,
    ].filter(Boolean)
    return parts.join(' · ')
  }
  const parts = [
    typeof data.packageValue === 'number' && typeof data.packageUnit === 'string'
      ? `${data.packageValue} ${data.packageUnit} × ${typeof data.currentContainerCount === 'number' ? data.currentContainerCount : '?'}`
      : null,
    typeof data.calculatedTotalValue === 'number' && typeof data.calculatedTotalUnit === 'string'
      ? `= ${data.calculatedTotalValue} ${data.calculatedTotalUnit}`
      : null,
  ].filter(Boolean)
  return parts.join(' · ')
}

export function ChangeRequestPanel({
  items, actorId, canPropose, canReview, onDone,
}: {
  items: ChemicalChangeRequestListItemDTO[]
  actorId: string
  canPropose: boolean
  canReview: boolean
  onDone: (message: string, ok?: boolean) => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)

  if (items.length === 0) return null

  async function submitDraft(id: string) {
    setBusyId(id)
    try {
      const response = await fetch(`/api/admin/chemical-safety/change-requests/${id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'ส่งทบทวนไม่สำเร็จ')
      onDone('ส่งทบทวนแล้ว')
    } catch (caught) {
      onDone(caught instanceof Error ? caught.message : 'ส่งทบทวนไม่สำเร็จ', false)
    } finally {
      setBusyId(null)
    }
  }

  async function review(id: string, decision: 'approved' | 'rejected') {
    let reason = ''
    if (decision === 'rejected') {
      const entered = window.prompt('เหตุผลที่ไม่อนุมัติ')
      if (entered === null) return
      if (entered.trim() === '') { onDone('กรุณาระบุเหตุผลที่ไม่อนุมัติ', false); return }
      reason = entered.trim()
    }
    setBusyId(id)
    try {
      const response = await fetch(`/api/admin/chemical-safety/change-requests/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'ดำเนินการไม่สำเร็จ')
      onDone(decision === 'approved' ? 'อนุมัติแล้ว' : 'บันทึกผลไม่อนุมัติแล้ว')
    } catch (caught) {
      onDone(caught instanceof Error ? caught.message : 'ดำเนินการไม่สำเร็จ', false)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card padding={SPACE.md} style={{ marginBottom: SPACE.md, borderLeft: '4px solid var(--warning)' }}>
      <h2 style={{ margin: `0 0 ${SPACE.sm}px`, fontSize: FONT.lg, color: 'var(--ink)' }}>
        <Icon name="clock" size={15} /> รายการรอทบทวน ({items.length})
      </h2>
      <div style={{ display: 'grid', gap: SPACE.xs }}>
        {items.map(item => {
          const busy = busyId === item.id
          const isDraft = item.status === 'draft'
          const isOwnSubmission = item.submittedBy === actorId
          return (
            <div key={item.id} style={{
              display: 'flex', justifyContent: 'space-between', gap: SPACE.sm, flexWrap: 'wrap',
              alignItems: 'center', padding: SPACE.sm, borderRadius: 10, background: 'var(--surface-2)',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge color="blue">{ENTITY_LABEL[item.entityType] ?? item.entityType}</Badge>
                  <Badge color={isDraft ? 'gray' : 'amber'}>{isDraft ? 'ฉบับร่าง' : 'รอทบทวน'}</Badge>
                  <b style={{ fontSize: FONT.md }}>{item.productName ?? 'ไม่ทราบชื่อสาร'}</b>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: FONT.sm, color: 'var(--muted)' }}>
                  {item.unitName}{summarize(item) ? ` · ${summarize(item)}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: SPACE.xs }}>
                {isDraft && canPropose && (
                  <Button icon="arrowRight" size="sm" disabled={busy} onClick={() => void submitDraft(item.id)}>
                    ส่งทบทวน
                  </Button>
                )}
                {!isDraft && canReview && (
                  isOwnSubmission ? (
                    <span style={{ fontSize: FONT.sm, color: 'var(--muted)', alignSelf: 'center' }}>
                      <Icon name="lock" size={12} /> ผู้ส่งไม่สามารถทบทวนเอง
                    </span>
                  ) : (
                    <>
                      <Button size="sm" icon="check" disabled={busy} onClick={() => void review(item.id, 'approved')}>อนุมัติ</Button>
                      <Button size="sm" variant="danger" icon="x" disabled={busy} onClick={() => void review(item.id, 'rejected')}>ไม่อนุมัติ</Button>
                    </>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
