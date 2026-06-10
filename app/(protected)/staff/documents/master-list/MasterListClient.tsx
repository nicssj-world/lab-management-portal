'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { StickyScroll } from '@/components/ui/StickyScroll'
import { DocumentUploadModal } from '@/components/documents/DocumentUploadModal'
import type { Document } from '@/lib/supabase/types'

// ── Constants ─────────────────────────────────────────────────
const TYPE_TABS = ['All', 'QP', 'WI', 'Form', 'Policy', 'Manual', 'Record', 'Reference', 'Card file', 'Others'] as const

const DEPARTMENTS = [
  'กลุ่มงานเทคนิคการแพทย์',
  'งานคลังเลือด',
  'งานจุลชีววิทยาคลินิก',
  'งานโลหิตวิทยาคลินิก',
  'งานภูมิคุ้มกันวิทยาคลินิก',
  'งานจุลทรรศน์ศาสตร์คลินิก',
  'งานเคมีคลินิก',
  'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี',
  'งานอณูชีววิทยา',
  'งานตรวจพิเศษและปฏิบัติการตรวจต่อ',
] as const

const TYPE_COLORS: Record<string, 'blue' | 'teal' | 'purple' | 'amber' | 'green' | 'gray' | 'red'> = {
  QP: 'blue', WI: 'teal', Form: 'purple', Policy: 'amber', Manual: 'green', Record: 'gray',
  Reference: 'red', 'Card file': 'amber', Others: 'gray',
}
const TYPE_DOT_FG: Record<string, string> = {
  QP: '#1E5FAD', WI: '#0D9488', Form: '#9333EA',
  Policy: '#D97706', Manual: '#16A34A', Record: '#64748B',
  Reference: '#EA580C', 'Card file': '#F59E0B', Others: '#64748B',
}

type DocStatus = 'Draft' | 'Review' | 'Approved' | 'Published' | 'Obsolete'

const STATUS_COLOR: Record<DocStatus, 'gray' | 'amber' | 'blue' | 'green' | 'red'> = {
  Draft: 'gray', Review: 'amber', Approved: 'blue', Published: 'green', Obsolete: 'red',
}
const STATUS_LABEL: Record<DocStatus, string> = {
  Draft: 'Draft', Review: 'Review', Approved: 'Approved', Published: 'Published', Obsolete: 'Obsolete',
}
const ALL_DOC_STATUSES: DocStatus[] = ['Draft', 'Review', 'Approved', 'Published', 'Obsolete']

