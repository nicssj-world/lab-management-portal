'use client'

import { useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type {
  LabMapDTO,
  LabMapSpaceDTO,
  MapMode,
  SvgShape,
} from '@/lib/lab-map/types'

export interface LabMapCanvasProps {
  map: LabMapDTO
  mode: MapMode
  selectedCode: string | null
  activeRouteCode: string | null
  activeRouteCodes?: readonly string[]
  onSelect: (code: string) => void
  highlightedSpaceCodes?: readonly string[]
  interactive?: boolean
}

interface ViewTransform {
  scale: number
  x: number
  y: number
}

function renderShape(shape: SvgShape): ReactNode {
  switch (shape.type) {
    case 'rect':
      return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} />
    case 'polygon':
      return <polygon points={shape.points.map(([x, y]) => `${x},${y}`).join(' ')} />
    case 'path':
      return <path d={shape.d} />
    default: {
      const exhaustive: never = shape
      return exhaustive
    }
  }
}

function shapeCenter(shape: SvgShape): readonly [number, number] | null {
  if (shape.type === 'rect') return [shape.x + shape.width / 2, shape.y + shape.height / 2]
  if (shape.type === 'polygon' && shape.points.length > 0) {
    const sum = shape.points.reduce(([x, y], [nextX, nextY]) => [x + nextX, y + nextY] as const, [0, 0] as const)
    return [sum[0] / shape.points.length, sum[1] / shape.points.length]
  }
  return null
}

function labelLines(space: LabMapSpaceDTO): string[] {
  const label = space.nameTh.replace(/ — /g, '—')
  if (label.length <= 24) return [label]

  const words = label.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > 24 && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 3)
}

function fillForSpace(space: LabMapSpaceDTO, mode: MapMode, patternIds: Record<string, string>): string {
  if (mode !== 'infection') return space.controlled ? 'var(--map-controlled)' : 'var(--map-room)'
  if (space.infectionClass === 'infectious') return `url(#${patternIds.infectious})`
  if (space.infectionClass === 'risk') return `url(#${patternIds.risk})`
  if (space.infectionClass === 'clean') return 'var(--map-clean)'
  return 'var(--map-room)'
}

function pointSymbol(point: LabMapDTO['accessPoints'][number]): ReactNode {
  if (point.kind === 'fingerprint') {
    return (
      <g>
        <rect x={point.x - 9} y={point.y - 9} width={18} height={18} rx={5} />
        <path d={`M ${point.x - 3} ${point.y + 4} C ${point.x - 5} ${point.y - 4}, ${point.x + 5} ${point.y - 7}, ${point.x + 4} ${point.y + 3}`} />
      </g>
    )
  }
  if (point.kind === 'exit') {
    return <path d={`M ${point.x - 10} ${point.y - 8} H ${point.x + 8} V ${point.y + 8} H ${point.x - 10} Z M ${point.x - 2} ${point.y} H ${point.x + 13} M ${point.x + 7} ${point.y - 5} L ${point.x + 13} ${point.y} L ${point.x + 7} ${point.y + 5}`} />
  }
  if (point.status === 'permanently_locked') {
    return (
      <g>
        <rect x={point.x - 9} y={point.y - 2} width={18} height={14} rx={3} />
        <path d={`M ${point.x - 5} ${point.y - 2} V ${point.y - 7} A 5 5 0 0 1 ${point.x + 5} ${point.y - 7} V ${point.y - 2}`} />
      </g>
    )
  }
  return <circle cx={point.x} cy={point.y} r={7} />
}

