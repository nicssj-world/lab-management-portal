'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Icon } from '@/components/ui/Icon'
import { DEPARTMENTS, DEPT_ABBR } from '@/lib/validations/user-schema'
import { TYPE_ICON_BG, TYPE_ICON_FG } from '@/lib/documents/ui-constants'
import { DOC_TYPES as TYPE_ORDER } from '@/lib/documents/type-labels'
import { buildReadAudiencePayload, buildReadAudiencePickerState, resolveReadAudience } from '@/lib/documents/read-audience'
import { buildReadLogSummaryHtml } from '@/lib/documents/read-log-summary'

export interface ReportPerson {
  id: string
  name: string
  role: string | null
  position: string | null
  dept: string | null
}

export interface ReportRow {
  id: string
  document_code: string
  title: string
  type: string
  department: string | null
  revision: string | null
  published_at: string | null
  read_audience_depts: string[] | null
  read_audience_user_ids: string[] | null
  /** Distinct users who viewed the current revision (views after published_at). */
  readers: { userId: string; lastRead: string }[]
}

interface Props {
  rows: ReportRow[]
  people: ReportPerson[]
  canAssign: boolean
}


function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function pctColor(pct: number): string {
  if (pct >= 80) return '#16A34A'
  if (pct >= 50) return '#D97706'
  return '#DC2626'
}

function DeptAudienceCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      style={{ accentColor: 'var(--primary)', marginTop: 2, flexShrink: 0, cursor: disabled ? 'default' : 'pointer' }}
    />
  )
}

