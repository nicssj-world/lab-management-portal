'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { Icon } from '@/components/ui/Icon'
import { usePermission } from '@/context/PermissionContext'
import { EXPIRY_COLOR, EXPIRY_LABEL_TH, type ExpiryStatus } from '@/lib/personnel/expiry'
import { filterPersonnelRows, matchesPersonnelSummaryFilter, type PersonnelSummaryFilter } from '@/lib/personnel/filters'
import { MAIN_PERSONNEL_ROLES, mainPersonnelRole, type MainPersonnelRole } from '@/lib/personnel/roles'

export interface RosterRow {
  id: string
  name: string
  ephis_id: string | null
  role: string
  dept: string | null
  unit: string | null
  position_title: string | null
  mt_license_no: string | null
  mt_license_expiry: string | null
  photo_url: string | null
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

const ROLE_TONE: Record<MainPersonnelRole, { bg: string; color: string }> = {
  Assistant: { bg: 'rgba(8,145,178,.10)', color: '#0891B2' },
  'Medical Technologist': { bg: 'rgba(30,95,173,.10)', color: 'var(--primary)' },
  'Medical Science Technician': { bg: 'rgba(5,150,105,.10)', color: '#059669' },
}

// ── Portrait — official photo first, initials medallion as fallback ──
function Portrait({ name, dept, photoUrl, ring }: { name: string; dept: string | null; photoUrl: string | null; ring: string }) {
  const color = deptColor(dept)
  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: '4 / 5', borderRadius: 12,
      overflow: 'hidden', flexShrink: 0, background: `linear-gradient(155deg, ${color}14, ${color}05)`,
      boxShadow: `inset 0 0 0 1.5px ${ring}`,
    }}>
      {photoUrl ? (
        <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 30, fontWeight: 800, color, letterSpacing: '-.02em', userSelect: 'none' }}>
            {name.charAt(0)}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Stat card ──
function StatCard({ label, value, color, icon, warn, delay, active, onClick }: {
  label: string; value: number; color: string; icon: string; warn?: boolean; delay: number; active?: boolean; onClick?: () => void
}) {
  const highlighted = warn && value > 0
  return (
    <button
      type="button"
      className="pc-rise pc-stat-card"
      aria-pressed={active}
      onClick={onClick}
      style={{
      animationDelay: `${delay}ms`,
      background: 'var(--card)', borderRadius: 13,
      padding: '15px 16px',
      borderTopWidth: '2.5px',
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderLeftWidth: 1,
      borderTopStyle: 'solid',
      borderRightStyle: 'solid',
      borderBottomStyle: 'solid',
      borderLeftStyle: 'solid',
      borderTopColor: active || highlighted ? color : 'var(--border)',
      borderRightColor: active ? `${color}88` : 'var(--border)',
      borderBottomColor: active ? `${color}88` : 'var(--border)',
      borderLeftColor: active ? `${color}88` : 'var(--border)',
      display: 'flex', alignItems: 'center', gap: 13,
      width: '100%', textAlign: 'left', fontFamily: 'inherit',
      cursor: 'pointer',
      transition: 'transform .18s, box-shadow .18s, border-color .18s',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 26px rgba(15,23,42,.08)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = active ? `0 10px 24px ${color}18` : 'none' }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 11,
        background: active || highlighted ? `${color}18` : 'var(--surface-2)',
        color: active || highlighted ? color : 'var(--muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name={icon} size={19} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 25, fontWeight: 800, lineHeight: 1, color: active || highlighted ? color : 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em' }}>
          {value}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4, lineHeight: 1.3 }}>{label}</div>
      </div>
    </button>
  )
}

// ── Alert pill ──
function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 20,
      fontSize: 10.5, fontWeight: 700,
      background: `${color}18`, color,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

