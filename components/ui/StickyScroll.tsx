'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface StickyScrollProps {
  children: React.ReactNode
  style?: React.CSSProperties
  contentWidth?: number | string
  bottom?: number
}

export function StickyScroll({ children, style, contentWidth, bottom = 0 }: StickyScrollProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const bodyRef   = useRef<HTMLDivElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const [scrollWidth, setScrollWidth] = useState<number | string>(contentWidth ?? '100%')
  const [bar, setBar] = useState<{ left: number; width: number; visible: boolean }>({ left: 0, width: 0, visible: false })

  function sync(source: 'body' | 'sticky') {
    const body   = bodyRef.current
    const sticky = stickyRef.current
    if (!body || !sticky) return
    if (source === 'body') sticky.scrollLeft = body.scrollLeft
    else body.scrollLeft = sticky.scrollLeft
  }

  const update = useCallback(() => {
    const wrapper = wrapperRef.current
    const body    = bodyRef.current
    if (!wrapper || !body) return

    const sw = contentWidth !== undefined ? contentWidth : body.scrollWidth
    setScrollWidth(sw)

    if (body.scrollWidth <= body.clientWidth) {
      setBar(b => ({ ...b, visible: false }))
      return
    }

    const rect = wrapper.getBoundingClientRect()
    const vh   = window.innerHeight
    const show = rect.top < vh - 16 && rect.bottom > vh
    setBar({ left: rect.left, width: rect.width, visible: show })
  }, [contentWidth])

  useEffect(() => {
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [update])

  useEffect(() => { update() }, [children, update])

  return (
    <>
      <style>{`
        .sticky-scroll-body {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .sticky-scroll-body::-webkit-scrollbar { display: none; }
      `}</style>
      <div ref={wrapperRef}>
        <div
          ref={bodyRef}
          className="sticky-scroll-body"
          onScroll={() => sync('body')}
          style={{ ...style, overflowX: 'auto' }}
        >
          {children}
        </div>
      </div>

      {bar.visible && (
        <div
          ref={stickyRef}
          onScroll={() => sync('sticky')}
          style={{
            position: 'fixed',
            bottom,
            left:   bar.left,
            width:  bar.width,
            zIndex: 50,
            overflowX: 'auto',
            overflowY: 'hidden',
            height: 14,
            background: 'var(--card)',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ width: scrollWidth, height: 1 }} />
        </div>
      )}
    </>
  )
}
