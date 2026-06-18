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
  // รายการตรวจ
  'test.create':                                  'เพิ่มรายการตรวจ',
  'test.update':                                  'แก้ไขรายการตรวจ',
  'test.delete':                                  'ลบรายการตรวจ',
  'test.bulk_delete':                             'ลบรายการตรวจ (กลุ่ม)',
  'test.import':                                  'นำเข้ารายการตรวจ',
  'test.duplicate':                               'คัดลอกรายการตรวจ',
  'test.purge_deleted':                           'ลบถาวรรายการตรวจ',
  'category.create':                              'เพิ่มหมวดหมู่',
  'category.update':                              'แก้ไขหมวดหมู่',
  // เอกสาร — workflow เดิม
  'document.upload':                              'อัปโหลดเอกสาร',
  'document.edit':                                'แก้ไขเอกสาร',
  'document.delete':                              'ลบเอกสาร',
  'document.status_change':                       'เปลี่ยนสถานะเอกสาร',
  'document.current_revision_rollback':           'ย้อนกลับเวอร์ชันเอกสาร',
  // เอกสาร — working revision workflow
  'document.revision_draft_create':               'สร้าง Working Revision',
  'document.revision_draft_status':               'เปลี่ยนสถานะ Working Revision',
  'document.revision_draft_publish':              'เผยแพร่เอกสาร (Publish)',
  'document.revision_draft_publish_existing_cover': 'เผยแพร่เอกสาร (ใช้หน้าปกเดิม)',
  // เอกสาร — ประวัติการแก้ไข
  'document.revision_history_backfill_create':    'เพิ่มประวัติการแก้ไขย้อนหลัง',
  'document.revision_history_backfill_update':    'แก้ไขประวัติการแก้ไขย้อนหลัง',
  'document.revision_history_backfill_delete':    'ลบประวัติการแก้ไขย้อนหลัง',
  'document.revision_history_date_update':        'แก้ไขวันที่ประวัติการแก้ไข',
  // เครื่องมือ
  'equipment.create':                             'เพิ่มเครื่องมือ',
  'equipment.update':                             'แก้ไขเครื่องมือ',
  'equipment.delete':                             'ลบเครื่องมือ',
  // สัญญา
  'contract.create':                              'เพิ่มสัญญา',
  'contract.update':                              'แก้ไขสัญญา',
  'contract.delete':                              'ลบสัญญา',
  'contract.usage_add':                           'บันทึกค่าใช้จ่ายสัญญา',
  // ความเสี่ยง
  'risk.create':                                  'บันทึกความเสี่ยง',
  'risk.update':                                  'แก้ไขความเสี่ยง',
  'risk.delete':                                  'ลบความเสี่ยง',
  'risk.close':                                   'ปิดประเด็นความเสี่ยง',
  'rejection.create':                             'บันทึก Rejection',
  // KPI
  'kpi.entry':                                    'บันทึก KPI',
  // ข่าวสาร
  'create_news':                                  'เพิ่มข่าวสาร',
  'update_news':                                  'แก้ไขข่าวสาร',
  'delete_news':                                  'ลบข่าวสาร',
  // บุคลากร
  'personnel.profile.update':                     'แก้ไขโปรไฟล์บุคลากร',
  'personnel.org.create':                         'เพิ่มโครงสร้างองค์กร',
  'personnel.org.delete':                         'ลบโครงสร้างองค์กร',
  'personnel.jd.create':                          'เพิ่มข้อกำหนดตำแหน่งงาน',
  'personnel.jd.update':                          'แก้ไขข้อกำหนดตำแหน่งงาน',
  // โปรไฟล์เอกสาร / ลายเซ็น
  'document_profile.update':                      'แก้ไขโปรไฟล์เอกสาร',
  'document_profile.update_self':                 'แก้ไขโปรไฟล์เอกสาร (ตัวเอง)',
  'document_profile.signature_upload':            'อัปโหลดลายเซ็น',
  'document_profile.signature_upload_self':       'อัปโหลดลายเซ็น (ตัวเอง)',
  'document_profile.signature_delete':            'ลบลายเซ็น',
  'document_profile.signature_delete_self':       'ลบลายเซ็น (ตัวเอง)',
  // ระบบ
  'manual_edit':                                  'แก้ไขคู่มือ',
  'permission.update':                            'แก้ไขสิทธิ์ผู้ใช้',
  'settings.update':                              'แก้ไขการตั้งค่าระบบ',
  'phleb_upload_init':                            'อัปโหลดข้อมูล Phlebotomy',
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

const STATUS_TH: Record<string, string> = {
  'Draft':     'ร่าง',
  'Review':    'รอตรวจสอบ',
  'Approved':  'อนุมัติแล้ว',
  'Published': 'เผยแพร่แล้ว',
  'Obsolete':  'ยกเลิกใช้งาน',
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(:[0-9a-f-]+)?$/i.test(s)
}

function translateStatuses(s: string) {
  return s.replace(/\b(Draft|Review|Approved|Published|Obsolete)\b/g, m => STATUS_TH[m] ?? m)
}

