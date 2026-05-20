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
  padding: '10px 14px', fontSize: 11, fontWeight: 700,
  color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', textAlign: 'left',
}
const TD: React.CSSProperties = { padding: '10px 14px', verticalAlign: 'middle' }

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} style={TD}>
          <div style={{ height: 14, borderRadius: 4, background: 'var(--surface-2)', width: i === 2 ? 160 : 80 }} />
        </td>
      ))}
    </tr>
  )
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, fontSize: 10 }}>
      {active && dir === 'desc' ? '▼' : '▲'}
    </span>
  )
}

export function TestTable({ tests, categories, loading, canEdit, page, pageSize, total, sortBy = 'code', sortDir = 'asc', onSort, onPageChange, onDelete, onBulkDelete, getHref }: Props) {
  const router = useRouter()
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]))
  const totalPages = Math.ceil(total / pageSize)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)

  // Clear selection when page changes or tests reload
  useEffect(() => { setSelected(new Set()) }, [page, tests])

  const allIds = tests.map(t => t.id)
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id))
  const someSelected = selected.size > 0

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allIds))
    }
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
      {/* Bulk action bar */}
      {canEdit && someSelected && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px', marginBottom: 8, borderRadius: 10,
          background: '#EFF6FF', border: '1px solid #BFDBFE',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1D4ED8', flex: 1 }}>
            เลือกแล้ว {selected.size} รายการ
          </span>
          <button
            onClick={() => setSelected(new Set())}
            style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, fontFamily: 'inherit' }}
          >
            ยกเลิก
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={deleting}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 600, color: '#DC2626',
              background: '#FEE2E2', border: '1px solid #FECACA',
              borderRadius: 7, padding: '5px 14px', cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.6 : 1, fontFamily: 'inherit',
            }}
          >
            <Icon name="trash" size={13} />
            {deleting ? 'กำลังลบ...' : `ลบ ${selected.size} รายการ`}
          </button>
        </div>
      )}

      <div style={{ overflowX: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {canEdit && (
                <th style={{ ...TH, width: 40, paddingRight: 4 }}>
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
                ['code',        'รหัสการทดสอบ (E-phis)', false],
                ['cgd',         'รหัสกรมบัญชีกลาง',      false],
                ['th',          'ชื่อรายการตรวจ',         false],
                [null,          'หมวดหมู่',               false],
                ['tube',        'Specimen',               false],
                ['service',     'วัน-เวลาที่ตรวจ',        false],
                ['tat_minutes', 'TAT',                    false],
                ['price',       'ราคา',                   true],
              ] as [string | null, string, boolean][]).map(([col, label, right]) => {
                const active = col !== null && sortBy === col
                const nextDir = active && sortDir === 'asc' ? 'desc' : 'asc'
                return (
                  <th
                    key={label}
                    style={{ ...TH, textAlign: right ? 'right' : 'left', cursor: col ? 'pointer' : 'default', userSelect: 'none' }}
                    onClick={() => col && onSort?.(col, nextDir)}
                  >
                    {label}
                    {col && <SortIcon active={active} dir={active ? sortDir : 'asc'} />}
                  </th>
                )
              })}
              {canEdit && <th style={TH} />}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
              : tests.map((t) => {
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
                        background: isSelected ? '#EFF6FF' : undefined,
                      }}
                      onClick={() => router.push(getHref ? getHref(t) : `/staff/tests/${t.id}`)}
                      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                      onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '' }}
                    >
                      {canEdit && (
                        <td style={{ ...TD, width: 40, paddingRight: 4 }} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(t.id)}
                            style={{ accentColor: 'var(--primary)', width: 15, height: 15, cursor: 'pointer' }}
                          />
                        </td>
                      )}
                      <td style={TD}>
                        <Link href={getHref ? getHref(t) : `/staff/tests/${t.id}`} style={{ color: '#2563EB', fontWeight: 700, textDecoration: 'none', fontFamily: 'monospace', fontSize: 12 }}>
                          {t.code}
                        </Link>
                      </td>
                      <td style={{ ...TD, fontSize: 12, color: 'var(--muted)' }}>{t.cgd ?? '—'}</td>
                      <td style={TD}>
                        <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{t.th}</div>
                        {t.en && <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{t.en}</div>}
                      </td>
                      <td style={TD}>
                        {cat
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 20, background: cat.color + '22', color: cat.color, fontSize: 11.5, fontWeight: 600 }}>{cat.th}</span>
                          : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                        }
                      </td>
                      <td style={TD}>
                        {t.tube
                          ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: tubeColor, flexShrink: 0 }} />
                              <span style={{ fontSize: 12 }}>{t.tube}</span>
                            </div>
                          : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                        }
                      </td>
                      <td style={{ ...TD, fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {t.available_24hr ? 'ตลอด 24 ชั่วโมง' : (t.service ?? '—')}
                      </td>
                      <td style={{ ...TD, fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{tatDisplay}</td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 600 }}>{t.price != null ? `฿${t.price}` : '—'}</td>
                      {canEdit && (
                        <td style={{ ...TD, whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <Link href={`/staff/tests/${t.id}/edit`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', color: 'var(--muted)', textDecoration: 'none' }}>
                              <Icon name="edit" size={13} />
                            </Link>
                            <button
                              onClick={() => onDelete?.(t.id)}
                              style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #FEE2E2', background: 'transparent', cursor: 'pointer', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 13 }}>
          <button
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1, color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13 }}
          >
            ← ก่อนหน้า
          </button>
          <span style={{ color: 'var(--muted)' }}>หน้า {page + 1} / {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => onPageChange(page + 1)}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1, color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13 }}
          >
            ถัดไป →
          </button>
        </div>
      )}
    </div>
  )
}
