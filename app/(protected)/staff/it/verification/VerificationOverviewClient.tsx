'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { getThaiMonthLabel } from '@/lib/kpi-utils'
import { IT_DEPARTMENTS, TARGET_SAMPLES_PER_QUARTER } from '@/lib/it-verification/domain'
import { statusLabel } from '@/lib/it-verification/status'
import type { VerificationSummary } from '@/lib/it-verification/types'

type UploadOption = { id: string; year: number; month: number; file_name: string; row_count: number }

type Props = {
  initialSummary: VerificationSummary
  initialYear: number
  initialQuarter: number
  initialUploads: UploadOption[]
  canManage: boolean
}

function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; ok: boolean }>>([])
  const nextId = useRef(0)
  const add = useCallback((message: string, ok = true) => {
    const id = ++nextId.current
    setToasts((current) => [...current, { id, message, ok }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3500)
  }, [])
  return { toasts, add }
}

function statusColor(status: string | null, ready: boolean) {
  if (ready) return 'green' as const
  if (status === 'failed' || status === 'no_population') return 'amber' as const
  if (status === 'reviewed') return 'blue' as const
  if (status === 'submitted') return 'purple' as const
  return 'gray' as const
}

function statusIcon(status: string | null, ready: boolean) {
  if (ready) return 'check'
  if (status === 'failed' || status === 'no_population') return 'alert'
  if (status === 'submitted') return 'clock'
  return 'beaker'
}