function detailText(action: string | null, target: string | null, detail: string | null): string {
  const a = action ?? ''
  const t = (target ?? '').trim()
  const d = (detail ?? '').trim()
  const safeTarget = isUuid(t) ? '' : t

  // JSON detail (test.* actions)
  if (d.startsWith('{')) {
    try {
      const p = JSON.parse(d) as Record<string, unknown>
      if (a.startsWith('test.')) {
        const name = (p.th as string) || (p.en as string) || (p.code as string) || ''
        return [safeTarget, name].filter(Boolean).join(' · ').slice(0, 120)
      }
    } catch { /* ignore */ }
    return safeTarget
  }

  // Working revision status change: "Rev. 07 · Draft → Review"
  if (a === 'document.revision_draft_status') {
    return [safeTarget, translateStatuses(d)].filter(Boolean).join(' · ')
  }

  // Document status change (legacy): detail = "CODE · old → new"
  if (a === 'document.status_change') {
    return translateStatuses(d) || safeTarget
  }

  // Publish with existing cover
  if (a === 'document.revision_draft_publish_existing_cover') {
    const rev = d.match(/Rev\.\s*\S+/)?.[0] ?? ''
    return [safeTarget, rev, 'ใช้หน้าปกเดิม'].filter(Boolean).join(' · ')
  }

  // Rollback: "Deleted Rev. X; promoted Rev. Y"
  if (a === 'document.current_revision_rollback') {
    const del = d.match(/Deleted (Rev\.\s*\S+)/)?.[1]
    const prom = d.match(/promoted (Rev\.\s*\S+)/)?.[1]
    return [safeTarget, del ? `ลบ ${del}` : null, prom ? `ย้อนกลับ ${prom}` : null].filter(Boolean).join(' · ')
  }

  // Revision history (target is uuid:uuid — no meaningful target)
  if (a === 'document.revision_history_backfill_create') {
    const rev = d.match(/Rev\.\s*\S+/)?.[0]
    return rev ? `เพิ่ม ${rev}` : 'เพิ่มประวัติ'
  }
  if (a === 'document.revision_history_backfill_update') {
    const rev = d.match(/Rev\.\s*\S+/)?.[0]
    return rev ? `แก้ไข ${rev}` : 'แก้ไขประวัติ'
  }
  if (a === 'document.revision_history_backfill_delete') return 'ลบประวัติย้อนหลัง'
  if (a === 'document.revision_history_date_update') {
    const rev = d.match(/Rev\.\s*\S+/)?.[0]
    return rev ? `แก้ไขวันที่ ${rev}` : 'แก้ไขวันที่ประวัติ'
  }

  // Import current revision
  if (a === 'document.import_current') {
    const rev = d.match(/Rev\.\s*\S+/)?.[0]
    const hasLegacy = d.includes('legacy cover')
    return [safeTarget, rev ? `นำเข้า ${rev}` : null, hasLegacy ? 'มีหน้าปกเดิม' : null].filter(Boolean).join(' · ')
  }

  // Cover generate — just show code
  if (a === 'document.cover_generate' || a === 'document.cover_regenerate') return safeTarget

  // Permission: target = "role:resource", detail = "Set to level"
  if (a === 'permission.update') {
    return [t, d.replace(/^Set to\s*/i, '')].filter(Boolean).join(' · ')
  }

  // Settings — action label already says it all
  if (a === 'settings.update') return ''

  // Signature upload — show dimensions only
  if (a === 'document_profile.signature_upload' || a === 'document_profile.signature_upload_self') {
    const dims = d.match(/(\d+x\d+)/)?.[1]
    return dims ? `ขนาด ${dims}` : ''
  }

  // Personnel / profile — UUID targets, no useful detail
  if (a.startsWith('personnel.')) {
    if (a === 'personnel.org.delete') {
      const count = d.match(/\d+/)?.[0]
      return count ? `${count} รายการ` : ''
    }
    return ''
  }
  if (a.startsWith('document_profile.')) return ''

  // General document actions: detail often starts with "CODE · ..."
  // Avoid duplicating the code when target === detail prefix
  if (safeTarget && d.startsWith(safeTarget + ' · ')) {
    return d  // detail already contains code + info — use as-is
  }
  if (safeTarget && d && d !== safeTarget) {
    return `${safeTarget} · ${d}`.slice(0, 140)
  }
  return (d || safeTarget).slice(0, 140)
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async (p: number, cat: string, f: string, t: string) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setSelected(new Set())
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

  function toggleRow(id: string) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function toggleAll() {
    if (selected.size === data.length) setSelected(new Set())
    else setSelected(new Set(data.map(r => r.id)))
  }

  async function deleteSelected() {
    if (selected.size === 0 || deleting) return
    if (!confirm(`ลบ ${selected.size} รายการที่เลือก?`)) return
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/activity', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected] }),
      })
      if (res.ok) fetchData(page, category, from, to)
    } finally {
      setDeleting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const hasFilters = category !== '' || from !== '' || to !== ''
  const allSelected = data.length > 0 && selected.size === data.length

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
          {selected.size > 0 && (
            <Button variant="danger" size="sm" onClick={deleteSelected} disabled={deleting}>
              {deleting ? 'กำลังลบ...' : `ลบ ${selected.size} รายการ`}
            </Button>
          )}
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
                <th style={{ padding: '9px 12px 9px 16px', width: 36 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                </th>
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
                    {[36, 120, 160, 280, 130].map((w, j) => (
                      <td key={j} style={{ padding: '10px 16px' }}>
                        <div style={{ height: 13, borderRadius: 4, background: 'var(--surface-2)', width: w }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                    ไม่พบกิจกรรม
                  </td>
                </tr>
              ) : (
                data.map(row => (
                  <tr
                    key={row.id}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s', background: selected.has(row.id) ? 'var(--primary-soft, rgba(30,95,173,.06))' : 'transparent' }}
                    onMouseEnter={e => { if (!selected.has(row.id)) e.currentTarget.style.background = 'var(--surface-2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = selected.has(row.id) ? 'var(--primary-soft, rgba(30,95,173,.06))' : 'transparent' }}
                  >
                    <td style={{ padding: '9px 12px 9px 16px' }}>
                      <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)} style={{ cursor: 'pointer' }} />
                    </td>
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
