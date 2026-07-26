'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Icon } from '@/components/ui/Icon'
import {
  DEFAULT_SECTION_OWNERS,
  type ManualPublication,
  type ManualPublicationRevision,
  type ManualSectionControl,
  type ManualSectionRevision,
} from '@/lib/manual/control'
import type { Lang } from './data'

const fieldStyle: React.CSSProperties = {
  width: '100%', minHeight: 40, boxSizing: 'border-box',
  padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13,
}

const HISTORY_PREVIEW_COUNT = 5

function formatDate(value: string | null | undefined, lang: Lang, includeTime = false) {
  if (!value) return lang === 'th' ? 'ยังไม่กำหนด' : 'Not specified'
  const date = includeTime ? new Date(value) : new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH-u-ca-buddhist' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}

function MetaItem({ icon, label, value, pending = false }: { icon: string; label: string; value: string; pending?: boolean }) {
  return (
    <div className="manual-control-meta-item">
      <Icon name={icon} size={14} style={{ color: pending ? 'var(--muted)' : 'var(--primary)', flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div className="manual-control-meta-label">{label}</div>
        <div className="manual-control-meta-value" style={{ color: pending ? 'var(--muted)' : 'var(--ink)' }}>{value}</div>
      </div>
    </div>
  )
}

export function ManualDocumentControl({ initial, history, canEdit, lang }: {
  initial: ManualPublication
  history: ManualPublicationRevision[]
  canEdit: boolean
  lang: Lang
}) {
  const [value, setValue] = useState(initial)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setValue(initial)
    setShowAllHistory(false)
  }, [initial])

  const visibleHistory = (showAllHistory ? history : history.slice(0, HISTORY_PREVIEW_COUNT)).map(item => (
    item.revision === value.revision
      ? {
          ...item,
          revision_date: value.revision_date,
          effective_date: value.effective_date,
          revised_by_name: value.revised_by_name,
          approved_by_name: value.approved_by_name,
        }
      : item
  ))

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/admin/manual/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_code: String(form.get('document_code') ?? ''),
          revision: String(form.get('revision') ?? ''),
          revision_date: String(form.get('revision_date') ?? ''),
          effective_date: String(form.get('effective_date') ?? ''),
          revised_by_name: String(form.get('revised_by_name') ?? ''),
          approved_by_name: String(form.get('approved_by_name') ?? ''),
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'บันทึกข้อมูลควบคุมไม่สำเร็จ')
      setValue(json as ManualPublication)
      setEditing(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกข้อมูลควบคุมไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="manual-document-control" aria-label={lang === 'th' ? 'ข้อมูลควบคุมคู่มือออนไลน์' : 'Online manual control information'}>
      <style>{`
        .manual-document-control { margin-top: 16px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
        .manual-control-meta-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
        .manual-control-meta-item { min-width: 0; display: flex; align-items: flex-start; gap: 7px; padding: 4px 6px; }
        .manual-control-meta-label { margin-bottom: 2px; color: var(--muted); font-size: 10.5px; font-weight: 600; }
        .manual-control-meta-value { overflow-wrap: anywhere; font-size: 12px; font-weight: 700; line-height: 1.45; }
        .manual-control-actions { position: absolute; top: 56px; right: 32px; display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
        .manual-control-action { min-height: 40px; padding: 7px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--card); color: var(--primary); cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; transition: border-color .15s, background .15s; }
        .manual-control-action:hover, .manual-control-action:focus-visible { border-color: var(--primary); background: var(--primary-soft); outline: none; }
        .manual-control-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
        .manual-control-form-grid label { display: flex; flex-direction: column; gap: 4px; color: var(--muted); font-size: 11px; font-weight: 700; }
        .manual-publication-history { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
        .manual-publication-history-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
        .manual-publication-history-table th { padding: 7px 8px; border-bottom: 1px solid var(--border); color: var(--muted); font-size: 10.5px; text-align: left; vertical-align: bottom; }
        .manual-publication-history-table td { padding: 8px; border-bottom: 1px solid var(--border); color: var(--ink); line-height: 1.5; vertical-align: top; }
        .manual-publication-history-table tr:last-child td { border-bottom: 0; }
        .manual-publication-history-table tr[data-current='true'] td { background: color-mix(in srgb, var(--primary-soft) 75%, transparent); }
        .manual-publication-history-cards { display: none; }
        .manual-publication-history-card { padding: 12px; border: 1px solid var(--border); border-radius: 9px; background: var(--card); }
        .manual-publication-history-card[data-current='true'] { border-color: color-mix(in srgb, var(--primary) 45%, var(--border)); background: var(--primary-soft); }
        .manual-publication-history-card dl { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 5px 9px; margin: 9px 0 0; }
        .manual-publication-history-card dt { color: var(--muted); font-size: 11px; font-weight: 700; }
        .manual-publication-history-card dd { margin: 0; color: var(--ink); font-size: 11.5px; line-height: 1.5; overflow-wrap: anywhere; }
        @media (max-width: 1100px) {
          .manual-control-actions { position: static; margin-bottom: 10px; justify-content: flex-start; }
          .manual-control-meta-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .manual-document-control { padding: 10px; }
          .manual-control-meta-grid, .manual-control-form-grid { grid-template-columns: 1fr; }
          .manual-control-meta-item { padding: 5px 4px; }
          .manual-control-action { min-height: 44px; width: 100%; }
          .manual-publication-history-table { display: none; }
          .manual-publication-history-cards { display: grid; gap: 9px; }
        }
      `}</style>
      <div className="manual-control-actions">
        <button type="button" className="manual-control-action" onClick={() => {
          if (!historyOpen) setShowAllHistory(false)
          setHistoryOpen(current => !current)
        }} aria-expanded={historyOpen}>
          {lang === 'th' ? `ประวัติการแก้ไขคู่มือ (${history.length})` : `Manual revision history (${history.length})`}
        </button>
        {canEdit && (
          <button type="button" className="manual-control-action" onClick={() => { setEditing(current => !current); setError('') }} aria-expanded={editing}>
            {lang === 'th' ? 'จัดการข้อมูลควบคุม' : 'Manage control information'}
          </button>
        )}
      </div>

      <div className="manual-control-meta-grid">
        <MetaItem icon="doc" label={lang === 'th' ? 'รหัสคู่มือ' : 'Manual code'} value={value.document_code} />
        <MetaItem icon="book" label={lang === 'th' ? 'ฉบับแก้ไข' : 'Revision'} value={`Rev. ${value.revision}`} />
        <MetaItem icon="calendar" label={lang === 'th' ? 'วันที่บังคับใช้' : 'Effective date'} value={formatDate(value.effective_date, lang)} pending={!value.effective_date} />
        <MetaItem icon="clock" label={lang === 'th' ? 'ทบทวนล่าสุด (อัตโนมัติ)' : 'Last reviewed (automatic)'} value={formatDate(value.reviewed_at, lang)} pending={!value.reviewed_at} />
        <MetaItem icon="user" label={lang === 'th' ? 'ผู้ทำการแก้ไข' : 'Revised by'} value={value.revised_by_name || (lang === 'th' ? 'ยังไม่กำหนด' : 'Not specified')} pending={!value.revised_by_name} />
        <MetaItem icon="shieldCheck" label={lang === 'th' ? 'ผู้อนุมัติ' : 'Approved by'} value={value.approved_by_name || (lang === 'th' ? 'ยังไม่กำหนด' : 'Not specified')} pending={!value.approved_by_name} />
      </div>

      {historyOpen && (
        <div className="manual-publication-history">
          {history.length > 0 ? (
            <>
              <table className="manual-publication-history-table">
                <thead>
                  <tr>
                    <th>{lang === 'th' ? 'ฉบับ' : 'Rev.'}</th>
                    <th>{lang === 'th' ? 'วันที่แก้ไขเอกสาร' : 'Document revised'}</th>
                    <th>{lang === 'th' ? 'วันที่บังคับใช้' : 'Effective'}</th>
                    <th>{lang === 'th' ? 'รายการแก้ไข' : 'Change'}</th>
                    <th>{lang === 'th' ? 'ผู้ทำการแก้ไข' : 'Revised by'}</th>
                    <th>{lang === 'th' ? 'ผู้อนุมัติ' : 'Approved by'}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleHistory.map(item => (
                    <tr key={item.id} data-current={item.revision === value.revision}>
                      <td><strong>Rev. {item.revision}</strong></td>
                      <td>{item.revision === '00' && !item.revision_date ? <span style={{ display: 'block', textAlign: 'center' }}>-</span> : formatDate(item.revision_date, lang)}</td>
                      <td>{formatDate(item.effective_date, lang)}</td>
                      <td>{item.change_summary}</td>
                      <td>{item.revised_by_name || (lang === 'th' ? 'ยังไม่กำหนด' : 'Not specified')}</td>
                      <td>{item.approved_by_name || (lang === 'th' ? 'ยังไม่กำหนด' : 'Not specified')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="manual-publication-history-cards">
                {visibleHistory.map(item => (
                  <article key={item.id} className="manual-publication-history-card" data-current={item.revision === value.revision}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ color: 'var(--primary)', fontSize: 13 }}>Rev. {item.revision}</strong>
                    </div>
                    <div style={{ marginTop: 7, color: 'var(--ink)', fontSize: 12.5, fontWeight: 700, lineHeight: 1.55 }}>{item.change_summary}</div>
                    <dl>
                      <dt>{lang === 'th' ? 'วันที่แก้ไขเอกสาร' : 'Document revised'}</dt><dd>{item.revision === '00' && !item.revision_date ? '-' : formatDate(item.revision_date, lang)}</dd>
                      <dt>{lang === 'th' ? 'วันที่บังคับใช้' : 'Effective'}</dt><dd>{formatDate(item.effective_date, lang)}</dd>
                      <dt>{lang === 'th' ? 'ผู้ทำการแก้ไข' : 'Revised by'}</dt><dd>{item.revised_by_name || (lang === 'th' ? 'ยังไม่กำหนด' : 'Not specified')}</dd>
                      <dt>{lang === 'th' ? 'ผู้อนุมัติ' : 'Approved by'}</dt><dd>{item.approved_by_name || (lang === 'th' ? 'ยังไม่กำหนด' : 'Not specified')}</dd>
                    </dl>
                  </article>
                ))}
              </div>
              {history.length > HISTORY_PREVIEW_COUNT && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                  <button type="button" className="manual-control-action" onClick={() => setShowAllHistory(current => !current)} aria-expanded={showAllHistory}>
                    {showAllHistory
                      ? (lang === 'th' ? `แสดงเฉพาะ ${HISTORY_PREVIEW_COUNT} รายการล่าสุด` : `Show latest ${HISTORY_PREVIEW_COUNT}`)
                      : (lang === 'th' ? `ดูประวัติทั้งหมด (${history.length})` : `View all history (${history.length})`)}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{lang === 'th' ? 'ยังไม่มีข้อมูลประวัติการแก้ไขระดับคู่มือ' : 'No manual-level revision history is available.'}</div>
          )}
        </div>
      )}

      {editing && (
        <form onSubmit={save} className="manual-control-form-grid">
          <label>{lang === 'th' ? 'รหัสคู่มือ' : 'Manual code'}<input name="document_code" required maxLength={80} defaultValue={value.document_code} style={fieldStyle} /></label>
          <label>{lang === 'th' ? 'ฉบับแก้ไข' : 'Revision'}<input name="revision" required maxLength={40} defaultValue={value.revision} style={fieldStyle} /></label>
          <label>{lang === 'th' ? 'วันที่แก้ไขเอกสาร' : 'Document revised date'}<input name="revision_date" type="date" defaultValue={value.revision_date ?? ''} style={fieldStyle} /></label>
          <label>{lang === 'th' ? 'วันที่บังคับใช้' : 'Effective date'}<input name="effective_date" type="date" defaultValue={value.effective_date ?? ''} style={fieldStyle} /></label>
          <div style={{ gridColumn: '1 / -1', color: 'var(--muted)', fontSize: 11.5, lineHeight: 1.55 }}>
            {lang === 'th' ? 'วันที่แก้ไขเอกสารและวันที่บังคับใช้ กำหนดโดยผู้ควบคุมเอกสาร ส่วนวันที่ทบทวนล่าสุดอัปเดตอัตโนมัติเมื่อเผยแพร่การเปลี่ยนแปลงของแต่ละหัวข้อ' : 'Document revised and effective dates are controlled manually; last reviewed updates automatically when a section change is published.'}
          </div>
          <label>{lang === 'th' ? 'ชื่อผู้ทำการแก้ไข' : 'Revised by'}<input name="revised_by_name" maxLength={200} defaultValue={value.revised_by_name ?? ''} style={fieldStyle} /></label>
          <label style={{ gridColumn: '1 / -1' }}>{lang === 'th' ? 'ชื่อผู้อนุมัติ' : 'Approved by'}<input name="approved_by_name" maxLength={200} defaultValue={value.approved_by_name ?? ''} style={fieldStyle} /></label>
          {error && <div role="alert" style={{ gridColumn: '1 / -1', color: 'var(--danger)', fontSize: 12.5 }}>{error}</div>}
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="manual-control-action" onClick={() => setEditing(false)} disabled={saving}>{lang === 'th' ? 'ยกเลิก' : 'Cancel'}</button>
            <button type="submit" className="manual-control-action" disabled={saving} style={{ borderColor: 'var(--primary)', background: 'var(--primary)', color: '#fff' }}>{saving ? (lang === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (lang === 'th' ? 'บันทึก' : 'Save')}</button>
          </div>
        </form>
      )}
    </section>
  )
}

export function ManualSectionGovernance({ sectionId, sectionLabel, initial, canEdit, lang }: {
  sectionId: string
  sectionLabel: string
  initial?: ManualSectionControl
  canEdit: boolean
  lang: Lang
}) {
  const fallbackOwner = DEFAULT_SECTION_OWNERS[sectionId] ?? DEFAULT_SECTION_OWNERS.home
  const [control, setControl] = useState<ManualSectionControl | undefined>(initial)
  const [history, setHistory] = useState<ManualSectionRevision[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishSummary, setPublishSummary] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setControl(initial)
    setHistory([])
    setHistoryOpen(false)
    setShowAllHistory(false)
    setEditing(false)
    setPublishOpen(false)
    setPublishSummary('')
    setError('')
  }, [sectionId, initial])

  async function loadHistory() {
    const nextOpen = !historyOpen
    setHistoryOpen(nextOpen)
    if (!nextOpen) return
    setShowAllHistory(false)
    setLoadingHistory(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/manual/${sectionId}`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'ไม่สามารถโหลดประวัติการเปลี่ยนแปลงหัวข้อนี้ได้')
      if (json.control) setControl(json.control as ManualSectionControl)
      setHistory((json.history ?? []) as ManualSectionRevision[])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ไม่สามารถโหลดประวัติการเปลี่ยนแปลงหัวข้อนี้ได้')
    } finally {
      setLoadingHistory(false)
    }
  }

  async function saveOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const ownerTh = String(form.get('owner_name_th') ?? '').trim()
    const ownerEn = String(form.get('owner_name_en') ?? '').trim()
    if (!ownerTh) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/manual/${sectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_name_th: ownerTh,
          owner_name_en: ownerEn || null,
          change_summary: `ปรับผู้รับผิดชอบเนื้อหาหัวข้อ ${sectionLabel}`,
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'บันทึกผู้รับผิดชอบไม่สำเร็จ')
      setEditing(false)
      setPublishOpen(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกผู้รับผิดชอบไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function publishDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const summary = publishSummary.trim()
    if (!summary) return
    setPublishing(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/manual/${sectionId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change_summary: summary }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'เผยแพร่การเปลี่ยนแปลงไม่สำเร็จ')
      if (json.control) setControl(json.control as ManualSectionControl)
      if (json.latest_history) setHistory(current => [json.latest_history as ManualSectionRevision, ...current.filter(item => item.id !== json.latest_history.id)])
      setPublishOpen(false)
      setPublishSummary('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'เผยแพร่การเปลี่ยนแปลงไม่สำเร็จ')
    } finally {
      setPublishing(false)
    }
  }

  const owner = lang === 'th'
    ? (control?.owner_name_th || fallbackOwner.th)
    : (control?.owner_name_en || fallbackOwner.en)
  const visibleHistory = showAllHistory ? history : history.slice(0, HISTORY_PREVIEW_COUNT)

  return (
    <aside className="manual-section-governance" aria-label={lang === 'th' ? 'ข้อมูลกำกับหัวข้อ' : 'Section governance'}>
      <style>{`
        .manual-section-governance { margin-bottom: 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); }
        .manual-section-governance-summary { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .manual-section-owner { display: flex; align-items: center; gap: 7px; min-width: 0; flex: 1 1 280px; color: var(--ink); font-size: 12.5px; line-height: 1.5; }
        .manual-section-chip { display: inline-flex; align-items: center; min-height: 26px; padding: 3px 8px; border: 1px solid var(--border); border-radius: 999px; background: var(--card); color: var(--muted); font-size: 11px; font-weight: 700; }
        .manual-section-governance-button { min-height: 38px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--card); color: var(--primary); cursor: pointer; font-family: inherit; font-size: 11.5px; font-weight: 700; transition: border-color .15s, background .15s; }
        .manual-section-governance-button:hover, .manual-section-governance-button:focus-visible { border-color: var(--primary); background: var(--primary-soft); outline: none; }
        .manual-history-list { margin: 10px 0 0; padding: 10px 0 0; border-top: 1px solid var(--border); list-style: none; }
        .manual-history-item { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 10px; padding: 8px 4px; border-bottom: 1px solid var(--border); }
        .manual-history-item:last-child { border-bottom: 0; }
        .manual-history-version { display: block; color: var(--primary); font-size: 11.5px; font-weight: 800; }
        .manual-history-version strong { display: block; text-align: center; }
        .manual-owner-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
        .manual-owner-form label { display: flex; flex-direction: column; gap: 4px; color: var(--muted); font-size: 11px; font-weight: 700; }
        @media (max-width: 640px) {
          .manual-section-governance-summary { align-items: stretch; }
          .manual-section-owner { flex-basis: 100%; }
          .manual-section-governance-button { min-height: 44px; flex: 1; }
          .manual-owner-form { grid-template-columns: 1fr; }
          .manual-history-item { grid-template-columns: 58px minmax(0, 1fr); }
        }
      `}</style>
      <div className="manual-section-governance-summary">
        <div className="manual-section-owner">
          <Icon name="user" size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span><span style={{ color: 'var(--muted)' }}>{lang === 'th' ? 'ผู้รับผิดชอบเนื้อหา:' : 'Content owner:'}</span> <strong>{owner}</strong></span>
        </div>
        <span className="manual-section-chip">{lang === 'th' ? 'เวอร์ชันหัวข้อที่เผยแพร่' : 'Published section version'} {control?.revision_no ?? 1}</span>
        <span className="manual-section-chip">{lang === 'th' ? 'อัปเดตเนื้อหาล่าสุด' : 'Content updated'} {formatDate(control?.updated_at, lang, true)}</span>
        <button type="button" className="manual-section-governance-button" onClick={loadHistory} aria-expanded={historyOpen}>
          {lang === 'th' ? 'ประวัติการเปลี่ยนแปลงหัวข้อนี้' : 'Section change history'}
        </button>
        {canEdit && <button type="button" className="manual-section-governance-button" onClick={() => { setEditing(current => !current); setError('') }} aria-expanded={editing}>{lang === 'th' ? 'กำหนดผู้รับผิดชอบ' : 'Set owner'}</button>}
        {canEdit && <button type="button" className="manual-section-governance-button" onClick={() => { setPublishOpen(current => !current); setError('') }} aria-expanded={publishOpen} style={{ borderColor: 'var(--primary)', background: 'var(--primary)', color: '#fff' }}>{lang === 'th' ? 'เผยแพร่การเปลี่ยนแปลง' : 'Publish changes'}</button>}
      </div>

      {editing && (
        <form className="manual-owner-form" onSubmit={saveOwner}>
          <label>{lang === 'th' ? 'ผู้รับผิดชอบ (ภาษาไทย)' : 'Owner (Thai)'}<input name="owner_name_th" required maxLength={200} defaultValue={control?.owner_name_th ?? fallbackOwner.th} style={fieldStyle} /></label>
          <label>{lang === 'th' ? 'ผู้รับผิดชอบ (English)' : 'Owner (English)'}<input name="owner_name_en" maxLength={200} defaultValue={control?.owner_name_en ?? fallbackOwner.en} style={fieldStyle} /></label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="manual-section-governance-button" onClick={() => setEditing(false)} disabled={saving}>{lang === 'th' ? 'ยกเลิก' : 'Cancel'}</button>
            <button type="submit" className="manual-section-governance-button" disabled={saving} style={{ borderColor: 'var(--primary)', background: 'var(--primary)', color: '#fff' }}>{saving ? (lang === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (lang === 'th' ? 'บันทึก' : 'Save')}</button>
          </div>
          <div style={{ gridColumn: '1 / -1', color: 'var(--muted)', fontSize: 11.5, lineHeight: 1.55 }}>
            {lang === 'th' ? 'การบันทึกนี้เป็นร่าง และจะมีผลกับคู่มือเมื่อกด “เผยแพร่การเปลี่ยนแปลง” เท่านั้น' : 'This is saved as a draft and affects the manual only after publishing.'}
          </div>
        </form>
      )}

      {publishOpen && (
        <form className="manual-owner-form" onSubmit={publishDraft}>
          <label style={{ gridColumn: '1 / -1' }}>
            {lang === 'th' ? 'สรุปการเปลี่ยนแปลงที่จะเผยแพร่' : 'Summary of changes to publish'}
            <input value={publishSummary} onChange={event => setPublishSummary(event.target.value)} required maxLength={500}
              placeholder={lang === 'th' ? 'เช่น ปรับแนวทางการเก็บรักษาสิ่งตัวอย่างส่งตรวจก่อนนำส่ง' : 'For example: Clarified specimen storage before delivery'} style={fieldStyle} />
          </label>
          <div style={{ gridColumn: '1 / -1', color: 'var(--muted)', fontSize: 11.5, lineHeight: 1.55 }}>
            {lang === 'th' ? 'การเผยแพร่จะสร้างเวอร์ชันหัวข้อใหม่ 1 รายการ และอัปเดตวันที่ทบทวนล่าสุดของคู่มือ' : 'Publishing creates one new section version and updates the manual review date.'}
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="manual-section-governance-button" onClick={() => setPublishOpen(false)} disabled={publishing}>{lang === 'th' ? 'ยกเลิก' : 'Cancel'}</button>
            <button type="submit" className="manual-section-governance-button" disabled={publishing} style={{ borderColor: 'var(--primary)', background: 'var(--primary)', color: '#fff' }}>{publishing ? (lang === 'th' ? 'กำลังเผยแพร่...' : 'Publishing...') : (lang === 'th' ? 'ยืนยันเผยแพร่' : 'Publish')}</button>
          </div>
        </form>
      )}

      {error && <div role="alert" style={{ marginTop: 8, color: 'var(--danger)', fontSize: 12 }}>{error}</div>}

      {historyOpen && (
        <div aria-live="polite">
          {loadingHistory ? (
            <div style={{ padding: '12px 4px 2px', color: 'var(--muted)', fontSize: 12 }}>{lang === 'th' ? 'กำลังโหลดประวัติการเปลี่ยนแปลงหัวข้อนี้...' : 'Loading section change history...'}</div>
          ) : history.length > 0 ? (
            <>
            <ol className="manual-history-list">
              {visibleHistory.map(item => (
                <li key={item.id} className="manual-history-item">
                  <span className="manual-history-version">
                    {lang === 'th' ? 'เวอร์ชันหัวข้อ' : 'Section version'}
                    <strong>{item.revision_no}</strong>
                  </span>
                  <div>
                    <div style={{ color: 'var(--ink)', fontSize: 12.5, fontWeight: 700, lineHeight: 1.55 }}>{item.change_summary}</div>
                    <div style={{ marginTop: 2, color: 'var(--muted)', fontSize: 11.5, lineHeight: 1.5 }}>{formatDate(item.changed_at, lang, true)} · {item.changed_by_name || (lang === 'th' ? 'ระบบ' : 'System')}</div>
                  </div>
                </li>
              ))}
            </ol>
            {history.length > HISTORY_PREVIEW_COUNT && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                <button type="button" className="manual-section-governance-button" onClick={() => setShowAllHistory(current => !current)} aria-expanded={showAllHistory}>
                  {showAllHistory
                    ? (lang === 'th' ? `แสดงเฉพาะ ${HISTORY_PREVIEW_COUNT} รายการล่าสุด` : `Show latest ${HISTORY_PREVIEW_COUNT}`)
                    : (lang === 'th' ? `ดูประวัติทั้งหมด (${history.length})` : `View all history (${history.length})`)}
                </button>
              </div>
            )}
            </>
          ) : (
            <div style={{ padding: '12px 4px 2px', color: 'var(--muted)', fontSize: 12 }}>{lang === 'th' ? 'ยังไม่มีประวัติการเปลี่ยนแปลงของหัวข้อนี้' : 'No section change history is available yet.'}</div>
          )}
        </div>
      )}
    </aside>
  )
}
