'use client'

import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { GhsPictogram } from '../GhsPictogram'
import type { GhsPictogramCode } from '@/lib/chemical-safety/types'
import {
  DEPARTMENT_PUBLISH_META,
  FONT,
  GHS_SOURCE_META,
  SPACE,
  sdsStateMeta,
  sdsStatusMeta,
  zoneColor,
} from './tokens'

// ── ตัวบ่งชี้: สี + ข้อความ/ไอคอน เสมอ ห้ามสีอย่างเดียว ─────────────────────

export function SdsStatusBadge({ status }: { status?: string | null }) {
  const meta = sdsStatusMeta(status)
  return (
    <Badge color={meta.tone}>
      <Icon name={meta.icon} size={12} />
      {meta.label}
    </Badge>
  )
}

export function SdsStateBadge({ state }: { state?: string | null }) {
  const meta = sdsStateMeta(state)
  return (
    <Badge color={meta.tone}>
      <Icon name={meta.icon} size={12} />
      {meta.label}
    </Badge>
  )
}

export function DepartmentPublishBadge({ status }: { status: 'draft' | 'published' }) {
  const meta = DEPARTMENT_PUBLISH_META[status]
  return (
    <Badge color={meta.tone}>
      <Icon name={meta.icon} size={12} />
      {meta.label}
    </Badge>
  )
}

export function GhsSourceBadge({ source }: { source: 'sds' | 'masterlist' }) {
  const meta = GHS_SOURCE_META[source]
  return <Badge color={meta.tone} size="sm" style={{ cursor: 'help' }}><span title={meta.hint}>{meta.label}</span></Badge>
}

/**
 * แถวสัญลักษณ์ GHS
 * สารที่จำแนกแล้วแต่ไม่มีสัญลักษณ์ (เช่น "ของแข็งไม่กำหนดประเภท") ต้องไม่กลายเป็นช่องว่าง
 * มิฉะนั้นจะแยกไม่ออกจากสารที่ยังไม่เคยจำแนก
 */
export function GhsRow({
  codes,
  hazardClassesTh = [],
  size = 40,
}: {
  codes: GhsPictogramCode[]
  hazardClassesTh?: string[]
  size?: number
}) {
  if (codes.length > 0) {
    return (
      <div style={{ display: 'flex', gap: SPACE.xs, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {codes.map(code => <GhsPictogram key={code} code={code} size={size} />)}
      </div>
    )
  }
  if (hazardClassesTh.length > 0) {
    return (
      <span style={{ fontSize: FONT.sm, color: 'var(--muted)' }}>
        {hazardClassesTh.join(' · ')} (ไม่มีสัญลักษณ์กำกับ)
      </span>
    )
  }
  return <span style={{ fontSize: FONT.sm, color: 'var(--muted)' }}>ยังไม่ได้จำแนก</span>
}

/** ป้ายตำแหน่งจัดเก็บ — จุดสีมาพร้อมรหัสตู้เสมอ */
export function PositionChip({ code, zoneCode }: { code?: string | null; zoneCode?: string | null }) {
  if (!code) return <span style={{ color: 'var(--muted)' }}>—</span>
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 9px', borderRadius: 999, background: 'var(--surface-2)',
        fontSize: FONT.sm, fontWeight: 700, color: 'var(--ink)',
      }}
    >
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: zoneColor(zoneCode) }} />
      {code}
    </span>
  )
}

/** คำเตือนปริมาณไม่ตรง — สี + ไอคอน + ข้อความ */
export function QuantityConflictNote({ compact = false }: { compact?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--danger)', fontSize: FONT.sm, fontWeight: 700 }}>
      <Icon name="alert" size={13} />
      {compact ? 'ปริมาณไม่ตรง' : 'ปริมาณรวมไม่ตรงกับที่คำนวณได้ ต้องตรวจสอบ'}
    </span>
  )
}

/** การ์ดตู้ 1 ใบ — ใช้ทั้งฝั่งเจ้าหน้าที่และหน้าสาธารณะ */
export function ZoneCabinetCard({
  code,
  zoneCode,
  chemicals,
  onSelect,
  footer,
}: {
  code: string
  zoneCode: string
  chemicals: Array<{ key: string; name: string; note?: ReactNode }>
  onSelect?: () => void
  footer?: ReactNode
}) {
  const color = zoneColor(zoneCode)
  const body = (
    <>
      <header
        style={{
          padding: '9px 14px', background: color, color: '#fff',
          fontWeight: 800, fontSize: FONT.md, letterSpacing: '.02em',
        }}
      >
        {code}
      </header>
      <div style={{ padding: SPACE.sm, flex: 1 }}>
        {chemicals.length === 0 ? (
          <span style={{ fontSize: FONT.sm, color: 'var(--muted)' }}>ยังไม่มีรายการ</span>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, fontSize: FONT.base, color: 'var(--ink)' }}>
            {chemicals.map(item => (
              <li key={item.key}>
                {item.name}
                {item.note}
              </li>
            ))}
          </ul>
        )}
        {footer}
      </div>
    </>
  )

  const style = {
    display: 'flex', flexDirection: 'column' as const, minHeight: 148,
    border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden',
    background: 'var(--card)', textAlign: 'left' as const, padding: 0,
    font: 'inherit', color: 'var(--ink)',
  }

  if (!onSelect) return <div style={style}>{body}</div>

  return (
    <button
      type="button"
      onClick={onSelect}
      className="chem-cabinet-button"
      style={{ ...style, cursor: 'pointer' }}
    >
      <style>{`
        .chem-cabinet-button{transition:border-color .18s ease,box-shadow .18s ease}
        .chem-cabinet-button:hover{border-color:var(--primary);box-shadow:0 8px 24px rgba(15,23,42,.08)}
        .chem-cabinet-button:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}
        @media(prefers-reduced-motion:reduce){.chem-cabinet-button{transition:none}}
      `}</style>
      {body}
    </button>
  )
}
