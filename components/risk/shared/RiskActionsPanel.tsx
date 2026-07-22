'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field, OverdueBadge } from './ui'
import {
  ACTION_STATUSES, ACTION_TYPES, FONT, SPACE,
  daysOverdue, formatThaiDate, inputStyle, tabularNums, textareaStyle, todayIso,
} from './tokens'

export type RiskAction = {
  id: number
  action_type: string
  description: string
  owner: string | null
  due_date: string | null
  status: string
  completed_at: string | null
  evidence: string | null
  result: string | null
  is_effective: boolean | null
  followed_by: string | null
  follow_up_date: string | null
  next_follow_up_date: string | null
}

interface Props {
  actions: RiskAction[]
  endpoint: string
  canManage: boolean
  actorName: string | null
  onChanged: () => void
}

/**
 * มาตรการแก้ไขและการติดตามประสิทธิผล (ISO 15189 8.7)
 *
 * ระบบเดิมมีแค่ปุ่ม "mark done" ทั้งที่ตารางมีคอลัมน์ result / is_effective /
 * followed_by / next_follow_up_date รออยู่ครบ — การติดตามว่ามาตรการ "ได้ผลจริงไหม"
 * คือหัวใจของข้อกำหนด ไม่ใช่แค่การทำเสร็จ
 */
