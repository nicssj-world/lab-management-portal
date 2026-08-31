'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import {
  GHS_H_STATEMENT_OPTIONS,
  GHS_HAZARD_CLASS_OPTIONS,
  GHS_P_STATEMENT_OPTIONS,
  findGhsHazardClassOption,
  findGhsStatementOption,
} from '@/lib/chemical-safety/ghs-catalog'
import type { ChemicalSdsDTO, GhsPictogramCode } from '@/lib/chemical-safety/types'
import { GhsPictogram } from './GhsPictogram'
import { SdsPdfViewerModal } from './SdsPdfViewerModal'
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
  embedded = false,
  onClose,
  onSaved,
}: {
  sds: ChemicalSdsDTO
  productName: string
  seed?: SdsEditorSeed
  /** ใช้ฝังฟอร์มไว้ใน ChemicalDetailsModal โดยไม่สร้าง overlay ซ้อน */
  embedded?: boolean
  onClose: () => void
  onSaved: (message: string, ok?: boolean) => void
}) {
  // เอกสารที่นำเข้ามายังไม่มีใครกรอก GHS จึงเติมค่าจากบัญชีรายการสารเคมีไว้ให้ก่อน
  // ผู้บันทึกแค่ยืนยันหรือแก้ ไม่ต้องกรอกใหม่ทั้งหมด
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
  const [previewOpen, setPreviewOpen] = useState(false)
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
      onSaved('แนบไฟล์ SDS แล้ว · พร้อมใช้งาน')
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
      if (payload.updatedAt) setUpdatedAt(payload.updatedAt)
      onSaved(hasFile ? 'บันทึกข้อมูล SDS แล้ว · พร้อมใช้งาน' : 'บันทึกข้อมูล SDS แล้ว · รอแนบไฟล์ PDF')
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div
        role={embedded ? undefined : 'dialog'}
        aria-modal={embedded ? undefined : 'true'}
        aria-label={embedded ? undefined : `แก้ไขเอกสาร SDS ของ ${productName}`}
        style={embedded
          ? { width: '100%' }
          : {
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}
      >
      <div style={embedded
        ? { width: '100%', background: 'transparent', borderRadius: 0, maxWidth: 'none', maxHeight: 'none', overflow: 'visible', boxShadow: 'none' }
        : {
            background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 780,
            maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)',
          }}>
        {!embedded && (
          <header style={{
            padding: SPACE.md, borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACE.sm,
          }}>
            <div>
              <div style={{ fontSize: FONT.xs, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--primary)' }}>
                แก้ไขเอกสาร SDS
              </div>
              <h2 style={{ margin: '4px 0 0', fontSize: FONT.xl, color: 'var(--ink)' }}>{productName}</h2>
            </div>
            <Button variant="ghost" icon="x" onClick={onClose} title="ปิด" />
          </header>
        )}

        <div style={{ padding: SPACE.md, display: 'grid', gap: SPACE.md }}>
          <div
            role="note"
            style={{ padding: `${SPACE.sm}px ${SPACE.md}px`, border: '1px solid color-mix(in srgb,var(--primary) 25%,var(--border))', borderRadius: 10, background: 'var(--primary-soft)', color: 'var(--ink)', fontSize: FONT.sm, lineHeight: 1.55 }}
          >
            <strong>ข้อมูลของเอกสาร SDS ฉบับนี้</strong>
            <div style={{ marginTop: 3, color: 'var(--muted)' }}>
              แนบไฟล์ PDF และกรอกข้อมูลให้ตรงกับ SDS ฉบับนี้โดยตรง หากต้องการแก้ชื่อสารหรือข้อมูลพื้นฐานของทะเบียน ให้ปิดหน้าต่างนี้แล้วเลือก “ข้อมูลสารในทะเบียน”
            </div>
          </div>

          <section>
            <h3 style={sectionStyle}>ไฟล์เอกสาร SDS</h3>
            {hasFile && (
              <>
                <style>{`
                  .sds-current-file-card{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:${SPACE.sm}px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--primary) 28%,var(--border));border-radius:12px;background:var(--primary-soft)}
                  .sds-current-file-action{display:inline-flex;align-items:center;justify-content:center;gap:8px;flex:0 0 auto;min-height:42px;padding:10px 14px;border:0;border-radius:9px;background:var(--primary);color:#fff;font:inherit;font-size:13px;font-weight:800;letter-spacing:.01em;text-decoration:none;cursor:pointer;box-shadow:0 6px 14px color-mix(in srgb,var(--primary) 22%,transparent);transition:transform .15s ease,filter .15s ease,box-shadow .15s ease}
                  .sds-current-file-action:hover{filter:brightness(.95);transform:translateY(-1px);box-shadow:0 8px 18px color-mix(in srgb,var(--primary) 28%,transparent)}
                  .sds-current-file-action:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 35%,transparent);outline-offset:2px}
                  @media(max-width:560px){.sds-current-file-card{align-items:stretch;flex-direction:column}.sds-current-file-action{width:100%;box-sizing:border-box}}
                  @media(prefers-reduced-motion:reduce){.sds-current-file-action{transition:none}}
                `}</style>
                <div className="sds-current-file-card">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, flexWrap: 'wrap' }}>
                      <Badge color="green"><Icon name="check" size={11} />แนบไฟล์แล้ว</Badge>
                      <span style={{ fontSize: FONT.sm, color: 'var(--ink)', fontWeight: 700 }}>ไฟล์ SDS ที่ใช้งานอยู่</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: FONT.xs, color: 'var(--muted)' }}>เปิดดูไฟล์ PDF ที่แนบอยู่ในระบบ</div>
                  </div>
                  <button
                    className="sds-current-file-action"
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    title="เปิดไฟล์ปัจจุบัน"
                    aria-label={`เปิดไฟล์ปัจจุบันของ ${productName}`}
                  >
                    <Icon name="eye" size={17} />
                    <span>เปิดไฟล์ปัจจุบัน</span>
                    <Icon name="arrowRight" size={15} />
                  </button>
                </div>
              </>
            )}
            {!hasFile && (
              <div style={{ marginBottom: SPACE.sm, padding: `${SPACE.xs}px ${SPACE.sm}px`, borderRadius: 8, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: FONT.sm }}>
                <strong style={{ color: 'var(--ink)' }}>ยังไม่มีไฟล์ PDF · SDS ยังไม่พร้อมใช้งาน</strong>
                <div style={{ marginTop: 2 }}>แนบไฟล์ SDS ทางการก่อน เพื่อให้ระบบเผยแพร่เอกสารนี้</div>
              </div>
            )}
            <SdsDropzone
              onFile={upload}
              disabled={busy !== null}
              hint="รับเฉพาะไฟล์ PDF ขนาดไม่เกิน 50 MB · แนบไฟล์สำเร็จแล้วระบบจะเผยแพร่ SDS ให้พร้อมใช้งานทันที · หากอัปโหลดใหม่ ไฟล์เดิมจะถูกแทนที่"
            />
          </section>

          <section>
            <h3 style={sectionStyle}>ข้อมูลจากเอกสาร SDS ฉบับนี้</h3>
            <div style={gridStyle}>
              <Field label="ผู้ผลิตตาม SDS" value={manufacturer} onChange={setManufacturer} />
              <Field label="ผู้จำหน่ายตาม SDS" value={supplier} onChange={setSupplier} />
              <Field label="รหัสผลิตภัณฑ์ตาม SDS" value={productCode} onChange={setProductCode} />
              <Field label="ความเข้มข้นตาม SDS" value={concentration} onChange={setConcentration} />
              <Field label="ภาษาเอกสาร" value={language} onChange={setLanguage} />
              <Field label="เลขฉบับ (Revision)" value={revisionLabel} onChange={setRevisionLabel} placeholder="เช่น Rev. 03" />
              <Field label="วันที่มีผล" value={effectiveOn} onChange={setEffectiveOn} type="date" />
              <Field label="กำหนดทบทวนครั้งถัดไป" value={reviewDueOn} onChange={setReviewDueOn} type="date" />
            </div>
          </section>

          <section>
            <h3 style={sectionStyle}>GHS ตาม SDS หมวด 2</h3>
            <p style={{ margin: `0 0 ${SPACE.sm}px`, fontSize: FONT.sm, color: 'var(--muted)', lineHeight: 1.55 }}>
              ข้อมูลนี้เป็นข้อมูลของเอกสาร SDS ฉบับนี้โดยตรง ระบบอาจเติมข้อมูลเบื้องต้นจากทะเบียนให้ แต่ต้องตรวจสอบและแก้ให้ตรงกับ SDS หมวด 2 ก่อนบันทึก
              หากต้องการแก้ GHS เบื้องต้นของทะเบียน ให้ใช้ “ข้อมูลสารในทะเบียน”
            </p>
            <p style={{ margin: `0 0 ${SPACE.sm}px`, padding: `${SPACE.xs}px ${SPACE.sm}px`, borderRadius: 8, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: FONT.xs, lineHeight: 1.5 }}>
              เลือกรหัสหรือประเภทจาก dropdown เพื่อเติมข้อความตั้งต้นได้ทันที หรือเลือก “อื่น ๆ / กรอกเอง” หากไม่พบรายการ
              ข้อความตั้งต้นเป็นเพียงตัวช่วย ต้องตรวจทานให้ตรงกับ SDS ฉบับจริงก่อนบันทึก
            </p>
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

            <HazardRowEditor
              title="ประเภทและหมวดความเป็นอันตราย (SDS หมวด 2)"
              rows={hazards}
              onChange={setHazards}
              blank={{ className: '', category: '' }}
              invalid={hazardsMissing}
              invalidHint="ต้องระบุอย่างน้อย 1 รายการเมื่อมีสัญลักษณ์หรือรหัส H/P"
            />

            <StatementRowEditor
              title="ข้อความแสดงความเป็นอันตราย (รหัส H)"
              kind="H"
              rows={hStatements}
              onChange={setHStatements}
              blank={{ code: '', text: '' }}
            />

            <StatementRowEditor
              title="ข้อควรปฏิบัติเพื่อความปลอดภัย (รหัส P)"
              kind="P"
              rows={pStatements}
              onChange={setPStatements}
              blank={{ code: '', text: '' }}
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
            {busy === 'save' ? 'กำลังบันทึก…' : 'บันทึกเอกสาร SDS'}
          </Button>
        </footer>
        </div>
      </div>
      {previewOpen && (
        <SdsPdfViewerModal
          url={`/api/admin/chemical-safety/sds/${sds.id}/file`}
          title={productName}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  )
}

