'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { PdfViewerModal } from '@/components/documents/PdfViewerModal'
import { isPdfLike, viewerFileNameFromPath } from '@/lib/pdf-viewer-utils'
import type { ContractWithUsage } from '@/lib/queries/contracts'
import type { ContractUsage } from '@/lib/supabase/types'

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getCurrentMonthKey(): string {
  return monthKey(new Date())
}

function getPreviousMonthKey(): string {
  const now = new Date()
  return monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))
}

function usageMonthKey(u: ContractUsage): string {
  return (u.usage_month ?? u.usage_date ?? '').slice(0, 7)
}

function fmtExpenseMonth(value: string | null | undefined): string {
  if (!value) return '—'
  const [year, month] = value.slice(0, 7).split('-').map(Number)
  if (!year || !month) return '—'
  return new Date(year, month - 1, 1).toLocaleDateString('th-TH', { month: 'short', year: 'numeric' })
}

function getExpenseMonthOptions(startDate: string | null, endDate: string | null): { value: string; label: string }[] {
  const now = new Date()
  const fallbackStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const fallbackEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const start = startDate ? new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth(), 1) : fallbackStart
  const end = endDate ? new Date(new Date(endDate).getFullYear(), new Date(endDate).getMonth(), 1) : fallbackEnd
  const first = start <= end ? start : end
  const last = start <= end ? end : start
  const options: { value: string; label: string }[] = []
  for (let d = new Date(first); d <= last; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    options.push({ value: monthKey(d), label: fmtExpenseMonth(monthKey(d)) })
  }
  return options.length > 0 ? options : [{ value: getCurrentMonthKey(), label: fmtExpenseMonth(getCurrentMonthKey()) }]
}

function defaultUsageMonth(c: ContractWithUsage): string {
  const current = getCurrentMonthKey()
  const options = getExpenseMonthOptions(c.start_date, c.end_date)
  return options.some(o => o.value === current) ? current : (options.at(-1)?.value ?? current)
}

function getMonthlyData(history: ContractUsage[], startDate: string | null) {
  const now = new Date()
  const contractStart = startDate ? new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth(), 1) : null
  const latestUsageMonth = history
    .map(usageMonthKey)
    .filter(Boolean)
    .map(key => {
      const [year, month] = key.split('-').map(Number)
      return new Date(year, month - 1, 1)
    })
    .sort((a, b) => a.getTime() - b.getTime())
    .at(-1)
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const fallbackStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const start = contractStart ?? fallbackStart
  const end = latestUsageMonth && latestUsageMonth > currentMonth ? latestUsageMonth : currentMonth
  const length = Math.max(1, ((end.getFullYear() - start.getFullYear()) * 12) + end.getMonth() - start.getMonth() + 1)
  return Array.from({ length }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const key = monthKey(d)
    const amount = history.filter(h => usageMonthKey(h) === key).reduce((s, h) => s + h.amount, 0)
    return { label: fmtExpenseMonth(key), amount }
  })
}

function usageSnapshot(history: ContractUsage[]) {
  const usageMonths = Array.from(new Set(history.map(usageMonthKey).filter(Boolean))).sort()
  const lastUsageDate = history
    .filter(u => u.usage_date)
    .map(u => u.usage_date!)
    .sort()
    .at(-1) ?? null
  return {
    usageMonths,
    lastUsageDate,
    lastUsageMonth: usageMonths.at(-1) ?? null,
  }
}

function exportCSV(history: ContractUsage[], vendor: string, product: string) {
  const rows = [
    ['เดือนค่าใช้จ่าย', 'จำนวนเงิน (บาท)', 'หมายเหตุ', 'บันทึกโดย'],
    ...history.map(u => [usageMonthKey(u), u.amount, u.note ?? '', u.recorded_by ?? '']),
  ]
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `contract_${vendor}_${product}.csv`.replace(/\s+/g, '_')
  a.click()
  URL.revokeObjectURL(url)
}

function exportExcel(contract: ContractWithUsage, history: ContractUsage[]) {
  const sorted = [...history].sort((a, b) =>
    (usageMonthKey(a) || '').localeCompare(usageMonthKey(b) || '') ||
    (a.usage_date ?? '').localeCompare(b.usage_date ?? '')
  )
  const infoRows: (string | number)[][] = [
    ['ประวัติการใช้สัญญา'],
    ['เลขที่สัญญา', contract.contract_number ?? '—'],
    ['ชื่อสัญญา', contract.product],
    ['คู่สัญญา', contract.vendor],
    ['หน่วยงาน', contract.department ?? '—'],
    ['มูลค่าสัญญา (บาท)', contract.total ?? 0],
    ['ใช้ไปแล้วรวม (บาท)', contract.used],
    ['คงเหลือ (บาท)', (contract.total ?? 0) - contract.used],
    [],
  ]
  const header = ['เดือนค่าใช้จ่าย', 'จำนวนเงิน (บาท)', 'หมายเหตุ', 'บันทึกโดย', 'วันที่บันทึก']
  const dataRows = sorted.map(u => [
    fmtExpenseMonth(usageMonthKey(u)),
    u.amount,
    u.note ?? '',
    u.recorded_by ?? '',
    u.usage_date ? fmtDate(u.usage_date) : '',
  ])
  const totalRow = ['รวม', history.reduce((s, u) => s + u.amount, 0), '', '', '']

  const ws = XLSX.utils.aoa_to_sheet([...infoRows, header, ...dataRows, totalRow])
  ws['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 32 }, { wch: 20 }, { wch: 16 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'ประวัติการใช้สัญญา')
  const filename = `contract_${contract.contract_number ?? contract.vendor}_${contract.product}.xlsx`.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_')
  XLSX.writeFile(wb, filename)
}

interface UserRow { id: string; name: string | null; role: string | null }

interface Props {
  contracts: ContractWithUsage[]
  canEdit: boolean
  lastUpdated: string | null
  departments: string[]
  currentUserId: string
  users: UserRow[]
  initialCreate?: boolean
}

// ── business logic helpers ──────────────────────────────────────────────────

function monthsLeft(endDate: string | null): number {
  if (!endDate) return 999
  const diff = new Date(endDate).getTime() - Date.now()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 30))
}

function isExpiring(c: ContractWithUsage): boolean {
  const m = monthsLeft(c.end_date)
  return c.total > 10_000_000 ? m <= 6 : m <= 3
}

