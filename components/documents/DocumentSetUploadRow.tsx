'use client'

import { Icon } from '@/components/ui/Icon'
import { DOC_TYPES } from '@/lib/validations/document'
import type { Document } from '@/lib/supabase/types'
import { fileSizeLabel, type DocType, type DuplicateChoice, type Group, type UploadEntry } from './document-set-upload-model'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 12.5, outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 4, color: 'var(--muted)', fontSize: 11.5, fontWeight: 600,
}

interface Props {
  entry: UploadEntry
  mainDoc: Document
  error: string
  repeated: boolean
  onRemove: (id: string) => void
  onGroupChange: (entry: UploadEntry, group: Group) => void
  onCodeChange: (id: string, code: string) => void
  onTitleChange: (id: string, title: string) => void
  onTypeChange: (id: string, type: DocType) => void
  onDuplicateChoice: (id: string, choice: DuplicateChoice) => void
}

export function DocumentSetUploadRow({
  entry, mainDoc, error, repeated, onRemove, onGroupChange, onCodeChange, onTitleChange, onTypeChange, onDuplicateChoice,
}: Props) {
  return (
    <section aria-labelledby={`entry-${entry.id}`} style={{ padding: 13, border: `1px solid ${error || repeated ? 'rgba(220,38,38,.3)' : 'var(--border)'}`, borderRadius: 10, background: 'var(--card)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div id={`entry-${entry.id}`} title={entry.file.name} style={{ color: 'var(--ink)', fontSize: 12.5, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.file.name}</div>
          <div style={{ marginTop: 2, color: 'var(--muted)', fontSize: 10.5 }}>{fileSizeLabel(entry.file.size)}</div>
        </div>
        <button type="button" aria-label={`นำ ${entry.file.name} ออกจากรายการ`} onClick={() => onRemove(entry.id)} style={{ flexShrink: 0, padding: 4, border: 0, background: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
          <Icon name="trash" size={15} />
        </button>
      </div>

      <fieldset style={{ margin: '10px 0 0', padding: 0, border: 0, display: 'flex', gap: 14 }}>
        <legend style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>กลุ่มของ {entry.file.name}</legend>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink)', fontSize: 11.5, cursor: 'pointer' }}>
          <input type="radio" name={`group-${entry.id}`} checked={entry.group === 'register'} onChange={() => onGroupChange(entry, 'register')} /> ลงทะเบียนในระบบ
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink)', fontSize: 11.5, cursor: 'pointer' }}>
          <input type="radio" name={`group-${entry.id}`} checked={entry.group === 'attach'} onChange={() => onGroupChange(entry, 'attach')} /> ไฟล์อ้างอิงประกอบการพิจารณา (ไม่ลงทะเบียนในระบบ)
        </label>
      </fieldset>

      {entry.group === 'register' ? (
        <div style={{ marginTop: 11 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 9 }}>
            <div>
              <label htmlFor={`code-${entry.id}`} style={labelStyle}>รหัสเอกสาร</label>
              <input id={`code-${entry.id}`} value={entry.code} onChange={(event) => onCodeChange(entry.id, event.target.value)} style={{ ...inputStyle, fontFamily: 'monospace' }} />
            </div>
            <div>
              <label htmlFor={`title-${entry.id}`} style={labelStyle}>ชื่อเอกสาร</label>
              <input id={`title-${entry.id}`} value={entry.title} onChange={(event) => onTitleChange(entry.id, event.target.value)} style={inputStyle} />
            </div>
            <div>
              <label htmlFor={`type-${entry.id}`} style={labelStyle}>ประเภท</label>
              <select id={`type-${entry.id}`} value={entry.type} onChange={(event) => onTypeChange(entry.id, event.target.value as DocType)} style={inputStyle}>
                {DOC_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 9, padding: '8px 10px', borderRadius: 7, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 10.8, lineHeight: 1.6 }}>
            <span style={{ color: 'var(--ink)', fontWeight: 600 }}>ข้อมูลที่ใช้ร่วมกับเอกสารหลัก:</span>{' '}
            หน่วยงาน {entry.department || '—'} · Rev. {mainDoc.revision || '1'} · ผู้จัดทำ {mainDoc.owner_name || '—'} · ผู้ทบทวน {mainDoc.reviewer_name || '—'} · ผู้อนุมัติ {mainDoc.approver_name || '—'} · วันที่แก้ไข {mainDoc.edit_date || '—'} · วันที่มีผล {mainDoc.effective_date || '—'} · {mainDoc.visibility}
          </div>

          {entry.duplicate.status === 'checking' ? <div role="status" style={{ marginTop: 7, color: 'var(--muted)', fontSize: 11 }}>กำลังตรวจสอบรหัสเอกสาร…</div> : null}
          {entry.duplicate.status === 'none' ? <div role="status" style={{ marginTop: 7, color: 'var(--success)', fontSize: 11 }}>ไม่พบรหัสซ้ำ พร้อมลงทะเบียนเอกสารใหม่</div> : null}
          {entry.duplicate.status === 'found' && entry.duplicate.document.status === 'Published' ? (
            <fieldset style={{ margin: '9px 0 0', padding: '9px 10px', borderRadius: 8, border: '1px solid rgba(217,119,6,.28)', background: 'rgba(217,119,6,.07)' }}>
              <legend style={{ padding: '0 4px', color: 'var(--warning)', fontSize: 11.5, fontWeight: 650 }}>
                พบเอกสาร Published: {entry.duplicate.document.document_code} Rev. {entry.duplicate.document.revision}
              </legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink)', fontSize: 11.5, cursor: 'pointer' }}>
                  <input type="radio" name={`duplicate-${entry.id}`} checked={entry.duplicateChoice === 'link-existing'} onChange={() => onDuplicateChoice(entry.id, 'link-existing')} /> ลิงก์เอกสารเดิม (ไม่อัปโหลดไฟล์นี้)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink)', fontSize: 11.5, cursor: 'pointer' }}>
                  <input type="radio" name={`duplicate-${entry.id}`} checked={entry.duplicateChoice === 'revise-existing'} onChange={() => onDuplicateChoice(entry.id, 'revise-existing')} /> เปิดปรับปรุง Rev+
                </label>
              </div>
            </fieldset>
          ) : null}
          {error || repeated ? <div role="alert" style={{ marginTop: 7, color: 'var(--danger)', fontSize: 11 }}>{repeated ? 'มีรหัสนี้ซ้ำกันมากกว่าหนึ่งรายการในชุดที่เลือก' : error}</div> : null}
        </div>
      ) : null}
    </section>
  )
}
