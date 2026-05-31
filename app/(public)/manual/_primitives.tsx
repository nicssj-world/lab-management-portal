import React from 'react'
import { Icon } from '@/components/ui/Icon'

export function H2({ children, eyebrow }: { children: React.ReactNode; eyebrow?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, margin: '0 0 20px' }}>
      <div style={{ width: 4, minHeight: 44, borderRadius: 3, background: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
      <div>
        {eyebrow && (
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--primary)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4, opacity: .8 }}>
            {eyebrow}
          </div>
        )}
        <h2 style={{ fontSize: 21, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em', margin: 0, lineHeight: 1.2 }}>
          {children}
        </h2>
      </div>
    </div>
  )
}

export function H3({ children, mt = 24 }: { children: React.ReactNode; mt?: number }) {
  return (
    <h3 style={{
      fontSize: 14, fontWeight: 700, color: 'var(--ink)',
      margin: `${mt}px 0 10px`,
      paddingBottom: 8,
      borderBottom: '1px solid var(--border)',
      letterSpacing: '-.01em',
    }}>
      {children}
    </h3>
  )
}

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.8, margin: '0 0 12px' }}>
      {children}
    </p>
  )
}

type CalloutTone = 'warning' | 'danger' | 'info' | 'success'

const CALLOUT_TONES: Record<CalloutTone, { bg: string; br: string; fg: string; stripe: string }> = {
  warning: { bg: 'rgba(217,119,6,.07)',  br: 'rgba(217,119,6,.3)',  fg: '#B45309', stripe: '#D97706' },
  danger:  { bg: 'rgba(220,38,38,.07)',  br: 'rgba(220,38,38,.3)',  fg: '#B91C1C', stripe: '#DC2626' },
  info:    { bg: 'var(--primary-soft)',  br: 'rgba(30,95,173,.25)', fg: 'var(--primary)', stripe: 'var(--primary)' },
  success: { bg: 'rgba(22,163,74,.07)',  br: 'rgba(22,163,74,.3)',  fg: '#15803D', stripe: '#16A34A' },
}

export function Callout({ icon = 'alert', tone = 'warning' as CalloutTone, children }: {
  icon?: string
  tone?: CalloutTone
  children: React.ReactNode
}) {
  const t = CALLOUT_TONES[tone]
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '12px 16px 12px 14px',
      background: t.bg, border: `1px solid ${t.br}`,
      borderLeft: `3px solid ${t.stripe}`,
      borderRadius: 10, margin: '14px 0',
    }}>
      <div style={{ color: t.fg, flexShrink: 0, marginTop: 1 }}>
        <Icon name={icon} size={15} />
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>{children}</div>
    </div>
  )
}

export function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '22px 24px',
      marginBottom: 14,
      boxShadow: '0 1px 4px rgba(15,23,42,.05)',
    }}>
      {children}
    </div>
  )
}

export function Th({ children, align }: { children?: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th style={{
      padding: '9px 12px', textAlign: align ?? 'left',
      fontSize: 11, fontWeight: 700, color: 'var(--muted)',
      letterSpacing: '.05em', textTransform: 'uppercase',
      background: 'var(--surface-2)',
      borderBottom: '2px solid var(--border)',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  )
}

export function StepList({ steps, color = 'var(--primary)' }: { steps: React.ReactNode[]; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {steps.map((s, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 14,
          padding: '12px 14px',
          border: '1px solid var(--border)',
          borderLeft: `3px solid ${color}`,
          borderRadius: 10, background: 'var(--card)',
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 11, flexShrink: 0, marginTop: 1,
          }}>
            {i + 1}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.65, flex: 1 }}>{s}</div>
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
