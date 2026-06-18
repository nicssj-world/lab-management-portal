'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { usePermission } from '@/context/PermissionContext'
import { EXPIRY_COLOR, EXPIRY_LABEL_TH, type ExpiryStatus } from '@/lib/personnel/expiry'

export interface RosterRow {
  id: string
  name: string
  role: string
  dept: string | null
  unit: string | null
  position_title: string | null
  mt_license_no: string | null
  mt_license_expiry: string | null
  avatar_url: string | null
  licenseStatus: ExpiryStatus
  certExpiring: number
  certExpired: number
  compOverdue: number
  compDueSoon: number
}

// ── department → accent color (deterministic hash) ──
const DEPT_PALETTE = [
  '#1E5FAD', '#0891B2', '#7C3AED', '#059669',
  '#D97706', '#DB2777', '#EA580C', '#65A30D',
  '#0E7490', '#9333EA', '#374151',
]
function deptColor(dept: string | null): string {
  if (!dept) return '#64748B'
  const hash = dept.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return DEPT_PALETTE[hash % DEPT_PALETTE.length]
}

// ── Avatar ──
function Avatar({ name, dept, photoUrl }: { name: string; dept: string | null; photoUrl?: string | null }) {
  const color = deptColor(dept)
  if (photoUrl) {
    return (
      <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, overflow: 'hidden' }}>
        <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: `${color}1a`, color,
      fontSize: 14, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, lineHeight: 1, userSelect: 'none',
    }}>
      {name.charAt(0)}
    </div>
  )
}

// ── Enhanced stat card ──
function StatCard({ label, value, color, icon, warn }: {
  label: string; value: number; color: string; icon: string; warn?: boolean
}) {
  const highlighted = warn && value > 0
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 12,
      padding: '14px 16px',
      borderLeft: `3px solid ${highlighted ? color : 'var(--border)'}`,
      display: 'flex', alignItems: 'center', gap: 12,
      transition: 'border-color .2s',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: highlighted ? `${color}18` : 'var(--surface-2)',
        color: highlighted ? color : 'var(--muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name={icon} size={18} />
      </div>
      <div>
        <div style={{ fontSize: 23, fontWeight: 800, lineHeight: 1, color: highlighted ? color : 'var(--ink)' }}>
          {value}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3, lineHeight: 1.3 }}>{label}</div>
      </div>
    </div>
  )
}

// ── Alert pill ──
function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: `${color}18`, color,
    }}>
      {children}
    </span>
  )
}

