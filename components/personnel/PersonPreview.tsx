'use client'

import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'

type PersonPreviewProps = {
  name: string
  photo: string | null
  accent: string
  sub: string
}

export function PersonPreview({ name, photo, accent, sub }: PersonPreviewProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number; placement: 'top' | 'right' | 'bottom' | 'left' } | null>(null)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const titleId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const previewRef = useRef<HTMLElement>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    setPortalTarget(document.querySelector<HTMLElement>('.public-shell') ?? document.body)
  }, [])

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false
        triggerRef.current?.focus()
      }
      setPosition(null)
      return
    }

    wasOpenRef.current = true
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !previewRef.current?.contains(target)) setOpen(false)
    }
    const closeOnScroll = () => setOpen(false)

    document.addEventListener('keydown', handleDialogKeyDown)
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    // A contextual popover should not become detached from its source while
    // the long organization chart is moving underneath it.
    window.addEventListener('scroll', closeOnScroll, true)
    closeRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown)
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      window.removeEventListener('scroll', closeOnScroll, true)
    }
  }, [open])

  useEffect(() => {
    if (!open || !portalTarget) return

    let frame = 0
    const updatePosition = () => {
      const anchor = triggerRef.current?.getBoundingClientRect()
      const preview = previewRef.current?.getBoundingClientRect()
      if (!anchor || !preview) return

      const gap = 12
      const margin = 12
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const canFitRight = viewportWidth - anchor.right - gap >= preview.width
      const canFitLeft = anchor.left - gap >= preview.width
      const canFitBottom = viewportHeight - anchor.bottom - gap >= preview.height
      const canFitTop = anchor.top - gap >= preview.height

      let placement: 'top' | 'right' | 'bottom' | 'left'
      if (canFitRight) placement = 'right'
      else if (canFitLeft) placement = 'left'
      else if (canFitBottom) placement = 'bottom'
      else if (canFitTop) placement = 'top'
      else {
        const horizontalSpace = Math.max(viewportWidth - anchor.right, anchor.left)
        const verticalSpace = Math.max(viewportHeight - anchor.bottom, anchor.top)
        placement = horizontalSpace >= verticalSpace
          ? (viewportWidth - anchor.right >= anchor.left ? 'right' : 'left')
          : (viewportHeight - anchor.bottom >= anchor.top ? 'bottom' : 'top')
      }

      const rawLeft = placement === 'right'
        ? anchor.right + gap
        : placement === 'left'
          ? anchor.left - preview.width - gap
          : anchor.left + (anchor.width - preview.width) / 2
      const rawTop = placement === 'bottom'
        ? anchor.bottom + gap
        : placement === 'top'
          ? anchor.top - preview.height - gap
          : anchor.top + (anchor.height - preview.height) / 2
      const maxLeft = Math.max(margin, viewportWidth - preview.width - margin)
      const maxTop = Math.max(margin, viewportHeight - preview.height - margin)

      setPosition({
        left: Math.min(Math.max(rawLeft, margin), maxLeft),
        top: Math.min(Math.max(rawTop, margin), maxTop),
        placement,
      })
    }

    frame = window.requestAnimationFrame(updatePosition)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, portalTarget])

  const fallback = (size: number) => (
    <span style={{ fontSize: size, fontWeight: 800, color: 'var(--muted)' }}>{name.charAt(0)}</span>
  )

  const preview = open ? (
    <section
      ref={previewRef}
      className="team-person-preview"
      data-placement={position?.placement}
      role="dialog"
      aria-labelledby={titleId}
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <button ref={closeRef} type="button" className="team-person-preview-close" aria-label="ปิด" onClick={() => setOpen(false)}>
        <Icon name="x" size={16} />
      </button>
      <div className="team-person-preview-photo">
        {photo
          ? <img src={photo} alt={`รูป ${name}`} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 22%', display: 'block' }} />
          : fallback(44)}
      </div>
      <h2 id={titleId}>{name}</h2>
      {sub && <p>{sub}</p>}
    </section>
  ) : null

  return (
    <>
      <div className="to-card" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px', border: `1px solid ${accent}`, borderLeft: `3px solid ${accent}`, borderRadius: 10, background: 'var(--card)', minWidth: 200 }}>
        <button
          ref={triggerRef}
          type="button"
          className="team-person-avatar-button"
          aria-label={`ขยายรูปและดูข้อมูล ${name}`}
          aria-expanded={open}
          title="คลิกเพื่อดูรูปและชื่อ"
          onClick={() => setOpen((current) => !current)}
        >
          <span style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}>
            {photo
              ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 22%', display: 'block' }} />
              : fallback(19)}
          </span>
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{sub}</div>
        </div>
      </div>

      {portalTarget && preview ? createPortal(preview, portalTarget) : null}
    </>
  )
}
