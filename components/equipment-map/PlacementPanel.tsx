'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { paginatePlacementItems } from '@/lib/equipment-map/placement-pagination'
import type { EquipmentAreaDTO, EquipmentUnplacedDTO } from '@/lib/equipment-map/types'

export interface PlacementPanelProps {
  items: readonly EquipmentUnplacedDTO[]
  areas: readonly EquipmentAreaDTO[]
  placingId: string | null
  busy: boolean
  onClose: () => void
  onCategorize: (id: string, areaCode: string) => void
  onViewDetails: (id: string) => void
  onStartPlacement: (id: string) => void
  onCancelPlacement: () => void
}

export function PlacementPanel({ items, areas, placingId, busy, onClose, onCategorize, onViewDetails, onStartPlacement, onCancelPlacement }: PlacementPanelProps) {
  const [requestedPage, setRequestedPage] = useState(1)
  const selectableAreas = areas.filter((area) => area.isActive)
  const { items: pageItems, page, pageCount, from, to } = paginatePlacementItems(items, requestedPage)

  return (
    <aside className="equipment-area-panel equipment-placement-panel">
      <button
        type="button"
        onClick={onClose}
        aria-label="ปิดรายการเครื่องมือที่ยังไม่กำหนดตำแหน่ง"
        style={{ position: 'absolute', right: 12, top: 12, minWidth: 44, minHeight: 44, border: 0, borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: '1.2rem', cursor: 'pointer' }}
      >×</button>
      <p className="equipment-area-kind">รายงาน</p>
      <h2>เครื่องมือที่ยังไม่กำหนดตำแหน่ง ({items.length})</h2>
      <div className="equipment-placement-back">
        <Button variant="secondary" icon="arrowLeft" onClick={onClose} full>
          กลับไปแผนผังเครื่องมือ
        </Button>
      </div>

      {placingId ? (
        <div style={{ background: 'var(--primary-soft)', borderRadius: 10, padding: '10px 12px', margin: '12px 0', fontSize: '.82rem' }}>
          กำลังวางหมุด — คลิกตำแหน่งบนแผนที่ (ต้องอยู่ในห้องหรือโซนที่มีบนแผนที่)
          <div style={{ marginTop: 8 }}>
            <Button size="sm" variant="secondary" onClick={onCancelPlacement}>ยกเลิก</Button>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState title="ไม่พบรายการ" hint="ไม่มีเครื่องมือที่ตรงกับตัวกรองนี้" icon="search" />
      ) : (
        <div className="equipment-placement-content">
          <div className="equipment-placement-pagination" aria-label="การแบ่งหน้ารายการเครื่องมือ">
            <span>แสดง {from}–{to} จาก {items.length} รายการ</span>
            {pageCount > 1 ? (
              <div>
                <Button size="sm" variant="secondary" icon="arrowLeft" disabled={page === 1} onClick={() => setRequestedPage(page - 1)}>
                  ก่อนหน้า
                </Button>
                <b>หน้า {page}/{pageCount}</b>
                <Button size="sm" variant="secondary" iconRight="arrowRight" disabled={page === pageCount} onClick={() => setRequestedPage(page + 1)}>
                  ถัดไป
                </Button>
              </div>
            ) : null}
          </div>
          <div className="equipment-placement-list">
            {pageItems.map((item) => (
              <div key={item.id} className="equipment-placement-item">
                <h4>
                  <button type="button" className="equipment-placement-name" onClick={() => onViewDetails(item.id)}>
                    {item.name}
                  </button>
                </h4>
                <p>{item.code ?? 'ไม่มีรหัส LAB'} · {item.department} · {item.classification ? `Classification ${item.classification}` : 'ยังไม่ระบุ Classification'}</p>
                <div className="equipment-placement-actions">
                  <select
                    className="equipment-placement-select"
                    defaultValue={item.areaCode ?? ''}
                    disabled={busy || placingId === item.id}
                    onChange={(event) => { if (event.target.value) onCategorize(item.id, event.target.value) }}
                  >
                    <option value="">เลือกห้อง/โซน…</option>
                    {selectableAreas.map((area) => (
                      <option key={area.code} value={area.code}>{area.kind === 'zone' ? '— ' : ''}{area.nameTh}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant={placingId === item.id ? 'primary' : 'secondary'}
                    icon="chart"
                    disabled={busy || (placingId !== null && placingId !== item.id)}
                    onClick={() => onStartPlacement(item.id)}
                  >{placingId === item.id ? 'กำลังวางหมุด…' : 'ปักหมุด'}</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
