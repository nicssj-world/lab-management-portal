'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { AttachmentPanel, type RiskAttachment } from './shared/AttachmentPanel'
import { RiskActionsPanel, type RiskAction } from './shared/RiskActionsPanel'
import { ScalePicker, ScoreReadout } from './shared/ScalePicker'
import { ErrorBanner, Field, LevelBadge, Modal, StatusBadge } from './shared/ui'
import {
  FONT, IMPACT_SCALE, LEVEL_LABEL, LIKELIHOOD_SCALE, REGISTER_STATUSES, SPACE,
  formatThaiDate, inputStyle, riskLevel, riskScore, tabularNums, textareaStyle,
} from './shared/tokens'
import { reviewState } from '@/lib/risk/register'

export type RegisterEntry = {
  id: number
  risk_no: string | null
  assessed_date: string
  department: string | null
  hazard_category: string | null
  process_step: string | null
  risk_statement: string
  affected_parties: string | null
  causes: string | null
  existing_controls: string | null
  additional_controls: string | null
  reference_docs: string | null
  likelihood: number | null
  impact: number | null
  score: number | null
  level: string | null
  residual_likelihood: number | null
  residual_impact: number | null
  residual_score: number | null
  residual_level: string | null
  residual_assessed_by_name: string | null
  residual_assessed_at: string | null
  risk_accepted_by_name: string | null
  risk_accepted_at: string | null
  owner: string | null
  status: string
  next_review_date: string | null
  last_reviewed_at: string | null
  last_reviewed_by_name: string | null
}

type SourceIncident = { id: number; report_no: string | null; event_date: string; event_detail: string }

const LEVEL_TONE_VAR: Record<string, string> = {
  low: 'var(--success)',
  medium: 'var(--warning)',
  high: 'var(--danger)',
}