export function PersonnelClient({ rows }: { rows: RosterRow[] }) {
  const router = useRouter()
  const { canEdit } = usePermission('บุคลากร')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('All')
  const [deptFilter, setDeptFilter] = useState<string>('All')

  const roles = useMemo(() => ['All', ...Array.from(new Set(rows.map((r) => r.role)))], [rows])
  const depts = useMemo(() => ['All', ...Array.from(new Set(rows.map((r) => r.dept ?? '').filter(Boolean)))], [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (roleFilter !== 'All' && r.role !== roleFilter) return false
      if (deptFilter !== 'All' && (r.dept ?? '') !== deptFilter) return false
      if (!q) return true
      return [r.name, r.position_title, r.unit, r.dept, r.mt_license_no]
        .some((v) => (v ?? '').toLowerCase().includes(q))
    })
  }, [rows, search, roleFilter, deptFilter])

  const summary = useMemo(() => ({
    total: rows.length,
    licenseExpiring: rows.filter((r) => r.licenseStatus === 'expiring').length,
    licenseExpired: rows.filter((r) => r.licenseStatus === 'expired').length,
    certAlerts: rows.reduce((a, r) => a + r.certExpiring + r.certExpired, 0),
    compOverdue: rows.reduce((a, r) => a + r.compOverdue, 0),
  }), [rows])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <PageHeader
          eyebrow="กลุ่มงานเทคนิคการแพทย์"
          title="ทะเบียนบุคลากร"
          subtitle={`บุคลากรทั้งหมด ${rows.length} คน`}
          marginBottom={0}
        />
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Link href="/staff/personnel/org" style={linkBtn}>
            <Icon name="users" size={15} /> ผังองค์กร
          </Link>
          <Link href="/staff/personnel/compliance" style={linkBtn}>
            <Icon name="shieldCheck" size={15} /> รายงานคุณภาพ
          </Link>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        <StatCard label="บุคลากรทั้งหมด"         value={summary.total}           color="#1E5FAD" icon="users"  />
        <StatCard label="ใบ ทนพ. ใกล้หมดอายุ"   value={summary.licenseExpiring} color="#D97706" icon="clock" warn />
        <StatCard label="ใบ ทนพ. หมดอายุแล้ว"   value={summary.licenseExpired}  color="#DC2626" icon="alert" warn />
        <StatCard label="ใบรับรองต้องต่ออายุ"    value={summary.certAlerts}      color="#D97706" icon="doc"  warn />
        <StatCard label="ค้างประเมินสมรรถนะ"     value={summary.compOverdue}     color="#DC2626" icon="clock" warn />
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 440 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}>
            <Icon name="search" size={15} />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / ตำแหน่ง / หน่วยงาน / เลขใบอนุญาต"
            style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Role pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600, marginRight: 2 }}>บทบาท</span>
          {roles.map((r) => {
            const active = roleFilter === r
            return (
              <button key={r} onClick={() => setRoleFilter(r)} style={{
                padding: '4px 13px', borderRadius: 20, border: '1px solid var(--border)',
                background: active ? 'var(--surface-2)' : 'transparent',
                color: active ? 'var(--ink)' : 'var(--muted)',
                fontWeight: active ? 700 : 500, fontSize: 12.5,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
              }}>
                {r === 'All' ? 'ทั้งหมด' : r}
              </button>
            )
          })}
        </div>

        {/* Dept select */}
        {depts.length > 2 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600, flexShrink: 0 }}>หน่วยงาน</span>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', cursor: 'pointer', outline: 'none' }}
            >
              <option value="All">ทุกหน่วยงาน</option>
              {depts.filter((d) => d !== 'All').map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            {deptFilter !== 'All' && (
              <button onClick={() => setDeptFilter('All')} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                ล้าง
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Roster table ── */}
      <Card padding={0}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                {['ชื่อ-สกุล', 'ตำแหน่ง / หน่วยงาน', 'เลขใบ ทนพ.', 'สถานะใบอนุญาต', 'แจ้งเตือน', ''].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center' }}>
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>ไม่พบบุคลากรที่ตรงกับเงื่อนไข</div>
                  </td>
                </tr>
              ) : filtered.map((r) => (
                <tr key={r.id}
                  onClick={() => router.push(`/staff/personnel/${r.id}`)}
                  style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Name + avatar */}
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={r.name} dept={r.dept} photoUrl={r.avatar_url} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{r.role}</div>
                      </div>
                    </div>
                  </td>

                  {/* Position / dept */}
                  <td style={tdStyle}>
                    <div>{r.position_title ?? <span style={{ color: 'var(--muted)' }}>—</span>}</div>
                    {(r.dept ?? r.unit) && (
                      <div style={{ fontSize: 11, color: deptColor(r.dept), marginTop: 2, fontWeight: 500 }}>
                        {r.dept ?? r.unit}
                      </div>
                    )}
                  </td>

                  {/* License no */}
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: r.mt_license_no ? 'var(--ink)' : 'var(--muted)' }}>
                    {r.mt_license_no ?? '—'}
                  </td>

                  {/* License status */}
                  <td style={tdStyle}>
                    {r.licenseStatus === 'none'
                      ? <span style={{ color: 'var(--muted)' }}>—</span>
                      : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: EXPIRY_COLOR[r.licenseStatus] }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: EXPIRY_COLOR[r.licenseStatus], flexShrink: 0 }} />
                          {EXPIRY_LABEL_TH[r.licenseStatus]}
                          {r.mt_license_expiry && (
                            <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {r.mt_license_expiry}</span>
                          )}
                        </span>
                      )}
                  </td>

                  {/* Alerts */}
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {r.certExpired  > 0 && <Pill color="#DC2626">ใบรับรองหมด {r.certExpired}</Pill>}
                      {r.certExpiring > 0 && <Pill color="#D97706">ใบรับรองใกล้ {r.certExpiring}</Pill>}
                      {r.compOverdue  > 0 && <Pill color="#DC2626">ค้างประเมิน {r.compOverdue}</Pill>}
                      {r.compDueSoon  > 0 && <Pill color="#D97706">ใกล้ถึงรอบ {r.compDueSoon}</Pill>}
                      {r.certExpired + r.certExpiring + r.compOverdue + r.compDueSoon === 0 && (
                        <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>ปกติ</span>
                      )}
                    </div>
                  </td>

                  {/* Arrow */}
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--muted)', paddingRight: 14 }}>
                    <Icon name="chevRight" size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Result count */}
      {filtered.length !== rows.length && (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          แสดง {filtered.length} จาก {rows.length} คน
        </div>
      )}

      {!canEdit && (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>โหมดดูอย่างเดียว — ไม่มีสิทธิ์แก้ไขข้อมูลบุคลากร</div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 16px', fontSize: 11, fontWeight: 600, color: 'var(--muted)',
  letterSpacing: '.05em', textTransform: 'uppercase',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', textAlign: 'left',
}
const tdStyle: React.CSSProperties = { padding: '12px 16px', color: 'var(--ink)', verticalAlign: 'middle' }
const linkBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--card)',
  color: 'var(--ink)', fontSize: 13, fontWeight: 600, textDecoration: 'none',
}
