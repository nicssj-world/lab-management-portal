'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { getThaiMonthLabel } from '@/lib/kpi-utils'
import { sampleComplete, statusLabel, type SampleResult } from '@/lib/it-verification/status'
import type { VerificationFinding, VerificationRoundDetail, VerificationSample } from '@/lib/it-verification/types'

type UploadOption = { id: string; year: number; month: number; file_name: string; row_count: number }
type FindingDraft = { transferPoint: 'lis_to_his' | 'source_to_lis'; description: string; severity: 'low' | 'medium' | 'high' }
type SampleDraft = { lisToHis: SampleResult; sourceToLis: SampleResult; remark: string; findings: FindingDraft[] }
type DialogState = { kind: 'review' | 'reopen' | 'resample' | 'finding'; findingId?: string } | null

function draftFromSample(sample: VerificationSample): SampleDraft {
  return {
    lisToHis: sample.lis_to_his,
    sourceToLis: sample.source_to_lis,
    remark: sample.remark ?? '',
    findings: sample.findings.filter((finding) => finding.status !== 'closed').map((finding) => ({ transferPoint: finding.transfer_point, description: finding.description, severity: finding.severity })),
  }
}

function resultLabel(result: SampleResult) {
  return result === 'pass' ? 'ผ่าน' : result === 'fail' ? 'ไม่ผ่าน' : result === 'na' ? 'N/A' : 'ยังไม่ระบุ'
}

function findingLabel(point: FindingDraft['transferPoint']) {
  return point === 'lis_to_his' ? 'LIS → HIS' : 'เครื่องมือ/Manual → LIS'
}

function findingForPoint(sample: VerificationSample, draft: SampleDraft, point: FindingDraft['transferPoint']) {
  return draft.findings.find((finding) => finding.transferPoint === point)?.description
    ?? sample.findings.find((finding) => finding.transfer_point === point && finding.status !== 'closed')?.description
    ?? ''
}

function ResultControl({ label, value, onChange, disabled }: { label: string; value: SampleResult; onChange: (value: SampleResult) => void; disabled: boolean }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>{label}</legend>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['pass', 'fail', 'na'] as const).map((result) => {
          const active = value === result
          const colors = result === 'pass' ? { bg: 'rgba(22,163,74,.10)', fg: 'var(--success)', border: 'rgba(22,163,74,.34)' } : result === 'fail' ? { bg: 'rgba(220,38,38,.10)', fg: 'var(--danger)', border: 'rgba(220,38,38,.34)' } : { bg: 'rgba(217,119,6,.10)', fg: 'var(--warning)', border: 'rgba(217,119,6,.34)' }
          return <button key={result} type="button" disabled={disabled} aria-pressed={active} onClick={() => onChange(active ? null : result)} style={{ minWidth: 52, minHeight: 44, borderRadius: 8, border: `1px solid ${active ? colors.border : 'var(--border)'}`, background: active ? colors.bg : 'var(--card)', color: active ? colors.fg : 'var(--muted)', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .55 : 1, transition: 'background .15s, border-color .15s, color .15s' }}>{resultLabel(result)}</button>
        })}
      </div>
    </fieldset>
  )
}

