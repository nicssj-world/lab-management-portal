'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { RejectionLog, RejectionSummary } from '@/lib/queries/rejection'
import type { RejectionUpload } from '@/lib/queries/rejection'
import RejectionUploadModal from './RejectionUploadModal'
import RejectionHistoryModal from './RejectionHistoryModal'

// ─── Types ──────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'reject' | 'ward' | 'yearly_trend' | 'monthly_trend' | 'other_detail' | 'monthly_data'

const TABS: { id: TabId; label: string; short: string }[] = [
  { id: 'overview',      label: 'ภาพรวม',           short: 'ภาพรวม' },
  { id: 'reject',        label: 'ประเภท Reject',      short: 'Reject' },
  { id: 'ward',          label: 'Ward Ranking',       short: 'Ward' },
  { id: 'yearly_trend',  label: 'แนวโน้มรายปี',       short: 'รายปี' },
  { id: 'monthly_trend', label: 'แนวโน้มรายเดือน',    short: 'รายเดือน' },
  { id: 'other_detail',  label: 'รายละเอียด อื่นๆ',   short: 'อื่นๆ' },
  { id: 'monthly_data',  label: 'ข้อมูลรายเดือน',     short: 'ข้อมูล' },
]

const CHART_COLORS = ['#1E5FAD', '#0D9488', '#7C3AED', '#D97706', '#DC2626', '#059669', '#DB2777', '#6366F1']
const YEARS = ['ทั้งหมด', '2022', '2023', '2024', '2025', '2026']

const REJECT_BADGE_COLORS: Record<string, { bg: string; color: string }> = {}
const PALETTE = [
  { bg: '#EFF6FF', color: '#1D4ED8' },
  { bg: '#F0FDF4', color: '#15803D' },
  { bg: '#FFF7ED', color: '#C2410C' },
  { bg: '#FDF4FF', color: '#7E22CE' },
  { bg: '#FEF2F2', color: '#B91C1C' },
  { bg: '#ECFDF5', color: '#065F46' },
  { bg: '#FFFBEB', color: '#92400E' },
  { bg: '#F0F9FF', color: '#075985' },
]
let _paletteIdx = 0
function getRejectBadge(reason: string | null | undefined): { bg: string; color: string } {
  const key = reason ?? '—'
  if (!REJECT_BADGE_COLORS[key]) {
    REJECT_BADGE_COLORS[key] = PALETTE[_paletteIdx % PALETTE.length]
    _paletteIdx++
  }
  return REJECT_BADGE_COLORS[key]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getThaiMonth(m: number): string {
  return ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][m - 1] ?? String(m)
}

function currentMonthStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthThai(ym: string): string {
  const [y, m] = ym.split('-')
  return `${getThaiMonth(parseInt(m))} ${parseInt(y) + 543}`
}

function pctChange(curr: number, prev: number): string {
  if (prev === 0) return curr > 0 ? '+100%' : '—'
  const pct = ((curr - prev) / prev) * 100
  return (pct > 0 ? '+' : '') + pct.toFixed(1) + '%'
}

function pctChangeColor(curr: number, prev: number): string {
  if (prev === 0) return 'var(--muted)'
  return curr <= prev ? 'var(--success)' : 'var(--danger)'
}

function pctChangeDir(curr: number, prev: number): 'up' | 'down' | 'flat' {
  if (prev === 0) return 'flat'
  return curr > prev ? 'up' : curr < prev ? 'down' : 'flat'
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([])
  const counter = useRef(0)
  const add = useCallback((msg: string, ok = true) => {
    const id = ++counter.current
    setToasts(t => [...t, { id, msg, ok }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])
  return { toasts, add }
}

// ─── Pill button ─────────────────────────────────────────────────────────────

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 14px', borderRadius: 20,
        border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
        background: active ? 'var(--primary)' : 'transparent',
        color: active ? '#fff' : 'var(--muted)',
        fontWeight: active ? 700 : 500, fontSize: 12.5,
        cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
      }}
    >
      {label}
    </button>
  )
}

// ─── Ward bar row ─────────────────────────────────────────────────────────────