export function RiskActionsPanel({ actions, endpoint, canManage, actorName, onChanged }: Props) {
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function send(method: string, body?: unknown, query = '') {
    setError('')
    const res = await fetch(`${endpoint}${query}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error ?? 'บันทึกไม่สำเร็จ')
      return false
    }
    onChanged()
    return true
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
      {error && <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: FONT.base }}>{error}</p>}

      {actions.length === 0 && !adding && (
        <EmptyState icon="clipboard" title="ยังไม่มีมาตรการแก้ไข" hint={canManage ? 'เพิ่มมาตรการเพื่อเริ่มติดตามความคืบหน้า' : undefined} />
      )}

      {actions.map(action => (
        <ActionCard
          key={action.id}
          action={action}
          canManage={canManage}
          actorName={actorName}
          onSave={patch => send('PATCH', { id: action.id, ...patch })}
          onDelete={() => send('DELETE', undefined, `?actionId=${action.id}`)}
        />
      ))}

      {canManage && (adding
        ? <NewActionForm onCancel={() => setAdding(false)} onSubmit={async draft => { if (await send('POST', draft)) setAdding(false) }} />
        : <Button variant="secondary" icon="plus" onClick={() => setAdding(true)}>เพิ่มมาตรการ</Button>
      )}
    </div>
  )
}

function ActionCard({ action, canManage, actorName, onSave, onDelete }: {
  action: RiskAction
  canManage: boolean
  actorName: string | null
  onSave: (patch: Record<string, unknown>) => Promise<boolean>
  onDelete: () => Promise<boolean>
}) {
  const [following, setFollowing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({
    result: action.result ?? '',
    is_effective: action.is_effective,
    followed_by: action.followed_by ?? actorName ?? '',
    follow_up_date: action.follow_up_date ?? todayIso(),
    next_follow_up_date: action.next_follow_up_date ?? '',
  })

  const overdue = action.status !== 'done' ? daysOverdue(action.due_date) : 0
  const statusMeta = ACTION_STATUSES.find(s => s.value === action.status) ?? ACTION_STATUSES[0]
  const typeLabel = ACTION_TYPES.find(t => t.value === action.action_type)?.label ?? action.action_type

  async function submitFollowUp() {
    setSaving(true)
    const ok = await onSave({
      status: 'done',
      result: draft.result || null,
      is_effective: draft.is_effective,
      followed_by: draft.followed_by || null,
      follow_up_date: draft.follow_up_date || null,
      next_follow_up_date: draft.next_follow_up_date || null,
    })
    setSaving(false)
    if (ok) setFollowing(false)
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: SPACE.sm, background: 'var(--card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.xs, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: FONT.md, color: 'var(--ink)', minWidth: 0 }}>{action.description}</strong>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Badge color={statusMeta.tone}>{statusMeta.label}</Badge>
          <OverdueBadge days={overdue} />
          {action.is_effective === true && <Badge color="green"><Icon name="check" size={12} />ได้ผล</Badge>}
          {action.is_effective === false && <Badge color="red"><Icon name="alert" size={12} />ไม่ได้ผล</Badge>}
        </div>
      </div>

      <p style={{ margin: `${SPACE.xs}px 0 0`, color: 'var(--muted)', fontSize: FONT.base, ...tabularNums }}>
        {typeLabel} · ผู้รับผิดชอบ {action.owner || 'ไม่ระบุ'} · กำหนด {formatThaiDate(action.due_date)}
      </p>

      {action.result && (
        <p style={{ margin: `${SPACE.xs}px 0 0`, fontSize: FONT.base, color: 'var(--ink)', lineHeight: 1.6 }}>
          <span style={{ color: 'var(--muted)' }}>ผลการติดตาม: </span>{action.result}
          {action.followed_by && <span style={{ color: 'var(--muted)' }}> — {action.followed_by}, {formatThaiDate(action.follow_up_date)}</span>}
        </p>
      )}
      {action.next_follow_up_date && (
        <p style={{ margin: `4px 0 0`, fontSize: FONT.base, color: 'var(--muted)', ...tabularNums }}>
          ติดตามครั้งถัดไป {formatThaiDate(action.next_follow_up_date)}
        </p>
      )}

      {canManage && !following && (
        <div style={{ display: 'flex', gap: SPACE.xs, marginTop: SPACE.sm, flexWrap: 'wrap' }}>
          {action.status !== 'done' && (
            <Button variant="secondary" size="sm" icon="check" onClick={() => setFollowing(true)}>บันทึกผลติดตาม</Button>
          )}
          {action.status === 'done' && (
            <Button variant="ghost" size="sm" icon="edit" onClick={() => setFollowing(true)}>แก้ผลติดตาม</Button>
          )}
          <Button variant="ghost" size="sm" icon="trash" onClick={() => void onDelete()}>ลบ</Button>
        </div>
      )}

      {following && (
        <div style={{ marginTop: SPACE.sm, paddingTop: SPACE.sm, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
          <Field label="ผลการติดตาม" hint="สรุปสั้น ๆ ว่าหลังทำมาตรการแล้วเกิดอะไรขึ้น">
            <textarea
              value={draft.result}
              onChange={e => setDraft({ ...draft, result: e.target.value })}
              style={{ ...textareaStyle, minHeight: 64 }}
            />
          </Field>

          <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
            <legend style={{ fontSize: FONT.sm, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
              มาตรการนี้ได้ผลหรือไม่
            </legend>
            <div style={{ display: 'flex', gap: SPACE.xs, flexWrap: 'wrap' }}>
              {[
                { value: true, label: 'ได้ผล', icon: 'check' },
                { value: false, label: 'ไม่ได้ผล', icon: 'alert' },
              ].map(option => (
                <label
                  key={String(option.value)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '6px 14px',
                    border: `1px solid ${draft.is_effective === option.value ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 999, cursor: 'pointer', fontSize: FONT.md,
                    background: draft.is_effective === option.value ? 'var(--primary-soft)' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name={`effective-${action.id}`}
                    checked={draft.is_effective === option.value}
                    onChange={() => setDraft({ ...draft, is_effective: option.value })}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <Icon name={option.icon} size={14} />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: SPACE.xs }}>
            <Field label="ผู้ติดตาม">
              <input value={draft.followed_by} onChange={e => setDraft({ ...draft, followed_by: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="วันที่ติดตาม">
              <input type="date" value={draft.follow_up_date} onChange={e => setDraft({ ...draft, follow_up_date: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="ติดตามครั้งถัดไป" hint="เว้นว่างถ้าไม่ต้องติดตามอีก">
              <input type="date" value={draft.next_follow_up_date} onChange={e => setDraft({ ...draft, next_follow_up_date: e.target.value })} style={inputStyle} />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: SPACE.xs, justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="sm" onClick={() => setFollowing(false)} disabled={saving}>ยกเลิก</Button>
            <Button variant="primary" size="sm" icon="check" onClick={() => void submitFollowUp()} disabled={saving}>
              {saving ? 'กำลังบันทึก…' : 'บันทึก'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function NewActionForm({ onCancel, onSubmit }: {
  onCancel: () => void
  onSubmit: (draft: Record<string, unknown>) => Promise<void>
}) {
  const [draft, setDraft] = useState({ action_type: 'corrective', description: '', owner: '', due_date: '' })
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)
  const descriptionError = touched && !draft.description.trim() ? 'ต้องกรอกรายละเอียดมาตรการ' : undefined

  async function submit() {
    setTouched(true)
    if (!draft.description.trim()) return
    setSaving(true)
    await onSubmit({
      action_type: draft.action_type,
      description: draft.description.trim(),
      owner: draft.owner.trim() || null,
      due_date: draft.due_date || null,
    })
    setSaving(false)
  }

  return (
    <div style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: SPACE.sm, display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
      <Field label="ประเภทมาตรการ">
        <select value={draft.action_type} onChange={e => setDraft({ ...draft, action_type: e.target.value })} style={inputStyle}>
          {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </Field>
      <Field label="รายละเอียดมาตรการ" required error={descriptionError}>
        <textarea
          value={draft.description}
          onChange={e => setDraft({ ...draft, description: e.target.value })}
          onBlur={() => setTouched(true)}
          style={{ ...textareaStyle, minHeight: 64 }}
        />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: SPACE.xs }}>
        <Field label="ผู้รับผิดชอบ">
          <input value={draft.owner} onChange={e => setDraft({ ...draft, owner: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="กำหนดแล้วเสร็จ">
          <input type="date" value={draft.due_date} onChange={e => setDraft({ ...draft, due_date: e.target.value })} style={inputStyle} />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: SPACE.xs, justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>ยกเลิก</Button>
        <Button variant="primary" size="sm" icon="plus" onClick={() => void submit()} disabled={saving}>
          {saving ? 'กำลังบันทึก…' : 'เพิ่มมาตรการ'}
        </Button>
      </div>
    </div>
  )
}