const sectionStyle: CSSProperties = {
  margin: `0 0 ${SPACE.xs}px`, fontSize: FONT.lg, fontWeight: 800, color: 'var(--ink)',
}
const gridStyle: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: SPACE.sm,
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={labelStyle}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
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

const CUSTOM_OPTION = '__custom__'

function remapIndexes(indexes: Set<number>, removedIndex: number): Set<number> {
  return new Set(
    [...indexes]
      .filter(index => index !== removedIndex)
      .map(index => index > removedIndex ? index - 1 : index),
  )
}

function FieldsetShell({
  title, children, invalid, invalidHint, empty,
}: {
  title: string
  children: ReactNode
  invalid?: boolean
  invalidHint?: string
  empty: boolean
}) {
  return (
    <fieldset style={{
      border: `1px solid ${invalid ? 'var(--danger)' : 'var(--border)'}`,
      borderRadius: 10, padding: SPACE.sm, margin: `${SPACE.sm}px 0 0`,
    }}>
      <legend style={{ ...labelStyle, marginBottom: 0, padding: '0 6px' }}>{title}</legend>
      {empty && (
        <p style={{ margin: `0 0 ${SPACE.xs}px`, fontSize: FONT.sm, color: invalid ? 'var(--danger)' : 'var(--muted)' }}>
          {invalid && invalidHint ? invalidHint : 'ยังไม่มีรายการ'}
        </p>
      )}
      {children}
    </fieldset>
  )
}

