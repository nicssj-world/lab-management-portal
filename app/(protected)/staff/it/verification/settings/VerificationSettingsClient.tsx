'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { departmentCodeForProfileDepartment, type ItDepartment } from '@/lib/it-verification/domain'
import type { VerificationSummary } from '@/lib/it-verification/types'

type Mapping = { id: string; source_lab_section: string; department_id: number; is_active: boolean }
type Profile = { id: string; name: string; dept: string | null }

const fieldStyle: React.CSSProperties = { width: '100%', minHeight: 44, boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13 }

export function VerificationSettingsClient({ initialMappings, profiles, departments, summary, year, quarter }: { initialMappings: Mapping[]; profiles: Profile[]; departments: readonly ItDepartment[]; summary: VerificationSummary; year: number; quarter: number }) {
  const [mappings, setMappings] = useState(initialMappings)
  const [newSection, setNewSection] = useState('')
  const [newDepartment, setNewDepartment] = useState(String(departments[0]?.id ?? ''))
  const [assignees, setAssignees] = useState<Record<string, string>>(() => Object.fromEntries(summary.departments.map((department) => [department.code, department.assigneeId ?? ''])))
  const [saving, setSaving] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function saveMapping(mapping: { id?: string; source_lab_section: string; department_id: number; is_active: boolean }) {
    setSaving(`mapping:${mapping.source_lab_section}`); setError(''); setMessage('')
    const response = await fetch('/api/staff/it/verification/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceLabSection: mapping.source_lab_section, departmentId: mapping.department_id, isActive: mapping.is_active }) })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) setError(body.error ?? 'บันทึก mapping ไม่สำเร็จ')
    else { setMappings((current) => { const next = current.filter((item) => item.source_lab_section !== body.source_lab_section); return [...next, body].sort((a, b) => a.source_lab_section.localeCompare(b.source_lab_section)) }); setMessage('บันทึก mapping แล้ว'); setNewSection('') }
    setSaving('')
  }

  async function saveAssignee(code: string, departmentId: number, roundId: string | null) {
    const profileId = assignees[code]
    if (!roundId || !profileId) { setError('รอบนี้ยังไม่มี sample ให้มอบหมาย หรือยังไม่ได้เลือกบุคลากร'); return }
    setSaving(`assignee:${code}`); setError(''); setMessage('')
    const response = await fetch('/api/staff/it/verification/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roundId, departmentId, profileId }) })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) setError(body.error ?? 'บันทึกผู้รับผิดชอบไม่สำเร็จ')
    else setMessage(`มอบหมาย ${code} แล้ว`)
    setSaving('')
  }

  return (
    <div className="it-verification-settings" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        .it-verification-settings-grid { display:grid; grid-template-columns:minmax(180px,1fr) minmax(180px,220px) 90px 100px; gap:8px; align-items:center; }
        .it-verification-settings-form { display:grid; grid-template-columns:minmax(180px,1fr) minmax(180px,220px) 100px; gap:8px; align-items:end; }
        .it-verification-assignee-row { display:grid; grid-template-columns:minmax(160px,.8fr) minmax(220px,1fr) 100px; gap:10px; align-items:center; }
        @media (max-width:760px) {
          .it-verification-settings-grid, .it-verification-settings-form, .it-verification-assignee-row { grid-template-columns:1fr; align-items:stretch; }
          .it-verification-settings-header { display:none; }
          .it-verification-settings-grid { padding:10px 0; gap:8px; }
          .it-verification-settings-grid > label { min-height:44px; }
        }
        @media (prefers-reduced-motion:reduce) { .it-verification-settings * { transition:none !important; animation:none !important; } }
      `}</style>
      <PageHeader title="ตั้งค่าการทวนสอบข้อมูล" subtitle={`Mapping lab section และผู้รับผิดชอบ · รอบปัจจุบัน Q${quarter}/${year + 543}`} actions={<Link href="/staff/it/verification" style={{ display: 'inline-flex', minHeight: 44, alignItems: 'center', gap: 6, color: 'var(--muted)', textDecoration: 'none', fontSize: 13 }}><Icon name="arrowLeft" size={15} /> กลับภาพรวม</Link>} />
      {message && <div role="status" aria-live="polite" style={{ padding: '11px 14px', borderRadius: 9, background: 'rgba(22,163,74,.08)', border: '1px solid rgba(22,163,74,.22)', color: 'var(--success)', fontSize: 13 }}>{message}</div>}
      {error && <div role="alert" aria-live="assertive" style={{ padding: '11px 14px', borderRadius: 9, background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.22)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
      <Card padding={18}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}><div><h2 style={{ margin: 0, fontSize: 17, color: 'var(--ink)' }}>Mapping จาก TAT</h2><p style={{ margin: '5px 0 0', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>ใช้ exact match เท่านั้น; section ที่ไม่ map จะขึ้น warning และไม่ทำให้ TAT upload ล้มเหลว</p></div><span style={{ fontSize: 12, color: 'var(--muted)' }}>{mappings.filter((item) => item.is_active).length} รายการ active</span></div>
        <div className="it-verification-settings-grid it-verification-settings-header" style={{ marginTop: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: 11.5, fontWeight: 700 }}><div>Lab section จากไฟล์</div><div>หน่วยงาน</div><div>สถานะ</div><div /></div>
        {mappings.map((mapping) => <div key={mapping.id} className="it-verification-settings-grid" style={{ padding: '9px 0', borderBottom: '1px solid var(--border)' }}><input value={mapping.source_lab_section} onChange={(event) => setMappings((current) => current.map((item) => item.id === mapping.id ? { ...item, source_lab_section: event.target.value } : item))} aria-label="lab section" style={fieldStyle} /><Select value={String(mapping.department_id)} onChange={(value) => setMappings((current) => current.map((item) => item.id === mapping.id ? { ...item, department_id: Number(value) } : item))} options={departments.map((department) => ({ value: String(department.id), label: `${department.code} · ${department.name}` }))} size="lg" /><label style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, fontSize: 12, color: 'var(--muted)' }}><input type="checkbox" checked={mapping.is_active} onChange={(event) => setMappings((current) => current.map((item) => item.id === mapping.id ? { ...item, is_active: event.target.checked } : item))} />ใช้งาน</label><Button variant="secondary" size="md" disabled={saving === `mapping:${mapping.source_lab_section}`} onClick={() => saveMapping(mapping)} style={{ minHeight: 44 }}>{saving === `mapping:${mapping.source_lab_section}` ? 'กำลังบันทึก' : 'บันทึก'}</Button></div>)}
        <div className="it-verification-settings-form" style={{ marginTop: 14 }}><label style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 700 }}>เพิ่ม lab section<input value={newSection} onChange={(event) => setNewSection(event.target.value)} placeholder="เช่น POCT2" style={{ ...fieldStyle, marginTop: 5 }} /></label><label style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 700 }}>หน่วยงาน<Select value={newDepartment} onChange={setNewDepartment} options={departments.map((department) => ({ value: String(department.id), label: `${department.code} · ${department.name}` }))} size="lg" style={{ width: '100%', marginTop: 5 }} /></label><Button size="lg" icon="plus" disabled={!newSection.trim() || Boolean(saving)} onClick={() => saveMapping({ source_lab_section: newSection.trim(), department_id: Number(newDepartment), is_active: true })}>เพิ่ม mapping</Button></div>
      </Card>
      <Card padding={18}>
        <div><h2 style={{ margin: 0, fontSize: 17, color: 'var(--ink)' }}>ผู้รับผิดชอบรายหน่วยงาน</h2><p style={{ margin: '5px 0 0', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>มอบหมายผู้กรอกผลให้กับรอบปัจจุบัน; ผู้รับผิดชอบจะแก้ไขได้เฉพาะ sample ของหน่วยงานตนเอง</p></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>{summary.departments.map((department) => <div key={department.code} className="it-verification-assignee-row" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}><div><strong style={{ color: 'var(--ink)', fontSize: 13 }}>{department.code}</strong><span style={{ marginLeft: 7, color: 'var(--muted)', fontSize: 12 }}>{department.name}</span></div><Select value={assignees[department.code] ?? ''} onChange={(value) => setAssignees((current) => ({ ...current, [department.code]: value }))} placeholder="เลือกบุคลากร" options={profiles.filter((profile) => departmentCodeForProfileDepartment(profile.dept) === department.code).map((profile) => ({ value: profile.id, label: profile.name }))} size="lg" /><Button variant="secondary" size="md" disabled={saving === `assignee:${department.code}` || !department.roundId} onClick={() => saveAssignee(department.code, department.departmentId, department.roundId)} style={{ minHeight: 44 }}>{saving === `assignee:${department.code}` ? 'กำลังบันทึก' : 'มอบหมาย'}</Button></div>)}</div>
      </Card>
    </div>
  )
}
