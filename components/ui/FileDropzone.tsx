'use client'

import { useId, useRef, useState } from 'react'
import { Icon } from './Icon'

interface FileDropzoneProps {
  onFiles: (files: File[]) => void
  accept?: string
  multiple?: boolean
  title: string
  hint?: string
  disabled?: boolean
}

/** ช่องเลือกไฟล์ที่รองรับทั้งการคลิกและลากไฟล์มาวาง */
export function FileDropzone({ onFiles, accept, multiple = false, title, hint, disabled = false }: FileDropzoneProps) {
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
        .file-dropzone{display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;min-height:116px;padding:22px 16px;border:2px dashed var(--border);border-radius:12px;background:var(--surface-2);color:var(--ink);font:inherit;text-align:center;cursor:pointer;transition:border-color .15s ease,background .15s ease,box-shadow .15s ease;box-sizing:border-box}
        .file-dropzone:hover:not(:disabled){border-color:color-mix(in srgb,var(--primary) 48%,var(--border));background:color-mix(in srgb,var(--primary-soft) 45%,var(--surface-2))}
        .file-dropzone:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}
        .file-dropzone:disabled{cursor:not-allowed;opacity:.55}
        .file-dropzone[data-dragging="true"]{border-color:var(--primary);background:var(--primary-soft);box-shadow:0 0 0 4px color-mix(in srgb,var(--primary) 12%,transparent)}
        @media(prefers-reduced-motion:reduce){.file-dropzone{transition:none}}
      `}</style>
      <button
        type="button"
        className="file-dropzone"
        data-dragging={dragging}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true) }}
        onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (!disabled) emit(event.dataTransfer.files)
        }}
      >
        <Icon name="upload" size={25} />
        <span style={{ fontWeight: 700, fontSize: 13 }}>
          {dragging ? 'วางไฟล์ที่นี่' : title}
        </span>
        {hint && <span id={hintId} style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>{hint}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(event) => { emit(event.target.files); event.target.value = '' }}
      />
    </>
  )
}
