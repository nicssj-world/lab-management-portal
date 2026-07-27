'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { EquipmentActiveRoundDTO } from '@/lib/equipment-map/types'

export interface SurveyRoundBarProps {
  activeRound: EquipmentActiveRoundDTO | null
  canEdit: boolean
  busy: boolean
  onOpenRound: (nameTh: string) => void
  onCloseRound: () => void
}

export function SurveyRoundBar({ activeRound, canEdit, busy, onOpenRound, onCloseRound }: SurveyRoundBarProps) {
  const [opening, setOpening] = useState(false)
  const [nameTh, setNameTh] = useState('')

  if (!canEdit && !activeRound) return null

  return (
    <div className="equipment-survey-bar">
      {activeRound ? (
        <>
          <span className="equipment-survey-bar-info">
            รอบสำรวจปัจจุบัน: <strong>{activeRound.nameTh}</strong> (เริ่ม {new Date(activeRound.startedAt).toLocaleDateString('th-TH')})
          </span>
          {canEdit ? <Button size="sm" variant="secondary" disabled={busy} onClick={onCloseRound}>ปิดรอบสำรวจ</Button> : null}
        </>
      ) : opening ? (
        <>
          <input
            value={nameTh}
            onChange={(event) => setNameTh(event.target.value)}
            placeholder="ชื่อรอบสำรวจ เช่น รอบสำรวจ ก.ค. 2569"
            style={{ flex: '1 1 260px', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '.82rem' }}
          />
          <Button size="sm" disabled={busy || !nameTh.trim()} onClick={() => { onOpenRound(nameTh.trim()); setOpening(false); setNameTh('') }}>เปิดรอบ</Button>
          <Button size="sm" variant="secondary" onClick={() => setOpening(false)}>ยกเลิก</Button>
        </>
      ) : (
        <>
          <span className="equipment-survey-bar-info">ยังไม่มีรอบสำรวจที่เปิดอยู่</span>
          <Button size="sm" disabled={busy} onClick={() => setOpening(true)}>เปิดรอบสำรวจใหม่</Button>
        </>
      )}
    </div>
  )
}
