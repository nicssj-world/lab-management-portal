'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { EquipmentAreaDTO, EquipmentPinDTO } from '@/lib/equipment-map/types'
import type { PmCalDueState } from '@/lib/equipment/pm-cal-due'
import { isEquipmentAreaSelectable } from '@/lib/equipment-map/walk-groups'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const DUE_BADGE: Record<PmCalDueState, { label: string; color: 'green' | 'amber' | 'red' | 'gray' }> = {
  ok: { label: 'ปกติ', color: 'green' },
  due_soon: { label: 'ใกล้ครบกำหนด PM/CAL', color: 'amber' },
  overdue: { label: 'เกินกำหนด PM/CAL', color: 'red' },
  unplanned: { label: 'ยังไม่วางแผน PM/CAL', color: 'gray' },
  not_required: { label: 'ไม่ต้องสอบเทียบ', color: 'gray' },
}

export interface EquipmentPinDialogProps {
  pin: EquipmentPinDTO
  areas: readonly EquipmentAreaDTO[]
  areaNameTh: string
  canEdit: boolean
  hasActiveRound: boolean
  busy: boolean
  onClose: () => void
  onToggleSurveyed: (surveyed: boolean) => void
  onStartMove: () => void
  onOpenPmCal: (id: string) => void
  onRemoveFromMap: () => void
  onMoveToArea: (areaCode: string) => void
  onRotate: (rotation: number) => void
}

export function EquipmentPinDialog({ pin, areas, areaNameTh, canEdit, hasActiveRound, busy, onClose, onToggleSurveyed, onStartMove, onOpenPmCal, onRemoveFromMap, onMoveToArea, onRotate }: EquipmentPinDialogProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [selectedAreaCode, setSelectedAreaCode] = useState(pin.areaCode)
  const close = useCallback(() => onClose(), [onClose])

  useEffect(() => { setSelectedAreaCode(pin.areaCode) }, [pin.areaCode])

  useEffect(() => {
    const controller = new AbortController()
    setPhotoUrl(null)
    fetch(`/api/admin/equipment/${pin.id}/photo`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.url) setPhotoUrl(data.url) })
      .catch(() => {})
    return () => controller.abort()
  }, [pin.id])

  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null
    const { body } = document
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel
    first?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.stopPropagation(); close(); return }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.offsetParent !== null)
      if (focusable.length === 0) return
      const firstElement = focusable[0]
      const lastElement = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === firstElement) { event.preventDefault(); lastElement.focus() }
      else if (!event.shiftKey && document.activeElement === lastElement) { event.preventDefault(); firstElement.focus() }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      body.style.overflow = previousOverflow
      openerRef.current?.focus()
    }
  }, [close])

  const due = DUE_BADGE[pin.due]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 420, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p style={{ margin: 0, color: 'var(--muted)', fontFamily: '"DM Mono", monospace', fontSize: '.62rem', letterSpacing: '.1em' }}>{pin.code ?? 'ยังไม่มีรหัส LAB'}</p>
            <h2 id={titleId} style={{ margin: '4px 0 0', fontSize: '1.05rem' }}>{pin.name}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.78rem' }}>{pin.department} · {areaNameTh}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="ปิด"
            data-autofocus
            style={{ flex: '0 0 auto', minWidth: 44, minHeight: 44, border: '1px solid var(--border)', borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: '1.2rem', cursor: 'pointer' }}
          >×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={`รูปถ่าย ${pin.name}`}
              style={{ display: 'block', width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', padding: 8 }}
            />
          ) : null}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Badge color={pin.status === 'ชำรุด' ? 'red' : pin.status === 'Active' ? 'green' : 'gray'}>{pin.status}</Badge>
            {pin.riskLevel ? <Badge color={pin.riskLevel === 'High' ? 'red' : pin.riskLevel === 'Medium' ? 'amber' : 'gray'}>ความเสี่ยง {pin.riskLevel}</Badge> : null}
            {pin.pendingRegistration ? <Badge color="amber">รอขึ้นทะเบียน</Badge> : null}
            <Badge color={due.color}>{due.label}</Badge>
          </div>

          {pin.responsiblePerson ? (
            <p style={{ margin: 0, fontSize: '.82rem', color: 'var(--muted)' }}>ผู้รับผิดชอบ: {pin.responsiblePerson}</p>
          ) : null}

          {canEdit ? (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <label style={{ display: 'block', fontSize: '.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
                ย้ายห้อง/โซน
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={selectedAreaCode}
                  disabled={busy}
                  onChange={(event) => setSelectedAreaCode(event.target.value)}
                  style={{ flex: 1, minWidth: 0, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)', font: 'inherit', fontSize: '.78rem', padding: '0 8px' }}
                >
                  {areas.filter((area) => area.isActive && isEquipmentAreaSelectable(area.code)).map((area) => (
                    <option key={area.code} value={area.code}>{area.kind === 'zone' ? '— ' : ''}{area.nameTh}</option>
                  ))}
                </select>
                <Button size="sm" variant="secondary" icon="arrowRight" disabled={busy || selectedAreaCode === pin.areaCode} onClick={() => onMoveToArea(selectedAreaCode)}>
                  ย้าย
                </Button>
              </div>
            </div>
          ) : null}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <span style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--muted)' }}>การสำรวจรอบนี้</span>
            {hasActiveRound ? (
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <Button
                  variant={pin.surveyed ? 'primary' : 'secondary'}
                  size="sm"
                  icon="check"
                  disabled={busy || !canEdit}
                  onClick={() => onToggleSurveyed(true)}
                >สำรวจแล้ว</Button>
                <Button
                  variant={!pin.surveyed ? 'danger' : 'secondary'}
                  size="sm"
                  icon="x"
                  disabled={busy || !canEdit}
                  onClick={() => onToggleSurveyed(false)}
                >ยังไม่สำรวจ</Button>
              </div>
            ) : (
              <p style={{ margin: '6px 0 0', fontSize: '.78rem', color: 'var(--muted)' }}>ไม่มีรอบสำรวจที่เปิดอยู่ในขณะนี้</p>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <Button
              variant="secondary"
              size="sm"
              icon="arrowRight"
              disabled={busy}
              onClick={() => onOpenPmCal(pin.id)}
            >ดู PM/CAL</Button>
            {canEdit ? (
              <>
                <Button variant="secondary" size="sm" icon="edit" onClick={onStartMove}>ย้ายตำแหน่ง</Button>
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => onRotate((pin.rotation + 90) % 360)}>หมุน 90°</Button>
                <span style={{ marginLeft: 'auto' }}>
                  <Button variant="danger" size="sm" icon="trash" disabled={busy} onClick={onRemoveFromMap}>เอาออกจากแผนผัง</Button>
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
