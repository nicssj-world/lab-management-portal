'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Scales its child down so the (naturally wider) content fits the available
 * width — no horizontal scrollbar. Never scales above `maxScale` (default 1).
 */
export function FitToWidth({ children, maxScale = 1 }: { children: React.ReactNode; maxScale?: number }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState<number>()

  const fit = useCallback(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    const avail = outer.clientWidth
    const natural = inner.scrollWidth // pre-transform layout width (stable across scale)
    const s = natural > avail && natural > 0 ? Math.min(maxScale, avail / natural) : maxScale
    setScale((prev) => (Math.abs(prev - s) > 0.002 ? s : prev))
    const nh = inner.offsetHeight * s
    setHeight((prev) => (prev === undefined || Math.abs(prev - nh) > 0.5 ? nh : prev))
  }, [maxScale])

  useEffect(() => {
    fit()
    const ro = new ResizeObserver(fit)
    if (outerRef.current) ro.observe(outerRef.current)
    window.addEventListener('resize', fit)
    // Thai webfont can shift widths after first paint
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts
    fonts?.ready?.then(fit).catch(() => {})
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [fit])

  return (
    <div ref={outerRef} style={{ width: '100%', overflow: 'hidden', height }}>
      <div ref={innerRef} style={{ width: 'max-content', margin: '0 auto', transform: `scale(${scale})`, transformOrigin: 'top center' }}>
        {children}
      </div>
    </div>
  )
}
