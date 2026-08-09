'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import type {
  DepartmentSdsFileDTO,
  DepartmentSdsRegistryCandidateDTO,
} from '@/lib/chemical-safety/department-repository'
import { FONT, SPACE, tabularNums } from './shared/tokens'

function holdingDetail(candidate: DepartmentSdsRegistryCandidateDTO): string {
  const details: string[] = []
  if (candidate.lotNumber) details.push(`Lot ${candidate.lotNumber}`)
  if (candidate.packageValue !== null && candidate.packageUnit) {
    details.push(`${candidate.packageValue.toLocaleString('th-TH')} ${candidate.packageUnit}/ภาชนะ`)
  }
  if (candidate.currentContainerCount !== null) {
    details.push(`${candidate.currentContainerCount.toLocaleString('th-TH')} ภาชนะ`)
  }
  return details.join(' · ') || 'ไม่มีรายละเอียดล็อตหรือปริมาณ'
}

export function DepartmentSdsLinkModal({
  file,
  departmentName,
  onClose,
  onLinked,
}: {
  file: DepartmentSdsFileDTO
  departmentName: string
  onClose: () => void
  onLinked: (message: string) => void
}) {
  const availableCandidates = useMemo(
    () => file.registryLink.candidates.filter(candidate => candidate.availableToLink),
    [file.registryLink.candidates],
  )
  const [holdingId, setHoldingId] = useState(
    availableCandidates.length === 1 ? availableCandidates[0]?.holdingId ?? '' : '',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selected = file.registryLink.candidates.find(candidate => candidate.holdingId === holdingId) ?? null

  async function linkFile() {
    if (!selected?.availableToLink) {
      setError('กรุณาเลือกรายการถือครองที่ยังไม่มีไฟล์ SDS งานผูกอยู่')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/chemical-safety/department-sds/${file.id}/link-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdingId: selected.holdingId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'ผูกไฟล์กับทะเบียนไม่สำเร็จ')
      onLinked('ผูกไฟล์ SDS กับทะเบียนแล้ว')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ผูกไฟล์กับทะเบียนไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const title = `ผูกไฟล์กับทะเบียน · ${file.displayName}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto',
        borderRadius: 16, background: 'var(--card)', boxShadow: '0 20px 60px rgba(0,0,0,.25)',
      }}>
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACE.sm,
          padding: SPACE.md, borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontSize: FONT.xs, fontWeight: 700, color: 'var(--primary)', letterSpacing: '.08em' }}>
              SDS แยกตามงาน · {departmentName}
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: FONT.xl, color: 'var(--ink)' }}>ผูกไฟล์กับทะเบียน</h2>
            <p style={{ margin: '4px 0 0', fontSize: FONT.sm, color: 'var(--muted)' }}>{file.displayName}</p>
          </div>
          <Button variant="ghost" icon="x" title="ปิด" onClick={onClose} disabled={busy} />
        </header>

        <div style={{ padding: SPACE.md, display: 'grid', gap: SPACE.sm }}>
          <p style={{ margin: 0, fontSize: FONT.base, color: 'var(--muted)' }}>
            เลือกรายการถือครองเดิมที่ไฟล์นี้อ้างอิง ระบบจะสร้างเฉพาะ SDS version และลิงก์ไฟล์ โดยไม่เพิ่มสารหรือสต๊อกซ้ำ
          </p>

          <div role="radiogroup" aria-label="เลือกรายการถือครองในทะเบียน" style={{ display: 'grid', gap: SPACE.xs }}>
            {file.registryLink.candidates.map(candidate => (
              <label
                key={candidate.holdingId}
                style={{
                  display: 'flex', gap: SPACE.sm, alignItems: 'flex-start', padding: SPACE.sm,
                  border: `1px solid ${holdingId === candidate.holdingId ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 10, cursor: candidate.availableToLink && !busy ? 'pointer' : 'not-allowed',
                  opacity: candidate.availableToLink ? 1 : 0.55,
                  background: holdingId === candidate.holdingId ? 'var(--primary-soft)' : 'var(--card)',
                }}
              >
                <input
                  type="radio"
                  name="department-sds-holding"
                  value={candidate.holdingId}
                  checked={holdingId === candidate.holdingId}
                  disabled={busy || !candidate.availableToLink}
                  onChange={() => { setHoldingId(candidate.holdingId); setError(null) }}
                  style={{ marginTop: 3 }}
                />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: FONT.md, color: 'var(--ink)' }}>{candidate.productName}</strong>
                    {!candidate.availableToLink && <Badge color="gray">มีไฟล์ผูกแล้ว</Badge>}
                  </span>
                  <span style={{ display: 'block', marginTop: 4, fontSize: FONT.sm, color: 'var(--muted)', ...tabularNums }}>
                    {holdingDetail(candidate)}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {file.registryLink.candidates.length === 0 && (
            <p style={{ margin: 0, fontSize: FONT.sm, color: 'var(--warning)' }}>
              <Icon name="alert" size={13} /> ไม่พบรายการถือครองที่สามารถผูกได้
            </p>
          )}
          {availableCandidates.length === 0 && file.registryLink.candidates.length > 0 && (
            <p style={{ margin: 0, fontSize: FONT.sm, color: 'var(--warning)' }}>
              <Icon name="lock" size={13} /> รายการที่พบมีไฟล์ SDS งานผูกอยู่แล้วทั้งหมด
            </p>
          )}
          {error && <div role="alert" style={{ fontSize: FONT.sm, color: 'var(--danger)' }}>{error}</div>}
        </div>

        <footer style={{
          display: 'flex', justifyContent: 'flex-end', gap: SPACE.xs,
          padding: SPACE.md, borderTop: '1px solid var(--border)',
        }}>
          <Button variant="secondary" onClick={onClose} disabled={busy}>ยกเลิก</Button>
          <Button icon="check" onClick={() => void linkFile()} disabled={busy || !selected?.availableToLink}>
            {busy ? 'กำลังผูกไฟล์…' : 'ยืนยันการผูกไฟล์'}
          </Button>
        </footer>
      </div>
    </div>
  )
}
