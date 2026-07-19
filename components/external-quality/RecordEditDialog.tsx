'use client'

import { useEffect, useState } from 'react'

export type RecordEditField = {
  key: string
  label: string
  type?: 'text' | 'email' | 'date' | 'number' | 'textarea' | 'checkbox' | 'select'
  required?: boolean
  options?: Array<{ value: string; label: string }>
}

type Props = {
  title: string
  fields: RecordEditField[]
  initialValues: Record<string, unknown>
  onClose: () => void
  onSave: (values: Record<string, unknown>) => Promise<void>
}

const control: React.CSSProperties = { minHeight: 38, width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit' }

export function RecordEditDialog({ title, fields, initialValues, onClose, onSave }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setValues(initialValues); setError('') }, [initialValues])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try { await onSave(values); onClose() } catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ') } finally { setSaving(false) }
  }

  return <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,.52)' }}>
    <form onSubmit={submit} style={{ width: 'min(760px, 100%)', maxHeight: 'calc(100vh - 32px)', overflow: 'auto', padding: 20, borderRadius: 14, background: 'var(--card)', boxShadow: '0 22px 60px rgba(15,23,42,.3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}><h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2><button type="button" onClick={onClose} aria-label="ปิด" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--muted)', fontSize: 22 }}>×</button></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
        {fields.map(field => <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: field.type === 'textarea' ? '1 / -1' : undefined }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{field.label}</span>
          {field.type === 'checkbox'
            ? <input type="checkbox" checked={Boolean(values[field.key])} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.checked }))} />
            : field.type === 'select'
              ? <select required={field.required} value={String(values[field.key] ?? '')} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))} style={control}>{(field.options ?? []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              : field.type === 'textarea'
                ? <textarea required={field.required} value={String(values[field.key] ?? '')} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))} style={{ ...control, minHeight: 88 }} />
                : <input type={field.type ?? 'text'} required={field.required} value={String(values[field.key] ?? '')} onChange={event => setValues(current => ({ ...current, [field.key]: field.type === 'number' ? (event.target.value === '' ? null : Number(event.target.value)) : event.target.value }))} style={control} />}
        </label>)}
      </div>
      {error && <p role="alert" style={{ marginBottom: 0, color: '#B91C1C' }}>{error}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}><button type="button" onClick={onClose} style={{ minHeight: 38, padding: '0 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button><button disabled={saving} style={{ minHeight: 38, padding: '0 14px', border: 0, borderRadius: 8, background: 'var(--primary)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{saving ? 'กำลังบันทึก…' : 'บันทึกการแก้ไข'}</button></div>
    </form>
  </div>
}
