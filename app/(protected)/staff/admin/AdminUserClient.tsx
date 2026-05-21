'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { createUserSchema, updateUserSchema, ROLES, DEPARTMENTS, DEPT_ABBR } from '@/lib/validations/user-schema'
import type { UserProfile, UserFilters, PaginationMeta, UserRole, UserStatus } from '@/types/users'
import type { CreateUserInput, UpdateUserInput } from '@/lib/validations/user-schema'

// ─── Toast ────────────────────────────────────────────────────────────────────
type Toast = { id: number; msg: string; type: 'success' | 'error' }

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          padding: '11px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: t.type === 'success' ? '#166534' : '#B91C1C', color: '#fff',
          boxShadow: '0 4px 16px rgba(0,0,0,.18)', maxWidth: 320,
        }}>
          {t.type === 'success' ? '✓ ' : '✕ '}{t.msg}
        </div>
      ))}
    </div>
  )
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)
  const show = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = ++counter.current
    setToasts((p) => [...p, { id, msg, type }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500)
  }, [])
  return { toasts, show }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, 'red' | 'blue' | 'teal' | 'gray' | 'purple' | 'amber'> = {
  Admin: 'red', Manager: 'blue', 'Medical Technologist': 'teal', Assistant: 'gray', 'Document Controller': 'purple', 'Medical Science Technician': 'amber',
}
const STATUS_COLORS: Record<string, 'green' | 'amber' | 'gray'> = {
  active: 'green', pending: 'amber', inactive: 'gray',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'ใช้งาน', pending: 'รอยืนยัน', inactive: 'ปิดใช้งาน',
}

// ─── Select helper ────────────────────────────────────────────────────────────
function Sel({ value, onChange, children, placeholder }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      style={{
        padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
        fontSize: 13, fontFamily: 'inherit', background: 'var(--card)', color: 'var(--ink)',
        cursor: 'pointer', outline: 'none',
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  )
}

// ─── Form field ───────────────────────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12.5, fontWeight: 600, display: 'block', marginBottom: 5, color: 'var(--ink)' }}>
        {label}
      </label>
      {children}
      {error && <p style={{ fontSize: 11.5, color: '#B91C1C', marginTop: 4 }}>{error}</p>}
    </div>
  )
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ msg, onConfirm, onCancel }: {
  msg: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
    }}>
      <Card padding={28} style={{ maxWidth: 360, width: '90%' }}>
        <p style={{ fontSize: 14, color: 'var(--ink)', marginBottom: 20 }}>{msg}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>ยกเลิก</Button>
          <Button variant="danger" onClick={onConfirm}>ยืนยัน</Button>
        </div>
      </Card>
    </div>
  )
}

// ─── User Form Modal ──────────────────────────────────────────────────────────
type ModalMode = 'create' | 'edit'

interface UserFormModalProps {
  mode: ModalMode
  user?: UserProfile
  onClose: () => void
  onSaved: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}

