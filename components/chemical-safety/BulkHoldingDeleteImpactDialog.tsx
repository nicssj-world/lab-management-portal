'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import type { ChemicalHoldingDeleteImpact } from '@/lib/chemical-safety/holding-delete'
import type { ChemicalRegistryRow } from '@/lib/chemical-safety/types'
import { FONT, SPACE } from './shared/tokens'

interface Props {
  rows: ChemicalRegistryRow[]
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

interface ImpactPayload {
  impact?: ChemicalHoldingDeleteImpact
  error?: string
}

function impactSummary(impact: ChemicalHoldingDeleteImpact) {
  const parts: string[] = []
  const sdsCount = impact.versions.filter(version => version.willDelete).length
  if (sdsCount > 0) parts.push(`SDS ${sdsCount} ฉบับ`)
  if (impact.publications.length > 0) parts.push(`การเผยแพร่ ${impact.publications.length} รายการ`)
  if (impact.departmentSds.length > 0) parts.push(`SDS ของงาน ${impact.departmentSds.length} รายการ`)
  if (impact.sharedDependencies.length > 0) parts.push(`เก็บ SDS ที่ใช้ร่วมกัน ${impact.sharedDependencies.length} รายการ`)
  return parts.length > 0 ? parts.join(' · ') : 'ไม่มีข้อมูล SDS ที่ต้องลบเพิ่มเติม'
}

export function BulkHoldingDeleteImpactDialog({ rows, busy, onCancel, onConfirm }: Props) {
  const [impacts, setImpacts] = useState<ChemicalHoldingDeleteImpact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setImpacts([])
    setLoading(true)
    setError(null)

    Promise.all(rows.map(async row => {
      const response = await fetch(`/api/admin/chemical-safety/registry/${row.holdingId}/delete`, { method: 'GET' })
      const payload = await response.json().catch(() => ({})) as ImpactPayload
      if (!response.ok && !payload.impact) {
        throw new Error(`${row.canonicalName}: ${payload.error || 'โหลดผลกระทบการลบไม่สำเร็จ'}`)
      }
      if (!payload.impact) throw new Error(`${row.canonicalName}: ไม่พบผลกระทบการลบ กรุณารีเฟรชหน้า`)
      return payload.impact
    }))
      .then(nextImpacts => {
        if (!cancelled) setImpacts(nextImpacts)
      })
      .catch(caught => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'โหลดผลกระทบการลบไม่สำเร็จ')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [retryKey, rows])

  const blockedImpacts = impacts.filter(impact => !impact.canDelete)
  const ready = !loading && !error && impacts.length === rows.length && blockedImpacts.length === 0 && !busy

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed', inset: 0, zIndex: 1200, display: 'grid', placeItems: 'center',
        padding: SPACE.md, background: 'rgba(15,23,42,.52)', backdropFilter: 'blur(3px)',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-holding-delete-title"
        aria-busy={loading || busy}
        style={{
          width: 'min(720px, 100%)', maxHeight: 'min(760px, calc(100vh - 32px))', overflow: 'auto',
          border: '1px solid var(--border)', borderRadius: 16, background: 'var(--card)',
          boxShadow: '0 24px 80px rgba(15,23,42,.28)', padding: SPACE.lg,
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.md, alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, color: 'var(--danger)', fontSize: FONT.xs, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              ลบหลายรายการ
            </p>
            <h2 id="bulk-holding-delete-title" style={{ margin: '5px 0 0', color: 'var(--ink)', fontSize: 20 }}>
              ยืนยันการลบรายการถาวร {rows.length} รายการ
            </h2>
            <p style={{ margin: '7px 0 0', color: 'var(--muted)', fontSize: FONT.sm }}>
              ระบบจะตรวจสอบผลกระทบของทุกรายการก่อนลบ
            </p>
          </div>
          <Button variant="ghost" size="sm" icon="x" title="ปิด" onClick={onCancel} disabled={busy} />
        </header>

        <div style={{ marginTop: SPACE.lg, padding: SPACE.md, borderRadius: 12, border: '1px solid color-mix(in srgb,var(--warning) 30%,var(--border))', background: 'color-mix(in srgb,var(--warning) 8%,var(--card))' }}>
          <strong style={{ display: 'block', color: 'var(--warning)', fontSize: FONT.base }}>การลบนี้ถาวรและย้อนคืนไม่ได้</strong>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: FONT.sm }}>
            แต่ละรายการจะใช้ขั้นตอนเดียวกับปุ่มลบเดี่ยว พร้อมลบ SDS และการเผยแพร่ที่เป็นของรายการนั้น ส่วน SDS ที่ยังถูกใช้ร่วมกับรายการอื่นจะเก็บไว้
          </p>
        </div>

