'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { FitToWidth } from './FitToWidth'
import { useUniformBoxHeight } from '@/lib/hooks/useUniformBoxHeight'

const zoomBtn: React.CSSProperties = {
  width: 30, height: 28, borderRadius: 6, border: 'none', background: 'transparent',
  color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 16, fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

/**
 * Inline org chart fitted to width; click to open a full-screen popup
 * that shows it enlarged with zoom controls + scroll.
 */
export function OrgViewer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const measureRef = useRef<HTMLDivElement>(null)
  const boxInnerHeight = useUniformBoxHeight(measureRef, '[data-org-inner]', [children])

  // NodeBox reads --org-box-h via calc() in its min-height (a static string, safe for SSR),
  // so uniform sizing is applied by mutating the CSS variable directly — no React state
  // flows into the (server-rendered, Thai-segmented) NodeBox tree, avoiding a hydration
  // mismatch from Node's vs the browser's Intl.Segmenter disagreeing on word boundaries.
  useEffect(() => {
    if (boxInnerHeight !== undefined) {
      document.documentElement.style.setProperty('--org-box-h', `${boxInnerHeight}px`)
    }
  }, [boxInnerHeight])

  useEffect(() => {
    if (!open) return
    setZoom(1)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open])

  const nudge = (d: number) => setZoom((z) => Math.min(2.5, Math.max(0.5, +(z + d).toFixed(2))))

  return (
    <>
      {/* Inline (fitted) — click to expand */}
      <div
        ref={measureRef}
        className="org-clickable"
        role="button"
        tabIndex={0}
        title="คลิกเพื่อขยาย"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }}
        style={{ position: 'relative', cursor: 'zoom-in', outline: 'none' }}
      >
        <FitToWidth>{children}</FitToWidth>
        <span className="org-expand-hint"><Icon name="search" size={12} /> คลิกเพื่อขยาย</span>
      </div>

      {/* Popup */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.72)', backdropFilter: 'blur(2px)', display: 'flex', flexDirection: 'column' }}
        >
          {/* Toolbar */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: 'var(--card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
          >
            <Icon name="dash" size={16} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>ผังโครงสร้างองค์กร</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 2, border: '1px solid var(--border)', borderRadius: 8, padding: 2 }}>
              <button style={zoomBtn} title="ย่อ" onClick={() => nudge(-0.25)} disabled={zoom <= 0.5}>−</button>
              <button
                style={{ ...zoomBtn, width: 'auto', padding: '0 8px', fontSize: 12.5, color: 'var(--muted)' }}
                title="รีเซ็ต" onClick={() => setZoom(1)}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button style={zoomBtn} title="ขยาย" onClick={() => nudge(0.25)} disabled={zoom >= 2.5}>+</button>
            </div>

            <button
              onClick={() => setOpen(false)}
              title="ปิด (Esc)"
              style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <Icon name="x" size={18} />
            </button>
          </div>

          {/* Scrollable enlarged chart */}
          <div
            onClick={() => setOpen(false)}
            style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}
          >
            <div onClick={(e) => e.stopPropagation()} style={{ zoom, width: 'max-content', cursor: 'default' }}>
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