export function RegisterDetailModal({ entryId, canEdit, canReview, actorName, onClose, onChanged }: {
  entryId: number
  canEdit: boolean
  canReview: boolean
  actorName: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const [entry, setEntry] = useState<RegisterEntry | null>(null)
  const [actions, setActions] = useState<RiskAction[]>([])
  const [attachments, setAttachments] = useState<RiskAttachment[]>([])
  const [sourceIncidents, setSourceIncidents] = useState<SourceIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/risk/register/${entryId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'โหลดรายละเอียดไม่สำเร็จ')
      setEntry(json.data)
      setActions(json.actions ?? [])
      setAttachments(json.attachments ?? [])
      setSourceIncidents(json.sourceIncidents ?? [])
      setError('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [entryId])

  useEffect(() => { void load() }, [load])

  async function send(path: string, method: string, body?: unknown) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/risk/register/${entryId}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'ดำเนินการไม่สำเร็จ')
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

  if (loading || !entry) {
    return (
      <Modal title="กำลังโหลด…" onClose={onClose} width={880}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
          {Array.from({ length: 5 }, (_, i) => <div key={i} style={{ height: 42, borderRadius: 8, background: 'var(--surface-2)' }} />)}
        </div>
        <ErrorBanner message={error} />
      </Modal>
    )
  }

  const review = reviewState(entry.next_review_date)

  return (
    <Modal
      title={`${entry.risk_no ?? `#${entry.id}`} · ${entry.process_step || 'ความเสี่ยง'}`}
      subtitle={`ประเมินเมื่อ ${formatThaiDate(entry.assessed_date)} · ${entry.department ?? 'ไม่ระบุหน่วยงาน'}`}
      onClose={onClose}
      width={900}
      footer={
        <>
          {canEdit
            ? <Button variant="danger" icon="trash" onClick={async () => {
                if (!window.confirm('ลบรายการนี้ออกจากทะเบียนหรือไม่')) return
                const res = await fetch(`/api/admin/risk/register/${entryId}`, { method: 'DELETE' })
                if (res.ok) { onChanged(); onClose() }
              }}>ลบรายการ</Button>
            : <span />}
          {canReview && (
            <Button variant="primary" icon="shieldCheck" disabled={busy} onClick={() => void send('/review', 'POST')}>
              ยืนยันทบทวนแล้ว
            </Button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        <ErrorBanner message={error} />

        <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: SPACE.sm, display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, flexWrap: 'wrap' }}>
            <StatusBadge statuses={REGISTER_STATUSES} value={entry.status} />
            <LevelBadge level={entry.level} score={entry.score} />
            <ReviewBadge state={review} nextReview={entry.next_review_date} />
          </div>
          <p style={{ margin: 0, fontSize: FONT.md, color: 'var(--ink)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{entry.risk_statement}</p>
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: SPACE.xs, margin: 0 }}>
            {[
              ['หมวดอันตราย', entry.hazard_category],
              ['กระบวนการ/จุดงาน', entry.process_step],
              ['ผู้ได้รับผลกระทบ', entry.affected_parties],
              ['ผู้รับผิดชอบ', entry.owner],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt style={{ fontSize: FONT.xs, fontWeight: 600, color: 'var(--muted)' }}>{label}</dt>
                <dd style={{ margin: '2px 0 0', fontSize: FONT.md, color: 'var(--ink)' }}>{value || '—'}</dd>
              </div>
            ))}
          </dl>
          {sourceIncidents.length > 0 && (
            <p style={{ margin: 0, fontSize: FONT.base, color: 'var(--muted)' }}>
              <Icon name="trending" size={12} /> ยกระดับมาจากอุบัติการณ์ {sourceIncidents.map(i => i.report_no ?? `#${i.id}`).join(', ')}
            </p>
          )}
        </section>

        <AssessmentSection entry={entry} canEdit={canEdit} busy={busy} onSave={body => send('', 'PATCH', body)} />

        <ControlsSection entry={entry} canEdit={canEdit} busy={busy} onSave={body => send('', 'PATCH', body)} />

        <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: SPACE.sm }}>
          <h3 style={{ margin: `0 0 ${SPACE.sm}px`, display: 'flex', alignItems: 'center', gap: 7, fontSize: FONT.md, fontWeight: 700, color: 'var(--ink)' }}>
            <Icon name="clipboard" size={15} />มาตรการและการติดตาม
          </h3>
          <RiskActionsPanel
            actions={actions}
            endpoint={`/api/admin/risk/register/${entryId}/actions`}
            canManage={canReview}
            actorName={actorName}
            onChanged={() => { void load(); onChanged() }}
          />
        </section>

        <ResidualSection entry={entry} canReview={canReview} busy={busy} onSave={body => send('/residual', 'POST', body)} />

        <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: SPACE.sm }}>
          <h3 style={{ margin: `0 0 ${SPACE.sm}px`, display: 'flex', alignItems: 'center', gap: 7, fontSize: FONT.md, fontWeight: 700, color: 'var(--ink)' }}>
            <Icon name="doc" size={15} />ไฟล์หลักฐาน
          </h3>
          <AttachmentPanel
            attachments={attachments}
            target={{ registerId: entryId }}
            canManage={canReview}
            onChanged={() => void load()}
          />
        </section>

        {entry.last_reviewed_at && (
          <p style={{ margin: 0, fontSize: FONT.base, color: 'var(--muted)', ...tabularNums }}>
            ทบทวนล่าสุดโดย {entry.last_reviewed_by_name ?? 'ไม่ระบุ'} เมื่อ {formatThaiDate(entry.last_reviewed_at.slice(0, 10))}
          </p>
        )}
      </div>
    </Modal>
  )
}

export function ReviewBadge({ state, nextReview }: { state: string; nextReview?: string | null }) {
  if (state === 'ok') return null
  if (state === 'unset') return <Badge color="gray"><Icon name="clock" size={12} />ยังไม่ตั้งรอบทบทวน</Badge>
  return (
    <Badge color={state === 'overdue' ? 'red' : 'amber'}>
      <Icon name={state === 'overdue' ? 'alert' : 'clock'} size={12} />
      {state === 'overdue' ? 'เลยกำหนดทบทวน' : 'ใกล้ครบรอบทบทวน'} {formatThaiDate(nextReview)}
    </Badge>
  )
}

