'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Test, Category } from '@/lib/supabase/types'

interface Props {
  tests: Test[]
  categories: Category[]
  loading: boolean
  canEdit: boolean
  page: number
  pageSize: number
  total: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (col: string, dir: 'asc' | 'desc') => void
  onPageChange: (p: number) => void
  onDelete?: (id: number) => void
  onBulkDelete?: (ids: number[]) => void
  getHref?: (t: Test) => string
}

const TH: React.CSSProperties = {
  padding: '11px 14px', fontSize: 10.5, fontWeight: 700,
  color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase',
  background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap', textAlign: 'left',
}
const TD: React.CSSProperties = { padding: '11px 14px', verticalAlign: 'middle' }

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={TD}>
          <div style={{
            height: 13, borderRadius: 6,
            background: 'var(--surface-2)',
            width: i === 2 ? 180 : i === 0 ? 24 : 72,
            opacity: 0.7,
          }} />
        </td>
      ))}
    </tr>
  )
}

function SortChevron({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span style={{
      marginLeft: 4, display: 'inline-block', verticalAlign: 'middle',
      opacity: active ? 1 : 0.25,
      transform: active && dir === 'desc' ? 'rotate(180deg)' : 'none',
      transition: 'transform .15s, opacity .15s',
      color: active ? 'var(--primary)' : 'var(--muted)',
    }}>
      <Icon name="chevDown" size={11} />
    </span>
  )
}

function navBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 34, height: 34, borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--card)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.35 : 1,
    color: 'var(--muted)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, transition: 'all .12s',
  }
}

