'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Icon } from '@/components/ui/Icon'
import { DEPARTMENTS } from '@/lib/validations/user-schema'
import type { DeptRole } from '@/lib/supabase/types'

export type ManageRow = {
  id: string
  name: string
  dept: string | null
  dept_role: DeptRole | null
  position_title: string | null
  role: string
}

const DEPT_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'ลูกน้อง (สมาชิก)' },
  { value: 'section_head', label: 'หัวหน้างาน' },
  { value: 'group_deputy', label: 'รองหัวหน้ากลุ่มงาน' },
  { value: 'group_lead', label: 'หัวหน้ากลุ่มงาน' },
]

const input: React.CSSProperties = { minHeight: 38, border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13 }
const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }
const th: React.CSSProperties = { padding: '9px 12px', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '9px 12px', fontSize: 13, color: 'var(--ink)', verticalAlign: 'middle' }

export function ManageClient({ rows: initialRows }: { rows: ManageRow[] }) {
  const [rows, setRows] = useState(initialRows)
  const [dept, setDept] = useState<string>(DEPARTMENTS[0])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const deptRows = useMemo(() => rows.filter((r) => r.dept === dept), [rows, dept])
  const selectedInDept = deptRows.filter((r) => selected.has(r.id))

  async function setDeptRole(id: string, value: string) {
    setBusyId(id)
    setError('')
    const deptRole = (value || null) as DeptRole | null
    try {
      const res = await fetch('/api/admin/personnel/manage/dept-role', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: id, deptRole }),
      })
      if (!res.ok) throw new Error((await res.json())?.error ?? 'บันทึกไม่สำเร็จ')
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, dept_role: deptRole } : r)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setBusyId(null)
    }
  }

  function toggle(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  function toggleAll() {
    setSelected((prev) => {
      const allSelected = deptRows.every((r) => prev.has(r.id))
      const next = new Set(prev)
      for (const r of deptRows) allSelected ? next.delete(r.id) : next.add(r.id)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <PageHeader eyebrow="กลุ่มงานเทคนิคการแพทย์" title="จัดการกลุ่มงาน" subtitle="กำหนดหัวหน้างานและมอบหมายงานให้บุคลากรในแต่ละงาน" marginBottom={0} />
        <Link href="/staff/personnel/team-org" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          <Icon name="users" size={15} /> ผังองค์กรกลุ่มงาน
        </Link>
      </div>

      {error && <div role="alert" style={{ padding: 10, borderRadius: 8, background: '#FEF2F2', color: '#B91C1C', fontSize: 13 }}>{error}</div>}

      <div style={card}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 420 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>เลือกงาน (แผนก)</span>
          <select value={dept} onChange={(e) => { setDept(e.target.value); setSelected(new Set()) }} style={input}>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
      </div>

      {selectedInDept.length > 0 && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'var(--surface-2)' }}>
          <strong style={{ fontSize: 13 }}>เลือก {selectedInDept.length} คน</strong>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>มอบหมายทีละหลายคน (มอบสิทธิ / แผนอบรม / สมรรถนะ) จะเพิ่มในขั้นถัดไป</span>
        </div>
      )}

      <div style={{ ...card, padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 36 }}><input type="checkbox" checked={deptRows.length > 0 && deptRows.every((r) => selected.has(r.id))} onChange={toggleAll} /></th>
              <th style={th}>ชื่อ</th>
              <th style={th}>ตำแหน่ง</th>
              <th style={th}>บทบาทในผังกลุ่มงาน</th>
            </tr>
          </thead>
          <tbody>
            {deptRows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={td}><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td style={{ ...td, fontWeight: 600 }}><Link href={`/staff/personnel/${r.id}`} style={{ color: 'var(--ink)', textDecoration: 'none' }}>{r.name}</Link></td>
                <td style={{ ...td, color: 'var(--muted)' }}>{r.position_title ?? r.role}</td>
                <td style={td}>
                  <select value={r.dept_role ?? ''} disabled={busyId === r.id} onChange={(e) => setDeptRole(r.id, e.target.value)} style={{ ...input, minHeight: 32 }}>
                    {DEPT_ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {deptRows.length === 0 && <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: 'var(--muted)' }}>ไม่มีบุคลากรในงานนี้</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
