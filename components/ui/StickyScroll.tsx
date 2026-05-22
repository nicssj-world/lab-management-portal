'use client'

import { useEffect, useRef, useState } from 'react'

interface StickyScrollProps {
  children: React.ReactNode
  style?: React.CSSProperties
  contentWidth?: number | string
  bottom?: number
}

export function StickyScroll({ children, style, contentWidth, bottom = 0 }: StickyScrollProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const [scrollWidth, setScrollWidth] = useState<number | string>(contentWidth ?? '100%')

  function sync(source: 'body' | 'sticky') {
    const body = bodyRef.current
    const sticky = stickyRef.current
    if (!body || !sticky) return
    if (source === 'body') sticky.scrollLeft = body.scrollLeft
    else body.scrollLeft = sticky.scrollLeft
  }

  useEffect(() => {
    const measure = () => {
      if (contentWidth !== undefined) {
        setScrollWidth(contentWidth)
        return
      }
      const body = bodyRef.current
      if (body) setScrollWidth(body.scrollWidth)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [children, contentWidth])

  return (
    <>
      <style>{`
        .sticky-scroll-body {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .sticky-scroll-body::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div
        ref={bodyRef}
        className="sticky-scroll-body"
        onScroll={() => sync('body')}
        style={{ ...style, overflowX: 'auto' }}
      >
        {children}
      </div>
      <div
        ref={stickyRef}
        onScroll={() => sync('sticky')}
        style={{
          position: 'sticky',
          bottom,
          zIndex: 5,
          overflowX: 'auto',
          overflowY: 'hidden',
          height: 16,
          background: 'var(--card)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div style={{ width: scrollWidth, height: 1 }} />
      </div>
    </>
  )
}