export function TestTable({
  tests, categories, loading, canEdit,
  page, pageSize, total,
  sortBy = 'code', sortDir = 'asc',
  onSort, onPageChange, onDelete, onBulkDelete, getHref,
}: Props) {
  const router = useRouter()
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]))
  const totalPages = Math.ceil(total / pageSize)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { setSelected(new Set()) }, [page, tests])

  const allIds = tests.map(t => t.id)
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id))
  const someSelected = selected.size > 0
  const colCount = 8 + (canEdit ? 2 : 0)

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds))
  }
  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    if (!confirm(`ยืนยันการลบ ${selected.size} รายการ?`)) return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/tests/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      })
      if (!res.ok) throw new Error()
      setSelected(new Set())
      onBulkDelete?.(Array.from(selected))
    } finally {
      setDeleting(false)
    }
  }

  if (!loading && tests.length === 0) {
    return <EmptyState icon="flask" title="ไม่พบรายการตรวจ" hint="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" />
  }

  return (
    <div>
      {/* ── Bulk action bar ── */}
      {canEdit && someSelected && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', marginBottom: 8, borderRadius: 10,
          background: 'var(--primary-soft)',
          border: '1.5px solid rgba(30,95,173,.2)',
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="check" size={14} style={{ color: '#fff' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', flex: 1 }}>
            เลือกแล้ว {selected.size} รายการ
          </span>
          <button
            onClick={() => setSelected(new Set())}
            style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, fontFamily: 'inherit', fontWeight: 500 }}
          >
            ยกเลิก
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={deleting}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12.5, fontWeight: 600, color: '#fff',
              background: 'var(--danger)', border: 'none',
              borderRadius: 8, padding: '6px 16px',
              cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.6 : 1, fontFamily: 'inherit',
              boxShadow: '0 1px 4px rgba(220,38,38,.3)',
            }}
          >
            <Icon name="trash" size={13} />
            {deleting ? 'กำลังลบ...' : `ลบ ${selected.size} รายการ`}
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div style={{ overflowX: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {canEdit && (
                <th style={{ ...TH, width: 44, paddingRight: 6, paddingLeft: 14 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                    onChange={toggleAll}
                    style={{ accentColor: 'var(--primary)', width: 15, height: 15, cursor: 'pointer' }}
                  />
                </th>
              )}
              {([
                [null,       'รหัส E-phis',     'center'],
                [null,       'รหัสกรมบัญชีกลาง', 'center'],
                ['th',       'ชื่อรายการตรวจ',   'left'],
                ['category', 'หมวดหมู่',          'center'],
                ['tube',     'Specimen',          'left'],
                [null,       'วัน-เวลาที่ตรวจ',  'center'],
                [null,       'TAT',               'center'],
                ['price',    'ราคา',              'right'],
              ] as [string | null, string, string][]).map(([col, label, align]) => {
                const active = col !== null && sortBy === col
                const nextDir = active && sortDir === 'asc' ? 'desc' : 'asc'
                return (
                  <th
                    key={label}
                    style={{ ...TH, textAlign: align as 'left' | 'center' | 'right', cursor: col ? 'pointer' : 'default', userSelect: 'none' }}
                    onClick={() => col && onSort?.(col, nextDir)}
                  >
                    {label}
                    {col && <SortChevron active={active} dir={active ? sortDir : 'asc'} />}
                  </th>
                )
              })}
              {canEdit && <th style={{ ...TH, width: 72 }} />}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} cols={colCount} />)
              : tests.map(t => {
                  const cat = catMap[t.category_id ?? '']
                  const tubeColor = t.tube_color ?? '#94A3B8'
                  const tatDisplay = t.tat_minutes ?? t.tat ?? '—'
                  const isSelected = selected.has(t.id)

                  return (
                    <tr
                      key={t.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'background .1s',
                        background: isSelected ? 'var(--primary-soft)' : 'transparent',
                        boxShadow: isSelected ? 'inset 3px 0 0 var(--primary)' : 'none',
                      }}
                      onClick={() => router.push(getHref ? getHref(t) : `/staff/tests/${t.id}`)}
                      onMouseEnter={e => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'var(--surface-2)'
                          e.currentTarget.style.boxShadow = 'inset 3px 0 0 var(--primary)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.boxShadow = 'none'
                        }
                      }}
                    >
                      {canEdit && (
                        <td style={{ ...TD, width: 44, paddingRight: 6, paddingLeft: 14 }} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(t.id)}
                            style={{ accentColor: 'var(--primary)', width: 15, height: 15, cursor: 'pointer' }}
                          />
                        </td>
                      )}

                      {/* Code */}
                      <td style={{ ...TD, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <Link
                          href={getHref ? getHref(t) : `/staff/tests/${t.id}`}
                          style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none', fontFamily: 'monospace', fontSize: 12.5, letterSpacing: '.02em' }}
                        >
                          {t.code}
                        </Link>
                      </td>

                      {/* CGD */}
                      <td style={{ ...TD, textAlign: 'center', fontSize: 12.5, color: 'var(--muted)', fontFamily: 'monospace' }}>
                        {t.cgd ?? '—'}
                      </td>

                      {/* Name */}
                      <td style={TD}>
                        <div style={{ fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>{t.th}</div>
                        {t.en && <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{t.en}</div>}
                      </td>

                      {/* Category */}
                      <td style={{ ...TD, textAlign: 'center' }}>
                        {cat ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 10px', borderRadius: 20,
                            background: cat.color + '18', color: cat.color,
                            fontSize: 11.5, fontWeight: 600, border: `1px solid ${cat.color}33`,
                          }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                            {cat.th}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Specimen / Tube */}
                      <td style={TD}>
                        {t.tube ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{
                              width: 10, height: 10, borderRadius: 3,
                              background: tubeColor,
                              flexShrink: 0,
                            }} />
                            <span style={{ fontSize: 12, color: 'var(--ink)' }}>{t.tube}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Service hours */}
                      <td style={{ ...TD, textAlign: 'center', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {t.available_24hr
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontWeight: 600, fontSize: 12 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
                              24 ชั่วโมง
                            </span>
                          : (t.service ?? '—')
                        }
                      </td>

                      {/* TAT */}
                      <td style={{ ...TD, textAlign: 'center', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {tatDisplay}
                      </td>

                      {/* Price */}
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {t.price != null ? (
                          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>
                            ฿{Number(t.price).toLocaleString()}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Actions */}
                      {canEdit && (
                        <td style={{ ...TD, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <Link
                              href={`/staff/tests/${t.id}/edit`}
                              style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 30, height: 30, borderRadius: 7,
                                border: '1px solid var(--border)', color: 'var(--muted)',
                                textDecoration: 'none', transition: 'all .12s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}
                            >
                              <Icon name="edit" size={13} />
                            </Link>
                            <button
                              onClick={() => onDelete?.(t.id)}
                              style={{
                                width: 30, height: 30, borderRadius: 7,
                                border: '1px solid var(--border)', background: 'transparent',
                                cursor: 'pointer', color: 'var(--muted)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: 0, transition: 'all .12s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.color = 'var(--danger)' }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}
                            >
                              <Icon name="trash" size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
            }
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 16 }}>
          <button
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
            style={navBtnStyle(page === 0)}
          >
            <Icon name="arrowLeft" size={14} />
          </button>

          {Array.from({ length: Math.min(totalPages, 7) }).map((_, idx) => {
            const p = totalPages <= 7 ? idx
              : page < 4 ? idx
              : page > totalPages - 4 ? totalPages - 7 + idx
              : page - 3 + idx
            const isCurrent = p === page
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                style={{
                  width: 34, height: 34, borderRadius: 8,
                  border: isCurrent ? 'none' : '1px solid var(--border)',
                  background: isCurrent ? 'var(--primary)' : 'var(--card)',
                  color: isCurrent ? '#fff' : 'var(--muted)',
                  fontWeight: isCurrent ? 700 : 400,
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                  boxShadow: isCurrent ? '0 2px 8px rgba(30,95,173,.3)' : 'none',
                  transition: 'all .12s',
                }}
              >
                {p + 1}
              </button>
            )
          })}

          <button
            disabled={page >= totalPages - 1}
            onClick={() => onPageChange(page + 1)}
            style={navBtnStyle(page >= totalPages - 1)}
          >
            <Icon name="arrowRight" size={14} />
          </button>

          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)' }}>
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} จาก {total.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}
