'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'

const ZOOM_LEVELS = [1, 1.5, 2]
const CHART_TITLE = 'ผังโครงสร้างระบบบริหารคุณภาพ กลุ่มงานเทคนิคการแพทย์ และพยาธิวิทยาคลินิก โรงพยาบาลชลบุรี'

export function QualityChartViewer({ src }: { src: string }) {
  const [open, setOpen] = useState(false)
  const [zoomIdx, setZoomIdx] = useState(0)
  const zoom = ZOOM_LEVELS[zoomIdx]

  function close() {
    setOpen(false)
    setZoomIdx(0)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 20,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink)' }}
      >
        <Icon name="shieldCheck" size={15} />
        ผังบริหารคุณภาพ
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 52, background: 'var(--card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, flexShrink: 0 }}>
            <Icon name="shieldCheck" size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {CHART_TITLE}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button
                onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
                disabled={zoomIdx === 0}
                title="ย่อ"
                aria-label="ย่อ"
                style={toolBtnStyle(zoomIdx === 0)}
              >
                −
              </button>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', width: 38, textAlign: 'center' }}>
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoomIdx((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
                disabled={zoomIdx === ZOOM_LEVELS.length - 1}
                title="ขยาย"
                aria-label="ขยาย"
                style={toolBtnStyle(zoomIdx === ZOOM_LEVELS.length - 1)}
              >
                +
              </button>
              <a href={src} download title="ดาวน์โหลด" aria-label="ดาวน์โหลด" style={{ ...toolBtnStyle(false), textDecoration: 'none' }}>
                <Icon name="download" size={14} />
              </a>
              <button onClick={close} title="ปิด" aria-label="ปิด" style={toolBtnStyle(false)}>
                <Icon name="x" size={14} />
              </button>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 24, boxSizing: 'border-box' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={CHART_TITLE}
              style={{
                display: 'block', margin: '0 auto',
                width: `${zoom * 100}%`, maxWidth: zoom === 1 ? 900 : 'none', height: 'auto',
                borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,.3)', background: '#fff',
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}

function toolBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent',
    cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: disabled ? 'var(--border)' : 'var(--muted)', fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
  }
}
