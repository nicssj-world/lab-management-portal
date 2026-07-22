'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { AttachmentPanel, type RiskAttachment } from './shared/AttachmentPanel'
import { RiskActionsPanel, type RiskAction } from './shared/RiskActionsPanel'
import { ErrorBanner, Field, Modal, SeverityBadge, StatusBadge } from './shared/ui'
import {
  FONT, INCIDENT_STATUSES, RCA_FACTORS, RCA_METHODS, SEVERITY_DESCRIPTIONS, SEVERITY_LETTERS, SPACE,
  formatThaiDate, inputStyle, requiresRca, tabularNums, textareaStyle,
  type SeverityLetter,
} from './shared/tokens'

export type Incident = {
  id: number
  report_no: string | null
  event_date: string
  event_time: string | null
  reporter_name: string | null
  reporter_position: string | null
  department_found: string | null
  department_target: string | null
  event_category: string | null
  event_detail: string
  immediate_correction: string | null
  impact_summary: string | null
  evidence_note: string | null
  severity_level: string | null
  requires_rca: boolean
  status: string
  reviewed_by_name: string | null
  reviewed_at: string | null
  review_note: string | null
  rca_method: string | null
  root_cause: string | null
  rca_factors: Record<string, boolean> | null
  effectiveness_result: string | null
  escalated_register_id: number | null
  closed_by_name: string | null
  closed_at: string | null
}

const STEPS = [
  { key: 'reported', label: 'รายงาน' },
  { key: 'reviewing', label: 'ทบทวน' },
  { key: 'rca', label: 'วิเคราะห์สาเหตุ' },
  { key: 'action', label: 'แก้ไข/ติดตาม' },
  { key: 'closed', label: 'ปิดเรื่อง' },
] as const

/** ขั้นที่เรื่องนี้เดินมาถึงแล้ว ใช้ตัดสินว่าจะเปิดส่วนไหนให้กรอก */
function currentStep(incident: Incident) {
  if (incident.status === 'closed') return 4
  if (incident.status === 'action' || incident.status === 'monitoring') return 3
  if (incident.reviewed_at) return incident.requires_rca && !incident.root_cause ? 2 : 3
  return 1
}

