'use client'

import { useState, type CSSProperties } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import type { ChemicalSdsDTO, GhsPictogramCode } from '@/lib/chemical-safety/types'
import { GhsPictogram } from './GhsPictogram'
import { SdsDropzone } from './shared/SdsDropzone'
import { FONT, SPACE } from './shared/tokens'

const ALL_PICTOGRAMS: GhsPictogramCode[] = [
  'GHS01', 'GHS02', 'GHS03', 'GHS04', 'GHS05', 'GHS06', 'GHS07', 'GHS08', 'GHS09',
]
const SIGNAL_WORDS = ['', 'Danger', 'Warning', 'อันตราย', 'คำเตือน'] as const

const inputStyle: CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)', fontSize: 13,
  fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)',
  outline: 'none', boxSizing: 'border-box',
}
const labelStyle: CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block',
}

interface StatementDraft { code: string; text: string }
interface HazardDraft { className: string; category: string }

export interface SdsEditorSeed {
  /** สัญลักษณ์ที่แปลจากบัญชีรายการสารเคมี ใช้เติมล่วงหน้าเมื่อฉบับร่างยังว่าง */
  pictogramCodes: GhsPictogramCode[]
  hazardClassesTh: string[]
}

export function SdsEditorModal({
  sds,
  productName,
  seed,
  onClose,
  onSaved,
}: {
  sds: ChemicalSdsDTO
  productName: string
  seed?: SdsEditorSeed
  onClose: () => void
  onSaved: (message: string, ok?: boolean) => void
}) {
  // ฉบับร่างที่นำเข้ามายังไม่มีใครกรอก GHS จึงเติมค่าจากบัญชีรายการสารเคมีไว้ให้ก่อน
  // ผู้ทบทวนแค่ยืนยันหรือแก้ ไม่ต้องกรอกใหม่ทั้งหมด
  const seededPictograms = sds.pictogramCodes.length > 0
    ? sds.pictogramCodes
    : seed?.pictogramCodes ?? []
  const seededHazards: HazardDraft[] = sds.hazards.length > 0
    ? sds.hazards.map(hazard => ({ className: hazard.hazardClass, category: hazard.hazardCategory }))
    : (seed?.hazardClassesTh ?? []).map(className => ({ className, category: 'ตามบัญชีรายการสารเคมี' }))

  const [manufacturer, setManufacturer] = useState(sds.manufacturer ?? '')
  const [supplier, setSupplier] = useState(sds.supplier ?? '')
  const [productCode, setProductCode] = useState(sds.productCode ?? '')
  const [concentration, setConcentration] = useState(sds.concentration ?? '')
  const [language, setLanguage] = useState(sds.language || 'th')
  const [revisionLabel, setRevisionLabel] = useState(sds.revisionLabel ?? '')
  const [effectiveOn, setEffectiveOn] = useState(sds.effectiveOn ?? '')
  const [reviewDueOn, setReviewDueOn] = useState(sds.reviewDueOn ?? '')
  const [signalWord, setSignalWord] = useState(sds.signalWord ?? '')
  const [pictograms, setPictograms] = useState<GhsPictogramCode[]>(seededPictograms)
  const [hazards, setHazards] = useState<HazardDraft[]>(seededHazards)
  const [hStatements, setHStatements] = useState<StatementDraft[]>(sds.hStatements)
  const [pStatements, setPStatements] = useState<StatementDraft[]>(sds.pStatements)
  const [storageInstructions, setStorageInstructions] = useState(sds.storageInstructions ?? '')
  const [incompatibilities, setIncompatibilities] = useState(sds.incompatibilities ?? '')
  const [emergencySummary, setEmergencySummary] = useState(sds.emergencySummary ?? '')

  const [updatedAt, setUpdatedAt] = useState(sds.updatedAt)
  const [hasFile, setHasFile] = useState(Boolean(sds.fileId))
  const [busy, setBusy] = useState<'save' | 'upload' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const structured = pictograms.length > 0 || hStatements.length > 0 || pStatements.length > 0
  const hazardsMissing = structured && hazards.length === 0

  function togglePictogram(code: GhsPictogramCode) {
    setPictograms(current => current.includes(code)
      ? current.filter(item => item !== code)
      : [...current, code].sort())
  }

  async function upload(file: File) {
    setBusy('upload')
    setError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const response = await fetch(`/api/admin/chemical-safety/sds/${sds.id}/upload`, { method: 'POST', body })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'อัปโหลดไม่สำเร็จ')
      setHasFile(true)
      // อัปโหลดแตะ updated_at จึงต้องรับค่าใหม่มา ไม่งั้นการบันทึกถัดไปจะชน optimistic lock
      if (payload.updatedAt) setUpdatedAt(payload.updatedAt)
      onSaved('แนบไฟล์ SDS แล้ว')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'อัปโหลดไม่สำเร็จ')
    } finally {
      setBusy(null)
    }
  }

  async function save() {
    if (hazardsMissing) {
      setError('กรุณาระบุประเภทและหมวดความเป็นอันตรายจาก SDS หมวด 2')
      return
    }
    setBusy('save')
    setError(null)
    try {
      const response = await fetch(`/api/admin/chemical-safety/sds/${sds.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updatedAt,
          manufacturer: manufacturer || null,
          supplier: supplier || null,
          productCode: productCode || null,
          concentration: concentration || null,
          language,
          revisionLabel: revisionLabel || null,
          effectiveOn: effectiveOn || null,
          reviewDueOn: reviewDueOn || null,
          signalWord: signalWord || null,
          pictogramCodes: pictograms,
          hazards,
          hStatements,
          pStatements,
          storageInstructions: storageInstructions || null,
          incompatibilities: incompatibilities || null,
          emergencySummary: emergencySummary || null,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'บันทึกไม่สำเร็จ')
      onSaved('บันทึกข้อมูล SDS แล้ว')
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`แก้ไข SDS ของ ${productName}`}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 780,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)',
      }}>
        <header style={{
          padding: SPACE.md, borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACE.sm,
        }}>
          <div>
            <div style={{ fontSize: FONT.xs, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--primary)' }}>
              แก้ไขฉบับร่าง SDS
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: FONT.xl, color: 'var(--ink)' }}>{productName}</h2>
          </div>
          <Button variant="ghost" icon="x" onClick={onClose} title="ปิด" />
        </header>

        <div style={{ padding: SPACE.md, display: 'grid', gap: SPACE.md }}>
          <section>
            <h3 style={sectionStyle}>ไฟล์เอกสาร</h3>
            {hasFile && (
              <p style={{ margin: `0 0 ${SPACE.xs}px`, fontSize: FONT.base }}>
                <Badge color="green"><Icon name="check" size={11} />แนบไฟล์แล้ว</Badge>{' '}
                <a href={`/api/admin/chemical-safety/sds/${sds.id}/file`} target="_blank" rel="noopener noreferrer">
                  เปิดไฟล์ปัจจุบัน
                </a>
              </p>
            )}
            <SdsDropzone
              onFile={upload}
              disabled={busy !== null}
              hint="รับเฉพาะ PDF ขนาด 1–50 MB · อัปโหลดใหม่จะแทนที่ไฟล์เดิมของฉบับร่างนี้"
            />
          </section>

          <section>
            <h3 style={sectionStyle}>ข้อมูลเอกสาร</h3>
            <div style={gridStyle}>
              <Field label="ผู้ผลิต" value={manufacturer} onChange={setManufacturer} />
              <Field label="ผู้จำหน่าย" value={supplier} onChange={setSupplier} />
              <Field label="รหัสผลิตภัณฑ์" value={productCode} onChange={setProductCode} />
              <Field label="ความเข้มข้น" value={concentration} onChange={setConcentration} />
              <Field label="ภาษา" value={language} onChange={setLanguage} />
              <Field label="ฉบับที่ / รุ่น" value={revisionLabel} onChange={setRevisionLabel} />
              <Field label="วันที่มีผล" value={effectiveOn} onChange={setEffectiveOn} type="date" />
              <Field label="กำหนดทบทวนครั้งถัดไป" value={reviewDueOn} onChange={setReviewDueOn} type="date" />
            </div>
          </section>

          <section>
            <h3 style={sectionStyle}>การจำแนกตามระบบ GHS</h3>
            <label style={labelStyle} htmlFor="sds-signal-word">คำสัญญาณ</label>
            <select
              id="sds-signal-word"
              value={signalWord}
              onChange={(e) => setSignalWord(e.target.value)}
              style={{ ...inputStyle, maxWidth: 240, minHeight: 44 }}
            >
              {SIGNAL_WORDS.map(word => (
                <option key={word || 'none'} value={word}>{word || 'ไม่ระบุ'}</option>
              ))}
            </select>

            <fieldset style={{ border: 0, padding: 0, margin: `${SPACE.sm}px 0 0` }}>
              <legend style={labelStyle}>สัญลักษณ์ (เลือกได้หลายรายการ)</legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(104px,1fr))', gap: SPACE.xs }}>
                {ALL_PICTOGRAMS.map(code => {
                  const checked = pictograms.includes(code)
                  return (
                    <label
                      key={code}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        minHeight: 44, padding: SPACE.xs, borderRadius: 10, cursor: 'pointer',
                        border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
                        background: checked ? 'var(--primary-soft)' : 'var(--card)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePictogram(code)}
                        style={{ width: 18, height: 18 }}
                      />
                      <GhsPictogram code={code} size={36} />
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <RowEditor
              title="ประเภทและหมวดความเป็นอันตราย (SDS หมวด 2)"
              rows={hazards}
              onChange={setHazards}
              blank={{ className: '', category: '' }}
              fields={[
                { key: 'className', label: 'ประเภท', placeholder: 'เช่น Flammable liquids' },
                { key: 'category', label: 'หมวด', placeholder: 'เช่น Category 2' },
              ]}
              invalid={hazardsMissing}
              invalidHint="ต้องระบุอย่างน้อย 1 รายการเมื่อมีสัญลักษณ์หรือรหัส H/P"
            />

            <RowEditor
              title="ข้อความแสดงความเป็นอันตราย (H)"
              rows={hStatements}
              onChange={setHStatements}
              blank={{ code: '', text: '' }}
              fields={[
                { key: 'code', label: 'รหัส', placeholder: 'H225' },
                { key: 'text', label: 'ข้อความ', placeholder: 'ของเหลวและไอไวไฟสูง' },
              ]}
            />

            <RowEditor
              title="ข้อควรปฏิบัติ (P)"
              rows={pStatements}
              onChange={setPStatements}
              blank={{ code: '', text: '' }}
              fields={[
                { key: 'code', label: 'รหัส', placeholder: 'P210 หรือ P301+P310' },
                { key: 'text', label: 'ข้อความ', placeholder: 'เก็บให้ห่างจากความร้อน' },
              ]}
            />
          </section>

          <section>
            <h3 style={sectionStyle}>การจัดเก็บและเหตุฉุกเฉิน</h3>
            <TextArea label="วิธีจัดเก็บ" value={storageInstructions} onChange={setStorageInstructions} />
            <TextArea label="สารที่เข้ากันไม่ได้" value={incompatibilities} onChange={setIncompatibilities} />
            <TextArea label="สรุปการปฏิบัติเมื่อเกิดเหตุ" value={emergencySummary} onChange={setEmergencySummary} />
          </section>

          {error && (
            <p role="alert" style={{
              margin: 0, padding: SPACE.xs, borderRadius: 8, fontSize: FONT.base,
              background: 'rgba(220,38,38,.10)', color: 'var(--danger)', fontWeight: 600,
            }}>
              <Icon name="alert" size={13} /> {error}
            </p>
          )}
        </div>

        <footer style={{
          padding: SPACE.md, borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: SPACE.xs,
        }}>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={busy !== null}>ยกเลิก</Button>
          <Button icon="check" size="lg" onClick={save} disabled={busy !== null}>
            {busy === 'save' ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </footer>
      </div>
    </div>
  )
}

const sectionStyle: CSSProperties = {
  margin: `0 0 ${SPACE.xs}px`, fontSize: FONT.lg, fontWeight: 800, color: 'var(--ink)',
}
const gridStyle: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: SPACE.sm,
}

function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (value: string) => void; type?: string
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={labelStyle}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, minHeight: 44 }}
      />
    </label>
  )
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={{ display: 'block', marginBottom: SPACE.xs }}>
      <span style={labelStyle}>{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        style={{ ...inputStyle, resize: 'vertical' }}
      />
    </label>
  )
}

function RowEditor<T extends Record<string, string>>({
  title, rows, onChange, blank, fields, invalid, invalidHint,
}: {
  title: string
  rows: T[]
  onChange: (rows: T[]) => void
  blank: T
  fields: Array<{ key: keyof T & string; label: string; placeholder: string }>
  invalid?: boolean
  invalidHint?: string
}) {
  return (
    <fieldset style={{
      border: `1px solid ${invalid ? 'var(--danger)' : 'var(--border)'}`,
      borderRadius: 10, padding: SPACE.sm, margin: `${SPACE.sm}px 0 0`,
    }}>
      <legend style={{ ...labelStyle, marginBottom: 0, padding: '0 6px' }}>{title}</legend>
      {rows.length === 0 && (
        <p style={{ margin: `0 0 ${SPACE.xs}px`, fontSize: FONT.sm, color: invalid ? 'var(--danger)' : 'var(--muted)' }}>
          {invalid && invalidHint ? invalidHint : 'ยังไม่มีรายการ'}
        </p>
      )}
      <div style={{ display: 'grid', gap: SPACE.xs }}>
        {rows.map((row, index) => (
          <div key={index} style={{ display: 'flex', gap: SPACE.xs, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {fields.map((field, fieldIndex) => (
              <label key={field.key} style={{ flex: fieldIndex === 0 ? '0 0 140px' : '1 1 200px' }}>
                <span style={labelStyle}>{field.label}</span>
                <input
                  value={row[field.key]}
                  placeholder={field.placeholder}
                  onChange={(e) => {
                    const next = [...rows]
                    next[index] = { ...row, [field.key]: e.target.value }
                    onChange(next)
                  }}
                  style={{ ...inputStyle, minHeight: 44 }}
                />
              </label>
            ))}
            <Button
              variant="ghost"
              icon="trash"
              size="lg"
              title="ลบรายการนี้"
              onClick={() => onChange(rows.filter((_, position) => position !== index))}
            />
          </div>
        ))}
      </div>
      <div style={{ marginTop: SPACE.xs }}>
        <Button variant="soft" icon="plus" onClick={() => onChange([...rows, { ...blank }])}>เพิ่มรายการ</Button>
      </div>
    </fieldset>
  )
}