function AssessmentSection({ entry, canEdit, busy, onSave }: {
  entry: RegisterEntry
  canEdit: boolean
  busy: boolean
  onSave: (body: Record<string, unknown>) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [likelihood, setLikelihood] = useState(entry.likelihood)
  const [impact, setImpact] = useState(entry.impact)

  const previewScore = riskScore(likelihood, impact)
  const previewLevel = riskLevel(previewScore)

  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: SPACE.sm }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.xs, marginBottom: SPACE.sm }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 7, fontSize: FONT.md, fontWeight: 700, color: 'var(--ink)' }}>
          <Icon name="chart" size={15} />การประเมินก่อนมาตรการ
        </h3>
        {canEdit && !editing && <Button variant="ghost" size="sm" icon="edit" onClick={() => setEditing(true)}>แก้คะแนน</Button>}
      </div>

      {editing ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: SPACE.sm }}>
            <ScalePicker legend="โอกาสเกิด (Likelihood)" name="likelihood" scale={LIKELIHOOD_SCALE} value={likelihood} onChange={setLikelihood} />
            <ScalePicker legend="ผลกระทบ (Impact)" name="impact" scale={IMPACT_SCALE} value={impact} onChange={setImpact} />
          </div>
          <div style={{ marginTop: SPACE.sm, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm, flexWrap: 'wrap' }}>
            <ScoreReadout
              label="คะแนนความเสี่ยง"
              likelihood={likelihood}
              impact={impact}
              level={previewLevel ? LEVEL_LABEL[previewLevel] : null}
              tone={previewLevel ? LEVEL_TONE_VAR[previewLevel] : 'var(--muted)'}
            />
            <div style={{ display: 'flex', gap: SPACE.xs }}>
              <Button variant="secondary" onClick={() => { setEditing(false); setLikelihood(entry.likelihood); setImpact(entry.impact) }} disabled={busy}>ยกเลิก</Button>
              <Button variant="primary" icon="check" disabled={busy} onClick={async () => {
                if (await onSave({ likelihood, impact })) setEditing(false)
              }}>บันทึกคะแนน</Button>
            </div>
          </div>
        </>
      ) : (
        <ScoreReadout
          label="คะแนนความเสี่ยง"
          likelihood={entry.likelihood}
          impact={entry.impact}
          level={entry.level ? LEVEL_LABEL[entry.level as 'low'] : null}
          tone={entry.level ? LEVEL_TONE_VAR[entry.level] : 'var(--muted)'}
        />
      )}
    </section>
  )
}