function isLowBudget(c: ContractWithUsage): boolean {
  if (!c.total) return false
  return ((c.total - c.used) / c.total) < 0.30
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} ล้านบาท`
  return `฿${n.toLocaleString()}`
}

function fmtMoneyShort(n: number): string {
  return `฿${n.toLocaleString()}`
}

// ── toast ───────────────────────────────────────────────────────────────────

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

// ── default form state ───────────────────────────────────────────────────────

type ContractStatus = 'active' | 'expired' | 'cancelled' | 'pending'

const statusFilters: { value: ContractStatus; label: string; tone: string; bg: string; border: string }[] = [
  { value: 'active', label: 'ปกติ', tone: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { value: 'expired', label: 'หมดอายุ', tone: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { value: 'cancelled', label: 'ยกเลิก', tone: '#64748B', bg: '#F8FAFC', border: '#CBD5E1' },
  { value: 'pending', label: 'รอดำเนินการ', tone: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
]

function emptyForm(): { contract_number: string; vendor: string; product: string; total: string; start_date: string; end_date: string; department: string; status: ContractStatus; responsible_user_ids: string[] } {
  return { contract_number: '', vendor: '', product: '', total: '', start_date: '', end_date: '', department: '', status: 'active', responsible_user_ids: [] }
}

// ── ContractBattery ──────────────────────────────────────────────────────────

function ContractBattery({ percent, warn }: { percent: number; warn: boolean }) {
  const clamped = Math.max(0, Math.min(100, percent))
  const fillColor = warn ? '#DC2626' : clamped >= 60 ? '#16A34A' : '#F59E0B'
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>คงเหลือเทียบกับมูลค่าสัญญา</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: warn ? 'var(--danger)' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
          {warn && <Icon name="alert" size={10} style={{ color: 'var(--danger)' }} />}
          {warn ? 'ใกล้หมด · ' : ''}{percent.toFixed(1)}%
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <div style={{
          flex: 1, height: 18, borderRadius: '4px 0 0 4px',
          border: `2px solid ${fillColor}`, background: 'var(--surface-2)',
          overflow: 'hidden', position: 'relative',
        }}>
          <div style={{
            width: `${clamped}%`, height: '100%', transition: 'width .4s',
            background: warn
              ? 'repeating-linear-gradient(45deg,#DC2626,#DC2626 4px,#FCA5A5 4px,#FCA5A5 8px)'
              : fillColor,
          }} />
          {clamped > 15 && (
            <span style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800,
              color: warn ? '#fff' : clamped >= 40 ? '#fff' : 'var(--ink)',
            }}>
              {percent.toFixed(0)}%
            </span>
          )}
        </div>
        <div style={{ width: 4, height: 9, background: fillColor, borderRadius: '0 2px 2px 0', flexShrink: 0 }} />
      </div>
    </div>
  )
}

// ── styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)', fontSize: 13,
  fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)',
  outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block',
}
function normContractNo(v: string | null | undefined) {
  return (v ?? '').trim().toLowerCase()
}

function normalizeDigits(value: string): string {
  const thaiDigits = '๐๑๒๓๔๕๖๗๘๙'
  return value.replace(/[๐-๙]/g, d => String(thaiDigits.indexOf(d)))
}

function parseContractNo(value: string | null | undefined) {
  const raw = normalizeDigits(value ?? '').trim()
  const match = raw.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (!match) return { valid: false, year: Number.MAX_SAFE_INTEGER, no: Number.MAX_SAFE_INTEGER, raw }
  return { valid: true, year: Number(match[2]), no: Number(match[1]), raw }
}

function compareContractNo(a: ContractWithUsage, b: ContractWithUsage) {
  const aa = parseContractNo(a.contract_number)
  const bb = parseContractNo(b.contract_number)
  if (aa.valid !== bb.valid) return aa.valid ? -1 : 1
  if (aa.year !== bb.year) return aa.year - bb.year
  if (aa.no !== bb.no) return aa.no - bb.no
  return aa.raw.localeCompare(bb.raw, 'th')
}

// ── responsible user picker ─────────────────────────────────────────────────

function ResponsibleUserPicker({ users, selected, onChange }: {
  users: UserRow[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const matches = users.filter(u => {
    const q = search.trim().toLowerCase()
    return !q || (u.name ?? '').toLowerCase().includes(q) || (u.role ?? '').toLowerCase().includes(q)
  })

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(true)}
        style={{ minHeight: 40, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'text' }}
      >
        {selected.map(id => {
          const u = users.find(x => x.id === id)
          return (
            <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 14, background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: 12, fontWeight: 600 }}>
              {u?.name ?? 'ไม่ทราบชื่อ'}
              <span onClick={(e) => { e.stopPropagation(); toggle(id) }} style={{ cursor: 'pointer', display: 'inline-flex' }} aria-label="ลบ">
                <Icon name="x" size={12} />
              </span>
            </span>
          )
        })}
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          placeholder={selected.length === 0 ? 'ค้นหาผู้รับผิดชอบ...' : ''}
          style={{ flex: 1, minWidth: 120, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)' }}
        />
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 200, overflowY: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 50 }}>
          {matches.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--muted)' }}>ไม่พบผู้ใช้</div>
          ) : matches.map(u => {
            const isSel = selected.includes(u.id)
            return (
              <div
                key={u.id}
                onClick={() => toggle(u.id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--ink)', background: isSel ? 'var(--primary-soft)' : 'transparent' }}
                onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = 'var(--surface-2)' }}
                onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
              >
                <span>{u.name ?? 'ไม่ทราบชื่อ'} <span style={{ color: 'var(--muted)', fontSize: 11 }}>{u.role ?? ''}</span></span>
                {isSel && <Icon name="check" size={14} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export function ContractsClient({ contracts: initial, canEdit, lastUpdated, departments, currentUserId, users, initialCreate = false }: Props) {
  const [contracts, setContracts] = useState<ContractWithUsage[]>(initial)
  const [editModal, setEditModal] = useState<ContractWithUsage | null | 'new'>(initialCreate && canEdit ? 'new' : null)
  const [usageModal, setUsageModal] = useState<ContractWithUsage | null>(null)
  const [historyModal, setHistoryModal] = useState<{ contract: ContractWithUsage; history: ContractUsage[] } | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [usageAmount, setUsageAmount] = useState('')
  const [usageNote, setUsageNote] = useState('')
  const [usageMonth, setUsageMonth] = useState('')
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [editUsage, setEditUsage] = useState<ContractUsage | null>(null)
  const [editUsageForm, setEditUsageForm] = useState({ amount: '', note: '', usage_date: '', usage_month: '' })
  const [filterExpiring, setFilterExpiring] = useState(false)
  const [filterLowBudget, setFilterLowBudget] = useState(false)
  const [filterStatus, setFilterStatus] = useState<ContractStatus | ''>('active')
  const [filterDept, setFilterDept] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [viewer, setViewer] = useState<{ url: string; pdfJsUrl?: string | null; title: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toasts, add: toast } = useToast()

  // ── computed stats ──────────────────────────────────────────────────────────

  const activeContracts = contracts.filter(c => c.status === 'active')
  const totalValue = activeContracts.reduce((s, c) => s + (c.total ?? 0), 0)
  const totalUsed = activeContracts.reduce((s, c) => s + c.used, 0)
  const totalRemaining = totalValue - totalUsed
  const expiringCount = activeContracts.filter(isExpiring).length
  const lowBudgetCount = activeContracts.filter(isLowBudget).length
  const statusCounts = statusFilters.reduce<Record<ContractStatus, number>>((acc, option) => {
    acc[option.value] = contracts.filter(c => c.status === option.value).length
    return acc
  }, { active: 0, expired: 0, cancelled: 0, pending: 0 })
  const duplicateContractNumber = editModal !== null
    && form.contract_number.trim()
    && contracts.some(c => {
      if (normContractNo(c.contract_number) !== normContractNo(form.contract_number)) return false
      return editModal === 'new' || c.id !== (editModal as ContractWithUsage).id
    })
  const duplicateContractNumberMsg = duplicateContractNumber
    ? `เลขที่สัญญา "${form.contract_number.trim()}" มีอยู่แล้ว`
    : ''

  const filteredContracts = contracts.filter(c => {
    if (filterExpiring && !isExpiring(c)) return false
    if (filterLowBudget && !isLowBudget(c)) return false
    if (filterStatus && c.status !== filterStatus) return false
    if (filterDept && c.department !== filterDept) return false
    return true
  })
  const sortedContracts = [...filteredContracts].sort(compareContractNo)
  const editUsageMonthOptions = historyModal
    ? getExpenseMonthOptions(historyModal.contract.start_date, historyModal.contract.end_date)
    : [{ value: getCurrentMonthKey(), label: fmtExpenseMonth(getCurrentMonthKey()) }]

  // ── open modals ─────────────────────────────────────────────────────────────

  function openCreate() {
    setForm(emptyForm())
    setFormErr('')
    setSelectedFile(null)
    setEditModal('new')
  }

  function openEdit(c: ContractWithUsage) {
    setForm({
      contract_number: c.contract_number ?? '',
      vendor: c.vendor,
      product: c.product,
      total: String(c.total ?? ''),
      start_date: c.start_date ?? '',
      end_date: c.end_date ?? '',
      department: c.department ?? '',
      status: c.status,
      responsible_user_ids: c.responsible_user_ids ?? [],
    })
    setFormErr('')
    setSelectedFile(null)
    setEditModal(c)
  }

  async function downloadFile(contract: ContractWithUsage) {
    const res = await fetch(`/api/admin/contracts/${contract.id}/file`)
    if (!res.ok) { toast('ไม่สามารถดาวน์โหลดไฟล์ได้', false); return }
    const { url } = await res.json()
    if (isPdfLike({ fileName: contract.file_url })) {
      setViewer({ url, pdfJsUrl: `/api/admin/contracts/${contract.id}/file?proxy=1`, title: viewerFileNameFromPath(contract.file_url) })
    } else {
      window.open(url, '_blank')
    }
  }

  function openUsage(c: ContractWithUsage) {
    setUsageAmount('')
    setUsageNote('')
    setUsageMonth(defaultUsageMonth(c))
    setUsageModal(c)
  }

  async function openHistory(c: ContractWithUsage) {
    const res = await fetch(`/api/admin/contracts/${c.id}/usage`)
    const history: ContractUsage[] = res.ok ? await res.json() : []
    setHistoryModal({ contract: c, history })
  }

  function openEditUsage(u: ContractUsage) {
    setEditUsageForm({ amount: String(u.amount), note: u.note ?? '', usage_date: u.usage_date ?? '', usage_month: usageMonthKey(u) || getCurrentMonthKey() })
    setEditUsage(u)
  }

  async function handleSaveEditUsage() {
    if (!editUsage || !editUsageForm.amount || !historyModal) return
    setSaving(true)
    try {
      const contractId = historyModal.contract.id
      const res = await fetch(`/api/admin/contracts/${contractId}/usage/${editUsage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(editUsageForm.amount), note: editUsageForm.note, usage_date: editUsageForm.usage_date, usage_month: editUsageForm.usage_month }),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'เกิดข้อผิดพลาด', false); return }
      const updatedHistory = historyModal.history.map(u => u.id === editUsage.id ? { ...u, ...json } : u)
      const newUsed = updatedHistory.reduce((s, u) => s + u.amount, 0)
      const snapshot = usageSnapshot(updatedHistory)
      setHistoryModal(m => m ? { ...m, history: updatedHistory, contract: { ...m.contract, used: newUsed, ...snapshot } } : m)
      setContracts(prev => prev.map(c => c.id === contractId ? { ...c, used: newUsed, ...snapshot } : c))
      setEditUsage(null)
      toast('แก้ไขรายการสำเร็จ')
    } catch { toast('เกิดข้อผิดพลาด', false) }
    finally { setSaving(false) }
  }

  async function handleDeleteUsage(u: ContractUsage) {
    if (!historyModal) return
    if (!confirm(`ยืนยันลบรายการ ฿${u.amount.toLocaleString()}?`)) return
    const contractId = historyModal.contract.id
    const res = await fetch(`/api/admin/contracts/${contractId}/usage/${u.id}`, { method: 'DELETE' })
    if (!res.ok) { toast('ลบไม่สำเร็จ', false); return }
    const updatedHistory = historyModal.history.filter(x => x.id !== u.id)
    const newUsed = updatedHistory.reduce((s, x) => s + x.amount, 0)
    const snapshot = usageSnapshot(updatedHistory)
    setHistoryModal(m => m ? { ...m, history: updatedHistory, contract: { ...m.contract, used: newUsed, ...snapshot } } : m)
    setContracts(prev => prev.map(c => c.id === contractId ? { ...c, used: newUsed, ...snapshot } : c))
    toast('ลบรายการสำเร็จ')
  }

  // ── save contract ───────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.contract_number.trim() || !form.product.trim() || !form.total || !form.start_date || !form.end_date) {
      setFormErr('กรุณากรอก เลขที่สัญญา ชื่อสัญญา มูลค่าสัญญา วันที่เริ่ม และวันที่สิ้นสุด')
      return
    }
    if (duplicateContractNumberMsg) {
      alert(duplicateContractNumberMsg)
      setFormErr(duplicateContractNumberMsg)
      return
    }
    setSaving(true)
    setFormErr('')
    try {
      const isNew = editModal === 'new'
      const url = isNew ? '/api/admin/contracts' : `/api/admin/contracts/${(editModal as ContractWithUsage).id}`
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, total: parseFloat(form.total) }),
      })
      const json = await res.json()
      if (!res.ok) { setFormErr(json.error ?? 'เกิดข้อผิดพลาด'); return }

      let finalData = json
      if (selectedFile) {
        const contractId: number = isNew ? json.id : (editModal as ContractWithUsage).id
        const uploadErrMsg = async (label: string) => {
          toast(`บันทึกสัญญาแล้ว แต่อัปโหลดไฟล์ไม่สำเร็จ: ${label}`, false)
          setContracts(prev => isNew ? [{ ...finalData, used: 0, lastUsageDate: null, lastUsageMonth: null, usageMonths: [] }, ...prev] : prev.map(c => c.id === (editModal as ContractWithUsage).id ? { ...c, ...finalData } : c))
          setSelectedFile(null)
          setEditModal(null)
        }
        // 1. Get presigned PUT URL from server
        const presignRes = await fetch(
          `/api/admin/contracts/${contractId}/file?intent=upload&filename=${encodeURIComponent(selectedFile.name)}&content_type=${encodeURIComponent(selectedFile.type)}`
        )
        if (!presignRes.ok) {
          const e = await presignRes.json().catch(() => ({}))
          await uploadErrMsg(e.error ?? 'ไม่สามารถสร้าง upload URL ได้')
          return
        }
        const { url: presignedUrl, key } = await presignRes.json()

        // 2. Upload directly to R2 (bypasses Vercel body size limit)
        const r2Res = await fetch(presignedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': selectedFile.type },
          body: selectedFile,
        })
        if (!r2Res.ok) {
          await uploadErrMsg('อัปโหลดไฟล์ไปยัง storage ไม่สำเร็จ')
          return
        }

        // 3. Confirm key to server
        const confirmRes = await fetch(`/api/admin/contracts/${contractId}/file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        })
        if (confirmRes.ok) {
          finalData = await confirmRes.json()
        } else {
          const e = await confirmRes.json().catch(() => ({}))
          await uploadErrMsg(e.error ?? 'บันทึก key ไม่สำเร็จ')
          return
        }
      }

      if (isNew) {
        setContracts(prev => [{ ...finalData, used: 0, lastUsageDate: null, lastUsageMonth: null, usageMonths: [] }, ...prev])
      } else {
        setContracts(prev => prev.map(c => c.id === (editModal as ContractWithUsage).id ? { ...c, ...finalData } : c))
      }
      toast(isNew ? 'เพิ่มสัญญาสำเร็จ' : 'อัปเดตสัญญาสำเร็จ')
      setSelectedFile(null)
      setEditModal(null)
    } catch { setFormErr('เกิดข้อผิดพลาด กรุณาลองใหม่') }
    finally { setSaving(false) }
  }

  // ── delete contract ─────────────────────────────────────────────────────────

  async function handleDeleteFile() {
    if (editModal === 'new' || editModal === null) return
    const c = editModal as ContractWithUsage
    if (!confirm('ยืนยันลบไฟล์สัญญา?')) return
    const res = await fetch(`/api/admin/contracts/${c.id}/file`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setContracts(prev => prev.map(x => x.id === c.id ? { ...x, file_url: null } : x))
      setEditModal({ ...c, file_url: null })
      toast('ลบไฟล์สำเร็จ')
    } else {
      toast('ลบไฟล์ไม่สำเร็จ', false)
    }
  }

  async function handleDelete(c: ContractWithUsage) {
    if (!confirm(`ยืนยันลบสัญญา "${c.vendor} — ${c.product}"?`)) return
    const res = await fetch(`/api/admin/contracts/${c.id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setContracts(prev => prev.filter(x => x.id !== c.id))
      toast('ลบสัญญาสำเร็จ')
    } else {
      toast('ลบไม่สำเร็จ', false)
    }
  }

  // ── log usage ───────────────────────────────────────────────────────────────

  async function handleLogUsage() {
    if (!usageModal || !usageAmount || !usageMonth) return
    const amount = parseFloat(usageAmount)
    const remaining = (usageModal.total ?? 0) - usageModal.used
    if (Number.isFinite(amount) && amount > remaining) {
      alert(`จำนวนเงินเกินมูลค่าคงเหลือ (${fmtMoney(remaining)})`)
      return
    }
    setSaving(true)
    try {
      const recordedDate = dateKey(new Date())
      const res = await fetch(`/api/admin/contracts/${usageModal.id}/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, note: usageNote, usage_date: recordedDate, usage_month: usageMonth }),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'เกิดข้อผิดพลาด', false); return }
      const loggedMonth = usageMonthKey(json) || usageMonth
      setContracts(prev => prev.map(c => {
        if (c.id !== usageModal.id) return c
        const usageMonths = Array.from(new Set([...(c.usageMonths ?? []), loggedMonth])).sort()
        return {
          ...c,
          used: c.used + json.amount,
          lastUsageDate: json.usage_date ?? recordedDate,
          lastUsageMonth: usageMonths.at(-1) ?? null,
          usageMonths,
        }
      }))
      toast('บันทึกการใช้จ่ายสำเร็จ')
      setUsageModal(null)
    } catch { toast('เกิดข้อผิดพลาด', false) }
    finally { setSaving(false) }
  }

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .ct-card { transition: box-shadow .15s, transform .15s; }
        .ct-card:hover { box-shadow: 0 6px 28px rgba(0,0,0,.09); transform: translateY(-1px); }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--primary)', marginBottom: 5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            {contracts.length} สัญญา
            {lastUpdated && ` · อัปเดตล่าสุด ${fmtDate(lastUpdated)}`}
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.2 }}>บริหารสัญญา</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>บันทึกการใช้จ่ายรายเดือน · เตือนเมื่อใกล้หมดอายุหรือมูลค่าเหลือต่ำ</p>
        </div>
        {canEdit && (
          <Button variant="primary" icon="plus" onClick={openCreate} style={{ flexShrink: 0 }}>
            สัญญาใหม่
          </Button>
        )}
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'มูลค่าสัญญารวม',      value: fmtMoney(totalValue),     icon: 'chart'   as const, color: 'var(--primary)',  bg: 'rgba(30,95,173,.08)'  },
          { label: 'ใช้ไปแล้วรวม',        value: fmtMoney(totalUsed),      icon: 'trending' as const, color: '#e12727',        bg: 'rgba(124,58,237,.08)' },
          { label: 'คงเหลือรวม',          value: fmtMoney(totalRemaining), icon: 'check'   as const, color: 'var(--success)',  bg: 'rgba(22,163,74,.08)'  },
          { label: 'ใกล้หมดอายุ',        value: String(expiringCount),    icon: 'alert'   as const, color: 'var(--danger)',   bg: 'rgba(220,38,38,.08)'  },
          { label: 'มูลค่าคงเหลือ < 30%', value: String(lowBudgetCount),   icon: 'bell'    as const, color: '#D97706',         bg: 'rgba(217,119,6,.08)'  },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', padding: '16px 18px', position: 'relative' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={s.icon} size={16} style={{ color: s.color }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <button
          onClick={() => setFilterExpiring(v => !v)}
          style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer', transition: 'all .15s',
            border: filterExpiring ? '1px solid #DC2626' : '1px solid var(--border)',
            background: filterExpiring ? '#FEF2F2' : 'transparent',
            color: filterExpiring ? '#DC2626' : 'var(--muted)',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <Icon name="alert" size={12} />
          ใกล้หมดอายุ
          {expiringCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, opacity: .75 }}>{expiringCount}</span>}
        </button>

        <button
          onClick={() => setFilterLowBudget(v => !v)}
          style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer', transition: 'all .15s',
            border: filterLowBudget ? '1px solid #D97706' : '1px solid var(--border)',
            background: filterLowBudget ? '#FFFBEB' : 'transparent',
            color: filterLowBudget ? '#D97706' : 'var(--muted)',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <Icon name="bell" size={12} />
          งบเหลือ &lt; 30%
          {lowBudgetCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, opacity: .75 }}>{lowBudgetCount}</span>}
        </button>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: 3, border: '1px solid var(--border)', borderRadius: 22, background: 'var(--surface-2)' }}>
          <button
            onClick={() => setFilterStatus('')}
            style={{
              padding: '4px 11px', borderRadius: 18, fontSize: 12.5, fontWeight: 700,
              fontFamily: 'inherit', cursor: 'pointer', transition: 'all .15s',
              border: '1px solid transparent',
              background: filterStatus === '' ? 'var(--card)' : 'transparent',
              color: filterStatus === '' ? 'var(--primary)' : 'var(--muted)',
              boxShadow: filterStatus === '' ? '0 1px 4px rgba(15,23,42,.08)' : 'none',
            }}
          >
            ทุกสถานะ
          </button>
          {statusFilters.map(option => {
            const active = filterStatus === option.value
            return (
              <button
                key={option.value}
                onClick={() => setFilterStatus(active ? '' : option.value)}
                style={{
                  padding: '4px 10px', borderRadius: 18, fontSize: 12.5, fontWeight: 700,
                  fontFamily: 'inherit', cursor: 'pointer', transition: 'all .15s',
                  border: active ? `1px solid ${option.border}` : '1px solid transparent',
                  background: active ? option.bg : 'transparent',
                  color: active ? option.tone : 'var(--muted)',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: option.tone, opacity: active ? 1 : .45 }} />
                {option.label}
                {statusCounts[option.value] > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 800, opacity: active ? .9 : .6 }}>{statusCounts[option.value]}</span>
                )}
              </button>
            )
          })}
        </div>

        {departments.length > 0 && (
          <select
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
            style={{
              padding: '5px 28px 5px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', cursor: 'pointer', transition: 'all .15s', outline: 'none',
              border: filterDept ? '1px solid var(--primary)' : '1px solid var(--border)',
              background: filterDept ? 'rgba(30,95,173,.06)' : 'transparent',
              color: filterDept ? 'var(--primary)' : 'var(--muted)',
              appearance: 'none', WebkitAppearance: 'none',
            }}
          >
            <option value="">ทุกแผนก</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}

        {(filterExpiring || filterLowBudget || filterStatus !== 'active' || filterDept) && (
          <button
            onClick={() => { setFilterExpiring(false); setFilterLowBudget(false); setFilterStatus('active'); setFilterDept('') }}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 600,
              fontFamily: 'inherit', cursor: 'pointer', transition: 'all .15s',
              border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Icon name="x" size={11} />
            ล้างตัวกรอง
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--muted)', fontWeight: 500 }}>
          {filteredContracts.length} / {contracts.length} สัญญา
        </span>
      </div>

      {/* ── Alert banner ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A', marginBottom: 20, fontSize: 12.5, color: '#92400E' }}>
        <Icon name="alert" size={14} style={{ color: '#D97706', flexShrink: 0 }} />
        <span><strong>กฎการเตือน:</strong> แดง = คงเหลือ ≤ 3 เดือน (หรือ ≤ 6 เดือนหากมูลค่า &gt; 10 ล้านบาท) · หลอดพลังเปลี่ยนเป็นแดงเมื่อเหลือ &lt; 30%</span>
      </div>

      {/* ── Contract register list ── */}
      {sortedContracts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: 14 }}>
          {contracts.length === 0
            ? (canEdit ? 'ยังไม่มีสัญญา — กดปุ่ม "สัญญาใหม่" เพื่อเพิ่ม' : 'ยังไม่มีสัญญา')
            : 'ไม่มีสัญญาตรงกับตัวกรองที่เลือก'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          {sortedContracts.map(c => {
            const remaining = (c.total ?? 0) - c.used
            const pct = c.total ? (remaining / c.total) * 100 : 0
            const ml = monthsLeft(c.end_date)
            const alreadyExpired = ml < 0
            const expiring = isExpiring(c)
            const lowBudget = isLowBudget(c)
            const isResponsible = (c.responsible_user_ids ?? []).includes(currentUserId)
            const canLogUsage = canEdit || isResponsible

            // left accent color
            const accentColor = expiring ? 'var(--danger)' : lowBudget ? '#F59E0B' : 'var(--success)'

            return (
              <div key={c.id} className="ct-card" style={{
                background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)',
                overflow: 'hidden',
              }}>
                {/* top accent bar */}
                <div style={{ height: 3, background: accentColor }} />

                <div style={{ padding: '18px 20px 16px' }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 14, flex: '1 1 340px', flexWrap: 'wrap' }}>
                      <div style={{
                        minWidth: 82, padding: '9px 10px', borderRadius: 8,
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        textAlign: 'center', flexShrink: 0,
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 2 }}>เลขที่สัญญา</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', lineHeight: 1 }}>{c.contract_number ?? '—'}</div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)', lineHeight: 1.3 }}>{c.product}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{c.vendor}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexShrink: 0, marginLeft: 'auto', flexWrap: 'wrap', maxWidth: '100%' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 18, background: 'rgba(30,95,173,.06)', border: '1px solid rgba(30,95,173,.14)', color: 'var(--primary)', fontSize: 11.5, fontWeight: 700, maxWidth: 260 }}>
                        <Icon name="building" size={11} style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.department || 'ไม่ระบุหน่วยงาน'}</span>
                      </span>
                      {(c.responsible_user_ids ?? []).length > 0 && (
                        <span
                          title={(c.responsible_user_ids ?? []).map(id => users.find(u => u.id === id)?.name ?? '').filter(Boolean).join(', ')}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 18, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 11.5, fontWeight: 700, maxWidth: 220 }}
                        >
                          <Icon name="users" size={11} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {(c.responsible_user_ids ?? []).map(id => users.find(u => u.id === id)?.name ?? 'ไม่ทราบชื่อ').join(', ')}
                          </span>
                        </span>
                      )}
                      {/* status badge */}
                      {alreadyExpired ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', padding: '3px 9px', borderRadius: 20 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#DC2626' }} />
                          หมดอายุแล้ว
                        </span>
                      ) : expiring ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', padding: '3px 9px', borderRadius: 20 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#DC2626' }} />
                          ใกล้หมดอายุ
                        </span>
                      ) : lowBudget ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#D97706', background: '#FFFBEB', border: '1px solid #FDE68A', padding: '3px 9px', borderRadius: 20 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#F59E0B' }} />
                          งบเหลือน้อย
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '3px 9px', borderRadius: 20 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#16A34A' }} />
                          ปกติ
                        </span>
                      )}
                      {c.file_url && (
                        <button onClick={() => downloadFile(c)} title={isPdfLike({ fileName: c.file_url }) ? 'อ่านไฟล์สัญญา' : 'ดาวน์โหลดไฟล์สัญญา'} style={{ padding: 5, borderRadius: 6, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--primary)' }}>
                          <Icon name="download" size={13} />
                        </button>
                      )}
                      {canEdit && (
                        <>
                          <button onClick={() => openEdit(c)} style={{ padding: 5, borderRadius: 6, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--muted)' }}>
                            <Icon name="edit" size={13} />
                          </button>
                          <button onClick={() => handleDelete(c)} style={{ padding: 5, borderRadius: 6, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--danger)' }}>
                            <Icon name="trash" size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Date row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                    {[
                      { label: 'เริ่มสัญญา', value: fmtDate(c.start_date), warn: false },
                      { label: 'สิ้นสุดสัญญา', value: fmtDate(c.end_date), warn: false },
                      { label: 'วันคงเหลือ', value: ml < 0 ? 'หมดแล้ว' : `${ml} เดือน`, warn: expiring },
                    ].map(d => (
                      <div key={d.label} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '9px 11px' }}>
                        <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>{d.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: d.warn ? 'var(--danger)' : 'var(--ink)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {d.warn && <Icon name="alert" size={11} style={{ color: 'var(--danger)' }} />}
                          {d.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Amount row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, marginBottom: 3 }}>มูลค่าสัญญา</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{fmtMoneyShort(c.total ?? 0)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, marginBottom: 3 }}>ใช้ไปแล้ว</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#e01818' }}>{fmtMoneyShort(c.used)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, marginBottom: 3 }}>คงเหลือ</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: remaining <= 0 ? 'var(--danger)' : 'var(--success)' }}>{fmtMoneyShort(remaining)}</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <ContractBattery percent={pct} warn={lowBudget} />

                  {/* Monthly log notice */}
                  {(() => {
                    const requiredUsageMonth = getPreviousMonthKey()
                    const hasLog = (c.usageMonths ?? []).includes(requiredUsageMonth)
                    return (
                      <div style={{ fontSize: 11.5, marginBottom: 12, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4, color: hasLog ? 'var(--success)' : 'var(--muted)' }}>
                        {hasLog ? (
                          <>
                            <Icon name="check" size={11} style={{ color: 'var(--success)', flexShrink: 0 }} />
                            บันทึกเดือนนี้แล้ว
                          </>
                        ) : 'ยังไม่มีการบันทึกในรอบนี้'}
                      </div>
                    )
                  })()}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => openHistory(c)}
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                        background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 12.5, fontWeight: 600, color: 'var(--ink)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      }}
                    >
                      <Icon name="trending" size={12} />
                      ประวัติการใช้สัญญา
                    </button>
                    {canLogUsage && (
                      <button
                        onClick={() => openUsage(c)}
                        style={{
                          flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
                          background: 'var(--primary)', cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 12.5, fontWeight: 700, color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          boxShadow: '0 1px 6px rgba(30,95,173,.25)',
                        }}
                      >
                        <Icon name="plus" size={12} />
                        บันทึกการใช้จ่าย
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {editModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            {/* header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{editModal === 'new' ? 'เพิ่มสัญญาใหม่' : 'แก้ไขสัญญา'}</span>
              <button onClick={() => setEditModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
                <Icon name="x" size={16} />
              </button>
            </div>

            {/* body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div>
                <label style={labelStyle}>เลขที่สัญญา <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  value={form.contract_number}
                  onChange={e => {
                    setForm(f => ({ ...f, contract_number: e.target.value }))
                    if (formErr === duplicateContractNumberMsg) setFormErr('')
                  }}
                  onBlur={() => {
                    if (duplicateContractNumberMsg) {
                      alert(duplicateContractNumberMsg)
                      setFormErr(duplicateContractNumberMsg)
                    }
                  }}
                  placeholder="เช่น MED-2567-001"
                  style={{
                    ...inputStyle,
                    borderColor: duplicateContractNumberMsg ? 'rgba(220,38,38,.55)' : 'var(--border)',
                    background: duplicateContractNumberMsg ? 'rgba(220,38,38,.04)' : 'var(--card)',
                  }}
                />
                {duplicateContractNumberMsg && (
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--danger)', lineHeight: 1.35 }}>
                    {duplicateContractNumberMsg}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>หน่วยงาน / Department</label>
                <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} style={{ ...inputStyle }}>
                  <option value="">— เลือกหน่วยงาน —</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>ชื่อบริษัท / Vendor</label>
                <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="เช่น Roche Diagnostics" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>ชื่อสัญญา / ผลิตภัณฑ์ <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input value={form.product} onChange={e => setForm(f => ({ ...f, product: e.target.value }))} placeholder="เช่น Cobas 8000 + Reagent" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>มูลค่าสัญญา (บาท) <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="number" value={form.total} onChange={e => setForm(f => ({ ...f, total: e.target.value }))} placeholder="0.00" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                <div>
                  <label style={labelStyle}>วันที่เริ่มสัญญา <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>วันที่สิ้นสุดสัญญา <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>สถานะ</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ContractStatus }))} style={{ ...inputStyle }}>
                  <option value="active">ปกติ (Active)</option>
                  <option value="expired">หมดอายุ (Expired)</option>
                  <option value="cancelled">ยกเลิก (Cancelled)</option>
                  <option value="pending">รอดำเนินการ (Pending)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>ผู้รับผิดชอบบันทึกการใช้จ่าย</label>
                <ResponsibleUserPicker
                  users={users}
                  selected={form.responsible_user_ids}
                  onChange={ids => setForm(f => ({ ...f, responsible_user_ids: ids }))}
                />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  ผู้ที่เลือก (ซึ่งมีสิทธิ์เข้าหน้านี้อยู่แล้ว) จะบันทึกการใช้จ่ายของสัญญานี้ได้ แม้ไม่มีสิทธิ์แก้ไขสัญญาโดยรวม
                </div>
              </div>

              {/* File upload */}
              <div>
                <label style={labelStyle}>ไฟล์สัญญา (PDF / รูปภาพ)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  style={{ display: 'none' }}
                  onChange={e => { setSelectedFile(e.target.files?.[0] ?? null); setDragOver(false) }}
                />
                {selectedFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                    <Icon name="doc" size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.name}</span>
                    <button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, display: 'flex' }}>
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                ) : editModal !== 'new' && (editModal as ContractWithUsage).file_url ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) setSelectedFile(f) }}
                    style={{
                      borderRadius: 8, border: `1.5px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
                      background: dragOver ? 'var(--primary-soft)' : 'transparent',
                      transition: 'all .15s', overflow: 'hidden',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px' }}>
                      <div style={{ flex: 1, fontSize: 12.5, color: dragOver ? 'var(--primary)' : 'var(--muted)', fontWeight: dragOver ? 600 : 400 }}>
                        {dragOver ? 'วางไฟล์เพื่อเปลี่ยน...' : 'มีไฟล์แนบอยู่แล้ว'}
                      </div>
                      <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--ink)', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        เปลี่ยนไฟล์
                      </button>
                      <button type="button" onClick={handleDeleteFile} style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--danger)', flexShrink: 0 }}>
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) setSelectedFile(f) }}
                    style={{
                      width: '100%', padding: '22px 12px', borderRadius: 8,
                      border: `1.5px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
                      background: dragOver ? 'var(--primary-soft)' : 'transparent',
                      cursor: 'pointer', fontFamily: 'inherit', boxSizing: 'border-box',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column', gap: 7, transition: 'all .15s', textAlign: 'center',
                    }}
                  >
                    <Icon name="upload" size={20} style={{ color: dragOver ? 'var(--primary)' : 'var(--muted)' }} />
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: dragOver ? 'var(--primary)' : 'var(--muted)' }}>
                      ลากไฟล์มาวางที่นี่{' '}
                      <span style={{ fontWeight: 400, opacity: .7 }}>หรือคลิกเพื่อเลือก</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', opacity: .6 }}>PDF หรือรูปภาพ</div>
                  </div>
                )}
              </div>

              {formErr && (
                <div style={{ fontSize: 12.5, color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  {formErr}
                </div>
              )}
            </div>

            {/* footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
              <Button variant="secondary" onClick={() => setEditModal(null)} disabled={saving}>ยกเลิก</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving || !!duplicateContractNumberMsg} icon="check">
                {saving ? 'กำลังบันทึก...' : editModal === 'new' ? 'เพิ่มสัญญา' : 'บันทึก'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Log Usage Modal ── */}
      {usageModal && (() => {
        const mRemaining = (usageModal.total ?? 0) - usageModal.used
        const mAmount = parseFloat(usageAmount)
        const usageOverRemaining = Number.isFinite(mAmount) && mAmount > mRemaining
        const usageWarning = usageOverRemaining ? `จำนวนเงินเกินมูลค่าคงเหลือ (${fmtMoney(mRemaining)})` : ''
        const usageMonthOptions = getExpenseMonthOptions(usageModal.start_date, usageModal.end_date)
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden' }}>

              {/* Header */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>บันทึกการใช้จ่ายรายเดือน</div>
                <button onClick={() => setUsageModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
                  <Icon name="x" size={16} />
                </button>
              </div>

              <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Vendor info */}
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--ink)', lineHeight: 1.2 }}>{usageModal.product}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{usageModal.contract_number}</div>
                </div>

                {/* Budget summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, background: 'var(--surface-2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  {[
                    { label: 'มูลค่าสัญญา', value: fmtMoneyShort(usageModal.total ?? 0), color: 'var(--ink)' },
                    { label: 'ใช้ไปแล้ว',   value: fmtMoneyShort(usageModal.used),        color: '#e62320' },
                    { label: 'คงเหลือ',      value: fmtMoneyShort(mRemaining),             color: mRemaining <= 0 ? 'var(--danger)' : 'var(--success)' },
                  ].map((s, i) => (
                    <div key={s.label} style={{ padding: '11px 14px', borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Month + Amount in 2 cols */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>ยอดค่าใช้จ่ายเดือน <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select value={usageMonth} onChange={e => setUsageMonth(e.target.value)} style={inputStyle}>
                      {usageMonthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>จำนวนเงิน (บาท) <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="number"
                      value={usageAmount}
                      onChange={e => setUsageAmount(e.target.value)}
                      onBlur={() => { if (usageWarning) alert(usageWarning) }}
                      placeholder="0"
                      style={{
                        ...inputStyle,
                        borderColor: usageWarning ? 'rgba(220,38,38,.55)' : 'var(--border)',
                        background: usageWarning ? 'rgba(220,38,38,.04)' : 'var(--card)',
                      }}
                    />
                    {usageWarning && (
                      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--danger)', lineHeight: 1.35 }}>
                        {usageWarning}
                      </div>
                    )}
                  </div>
                </div>

                {/* Note textarea */}
                <div>
                  <label style={labelStyle}>หมายเหตุ</label>
                  <textarea
                    value={usageNote}
                    onChange={e => setUsageNote(e.target.value)}
                    placeholder={`เช่น เบิกน้ำยา ${usageModal.product} รอบ พ.ค. 2569`}
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button variant="secondary" onClick={() => setUsageModal(null)} disabled={saving}>ยกเลิก</Button>
                <Button variant="primary" onClick={handleLogUsage} disabled={!usageAmount || !usageMonth || saving || usageOverRemaining} icon="check">
                  {saving ? 'กำลังบันทึก...' : 'บันทึกการใช้จ่าย'}
                </Button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── History Modal ── */}
      {historyModal && (() => {
        const hc = historyModal.contract
        const history = historyModal.history
        const monthlyData = getMonthlyData(history, hc.start_date)
        const monthsWithData = monthlyData.filter(m => m.amount > 0).length
        const avgPerMonth = monthsWithData > 0 ? hc.used / monthsWithData : 0

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 660, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>

              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>ประวัติการใช้สัญญา</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.2 }}>{hc.product}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{hc.contract_number}</div>
                </div>
                <button onClick={() => setHistoryModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, marginTop: 2 }}>
                  <Icon name="x" size={16} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  {[
                    { label: 'มูลค่าสัญญา',   value: fmtMoneyShort(hc.total ?? 0), color: 'var(--ink)' },
                    { label: 'ใช้ไปแล้วรวม',  value: fmtMoneyShort(hc.used),       color: '#e12323' },
                    { label: 'เฉลี่ยต่อเดือน', value: fmtMoneyShort(Math.round(avgPerMonth)), color: 'var(--ink)' },
                    { label: 'จำนวนรายการ',   value: `${history.length} รายการ`,   color: 'var(--ink)' },
                  ].map((s, i) => (
                    <div key={s.label} style={{ padding: '13px 16px', borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Bar chart — manual flex bars, no Recharts */}
                {history.length > 0 && (() => {
                  const maxV = Math.max(...monthlyData.map(m => m.amount), 1)
                  return (
                    <div style={{ padding: '18px 20px 8px', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>
                        แนวโน้มรายเดือนตามเดือนค่าใช้จ่าย
                      </div>
                      <div style={{ display: 'none' }}>
                        แนวโน้มรายเดือน – 12 เดือนย้อนหลัง
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 130, padding: '0 2px', minWidth: Math.max(560, monthlyData.length * 46) }}>
                        {monthlyData.map((m, i) => {
                          const barH = (m.amount / maxV) * 106
                          const label = m.amount > 0
                            ? (m.amount >= 1_000_000 ? `${(m.amount / 1_000_000).toFixed(1)}M` : `${Math.round(m.amount / 1000)}K`)
                            : ''
                          return (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, opacity: m.amount > 0 ? 1 : 0, lineHeight: 1, whiteSpace: 'nowrap' }}>{label}</div>
                              <div
                                title={m.amount > 0 ? `฿${m.amount.toLocaleString()}` : '—'}
                                style={{ width: '100%', height: Math.max(barH, m.amount > 0 ? 6 : 2), background: m.amount > 0 ? '#1E5FAD' : '#E5EAF0', borderRadius: '5px 5px 0 0', transition: 'height .3s' }}
                              />
                              <div style={{ fontSize: 10.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{m.label}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* List header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 8px' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>บันทึกรายการทั้งหมด</span>
                  {history.length > 0 && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
                      <button
                        onClick={() => exportExcel(hc, history)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--success)', fontFamily: 'inherit', padding: 0 }}
                      >
                        <Icon name="download" size={13} />
                        ส่งออก Excel
                      </button>
                      <button
                        onClick={() => exportCSV(history, hc.vendor, hc.product)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--primary)', fontFamily: 'inherit', padding: 0 }}
                      >
                        <Icon name="download" size={13} />
                        ส่งออก CSV
                      </button>
                    </div>
                  )}
                </div>

                {/* Timeline rows */}
                {history.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>ยังไม่มีประวัติการใช้งาน</div>
                ) : (
                  <div style={{ position: 'relative', padding: '0 20px 20px' }}>
                    {/* vertical connector line */}
                    <div style={{ position: 'absolute', left: 34, top: 6, bottom: 26, width: 2, background: 'var(--border)' }} />
                    {[...history]
                      .sort((a, b) => (usageMonthKey(b) || '').localeCompare(usageMonthKey(a) || '') || (b.usage_date ?? '').localeCompare(a.usage_date ?? ''))
                      .map(u => (
                        <div key={u.id} style={{ display: 'flex', gap: 14, marginBottom: 10, position: 'relative' }}>
                          {/* circle icon */}
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1, border: '3px solid var(--card)' }}>
                            <Icon name="trending" size={13} />
                          </div>
                          {/* card */}
                          <div style={{ flex: 1, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)' }}>฿{u.amount.toLocaleString()}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8, flexShrink: 0 }}>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'right' }}>
                                  <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{fmtExpenseMonth(usageMonthKey(u))}</div>
                                  <div>{u.usage_date ? `บันทึก ${fmtDate(u.usage_date)}` : 'บันทึก —'}</div>
                                </div>
                                {canEdit && <>
                                  <button onClick={() => openEditUsage(u)} style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icon name="edit" size={12} />
                                  </button>
                                  <button onClick={() => handleDeleteUsage(u)} style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icon name="trash" size={12} />
                                  </button>
                                </>}
                              </div>
                            </div>
                            {u.note && <div style={{ fontSize: 12.5, color: 'var(--ink)', marginTop: 2 }}>{u.note}</div>}
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>บันทึกโดย · {u.recorded_by ?? '—'}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )
      })()}

      {/* ── Edit Usage Modal ── */}
      {editUsage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>แก้ไขรายการ</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{historyModal?.contract.vendor}</div>
              </div>
              <button onClick={() => setEditUsage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>ยอดค่าใช้จ่ายเดือน <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select value={editUsageForm.usage_month} onChange={e => setEditUsageForm(f => ({ ...f, usage_month: e.target.value }))} style={inputStyle}>
                    {editUsageMonthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>จำนวนเงิน (บาท) <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input type="number" value={editUsageForm.amount} onChange={e => setEditUsageForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>หมายเหตุ</label>
                <textarea value={editUsageForm.note} onChange={e => setEditUsageForm(f => ({ ...f, note: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" onClick={() => setEditUsage(null)} disabled={saving}>ยกเลิก</Button>
              <Button variant="primary" onClick={handleSaveEditUsage} disabled={!editUsageForm.amount || !editUsageForm.usage_month || saving} icon="check">
                {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toasts ── */}
      {viewer && <PdfViewerModal url={viewer.url} pdfJsUrl={viewer.pdfJsUrl} title={viewer.title} onClose={() => setViewer(null)} />}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '11px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: t.ok ? '#166534' : '#B91C1C', color: '#fff',
            boxShadow: '0 4px 16px rgba(0,0,0,.18)', maxWidth: 320,
          }}>
            {t.ok ? '✓ ' : '✕ '}{t.msg}
          </div>
        ))}
      </div>
    </>
  )
}
