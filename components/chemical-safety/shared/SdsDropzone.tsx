'use client'

import { useId, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { FONT } from './tokens'

/**
 * ช่องอัปโหลดไฟล์ SDS — รองรับทั้งลากวางและคีย์บอร์ด
 * ใช้ <button> จริงเพื่อให้ได้ focus ring, Enter/Space และ role ที่ถูกต้องโดยไม่ต้องเขียนเอง
 */
export function SdsDropzone({
  onFile,
  disabled = false,
  hint,
}: {
  onFile: (file: File) => void
  disabled?: boolean
  hint?: string
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()

  function emit(list: FileList | null) {
    const file = Array.from(list ?? [])[0]
    if (file) onFile(file)
  }

  return (
    <>
      <style>{`
        .sds-dropzone{display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;padding:24px 16px;border:2px dashed var(--border);border-radius:12px;background:var(--surface-2);color:var(--ink);font:inherit;text-align:center;cursor:pointer;transition:border-color .15s ease,background .15s ease}
        .sds-dropzone:hover:not(:disabled){border-color:color-mix(in srgb,var(--primary) 45%,var(--border))}
        .sds-dropzone:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}
        .sds-dropzone:disabled{cursor:not-allowed;opacity:.55}
        .sds-dropzone[data-dragging="true"]{border-color:var(--primary);background:var(--primary-soft)}
        @media(prefers-reduced-motion:reduce){.sds-dropzone{transition:none}}
      `}</style>
      <button
        type="button"
        className="sds-dropzone"
        data-dragging={dragging}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
        onDragEnter={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!disabled) emit(e.dataTransfer.files)
        }}
      >
        <Icon name="upload" size={24} />
        <span style={{ fontWeight: 600, fontSize: FONT.md }}>ลากไฟล์ PDF มาวาง หรือคลิกเพื่อเลือก</span>
        {hint && <span id={hintId} style={{ fontSize: FONT.sm, color: 'var(--muted)' }}>{hint}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => { emit(e.target.files); e.target.value = '' }}
      />
    </>
  )
}