function ControlsSection({ entry, canEdit, busy, onSave }: {
  entry: RegisterEntry
  canEdit: boolean
  busy: boolean
  onSave: (body: Record<string, unknown>) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    causes: entry.causes ?? '',
    existing_controls: entry.existing_controls ?? '',
    additional_controls: entry.additional_controls ?? '',
    reference_docs: entry.reference_docs ?? '',
  })

  const fields = [
    ['สาเหตุ', 'causes'],
    ['มาตรการที่มีอยู่', 'existing_controls'],
    ['มาตรการเพิ่มเติมที่ต้องทำ', 'additional_controls'],
    ['เอกสารอ้างอิง', 'reference_docs'],
  ] as const

  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: SPACE.sm }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.xs, marginBottom: SPACE.sm }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 7, fontSize: FONT.md, fontWeight: 700, color: 'var(--ink)' }}>
          <Icon name="shield" size={15} />สาเหตุและมาตรการควบคุม
        </h3>
        {canEdit && !editing && <Button variant="ghost" size="sm" icon="edit" onClick={() => setEditing(true)}>แก้ไข</Button>}
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
          {fields.map(([label, key]) => (
            <Field key={key} label={label}>
              <textarea
                value={draft[key]}
                onChange={e => setDraft({ ...draft, [key]: e.target.value })}
                style={{ ...textareaStyle, minHeight: 64 }}
              />
            </Field>
          ))}
          <div style={{ display: 'flex', gap: SPACE.xs, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>ยกเลิก</Button>
            <Button variant="primary" icon="check" disabled={busy} onClick={async () => {
              const payload = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v || null]))
              if (await onSave(payload)) setEditing(false)
            }}>บันทึก</Button>
          </div>
        </div>
      ) : (
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: SPACE.sm, margin: 0 }}>
          {fields.map(([label, key]) => (
            <div key={key}>
              <dt style={{ fontSize: FONT.xs, fontWeight: 600, color: 'var(--muted)' }}>{label}</dt>
              <dd style={{ margin: '2px 0 0', fontSize: FONT.md, color: 'var(--ink)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {entry[key] || '—'}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

function ResidualSection({ entry, canReview, busy, onSave }: {
  entry: RegisterEntry
  canReview: boolean
  busy: boolean
  onSave: (body: Record<string, unknown>) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [likelihood, setLikelihood] = useState(entry.residual_likelihood)
  const [impact, setImpact] = useState(entry.residual_impact)
  const [acceptedBy, setAcceptedBy] = useState(entry.risk_accepted_by_name ?? '')

  const previewLevel = riskLevel(riskScore(likelihood, impact))
  const initialScore = entry.score
  const residualScore = entry.residual_score

  // เทียบก่อน/หลังเป็นข้อความ ไม่ใช่แค่สี เพื่อให้อ่านได้เมื่อพิมพ์ขาวดำ
  // การ์ดวางเรียงซ้าย (ก่อน) → ขวา (หลัง) ไอคอนทั้งสามจึงต้องชี้ไปทางขวาตามลำดับการอ่านเสมอ
  // แล้วให้มุมเอียงขึ้น/ลงเป็นตัวบอกทิศทางค่าแทน — ไม่ใช่สลับให้ลูกศรชี้ย้อนกลับซ้าย
  const trend = !initialScore || !residualScore ? null
    : residualScore < initialScore
      ? { label: 'ลดลง', icon: 'trending', iconStyle: { transform: 'scaleY(-1)' }, tone: 'var(--success)' } // เฉียงลงขวา
    : residualScore > initialScore
      ? { label: 'สูงขึ้น', icon: 'trending', iconStyle: undefined, tone: 'var(--danger)' } // เฉียงขึ้นขวา
      : { label: 'เท่าเดิม', icon: 'arrowRight', iconStyle: undefined, tone: 'var(--warning)' } // เส้นตรงขวา

  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: SPACE.sm }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.xs, marginBottom: SPACE.sm }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 7, fontSize: FONT.md, fontWeight: 700, color: 'var(--ink)' }}>
          <Icon name="trending" size={15} />ความเสี่ยงคงเหลือหลังมาตรการ (Residual Risk)
        </h3>
        {canReview && !editing && (
          <Button variant="ghost" size="sm" icon="edit" onClick={() => setEditing(true)}>
            {entry.residual_score ? 'ประเมินใหม่' : 'ประเมิน'}
          </Button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: SPACE.sm, alignItems: 'center' }}>
        <ScoreReadout
          label="ก่อนมาตรการ"
          likelihood={entry.likelihood}
          impact={entry.impact}
          level={entry.level ? LEVEL_LABEL[entry.level as 'low'] : null}
          tone={entry.level ? LEVEL_TONE_VAR[entry.level] : 'var(--muted)'}
        />
        {trend && (
          <p style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: trend.tone, fontSize: FONT.md, fontWeight: 700 }}>
            <Icon name={trend.icon} size={16} style={trend.iconStyle} />{trend.label}
          </p>
        )}
        <ScoreReadout
          label="หลังมาตรการ"
          likelihood={editing ? likelihood : entry.residual_likelihood}
          impact={editing ? impact : entry.residual_impact}
          level={editing
            ? (previewLevel ? LEVEL_LABEL[previewLevel] : null)
            : (entry.residual_level ? LEVEL_LABEL[entry.residual_level as 'low'] : null)}
          tone={(editing ? previewLevel : entry.residual_level)
            ? LEVEL_TONE_VAR[(editing ? previewLevel : entry.residual_level) as string]
            : 'var(--muted)'}
        />
      </div>

      {editing && (
        <div style={{ marginTop: SPACE.sm, display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: SPACE.sm }}>
            <ScalePicker legend="โอกาสเกิดหลังมาตรการ" name="residual-likelihood" scale={LIKELIHOOD_SCALE} value={likelihood} onChange={setLikelihood} />
            <ScalePicker legend="ผลกระทบหลังมาตรการ" name="residual-impact" scale={IMPACT_SCALE} value={impact} onChange={setImpact} />
          </div>
          <Field label="ผู้ยอมรับความเสี่ยงคงเหลือ" hint="กรอกชื่อเมื่อผู้บริหารยอมรับความเสี่ยงระดับนี้แล้ว เว้นว่างถ้ายังต้องติดตามต่อ">
            <input value={acceptedBy} onChange={e => setAcceptedBy(e.target.value)} style={inputStyle} />
          </Field>
          <div style={{ display: 'flex', gap: SPACE.xs, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>ยกเลิก</Button>
            <Button
              variant="primary"
              icon="check"
              disabled={busy || !likelihood || !impact}
              onClick={async () => {
                if (await onSave({
                  residual_likelihood: likelihood,
                  residual_impact: impact,
                  risk_accepted_by_name: acceptedBy || null,
                })) setEditing(false)
              }}
            >
              บันทึกการประเมิน
            </Button>
          </div>
        </div>
      )}

      {!editing && entry.residual_assessed_at && (
        <p style={{ margin: `${SPACE.xs}px 0 0`, fontSize: FONT.base, color: 'var(--muted)', ...tabularNums }}>
          ประเมินโดย {entry.residual_assessed_by_name ?? 'ไม่ระบุ'} · {formatThaiDate(entry.residual_assessed_at.slice(0, 10))}
          {entry.risk_accepted_by_name && ` · ยอมรับความเสี่ยงโดย ${entry.risk_accepted_by_name}`}
        </p>
      )}
    </section>
  )
}
