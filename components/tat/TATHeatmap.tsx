'use client'

import { useMemo, useState } from 'react'
import { buildHeatmapMatrix } from '@/lib/tat-utils'

interface TATEntry {
  received_at: string
}

interface Props {
  entries: TATEntry[]
}

const DAY_LABELS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']
const DAY_NAMES_TH = ['วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์', 'วันอาทิตย์']

function getColor(count: number, maxCount: number): string {
  if (count === 0) return 'var(--surface-2)'
  const ratio = count / maxCount
  if (ratio < 0.1) return '#DBEAFE'
  if (ratio < 0.3) return '#93C5FD'
  if (ratio < 0.6) return 'var(--primary)'
  return '#1E3A8A'
}

export function TATHeatmap({ entries }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; day: number; hour: number; count: number } | null>(null)

  const matrix = useMemo(() => buildHeatmapMatrix(entries), [entries])
  const maxCount = useMemo(() => Math.max(...matrix.flat(), 1), [matrix])

  const CELL_W = 36
  const CELL_H = 22
  const LABEL_W = 46
  const HEADER_H = 22

  const svgW = LABEL_W + 7 * CELL_W + 16
  const svgH = HEADER_H + 24 * CELL_H + 32

  return (
    <div style={{ position: 'relative', overflowX: 'auto' }}>
      <svg width={svgW} height={svgH} style={{ display: 'block' }}>
        {/* Day column headers */}
        {DAY_LABELS.map((label, dayIdx) => (
          <text
            key={dayIdx}
            x={LABEL_W + dayIdx * CELL_W + CELL_W / 2}
            y={HEADER_H - 6}
            textAnchor="middle"
            fontSize={11}
            fill="var(--muted)"
            fontFamily="inherit"
          >
            {label}
          </text>
        ))}

        {/* Hour rows + cells */}
        {Array.from({ length: 24 }, (_, hour) => (
          <g key={hour}>
            <text
              x={LABEL_W - 6}
              y={HEADER_H + hour * CELL_H + CELL_H / 2 + 4}
              textAnchor="end"
              fontSize={9.5}
              fill="var(--muted)"
              fontFamily="inherit"
            >
              {String(hour).padStart(2, '0')}:00
            </text>
            {matrix.map((dayRow, dayIdx) => {
              const count = dayRow[hour]
              return (
                <rect
                  key={dayIdx}
                  x={LABEL_W + dayIdx * CELL_W + 2}
                  y={HEADER_H + hour * CELL_H + 2}
                  width={CELL_W - 4}
                  height={CELL_H - 4}
                  rx={4}
                  fill={getColor(count, maxCount)}
                  style={{ cursor: count > 0 ? 'pointer' : 'default', transition: 'opacity .1s' }}
                  onMouseEnter={e => {
                    const rect = (e.target as SVGRectElement).getBoundingClientRect()
                    setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8, day: dayIdx, hour, count })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              )
            })}
          </g>
        ))}

        {/* Legend */}
        {[0, 0.1, 0.3, 0.6, 1].map((ratio, i) => {
          const count = ratio === 0 ? 0 : Math.ceil(maxCount * ratio)
          const colors = ['var(--surface-2)', '#DBEAFE', '#93C5FD', 'var(--primary)', '#1E3A8A']
          const x = LABEL_W + i * 40
          const y = HEADER_H + 24 * CELL_H + 14
          return (
            <g key={i}>
              <rect x={x} y={y} width={32} height={10} rx={3} fill={colors[i]} />
              <text x={x + 16} y={y + 18} textAnchor="middle" fontSize={9} fill="var(--muted)" fontFamily="inherit">
                {count === 0 ? '0' : `${count}`}
              </text>
            </g>
          )
        })}
        <text x={LABEL_W} y={HEADER_H + 24 * CELL_H + 12} fontSize={9.5} fill="var(--muted)" fontFamily="inherit">จำนวนตัวอย่าง:</text>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y - 28,
            transform: 'translateX(-50%)',
            background: 'var(--ink)',
            color: '#fff',
            fontSize: 12,
            padding: '4px 10px',
            borderRadius: 6,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 100,
          }}
        >
          {DAY_NAMES_TH[tooltip.day]} {String(tooltip.hour).padStart(2, '0')}:00 — {tooltip.count.toLocaleString()} ตัวอย่าง
        </div>
      )}
    </div>
  )
}
