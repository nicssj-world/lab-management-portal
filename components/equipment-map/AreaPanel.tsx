'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { EquipmentAreaDTO, EquipmentPinDTO } from '@/lib/equipment-map/types'

export interface AreaPanelProps {
  area: EquipmentAreaDTO
  /** เมื่อคลิกที่ห้อง (parent) ให้รวมเครื่องมือของโซนลูกทั้งหมดด้วย */
  pins: readonly EquipmentPinDTO[]
  canEdit: boolean
  busy: boolean
  onClose: () => void
  onSelectPin: (id: string) => void
  onRename: (nameTh: string) => void
  kindLabel?: string
  showRegistryLink?: boolean
}

export function AreaPanel({ area, pins, canEdit, busy, onClose, onSelectPin, onRename, kindLabel, showRegistryLink = true }: AreaPanelProps) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(area.nameTh)

  return (
    <aside className="equipment-area-panel">
      <button
        type="button"
        onClick={onClose}
        aria-label="ปิดแผงพื้นที่"
        style={{ position: 'absolute', right: 12, top: 12, minWidth: 44, minHeight: 44, border: 0, borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: '1.2rem', cursor: 'pointer' }}
      >×</button>

      <p className="equipment-area-kind">{kindLabel ?? (area.kind === 'zone' ? 'โซน' : 'ห้อง')}</p>
      {editing ? (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '.9rem' }}
          />
          <Button size="sm" onClick={() => { onRename(draftName); setEditing(false) }} disabled={busy || !draftName.trim()}>บันทึก</Button>
          <Button size="sm" variant="secondary" onClick={() => { setDraftName(area.nameTh); setEditing(false) }}>ยกเลิก</Button>
        </div>
      ) : (
        <h2>
          {area.nameTh}
          {canEdit ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="แก้ชื่อพื้นที่"
              style={{ marginLeft: 8, border: 0, background: 'transparent', color: 'var(--map-blue)', cursor: 'pointer', fontSize: '.8rem', verticalAlign: 'middle' }}
            >แก้ไข</button>
          ) : null}
        </h2>
      )}

      <div className="equipment-area-counts">
        <div className="equipment-area-count-tile"><b>{area.counts.total}</b><span>เครื่องมือทั้งหมด</span></div>
        <div className="equipment-area-count-tile"><b>{area.counts.overdue}</b><span>เกินกำหนด PM/CAL</span></div>
        <div className="equipment-area-count-tile"><b>{area.counts.dueSoon}</b><span>ใกล้ครบกำหนด</span></div>
        <div className="equipment-area-count-tile"><b>{area.counts.broken}</b><span>ชำรุด</span></div>
        <div className="equipment-area-count-tile"><b>{area.counts.pendingReg}</b><span>รอขึ้นทะเบียน</span></div>
        <div className="equipment-area-count-tile"><b>{area.counts.unsurveyed}</b><span>ยังไม่สำรวจ (รอบนี้)</span></div>
      </div>

      {showRegistryLink ? (
        <Button variant="secondary" full icon="arrowRight" onClick={() => window.open(`/staff/equipment?area=${area.code}`, '_blank', 'noopener')}>
          เปิดทะเบียนกรองพื้นที่นี้
        </Button>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <span style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--muted)' }}>รายการเครื่องมือ ({pins.length})</span>
        {pins.length === 0 ? (
          <p style={{ marginTop: 8, fontSize: '.8rem', color: 'var(--muted)' }}>ยังไม่มีเครื่องมือกำหนดไว้ในพื้นที่นี้</p>
        ) : (
          <div style={{ marginTop: 6 }}>
            {pins.map((pin) => (
              <div key={pin.id} className="equipment-pin-row" onClick={() => onSelectPin(pin.id)}>
                <div style={{ minWidth: 0 }}>
                  <div className="equipment-pin-row-name">{pin.name}</div>
                  <div className="equipment-pin-row-code">{pin.code ?? 'ไม่มีรหัส'}</div>
                </div>
                {!pin.placed ? <Badge color="gray" size="sm">ยังไม่ปักหมุด</Badge>
                  : pin.due === 'overdue' ? <Badge color="red" size="sm">เกินกำหนด</Badge>
                  : pin.due === 'due_soon' ? <Badge color="amber" size="sm">ใกล้ครบ</Badge>
                  : pin.status === 'ชำรุด' ? <Badge color="red" size="sm">ชำรุด</Badge>
                  : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