function UserFormModal({ mode, user, onClose, onSaved, showToast }: UserFormModalProps) {
  const isEdit = mode === 'edit'
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    ephis_id: user?.ephis_id ?? '',
    name:     user?.name     ?? '',
    role:     (user?.role    ?? 'Medical Technologist') as UserRole,
    dept:     (user?.dept    ?? DEPARTMENTS[0]) as typeof DEPARTMENTS[number],
    status:   (user?.status  ?? 'active') as UserStatus,
  })

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setErrors((p) => { const n = { ...p }; delete n[k]; return n })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    if (isEdit) {
      const payload: UpdateUserInput = {
        ephis_id: form.ephis_id || undefined,
        name:     form.name     || undefined,
        role:     form.role,
        dept:     form.dept,
      }
      const parsed = updateUserSchema.safeParse(payload)
      if (!parsed.success) {
        const map: Record<string, string> = {}
        parsed.error.issues.forEach((e) => { if (e.path[0]) map[String(e.path[0])] = e.message })
        setErrors(map); return
      }

      setLoading(true)
      const res = await fetch(`/api/admin/users/${user!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const data = await res.json()
      setLoading(false)
      if (!res.ok) { showToast(data.error ?? 'เกิดข้อผิดพลาด', 'error'); return }
      showToast('อัปเดตผู้ใช้งานสำเร็จ')
      onSaved()
    } else {
      const parsed = createUserSchema.safeParse(form)
      if (!parsed.success) {
        const map: Record<string, string> = {}
        parsed.error.issues.forEach((e) => { if (e.path[0]) map[String(e.path[0])] = e.message })
        setErrors(map); return
      }

      setLoading(true)
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const data = await res.json()
      setLoading(false)
      if (!res.ok) { showToast(data.error ?? 'เกิดข้อผิดพลาด', 'error'); return }
      showToast('เพิ่มผู้ใช้งานสำเร็จ')
      onSaved()
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
    >
      <div style={{ maxWidth: 440, width: '94%' }}>
      <Card padding={28} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, color: 'var(--ink)' }}>
          {isEdit ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="ชื่อ-นามสกุล" error={errors.name}>
            <Input type="text" value={form.name} onChange={set('name')} placeholder="ชื่อเต็ม" required />
          </Field>

          <Field label="E-Phis" error={errors.ephis_id}>
            <Input type="number" value={form.ephis_id} onChange={(v) => set('ephis_id')(v.replace(/\D/g, ''))} placeholder="รหัสพนักงาน" required />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="บทบาท" error={errors.role}>
              <Sel value={form.role} onChange={set('role')}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </Sel>
            </Field>

            <Field label="สถานะ" error={errors.status}>
              <Sel value={form.status} onChange={(v) => set('status')(v)}>
                <option value="active">ใช้งาน</option>
                <option value="pending">รอยืนยัน</option>
                <option value="inactive">ปิดใช้งาน</option>
              </Sel>
            </Field>
          </div>

          <Field label="แผนก" error={errors.dept}>
            <Sel value={form.dept} onChange={set('dept')}>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </Sel>
          </Field>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
            <Button variant="ghost" type="button" onClick={onClose}>ยกเลิก</Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มผู้ใช้งาน'}
            </Button>
          </div>
        </form>
      </Card>
      </div>
    </div>
  )
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  const cell = (w: number) => (
    <td style={{ padding: '12px 16px' }}>
      <div style={{ height: 14, width: w, borderRadius: 4, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
    </td>
  )
  return <tr>{cell(120)}{cell(60)}{cell(160)}{cell(60)}{cell(90)}{cell(60)}</tr>
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ meta, onPage }: { meta: PaginationMeta; onPage: (p: number) => void }) {
  if (meta.totalPages <= 1) return null
  const pages = Array.from({ length: meta.totalPages }, (_, i) => i + 1)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderTop: '1px solid var(--border)', fontSize: 13 }}>
      <span style={{ color: 'var(--muted)' }}>
        แสดง {((meta.page - 1) * meta.pageSize) + 1}–{Math.min(meta.page * meta.pageSize, meta.total)} จาก {meta.total} รายการ
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => onPage(meta.page - 1)} disabled={meta.page === 1}
          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: meta.page === 1 ? 'not-allowed' : 'pointer', color: 'var(--ink)', opacity: meta.page === 1 ? 0.4 : 1 }}
        >‹</button>
        {pages.map((p) => (
          <button
            key={p} onClick={() => onPage(p)}
            style={{
              padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer',
              background: p === meta.page ? 'var(--primary)' : 'transparent',
              color: p === meta.page ? '#fff' : 'var(--ink)',
              fontWeight: p === meta.page ? 700 : 400,
            }}
          >{p}</button>
        ))}
        <button
          onClick={() => onPage(meta.page + 1)} disabled={meta.page === meta.totalPages}
          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: meta.page === meta.totalPages ? 'not-allowed' : 'pointer', color: 'var(--ink)', opacity: meta.page === meta.totalPages ? 0.4 : 1 }}
        >›</button>
      </div>
    </div>
  )
}

// ─── Import Modal ─────────────────────────────────────────────────────────────
type ImportRow = {
  row: number
  name: string
  ephis_id: string
  role: string
  dept: string
  error?: string
}

function downloadTemplate() {
  import('xlsx').then(({ utils, writeFile }) => {
    const wb = utils.book_new()

    // Sheet 1: Users (template)
    const headers = ['ชื่อ-นามสกุล', 'E-Phis', 'บทบาท', 'แผนก']
    const examples = [
      ['สมศรี ใจดี', '10001', 'Medical Technologist', DEPARTMENTS[0]],
      ['วิชัย มานะ', '10002', 'Assistant', DEPARTMENTS[1]],
    ]
    const wsUsers = utils.aoa_to_sheet([headers, ...examples])
    wsUsers['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 26 }, { wch: 44 }]
    utils.book_append_sheet(wb, wsUsers, 'Users')

    // Sheet 2: บทบาท
    const wsRoles = utils.aoa_to_sheet([
      ['บทบาท (Role)', 'คำอธิบาย'],
      ['Admin',                     'ผู้ดูแลระบบ — สิทธิ์เต็ม'],
      ['Manager',                   'ผู้จัดการ — จัดการข้อมูลและผู้ใช้'],
      ['Document Controller',       'ควบคุมเอกสาร'],
      ['Medical Technologist',      'นักเทคนิคการแพทย์'],
      ['Medical Science Technician','นักวิทยาศาสตร์การแพทย์'],
      ['Assistant',                 'ผู้ช่วย — ดูข้อมูลได้อย่างเดียว'],
    ])
    wsRoles['!cols'] = [{ wch: 28 }, { wch: 36 }]
    utils.book_append_sheet(wb, wsRoles, 'บทบาท')

    // Sheet 3: แผนก
    const wsDepts = utils.aoa_to_sheet([
      ['แผนก (Department)'],
      ...DEPARTMENTS.map((d) => [d]),
    ])
    wsDepts['!cols'] = [{ wch: 52 }]
    utils.book_append_sheet(wb, wsDepts, 'แผนก')

    writeFile(wb, 'user-import-template.xlsx')
  })
}

function parseXlsx(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const XLSX = require('xlsx')
        const wb = XLSX.read(e.target?.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        const [header, ...dataRows] = raw.filter((r) => r.some((c) => String(c).trim()))
        if (!header) { resolve([]); return }

        const col = (label: string) => header.findIndex((h) => String(h).trim() === label)
        const iName = col('ชื่อ-นามสกุล')
        const iEphis = col('E-Phis')
        const iRole = col('บทบาท')
        const iDept = col('แผนก')

        const rows: ImportRow[] = dataRows.map((r, i) => {
          const name     = String(r[iName]  ?? '').trim()
          const ephis_id = String(r[iEphis] ?? '').trim()
          const role     = String(r[iRole]  ?? '').trim()
          const dept     = String(r[iDept]  ?? '').trim()
          const parsed = createUserSchema.safeParse({ name, ephis_id, role, dept })
          return {
            row: i + 2,
            name, ephis_id, role, dept,
            error: parsed.success ? undefined : parsed.error.issues[0]?.message,
          }
        })
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่ได้'))
    reader.readAsArrayBuffer(file)
  })
}

function ImportModal({ onClose, onDone, showToast }: {
  onClose: () => void
  onDone: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ succeeded: number; failed: { row: number; error: string }[] } | null>(null)

  async function handleFile(file: File) {
    setParsing(true)
    setRows(null)
    setResult(null)
    try {
      const parsed = await parseXlsx(file)
      setRows(parsed)
    } catch {
      showToast('อ่านไฟล์ไม่สำเร็จ กรุณาใช้ไฟล์ .xlsx', 'error')
    } finally {
      setParsing(false)
    }
  }

  async function handleImport() {
    if (!rows) return
    const valid = rows.filter((r) => !r.error)
    if (valid.length === 0) return
    setImporting(true)
    const res = await fetch('/api/admin/users/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: valid.map(({ name, ephis_id, role, dept }) => ({ name, ephis_id, role, dept })) }),
    })
    const data = await res.json()
    setImporting(false)
    if (!res.ok) { showToast(data.error ?? 'เกิดข้อผิดพลาด', 'error'); return }
    setResult({ succeeded: data.succeeded, failed: data.failed })
    if (data.succeeded > 0) onDone()
  }

  const validCount   = rows?.filter((r) => !r.error).length ?? 0
  const invalidCount = rows?.filter((r) => !!r.error).length ?? 0

  const dropZoneStyle: React.CSSProperties = {
    border: '2px dashed var(--border)', borderRadius: 12, padding: '32px 24px',
    textAlign: 'center', cursor: 'pointer', background: 'var(--surface-2)',
    transition: 'border-color .15s',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>นำเข้าผู้ใช้งานจาก Excel</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>นำเข้าได้สูงสุด 200 รายการต่อครั้ง</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          {/* Template download */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Template Excel</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>คอลัมน์: ชื่อ-นามสกุล, E-Phis, บทบาท, แผนก</div>
            </div>
            <button
              onClick={downloadTemplate}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--primary)', fontFamily: 'inherit' }}
            >
              <Icon name="download" size={13} /> โหลด Template
            </button>
          </div>

          {/* File upload */}
          {!result && (
            <div
              style={dropZoneStyle}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            >
              <Icon name="upload" size={24} />
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginTop: 10 }}>
                {parsing ? 'กำลังอ่านไฟล์...' : 'คลิกหรือลากไฟล์ .xlsx มาวางที่นี่'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>รองรับเฉพาะไฟล์ .xlsx</div>
              <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>
          )}

          {/* Preview table */}
          {rows && rows.length > 0 && !result && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>พบ {rows.length} รายการ</span>
                {validCount > 0 && <Badge color="green" size="sm">{validCount} พร้อมนำเข้า</Badge>}
                {invalidCount > 0 && <Badge color="red" size="sm">{invalidCount} มีข้อผิดพลาด</Badge>}
                <button onClick={() => fileRef.current?.click()} style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  เลือกไฟล์ใหม่
                </button>
                <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
                      {['แถว', 'ชื่อ-นามสกุล', 'E-Phis', 'บทบาท', 'แผนก', 'สถานะ'].map((h) => (
                        <th key={h} style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontSize: 11 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.row} style={{ borderBottom: '1px solid var(--border)', background: r.error ? '#FEF2F2' : 'transparent' }}>
                        <td style={{ padding: '7px 12px', color: 'var(--muted)' }}>{r.row}</td>
                        <td style={{ padding: '7px 12px', fontWeight: 500 }}>{r.name || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                        <td style={{ padding: '7px 12px', fontFamily: 'monospace' }}>{r.ephis_id || '—'}</td>
                        <td style={{ padding: '7px 12px' }}>{r.role || '—'}</td>
                        <td style={{ padding: '7px 12px', color: 'var(--muted)', fontSize: 11.5 }}>{r.dept || '—'}</td>
                        <td style={{ padding: '7px 12px' }}>
                          {r.error
                            ? <span style={{ color: '#B91C1C', fontSize: 11.5 }}>✕ {r.error}</span>
                            : <span style={{ color: '#16A34A', fontSize: 11.5 }}>✓ พร้อม</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '16px 20px', borderRadius: 10, background: result.succeeded > 0 ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${result.succeeded > 0 ? '#BBF7D0' : '#FECACA'}` }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: result.succeeded > 0 ? '#166534' : '#B91C1C', marginBottom: 4 }}>
                  {result.succeeded > 0 ? `✓ นำเข้าสำเร็จ ${result.succeeded} รายการ` : 'นำเข้าไม่สำเร็จ'}
                </div>
                {result.failed.length > 0 && (
                  <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 6 }}>
                    ล้มเหลว {result.failed.length} รายการ: {result.failed.map((f) => `แถว ${f.row} (${f.error})`).join(' · ')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>
            {result ? 'ปิด' : 'ยกเลิก'}
          </Button>
          {!result && (
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={importing || validCount === 0}
            >
              {importing ? 'กำลังนำเข้า...' : `นำเข้า ${validCount} รายการ`}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sort header ──────────────────────────────────────────────────────────────
function SortTh({ label, field, sortField, sortDir, onClick }: {
  label: string; field: string; sortField: string; sortDir: 'asc' | 'desc'; onClick: (f: string) => void
}) {
  const active = sortField === field
  return (
    <th
      onClick={() => onClick(field)}
      style={{ padding: '11px 16px', fontSize: 11.5, fontWeight: 600, color: active ? 'var(--primary)' : 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      {label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AdminUserClient() {
  const { toasts, show: showToast } = useToast()

  const [users, setUsers]       = useState<UserProfile[]>([])
  const [loading, setLoading]   = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: 10, total: 0, totalPages: 0 })

  const [filters, setFilters] = useState<UserFilters>({ search: '', role: '', dept: '', status: '' })
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [modal, setModal]         = useState<{ mode: ModalMode; user?: UserProfile } | null>(null)
  const [confirm, setConfirm]     = useState<{ msg: string; onConfirm: () => void } | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchUsers = useCallback(async (f: UserFilters, page: number, sf: string, sd: string) => {
    setLoading(true)
    setFetchError(null)
    const sp = new URLSearchParams({
      search:    f.search,
      role:      f.role,
      dept:      f.dept,
      status:    f.status,
      page:      String(page),
      pageSize:  '10',
      sortField: sf,
      sortDir:   sd,
    })
    const res = await fetch(`/api/admin/users?${sp}`)
    if (res.ok) {
      const data = await res.json()
      setUsers(data.users)
      setPagination(data.pagination)
    } else {
      const data = await res.json().catch(() => ({}))
      setFetchError(data.error ?? `โหลดข้อมูลไม่สำเร็จ (${res.status})`)
      setUsers([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers(filters, pagination.page, sortField, sortDir)
  }, [sortField, sortDir]) // eslint-disable-line

  function applyFilter(partial: Partial<UserFilters>) {
    const next = { ...filters, ...partial }
    setFilters(next)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchUsers(next, 1, sortField, sortDir), 300)
  }

  function handleSort(field: string) {
    const newDir = sortField === field && sortDir === 'asc' ? 'desc' : 'asc'
    setSortField(field)
    setSortDir(newDir)
  }

  function handlePage(page: number) {
    fetchUsers(filters, page, sortField, sortDir)
    setPagination((p) => ({ ...p, page }))
  }

  async function toggleStatus(user: UserProfile) {
    const newStatus = user.status === 'active' ? 'inactive' : 'active'
    const label = newStatus === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'
    setConfirm({
      msg: `ต้องการ${label}ผู้ใช้ "${user.name}" ใช่หรือไม่?`,
      onConfirm: async () => {
        setConfirm(null)
        const res = await fetch(`/api/admin/users/${user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _action: 'toggle_status', status: newStatus }),
        })
        if (res.ok) { showToast(`${label}สำเร็จ`); fetchUsers(filters, pagination.page, sortField, sortDir) }
        else { const d = await res.json(); showToast(d.error ?? 'เกิดข้อผิดพลาด', 'error') }
      },
    })
  }

  async function handleDelete(user: UserProfile) {
    setConfirm({
      msg: `ต้องการลบผู้ใช้ "${user.name}" ออกจากระบบ? การลบนี้ไม่สามารถกู้คืนได้`,
      onConfirm: async () => {
        setConfirm(null)
        const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
        if (res.ok) { showToast('ลบผู้ใช้งานสำเร็จ'); fetchUsers(filters, pagination.page, sortField, sortDir) }
        else { const d = await res.json(); showToast(d.error ?? 'เกิดข้อผิดพลาด', 'error') }
      },
    })
  }

  const activeFilters = [filters.role, filters.dept, filters.status].filter(Boolean).length

  return (
    <>
      <ToastContainer toasts={toasts} />
      {confirm && <ConfirmDialog msg={confirm.msg} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
      {modal && (
        <UserFormModal
          mode={modal.mode}
          user={modal.user}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchUsers(filters, pagination.page, sortField, sortDir) }}
          showToast={showToast}
        />
      )}
      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onDone={() => { setImportOpen(false); fetchUsers(filters, 1, sortField, sortDir) }}
          showToast={showToast}
        />
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', maxWidth: 340 }}>
          <Input
            icon="search"
            type="text"
            value={filters.search}
            onChange={(v) => applyFilter({ search: v })}
            placeholder="ค้นหาชื่อ หรือ E-Phis…"
          />
        </div>

        <Sel value={filters.role} onChange={(v) => applyFilter({ role: v as UserRole | '' })} placeholder="บทบาททั้งหมด">
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </Sel>

        <Sel value={filters.dept} onChange={(v) => applyFilter({ dept: v })} placeholder="แผนกทั้งหมด">
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </Sel>

        <Sel value={filters.status} onChange={(v) => applyFilter({ status: v as UserStatus | '' })} placeholder="สถานะทั้งหมด">
          <option value="active">ใช้งาน</option>
          <option value="pending">รอยืนยัน</option>
          <option value="inactive">ปิดใช้งาน</option>
        </Sel>

        {activeFilters > 0 && (
          <button
            onClick={() => { const f = { search: '', role: '', dept: '', status: '' } as UserFilters; setFilters(f); fetchUsers(f, 1, sortField, sortDir) }}
            style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontFamily: 'inherit' }}
          >
            ล้างตัวกรอง ({activeFilters})
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button variant="secondary" icon="upload" onClick={() => setImportOpen(true)}>
            นำเข้า Excel
          </Button>
          <Button variant="primary" icon="plus" onClick={() => setModal({ mode: 'create' })}>
            เพิ่มผู้ใช้งาน
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card padding={0} style={{ marginTop: 12 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                <SortTh label="ชื่อ-นามสกุล" field="name"       sortField={sortField} sortDir={sortDir} onClick={handleSort} />
                <SortTh label="E-Phis"         field="ephis_id"  sortField={sortField} sortDir={sortDir} onClick={handleSort} />
                <SortTh label="บทบาท"          field="role"      sortField={sortField} sortDir={sortDir} onClick={handleSort} />
                <SortTh label="แผนก"           field="dept"      sortField={sortField} sortDir={sortDir} onClick={handleSort} />
                <SortTh label="สถานะ"          field="status"    sortField={sortField} sortDir={sortDir} onClick={handleSort} />
                <SortTh label="วันที่สร้าง"    field="created_at" sortField={sortField} sortDir={sortDir} onClick={handleSort} />
                <th style={{ padding: '11px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)', letterSpacing: '.04em', textTransform: 'uppercase' }} />
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : fetchError
                ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px 24px', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 18px', display: 'inline-block', maxWidth: 480 }}>
                        <strong>โหลดข้อมูลไม่สำเร็จ:</strong> {fetchError}
                      </div>
                    </td>
                  </tr>
                )
                : users.length === 0
                ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>ไม่พบผู้ใช้งาน</div>
                      {activeFilters > 0 && <div style={{ fontSize: 12, marginTop: 4 }}>ลองปรับตัวกรองหรือคำค้นหา</div>}
                    </td>
                  </tr>
                )
                : users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--ink)' }}>{u.name}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontFamily: 'monospace', fontSize: 12 }}>
                      {u.ephis_id ?? '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge color={ROLE_COLORS[u.role] ?? 'gray'} size="sm">{u.role}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12 }}>
                      {u.dept || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge color={STATUS_COLORS[u.status] ?? 'gray'} size="sm">{STATUS_LABEL[u.status] ?? u.status}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('th-TH') : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setModal({ mode: 'edit', user: u })}
                          title="แก้ไข"
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--ink)', fontFamily: 'inherit' }}
                        >แก้ไข</button>
                        <button
                          onClick={() => toggleStatus(u)}
                          title={u.status === 'active' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: u.status === 'active' ? '#B45309' : '#15803D' }}
                        >{u.status === 'active' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}</button>
                        <button
                          onClick={() => handleDelete(u)}
                          title="ลบ"
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #FECACA', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#B91C1C', fontFamily: 'inherit' }}
                        >ลบ</button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        <Pagination meta={pagination} onPage={handlePage} />
      </Card>
    </>
  )
}
