'use client'

import { useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type {
  LabAccessPointDefinition,
  LabLabelDefinition,
  LabMapDTO,
  LabMapSpaceDTO,
  LabSafetyEquipmentDefinition,
  LabStructureDefinition,
  MapMode,
  SvgShape,
} from '@/lib/lab-map/types'
import { EVACUATION_RESTRICTED_SPACE_CODES } from '@/lib/lab-map/safety-assets'

export interface LabMapCanvasProps {
  map: LabMapDTO
  mode: MapMode
  selectedCode: string | null
  activeRouteCodes?: readonly string[]
  onSelect: (code: string) => void
  highlightedSpaceCodes?: readonly string[]
  /** จุดสแกนปลายทางของเส้นทางที่กำลังแสดง — ไฮไลต์และประกาศให้ผู้ใช้ทราบว่าเส้นทางจบที่นี่ */
  destinationPointCode?: string | null
  /** สถานีที่ใช้วางหมุด "คุณอยู่ที่นี่" — ไม่ระบุ = ใช้ map.stationCode ตามเดิม */
  activeStationCode?: string | null
  interactive?: boolean
}

interface ViewTransform {
  scale: number
  x: number
  y: number
}

const RESTRICTED_LIFT_CODES = new Set<string>(EVACUATION_RESTRICTED_SPACE_CODES)

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

function fillForSpace(space: LabMapSpaceDTO, mode: MapMode, patternIds: Record<string, string>): string {
  if (mode !== 'infection') return space.controlled ? 'var(--map-controlled)' : 'var(--map-room)'
  if (space.infectionClass === 'infectious') return `url(#${patternIds.infectious})`
  if (space.infectionClass === 'risk') return `url(#${patternIds.risk})`
  if (space.infectionClass === 'clean') return 'var(--map-clean)'
  return 'var(--map-room)'
}

function pointSymbol(point: LabAccessPointDefinition): ReactNode {
  if (point.kind === 'fingerprint') {
    return (
      <g>
        <rect x={point.x - 9} y={point.y - 9} width={18} height={18} rx={4} />
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

/** สัญลักษณ์อุปกรณ์ความปลอดภัย — แยกรูปทรงต่อชนิด ไม่ใช่แยกด้วยสีอย่างเดียว */
function safetyEquipmentSymbol(item: LabSafetyEquipmentDefinition): ReactNode {
  if (item.kind === 'fire-extinguisher') {
    return (
      <g>
        <rect x={item.x - 5} y={item.y - 9} width={10} height={18} rx={3} />
        <rect x={item.x - 2} y={item.y - 13} width={4} height={5} rx={1} />
      </g>
    )
  }
  if (item.kind === 'fire-hose') {
    return <polygon points={`${item.x},${item.y - 10} ${item.x + 10},${item.y} ${item.x},${item.y + 10} ${item.x - 10},${item.y}`} />
  }
  return <polygon points={`${item.x},${item.y - 10} ${item.x + 9},${item.y + 7} ${item.x - 9},${item.y + 7}`} />
}

function LabelText({ item }: { item: LabLabelDefinition }) {
  const lineHeight = item.fontSize * 1.25
  const firstY = item.y - ((item.lines.length - 1) * lineHeight) / 2
  return (
    <text
      className="lab-map-label"
      x={item.x}
      y={firstY}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={item.fontSize}
      fontWeight={item.emphasis ? 700 : 500}
      transform={item.rotate ? `rotate(${item.rotate} ${item.x} ${item.y})` : undefined}
    >
      {item.lines.map((line, index) => (
        <tspan key={`${item.code}-${index}`} x={item.x} dy={index === 0 ? 0 : lineHeight}>{line}</tspan>
      ))}
    </text>
  )
}

function StructureLayer({ structures }: { structures: readonly LabStructureDefinition[] }) {
  return (
    <g className="lab-map-structures" aria-hidden="true">
      {structures.map((item) => (
        <path key={item.code} className={`lab-map-structure lab-map-structure--${item.kind}`} d={item.d} />
      ))}
    </g>
  )
}

export function LabMapCanvas({
  map,
  mode,
  selectedCode,
  activeRouteCodes = [],
  onSelect,
  highlightedSpaceCodes = [],
  destinationPointCode = null,
  activeStationCode = null,
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

  const activeRoutes = useMemo(
    () => map.routes.filter((route) => activeRouteCodes.includes(route.code)),
    [map.routes, activeRouteCodes],
  )
  const highlighted = useMemo(() => new Set(highlightedSpaceCodes), [highlightedSpaceCodes])
  const resolvedStationCode = activeStationCode ?? map.stationCode
  // หมุด "คุณอยู่ที่นี่" มีความหมายเฉพาะตอนดูเส้นทางหนีไฟ — โหมดพื้นที่/หน่วยงานและเขตควบคุมการติดเชื้อ
  // อ่านข้อมูลคนละแบบ หมุดตำแหน่งผู้ใช้ไม่เกี่ยวและรบกวนการอ่านผังเปล่า ๆ
  const station = mode === 'safety'
    ? map.stations.find((item) => item.code === resolvedStationCode) ?? null
    : null

  /**
   * โหมดความปลอดภัยแสดงเฉพาะสิ่งที่ใช้อพยพจริง — ทางออก ประตูล็อคถาวร
   * และจุดสแกนที่อยู่บนเส้นทางที่กำลังแสดงเท่านั้น จุดสแกนอื่นถูกซ่อนเพื่อไม่ให้อ่านผิด
   */
  const routePointCodes = useMemo(
    () => new Set(activeRoutes.flatMap((route) => [...route.pointCodes, route.destinationCode])),
    [activeRoutes],
  )
  const visiblePoints = map.accessPoints.filter((point) => {
    if (mode !== 'safety') return true
    if (point.kind === 'exit' || point.status === 'permanently_locked') return true
    return routePointCodes.has(point.code)
  })
  const restrictedLiftSpaces = mode === 'safety'
    ? map.spaces.filter((space) => RESTRICTED_LIFT_CODES.has(space.code) && space.shape.type === 'rect')
    : []

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
    const start = dragStart.current
    if (!start) return
    const factor = 1 / view.scale
    setView((current) => ({
      ...current,
      x: start.viewX + (event.clientX - start.pointerX) * factor,
      y: start.viewY + (event.clientY - start.pointerY) * factor,
    }))
  }

  function stopPan(event: ReactPointerEvent<SVGSVGElement>) {
    dragStart.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

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
            <marker id={`${idPrefix}-arrow-primary`} viewBox="0 0 12 12" refX="10" refY="6"
              markerWidth="9" markerHeight="9" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
              <path d="M 1 1 L 11 6 L 1 11 z" fill="var(--map-route)" />
            </marker>
            <marker id={`${idPrefix}-arrow-alternate`} viewBox="0 0 12 12" refX="10" refY="6"
              markerWidth="9" markerHeight="9" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
              <path d="M 1 1 L 11 6 L 1 11 z" fill="var(--map-route-alt)" />
            </marker>
          </defs>

          <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
            <rect className="lab-map-floor" x="4" y="5" width="1469" height="882" rx="10" />

            {map.spaces.map((space) => {
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
                </g>
              )
            })}

            <StructureLayer structures={map.structures} />

            <g className="lab-map-labels" aria-hidden="true">
              {map.labels.map((item) => <LabelText key={item.code} item={item} />)}
            </g>

            {activeRoutes.map((route) => {
              const points = route.polyline.map(([x, y]) => `${x},${y}`).join(' ')
              const marker = route.variant === 'alternate' ? `${idPrefix}-arrow-alternate` : `${idPrefix}-arrow-primary`
              return (
                <g
                  key={route.code}
                  className="lab-map-route"
                  data-variant={route.variant}
                  role="img"
                  aria-label={`${route.variant === 'alternate' ? 'เส้นทางสำรอง' : 'เส้นทางหลัก'} ${route.directionsTh.join(' ')}`}
                >
                  <polyline className="lab-map-route-halo" points={points} />
                  <polyline
                    className="lab-map-route-line"
                    points={points}
                    markerMid={`url(#${marker})`}
                    markerEnd={`url(#${marker})`}
                  />
                </g>
              )
            })}

            {visiblePoints.map((point) => (
              <g
                key={point.code}
                className={`lab-map-point lab-map-point--${point.kind}`}
                data-status={point.status}
                data-destination={point.code === destinationPointCode || undefined}
                aria-label={point.nameTh}
                role="img"
              >
                {point.code === destinationPointCode ? (
                  <circle className="lab-map-point-pulse" cx={point.x} cy={point.y} r={19} />
                ) : null}
                {pointSymbol(point)}
              </g>
            ))}

            {restrictedLiftSpaces.length > 0 ? (
              <g className="lab-map-lift-restricted">
                {restrictedLiftSpaces.map((space) => {
                  if (space.shape.type !== 'rect') return null
                  const { x, y, width, height } = space.shape
                  return (
                    <g
                      key={space.code}
                      className="lab-map-lift-restricted-item"
                      role="img"
                      aria-label={`${space.nameTh} — ห้ามใช้ลิฟต์ขณะเกิดเหตุ`}
                    >
                      <path className="lab-map-lift-restricted-cross" d={`M ${x + 5} ${y + 5} L ${x + width - 5} ${y + height - 5} M ${x + width - 5} ${y + 5} L ${x + 5} ${y + height - 5}`} />
                    </g>
                  )
                })}
              </g>
            ) : null}

            {mode === 'safety' ? (
              <g className="lab-map-safety-equipment">
                {map.safetyEquipment.map((item) => (
                  <g
                    key={item.code}
                    className={`lab-map-equipment lab-map-equipment--${item.kind}`}
                    data-verified={item.verified || undefined}
                    role="img"
                    aria-label={`${item.nameTh}${item.verified ? '' : ' — รอยืนยันตำแหน่ง'}`}
                  >
                    {safetyEquipmentSymbol(item)}
                  </g>
                ))}
              </g>
            ) : null}

            {station ? (
              <g className="lab-map-station" role="img" aria-label={`คุณอยู่ที่นี่ — ${station.nameTh}`}>
                <circle className="lab-map-station-halo" cx={station.x} cy={station.y} r={16} />
                <circle className="lab-map-station-dot" cx={station.x} cy={station.y} r={7} />
                <text className="lab-map-station-label" x={station.x} y={station.y - 24} textAnchor="middle">
                  คุณอยู่ที่นี่
                </text>
              </g>
            ) : null}
          </g>
        </svg>
      </div>
    </section>
  )
}
