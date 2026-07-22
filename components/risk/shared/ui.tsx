'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import {
  FONT, LEVEL_LABEL, LEVEL_TONE, SEVERITY_DESCRIPTIONS, SPACE,
  severityTone, statusMeta, tabularNums,
  type RiskLevel, type SeverityLetter, type StatusMeta,
} from './tokens'

// ── ตัวบ่งชี้: สี + ตัวอักษร/ไอคอน เสมอ ห้ามสีอย่างเดียว ───────────────────

/** ระดับความรุนแรง A–I — ตัวอักษรอยู่ในป้าย จึงอ่านได้แม้พิมพ์ขาวดำ */
export function SeverityBadge({ severity }: { severity?: string | null }) {
  const letter = String(severity ?? '').trim().toUpperCase()
  if (!letter) return <span style={{ color: 'var(--muted)' }}>—</span>
  const description = SEVERITY_DESCRIPTIONS[letter as SeverityLetter]
  return (
    <Badge color={severityTone(letter)} style={{ fontWeight: 700, minWidth: 26, justifyContent: 'center' }}>
      <span title={description ? `${letter} — ${description}` : letter}>{letter}</span>
    </Badge>
  )
}

/** ระดับความเสี่ยง L×S — แสดงคำว่า ต่ำ/กลาง/สูง ไม่ใช่แค่จุดสี */
export function LevelBadge({ level, score }: { level?: string | null; score?: number | null }) {
  if (!level) return <span style={{ color: 'var(--muted)' }}>—</span>
  const key = level as RiskLevel
  return (
    <Badge color={LEVEL_TONE[key] ?? 'gray'}>
      {LEVEL_LABEL[key] ?? level}
      {typeof score === 'number' && <span style={tabularNums}>· {score}</span>}
    </Badge>
  )
}

/** สถานะงาน — ไอคอนบอกขั้นตอนคู่กับข้อความ */
export function StatusBadge({ statuses, value }: { statuses: readonly StatusMeta[]; value?: string | null }) {
  const meta = statusMeta(statuses, value)
  return (
    <Badge color={meta.tone}>
      <Icon name={meta.icon} size={12} />
      {meta.label}
    </Badge>
  )
}

/** เกินกำหนด — บอกจำนวนวันเป็นข้อความ ไม่ใช่แค่ทำแถวเป็นสีแดง */
export function OverdueBadge({ days }: { days: number }) {
  if (days <= 0) return null
  return (
    <Badge color="red">
      <Icon name="alert" size={12} />
      เกิน <span style={tabularNums}>{days}</span> วัน
    </Badge>
  )
}

// ── โครงหน้า ─────────────────────────────────────────────────────────────────

export function Panel({ title, action, children, padding = SPACE.md }: {
  title?: string
  action?: ReactNode
  children: ReactNode
  padding?: number
}) {
  return (
    <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding, minWidth: 0 }}>
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm, marginBottom: SPACE.sm }}>
          {title && <h2 style={{ margin: 0, fontSize: FONT.lg, color: 'var(--ink)', fontWeight: 700 }}>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/** การ์ดตัวเลข — คลิกได้เมื่อส่ง href มา (แล้วจะกลายเป็นลิงก์จริงที่ Tab ถึง) */
export function Kpi({ label, value, sub, icon, tone, href }: {
  label: string
  value: number | string
  sub?: string
  icon: string
  tone: string
  href?: string
}) {
  const body = (
    <>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: 'var(--muted)', fontSize: FONT.xs, fontWeight: 600 }}>{label}</div>
        <div style={{ ...tabularNums, color: tone, fontSize: FONT.xxl, fontWeight: 700, marginTop: 6, lineHeight: 1.1 }}>
          {typeof value === 'number' ? value.toLocaleString('th-TH') : value}
        </div>
        {sub && <div style={{ color: 'var(--muted)', fontSize: FONT.xs, marginTop: 3 }}>{sub}</div>}
      </div>
      <div aria-hidden="true" style={{ width: 32, height: 32, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 8, background: `color-mix(in srgb, ${tone} 12%, transparent)`, color: tone }}>
        <Icon name={icon} size={16} />
      </div>
    </>
  )

  const style: CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.xs,
    background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
    padding: SPACE.sm, minHeight: 44, textAlign: 'left', font: 'inherit', width: '100%',
  }

  if (!href) return <div style={style}>{body}</div>
  return (
    <>
      <style>{`
        .risk-kpi-link{text-decoration:none;cursor:pointer;transition:border-color .15s ease,box-shadow .15s ease}
        .risk-kpi-link:hover{border-color:color-mix(in srgb,var(--primary) 45%,var(--border))}
        .risk-kpi-link:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}
        @media(prefers-reduced-motion:reduce){.risk-kpi-link{transition:none}}
      `}</style>
      <a className="risk-kpi-link" href={href} style={style}>{body}</a>
    </>
  )
}

/** โครงตารางตอนโหลด — 1 div ต่อ cell ตาม pattern ของโปรเจกต์ */
export function TableSkeleton({ rows = 6, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} style={{ borderBottom: '1px solid var(--border)' }}>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} style={{ padding: '10px 12px' }}>
              <div style={{ height: 14, borderRadius: 4, background: 'var(--surface-2)', width: c === 0 ? 200 : 80 }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function Field({ label, required, error, hint, htmlFor, children }: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <label htmlFor={htmlFor} style={{ display: 'block', fontSize: FONT.sm, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
        {label}
        {required && <span style={{ color: 'var(--danger)', marginLeft: 3 }} aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <span style={{ marginTop: 4, fontSize: FONT.xs, color: 'var(--muted)' }}>{hint}</span>}
      {error && (
        <span role="alert" style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: FONT.xs, color: 'var(--danger)' }}>
          <Icon name="alert" size={12} />
          {error}
        </span>
      )}
    </div>
  )
}

/**
 * Modal ตาม pattern ของโปรเจกต์ — ปิดด้วยปุ่ม X เท่านั้น ไม่ปิดเมื่อคลิกฉากหลัง
 * ถ้ามีข้อมูลที่ยังไม่บันทึก (`dirty`) จะถามยืนยันก่อนปิด
 */
export function Modal({ title, subtitle, onClose, width = 720, dirty = false, footer, children }: {
  title: string
  subtitle?: string
  onClose: () => void
  width?: number
  dirty?: boolean
  footer?: ReactNode
  children: ReactNode
}) {
  function requestClose() {
    if (dirty && !window.confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการปิดหน้าต่างนี้หรือไม่')) return
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflow: 'auto' }}>
      <div role="dialog" aria-modal="true" aria-label={title} style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: width, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE.sm, padding: `${SPACE.md}px ${SPACE.lg - 4}px`, borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: FONT.lg, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
            {subtitle && <div style={{ fontSize: FONT.base, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="ปิดหน้าต่าง"
            style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, flex: '0 0 auto', border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <div style={{ padding: SPACE.lg - 4, overflow: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{ padding: `${SPACE.sm}px ${SPACE.lg - 4}px`, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.xs, flexWrap: 'wrap' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/** แถบแสดงข้อผิดพลาดระดับหน้า */
export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, padding: SPACE.sm, borderRadius: 10, background: 'color-mix(in srgb, var(--danger) 8%, var(--card))', border: '1px solid color-mix(in srgb, var(--danger) 28%, transparent)', color: 'var(--danger)', fontSize: FONT.md }}>
      <Icon name="alert" size={16} />
      {message}
    </div>
  )
}