export function ReadReportClient({ rows: initialRows, people, canAssign }: Props) {
  const [rows, setRows] = useState<ReportRow[]>(initialRows)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailRow, setDetailRow] = useState<ReportRow | null>(null)
  const [detailTab, setDetailTab] = useState<'read' | 'unread'>('read')
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignMode, setAssignMode] = useState<'all' | 'depts'>('all')
  const [assignUserIds, setAssignUserIds] = useState<Set<string>>(new Set())
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [assignBusy, setAssignBusy] = useState(false)
  const [assignErr, setAssignErr] = useState('')

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])
  const audienceGroups = useMemo(() => {
    const groups: { key: string; label: string; members: ReportPerson[] }[] = DEPARTMENTS.map((dept) => ({
      key: dept,
      label: dept,
      members: people.filter((person) => person.dept === dept),
    }))
    const unassigned = people.filter((person) => person.dept == null)
    if (unassigned.length > 0) {
      groups.push({ key: '__no_dept__', label: 'ไม่ระบุแผนก', members: unassigned })
    }
    return groups
  }, [people])

  // Per-row audience + read stats: the denominator is the resolved audience; readers
  // outside that audience don't count toward X.
  const stats = useMemo(() => {
    const map = new Map<string, { audience: ReportPerson[]; readIn: number; pct: number }>()
    for (const row of rows) {
      const audience = resolveReadAudience(people, row.read_audience_depts, row.read_audience_user_ids)
      const audienceIds = new Set(audience.map((p) => p.id))
      const readIn = row.readers.filter((r) => audienceIds.has(r.userId)).length
      const pct = audience.length > 0 ? Math.round((readIn / audience.length) * 100) : 0
      map.set(row.id, { audience, readIn, pct })
    }
    return map
  }, [rows, people])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (typeFilter && r.type !== typeFilter) return false
      if (deptFilter && (r.department ?? '') !== deptFilter) return false
      if (q && !r.document_code.toLowerCase().includes(q) && !r.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, search, typeFilter, deptFilter])

  const summary = useMemo(() => {
    let complete = 0
    let pctSum = 0
    for (const r of rows) {
      const s = stats.get(r.id)
      if (!s) continue
      if (s.pct >= 100 && s.audience.length > 0) complete += 1
      pctSum += s.pct
    }
    return { total: rows.length, complete, avg: rows.length > 0 ? Math.round(pctSum / rows.length) : 0 }
  }, [rows, stats])

  const typeOptions = useMemo(
    () => TYPE_ORDER.filter((t) => rows.some((r) => r.type === t)),
    [rows],
  )
  const deptOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.department).filter((d): d is string => Boolean(d)))).sort(),
    [rows],
  )

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleExpanded(key: string) {
    setExpandedDepts((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleDeptMembers(members: ReportPerson[]) {
    if (members.length === 0) return
    setAssignUserIds((prev) => {
      const next = new Set(prev)
      const allSelected = members.every((person) => next.has(person.id))
      for (const person of members) {
        if (allSelected) next.delete(person.id)
        else next.add(person.id)
      }
      return next
    })
  }

  function toggleAssignUser(id: string) {
    setAssignUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openAssignModal() {
    setAssignErr('')
    const selectedRows = rows.filter((row) => selected.has(row.id))
    if (selectedRows.length === 1) {
      const row = selectedRows[0]
      const initialState = buildReadAudiencePickerState(people, row.read_audience_depts, row.read_audience_user_ids)
      setAssignMode(initialState.mode)
      setAssignUserIds(new Set(initialState.selected_user_ids))
      setExpandedDepts(new Set(initialState.expanded_keys))
    } else {
      setAssignMode('all')
      setAssignUserIds(new Set())
      setExpandedDepts(new Set())
    }
    setAssignOpen(true)
  }

  async function handleAssign() {
    setAssignBusy(true)
    setAssignErr('')
    try {
      const payload = assignMode === 'depts'
        ? buildReadAudiencePayload(assignUserIds, people, DEPARTMENTS)
        : { depts: [], user_ids: [] }
      const depts = assignMode === 'depts' && payload.depts.length > 0 ? payload.depts : null
      const userIds = assignMode === 'depts' && payload.user_ids.length > 0 ? payload.user_ids : null
      const res = await fetch('/api/admin/documents/bulk-read-audience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), depts, user_ids: userIds }),
      })
      const json = await res.json()
      if (!res.ok) { setAssignErr(json.error ?? 'บันทึกไม่สำเร็จ'); return }
      const updated = new Set((json.updated ?? []) as string[])
      setRows((prev) => prev.map((r) => updated.has(r.id) ? { ...r, read_audience_depts: depts, read_audience_user_ids: userIds } : r))
      setSelected(new Set())
      setAssignOpen(false)
      setAssignMode('all')
      setAssignUserIds(new Set())
      setExpandedDepts(new Set())
    } catch {
      setAssignErr('บันทึกไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setAssignBusy(false)
    }
  }

  const detailStats = detailRow ? stats.get(detailRow.id) : null
  const detailReaders = detailRow && detailStats
    ? detailRow.readers
        .map((r) => ({ person: peopleById.get(r.userId), lastRead: r.lastRead }))
        .filter((r): r is { person: ReportPerson; lastRead: string } => Boolean(r.person))
        .map((r) => ({ ...r, inAudience: detailStats.audience.some((p) => p.id === r.person.id) }))
        .sort((a, b) => b.lastRead.localeCompare(a.lastRead))
    : []
  const detailNonReaders = detailRow && detailStats
    ? detailStats.audience.filter((p) => !detailRow.readers.some((r) => r.userId === p.id))
    : []

  function downloadDetailReadSummary(row: ReportRow) {
    const html = buildReadLogSummaryHtml(
      { title: row.title, document_code: row.document_code, type: row.type },
      row.readers
        .map((reader) => {
          const person = peopleById.get(reader.userId)
          if (!person) return null
          return {
            userId: reader.userId,
            name: person.name,
            position: person.position,
            role: person.role,
            lastRead: reader.lastRead,
          }
        })
        .filter((reader): reader is { userId: string; name: string; position: string | null; role: string | null; lastRead: string } => Boolean(reader)),
    )

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)
    const win = window.open(blobUrl, '_blank')
    if (!win) { URL.revokeObjectURL(blobUrl); return }
    win.addEventListener('load', () => { win.print(); URL.revokeObjectURL(blobUrl) }, { once: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        padding: 18, borderRadius: 14, border: '1px solid var(--border)',
        background: 'linear-gradient(135deg, var(--card) 0%, var(--surface-2) 100%)',
        boxShadow: '0 14px 36px rgba(15,23,42,.08)',
      }}>
        <PageHeader
          eyebrow="เอกสารคุณภาพ"
          title="รายงานการอ่านเอกสาร"
          subtitle={`ติดตามการอ่านฉบับปัจจุบันของเอกสาร Published · ${rows.length} ฉบับ · ผู้ใช้ active ${people.length} คน`}
          marginBottom={0}
        />
        <Link href="/staff/documents" className="dash-btn-secondary" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)',
          fontSize: 13, fontWeight: 600, textDecoration: 'none', flexShrink: 0,
        }}>
          <Icon name="doc" size={15} /> เปิดคลังเอกสาร
        </Link>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        {[
          { label: 'เอกสาร Published', value: summary.total, color: '#1E5FAD' },
          { label: 'อ่านครบ 100%', value: summary.complete, color: '#16A34A' },
          { label: 'อัตราการอ่านเฉลี่ย', value: `${summary.avg}%`, color: pctColor(summary.avg) },
        ].map((s) => (
          <div key={s.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters + bulk bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 340 }}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหารหัสหรือชื่อเอกสาร…"
            style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none' }}
        >
          <option value="">ทุกประเภท</option>
          {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', maxWidth: 220 }}
        >
          <option value="">ทุกแผนก</option>
          {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {canAssign && (
          <button
            onClick={openAssignModal}
            disabled={selected.size === 0}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
              border: 'none', background: selected.size > 0 ? 'var(--primary)' : 'var(--border)',
              color: selected.size > 0 ? '#fff' : 'var(--muted)', fontSize: 12.5, fontWeight: 700,
              fontFamily: 'inherit', cursor: selected.size > 0 ? 'pointer' : 'default',
            }}
          >
            <Icon name="users" size={13} /> กำหนดกลุ่มผู้อ่าน ({selected.size} ฉบับ)
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                {canAssign && (
                  <th style={{ padding: '10px 12px', width: 34, borderBottom: '1px solid var(--border)' }}>
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))}
                      onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((r) => r.id)) : new Set())}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                  </th>
                )}
                {['เอกสาร', 'ประเภท', 'กลุ่มผู้อ่าน', 'อ่านแล้ว', 'ความคืบหน้า'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.07em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', textAlign: i >= 1 ? 'center' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={canAssign ? 6 : 5} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 12.5, fontStyle: 'italic' }}>ไม่พบเอกสาร</td></tr>
              )}
              {filtered.map((r) => {
                const s = stats.get(r.id)
                if (!s) return null
                const depts = r.read_audience_depts ?? []
                const userIds = r.read_audience_user_ids ?? []
                const hasAudienceLimit = depts.length > 0 || userIds.length > 0
                const deptLabel = depts.length > 0
                  ? (depts.length <= 2 ? depts.map((d) => DEPT_ABBR[d] ?? d).join(', ') : `${depts.length} แผนก`)
                  : ''
                const personLabel = userIds.length > 0 ? `${depts.length > 0 ? '+' : ''}${userIds.length} คน` : ''
                const audienceLabel = [deptLabel, personLabel].filter(Boolean).join(' ')
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background .12s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {canAssign && (
                      <td style={{ padding: '10px 12px' }}>
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} style={{ accentColor: 'var(--primary)', cursor: 'pointer' }} />
                      </td>
                    )}
                    <td style={{ padding: '10px 14px', minWidth: 220, cursor: 'pointer' }} onClick={() => { setDetailRow(r); setDetailTab('read') }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>{r.title}</div>
                      <div style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700, marginTop: 2 }}>{r.document_code} · Rev.{r.revision ?? '-'}</div>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: TYPE_ICON_FG[r.type] ?? 'var(--muted)', background: TYPE_ICON_BG[r.type] ?? 'var(--surface-2)', padding: '2px 9px', borderRadius: 99 }}>{r.type}</span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', maxWidth: 180 }}>
                      {hasAudienceLimit ? (
                        <span title={[depts.join(', '), userIds.length > 0 ? `รายบุคคล ${userIds.length} คน` : ''].filter(Boolean).join(' + ')} style={{ fontSize: 10.5, fontWeight: 600, color: '#7C3AED', background: 'rgba(124,58,237,.1)', padding: '2px 9px', borderRadius: 99 }}>
                          {audienceLabel}
                        </span>
                      ) : (
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', background: 'var(--surface-2)', padding: '2px 9px', borderRadius: 99 }}>ทั้งกลุ่มงาน</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--ink)', fontSize: 12.5 }}>
                      {s.readIn}/{s.audience.length}
                    </td>
                    <td style={{ padding: '10px 14px', minWidth: 140 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 7, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
                          <div style={{ width: `${s.pct}%`, height: '100%', borderRadius: 99, background: pctColor(s.pct) }} />
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: pctColor(s.pct), fontVariantNumeric: 'tabular-nums', width: 38, textAlign: 'right' }}>{s.pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reader detail modal */}
      {detailRow && detailStats && (
        <div className="modal-scrim" onClick={() => setDetailRow(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
          <div className="modal-panel-pop" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '85vh', background: 'var(--card)', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(15,23,42,.2)' }}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.35 }}>{detailRow.title}</div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700, marginTop: 2 }}>
                    {detailRow.document_code} · Rev.{detailRow.revision ?? '-'} · เผยแพร่ {fmtDateTime(detailRow.published_at)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {detailReaders.length > 0 && (
                    <button
                      onClick={() => downloadDetailReadSummary(detailRow)}
                      title="ดาวน์โหลด PDF สรุปการอ่าน"
                      aria-label="ดาวน์โหลด PDF สรุปการอ่าน"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        padding: 0,
                        borderRadius: 8,
                        border: '1px solid rgba(30,95,173,.28)',
                        background: 'var(--primary-soft)',
                        color: 'var(--primary)',
                        cursor: 'pointer',
                        boxShadow: '0 6px 14px rgba(30,95,173,.14)',
                      }}
                    >
                      <Icon name="download" size={16} />
                    </button>
                  )}
                  <button onClick={() => setDetailRow(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex' }}>
                    <Icon name="x" size={15} />
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                {([['read', `อ่านแล้ว (${detailReaders.length})`], ['unread', `ยังไม่อ่าน (${detailNonReaders.length})`]] as const).map(([tab, label]) => (
                  <button key={tab} onClick={() => setDetailTab(tab)}
                    style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--border)', background: detailTab === tab ? 'var(--primary)' : 'transparent', color: detailTab === tab ? '#fff' : 'var(--ink)' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ overflowY: 'auto', padding: '10px 20px 16px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {detailTab === 'read' && detailReaders.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 12.5, fontStyle: 'italic' }}>ยังไม่มีผู้อ่านฉบับปัจจุบัน</div>
              )}
              {detailTab === 'read' && detailReaders.map((r) => (
                <div key={r.person.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: 'var(--surface-2)' }}>
                  <Icon name="check" size={13} style={{ color: '#16A34A', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{r.person.name}</span>
                    {!r.inAudience && (
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)', background: 'var(--card)', border: '1px solid var(--border)', padding: '1px 7px', borderRadius: 99, marginLeft: 6 }}>นอกกลุ่มเป้าหมาย</span>
                    )}
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 1 }}>{r.person.position ?? r.person.dept ?? ''}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDateTime(r.lastRead)}</span>
                </div>
              ))}
              {detailTab === 'unread' && detailNonReaders.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: '#16A34A', fontSize: 12.5, fontWeight: 600 }}>ทุกคนในกลุ่มเป้าหมายอ่านครบแล้ว</div>
              )}
              {detailTab === 'unread' && detailNonReaders.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: 'var(--surface-2)' }}>
                  <Icon name="clock" size={13} style={{ color: '#D97706', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 1 }}>{p.position ?? p.dept ?? ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bulk assign modal */}
      {assignOpen && (
        <div className="modal-scrim" onClick={() => !assignBusy && setAssignOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
          <div className="modal-panel-pop" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--card)', borderRadius: 16, padding: 20, boxShadow: '0 24px 80px rgba(15,23,42,.2)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>กำหนดกลุ่มผู้อ่าน ({selected.size} ฉบับ)</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3, marginBottom: 14 }}>กลุ่มที่เลือกจะแทนที่ค่าเดิมของทุกฉบับที่เลือกไว้</div>
            {assignErr && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(220,38,38,.08)', color: '#B91C1C', fontSize: 12, marginBottom: 10, border: '1px solid rgba(220,38,38,.2)' }}>{assignErr}</div>
            )}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer' }}>
                <input type="radio" name="assign-audience-mode" checked={assignMode === 'all'} onChange={() => setAssignMode('all')} style={{ accentColor: 'var(--primary)' }} />
                ทั้งกลุ่มงาน (ทุกคน)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink)', cursor: 'pointer' }}>
                <input type="radio" name="assign-audience-mode" checked={assignMode === 'depts'} onChange={() => setAssignMode('depts')} style={{ accentColor: 'var(--primary)' }} />
                ระบุแผนก/รายคน
              </label>
            </div>
            {assignMode === 'depts' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 5, maxHeight: 260, overflowY: 'auto', padding: '4px 2px', marginBottom: 6 }}>
                {audienceGroups.map((group) => {
                  const selectedCount = group.members.filter((person) => assignUserIds.has(person.id)).length
                  const checked = group.members.length > 0 && selectedCount === group.members.length
                  const indeterminate = selectedCount > 0 && selectedCount < group.members.length
                  const expanded = expandedDepts.has(group.key)
                  const disabled = group.members.length === 0

                  return (
                    <div key={group.key}>
                      <div
                        onClick={() => { if (!disabled) toggleExpanded(group.key) }}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 7,
                          fontSize: 12,
                          color: disabled ? 'var(--muted)' : 'var(--ink)',
                          cursor: disabled ? 'default' : 'pointer',
                          lineHeight: 1.35,
                          padding: '4px 2px',
                        }}
                      >
                        <DeptAudienceCheckbox
                          checked={checked}
                          indeterminate={indeterminate}
                          disabled={disabled}
                          onChange={() => toggleDeptMembers(group.members)}
                        />
                        <Icon name={expanded ? 'chevDown' : 'chevRight'} size={12} style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 3 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 600 }}>{group.label}</span>
                          <span style={{ color: 'var(--muted)', marginLeft: 5 }}>({group.members.length} คน)</span>
                        </div>
                      </div>
                      {expanded && group.members.length > 0 && (
                        <div style={{ display: 'grid', gap: 4, padding: '2px 0 4px 32px' }}>
                          {group.members.map((person) => (
                            <label key={person.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: 'var(--ink)', cursor: 'pointer', lineHeight: 1.35 }}>
                              <input
                                type="checkbox"
                                checked={assignUserIds.has(person.id)}
                                onChange={() => toggleAssignUser(person.id)}
                                style={{ accentColor: 'var(--primary)', marginTop: 2, flexShrink: 0 }}
                              />
                              <span>
                                <span style={{ fontWeight: 600 }}>{person.name}</span>
                                <span style={{ color: 'var(--muted)', marginLeft: 5 }}>{person.position ?? ''}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {assignMode === 'depts' && assignUserIds.size === 0 && (
              <div style={{ fontSize: 11, color: 'var(--warning)', marginBottom: 4 }}>ยังไม่ได้เลือกแผนก/รายคน — ระบบจะบันทึกเป็นทั้งกลุ่มงาน</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button onClick={() => setAssignOpen(false)} disabled={assignBusy}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--ink)', cursor: assignBusy ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                ยกเลิก
              </button>
              <button onClick={handleAssign} disabled={assignBusy}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: assignBusy ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, opacity: assignBusy ? .7 : 1 }}>
                {assignBusy ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