export function LabMapCanvas({
  map,
  mode,
  selectedCode,
  activeRouteCode,
  activeRouteCodes = [],
  onSelect,
  highlightedSpaceCodes = [],
  interactive = true,
}: LabMapCanvasProps) {
  const rawId = useId()
  const idPrefix = rawId.replace(/:/g, '')
  const patternIds = useMemo(
    () => ({ infectious: `${idPrefix}-infectious`, risk: `${idPrefix}-risk` }),
    [idPrefix],
  )
  const [view, setView] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 })
  const dragStart = useRef<{ pointerX: number; pointerY: number; viewX: number; viewY: number } | null>(null)

  const activeRoutes = map.routes.filter((route) => route.code === activeRouteCode || activeRouteCodes.includes(route.code))
  const highlighted = useMemo(() => new Set(highlightedSpaceCodes), [highlightedSpaceCodes])

  function resetView() {
    setView({ scale: 1, x: 0, y: 0 })
  }

  function changeZoom(delta: number) {
    setView((current) => ({ ...current, scale: Math.min(2.5, Math.max(0.75, current.scale + delta)) }))
  }

  function handleSpaceKeyDown(event: KeyboardEvent<SVGGElement>, code: string) {
    if (!interactive || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onSelect(code)
  }

  function startPan(event: ReactPointerEvent<SVGSVGElement>) {
    const target = event.target as Element
    if (!interactive || target.closest('[data-space-code]')) return
    dragStart.current = { pointerX: event.clientX, pointerY: event.clientY, viewX: view.x, viewY: view.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function movePan(event: ReactPointerEvent<SVGSVGElement>) {
    if (!dragStart.current) return
    const factor = 1 / view.scale
    setView((current) => ({
      ...current,
      x: dragStart.current!.viewX + (event.clientX - dragStart.current!.pointerX) * factor,
      y: dragStart.current!.viewY + (event.clientY - dragStart.current!.pointerY) * factor,
    }))
  }

  function stopPan(event: ReactPointerEvent<SVGSVGElement>) {
    dragStart.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const showSafetyPoints = mode === 'safety' || mode === 'overview'

  return (
    <section className="lab-map-canvas-frame" aria-label="แผนผังห้องปฏิบัติการ">
      {interactive ? (
        <div className="lab-map-zoom-controls" aria-label="เครื่องมือย่อขยายแผนที่">
          <button type="button" onClick={() => changeZoom(0.2)} aria-label="ขยายแผนที่">+</button>
          <button type="button" onClick={() => changeZoom(-0.2)} aria-label="ย่อแผนที่">−</button>
          <button type="button" className="lab-map-reset" onClick={resetView}>คืนมุมมอง</button>
        </div>
      ) : null}

      <div className="lab-map-svg-scroll">
        <svg
          className="lab-map-svg"
          viewBox={map.viewBox}
          role="img"
          aria-label="แผนผังชั้น 3 กลุ่มงานเทคนิคการแพทย์"
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={stopPan}
          onPointerCancel={stopPan}
        >
          <defs>
            <pattern id={patternIds.infectious} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
              <rect width="14" height="14" fill="var(--map-infectious-soft)" />
              <rect width="5" height="14" fill="var(--map-infectious)" />
            </pattern>
            <pattern id={patternIds.risk} width="18" height="18" patternUnits="userSpaceOnUse">
              <rect width="18" height="18" fill="var(--map-risk-soft)" />
              <circle cx="5" cy="5" r="2.2" fill="var(--map-risk)" />
              <circle cx="14" cy="14" r="2.2" fill="var(--map-risk)" />
            </pattern>
            <filter id={`${idPrefix}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.16" />
            </filter>
          </defs>

          <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
            <rect className="lab-map-floor" x="4" y="5" width="1475" height="883" rx="10" />

            {map.spaces.map((space) => {
              const center = shapeCenter(space.shape)
              const lines = labelLines(space)
              const isSelected = selectedCode === space.code
              const isHighlighted = highlighted.has(space.code)
              return (
                <g
                  key={space.code}
                  className="lab-map-space"
                  data-space-code={space.code}
                  data-selected={isSelected || undefined}
                  data-highlighted={isHighlighted || undefined}
                  role={interactive ? 'button' : undefined}
                  tabIndex={interactive ? 0 : -1}
                  aria-label={`${space.nameTh}${space.controlled ? ' พื้นที่ควบคุม' : ''}`}
                  onClick={() => interactive && onSelect(space.code)}
                  onKeyDown={(event) => handleSpaceKeyDown(event, space.code)}
                  style={{ '--space-fill': fillForSpace(space, mode, patternIds) } as React.CSSProperties}
                >
                  {renderShape(space.shape)}
                  {center ? (
                    <text className="lab-map-space-label" x={center[0]} y={center[1] - ((lines.length - 1) * 8)} textAnchor="middle">
                      {lines.map((line, index) => (
                        <tspan key={`${space.code}-${index}`} x={center[0]} dy={index === 0 ? 0 : 17}>{line}</tspan>
                      ))}
                    </text>
                  ) : null}
                </g>
              )
            })}

            {activeRoutes.map((activeRoute) => (
              <g key={activeRoute.code} className="lab-map-route" aria-label={`เส้นทาง ${activeRoute.code}`} data-variant={activeRoute.variant}>
                <polyline className="lab-map-route-halo" points={activeRoute.polyline.map(([x, y]) => `${x},${y}`).join(' ')} />
                <polyline className="lab-map-route-line" points={activeRoute.polyline.map(([x, y]) => `${x},${y}`).join(' ')} />
              </g>
            ))}

            {showSafetyPoints ? map.accessPoints.map((point) => (
              <g
                key={point.code}
                className={`lab-map-point lab-map-point--${point.kind}`}
                data-status={point.status}
                aria-label={point.nameTh}
                role="img"
              >
                {pointSymbol(point)}
              </g>
            )) : null}
          </g>
        </svg>
      </div>
    </section>
  )
}