// ── Helpers ───────────────────────────────────────────────────
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Toast ─────────────────────────────────────────────────────
interface ToastMsg { id: number; msg: string; ok: boolean }
function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const counter = useRef(0)
  const add = useCallback((msg: string, ok = true) => {
    const id = ++counter.current
    setToasts((t) => [...t, { id, msg, ok }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  return { toasts, add }
}

const PAGE_SIZE = 50

// ── Main Component ─────────────────────────────────────────────
interface Props { userRole?: string }

export function MasterListClient({ userRole }: Props) {
const { toasts, add: toast } = useToast()

  const [docs, setDocs]         = useState<Document[]>([])
  const [count, setCount]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [activeType, setActiveType] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState('')
  const [department, setDepartment] = useState('')
  const [page, setPage]         = useState(0)
  const [sortBy, setSortBy]     = useState('document_code')
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('asc')

  const [modalOpen, setModalOpen] = useState(false)
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({})
  const [exportMenu, setExportMenu]       = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  const timer = useRef<NodeJS.Timeout | null>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  // One-time fetch to build type count summary (all docs, no filter)
  useEffect(() => {
    fetch('/api/admin/documents?pageSize=9999')
      .then(r => r.json())
      .then((j) => {
        const counts: Record<string, number> = { All: j.count ?? 0 }
        for (const doc of (j.data ?? []) as Document[]) {
          counts[doc.type] = (counts[doc.type] ?? 0) + 1
        }
        setTypeCounts(counts)
      })
      .catch(() => {})
  }, [])

  const doLoad = useCallback(async (
    s: string, type: string, status: string, dept: string,
    pg: number, sb: string, sd: 'asc' | 'desc'
  ) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pg + 1), pageSize: String(PAGE_SIZE), sortBy: sb, sortDir: sd,
      })
      if (s)       params.set('search', s)
      if (type && type !== 'All') params.set('type', type)
      if (status)  params.set('status', status)
      if (dept)    params.set('department', dept)
      const j = await fetch(`/api/admin/documents?${params}`).then(r => r.json())
      setDocs(j.data ?? [])
      setCount(j.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(
      () => doLoad(search, activeType, statusFilter, department, 0, sortBy, sortDir),
      search ? 350 : 0
    )
    setPage(0)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [search, activeType, statusFilter, department, sortBy, sortDir, doLoad])

  function handlePageChange(p: number) {
    setPage(p)
    doLoad(search, activeType, statusFilter, department, p, sortBy, sortDir)
  }

  function handleSort(col: string) {
    const dir = sortBy === col && sortDir === 'asc' ? 'desc' : 'asc'
    setSortBy(col); setSortDir(dir); setPage(0)
  }

  function SortIcon({ col }: { col: string }) {
    const base: React.CSSProperties = { display: 'inline-block', verticalAlign: 'middle', marginLeft: 3, flexShrink: 0 }
    if (sortBy !== col) return <Icon name="chevDown" size={11} style={{ ...base, color: 'var(--border)' }} />
    return <Icon name="chevDown" size={11} style={{ ...base, color: 'var(--primary)', transform: sortDir === 'asc' ? 'rotate(180deg)' : 'none' }} />
  }

  async function handleDownload(doc: Document) {
    try {
      const res = await fetch(`/api/admin/documents/download?path=${encodeURIComponent(doc.file_url)}`)
      const { url } = await res.json()
      if (!url) { toast('ไม่สามารถดาวน์โหลดได้', false); return }
      window.open(url, '_blank')
    } catch { toast('เกิดข้อผิดพลาด', false) }
  }

  function handleAdded(added: Document) {
    setDocs(prev => [added, ...prev])
    setCount(prev => prev + 1)
    setModalOpen(false)
    toast('เพิ่มเอกสารแล้ว')
  }

  function clearFilters() {
    setSearch(''); setActiveType('All'); setStatusFilter(''); setDepartment(''); setPage(0)
  }

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportMenu) return
    function handler(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [exportMenu])

  function buildMasterListHTML(allDocs: Document[], scope: 'filtered' | 'all'): string {
    const fmtD = (s: string | null) =>
      s ? new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
    const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

    const filterParts: string[] = []
    if (scope === 'filtered') {
      if (activeType && activeType !== 'All') filterParts.push(`ประเภท: ${activeType}`)
      if (statusFilter) filterParts.push(`สถานะ: ${statusFilter}`)
      if (department) filterParts.push(`แผนก: ${department}`)
      if (search) filterParts.push(`ค้นหา: "${search}"`)
    }

    const ROWS_PER_PAGE = 18
    const pages: (Document | null)[][] = []
    for (let i = 0; i < Math.max(allDocs.length, 1); i += ROWS_PER_PAGE) {
      pages.push(allDocs.slice(i, i + ROWS_PER_PAGE))
    }

    const theadHtml = `<thead><tr>
      <th class="c">ลำดับ</th>
      <th>รหัสเอกสาร</th>
      <th class="l wrap col-fill">ชื่อเอกสาร</th>
      <th class="c">ประเภท</th>
      <th class="c">Rev.</th>
      <th class="c">สถานะ</th>
      <th class="c">วันที่ทบทวน</th>
      <th class="c">วันที่บังคับใช้</th>
      <th class="c wrap col-fill-sm">แผนก</th>
      <th class="c">ผู้จัดทำ</th>
      <th class="c">ผู้รับรอง</th>
      <th class="c">ผู้อนุมัติ</th>
    </tr></thead>`

    let rowIdx = 1
    const pagesHtml = pages.map((page, pageIndex) => {
      const isLastPage = pageIndex === pages.length - 1
      const filledRows = [...page]
      if (!isLastPage) {
        while (filledRows.length < ROWS_PER_PAGE) filledRows.push(null)
      }
      const tbodyHtml = filledRows.map((doc) => {
        if (!doc) return `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`
        return `<tr>
          <td class="c muted">${rowIdx++}</td>
          <td class="c mono">${doc.document_code}</td>
          <td class="l wrap col-fill">${doc.title}</td>
          <td class="c">${doc.type}</td>
          <td class="c muted">${doc.revision}</td>
          <td class="c">${doc.status}</td>
          <td class="c muted">${fmtD(doc.expiry_date)}</td>
          <td class="c muted">${fmtD(doc.effective_date)}</td>
          <td class="c wrap col-fill-sm">${doc.department || '—'}</td>
          <td class="c muted">${doc.owner_name || '—'}</td>
          <td class="c muted">${doc.reviewer_name || '—'}</td>
          <td class="c muted">${doc.approver_name || '—'}</td>
        </tr>`
      }).join('')
      return `
        <div class="page">
          <div class="page-header">
            <div class="main-title">บัญชีรายการเอกสารคุณภาพ (Master List)</div>
            <div class="sub-title">กลุ่มงานเทคนิคการแพทย์โรงพยาบาลชลบุรี</div>
            <div class="meta-row">
              <span>${filterParts.length ? filterParts.join(' · ') : 'แสดงเอกสารทั้งหมด'}</span>
              <span>วันที่พิมพ์: ${today}</span>
            </div>
          </div>
          <table>${theadHtml}<tbody>${tbodyHtml}</tbody></table>
          <div class="page-footer">
            <span class="footer-spacer"></span>
            <span class="footer-center">เอกสารนี้เป็นสมบัติของกลุ่มงานเทคนิคการแพทย์โรงพยาบาลชลบุรี ห้ามนำออกไปใช้ภายนอกหรือทำซ้ำโดยไม่ได้รับอนุญาต</span>
            <span class="footer-right">Fm-QP-LAB-01/ML</span>
          </div>
        </div>`
    }).join('')

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Master List</title><style>
      @page { size: A4 landscape; margin: 8mm 10mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'TH Sarabun New','Sarabun','Cordia New',Arial,sans-serif; font-size: 9.5pt; color: #000; }
      .page { page-break-after: always; display: flex; flex-direction: column; height: 192mm; }
      .page:last-child { page-break-after: avoid; }
      .page-header { text-align: center; margin-bottom: 6px; flex-shrink: 0; }
      .main-title { font-size: 16pt; font-weight: bold; line-height: 1.5; }
      .sub-title  { font-size: 14pt; font-weight: bold; line-height: 1.4; }
      .meta-row   { display: flex; justify-content: space-between; font-size: 9pt; color: #555; margin-top: 3px; padding: 0 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 4px; flex-shrink: 0; table-layout: auto; }
      .col-fill    { width: 999px; }
      .col-fill-sm { width: 300px; }
      th, td { border: 1px solid #000; padding: 2px 4px; font-size: 9pt; height: 22px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
      th { background: #f0f0f0; font-weight: bold; text-align: center; }
      .c { text-align: center; }
      .l { text-align: left; }
      .wrap { white-space: normal; overflow: visible; text-overflow: clip; word-break: break-word; height: auto; min-height: 22px; vertical-align: top; padding-top: 4px; padding-bottom: 4px; }
      .muted { color: #444; }
      .mono { font-family: monospace; font-size: 8.5pt; }
      .page-footer { display: flex; align-items: center; font-size: 9pt; color: #666; margin-top: auto; padding-top: 3px; border-top: 1px solid #bbb; flex-shrink: 0; }
      .footer-spacer { flex: 1; }
      .footer-center { flex: 0 1 auto; text-align: center; }
      .footer-right { flex: 1; text-align: right; white-space: nowrap; }
    </style></head><body>${pagesHtml}</body></html>`
  }

  async function downloadMasterListPDF(scope: 'filtered' | 'all') {
    setExportMenu(false)
    setExportLoading(true)
    try {
      const sp = new URLSearchParams({ pageSize: '9999', sortBy, sortDir })
      if (scope === 'filtered') {
        if (activeType && activeType !== 'All') sp.set('type', activeType)
        if (statusFilter) sp.set('status', statusFilter)
        if (department)   sp.set('department', department)
        if (search)       sp.set('search', search)
      }
      const json = await fetch(`/api/admin/documents?${sp}`).then(r => r.json())
      const allDocs: Document[] = json.data ?? []
      const html = buildMasterListHTML(allDocs, scope)
      const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
      const win = window.open(blobUrl, '_blank')
      if (!win) { URL.revokeObjectURL(blobUrl); return }
      win.addEventListener('load', () => { win.print(); URL.revokeObjectURL(blobUrl) }, { once: true })
    } catch {
      toast('ไม่สามารถ Export PDF ได้', false)
    } finally {
      setExportLoading(false)
    }
  }

  const hasFilter = search || activeType !== 'All' || statusFilter || department
  const totalPages = Math.ceil(count / PAGE_SIZE)

  const thStyle: React.CSSProperties = {
    padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    textTransform: 'uppercase', letterSpacing: '.04em',
    background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap', userSelect: 'none',
  }
  const tdStyle: React.CSSProperties = {
    padding: '10px 12px', fontSize: 12.5, color: 'var(--ink)',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', verticalAlign: 'middle',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <PageHeader
          eyebrow="Documents Master List"
          title="ทะเบียนเอกสารคุณภาพ"
          actions={undefined}
          marginBottom={0}
        />
        {/* Type count summary */}
        {typeCounts.All !== undefined && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{typeCounts.All}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>เอกสารทั้งหมด</span>
          </div>
          {(Object.entries(typeCounts) as [string, number][])
            .filter(([k, v]) => k !== 'All' && v > 0)
            .map(([type, n]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_DOT_FG[type] ?? 'var(--muted)' }} />
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{type} {n}</span>
              </div>
            ))
          }
        </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <Input
            placeholder="ค้นหารหัส / ชื่อเอกสาร..."
            value={search}
            onChange={setSearch}
            icon="search"
          />
        </div>
        <select
          value={department}
          onChange={e => { setDepartment(e.target.value); setPage(0) }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', cursor: 'pointer' }}
        >
          <option value="">ทุกแผนก</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', cursor: 'pointer' }}
        >
          <option value="">ทุกสถานะ</option>
          {ALL_DOC_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        {hasFilter && (
          <button onClick={clearFilters} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
            ล้างตัวกรอง
          </button>
        )}

        {/* Export PDF split button */}
        <div ref={exportMenuRef} style={{ position: 'relative', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              onClick={() => downloadMasterListPDF('filtered')}
              disabled={exportLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'transparent', border: 'none', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', cursor: exportLoading ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: exportLoading ? .6 : 1 }}
            >
              <Icon name="download" size={13} />
              {exportLoading ? 'กำลัง Export...' : 'Export PDF'}
            </button>
            <button
              onClick={() => setExportMenu(v => !v)}
              disabled={exportLoading}
              style={{ display: 'flex', alignItems: 'center', padding: '8px 8px', background: 'transparent', border: 'none', borderLeft: '1px solid var(--border)', cursor: exportLoading ? 'not-allowed' : 'pointer', color: 'var(--muted)' }}
            >
              <Icon name="chevDown" size={12} />
            </button>
          </div>
          {exportMenu && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 200, minWidth: 180, overflow: 'hidden' }}>
              <button onClick={() => downloadMasterListPDF('filtered')}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'transparent', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--ink)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Export ตามตัวกรองปัจจุบัน
              </button>
              <button onClick={() => downloadMasterListPDF('all')}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'transparent', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--ink)', borderTop: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Export ทุกเอกสาร
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Type tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TYPE_TABS.map(t => (
          <button key={t} onClick={() => { setActiveType(t); setPage(0) }} style={{
            padding: '5px 14px', borderRadius: 20, border: '1px solid var(--border)', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13, transition: 'all .15s',
            background: activeType === t ? 'var(--surface-2)' : 'transparent',
            color: activeType === t ? 'var(--ink)' : 'var(--muted)',
            fontWeight: activeType === t ? 700 : 500,
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card padding={0}>
        <StickyScroll contentWidth={1400}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1400 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 48, textAlign: 'center' }}>ลำดับ</th>
                <th style={{ ...thStyle, cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('document_code')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>รหัสเอกสาร <SortIcon col="document_code" /></span>
                </th>
                <th style={{ ...thStyle, minWidth: 200 }}>ชื่อเอกสาร</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>ประเภท</th>
                <th style={{ ...thStyle, minWidth: 140, textAlign: 'center' }}>แผนก</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Rev.</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>สถานะ</th>
                <th style={{ ...thStyle, cursor: 'pointer', textAlign: 'center' }} onClick={() => handleSort('effective_date')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>วันที่บังคับใช้ <SortIcon col="effective_date" /></span>
                </th>
                <th style={{ ...thStyle, textAlign: 'center' }}>วันที่ทบทวน</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>ผู้จัดทำ</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>ผู้รับรอง</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>ผู้อนุมัติ</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>วันที่ยกเลิก</th>
                <th style={{ ...thStyle, minWidth: 160, textAlign: 'center' }}>เหตุผลยกเลิก</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>ไฟล์</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 15 }).map((_, j) => (
                      <td key={j} style={tdStyle}>
                        <div style={{ height: 14, borderRadius: 4, background: 'var(--surface-2)', width: j === 2 ? 180 : j === 0 ? 28 : 70 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : docs.length === 0 ? (
                <tr>
                  <td colSpan={15} style={{ padding: '48px 0' }}>
                    <EmptyState icon="doc" title="ไม่พบเอกสาร" hint={hasFilter ? 'ลองเปลี่ยนตัวกรอง' : 'ยังไม่มีเอกสารในระบบ'} />
                  </td>
                </tr>
              ) : (
                docs.map((doc, i) => (
                  <tr
                    key={doc.id}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* ลำดับ */}
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                      {page * PAGE_SIZE + i + 1}
                    </td>

                    {/* รหัสเอกสาร */}
                    <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
                      {doc.document_code}
                    </td>

                    {/* ชื่อเอกสาร */}
                    <td style={{ ...tdStyle, minWidth: 200, maxWidth: 280 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.title}>
                        {doc.title}
                      </div>
                    </td>

                    {/* ประเภท */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <Badge color={TYPE_COLORS[doc.type] ?? 'gray'} size="sm">{doc.type}</Badge>
                    </td>

                    {/* แผนก */}
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)', maxWidth: 160 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.department ?? ''}>
                        {doc.department || '—'}
                      </div>
                    </td>

                    {/* Rev. */}
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)' }}>
                      {doc.revision}
                    </td>

                    {/* สถานะ */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <Badge color={STATUS_COLOR[doc.status as DocStatus] ?? 'gray'} size="sm">
                        {STATUS_LABEL[doc.status as DocStatus] ?? doc.status}
                      </Badge>
                    </td>

                    {/* วันที่บังคับใช้ */}
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)' }}>{fmtDate(doc.effective_date)}</td>

                    {/* วันที่ทบทวน */}
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)' }}>{fmtDate(doc.expiry_date)}</td>

                    {/* ผู้จัดทำ */}
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)' }}>{doc.owner_name || '—'}</td>

                    {/* ผู้รับรอง */}
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)' }}>{doc.reviewer_name || '—'}</td>

                    {/* ผู้อนุมัติ */}
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--muted)' }}>{doc.approver_name || '—'}</td>

                    {/* วันที่ยกเลิก */}
                    <td style={{ ...tdStyle, textAlign: 'center', color: doc.obsolete_date ? 'var(--danger)' : 'var(--muted)' }}>
                      {fmtDate(doc.obsolete_date)}
                    </td>

                    {/* เหตุผลยกเลิก */}
                    <td style={{ ...tdStyle, textAlign: 'center', maxWidth: 160, color: 'var(--muted)' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.obsolete_reason ?? ''}>
                        {doc.obsolete_reason || '—'}
                      </div>
                    </td>

                    {/* ไฟล์ */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button
                        onClick={() => handleDownload(doc)}
                        title={doc.file_name}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Icon name="download" size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </StickyScroll>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, count)} จาก {count} รายการ
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={page === 0} onClick={() => handlePageChange(page - 1)}
                style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--muted)', opacity: page === 0 ? 0.4 : 1 }}>
                ก่อนหน้า
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }).map((_, idx) => {
                const p = totalPages <= 7 ? idx : page < 4 ? idx : page > totalPages - 4 ? totalPages - 7 + idx : page - 3 + idx
                return (
                  <button key={p} onClick={() => handlePageChange(p)}
                    style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: p === page ? 'var(--primary)' : 'transparent', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', color: p === page ? '#fff' : 'var(--muted)', fontWeight: p === page ? 700 : 400 }}>
                    {p + 1}
                  </button>
                )
              })}
              <button disabled={page >= totalPages - 1} onClick={() => handlePageChange(page + 1)}
                style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--muted)', opacity: page >= totalPages - 1 ? 0.4 : 1 }}>
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Upload Modal */}
      {modalOpen && (
        <DocumentUploadModal
          userRole={userRole}
          onClose={() => setModalOpen(false)}
          onSaved={handleAdded}
        />
      )}

      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '11px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500,
            background: t.ok ? 'var(--success)' : 'var(--danger)', color: '#fff',
            boxShadow: '0 4px 16px rgba(0,0,0,.2)', animation: 'slideIn .2s ease',
          }}>
            {t.msg}
          </div>
        ))}
      </div>
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  )
}
