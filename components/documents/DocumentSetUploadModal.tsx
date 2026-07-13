'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import type { Document } from '@/lib/supabase/types'
import { DocumentSetUploadPhases } from './DocumentSetUploadPhases'
import { MAX_FILES } from './document-set-upload-model'
import { useDocumentSetUpload } from './useDocumentSetUpload'

interface Props {
  mainDoc: Document
  onClose: () => void
  onDone: () => void
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function useModalFocusLifecycle(
  dialogRef: React.RefObject<HTMLDivElement | null>,
  initialFocusRef: React.RefObject<HTMLButtonElement | null>,
  submitting: boolean,
  onRequestClose: () => void,
) {
  const submittingRef = useRef(submitting)
  const closeRef = useRef(onRequestClose)
  submittingRef.current = submitting
  closeRef.current = onRequestClose

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    initialFocusRef.current?.focus()

    function onDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (submittingRef.current) return
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onDocumentKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onDocumentKeyDown, true)
      previousFocus?.focus()
    }
  }, [dialogRef, initialFocusRef])
}

export function DocumentSetUploadModal({ mainDoc, onClose, onDone }: Props) {
  const controller = useDocumentSetUpload(mainDoc, onDone)
  const dialogRef = useRef<HTMLDivElement>(null)
  const initialFocusRef = useRef<HTMLButtonElement>(null)

  function handleClose() {
    if (controller.submitting) return
    if (controller.phase === 'results') onDone()
    else onClose()
  }

  useModalFocusLifecycle(dialogRef, initialFocusRef, controller.submitting, handleClose)

  return (
    <div
      className="modal-scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose()
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, padding: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.5)',
      }}
    >
      <div
        ref={dialogRef}
        className="modal-panel-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-set-title"
        tabIndex={-1}
        style={{
          width: '100%', maxWidth: 900, maxHeight: '92vh', overflow: 'hidden', display: 'flex',
          flexDirection: 'column', background: 'var(--card)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.25)',
        }}
      >
        <header style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h2 id="document-set-title" style={{ margin: 0, color: 'var(--ink)', fontSize: 15, fontWeight: 700 }}>ลงทะเบียนไฟล์ในชุดเอกสาร</h2>
            <div style={{ marginTop: 3, color: 'var(--muted)', fontSize: 11.5 }}>
              เอกสารหลัก: <span style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{mainDoc.document_code}</span> · {mainDoc.title}
            </div>
          </div>
          <button
            ref={initialFocusRef}
            type="button"
            aria-label={controller.phase === 'results' ? 'ปิดผลการลงทะเบียน' : 'ยกเลิกและปิดหน้าต่าง'}
            onClick={handleClose}
            disabled={controller.submitting}
            style={{ padding: 5, border: 0, background: 'none', color: 'var(--muted)', cursor: controller.submitting ? 'not-allowed' : 'pointer', opacity: controller.submitting ? .45 : 1 }}
          >
            <Icon name="x" size={17} />
          </button>
        </header>

        <div style={{ padding: 22, overflowY: 'auto' }}>
          <DocumentSetUploadPhases mainDoc={mainDoc} controller={controller} />
        </div>

        <footer style={{ padding: '13px 22px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ color: 'var(--muted)', fontSize: 11 }}>
            {controller.phase === 'intake' ? `${controller.entries.length}/${MAX_FILES} ไฟล์` : controller.phase === 'results' ? `สำเร็จ ${controller.successfulCount} · ไม่สำเร็จ ${controller.failedCount}` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {controller.phase === 'intake' ? (
              <>
                <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
                <Button variant="primary" onClick={controller.showConfirm} disabled={!controller.canConfirm}>ตรวจสอบและยืนยัน</Button>
              </>
            ) : null}
            {controller.phase === 'confirm' ? (
              <>
                <Button variant="secondary" onClick={controller.showIntake}>ย้อนกลับ</Button>
                <Button variant="primary" onClick={controller.submitAll}>ยืนยันและเริ่มอัปโหลด</Button>
              </>
            ) : null}
            {controller.phase === 'submitting' ? <Button variant="secondary" disabled>กำลังดำเนินการ…</Button> : null}
            {controller.phase === 'results' ? (
              <>
                {controller.failedCount > 0 ? <Button variant="secondary" onClick={controller.retryFailed}>ลองใหม่เฉพาะรายการไม่สำเร็จ</Button> : null}
                <Button variant="primary" onClick={onDone}>ปิด</Button>
              </>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  )
}