        {loading && (
          <div role="status" style={{ marginTop: SPACE.lg, display: 'flex', alignItems: 'center', gap: SPACE.xs, color: 'var(--muted)', fontSize: FONT.sm }}>
            <Icon name="refresh" size={15} /> กำลังตรวจสอบผลกระทบของ {rows.length} รายการ…
          </div>
        )}

        {error && (
          <div role="alert" style={{ marginTop: SPACE.lg, padding: SPACE.md, borderRadius: 12, border: '1px solid color-mix(in srgb,var(--danger) 28%,var(--border))', background: 'color-mix(in srgb,var(--danger) 7%,var(--card))' }}>
            <strong style={{ display: 'block', color: 'var(--danger)', fontSize: FONT.base }}>ตรวจสอบผลกระทบการลบไม่สำเร็จ</strong>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: FONT.sm }}>{error}</p>
            <Button variant="secondary" size="sm" onClick={() => setRetryKey(current => current + 1)} style={{ marginTop: SPACE.sm }}>
              ลองตรวจสอบอีกครั้ง
            </Button>
          </div>
        )}

        {!loading && !error && (
          <section style={{ marginTop: SPACE.lg }} aria-labelledby="bulk-holding-delete-items">
            <h3 id="bulk-holding-delete-items" style={{ margin: 0, color: 'var(--ink)', fontSize: FONT.base }}>รายการที่จะลบ</h3>
            <div style={{ marginTop: SPACE.xs, maxHeight: 330, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
              {rows.map(row => {
                const impact = impacts.find(item => item.holdingId === row.holdingId)
                const isBlocked = impact ? !impact.canDelete : true
                return (
                  <div key={row.holdingId} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: isBlocked ? 'color-mix(in srgb,var(--danger) 6%,var(--card))' : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACE.sm, flexWrap: 'wrap' }}>
                      <strong style={{ color: 'var(--ink)', fontSize: FONT.sm }}>{row.canonicalName}</strong>
                      <span style={{ color: 'var(--muted)', fontSize: FONT.xs }}>{row.storageScope === 'room' ? 'ห้องเก็บสารเคมี' : row.unitName}</span>
                    </div>
                    <div style={{ marginTop: 3, color: isBlocked ? 'var(--danger)' : 'var(--muted)', fontSize: FONT.xs }}>
                      {impact ? (isBlocked ? 'ยังลบไม่ได้ · ตรวจสอบ SDS ที่ใช้ร่วมกัน' : impactSummary(impact)) : 'ยังตรวจสอบไม่เสร็จ'}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {blockedImpacts.length > 0 && (
          <div role="alert" style={{ marginTop: SPACE.md, padding: SPACE.md, borderRadius: 12, border: '1px solid color-mix(in srgb,var(--danger) 28%,var(--border))', background: 'color-mix(in srgb,var(--danger) 7%,var(--card))' }}>
            <strong style={{ display: 'block', color: 'var(--danger)', fontSize: FONT.base }}>ยังลบชุดนี้ไม่ได้</strong>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: FONT.sm }}>มีรายการที่มีข้อจำกัดจาก SDS ที่ใช้ร่วมกัน กรุณาลบรายการที่ติดข้อจำกัดออกจากการเลือกก่อน</p>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: 'var(--ink)', fontSize: FONT.sm }}>
              {blockedImpacts.map(impact => <li key={impact.holdingId}>{impact.productName} · {impact.unitName}</li>)}
            </ul>
          </div>
        )}

        <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACE.sm, marginTop: SPACE.lg }}>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>ยกเลิก</Button>
          <Button variant="danger" onClick={onConfirm} disabled={!ready}>
            {busy ? 'กำลังลบ…' : `ยืนยันลบ ${rows.length} รายการถาวร`}
          </Button>
        </footer>
      </section>
    </div>
  )
}
