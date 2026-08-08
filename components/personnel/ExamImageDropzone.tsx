'use client'

import { useId, useRef, useState, type ClipboardEvent } from 'react'
import { Icon } from '@/components/ui/Icon'
import type { ExamImageView } from '@/lib/personnel/exam'

const MAX_IMAGES = 4

export function ExamImageDropzone({
  label,
  images,
  pendingCount = 0,
  disabled = false,
  error,
  onFiles,
  onRemove,
  onRetry,
}: {
  label: string
  images: ExamImageView[]
  pendingCount?: number
  disabled?: boolean
  error?: string
  onFiles: (files: File[]) => void
  onRemove: (imageId: string) => void
  onRetry?: () => void
}) {
  const [dragging, setDragging] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const errorId = useId()
  const panelId = useId()
  const count = images.length + pendingCount
  const remaining = Math.max(0, MAX_IMAGES - count)
  const inputDisabled = disabled || remaining === 0

  function emit(files: File[]) {
    if (inputDisabled || files.length === 0) return
    onFiles(files.slice(0, remaining))
  }

  function handlePaste(event: ClipboardEvent<HTMLButtonElement>) {
    if (inputDisabled) return
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
    if (files.length > 0) {
      event.preventDefault()
      emit(files)
    }
  }

  return (
    <div className="exam-image-zone">
      <style>{`
        .exam-image-zone{display:grid;gap:8px}
        .exam-image-add{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;width:100%;padding:0 12px;border:1px solid var(--border);border-radius:9px;background:var(--card);color:var(--primary);font:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:border-color .15s ease,background .15s ease,box-shadow .15s ease}
        .exam-image-add:hover:not(:disabled){border-color:color-mix(in srgb,var(--primary) 48%,var(--border));background:var(--primary-soft)}
        .exam-image-add:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 35%,transparent);outline-offset:2px;box-shadow:0 0 0 1px var(--primary)}
        .exam-image-add:disabled{cursor:not-allowed;opacity:.62;color:var(--muted)}
        .exam-image-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:28px}
        .exam-image-collapse{min-height:36px;padding:0 9px;border:0;border-radius:7px;background:transparent;color:var(--muted);font:inherit;font-size:11px;cursor:pointer}
        .exam-image-collapse:hover{background:var(--surface-2);color:var(--ink)}
        .exam-image-collapse:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 35%,transparent);outline-offset:1px}
        .exam-image-drop{display:flex;flex-direction:column;align-items:center;gap:5px;width:100%;min-height:78px;padding:14px 12px;border:1.5px dashed var(--border);border-radius:10px;background:var(--surface-2);color:var(--ink);font:inherit;text-align:center;cursor:pointer;transition:border-color .15s ease,background .15s ease,box-shadow .15s ease;box-sizing:border-box}
        .exam-image-drop:hover:not(:disabled){border-color:color-mix(in srgb,var(--primary) 48%,var(--border));background:color-mix(in srgb,var(--primary-soft) 55%,var(--surface-2))}
        .exam-image-drop:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 35%,transparent);outline-offset:2px;box-shadow:0 0 0 1px var(--primary)}
        .exam-image-drop:disabled{cursor:not-allowed;opacity:.62}
        .exam-image-drop[data-dragging="true"]{border-color:var(--primary);background:var(--primary-soft);box-shadow:inset 0 0 0 1px var(--primary)}
        .exam-image-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
        .exam-image-tile{position:relative;min-width:0;min-height:72px;display:grid;place-items:center;overflow:hidden;border:1px solid var(--border);border-radius:9px;background:var(--surface-2)}
        .exam-image-tile img{display:block;width:100%;height:84px;object-fit:contain;background:var(--surface-2)}
        .exam-image-remove{position:absolute;top:3px;right:3px;width:44px;height:44px;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--border) 75%,transparent);border-radius:8px;background:color-mix(in srgb,var(--card) 88%,transparent);color:var(--danger);cursor:pointer}
        .exam-image-remove:hover{background:var(--card)}
        .exam-image-remove:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 35%,transparent);outline-offset:1px}
        .exam-image-pending{height:84px;display:grid;place-items:center;padding:6px;color:var(--muted);font-size:11px;text-align:center}
        @media(max-width:520px){.exam-image-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(prefers-reduced-motion:reduce){.exam-image-add,.exam-image-drop{transition:none}}
      `}</style>

      {!expanded && (
        <button
          type="button"
          className="exam-image-add"
          disabled={disabled || remaining === 0}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={`เพิ่ม${label}`}
          onClick={() => setExpanded(true)}
        >
          <Icon name="plus" size={15} />
          <span>เพิ่มรูปภาพ</span>
          <span style={{ color: 'var(--muted)', fontWeight: 600 }}>({count}/{MAX_IMAGES})</span>
        </button>
      )}

      {expanded && (
        <div id={panelId}>
          <div className="exam-image-toolbar">
            <span style={{ color: 'var(--muted)', fontSize: 11.5, fontWeight: 700 }}>{label} · {count}/{MAX_IMAGES}</span>
            <button type="button" className="exam-image-collapse" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(false)}>ซ่อน</button>
          </div>
          <button
            type="button"
            className="exam-image-drop"
            data-dragging={dragging}
            disabled={inputDisabled}
            aria-label={`${label} แนบรูปได้ไม่เกิน ${MAX_IMAGES} รูป`}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if ((event.key === 'Enter' || event.key === ' ') && !inputDisabled) {
                event.preventDefault()
                inputRef.current?.click()
              }
            }}
            onPaste={handlePaste}
            onDragEnter={(event) => { event.preventDefault(); if (!inputDisabled) setDragging(true) }}
            onDragOver={(event) => { event.preventDefault(); if (!inputDisabled) setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              emit(Array.from(event.dataTransfer.files))
            }}
          >
            <Icon name="upload" size={20} />
            <span style={{ fontWeight: 700, fontSize: 12 }}>{label}</span>
            <span id={hintId} style={{ fontSize: 11, color: 'var(--muted)' }}>
              ลากวางหรือวางรูปจาก clipboard · {count}/{MAX_IMAGES}
            </span>
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            tabIndex={-1}
            style={{ display: 'none' }}
            onChange={(event) => {
              emit(Array.from(event.target.files ?? []))
              event.target.value = ''
            }}
          />
        </div>
      )}

      {(images.length > 0 || pendingCount > 0) && (
        <div className="exam-image-grid" aria-label={`${label} ที่แนบแล้ว`}>
          {images.map((image) => (
            <div className="exam-image-tile" key={image.id}>
              {image.url
                ? <img src={image.url} alt={image.alt || 'ภาพประกอบข้อสอบ'} width={image.width} height={image.height} loading="lazy" />
                : <span style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: 8 }}>กำลังเตรียมรูป…</span>}
              {!disabled && <button type="button" className="exam-image-remove" aria-label={`ลบ${label} ${image.alt || 'รูปภาพ'}`} onClick={() => onRemove(image.id)}><Icon name="x" size={16} /></button>}
            </div>
          ))}
          {Array.from({ length: pendingCount }, (_, index) => (
            <div className="exam-image-tile" key={`pending-${index}`} aria-label="กำลังอัปโหลดรูป">
              <div className="exam-image-pending" aria-live="polite">กำลังอัปโหลด…</div>
            </div>
          ))}
        </div>
      )}

      <div id={errorId} aria-live="polite" style={{ minHeight: error ? 18 : 0, color: 'var(--danger)', fontSize: 11.5 }}>
        {error}
        {error && onRetry && !disabled && <button type="button" onClick={onRetry} style={{ marginLeft: 8, minHeight: 36, padding: '0 9px', border: '1px solid currentColor', borderRadius: 6, background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer' }}>ลองอีกครั้ง</button>}
      </div>
    </div>
  )
}
