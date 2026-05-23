import React from 'react'
import { Icon } from '@/components/ui/Icon'

export function H2({ children, eyebrow }: { children: React.ReactNode; eyebrow?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 14px' }}>
      <div style={{ width: 3, height: 36, borderRadius: 2, background: 'var(--primary)', flexShrink: 0 }} />
      <div>
        {eyebrow && (
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--primary)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            {eyebrow}
          </div>
        )}
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.01em', margin: 0, lineHeight: 1.15 }}>
          {children}
        </h2>
      </div>
    </div>
  )
}

export function H3({ children, mt = 20 }: { children: React.ReactNode; mt?: number }) {
  return (
    <h3 style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)', margin: `${mt}px 0 10px` }}>
      {children}
    </h3>
  )
}

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.75, margin: '0 0 10px' }}>
      {children}
    </p>
  )
}

type CalloutTone = 'warning' | 'danger' | 'info' | 'success'

const CALLOUT_TONES: Record<CalloutTone, { bg: string; br: string; fg: string }> = {
  warning: { bg: 'rgba(217,119,6,.08)',  br: 'rgba(217,119,6,.25)',  fg: '#B45309' },
  danger:  { bg: 'rgba(220,38,38,.08)',  br: 'rgba(220,38,38,.25)',  fg: '#B91C1C' },
  info:    { bg: 'var(--primary-soft)',  br: 'rgba(30,95,173,.25)',  fg: 'var(--primary)' },
  success: { bg: 'rgba(22,163,74,.08)',  br: 'rgba(22,163,74,.25)',  fg: '#15803D' },
}

export function Callout({ icon = 'alert', tone = 'warning' as CalloutTone, children }: {
  icon?: string
  tone?: CalloutTone
  children: React.ReactNode
}) {
  const t = CALLOUT_TONES[tone]
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 14px', background: t.bg, border: `1px solid ${t.br}`, borderRadius: 10, margin: '10px 0' }}>
      <div style={{ color: t.fg, flexShrink: 0, marginTop: 1 }}>
        <Icon name={icon} size={16} />
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

export function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 28px', marginBottom: 16 }}>
      {children}
    </div>
  )
}

export function Th({ children, align }: { children?: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th style={{
      padding: '10px 12px', textAlign: align ?? 'left',
      fontSize: 11, fontWeight: 700, color: 'var(--muted)',
      letterSpacing: '.04em', textTransform: 'uppercase',
      borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  )
}

export function StepList({ steps, color = 'var(--primary)' }: { steps: React.ReactNode[]; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
          <div style={{ width: 26, height: 26, borderRadius: 999, background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
            {i + 1}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6, flex: 1 }}>{s}</div>
        </div>
      ))}
    </div>
  )
}

export function TblRow({ children }: { children: React.ReactNode }) {
  return (
    <tr
      style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-2)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
    >
      {children}
    </tr>
  )
}
