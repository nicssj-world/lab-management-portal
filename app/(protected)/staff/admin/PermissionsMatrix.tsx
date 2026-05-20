'use client'

import { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

type PermLevel = 'none' | 'view' | 'edit'
type Matrix    = Record<string, Record<string, PermLevel>>

const ROLES = ['Admin', 'Manager', 'Medical Technologist', 'Assistant'] as const
type Role = typeof ROLES[number]

const ROLE_COLORS: Record<Role, 'red' | 'blue' | 'teal' | 'gray'> = {
  Admin: 'red', Manager: 'blue', 'Medical Technologist': 'teal', Assistant: 'gray',
}

const RESOURCES = [
  'รายการตรวจ',
  'เอกสารคุณภาพ',
  'ข่าวสาร',
  'ความเสี่ยง / Rejection',
  'สัญญา',
  'Workload',
  'KPI',
  'TAT (นำเข้า)',
  'User Management',
] as const

const LEVELS: PermLevel[] = ['none', 'view', 'edit']

const LEVEL_CFG: Record<PermLevel, { icon: string; label: string; bg: string; color: string }> = {
  none: { icon: '✕', label: 'ไม่มีสิทธิ์',    bg: '#F1F5F9', color: '#64748B' },
  view: { icon: '👁', label: 'ดูได้อย่างเดียว', bg: '#DBEAFE', color: '#1D4ED8' },
  edit: { icon: '✎', label: 'เพิ่ม / แก้ไขได้', bg: '#DCFCE7', color: '#16A34A' },
}

// ─── Segmented 3-way control ─────────────────────────────────────────────────
function LevelSeg({
  level, onSet, saving,
}: { level: PermLevel; onSet: (l: PermLevel) => void; saving: boolean }) {
  return (
    <div style={{
      display: 'inline-flex', borderRadius: 7,
      border: '1px solid var(--border)', overflow: 'hidden',
      opacity: saving ? 0.55 : 1, transition: 'opacity .15s',
    }}>
      {LEVELS.map((l, i) => {
        const cfg    = LEVEL_CFG[l]
        const active = level === l
        return (
          <button
            key={l}
            onClick={() => !saving && onSet(l)}
            disabled={saving}
            title={cfg.label}
            style={{
              width: 32, height: 28,
              border: 'none',
              borderRight: i < LEVELS.length - 1 ? '1px solid var(--border)' : 'none',
              background: active ? cfg.bg : 'var(--card)',
              color: active ? cfg.color : '#CBD5E1',
              fontSize: l === 'view' ? 11 : 13, fontWeight: 700,
              cursor: saving ? 'wait' : 'pointer',
              transition: 'background .12s, color .12s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {saving && active ? '…' : cfg.icon}
          </button>
        )
      })}
    </div>
  )
}

// ─── Read-only badge ──────────────────────────────────────────────────────────
function LevelBadge({ level, locked }: { level: PermLevel; locked?: boolean }) {
  const cfg = LEVEL_CFG[level]
  const bg  = locked && level !== 'none'
    ? (level === 'edit' ? '#BBF7D0' : '#BFDBFE')
    : (level === 'none' ? 'var(--surface-2)' : cfg.bg)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
      background: bg, color: level === 'none' ? '#94A3B8' : cfg.color,
      whiteSpace: 'nowrap',
    }}>
      {cfg.icon}&nbsp;{cfg.label}
    </span>
  )
}

// ─── Skeleton cell ────────────────────────────────────────────────────────────
function SkeletonCell() {
  return (
    <div style={{ height: 28, width: 96, borderRadius: 7, background: 'var(--surface-2)', margin: '0 auto' }} />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props { isAdmin: boolean }

export function PermissionsMatrix({ isAdmin }: Props) {
  const [matrix, setMatrix]   = useState<Matrix>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string | null>(null)
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/admin/permissions')
      .then((r) => r.json())
      .then((data) => { setMatrix(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }

  async function setLevel(role: Role, resource: string, level: PermLevel) {
    if (!isAdmin || role === 'Admin') return
    const key  = `${role}:${resource}`
    const prev = (matrix[role]?.[resource] as PermLevel) ?? 'none'
    setSaving(key)

    setMatrix((m) => ({ ...m, [role]: { ...(m[role] ?? {}), [resource]: level } }))

    const res = await fetch('/api/admin/permissions', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ role, resource, level }),
    })
    setSaving(null)

    if (!res.ok) {
      setMatrix((m) => ({ ...m, [role]: { ...(m[role] ?? {}), [resource]: prev } }))
      const d = await res.json()
      showToast(d.error ?? 'เกิดข้อผิดพลาด', false)
    } else {
      showToast(`${role} — ${resource}: ${LEVEL_CFG[level].label}`, true)
    }
  }

  const getLevel = (role: string, resource: string): PermLevel =>
    (matrix[role]?.[resource] as PermLevel) ?? 'none'

  return (
    <Card padding={0}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>สิทธิ์การใช้งานตามบทบาท</div>
        {isAdmin && (
          <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
            คลิกที่ปุ่ม [✕][👁][✎] เพื่อเปลี่ยนสิทธิ์
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: toast.ok ? '#166534' : '#B91C1C', color: '#fff',
          boxShadow: '0 4px 16px rgba(0,0,0,.18)',
        }}>
          {toast.ok ? '✓ ' : '✕ '}{toast.msg}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
              <th style={{ padding: '11px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)', minWidth: 180 }}>
                ทรัพยากร
              </th>
              {ROLES.map((role) => (
                <th key={role} style={{ padding: '11px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <Badge color={ROLE_COLORS[role]} size="sm">{role}</Badge>
                  {role === 'Admin' && (
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400, marginTop: 2 }}>ล็อก</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? RESOURCES.map((r) => (
                <tr key={r} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ height: 14, width: 140, borderRadius: 4, background: 'var(--surface-2)' }} />
                  </td>
                  {ROLES.map((role) => (
                    <td key={role} style={{ padding: '11px 16px', textAlign: 'center' }}>
                      <SkeletonCell />
                    </td>
                  ))}
                </tr>
              ))
              : RESOURCES.map((resource) => (
                <tr key={resource} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '11px 16px', color: 'var(--ink)', fontWeight: 500 }}>{resource}</td>
                  {ROLES.map((role) => {
                    const level   = getLevel(role, resource)
                    const key     = `${role}:${resource}`
                    const isSaving = saving === key
                    const locked  = role === 'Admin'
                    return (
                      <td key={role} style={{ padding: '11px 16px', textAlign: 'center' }}>
                        {isAdmin && !locked
                          ? <LevelSeg level={level} onSet={(l) => setLevel(role, resource, l)} saving={isSaving} />
                          : <LevelBadge level={level} locked={locked} />
                        }
                      </td>
                    )
                  })}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 18, fontSize: 11.5, color: 'var(--muted)', flexWrap: 'wrap', alignItems: 'center' }}>
        {LEVELS.map((l) => {
          const cfg = LEVEL_CFG[l]
          return (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 5, background: l === 'none' ? 'var(--surface-2)' : cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700 }}>
                {cfg.icon}
              </span>
              {cfg.label}
            </span>
          )
        })}
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)', opacity: 0.7 }}>
          · Admin: ล็อก ไม่สามารถเปลี่ยนได้
        </span>
      </div>
    </Card>
  )
}