export function PersonnelClient({ rows, currentUserId }: { rows: RosterRow[]; currentUserId?: string }) {
  const router = useRouter()
  const { canEdit } = usePermission('บุคลากร')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('All')
  const [deptFilter, setDeptFilter] = useState<string>('All')
  const [summaryFilter, setSummaryFilter] = useState<PersonnelSummaryFilter>('all')
  const hasOwnRecord = Boolean(currentUserId && rows.some((r) => r.id === currentUserId))

  const roleCounts = useMemo(() => {
    const counts: Record<MainPersonnelRole, number> = {
      Assistant: 0,
      'Medical Technologist': 0,
      'Medical Science Technician': 0,
    }
    for (const r of rows) {
      const mainRole = mainPersonnelRole(r.role)
      if (mainRole) counts[mainRole]++
    }
    return counts
  }, [rows])
  const roles = useMemo(() => ['All', ...MAIN_PERSONNEL_ROLES], [])
  const depts = useMemo(() => ['All', ...Array.from(new Set(rows.map((r) => r.dept ?? '').filter(Boolean)))], [rows])

  const filtered = useMemo(() => {
    return filterPersonnelRows(rows, { search, roleFilter, deptFilter, summaryFilter })
  }, [rows, search, roleFilter, deptFilter, summaryFilter])

  const summary = useMemo(() => ({
    total: rows.length,
    licenseExpiring: rows.filter((r) => matchesPersonnelSummaryFilter(r, 'license-expiring')).length,
    licenseExpired: rows.filter((r) => matchesPersonnelSummaryFilter(r, 'license-expired')).length,
    licenseMissing: rows.filter((r) => matchesPersonnelSummaryFilter(r, 'license-missing')).length,
    compOverdue: rows.reduce((a, r) => a + r.compOverdue, 0),
  }), [rows])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`
        @keyframes pc-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .pc-rise { opacity: 0; animation: pc-rise .42s cubic-bezier(.22,.68,0,1) forwards; }
        .pc-card:hover { transform: translateY(-3px); }
        .pc-card:hover .pc-arrow { transform: translateX(3px); opacity: 1; }
        .pc-stat-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) {
          .pc-rise { animation: none; opacity: 1; }
          .pc-card:hover, .pc-card:hover .pc-arrow, .pc-stat-card:hover { transform: none; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        padding: 22, borderRadius: 16, border: '1px solid var(--border)',
        background: 'linear-gradient(135deg, var(--card) 0%, var(--surface-2) 100%)',
        boxShadow: '0 14px 36px rgba(15,23,42,.08)',
      }}>
        <div style={{
          position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: '50%',
          background: 'radial-gradient(circle, var(--primary-soft) 0%, transparent 70%)', pointerEvents: 'none',
        }} />
        <PageHeader
          eyebrow="กลุ่มงานเทคนิคการแพทย์"
          title="ทะเบียนบุคลากร"
          subtitle={`บุคลากรทั้งหมด ${rows.length} คน`}
          marginBottom={0}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0, position: 'relative' }}>
          {hasOwnRecord && (
            <Link href={`/staff/personnel/${currentUserId}`} style={linkBtn}>
              <Icon name="user" size={15} /> โปรไฟล์ของฉัน
            </Link>
          )}
          <Link href="/staff/personnel/org" style={linkBtn}>
            <Icon name="users" size={15} /> ผังองค์กร
          </Link>
          <Link href="/staff/personnel/workforce" style={linkBtn}>
            <Icon name="chart" size={15} /> อัตรากำลัง
          </Link>
          <Link href="/staff/personnel/compliance" style={linkBtn}>
            <Icon name="shieldCheck" size={15} /> รายงานคุณภาพ
          </Link>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        <StatCard label="บุคลากรทั้งหมด"         value={summary.total}           color="#1E5FAD" icon="users" delay={0} active={summaryFilter === 'all'} onClick={() => setSummaryFilter('all')} />
        <StatCard label="ใบ ทนพ. ใกล้หมดอายุ"   value={summary.licenseExpiring} color="#D97706" icon="clock" warn delay={40} active={summaryFilter === 'license-expiring'} onClick={() => setSummaryFilter('license-expiring')} />
        <StatCard label="ใบ ทนพ. หมดอายุแล้ว"   value={summary.licenseExpired}  color="#DC2626" icon="alert" warn delay={80} active={summaryFilter === 'license-expired'} onClick={() => setSummaryFilter('license-expired')} />
        <StatCard label="ใบ ทนพ. ยังไม่บันทึก"  value={summary.licenseMissing}  color="#1E5FAD" icon="doc"  warn delay={120} active={summaryFilter === 'license-missing'} onClick={() => setSummaryFilter('license-missing')} />
        <StatCard label="ค้างประเมินสมรรถนะ"     value={summary.compOverdue}     color="#DC2626" icon="clock" warn delay={160} active={summaryFilter === 'comp-overdue'} onClick={() => setSummaryFilter('comp-overdue')} />
      </div>

      {/* ── Filters ── */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 12,
        padding: 14, borderRadius: 12, border: '1px solid var(--border)',
        background: 'var(--card)', boxShadow: '0 10px 28px rgba(15,23,42,.05)',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 440 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}>
            <Icon name="search" size={15} />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / เลขพนักงาน / ตำแหน่ง / หน่วยงาน / เลขใบอนุญาต"
            style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Role pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600, marginRight: 2 }}>บทบาท</span>
          {roles.map((r) => {
            const active = roleFilter === r
            const count = r === 'All' ? rows.length : roleCounts[r as MainPersonnelRole]
            return (
              <button key={r} onClick={() => setRoleFilter(r)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '5px 13px', borderRadius: 20, border: '1px solid var(--border)',
                background: active ? 'var(--surface-2)' : 'var(--card)',
                color: active ? 'var(--ink)' : 'var(--muted)',
                fontWeight: active ? 700 : 500, fontSize: 12.5,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                boxShadow: active ? '0 6px 18px rgba(15,23,42,.08)' : 'none',
              }}>
                {r === 'All' ? 'ทั้งหมด' : r}
                <span style={{
                  minWidth: 20, height: 20, padding: '0 7px', borderRadius: 99,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? 'var(--card)' : 'var(--surface-2)',
                  color: active ? 'var(--primary)' : 'var(--muted)',
                  fontSize: 11, fontWeight: 800,
                }}>{count}</span>
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

      {/* ── Roster — directory grid ── */}
      {filtered.length === 0 ? (
        <div style={{ padding: 56, textAlign: 'center', background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)' }}>
          <Icon name="search" size={22} style={{ color: 'var(--muted)', marginBottom: 8 }} />
          <div style={{ color: 'var(--muted)', fontSize: 13.5 }}>ไม่พบบุคลากรที่ตรงกับเงื่อนไข</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(196px, 1fr))', gap: 14 }}>
          {filtered.map((r, i) => {
            const mainRole = mainPersonnelRole(r.role)
            const tone = mainRole ? ROLE_TONE[mainRole] : null
            const isMe = r.id === currentUserId
            const color = deptColor(r.dept)
            const alertCount = r.certExpired + r.certExpiring + r.compOverdue + r.compDueSoon
            return (
              <div
                key={r.id}
                className="pc-rise pc-card"
                onClick={() => router.push(`/staff/personnel/${r.id}`)}
                style={{
                  animationDelay: `${Math.min(i, 24) * 22}ms`,
                  position: 'relative', cursor: 'pointer',
                  background: 'var(--card)', borderRadius: 14, overflow: 'hidden',
                  border: `1.5px solid ${isMe ? 'var(--primary)' : 'var(--border)'}`,
                  boxShadow: isMe ? '0 8px 22px var(--primary-soft)' : '0 2px 8px rgba(15,23,42,.03)',
                  transition: 'transform .18s, box-shadow .18s, border-color .18s',
                  display: 'flex', flexDirection: 'column',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 14px 30px ${color}22`; e.currentTarget.style.borderColor = isMe ? 'var(--primary)' : `${color}55` }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = isMe ? '0 8px 22px var(--primary-soft)' : '0 2px 8px rgba(15,23,42,.03)'; e.currentTarget.style.borderColor = isMe ? 'var(--primary)' : 'var(--border)' }}
              >
                {/* department accent stripe */}
                <div style={{ height: 4, background: `linear-gradient(90deg, ${color}, ${color}66)`, flexShrink: 0 }} />

                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  <Portrait name={r.name} dept={r.dept} photoUrl={r.photo_url} ring={isMe ? 'var(--primary)' : `${color}30`} />

                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, letterSpacing: '-.01em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, flexWrap: 'wrap', width: '100%' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                      {isMe && <span style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--primary)', background: 'var(--primary-soft)', padding: '1px 6px', borderRadius: 99, flexShrink: 0 }}>ฉัน</span>}
                    </div>

                    {tone && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99, background: tone.bg, color: tone.color, fontSize: 10, fontWeight: 800 }}>
                        {mainRole}
                      </span>
                    )}

                    {(r.dept ?? r.unit) && (
                      <span style={{ fontSize: 10.5, color, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                        {r.dept ?? r.unit}
                      </span>
                    )}
                  </div>

                  {r.licenseStatus !== 'none' && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: EXPIRY_COLOR[r.licenseStatus] }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: EXPIRY_COLOR[r.licenseStatus], flexShrink: 0 }} />
                      ทนพ. {EXPIRY_LABEL_TH[r.licenseStatus]}
                    </div>
                  )}

                  {alertCount > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {r.certExpired  > 0 && <Pill color="#DC2626">ใบรับรองหมด {r.certExpired}</Pill>}
                      {r.certExpiring > 0 && <Pill color="#D97706">ใบรับรองใกล้ {r.certExpiring}</Pill>}
                      {r.compOverdue  > 0 && <Pill color="#DC2626">ค้างประเมิน {r.compOverdue}</Pill>}
                      {r.compDueSoon  > 0 && <Pill color="#D97706">ใกล้ถึงรอบ {r.compDueSoon}</Pill>}
                    </div>
                  )}

                  <div style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10.5, color: 'var(--muted)', fontFamily: 'monospace' }}>{r.ephis_id ?? '—'}</span>
                    <Icon name="chevRight" size={14} className="pc-arrow" style={{ color: 'var(--muted)', opacity: .5, transition: 'transform .18s, opacity .18s' }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

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

const linkBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--card)',
  color: 'var(--ink)', fontSize: 13, fontWeight: 600, textDecoration: 'none',
}