function ActionDialog({ state, onClose, onConfirm, loading, reviewDecision, onReviewDecision, resampleOptions, selectedUpload, onSelectedUpload }: { state: DialogState; onClose: () => void; onConfirm: (value: string) => void; loading: boolean; reviewDecision: 'approve' | 'return'; onReviewDecision: (decision: 'approve' | 'return') => void; resampleOptions: UploadOption[]; selectedUpload: string; onSelectedUpload: (id: string) => void }) {
  const [value, setValue] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setValue('')
    if (state) window.setTimeout(() => dialogRef.current?.focus(), 0)
  }, [state])
  if (!state) return null
  const title = state.kind === 'review' ? 'ตรวจสอบและตัดสินรอบ' : state.kind === 'reopen' ? 'เปิดรอบที่ล็อกแล้วอีกครั้ง' : state.kind === 'resample' ? 'สุ่มตัวอย่างใหม่' : 'ปิด finding'
  const helper = state.kind === 'review' ? 'กรณีส่งกลับแก้ไข กรุณาระบุเหตุผล; หากอนุมัติจะล็อกข้อมูล' : state.kind === 'reopen' ? 'เหตุผลนี้จะถูกบันทึกใน audit trail' : state.kind === 'resample' ? 'การสุ่มใหม่จะ void ชุดเดิมและเก็บหลักฐานเดิมไว้' : 'ระบุวิธีแก้ไขก่อนปิด finding'
  const required = state.kind === 'review' ? reviewDecision === 'approve' || value.trim().length > 0 : value.trim().length > 0
  return (
    <div role="presentation" onKeyDown={(event) => { if (event.key === 'Escape') onClose() }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.46)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="it-verification-dialog-title" aria-describedby="it-verification-dialog-helper" style={{ width: '100%', maxWidth: 520, background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(15,23,42,.22)', overflow: 'hidden' }}>
        <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><h2 id="it-verification-dialog-title" style={{ margin: 0, color: 'var(--ink)', fontSize: 17 }}>{title}</h2><button type="button" aria-label="ปิดหน้าต่าง" onClick={onClose} style={{ width: 44, height: 44, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}><Icon name="x" size={16} /></button></div>
        <div style={{ padding: 18 }}>
          <p id="it-verification-dialog-helper" style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>{helper}</p>
          {state.kind === 'review' && <div role="group" aria-label="การตัดสินรอบ" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {([['approve', 'อนุมัติและล็อก'], ['return', 'ส่งกลับแก้ไข']] as const).map(([decision, label]) => <button key={decision} type="button" aria-pressed={reviewDecision === decision} onClick={() => onReviewDecision(decision)} style={{ minHeight: 44, padding: '8px 12px', borderRadius: 8, border: `1px solid ${reviewDecision === decision ? 'var(--primary)' : 'var(--border)'}`, background: reviewDecision === decision ? 'var(--primary-soft)' : 'var(--card)', color: reviewDecision === decision ? 'var(--primary)' : 'var(--muted)', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{label}</button>)}
          </div>}
          {state.kind === 'resample' && <label style={{ display: 'block', color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>ไฟล์ TAT ต้นทางสำหรับสุ่มใหม่<Select value={selectedUpload} onChange={onSelectedUpload} options={resampleOptions.map((upload) => ({ value: upload.id, label: `${getThaiMonthLabel(upload.month)} ${upload.year + 543}` }))} size="lg" style={{ width: '100%', marginTop: 6 }} /></label>}
          <label style={{ display: 'block', color: 'var(--muted)', fontSize: 12, fontWeight: 700 }}>{state.kind === 'review' ? 'หมายเหตุ / เหตุผล' : 'เหตุผล'}{state.kind !== 'review' && <span style={{ color: 'var(--danger)' }}> *</span>}<textarea autoFocus={state.kind !== 'resample'} value={value} onChange={(event) => setValue(event.target.value)} rows={4} style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, resize: 'vertical', minHeight: 92, background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5 }} /></label>
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}><Button variant="secondary" size="lg" onClick={onClose}>ยกเลิก</Button><Button variant={state.kind === 'reopen' || state.kind === 'resample' ? 'danger' : 'primary'} size="lg" disabled={loading || !required} aria-busy={loading} onClick={() => onConfirm(value)}>{loading ? 'กำลังบันทึก...' : state.kind === 'review' ? 'ยืนยัน' : state.kind === 'finding' ? 'ปิด finding' : 'ดำเนินการ'}</Button></div>
      </div>
    </div>
  )
}

export function VerificationDetailClient({ initialDetail, initialUploads, canEdit, canManage, canReview }: { initialDetail: VerificationRoundDetail; initialUploads: UploadOption[]; canEdit: boolean; canManage: boolean; canReview: boolean }) {
  const [detail, setDetail] = useState(initialDetail)
  const [drafts, setDrafts] = useState<Record<string, SampleDraft>>(() => Object.fromEntries(initialDetail.samples.map((sample) => [sample.id, draftFromSample(sample)])))
  const [savingId, setSavingId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<DialogState>(null)
  const [selectedUpload, setSelectedUpload] = useState(initialUploads[0]?.id ?? '')
  const [selectedFinding, setSelectedFinding] = useState<VerificationFinding | null>(null)
  const [reviewDecision, setReviewDecision] = useState<'approve' | 'return'>('approve')
  const [toast, setToast] = useState('')

  const readiness = useMemo(() => {
    const activeFindings = detail.samples.flatMap((sample) => sample.findings).filter((finding) => finding.status !== 'closed').length
    const completed = detail.samples.filter((sample) => sampleComplete(sample.lis_to_his, sample.source_to_lis, sample.remark)).length
    const latestNoPopulation = detail.samples.length === 0 && detail.warnings.some((warning) => warning.includes('ไม่มีข้อมูล'))
    const target = latestNoPopulation ? 0 : 10
    return { target, sampled: detail.samples.length, completed, incomplete: detail.samples.length - completed, openFindings: activeFindings, ready: detail.samples.length >= target && detail.samples.length - completed === 0 && activeFindings === 0 }
  }, [detail.samples, detail.warnings])

  function updateDraft(id: string, patch: Partial<SampleDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
  }

  function updateFinding(id: string, point: FindingDraft['transferPoint'], patch: Partial<FindingDraft>) {
    const current = drafts[id]
    if (!current) return
    const findings = current.findings.some((finding) => finding.transferPoint === point)
      ? current.findings.map((finding) => finding.transferPoint === point ? { ...finding, ...patch } : finding)
      : [...current.findings, { transferPoint: point, description: '', severity: 'medium' as const, ...patch }]
    updateDraft(id, { findings })
  }

  function replaceDetail(next: VerificationRoundDetail) {
    setDetail(next)
    setDrafts(Object.fromEntries(next.samples.map((sample) => [sample.id, draftFromSample(sample)])))
  }

  async function saveSample(sample: VerificationSample) {
    const draft = drafts[sample.id]
    if (!draft) return
    if ((draft.lisToHis === 'na' || draft.sourceToLis === 'na') && !draft.remark.trim()) { setError(`LAB ID ${sample.ln}: ผล N/A ต้องระบุหมายเหตุ`); return }
    for (const point of (['lis_to_his', 'source_to_lis'] as const)) {
      const result = point === 'lis_to_his' ? draft.lisToHis : draft.sourceToLis
      const existing = sample.findings.some((finding) => finding.transfer_point === point && finding.status !== 'closed')
      const description = findingForPoint(sample, draft, point)
      if (result === 'fail' && !existing && !description.trim()) { setError(`LAB ID ${sample.ln}: ผลไม่ผ่านต้องระบุ finding ของ ${findingLabel(point)}`); return }
    }
    setSavingId(sample.id); setError('')
    try {
      const response = await fetch(`/api/staff/it/verification/samples/${sample.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? 'บันทึกผลไม่สำเร็จ')
      replaceDetail(body.detail as VerificationRoundDetail)
      setToast(`บันทึกผล ${sample.ln} แล้ว`)
      window.setTimeout(() => setToast(''), 3000)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกผลไม่สำเร็จ') } finally { setSavingId(null) }
  }

  async function reload() {
    if (!detail.round) return
    const response = await fetch(`/api/staff/it/verification/rounds/${detail.round.id}`)
    const body = await response.json().catch(() => ({}))
    if (response.ok) replaceDetail(body as VerificationRoundDetail)
  }

  async function submitRound() {
    if (!detail.round) return
    setActionLoading(true); setError('')
    try {
      const response = await fetch(`/api/staff/it/verification/rounds/${detail.round.id}/submit`, { method: 'POST' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? 'ส่งตรวจไม่สำเร็จ')
      await reload(); setToast('ส่งรอบให้ผู้ตรวจสอบแล้ว'); window.setTimeout(() => setToast(''), 3000)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'ส่งตรวจไม่สำเร็จ') } finally { setActionLoading(false) }
  }

  async function confirmAction(value: string) {
    if (!detail.round || !dialog) return
    setActionLoading(true); setError('')
    try {
      let url = ''; let body: Record<string, unknown> | undefined
      if (dialog.kind === 'review') { url = `/api/staff/it/verification/rounds/${detail.round.id}/review`; body = { decision: reviewDecision, note: value.trim() } }
      if (dialog.kind === 'reopen') { url = `/api/staff/it/verification/rounds/${detail.round.id}/reopen`; body = { reason: value } }
      if (dialog.kind === 'resample') { if (!selectedUpload) throw new Error('กรุณาเลือกไฟล์ TAT ต้นทาง'); url = '/api/staff/it/verification/sampling/resample'; body = { uploadId: selectedUpload, departmentId: detail.round.departmentId, reason: value } }
      if (dialog.kind === 'finding' && selectedFinding) { url = `/api/staff/it/verification/findings/${selectedFinding.id}`; body = { status: 'closed', resolutionNote: value } }
      const response = await fetch(url, { method: dialog.kind === 'finding' ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
      const responseBody = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(responseBody.error ?? 'ดำเนินการไม่สำเร็จ')
      setDialog(null); setSelectedFinding(null); await reload(); setToast('บันทึกการเปลี่ยนแปลงแล้ว'); window.setTimeout(() => setToast(''), 3000)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'ดำเนินการไม่สำเร็จ') } finally { setActionLoading(false) }
  }

  if (!detail.round) return <EmptyState title="ไม่พบรอบการทวนสอบ" hint="กลับไปที่ภาพรวมและเลือกหน่วยงานใหม่" icon="inbox" />
  const round = detail.round
  const percent = readiness.target === 0 ? 0 : Math.min(100, Math.round((readiness.sampled / readiness.target) * 100))
  return (
    <div className="it-verification-detail" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        .it-verification-detail-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); }
        .it-verification-sample-head, .it-verification-sample-row { display:grid; grid-template-columns:60px minmax(145px,1.3fr) minmax(170px,1fr) minmax(170px,1fr) minmax(190px,1.3fr) 100px; gap:12px; align-items:center; }
        .it-verification-sample-head { padding:10px 14px; background:var(--surface-2); color:var(--muted); font-size:11.5px; font-weight:700; }
        .it-verification-sample-row { padding:14px; border-top:1px solid var(--border); }
        .it-verification-sample-row:hover { background:var(--surface-2); }
        .it-verification-sample-meta { color:var(--muted); font-size:11.5px; line-height:1.6; margin-top:4px; }
        .it-verification-finding-grid { grid-column:2 / -1; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
        @media (max-width:900px) { .it-verification-detail-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .it-verification-sample-head { display:none; } .it-verification-sample-row { grid-template-columns:1fr 1fr; align-items:start; } .it-verification-finding-grid { grid-column:1 / -1; } }
        @media (max-width:560px) { .it-verification-detail-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .it-verification-sample-row { grid-template-columns:1fr; } .it-verification-finding-grid { grid-template-columns:1fr; } }
        @media (prefers-reduced-motion:reduce) { .it-verification-detail * { transition:none !important; animation:none !important; } }
      `}</style>
      <div aria-live="polite" style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 900, maxWidth: 'min(380px, calc(100vw - 32px))' }}>{toast && <div role="status" style={{ padding: '11px 14px', borderRadius: 10, background: 'var(--success)', color: '#fff', boxShadow: '0 8px 24px rgba(15,23,42,.18)', fontSize: 13 }}>{toast}</div>}</div>
      <div><Link href="/staff/it/verification" style={{ display: 'inline-flex', minHeight: 44, alignItems: 'center', gap: 6, color: 'var(--muted)', textDecoration: 'none', fontSize: 13 }}><Icon name="arrowLeft" size={15} /> กลับภาพรวม</Link></div>
      <PageHeader title={`${round.code} · ${round.name}`} subtitle={`ทวนสอบการส่งผ่านข้อมูล · ไตรมาส ${round.quarter}/${round.year + 543} · Fm-QP-LAB-24/02`} actions={<><Button variant="secondary" size="lg" icon="download" onClick={() => window.open(`/api/staff/it/verification/rounds/${round.id}/pdf`, '_blank')}>ส่งออก PDF</Button>{canManage && <Button variant="secondary" size="lg" icon="refresh" onClick={() => setDialog({ kind: 'resample' })}>สุ่มใหม่</Button>}{round.status === 'reviewed' && canReview && <Button variant="danger" size="lg" icon="lock" onClick={() => setDialog({ kind: 'reopen' })}>เปิดรอบอีกครั้ง</Button>}{round.status === 'submitted' && canReview && <Button size="lg" icon="shieldCheck" onClick={() => { setReviewDecision('approve'); setDialog({ kind: 'review' }) }}>ตรวจสอบรอบ</Button>}{round.status !== 'reviewed' && canEdit && <Button size="lg" icon="arrowRight" disabled={!readiness.ready || actionLoading} aria-busy={actionLoading} onClick={submitRound}>ส่งตรวจ</Button>}</>} />

      <div className="it-verification-detail-grid" style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--card)' }}>{[
        { label: 'ตัวอย่าง', value: `${readiness.sampled} / ${readiness.target}`, color: 'var(--primary)' },
        { label: 'ตรวจแล้ว', value: `${readiness.completed} / ${readiness.sampled}`, color: 'var(--success)' },
        { label: 'Finding เปิดอยู่', value: readiness.openFindings, color: readiness.openFindings ? 'var(--danger)' : 'var(--muted)' },
        { label: 'สถานะรอบ', value: statusLabel(round.status), color: round.status === 'reviewed' ? 'var(--primary)' : 'var(--warning)' },
      ].map((item, index) => <div key={item.label} style={{ padding: '14px 16px', borderRight: index < 3 ? '1px solid var(--border)' : undefined }}><div style={{ fontSize: 12, color: item.color, fontWeight: 700 }}>{item.label}</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{item.value}</div></div>)}</div>

      {error && <div role="alert" style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.24)', color: 'var(--danger)', fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}><span>{error}</span><Button variant="secondary" size="sm" onClick={() => setError('')}>ปิด</Button></div>}
      {round.status === 'reviewed' && <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(37,99,235,.08)', border: '1px solid rgba(37,99,235,.22)', color: 'var(--ink)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}><Icon name="lock" size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} /><span>รอบนี้ถูกล็อกหลัง review แล้ว หากต้องแก้ไขต้องใช้ปุ่ม “เปิดรอบอีกครั้ง” พร้อมเหตุผล</span></div>}
      {!readiness.ready && round.status !== 'reviewed' && <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}><Icon name="clock" size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />ส่งตรวจได้เมื่อบันทึกผลครบทุก sample และปิด finding ที่ยังเปิดอยู่ ({readiness.completed}/{readiness.sampled} ตรวจแล้ว, {readiness.openFindings} finding เปิด)</div>}
      {detail.samples.length === 0 ? <Card padding={0}><EmptyState title="ยังไม่มี sample ในรอบนี้" hint="ผู้ดูแล IT สามารถกลับไปหน้า overview เพื่อดึงตัวอย่างจาก TAT หรือเลือกสุ่มแบบ legacy" icon="beaker" /></Card> : <Card padding={0}><div style={{ padding: '15px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}><div><h2 style={{ margin: 0, fontSize: 17, color: 'var(--ink)' }}>รายการ LAB ID ที่สุ่ม</h2><p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--muted)' }}>ความคืบหน้า {percent}% · แก้ไขได้เฉพาะผู้รับผิดชอบหรือผู้ดูแล IT</p></div><Badge color={readiness.ready ? 'green' : 'amber'} dot>{readiness.ready ? 'พร้อมส่งตรวจ' : 'กำลังดำเนินการ'}</Badge></div><div className="it-verification-sample-head"><div>#</div><div>LAB ID / ข้อมูลอ้างอิง</div><div>ตรวจ LIS → HIS</div><div>ตรวจ Source → LIS</div><div>หมายเหตุ / finding</div><div>การทำงาน</div></div>{detail.samples.map((sample, index) => { const draft = drafts[sample.id] ?? draftFromSample(sample); const disabled = !canEdit || round.status === 'reviewed'; return <div key={sample.id} className="it-verification-sample-row"><div style={{ color: 'var(--muted)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{index + 1}</div><div><div style={{ color: 'var(--ink)', fontWeight: 800, fontSize: 14, letterSpacing: '.01em' }}>{sample.ln}</div><div className="it-verification-sample-meta">{sample.source_lab_section ?? 'ไม่ระบุ section'} · {sample.test_name ?? 'ไม่ระบุรายการตรวจ'}<br />เดือน {sample.source_month ? getThaiMonthLabel(sample.source_month) : 'ไม่ทราบเดือน'} · {sample.source_record_count.toLocaleString()} records</div></div><ResultControl label="LIS → HIS" value={draft.lisToHis} onChange={(value) => updateDraft(sample.id, { lisToHis: value })} disabled={disabled} /><ResultControl label="เครื่องมือ/Manual → LIS" value={draft.sourceToLis} onChange={(value) => updateDraft(sample.id, { sourceToLis: value })} disabled={disabled} /><div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><label style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 700 }}>หมายเหตุ{(draft.lisToHis === 'na' || draft.sourceToLis === 'na') && <span style={{ color: 'var(--danger)' }}> *</span>}<textarea value={draft.remark} disabled={disabled} onChange={(event) => updateDraft(sample.id, { remark: event.target.value })} rows={2} placeholder="เช่น ไม่เกี่ยวข้อง หรือรายละเอียดประกอบ" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13, resize: 'vertical', minHeight: 50 }} /></label><div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{(['lis_to_his', 'source_to_lis'] as const).filter((point) => (point === 'lis_to_his' ? draft.lisToHis : draft.sourceToLis) === 'fail').map((point) => <label key={point} style={{ fontSize: 11.5, color: 'var(--danger)', fontWeight: 700 }}>Finding: {findingLabel(point)}<textarea disabled={disabled} value={findingForPoint(sample, draft, point)} onChange={(event) => updateFinding(sample.id, point, { description: event.target.value })} rows={2} placeholder="ระบุปัญหาและผลกระทบ" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '8px 10px', border: '1px solid rgba(220,38,38,.35)', borderRadius: 7, background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13, resize: 'vertical', minHeight: 52 }} /></label>)}</div></div><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 7 }}>{!disabled && <Button size="md" icon="save" disabled={savingId === sample.id} aria-busy={savingId === sample.id} onClick={() => saveSample(sample)} style={{ minHeight: 44 }}>บันทึก</Button>}{sample.findings.filter((finding) => finding.status !== 'closed').map((finding) => <Button key={finding.id} variant="secondary" size="sm" disabled={disabled} onClick={() => { setSelectedFinding(finding); setDialog({ kind: 'finding', findingId: finding.id }) }} style={{ minHeight: 44 }}>ปิด finding</Button>)}</div></div> })}</Card>}

      <ActionDialog state={dialog} onClose={() => { setDialog(null); setSelectedFinding(null) }} onConfirm={confirmAction} loading={actionLoading} reviewDecision={reviewDecision} onReviewDecision={setReviewDecision} resampleOptions={initialUploads} selectedUpload={selectedUpload} onSelectedUpload={setSelectedUpload} />
    </div>
  )
}