export function IncidentDetailModal({ incidentId, canEdit, canReview, actorName, onClose, onChanged }: {
  incidentId: number
  canEdit: boolean
  canReview: boolean
  actorName: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const [incident, setIncident] = useState<Incident | null>(null)
  const [actions, setActions] = useState<RiskAction[]>([])
  const [attachments, setAttachments] = useState<RiskAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [blockers, setBlockers] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/risk/incidents/${incidentId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'โหลดรายละเอียดไม่สำเร็จ')
      setIncident(json.data)
      setActions(json.actions ?? [])
      setAttachments(json.attachments ?? [])
      setError('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [incidentId])

  useEffect(() => { void load() }, [load])

  async function post(path: string, body?: unknown) {
    setBusy(true)
    setError('')
    setBlockers([])
    try {
      const res = await fetch(`/api/admin/risk/incidents/${incidentId}${path}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (Array.isArray(json.blockers)) setBlockers(json.blockers)
        throw new Error(json.error ?? 'ดำเนินการไม่สำเร็จ')
      }
      await load()
      onChanged()
      return true
    } catch (err) {
      setError((err as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function patch(body: Record<string, unknown>) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/risk/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'บันทึกไม่สำเร็จ')
      await load()
      onChanged()
      return true
    } catch (err) {
      setError((err as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  if (loading || !incident) {
    return (
      <Modal title="กำลังโหลด…" onClose={onClose} width={860}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} style={{ height: 42, borderRadius: 8, background: 'var(--surface-2)' }} />
          ))}
        </div>
        <ErrorBanner message={error} />
      </Modal>
    )
  }

  const step = currentStep(incident)
  const closed = incident.status === 'closed'

  return (
    <Modal
      title={`${incident.report_no ?? `#${incident.id}`} · ${incident.event_category || 'อุบัติการณ์'}`}
      subtitle={`${formatThaiDate(incident.event_date)} · ${incident.department_found ?? 'ไม่ระบุหน่วยงาน'}`}
      onClose={onClose}
      width={880}
      footer={
        <>
          {canEdit && !closed
            ? <Button variant="danger" icon="trash" onClick={async () => {
                if (!window.confirm('ลบรายการนี้ออกจากทะเบียนหรือไม่')) return
                const res = await fetch(`/api/admin/risk/incidents/${incidentId}`, { method: 'DELETE' })
                if (res.ok) { onChanged(); onClose() }
              }}>ลบรายการ</Button>
            : <span />}
          <div style={{ display: 'flex', gap: SPACE.xs, flexWrap: 'wrap' }}>
            {canReview && !closed && incident.reviewed_at && !incident.escalated_register_id && (
              <Button variant="secondary" icon="trending" disabled={busy} onClick={() => void post('/escalate')}>
                ยกระดับเข้าทะเบียน
              </Button>
            )}
            {canReview && !closed && step >= 3 && (
              <Button variant="primary" icon="shieldCheck" disabled={busy} onClick={() => void post('/close')}>
                ปิดเรื่อง
              </Button>
            )}
          </div>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        <Stepper step={step} status={incident.status} />
        <ErrorBanner message={error} />

        {blockers.length > 0 && (
          <div role="alert" style={{ padding: SPACE.sm, borderRadius: 10, border: '1px solid color-mix(in srgb, var(--warning) 32%, transparent)', background: 'color-mix(in srgb, var(--warning) 8%, var(--card))' }}>
            <p style={{ margin: `0 0 ${SPACE.xs}px`, fontWeight: 700, color: 'var(--warning)', fontSize: FONT.md }}>
              ต้องทำสิ่งเหล่านี้ให้ครบก่อนปิดเรื่อง
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--warning)', fontSize: FONT.base, lineHeight: 1.7 }}>
              {blockers.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </div>
        )}

        <EventSummary incident={incident} />

        <Section title="การทบทวน" icon="eye" done={Boolean(incident.reviewed_at)}>
          {incident.reviewed_at ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, flexWrap: 'wrap' }}>
                <SeverityBadge severity={incident.severity_level} />
                <span style={{ fontSize: FONT.md, color: 'var(--ink)' }}>
                  {SEVERITY_DESCRIPTIONS[incident.severity_level as SeverityLetter] ?? ''}
                </span>
              </div>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: FONT.base, ...tabularNums }}>
                ทบทวนโดย {incident.reviewed_by_name ?? 'ไม่ระบุ'} · {formatThaiDate(incident.reviewed_at.slice(0, 10))}
              </p>
              {incident.review_note && <p style={{ margin: 0, fontSize: FONT.md, color: 'var(--ink)', lineHeight: 1.6 }}>{incident.review_note}</p>}
            </div>
          ) : canReview ? (
            <ReviewForm busy={busy} onSubmit={body => post('/review', body)} />
          ) : (
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: FONT.md }}>รอผู้มีสิทธิ์ทบทวนกำหนดระดับความรุนแรง</p>
          )}
        </Section>

        {incident.requires_rca && (
          <Section title="วิเคราะห์รากของปัญหา (RCA)" icon="search" done={Boolean(incident.root_cause)}>
            <RcaForm incident={incident} canEdit={canReview && !closed} busy={busy} onSave={patch} />
          </Section>
        )}

        <Section title="มาตรการแก้ไขและการติดตาม" icon="clipboard" done={actions.length > 0 && actions.every(a => a.status === 'done')}>
          <RiskActionsPanel
            actions={actions}
            endpoint={`/api/admin/risk/incidents/${incidentId}/actions`}
            canManage={canReview && !closed}
            actorName={actorName}
            onChanged={() => { void load(); onChanged() }}
          />
        </Section>

        {step >= 3 && (
          <Section title="สรุปผลการติดตามประสิทธิผล" icon="trending" done={Boolean(incident.effectiveness_result)}>
            <EffectivenessForm incident={incident} canEdit={canReview && !closed} busy={busy} onSave={patch} />
          </Section>
        )}

        <Section title="ไฟล์หลักฐาน" icon="doc" done={attachments.length > 0}>
          <AttachmentPanel
            attachments={attachments}
            target={{ incidentId: incidentId }}
            canManage={canReview && !closed}
            onChanged={() => void load()}
          />
        </Section>

        {closed && (
          <p style={{ margin: 0, padding: SPACE.sm, borderRadius: 10, background: 'color-mix(in srgb, var(--success) 8%, var(--card))', color: 'var(--success)', fontSize: FONT.md, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="shieldCheck" size={16} />
            ปิดเรื่องโดย {incident.closed_by_name ?? 'ไม่ระบุ'} เมื่อ {formatThaiDate(incident.closed_at?.slice(0, 10))}
          </p>
        )}
      </div>
    </Modal>
  )
}

function Stepper({ step, status }: { step: number; status: string }) {
  return (
    <>
      <style>{`
        .risk-stepper{display:flex;gap:4px;overflow-x:auto;padding-bottom:4px;list-style:none;margin:0}
        .risk-step{display:flex;flex:1 0 auto;align-items:center;gap:6px;min-height:36px;padding:6px 12px;border-radius:8px;font-size:12.5px;font-weight:600;white-space:nowrap}
      `}</style>
      <ol className="risk-stepper">
        {STEPS.map((s, i) => {
          const state = i < step ? 'done' : i === step ? 'current' : 'todo'
          return (
            <li
              key={s.key}
              className="risk-step"
              aria-current={state === 'current' ? 'step' : undefined}
              style={{
                background: state === 'current' ? 'var(--primary-soft)' : state === 'done' ? 'color-mix(in srgb, var(--success) 10%, var(--card))' : 'var(--surface-2)',
                color: state === 'current' ? 'var(--primary)' : state === 'done' ? 'var(--success)' : 'var(--muted)',
              }}
            >
              <Icon name={state === 'done' ? 'check' : state === 'current' ? 'chevRight' : 'clock'} size={13} />
              {s.label}
            </li>
          )
        })}
      </ol>
      <p className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        สถานะปัจจุบัน: {STEPS[step]?.label ?? status}
      </p>
    </>
  )
}

function Section({ title, icon, done, children }: { title: string; icon: string; done: boolean; children: React.ReactNode }) {
  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: SPACE.sm }}>
      <h3 style={{ margin: `0 0 ${SPACE.sm}px`, display: 'flex', alignItems: 'center', gap: 7, fontSize: FONT.md, fontWeight: 700, color: 'var(--ink)' }}>
        <Icon name={icon} size={15} />
        {title}
        {done && <Badge color="green"><Icon name="check" size={11} />ครบแล้ว</Badge>}
      </h3>
      {children}
    </section>
  )
}

function EventSummary({ incident }: { incident: Incident }) {
  const rows = [
    ['วันเวลาที่เกิด', `${formatThaiDate(incident.event_date)}${incident.event_time ? ` ${incident.event_time.slice(0, 5)} น.` : ''}`],
    ['ผู้รายงาน', [incident.reporter_name, incident.reporter_position].filter(Boolean).join(' · ') || '—'],
    ['หน่วยงานที่พบ', incident.department_found ?? '—'],
    ['ส่งถึงหน่วยงาน', incident.department_target ?? '—'],
  ]
  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: SPACE.sm, display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, flexWrap: 'wrap' }}>
        <StatusBadge statuses={INCIDENT_STATUSES} value={incident.status} />
        <SeverityBadge severity={incident.severity_level} />
        {incident.escalated_register_id && (
          <Badge color="purple"><Icon name="trending" size={12} />ยกระดับเข้าทะเบียนแล้ว</Badge>
        )}
      </div>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: SPACE.xs, margin: 0 }}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt style={{ fontSize: FONT.xs, fontWeight: 600, color: 'var(--muted)' }}>{label}</dt>
            <dd style={{ margin: '2px 0 0', fontSize: FONT.md, color: 'var(--ink)', ...tabularNums }}>{value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <dt style={{ fontSize: FONT.xs, fontWeight: 600, color: 'var(--muted)' }}>เกิดเหตุการณ์อย่างไร</dt>
        <dd style={{ margin: '2px 0 0', fontSize: FONT.md, color: 'var(--ink)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{incident.event_detail}</dd>
      </div>
      {incident.immediate_correction && (
        <div>
          <dt style={{ fontSize: FONT.xs, fontWeight: 600, color: 'var(--muted)' }}>การแก้ไขเฉพาะหน้า</dt>
          <dd style={{ margin: '2px 0 0', fontSize: FONT.md, color: 'var(--ink)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{incident.immediate_correction}</dd>
        </div>
      )}
    </section>
  )
}

function ReviewForm({ busy, onSubmit }: { busy: boolean; onSubmit: (body: Record<string, unknown>) => Promise<boolean> }) {
  const [severity, setSeverity] = useState('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const error = touched && !severity ? 'ต้องเลือกระดับความรุนแรงก่อนบันทึกการทบทวน' : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
      <Field label="ระดับความรุนแรง (RM)" required error={error} hint="เลือกแล้วระบบจะกำหนดเองว่าต้องวิเคราะห์รากของปัญหาหรือไม่">
        <select value={severity} onChange={e => setSeverity(e.target.value)} onBlur={() => setTouched(true)} style={inputStyle}>
          <option value="">— เลือกระดับ —</option>
          {SEVERITY_LETTERS.map(letter => (
            <option key={letter} value={letter}>{letter} — {SEVERITY_DESCRIPTIONS[letter]}</option>
          ))}
        </select>
      </Field>
      {severity && (
        <p style={{ margin: 0, fontSize: FONT.base, color: requiresRca(severity) ? 'var(--warning)' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name={requiresRca(severity) ? 'alert' : 'check'} size={13} />
          {requiresRca(severity) ? 'ระดับนี้ต้องวิเคราะห์รากของปัญหาก่อนปิดเรื่อง' : 'ระดับนี้ไม่บังคับวิเคราะห์รากของปัญหา'}
        </p>
      )}
      <Field label="บันทึกการทบทวน">
        <textarea value={note} onChange={e => setNote(e.target.value)} style={{ ...textareaStyle, minHeight: 64 }} />
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="primary"
          icon="check"
          disabled={busy}
          onClick={() => {
            setTouched(true)
            if (!severity) return
            void onSubmit({ severity_level: severity, requires_rca: requiresRca(severity), review_note: note || null })
          }}
        >
          บันทึกการทบทวน
        </Button>
      </div>
    </div>
  )
}

function RcaForm({ incident, canEdit, busy, onSave }: {
  incident: Incident
  canEdit: boolean
  busy: boolean
  onSave: (body: Record<string, unknown>) => Promise<boolean>
}) {
  const [method, setMethod] = useState(incident.rca_method ?? '')
  const [rootCause, setRootCause] = useState(incident.root_cause ?? '')
  const [factors, setFactors] = useState<Record<string, boolean>>(incident.rca_factors ?? {})

  if (!canEdit) {
    const chosen = RCA_FACTORS.filter(f => factors[f.key])
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ margin: 0, fontSize: FONT.md, color: 'var(--ink)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {rootCause || 'ยังไม่ได้บันทึกรากของปัญหา'}
        </p>
        {method && <p style={{ margin: 0, fontSize: FONT.base, color: 'var(--muted)' }}>วิธีวิเคราะห์: {RCA_METHODS.find(m => m.value === method)?.label ?? method}</p>}
        {chosen.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {chosen.map(f => <Badge key={f.key} color="blue">{f.label}</Badge>)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
      <Field label="วิธีวิเคราะห์">
        <select value={method} onChange={e => setMethod(e.target.value)} style={inputStyle}>
          <option value="">— เลือกวิธี —</option>
          {RCA_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </Field>

      <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
        <legend style={{ fontSize: FONT.sm, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
          ปัจจัยเชิงระบบที่เกี่ยวข้อง
        </legend>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {RCA_FACTORS.map(factor => (
            <label
              key={factor.key}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '6px 13px',
                border: `1px solid ${factors[factor.key] ? 'var(--primary)' : 'var(--border)'}`,
                borderRadius: 999, cursor: 'pointer', fontSize: FONT.md,
                background: factors[factor.key] ? 'var(--primary-soft)' : 'transparent',
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(factors[factor.key])}
                onChange={e => setFactors({ ...factors, [factor.key]: e.target.checked })}
                style={{ accentColor: 'var(--primary)' }}
              />
              {factor.label}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="รากของปัญหา" hint="อธิบายสาเหตุเชิงระบบ ไม่ใช่ชื่อบุคคล">
        <textarea value={rootCause} onChange={e => setRootCause(e.target.value)} style={textareaStyle} />
      </Field>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="secondary"
          icon="check"
          disabled={busy}
          onClick={() => void onSave({ rca_method: method || null, root_cause: rootCause || null, rca_factors: factors })}
        >
          บันทึกผลวิเคราะห์
        </Button>
      </div>
    </div>
  )
}

function EffectivenessForm({ incident, canEdit, busy, onSave }: {
  incident: Incident
  canEdit: boolean
  busy: boolean
  onSave: (body: Record<string, unknown>) => Promise<boolean>
}) {
  const [text, setText] = useState(incident.effectiveness_result ?? '')

  if (!canEdit) {
    return (
      <p style={{ margin: 0, fontSize: FONT.md, color: 'var(--ink)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
        {text || 'ยังไม่ได้สรุปผลการติดตาม'}
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
      <Field label="สรุปผลโดยรวม" hint="จำเป็นต้องกรอกก่อนปิดเรื่อง">
        <textarea value={text} onChange={e => setText(e.target.value)} style={textareaStyle} />
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="secondary" icon="check" disabled={busy} onClick={() => void onSave({ effectiveness_result: text || null })}>
          บันทึกสรุปผล
        </Button>
      </div>
    </div>
  )
}
