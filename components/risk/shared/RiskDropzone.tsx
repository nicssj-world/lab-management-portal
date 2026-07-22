'use client'

import { useId, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { FONT } from './tokens'

interface RiskDropzoneProps {
  onFiles: (files: File[]) => void
  accept?: string
  multiple?: boolean
  title: string
  hint?: string
  detail?: string
  disabled?: boolean
}

/**
 * ช่องอัปโหลดที่รองรับทั้งลากวางและคีย์บอร์ด ใช้ร่วมกันทั้ง import และไฟล์แนบ
 *
 * ตัวเดิมใน RiskClient เป็น <div onClick> ล้วน จึงกด Tab/Enter ไม่ได้เลย
 * ที่นี่ใช้ <button> จริงเพื่อให้ได้ทั้ง focus ring, Enter/Space และ role ที่ถูกต้องฟรี
 */
export function RiskDropzone({ onFiles, accept, multiple = false, title, hint, detail, disabled = false }: RiskDropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()

  function emit(list: FileList | null) {
    const files = Array.from(list ?? [])
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1))
  }

  return (
    <>
      <style>{`
        .risk-dropzone{display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;padding:26px 16px;border:2px dashed var(--border);border-radius:12px;background:var(--surface-2);color:var(--ink);font:inherit;text-align:center;cursor:pointer;transition:border-color .15s ease,background .15s ease,box-shadow .15s ease}
        .risk-dropzone:hover:not(:disabled){border-color:color-mix(in srgb,var(--primary) 45%,var(--border))}
        .risk-dropzone:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}
        .risk-dropzone:disabled{cursor:not-allowed;opacity:.55}
        .risk-dropzone[data-dragging="true"]{border-color:var(--primary);background:var(--primary-soft)}
        @media(prefers-reduced-motion:reduce){.risk-dropzone{transition:none}}
      `}</style>
      <button
        type="button"
        className="risk-dropzone"
        data-dragging={dragging}
        disabled={disabled}
        aria-describedby={hint || detail ? hintId : undefined}
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
        <span style={{ fontWeight: 600, fontSize: FONT.md }}>
          {dragging ? 'วางไฟล์ที่นี่' : title}
        </span>
        {(hint || detail) && (
          <span id={hintId} style={{ display: 'block', color: 'var(--muted)', fontSize: FONT.sm, lineHeight: 1.5 }}>
            {hint}
            {detail && <><br />{detail}</>}
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => { emit(e.target.files); e.target.value = '' }}
      />
    </>
  )
}