export function VerificationOverviewClient({ initialSummary, initialYear, initialQuarter, initialUploads, canManage }: Props) {
  const [summary, setSummary] = useState(initialSummary)
  const [year, setYear] = useState(initialYear)
  const [quarter, setQuarter] = useState(initialQuarter)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedUpload, setSelectedUpload] = useState(initialUploads[0]?.id ?? '')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [sampling, setSampling] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)
  const { toasts, add } = useToast()

  const years = useMemo(() => Array.from({ length: 5 }, (_, index) => initialYear - index), [initialYear])

  const loadSummary = useCallback(async (nextYear = year, nextQuarter = quarter) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/staff/it/verification/summary?year=${nextYear}&quarter=${nextQuarter}`)
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? 'โหลดสรุปการทวนสอบไม่สำเร็จ')
      setSummary(body as VerificationSummary)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [quarter, year])

  useEffect(() => {
    if (year === initialYear && quarter === initialQuarter) return
    void loadSummary(year, quarter)
  }, [initialQuarter, initialYear, loadSummary, quarter, year])

  async function generateSamples() {
    if (!selectedUpload) { add('กรุณาเลือกไฟล์ TAT ต้นทาง', false); return }
    setSampling(true)
    try {
      const response = await fetch('/api/staff/it/verification/sampling/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: selectedUpload, departmentId: selectedDepartment ? Number(selectedDepartment) : null }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? 'ดึงตัวอย่างไม่สำเร็จ')
      const warnings = (body.items ?? []).map((item: { warning?: string }) => item.warning).filter(Boolean)
      add(warnings.length ? `สร้างตัวอย่างแล้ว แต่มีคำเตือน: ${warnings.join(' · ')}` : 'สร้างชุดตัวอย่างจาก TAT แล้ว', !warnings.length)
      await loadSummary()
    } catch (cause) {
      add(cause instanceof Error ? cause.message : 'ดึงตัวอย่างไม่สำเร็จ', false)
    } finally {
      setSampling(false)
    }
  }

  const totalProgress = summary.totals.target === 0 ? 0 : Math.min(100, Math.round((summary.totals.sampled / summary.totals.target) * 100))

  return (
    <div className="it-verification-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        .it-verification-kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); }
        .it-verification-period { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; }
        .it-verification-period-controls { display:flex; align-items:flex-end; gap:10px; flex-wrap:wrap; }
        .it-verification-table-wrap { overflow-x:auto; }
        .it-verification-desktop-table { display:table; }
        .it-verification-mobile-list { display:none; }
        .it-verification-row-link { color:inherit; text-decoration:none; }
        .it-verification-row-link:hover .it-verification-dept-name { color:var(--primary); }
        .it-verification-action-link { min-height:44px; display:inline-flex; align-items:center; gap:7px; color:var(--primary); text-decoration:none; font-size:16px; font-weight:600; }
        @media (max-width: 900px) { .it-verification-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media (max-width: 640px) {
          .it-verification-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .it-verification-desktop-table { display:none; }
          .it-verification-mobile-list { display:flex; flex-direction:column; gap:8px; }
          .it-verification-period-controls { width:100%; }
          .it-verification-period-controls > label { flex:1; min-width:130px; }
          .it-verification-period-controls select { width:100% !important; }
        }
        @media (prefers-reduced-motion: reduce) { .it-verification-page * { transition:none !important; animation:none !important; } }
      `}</style>

      <div aria-live="polite" style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 'min(380px, calc(100vw - 32px))' }}>
        {toasts.map((toast) => (
          <div key={toast.id} role="status" style={{ padding: '11px 14px', borderRadius: 10, background: toast.ok ? 'var(--success)' : 'var(--danger)', color: '#fff', boxShadow: '0 8px 24px rgba(15,23,42,.18)', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Icon name={toast.ok ? 'check' : 'alert'} size={15} />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      <PageHeader
        title="ทวนสอบการส่งผ่านข้อมูล HIS & LIS"
        subtitle="สุ่ม LAB ID จากข้อมูล TAT และติดตามผลตามแบบฟอร์ม Fm-QP-LAB-24/02"
        actions={
          <>
            {canManage && <Link href="/staff/it/verification/settings" className="it-verification-action-link">
              <Icon name="settings" size={16} /> ตั้งค่า
            </Link>}
          </>
        }
      />

      <Card padding={16}>
        <div className="it-verification-period">
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>รอบการทวนสอบ</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>เลือกช่วงเวลาเพื่อดูสถานะของทั้ง 7 หน่วยงาน</div>
          </div>
          <div className="it-verification-period-controls">
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
              ปี พ.ศ.
              <Select value={String(year)} onChange={(value) => setYear(Number(value))} options={years.map((item) => ({ value: String(item), label: `${item + 543} (${item})` }))} size="lg" style={{ minWidth: 150 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
              ไตรมาส
              <Select value={String(quarter)} onChange={(value) => setQuarter(Number(value))} options={[1, 2, 3, 4].map((item) => ({ value: String(item), label: `ไตรมาส ${item}` }))} size="lg" style={{ minWidth: 140 }} />
            </label>
            {canManage && <Button size="lg" icon="refresh" onClick={() => setShowGenerator((value) => !value)} aria-pressed={showGenerator}>{showGenerator ? 'ซ่อนตัวสร้างตัวอย่าง' : 'ดึงตัวอย่างจาก TAT'}</Button>}
          </div>
        </div>
      </Card>

      {showGenerator && canManage && (
        <Card padding={18} style={{ borderColor: 'rgba(30,95,173,.28)', background: 'var(--card)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, color: 'var(--ink)' }}>สร้างชุดตัวอย่างจาก TAT</h2>
              <p style={{ margin: '5px 0 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>ระบบจะเลือก LN แบบ deterministic และไม่สร้างชุดใหม่ซ้ำเมื่อเป็นไฟล์เดือนเดิม</p>
            </div>
            <Badge color="blue" dot>เฉพาะผู้ดูแล IT</Badge>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16, alignItems: 'end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
              ไฟล์ TAT ต้นทาง <span style={{ color: 'var(--danger)' }}>*</span>
              <Select value={selectedUpload} onChange={setSelectedUpload} placeholder="เลือกเดือนที่อัปโหลดแล้ว" options={initialUploads.map((upload) => ({ value: upload.id, label: `${getThaiMonthLabel(upload.month)} ${upload.year + 543} · ${upload.row_count.toLocaleString()} แถว` }))} size="lg" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
              หน่วยงาน
              <Select value={selectedDepartment} onChange={setSelectedDepartment} placeholder="ทุกหน่วยงาน" options={IT_DEPARTMENTS.map((department) => ({ value: String(department.id), label: `${department.code} · ${department.name}` }))} size="lg" />
            </label>
            <Button size="lg" icon="beaker" onClick={generateSamples} disabled={sampling || !selectedUpload} aria-busy={sampling}>{sampling ? 'กำลังสุ่ม...' : 'เริ่มสร้างตัวอย่าง'}</Button>
          </div>
          <div style={{ marginTop: 12, padding: '9px 11px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>
            <Icon name="lock" size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />เก็บเฉพาะ LN และ metadata ที่จำเป็นต่อการทวนสอบ ไม่มีชื่อผู้ป่วยหรือ HN
          </div>
        </Card>
      )}

      {!summary.schemaReady && (
        <div role="alert" style={{ padding: '13px 16px', borderRadius: 10, background: 'rgba(217,119,6,.10)', border: '1px solid rgba(217,119,6,.28)', color: 'var(--ink)', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 9 }}>
          <Icon name="alert" size={17} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <span>{summary.warnings[0] ?? 'ฐานข้อมูลการทวนสอบยังไม่พร้อมใช้งาน'}</span>
        </div>
      )}

      {error && (
        <div role="alert" style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.24)', color: 'var(--danger)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span>{error}</span><Button variant="secondary" size="sm" icon="refresh" onClick={() => loadSummary()}>ลองใหม่</Button>
        </div>
      )}

      <div className="it-verification-kpis" style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--card)' }}>
        {[
          { label: 'ตัวอย่างทั้งหมด', value: summary.totals.sampled, suffix: `/ ${summary.totals.target || TARGET_SAMPLES_PER_QUARTER * IT_DEPARTMENTS.length}`, icon: 'beaker', color: 'var(--primary)' },
          { label: 'ตรวจแล้ว', value: summary.totals.completed, suffix: '', icon: 'check', color: 'var(--success)' },
          { label: 'Finding ที่ยังเปิด', value: summary.totals.openFindings, suffix: '', icon: 'alert', color: 'var(--danger)' },
          { label: 'หน่วยงานพร้อมส่ง', value: summary.totals.readyDepartments, suffix: `/ ${IT_DEPARTMENTS.length}`, icon: 'shieldCheck', color: 'var(--warning)' },
        ].map((item, index) => (
          <div key={item.label} style={{ padding: '16px 18px', borderRight: index < 3 ? '1px solid var(--border)' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: item.color, fontSize: 12, fontWeight: 600 }}><Icon name={item.icon} size={15} />{item.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 7 }}><strong style={{ fontSize: 26, lineHeight: 1, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{item.value}</strong><span style={{ color: 'var(--muted)', fontSize: 12 }}>{item.suffix}</span></div>
          </div>
        ))}
      </div>

      <Card padding={0}>
        <div style={{ padding: '16px 18px 13px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div><h2 style={{ margin: 0, color: 'var(--ink)', fontSize: 17 }}>สถานะหน่วยงาน</h2><p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12.5 }}>เป้าหมาย {TARGET_SAMPLES_PER_QUARTER} LAB ID ต่อหน่วยงานต่อไตรมาส · ภาพรวม {totalProgress}%</p></div>
          <div style={{ width: 150, height: 7, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden', marginTop: 6 }}><div style={{ width: `${totalProgress}%`, height: '100%', background: 'var(--primary)', borderRadius: 99 }} /></div>
        </div>
        {loading ? (
          <div aria-label="กำลังโหลดสถานะหน่วยงาน" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((item) => <div key={item} style={{ height: 48, borderRadius: 8, background: 'var(--surface-2)' }} />)}
          </div>
        ) : summary.departments.length === 0 ? (
          <EmptyState title="ยังไม่มีรอบการทวนสอบ" hint="เลือกไฟล์ TAT แล้วใช้ปุ่มดึงตัวอย่างเพื่อเริ่มต้น" icon="beaker" />
        ) : (
          <>
            <div className="it-verification-table-wrap it-verification-desktop-table">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: 'var(--surface-2)', color: 'var(--muted)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 18px', fontWeight: 700 }}>หน่วยงาน</th><th style={{ padding: '10px 12px', fontWeight: 700 }}>ความคืบหน้า</th><th style={{ padding: '10px 12px', fontWeight: 700 }}>ตรวจแล้ว</th><th style={{ padding: '10px 12px', fontWeight: 700 }}>Finding</th><th style={{ padding: '10px 12px', fontWeight: 700 }}>ผู้รับผิดชอบ</th><th style={{ padding: '10px 18px 10px 12px', fontWeight: 700 }}>สถานะ</th>
                </tr></thead>
                <tbody>{summary.departments.map((department) => {
                  const percent = department.target === 0 ? 0 : Math.min(100, Math.round((department.sampled / department.target) * 100))
                  const content = <><td style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)' }}>{department.roundId ? <Link href={`/staff/it/verification/${department.roundId}`} className="it-verification-row-link" style={{ display: 'flex', minHeight: 44, flexDirection: 'column', justifyContent: 'center' }}><div className="it-verification-dept-name" style={{ fontWeight: 700 }}>{department.code} <span style={{ fontWeight: 500, color: 'var(--muted)' }}>· {department.name}</span></div><div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>รายเดือน 3 / 3 / 4</div></Link> : <><div className="it-verification-dept-name" style={{ fontWeight: 700 }}>{department.code} <span style={{ fontWeight: 500, color: 'var(--muted)' }}>· {department.name}</span></div><div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>รายเดือน 3 / 3 / 4</div></>}</td><td style={{ padding: '13px 12px', borderBottom: '1px solid var(--border)', minWidth: 190 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}><span>{department.sampled} / {department.target}</span><span style={{ color: 'var(--muted)' }}>{percent}%</span></div><div style={{ height: 7, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}><div style={{ height: '100%', width: `${percent}%`, background: department.ready ? 'var(--success)' : 'var(--primary)', borderRadius: 99 }} /></div></td><td style={{ padding: '13px 12px', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{department.completed} / {department.sampled}</td><td style={{ padding: '13px 12px', borderBottom: '1px solid var(--border)' }}>{department.openFindings > 0 ? <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{department.openFindings} เปิด</span> : <span style={{ color: 'var(--muted)' }}>—</span>}</td><td style={{ padding: '13px 12px', borderBottom: '1px solid var(--border)', color: department.assigneeName ? 'var(--ink)' : 'var(--muted)' }}>{department.assigneeName ?? 'ยังไม่มอบหมาย'}</td><td style={{ padding: '13px 18px 13px 12px', borderBottom: '1px solid var(--border)' }}><Badge color={statusColor(department.roundStatus ?? department.samplingStatus, department.ready)} dot>{statusLabel(department.ready ? 'ready' : department.roundStatus ?? department.samplingStatus)}</Badge>{department.warning && <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 5, maxWidth: 220 }}>{department.warning}</div>}</td></>
                  return <tr key={department.code} style={{ transition: 'background .1s' }} onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--surface-2)' }} onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent' }}>{content}</tr>
                })}</tbody>
              </table>
            </div>
            <div className="it-verification-mobile-list" style={{ padding: 12 }}>
              {summary.departments.map((department) => {
                const percent = department.target === 0 ? 0 : Math.min(100, Math.round((department.sampled / department.target) * 100))
                const card = <div style={{ padding: 13, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}><div><div style={{ fontWeight: 700, color: 'var(--ink)' }}>{department.code} · {department.name}</div><div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>ตรวจแล้ว {department.completed}/{department.sampled} · Finding {department.openFindings}</div></div><Badge color={statusColor(department.roundStatus ?? department.samplingStatus, department.ready)} dot>{statusLabel(department.ready ? 'ready' : department.roundStatus ?? department.samplingStatus)}</Badge></div><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 12, color: 'var(--muted)' }}><span>ความคืบหน้า</span><strong style={{ color: 'var(--ink)' }}>{department.sampled}/{department.target} · {percent}%</strong></div><div style={{ height: 7, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden', marginTop: 6 }}><div style={{ width: `${percent}%`, height: '100%', background: department.ready ? 'var(--success)' : 'var(--primary)', borderRadius: 99 }} /></div>{department.warning && <div style={{ color: 'var(--warning)', fontSize: 11.5, marginTop: 8 }}>{department.warning}</div>}</div>
                return department.roundId ? <Link key={department.code} href={`/staff/it/verification/${department.roundId}`} className="it-verification-row-link">{card}</Link> : <div key={department.code}>{card}</div>
              })}
            </div>
          </>
        )}
      </Card>

      <div style={{ color: 'var(--muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name={statusIcon(null, false)} size={14} />{summary.warnings.length > 0 ? summary.warnings.join(' · ') : 'การสุ่มใช้ LN เป็นหน่วยอ้างอิง และเก็บหลักฐานแบบแก้ไขย้อนหลังได้โดยไม่ลบข้อมูลเดิม'}</div>
    </div>
  )
}