function selectStyle(): CSSProperties {
  return { ...inputStyle, minHeight: 44 }
}

function HazardRowEditor({
  title, rows, onChange, blank, invalid, invalidHint,
}: {
  title: string
  rows: HazardDraft[]
  onChange: (rows: HazardDraft[]) => void
  blank: HazardDraft
  invalid?: boolean
  invalidHint?: string
}) {
  const [customClassRows, setCustomClassRows] = useState<Set<number>>(
    () => new Set(rows.map((row, index) => row.className && !findGhsHazardClassOption(row.className) ? index : -1).filter(index => index >= 0)),
  )
  const [customCategoryRows, setCustomCategoryRows] = useState<Set<number>>(
    () => new Set(rows.map((row, index) => {
      const option = findGhsHazardClassOption(row.className)
      return row.category && (!option || !option.categories.includes(row.category)) ? index : -1
    }).filter(index => index >= 0)),
  )

  function updateRow(index: number, patch: Partial<HazardDraft>) {
    const next = [...rows]
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, position) => position !== index))
    setCustomClassRows(current => remapIndexes(current, index))
    setCustomCategoryRows(current => remapIndexes(current, index))
  }

  return (
    <FieldsetShell title={title} invalid={invalid} invalidHint={invalidHint} empty={rows.length === 0}>
      <div style={{ display: 'grid', gap: SPACE.xs }}>
        {rows.map((row, index) => {
          const selectedClass = findGhsHazardClassOption(row.className)
          const categories = selectedClass?.categories ?? []
          const classIsCustom = customClassRows.has(index)
          const categoryIsCustom = customCategoryRows.has(index)
          const classValue = classIsCustom
            ? CUSTOM_OPTION
            : selectedClass
              ? selectedClass.className
              : row.className ? CUSTOM_OPTION : ''
          const categoryValue = categoryIsCustom
            ? CUSTOM_OPTION
            : categories.includes(row.category)
              ? row.category
              : row.category ? CUSTOM_OPTION : ''

          return (
            <div key={index} style={{ display: 'flex', gap: SPACE.xs, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label style={{ flex: '1 1 260px', minWidth: 220 }}>
                <span style={labelStyle}>ประเภท</span>
                <select
                  value={classValue}
                  onChange={(event) => {
                    const value = event.target.value
                    if (value === CUSTOM_OPTION) {
                      setCustomClassRows(current => new Set(current).add(index))
                      setCustomCategoryRows(current => { const next = new Set(current); next.delete(index); return next })
                      updateRow(index, { className: classIsCustom ? row.className : '', category: '' })
                      return
                    }
                    const option = GHS_HAZARD_CLASS_OPTIONS.find(item => item.className === value)
                    setCustomClassRows(current => { const next = new Set(current); next.delete(index); return next })
                    setCustomCategoryRows(current => { const next = new Set(current); next.delete(index); return next })
                    updateRow(index, {
                      className: value,
                      category: option?.categories.includes(row.category) ? row.category : '',
                    })
                  }}
                  aria-label={`${title} ประเภทรายการที่ ${index + 1}`}
                  style={selectStyle()}
                >
                  <option value="">เลือกประเภท…</option>
                  {GHS_HAZARD_CLASS_OPTIONS.map(option => (
                    <option key={option.className} value={option.className}>{option.label}</option>
                  ))}
                  <option value={CUSTOM_OPTION}>อื่น ๆ / กรอกประเภทเอง</option>
                </select>
              </label>

              {classIsCustom && (
                <label style={{ flex: '1 1 220px', minWidth: 200 }}>
                  <span style={labelStyle}>ประเภทที่ระบุเอง</span>
                  <input
                    value={row.className}
                    placeholder="เช่น Acute toxicity — low"
                    onChange={(event) => updateRow(index, { className: event.target.value })}
                    style={{ ...inputStyle, minHeight: 44 }}
                  />
                </label>
              )}

              <label style={{ flex: '1 1 220px', minWidth: 200 }}>
                <span style={labelStyle}>หมวด</span>
                <select
                  value={categoryValue}
                  onChange={(event) => {
                    const value = event.target.value
                    if (value === CUSTOM_OPTION) {
                      setCustomCategoryRows(current => new Set(current).add(index))
                      updateRow(index, { category: categoryIsCustom ? row.category : '' })
                      return
                    }
                    setCustomCategoryRows(current => { const next = new Set(current); next.delete(index); return next })
                    updateRow(index, { category: value })
                  }}
                  aria-label={`${title} หมวดรายการที่ ${index + 1}`}
                  style={selectStyle()}
                >
                  <option value="">เลือกหมวด…</option>
                  {categories.map(category => <option key={category} value={category}>{category}</option>)}
                  <option value={CUSTOM_OPTION}>อื่น ๆ / กรอกหมวดเอง</option>
                </select>
              </label>

              {categoryIsCustom && (
                <label style={{ flex: '1 1 180px', minWidth: 170 }}>
                  <span style={labelStyle}>หมวดที่ระบุเอง</span>
                  <input
                    value={row.category}
                    placeholder="เช่น Category 2"
                    onChange={(event) => updateRow(index, { category: event.target.value })}
                    style={{ ...inputStyle, minHeight: 44 }}
                  />
                </label>
              )}

              <Button
                variant="ghost"
                icon="trash"
                size="lg"
                title="ลบรายการนี้"
                onClick={() => removeRow(index)}
              />
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: SPACE.xs }}>
        <Button variant="soft" icon="plus" onClick={() => onChange([...rows, { ...blank }])}>เพิ่มรายการ</Button>
      </div>
    </FieldsetShell>
  )
}

function StatementRowEditor({
  title, kind, rows, onChange, blank,
}: {
  title: string
  kind: 'H' | 'P'
  rows: StatementDraft[]
  onChange: (rows: StatementDraft[]) => void
  blank: StatementDraft
}) {
  const options = kind === 'H' ? GHS_H_STATEMENT_OPTIONS : GHS_P_STATEMENT_OPTIONS
  const [customCodeRows, setCustomCodeRows] = useState<Set<number>>(
    () => new Set(rows.map((row, index) => row.code && !findGhsStatementOption(options, row.code) ? index : -1).filter(index => index >= 0)),
  )

  function updateRow(index: number, patch: Partial<StatementDraft>) {
    const next = [...rows]
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, position) => position !== index))
    setCustomCodeRows(current => remapIndexes(current, index))
  }

  return (
    <FieldsetShell title={title} empty={rows.length === 0}>
      <div style={{ display: 'grid', gap: SPACE.xs }}>
        {rows.map((row, index) => {
          const selected = findGhsStatementOption(options, row.code)
          const isCustom = customCodeRows.has(index)
          const codeValue = isCustom ? CUSTOM_OPTION : selected ? selected.code : row.code ? CUSTOM_OPTION : ''

          return (
            <div key={index} style={{ display: 'flex', gap: SPACE.xs, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label style={{ flex: '0 1 280px', minWidth: 220 }}>
                <span style={labelStyle}>รหัส</span>
                <select
                  value={codeValue}
                  onChange={(event) => {
                    const value = event.target.value
                    if (value === CUSTOM_OPTION) {
                      setCustomCodeRows(current => new Set(current).add(index))
                      updateRow(index, { code: isCustom ? row.code : '', text: isCustom ? row.text : '' })
                      return
                    }
                    setCustomCodeRows(current => { const next = new Set(current); next.delete(index); return next })
                    const option = findGhsStatementOption(options, value)
                    updateRow(index, { code: value, text: option?.text ?? '' })
                  }}
                  aria-label={`${title} รหัสรายการที่ ${index + 1}`}
                  style={selectStyle()}
                >
                  <option value="">เลือกรหัส…</option>
                  {options.map(option => (
                    <option key={option.code} value={option.code}>{option.code} — {option.text}</option>
                  ))}
                  <option value={CUSTOM_OPTION}>อื่น ๆ / กรอกรหัสเอง</option>
                </select>
              </label>

              {isCustom && (
                <label style={{ flex: '0 1 180px', minWidth: 160 }}>
                  <span style={labelStyle}>รหัสที่ระบุเอง</span>
                  <input
                    value={row.code}
                    placeholder={kind === 'H' ? 'เช่น H360FD' : 'เช่น P305+P351+P338'}
                    onChange={(event) => updateRow(index, { code: event.target.value.toUpperCase().replace(/\s+/g, '') })}
                    style={{ ...inputStyle, minHeight: 44 }}
                  />
                </label>
              )}

              <label style={{ flex: '1 1 320px', minWidth: 240 }}>
                <span style={labelStyle}>ข้อความ <span style={{ fontWeight: 400 }}>แก้ไขให้ตรงกับ SDS ได้</span></span>
                <input
                  value={row.text}
                  placeholder="ระบบเติมข้อความตั้งต้นเมื่อเลือกรหัส"
                  onChange={(event) => updateRow(index, { text: event.target.value })}
                  aria-label={`${title} ข้อความรายการที่ ${index + 1}`}
                  style={{ ...inputStyle, minHeight: 44 }}
                />
              </label>

              <Button
                variant="ghost"
                icon="trash"
                size="lg"
                title="ลบรายการนี้"
                onClick={() => removeRow(index)}
              />
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: SPACE.xs }}>
        <Button variant="soft" icon="plus" onClick={() => onChange([...rows, { ...blank }])}>เพิ่มรายการ</Button>
      </div>
    </FieldsetShell>
  )
}
