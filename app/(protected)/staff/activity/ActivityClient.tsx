'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

interface LogEntry {
  id: string
  action: string | null
  target: string | null
  detail: string | null
  created_at: string | null
  user_id: string | null
  user_name: string | null
}

const ACTION_LABELS: Record<string, string> = {
  'test.update':           'แก้ไขรายการตรวจ',
  'test.create':           'เพิ่มรายการตรวจ',
  'test.delete':           'ลบรายการตรวจ',
  'test.bulk_delete':      'ลบรายการตรวจ (กลุ่ม)',
  'test.import':           'นำเข้ารายการตรวจ',
  'test.duplicate':        'คัดลอกรายการตรวจ',
  'test.purge_deleted':    'ลบถาวรรายการตรวจ',
  'document.upload':       'อัปโหลดเอกสาร',
  'document.edit':         'แก้ไขเอกสาร',
  'document.delete':       'ลบเอกสาร',
  'document.status_change':'เปลี่ยนสถานะเอกสาร',
  'category.update':       'แก้ไขหมวดหมู่',
  'category.create':       'เพิ่มหมวดหมู่',
  'rejection.create':      'บันทึก Rejection',
  'equipment.create':      'เพิ่มเครื่องมือ',
  'equipment.update':      'แก้ไขเครื่องมือ',
  'equipment.delete':      'ลบเครื่องมือ',
  'contract.create':       'เพิ่มสัญญา',
  'contract.update':       'แก้ไขสัญญา',
  'contract.delete':       'ลบสัญญา',
  'contract.usage_add':    'บันทึกค่าใช้จ่ายสัญญา',
  'risk.create':           'บันทึกความเสี่ยง',
  'risk.update':           'แก้ไขความเสี่ยง',
  'risk.delete':           'ลบความเสี่ยง',
  'risk.close':            'ปิดประเด็นความเสี่ยง',
  'kpi.entry':             'บันทึก KPI',
  'create_news':           'เพิ่มข่าวสาร',
  'update_news':           'แก้ไขข่าวสาร',
  'delete_news':           'ลบข่าวสาร',
  'phleb_upload_init':     'อัปโหลดข้อมูล Phlebotomy',
}

const CATEGORIES = [
  { key: '', label: 'ทั้งหมด' },
  { key: 'document', label: 'เอกสาร' },
  { key: 'test', label: 'รายการตรวจ' },
  { key: 'equipment', label: 'เครื่องมือ' },
  { key: 'contract', label: 'สัญญา' },
  { key: 'risk', label: 'ความเสี่ยง' },
  { key: 'kpi', label: 'KPI' },
  { key: 'news', label: 'ข่าวสาร' },
]

function dotColor(action: string | null) {
  const a = action ?? ''
  if (a.startsWith('document.'))                            return '#0D9488'
  if (a.startsWith('test.') || a.startsWith('category.'))  return '#1E5FAD'
  if (a.startsWith('equipment.'))                           return '#EA580C'
  if (a.startsWith('contract.'))                            return '#7C3AED'
  if (a.startsWith('risk.') || a.startsWith('rejection.')) return '#DC2626'
  if (a.startsWith('kpi.'))                                 return '#16A34A'
  if (a.includes('news'))                                   return '#D97706'
  return '#64748B'
}

function fmtTime(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('th-TH', {
    day: '2-digit', month: 'short', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function detailText(action: string | null, target: string | null, detail: string | null): string {
  if (detail?.trim().startsWith('{')) {
    try {
      const p = JSON.parse(detail) as Record<string, unknown>
      if (action?.startsWith('test.')) {
        const name = (p.th as string) || (p.en as string) || (p.code as string) || ''
        return [target, name].filter(Boolean).join(' · ').slice(0, 120)
      }
    } catch { /* ignore */ }
    return target ?? ''
  }
  return [target, detail && detail !== target ? detail : null]
    .filter(Boolean).join(' · ').slice(0, 140)
}

const PAGE_SIZE = 30

export function ActivityClient() {
  const [category, setCategory] = useState('')
  const [from, setFrom]         = useState('')
  const [to, setTo]             = useState('')
  const [page, setPage]         = useState(1)
  const [data, setData]         = useState<LogEntry[]>([])
  const [count, setCount]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async (p: number, cat: string, f: string, t: string) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (cat) params.set('category', cat)
    if (f)   params.set('from', f)
    if (t)   params.set('to', t)
    try {
      const res = await fetch(`/api/admin/activity?${params}`, { signal: ctrl.signal })
      if (!res.ok) return
      const json = await res.json()
      setData(json.data ?? [])
      setCount(json.count ?? 0)
    } catch { /* aborted */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(page, category, from, to) }, [fetchData, page, category, from, to])

  function applyFilter(cat: string, f: string, t: string) {
    setCategory(cat); setFrom(f); setTo(t); setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const hasFilters = category !== '' || from !== '' || to !== ''

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
    fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)',
    background: 'var(--card)', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <PageHeader
          eyebrow="Staff Portal"
          title="กิจกรรมทั้งหมด"
          subtitle={loading ? '...' : `${count.toLocaleString()} รายการ`}
          marginBottom={0}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => applyFilter('', '', '')}>
              ล้างตัวกรอง
            </Button>
          )}
          <Link href="/staff/dashboard" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="sm" icon="arrowLeft">กลับ</Button>
          </Link>
        </div>
      </div>

      <Card padding={0}>
        {/* Category pills */}
        <div style={{ padding: '14px 20px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => applyFilter(c.key, from, to)}
              style={{
                padding: '5px 14px', borderRadius: 20,
                border: '1px solid var(--border)',
                background: category === c.key ? 'var(--surface-2)' : 'transparent',
                color: category === c.key ? 'var(--ink)' : 'var(--muted)',
                fontWeight: category === c.key ? 700 : 500,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
              }}
            >
              {c.label}
            </button>
          ))}

          {/* Date range inline */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>ช่วงวันที่</span>
            <input type="date" value={from} onChange={e => applyFilter(category, e.target.value, to)} style={inputStyle} />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>–</span>
            <input type="date" value={to} onChange={e => applyFilter(category, from, e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['เวลา', 'กิจกรรม', 'รายละเอียด', 'ผู้ดำเนินการ'].map(h => (
                  <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {[120, 160, 280, 130].map((w, j) => (
                      <td key={j} style={{ padding: '10px 16px' }}>
                        <div style={{ height: 13, borderRadius: 4, background: 'var(--surface-2)', width: w }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                    ไม่พบกิจกรรม
                  </td>
                </tr>
              ) : (
                data.map(row => (
                  <tr
                    key={row.id}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '9px 16px', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {fmtTime(row.created_at)}
                    </td>
                    <td style={{ padding: '9px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor(row.action), flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                          {ACTION_LABELS[row.action ?? ''] ?? row.action ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '9px 16px', fontSize: 12.5, color: 'var(--muted)', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {detailText(row.action, row.target, row.detail) || '—'}
                    </td>
                    <td style={{ padding: '9px 16px', fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                      {row.user_name ?? <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(totalPages > 1 || count > 0) && (
          <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
              หน้า {page} / {totalPages} · {count.toLocaleString()} รายการทั้งหมด
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="secondary"
                size="sm"
                icon="arrowLeft"
                onClick={() => { if (page > 1) setPage(p => p - 1) }}
              >
                ก่อนหน้า
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon="arrowRight"
                onClick={() => { if (page < totalPages) setPage(p => p + 1) }}
              >
                ถัดไป
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