function WardBar({ item, rank, max }: { item: { ward: string; total: number }; rank: number; max: number }) {
  const pct = (item.total / Math.max(max, 1)) * 100
  const isTop3 = rank < 3
  const accentColors = [
    'linear-gradient(90deg,#EF4444,#DC2626)',
    'linear-gradient(90deg,#F97316,#EA580C)',
    'linear-gradient(90deg,#EAB308,#CA8A04)',
  ]
  const barColor = isTop3 ? accentColors[rank] : 'linear-gradient(90deg,#3B82F6,#1D4ED8)'
  const rankBg = isTop3 ? ['#FEF2F2','#FFF7ED','#FEFCE8'][rank] : 'var(--surface-2)'
  const rankColor = isTop3 ? ['#DC2626','#EA580C','#CA8A04'][rank] : 'var(--muted)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, background: rankBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800, color: rankColor, flexShrink: 0,
      }}>
        {rank + 1}
      </div>
      <div style={{ flex: 1, position: 'relative', height: 34, background: 'var(--surface-2)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, height: '100%', width: `${pct}%`,
          background: barColor, borderRadius: 8, transition: 'width 0.6s cubic-bezier(.34,1.56,.64,1)',
        }} />
        <div style={{
          position: 'relative', padding: '0 12px', height: '100%',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1,
        }}>
          <span style={{ fontSize: 12.5, color: pct > 35 ? '#fff' : 'var(--ink)', fontWeight: 600 }}>{item.ward}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: pct > 35 ? 'rgba(255,255,255,.7)' : 'var(--muted)', fontWeight: 500 }}>{pct.toFixed(1)}%</span>
            <span style={{ fontSize: 12.5, color: pct > 35 ? '#fff' : 'var(--ink)', fontWeight: 700 }}>{item.total.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

function Skeleton({ h = 14, w }: { h?: number; w?: number | string }) {
  return (
    <div style={{
      height: h, borderRadius: 6, width: w ?? '100%', marginBottom: 4,
      background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
      backgroundSize: '200% 100%',
      animation: 'rejShimmer 1.4s ease infinite',
    }} />
  )
}

// ─── Empty chart ──────────────────────────────────────────────────────────────

function EmptyChart({ label }: { label?: string }) {
  return (
    <div style={{
      height: 160, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 8,
      color: 'var(--muted)', fontSize: 13,
    }}>
      <div style={{ fontSize: 28, opacity: .3 }}>○</div>
      <span>{label ?? 'ไม่มีข้อมูล'}</span>
    </div>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <div style={{
        width: 4, height: 18, borderRadius: 2,
        background: 'linear-gradient(180deg,#1E5FAD,#0D9488)',
        flexShrink: 0, alignSelf: 'center',
      }} />
      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{title}</span>
      {sub && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</span>}
    </div>
  )
}

// ─── PDF print ────────────────────────────────────────────────────────────────

function printReport(summary: RejectionSummary, month: string, work: string) {
  const total = summary.current_total
  const html = `<!DOCTYPE html><html lang="th"><head>
    <meta charset="UTF-8">
    <style>
      @page { size: A4 portrait; margin: 8mm 12mm; }
      * { font-family: 'TH Sarabun New','Sarabun','Cordia New',Arial,sans-serif; }
      body { font-size: 14pt; color: #000; }
      h1 { font-size: 18pt; font-weight: bold; text-align: center; margin-bottom: 4px; }
      h2 { font-size: 15pt; font-weight: bold; margin: 16px 0 8px; border-bottom: 1px solid #333; }
      .sub { text-align: center; font-size: 13pt; color: #444; margin-bottom: 20px; }
      .stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 16px; }
      .stat { border: 1px solid #ccc; border-radius: 6px; padding: 8px 12px; text-align: center; }
      .stat .label { font-size: 11pt; color: #666; }
      .stat .value { font-size: 18pt; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: #f0f0f0; font-weight: bold; text-align: left; padding: 6px 8px; border: 1px solid #ccc; }
      td { padding: 5px 8px; border: 1px solid #ddd; }
      @media print { body { -webkit-print-color-adjust: exact; } }
    </style>
  </head><body>
    <h1>รายงาน Rejection Log</h1>
    <div class="sub">ห้องปฏิบัติการคลินิก — ${formatMonthThai(month)}${work !== 'ทั้งหมด' ? ' — ' + work : ''}</div>
    <div class="stats">
      <div class="stat"><div class="label">Reject ทั้งหมด</div><div class="value">${total.toLocaleString()}</div></div>
      <div class="stat"><div class="label">เทียบเดือนก่อน</div><div class="value" style="font-size:15pt">${pctChange(summary.current_total, summary.prev_total)}</div></div>
      <div class="stat"><div class="label">เหตุผลหลัก</div><div class="value" style="font-size:13pt">${summary.by_reason[0]?.reason ?? '—'}</div></div>
      <div class="stat"><div class="label">Section สูงสุด</div><div class="value" style="font-size:13pt">${summary.by_section[0]?.section ?? '—'}</div></div>
    </div>
    <h2>สาเหตุ Reject</h2>
    <table>
      <tr><th>สาเหตุ</th><th>จำนวน</th><th>%</th></tr>
      ${summary.by_reason.map(r => `<tr><td>${r.reason ?? '—'}</td><td>${r.total.toLocaleString()}</td><td>${total > 0 ? ((r.total / total) * 100).toFixed(1) : 0}%</td></tr>`).join('')}
    </table>
    <h2>ตามหน่วยงาน (Section)</h2>
    <table>
      <tr><th>Section</th><th>จำนวน</th><th>%</th></tr>
      ${summary.by_section.map(r => `<tr><td>${r.section ?? '—'}</td><td>${r.total.toLocaleString()}</td><td>${total > 0 ? ((r.total / total) * 100).toFixed(1) : 0}%</td></tr>`).join('')}
    </table>
    <h2>Ward Ranking (Top 20)</h2>
    <table>
      <tr><th>#</th><th>Ward</th><th>จำนวน</th></tr>
      ${summary.by_ward.map((r, i) => `<tr><td>${i + 1}</td><td>${r.ward}</td><td>${r.total.toLocaleString()}</td></tr>`).join('')}
    </table>
    <div style="text-align:center;color:#999;font-size:11pt;margin-top:20px">
      พิมพ์เมื่อ ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
    </div>
  </body></html>`

  const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const win = window.open(blobUrl, '_blank')
  win?.addEventListener('load', () => { win.print(); URL.revokeObjectURL(blobUrl) }, { once: true })
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(logs: RejectionLog[], month: string) {
  const header = 'วันที่,Specimen,Reject,Section,Ward'
  const rows = logs.map(r =>
    [r.spcmdate, r.labspcmnm ?? '', r.reject ?? '', r.work ?? '', r.ward ?? ''].join(',')
  )
  const blob = new Blob(['﻿' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `rejection_${month}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { canEdit: boolean }

export default function RejectionClient({ canEdit }: Props) {
  // ── Filter state (tabs 1-6) ──────────────────────────────
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()))
  const [filterWork, setFilterWork] = useState<string>('ทั้งหมด')
  const [tab, setTab] = useState<TabId>('overview')

  // ── Summary (tabs 1-6) ───────────────────────────────────
  const [summary, setSummary] = useState<RejectionSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  // ── Monthly data tab ─────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr())
  const [monthSummary, setMonthSummary] = useState<RejectionSummary | null>(null)
  const [monthSummaryLoading, setMonthSummaryLoading] = useState(false)
  const [logs, setLogs] = useState<RejectionLog[]>([])
  const [logCount, setLogCount] = useState(0)
  const [tableLoading, setTableLoading] = useState(false)
  const [filterReason, setFilterReason] = useState('')
  const [page, setPage] = useState(1)

  // ── Sections list (from summary) ─────────────────────────
  const [sections, setSections] = useState<string[]>([])

  // ── Modals ───────────────────────────────────────────────
  const [showUpload, setShowUpload] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // ── Toast ────────────────────────────────────────────────
  const { toasts, add: addToast } = useToast()

  // ── Fetch summary for tabs 1-6 ───────────────────────────
  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const params = new URLSearchParams()
      if (filterYear !== 'ทั้งหมด') params.set('filter_year', filterYear)
      if (filterWork !== 'ทั้งหมด') params.set('work', filterWork)
      const res = await fetch(`/api/admin/rejection/summary?${params}`)
      const data = await res.json()
      if (res.ok) {
        setSummary(data as RejectionSummary)
        const secs = [...new Set((data.by_section ?? []).map((r: { section: string }) => r.section))].filter(Boolean) as string[]
        if (secs.length > 0) setSections(secs)
      } else {
        setSummaryError(data?.error ?? 'โหลดข้อมูลไม่ได้')
      }
    } catch {
      setSummaryError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
    } finally {
      setSummaryLoading(false)
    }
  }, [filterYear, filterWork])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  // ── Fetch summary for monthly_data tab ───────────────────
  const fetchMonthSummary = useCallback(async () => {
    setMonthSummaryLoading(true)
    try {
      const [y, m] = selectedMonth.split('-')
      const params = new URLSearchParams({ year: y, month: m })
      if (filterWork !== 'ทั้งหมด') params.set('work', filterWork)
      const res = await fetch(`/api/admin/rejection/summary?${params}`)
      const data = await res.json()
      if (res.ok) setMonthSummary(data as RejectionSummary)
    } finally {
      setMonthSummaryLoading(false)
    }
  }, [selectedMonth, filterWork])

  useEffect(() => {
    if (tab === 'monthly_data') fetchMonthSummary()
  }, [tab, fetchMonthSummary])

  // ── Fetch log table ───────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setTableLoading(true)
    try {
      const [y, m] = selectedMonth.split('-')
      const params = new URLSearchParams({ year: y, month: m, page: String(page) })
      if (filterReason) params.set('reject', filterReason)
      const res = await fetch(`/api/admin/rejection?${params}`)
      const json = await res.json()
      if (res.ok) { setLogs(json.data ?? []); setLogCount(json.count ?? 0) }
    } finally {
      setTableLoading(false)
    }
  }, [selectedMonth, filterReason, page])

  useEffect(() => {
    if (tab === 'monthly_data') fetchLogs()
  }, [tab, fetchLogs])

  // ── Spike detection ───────────────────────────────────────
  function getSpiked(s: RejectionSummary): Set<string> {
    return new Set(
      s.by_reason.filter(curr => {
        const prev = s.by_reason_prev.find(p => p.reason === curr.reason)?.total ?? 0
        return prev > 0 && (curr.total - prev) / prev > 0.2
      }).map(r => r.reason)
    )
  }

  // ── Month selector state ──────────────────────────────────
  const [selYear, setSelYear] = useState<number>(new Date().getFullYear())
  const [selMonth, setSelMonth] = useState<number>(new Date().getMonth() + 1)

  useEffect(() => {
    setSelectedMonth(`${selYear}-${String(selMonth).padStart(2, '0')}`)
    setPage(1)
  }, [selYear, selMonth])

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Keyframe animations */}
      <style>{`
        @keyframes rejShimmer {
          0% { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
        @keyframes rejToastIn {
          from { opacity: 0; transform: translateY(12px) scale(.96) }
          to   { opacity: 1; transform: translateY(0) scale(1) }
        }
        @keyframes rejFadeUp {
          from { opacity: 0; transform: translateY(8px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        .rej-tab-btn:hover { background: var(--surface-2) !important; color: var(--ink) !important; }
        .rej-pill-year:hover { border-color: var(--primary) !important; color: var(--primary) !important; }
        .rej-row:hover td { background: var(--surface-2) !important; }
      `}</style>

      <PageHeader
        eyebrow="คุณภาพ"
        title="Rejection Log"
        subtitle="บันทึกและวิเคราะห์การปฏิเสธตัวอย่าง"
        marginBottom={0}
        actions={
          <>
            <Button variant="secondary" icon="clock" onClick={() => setShowHistory(true)}>
              ประวัติ Upload
            </Button>
            {canEdit && (
              <Button variant="primary" icon="upload" onClick={() => setShowUpload(true)}>
                Upload
              </Button>
            )}
          </>
        }
      />

      {/* ── Tab bar ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 2, overflowX: 'auto',
        background: 'var(--surface-2)', borderRadius: 12, padding: 4,
        scrollbarWidth: 'none',
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className="rej-tab-btn"
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 16px', borderRadius: 9, border: 'none',
              background: tab === t.id
                ? 'var(--card)'
                : 'transparent',
              color: tab === t.id ? 'var(--primary)' : 'var(--muted)',
              fontWeight: tab === t.id ? 700 : 500, fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all .18s',
              whiteSpace: 'nowrap',
              boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Error banner ────────────────────────────────── */}
      {summaryError && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12,
          padding: '14px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
          animation: 'rejFadeUp .25s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: '#FEE2E2',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ fontSize: 18 }}>⚠</span>
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--danger)' }}>โหลดข้อมูลไม่ได้</div>
              <div style={{ fontSize: 12.5, color: '#B91C1C', marginTop: 2 }}>{summaryError}</div>
              {summaryError.toLowerCase().includes('function') && (
                <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 6, lineHeight: 1.5 }}>
                  ➜ กรุณารัน <code style={{ background: '#FEE2E2', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>rejection_migration.sql</code> ใน Supabase SQL Editor ก่อน
                </div>
              )}
            </div>
          </div>
          <button
            onClick={fetchSummary}
            style={{
              padding: '7px 16px', borderRadius: 8, border: '1px solid #FECACA',
              background: 'var(--card)', color: 'var(--danger)', fontSize: 12.5,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            ลองใหม่
          </button>
        </div>
      )}

      {/* ── Filter bar (tabs 1-6) ────────────────────────── */}
      {tab !== 'monthly_data' && (
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '12px 16px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', minWidth: 28 }}>ปี</span>
            <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
            {YEARS.map(y => (
              <Pill key={y} label={y} active={filterYear === y} onClick={() => setFilterYear(y)} />
            ))}
          </div>
          {sections.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', minWidth: 28 }}>Lab</span>
              <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
              <Pill label="ทั้งหมด" active={filterWork === 'ทั้งหมด'} onClick={() => setFilterWork('ทั้งหมด')} />
              {sections.map(s => (
                <Pill key={s} label={s} active={filterWork === s} onClick={() => setFilterWork(s)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* Tab: ภาพรวม                                       */}
      {/* ══════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'rejFadeUp .2s ease' }}>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {summaryLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                  <Skeleton h={12} w={80} />
                  <Skeleton h={36} w={100} />
                </div>
              ))
            ) : summary ? (
              <>
                <StatCard
                  label="Reject ทั้งหมด" value={summary.current_total.toLocaleString()}
                  sub={pctChange(summary.current_total, summary.prev_total)}
                  subColor={pctChangeColor(summary.current_total, summary.prev_total)}
                  dir={pctChangeDir(summary.current_total, summary.prev_total)}
                  accent="#1E5FAD"
                />
                <StatCard label="ประเภท Reject" value={String(summary.by_reason.length)} accent="#0D9488" />
                <StatCard label="Ward สูงสุด" value={summary.by_ward[0]?.ward ?? '—'} small accent="#7C3AED" />
                <StatCard label="Reject อันดับ 1" value={summary.by_reason[0]?.reason ?? '—'} small accent="#D97706" />
              </>
            ) : null}
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <SectionHead title="ยอดรวมรายปี" />
              {summaryLoading ? <Skeleton h={200} /> : summary && summary.yearly_trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={summary.yearly_trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="yr" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v) => Number(v).toLocaleString()}
                      contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,.1)', fontSize: 12 }}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {summary.yearly_trend.map((entry, i) => (
                        <Cell key={i} fill={String(entry.yr) === filterYear ? '#1E5FAD' : '#BFDBFE'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </div>

            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <SectionHead title="แยกตาม Section" />
              {summaryLoading ? <Skeleton h={200} /> : summary && summary.by_section.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={summary.by_section.slice(0, 6)} dataKey="total" nameKey="section" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3}>
                      {summary.by_section.slice(0, 6).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v) => Number(v).toLocaleString()}
                      contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 12 }}
                    />
                    <Legend iconSize={9} formatter={(v: string) => <span style={{ fontSize: 11, color: 'var(--ink)' }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </div>
          </div>

          {/* Specimen horizontal bar */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <SectionHead title="Top 10 — ชนิดตัวอย่าง" />
            {summaryLoading ? <Skeleton h={200} /> : summary && summary.by_specimen.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(200, summary.by_specimen.length * 32)}>
                <BarChart layout="vertical" data={summary.by_specimen} margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="specimen" type="category" tick={{ fontSize: 11 }} width={120} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => Number(v).toLocaleString()}
                    contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 12 }}
                  />
                  <Bar dataKey="total" fill="#0D9488" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* Tab: ประเภท Reject                                 */}
      {/* ══════════════════════════════════════════════════ */}
      {tab === 'reject' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, animation: 'rejFadeUp .2s ease' }}>
          <SectionHead title="สาเหตุการ Reject" sub={summary ? `${summary.by_reason.length} ประเภท` : undefined} />
          {summaryLoading ? <Skeleton h={300} /> : summary && summary.by_reason.length > 0 ? (() => {
            const spiked = getSpiked(summary)
            return (
              <>
                <ResponsiveContainer width="100%" height={Math.max(300, summary.by_reason.length * 42)}>
                  <BarChart layout="vertical" data={summary.by_reason} margin={{ top: 4, right: 80, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="reason" type="category" tick={{ fontSize: 12 }} width={160} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v, _name, props) => {
                        const reason = (props as { payload?: { reason: string } }).payload?.reason ?? ''
                        return [Number(v).toLocaleString() + (spiked.has(reason) ? '  ⚠ Spike' : ''), 'จำนวน']
                      }}
                      contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 12 }}
                    />
                    <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                      {summary.by_reason.map((entry, i) => (
                        <Cell key={i} fill={spiked.has(entry.reason) ? '#EF4444' : '#1E5FAD'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {spiked.size > 0 && (
                  <div style={{
                    marginTop: 16, padding: '12px 16px',
                    background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>⚠</div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--danger)' }}>Spike Alert</div>
                      <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>{[...spiked].join(', ')} — เพิ่มขึ้น &gt;20% จากช่วงก่อนหน้า</div>
                    </div>
                  </div>
                )}
              </>
            )
          })() : <EmptyChart />}
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* Tab: Ward Ranking                                   */}
      {/* ══════════════════════════════════════════════════ */}
      {tab === 'ward' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, animation: 'rejFadeUp .2s ease' }}>
          <SectionHead title="Ward Ranking" sub="Top 20" />
          {summaryLoading ? <Skeleton h={400} /> : summary && summary.by_ward.length > 0 ? (
            summary.by_ward.map((item, i) => (
              <WardBar key={item.ward} item={item} rank={i} max={summary.by_ward[0].total} />
            ))
          ) : <EmptyChart />}
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* Tab: แนวโน้มรายปี                                  */}
      {/* ══════════════════════════════════════════════════ */}
      {tab === 'yearly_trend' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'rejFadeUp .2s ease' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <SectionHead title="ยอด Reject รายปี" />
            {summaryLoading ? <Skeleton h={220} /> : summary && summary.yearly_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={summary.yearly_trend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="yr" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => Number(v).toLocaleString()} contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 12 }} />
                  <Line type="monotone" dataKey="total" stroke="#1E5FAD" strokeWidth={2.5} dot={{ r: 5, fill: '#1E5FAD', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>

          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <SectionHead title="Top 6 สาเหตุ — รายปี" />
            {summaryLoading ? <Skeleton h={240} /> : summary && summary.yearly_by_reason.length > 0 ? (() => {
              const years = [...new Set(summary.yearly_by_reason.map(r => r.yr))].sort()
              const top6 = [...new Set(summary.yearly_by_reason.map(r => r.reason))].slice(0, 6)
              const chartData = years.map(yr => {
                const row: Record<string, number | string> = { yr: String(yr) }
                top6.forEach(reason => {
                  row[reason] = summary.yearly_by_reason.find(r => r.yr === yr && r.reason === reason)?.total ?? 0
                })
                return row
              })
              return (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="yr" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => Number(v).toLocaleString()} contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 12 }} />
                    <Legend iconSize={9} formatter={(v: string) => <span style={{ fontSize: 11 }}>{v}</span>} />
                    {top6.map((reason, i) => (
                      <Line key={reason} type="monotone" dataKey={reason} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )
            })() : <EmptyChart />}
          </div>

          {filterWork === 'ทั้งหมด' && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <SectionHead title="แยก Section — รายปี" />
              {summaryLoading ? <Skeleton h={240} /> : summary && summary.yearly_by_section.length > 0 ? (() => {
                const years = [...new Set(summary.yearly_by_section.map(r => r.yr))].sort()
                const secList = [...new Set(summary.yearly_by_section.map(r => r.section))].slice(0, 8)
                const chartData = years.map(yr => {
                  const row: Record<string, number | string> = { yr: String(yr) }
                  secList.forEach(sec => {
                    row[sec] = summary.yearly_by_section.find(r => r.yr === yr && r.section === sec)?.total ?? 0
                  })
                  return row
                })
                return (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="yr" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => Number(v).toLocaleString()} contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 12 }} />
                      <Legend iconSize={9} formatter={(v: string) => <span style={{ fontSize: 11 }}>{v}</span>} />
                      {secList.map((sec, i) => (
                        <Line key={sec} type="monotone" dataKey={sec} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )
              })() : <EmptyChart />}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* Tab: แนวโน้มรายเดือน                               */}
      {/* ══════════════════════════════════════════════════ */}
      {tab === 'monthly_trend' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, animation: 'rejFadeUp .2s ease' }}>
          <SectionHead title="แนวโน้มรายเดือน" sub="เปรียบเทียบแต่ละปี" />
          {summaryLoading ? <Skeleton h={280} /> : summary && summary.monthly_by_year.length > 0 ? (() => {
            const years = [...new Set(summary.monthly_by_year.map(r => r.yr))].sort()
            const chartData = Array.from({ length: 12 }, (_, i) => {
              const row: Record<string, number | string> = { mo: getThaiMonth(i + 1) }
              years.forEach(yr => {
                row[String(yr)] = summary.monthly_by_year.find(r => r.yr === yr && r.mo === i + 1)?.total ?? 0
              })
              return row
            })
            return (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mo" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => Number(v).toLocaleString()} contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 12 }} />
                  <Legend iconSize={9} formatter={(v: string) => <span style={{ fontSize: 11 }}>{v}</span>} />
                  {years.map((yr, i) => (
                    <Line key={yr} type="monotone" dataKey={String(yr)} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )
          })() : <EmptyChart />}
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* Tab: รายละเอียด อื่นๆ                              */}
      {/* ══════════════════════════════════════════════════ */}
      {tab === 'other_detail' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, animation: 'rejFadeUp .2s ease' }}>
          <SectionHead title="รายละเอียด สาเหตุ &quot;อื่นๆ&quot;" sub="Top 30" />
          {summaryLoading ? <Skeleton h={400} /> : summary && summary.by_reason_detail.length > 0 ? (
            summary.by_reason_detail.map((item, i) => {
              const max = summary.by_reason_detail[0].total
              const pct = (item.total / Math.max(max, 1)) * 100
              const isTop3 = i < 3
              const barColor = i === 0
                ? 'linear-gradient(90deg,#EF4444,#DC2626)'
                : i === 1
                ? 'linear-gradient(90deg,#F97316,#EA580C)'
                : i === 2
                ? 'linear-gradient(90deg,#EAB308,#CA8A04)'
                : 'linear-gradient(90deg,#3B82F6,#1D4ED8)'
              return (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: isTop3 ? ['#FEF2F2','#FFF7ED','#FEFCE8'][i] : 'var(--surface-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800,
                    color: isTop3 ? ['#DC2626','#EA580C','#CA8A04'][i] : 'var(--muted)',
                    flexShrink: 0,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1, position: 'relative', height: 34, background: 'var(--surface-2)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${pct}%`, background: barColor, borderRadius: 8, transition: 'width 0.6s cubic-bezier(.34,1.56,.64,1)' }} />
                    <div style={{ position: 'relative', padding: '0 12px', height: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 }}>
                      <span style={{ fontSize: 12.5, color: pct > 35 ? '#fff' : 'var(--ink)', fontWeight: 600 }}>{item.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: pct > 35 ? 'rgba(255,255,255,.7)' : 'var(--muted)' }}>{pct.toFixed(1)}%</span>
                        <span style={{ fontSize: 12.5, color: pct > 35 ? '#fff' : 'var(--ink)', fontWeight: 700 }}>{item.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <EmptyChart label='ไม่มีข้อมูล Reject "อื่นๆ" ในช่วงที่เลือก' />
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* Tab: ข้อมูลรายเดือน                                */}
      {/* ══════════════════════════════════════════════════ */}
      {tab === 'monthly_data' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'rejFadeUp .2s ease' }}>

          {/* Month + Year picker */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', minWidth: 28 }}>ปี</span>
              <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
              {[2022, 2023, 2024, 2025, 2026].map(y => (
                <button
                  key={y}
                  onClick={() => setSelYear(y)}
                  style={{
                    padding: '5px 14px', borderRadius: 20,
                    border: `1px solid ${selYear === y ? 'var(--primary)' : 'var(--border)'}`,
                    background: selYear === y ? 'var(--primary)' : 'transparent',
                    color: selYear === y ? '#fff' : 'var(--muted)',
                    fontWeight: selYear === y ? 700 : 500, fontSize: 12.5,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                  }}
                >{y}</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', minWidth: 28 }}>เดือน</span>
              <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <button
                  key={m}
                  onClick={() => setSelMonth(m)}
                  style={{
                    padding: '5px 12px', borderRadius: 8,
                    border: `1px solid ${selMonth === m ? 'var(--primary)' : 'var(--border)'}`,
                    background: selMonth === m ? 'var(--primary)' : 'transparent',
                    color: selMonth === m ? '#fff' : 'var(--ink)',
                    fontWeight: selMonth === m ? 700 : 400, fontSize: 12.5,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                  }}
                >{getThaiMonth(m)}</button>
              ))}
            </div>
            {monthSummary && (
              <div style={{ display: 'flex', alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                <Button variant="secondary" icon="download" onClick={() => printReport(monthSummary, selectedMonth, filterWork)}>
                  พิมพ์ PDF
                </Button>
              </div>
            )}
          </div>

          {/* Month stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {monthSummaryLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                  <Skeleton h={12} w={80} />
                  <Skeleton h={36} w={100} />
                </div>
              ))
            ) : monthSummary ? (() => {
              const spiked = getSpiked(monthSummary)
              const topReason = monthSummary.by_reason[0]?.reason ?? '—'
              const hasSpike = spiked.has(topReason)
              return (
                <>
                  <StatCard label={`Reject — ${formatMonthThai(selectedMonth)}`} value={monthSummary.current_total.toLocaleString()} accent="#1E5FAD" />
                  <StatCard
                    label="เทียบเดือนก่อน"
                    value={pctChange(monthSummary.current_total, monthSummary.prev_total)}
                    valueColor={pctChangeColor(monthSummary.current_total, monthSummary.prev_total)}
                    dir={pctChangeDir(monthSummary.current_total, monthSummary.prev_total)}
                    accent={pctChangeColor(monthSummary.current_total, monthSummary.prev_total)}
                  />
                  <StatCard label="เหตุผลหลัก" value={topReason} small extra={hasSpike ? '⚠ Spike' : undefined} extraColor="var(--warning)" accent="#D97706" />
                  <StatCard label="Section สูงสุด" value={monthSummary.by_section[0]?.section ?? '—'} small accent="#0D9488" />
                </>
              )
            })() : null}
          </div>

          {/* Filter + export row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <select
              value={filterReason}
              onChange={e => { setFilterReason(e.target.value); setPage(1) }}
              style={{
                padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)',
                fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)',
                background: 'var(--card)', cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="">ทุกสาเหตุ</option>
              {(monthSummary?.by_reason ?? []).map(r => (
                <option key={r.reason} value={r.reason}>{r.reason}</option>
              ))}
            </select>
            <div style={{ flex: 1 }} />
            {logs.length > 0 && (
              <Button variant="secondary" icon="download" onClick={() => exportCSV(logs, selectedMonth)}>
                Export CSV
              </Button>
            )}
          </div>

          {/* Data table */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    {['วันที่', 'Specimen', 'Reject', 'Section', 'Ward'].map((h, i) => (
                      <th key={i} style={{
                        padding: '11px 16px', textAlign: 'left',
                        fontSize: 11, fontWeight: 700, color: 'var(--muted)',
                        borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                        letterSpacing: '.04em', textTransform: 'uppercase',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {[100, 140, 110, 120, 100].map((w, j) => (
                          <td key={j} style={{ padding: '12px 16px' }}>
                            <Skeleton h={13} w={w} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                        ไม่มีข้อมูลในเดือนที่เลือก
                      </td>
                    </tr>
                  ) : logs.map(r => {
                    const badge = getRejectBadge(r.reject)
                    return (
                      <tr
                        key={r.id}
                        style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '11px 16px', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{r.spcmdate}</td>
                        <td style={{ padding: '11px 16px', color: 'var(--ink)', fontWeight: 500 }}>{r.labspcmnm ?? '—'}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{
                            background: badge.bg, color: badge.color,
                            borderRadius: 7, padding: '3px 9px',
                            fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                          }}>
                            {r.reject ?? '—'}
                          </span>
                        </td>
                        <td style={{ padding: '11px 16px', color: 'var(--muted)', fontSize: 12.5 }}>{r.work ?? '—'}</td>
                        <td style={{ padding: '11px 16px', color: 'var(--muted)', fontSize: 12.5 }}>{r.ward ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {logCount > 50 && (
              <div style={{
                padding: '12px 16px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', borderTop: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {((page - 1) * 50 + 1).toLocaleString()}–{Math.min(page * 50, logCount).toLocaleString()} จาก {logCount.toLocaleString()} records
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button variant="secondary" icon="arrowLeft" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>ก่อนหน้า</Button>
                  <Button variant="secondary" icon="arrowRight" onClick={() => setPage(p => p + 1)} disabled={page * 50 >= logCount}>ถัดไป</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────── */}
      {showUpload && (
        <RejectionUploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={(dataMonth) => {
            addToast('อัพโหลดสำเร็จ' + (dataMonth ? ` — เดือน ${dataMonth}` : ''))
            if (dataMonth) {
              const [y, m] = dataMonth.split('-').map(Number)
              setSelYear(y)
              setSelMonth(m)
              setTab('monthly_data')
            }
            fetchMonthSummary()
            fetchLogs()
          }}
        />
      )}
      {showHistory && (
        <RejectionHistoryModal
          canEdit={canEdit}
          onClose={() => setShowHistory(false)}
          onDeleted={() => { fetchSummary(); fetchMonthSummary(); fetchLogs() }}
        />
      )}

      {/* ── Toast ───────────────────────────────────────── */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9000, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div
            key={t.id}
            style={{
              background: t.ok ? '#1E5FAD' : 'var(--danger)', color: '#fff',
              padding: '11px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600,
              boxShadow: '0 8px 24px rgba(0,0,0,.18)',
              animation: 'rejToastIn .25s cubic-bezier(.34,1.56,.64,1)',
            }}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── StatCard sub-component ───────────────────────────────────────────────────

function StatCard({ label, value, sub, subColor, dir, small, valueColor, extra, extraColor, accent }: {
  label: string
  value: string
  sub?: string
  subColor?: string
  dir?: 'up' | 'down' | 'flat'
  small?: boolean
  valueColor?: string
  extra?: string
  extraColor?: string
  accent?: string
}) {
  const dirArrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : null
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '18px 20px',
      borderLeft: accent ? `3px solid ${accent}` : '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{
        fontSize: small ? 18 : 30, fontWeight: 800,
        color: valueColor ?? 'var(--ink)', lineHeight: 1.1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        marginTop: 2,
      }}>
        {value}
      </div>
      {(sub || dirArrow) && (
        <div style={{ fontSize: 12, color: subColor ?? 'var(--muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          {dirArrow && <span>{dirArrow}</span>}
          {sub}
        </div>
      )}
      {extra && <div style={{ fontSize: 11.5, color: extraColor ?? 'var(--warning)', fontWeight: 700 }}>{extra}</div>}
    </div>
  )
}
