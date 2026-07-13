'use client'

import { Icon } from '@/components/ui/Icon'
import type { Document } from '@/lib/supabase/types'
import { DocumentSetUploadRow } from './DocumentSetUploadRow'
import { MAX_FILES, entryLabel, fileSizeLabel } from './document-set-upload-model'
import type { DocumentSetUploadController } from './useDocumentSetUpload'

interface Props {
  mainDoc: Document
  controller: DocumentSetUploadController
}

export function DocumentSetUploadPhases({ mainDoc, controller }: Props) {
  if (controller.phase === 'intake') return <IntakePhase mainDoc={mainDoc} controller={controller} />
  if (controller.phase === 'confirm') return <ConfirmPhase controller={controller} />
  if (controller.phase === 'submitting') return <SubmittingPhase controller={controller} />
  return <ResultsPhase controller={controller} />
}

function IntakePhase({ mainDoc, controller }: Props) {
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="เลือกไฟล์หลายไฟล์หรือลากไฟล์มาวาง"
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          controller.inputRef.current?.click()
        }}
        onClick={() => controller.inputRef.current?.click()}
        onDragEnter={(event) => { event.preventDefault(); controller.dragEnter() }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { event.preventDefault(); controller.dragLeave() }}
        onDrop={(event) => {
          event.preventDefault()
          controller.resetDrag()
          controller.addFiles(Array.from(event.dataTransfer.files))
        }}
        style={{
          padding: '19px 20px', textAlign: 'center', cursor: 'pointer', borderRadius: 10,
          border: `2px dashed ${controller.dragOver ? 'var(--primary)' : 'var(--border)'}`,
          background: controller.dragOver ? 'var(--primary-soft)' : 'var(--surface-2)',
          transition: 'border-color .12s, background .12s',
        }}
      >
        <input
          ref={controller.inputRef}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            controller.addFiles(Array.from(event.target.files ?? []))
            event.target.value = ''
          }}
        />
        <Icon name="upload" size={21} style={{ color: controller.dragOver ? 'var(--primary)' : 'var(--muted)' }} />
        <div style={{ marginTop: 5, color: 'var(--ink)', fontSize: 13, fontWeight: 600 }}>{controller.dragOver ? 'ปล่อยไฟล์ที่นี่' : 'เลือกหลายไฟล์ หรือลากไฟล์มาวาง'}</div>
        <div style={{ marginTop: 2, color: 'var(--muted)', fontSize: 11 }}>ชื่อขึ้นต้น Fm-, FR-, Rf-, Cf- จะถูกจัดเป็นเอกสารลงทะเบียนอัตโนมัติ · สูงสุด {MAX_FILES} ไฟล์</div>
      </div>

      {controller.message ? <div role="alert" style={{ marginTop: 12, padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(217,119,6,.25)', background: 'rgba(217,119,6,.08)', color: 'var(--warning)', fontSize: 12 }}>{controller.message}</div> : null}

      {controller.entries.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 9, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ color: 'var(--ink)', fontSize: 12.5, fontWeight: 700 }}>ไฟล์ที่เลือก ({controller.entries.length})</div>
            <div style={{ color: 'var(--muted)', fontSize: 11.5 }}>ลงทะเบียน {controller.registrationCount} · เอกสารแนบ {controller.attachmentCount}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {controller.entries.map((entry, index) => (
              <DocumentSetUploadRow
                key={entry.id}
                entry={entry}
                mainDoc={mainDoc}
                error={controller.validationErrors[index] ?? ''}
                repeated={entry.group === 'register' && (controller.duplicateCodeCounts.get(entry.code.trim().toUpperCase()) ?? 0) > 1}
                onRemove={controller.removeEntry}
                onGroupChange={controller.changeGroup}
                onCodeChange={controller.updateCode}
                onTitleChange={controller.updateTitle}
                onTypeChange={controller.updateType}
                onDuplicateChoice={controller.chooseDuplicate}
              />
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}

function ConfirmPhase({ controller }: { controller: DocumentSetUploadController }) {
  return (
    <div>
      <div style={{ padding: '12px 14px', borderRadius: 9, background: 'var(--primary-soft)', color: 'var(--ink)', fontSize: 12.5 }}>
        กรุณาตรวจสอบก่อนเริ่มอัปโหลด การดำเนินการนี้จะลงทะเบียน {controller.registrationCount} รายการ และแนบไฟล์อ้างอิง {controller.attachmentCount} รายการกับเอกสารหลัก
      </div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {controller.entries.map((entry) => {
          const action = entry.group === 'attach'
            ? 'ไฟล์อ้างอิงประกอบการพิจารณา'
            : entry.duplicate.status === 'found'
              ? entry.duplicateChoice === 'link-existing' ? 'ลิงก์เอกสารเดิม' : 'เปิดปรับปรุง Rev+'
              : 'ลงทะเบียนเอกสารใหม่'
          return (
            <div key={entry.id} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: 'var(--ink)', fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entryLabel(entry)}</div>
                <div style={{ marginTop: 2, color: 'var(--muted)', fontSize: 10.8 }}>{entry.group === 'register' ? `${entry.type} · ${entry.department || 'ไม่ระบุหน่วยงาน'}` : fileSizeLabel(entry.file.size)}</div>
              </div>
              <div style={{ flexShrink: 0, padding: '4px 8px', borderRadius: 99, background: entry.group === 'register' ? 'var(--primary-soft)' : 'var(--surface-2)', color: entry.group === 'register' ? 'var(--primary)' : 'var(--muted)', fontSize: 10.8, fontWeight: 600 }}>{action}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SubmittingPhase({ controller }: { controller: DocumentSetUploadController }) {
  return (
    <div aria-live="polite" style={{ padding: '34px 12px', textAlign: 'center' }}>
      <div style={{ color: 'var(--ink)', fontSize: 14, fontWeight: 700 }}>กำลังดำเนินการทีละไฟล์</div>
      <div style={{ marginTop: 5, color: 'var(--muted)', fontSize: 12, wordBreak: 'break-word' }}>{controller.currentLabel || 'กำลังเตรียมรายการ…'}</div>
      <div style={{ maxWidth: 560, margin: '22px auto 0', textAlign: 'left' }}>
        <Progress label="ไฟล์ปัจจุบัน" value={controller.currentProgress} />
        <div style={{ height: 15 }} />
        <Progress label="ทั้งหมด" value={controller.overallProgress} success />
      </div>
      <div style={{ marginTop: 18, color: 'var(--warning)', fontSize: 11.5 }}>กรุณาอย่าปิดหน้าต่างระหว่างอัปโหลดและบันทึกข้อมูล</div>
    </div>
  )
}

function Progress({ label, value, success = false }: { label: string; value: number; success?: boolean }) {
  return (
    <>
      <div style={{ marginBottom: 5, display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 11 }}><span>{label}</span><span>{value}%</span></div>
      <div role="progressbar" aria-label={`ความคืบหน้า${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} style={{ height: 7, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 99, background: success ? 'var(--success)' : 'var(--primary)', transition: 'width .12s' }} />
      </div>
    </>
  )
}

function ResultsPhase({ controller }: { controller: DocumentSetUploadController }) {
  return (
    <div>
      <div aria-live="polite" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ padding: 12, borderRadius: 9, background: 'rgba(22,163,74,.09)', color: 'var(--success)', fontSize: 12.5, fontWeight: 700 }}>สำเร็จ {controller.successfulCount} รายการ</div>
        <div style={{ padding: 12, borderRadius: 9, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', fontSize: 12.5, fontWeight: 700 }}>ไม่สำเร็จ {controller.failedCount} รายการ</div>
      </div>
      <div style={{ marginTop: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {controller.entries.map((entry) => (
          <div key={entry.id} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
            <Icon name={entry.submitStatus === 'success' ? 'check' : 'alert'} size={16} style={{ marginTop: 1, flexShrink: 0, color: entry.submitStatus === 'success' ? 'var(--success)' : 'var(--danger)' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--ink)', fontSize: 12.3, fontWeight: 600, wordBreak: 'break-word' }}>{entryLabel(entry)}</div>
              <div style={{ marginTop: 2, color: entry.submitStatus === 'success' ? 'var(--success)' : 'var(--danger)', fontSize: 11 }}>{entry.submitStatus === 'success' ? 'ดำเนินการสำเร็จ' : entry.resultReason || 'ดำเนินการไม่สำเร็จ'}</div>
            </div>
          </div>
        ))}
      </div>
      {controller.failedCount > 0 ? <div style={{ marginTop: 12, color: 'var(--muted)', fontSize: 11.5 }}>ระบบจะใช้ไฟล์ที่อัปโหลดขึ้น R2 สำเร็จแล้วซ้ำในการลองใหม่ และจะไม่สร้างรายการที่สำเร็จไปแล้วอีกครั้ง</div> : null}
    </div>
  )
}
