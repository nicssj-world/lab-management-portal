'use client'

import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import type {
  EquipmentAreaDTO,
  EquipmentDoorDefinition,
  EquipmentPinDTO,
  EquipmentRect,
  EquipmentWallDefinition,
} from '@/lib/equipment-map/types'
import { getEquipmentPinSymbol, type EquipmentPinSymbol } from '@/lib/equipment-map/pin-symbol'

export type EquipmentMapFocus = 'all' | 'due' | 'broken' | 'pending' | 'unsurveyed'

export interface EquipmentMapCanvasProps {
  viewBox: string
  walls: readonly EquipmentWallDefinition[]
  doors: readonly EquipmentDoorDefinition[]
  areas: readonly EquipmentAreaDTO[]
  pins: readonly EquipmentPinDTO[]
  selectedAreaCode: string | null
  selectedPinId: string | null
  onSelectArea: (code: string) => void
  onSelectPin: (id: string) => void
  /** โหมดวางหมุด — คลิกที่แผนที่แล้วส่ง (areaCode, x, y) ของจุดที่คลิกกลับไป ต้องคลิกในพื้นที่ที่มีรูปทรงเท่านั้น */
  onCoordinateSelect?: (result: { areaCode: string; x: number; y: number } | { error: 'outside_area' }) => void
  /** ลากหมุดที่ปักแล้วได้ โดยคง areaCode เดิมเพื่อไม่ให้ลากข้ามห้อง/โซน */
  onMovePin?: (input: { id: string; areaCode: string; x: number; y: number }) => void
  focus: EquipmentMapFocus
  hasActiveRound: boolean
}

interface ViewTransform { scale: number; x: number; y: number }
interface PinDrag { id: string; areaCode: string; pointerId: number; x: number; y: number }
interface PinDragPreview { id: string; x: number; y: number }

// Holding the pointer down for this long before a drag "arms" is what keeps a quick click-to-view
// from ever nudging the pin — pointermove is ignored entirely (draggedPinRef stays null) until the
// hold clears this threshold, so an ordinary click can never shift the pin's position.
const PIN_DRAG_HOLD_MS = 250

function matchesFocus(pin: EquipmentPinDTO, focus: EquipmentMapFocus): boolean {
  if (focus === 'all') return true
  if (focus === 'due') return pin.due === 'due_soon' || pin.due === 'overdue'
  if (focus === 'broken') return pin.status === 'ชำรุด'
  if (focus === 'pending') return pin.pendingRegistration
  if (focus === 'unsurveyed') return !pin.surveyed
  return true
}

function pinGlyph(pin: EquipmentPinDTO): string {
  if (pin.status === 'ชำรุด') return '✕'
  if (pin.due === 'overdue') return '!'
  if (pin.due === 'due_soon') return '◐'
  if (pin.pendingRegistration) return '?'
  return pin.surveyed ? '✓' : ''
}

function PinShape({ x, y, symbol }: { x: number; y: number; symbol: EquipmentPinSymbol }) {
  if (symbol.kind === 'refrigerator') {
    return (
      <g className="equipment-pin-refrigerator">
        <rect className="equipment-pin-body" x={x - 11} y={y - 19} width={22} height={38} rx={3} />
        <path className="equipment-pin-detail" d={`M ${x - 9} ${y + 1} H ${x + 9} M ${x - 1} ${y - 15} V ${y - 2}`} />
      </g>
    )
  }

  if (symbol.kind === 'centrifuge') {
    return (
      <g className="equipment-pin-centrifuge">
        <rect className="equipment-pin-body" x={x - 15} y={y - 14} width={30} height={28} rx={6} />
        <circle className="equipment-pin-detail" cx={x} cy={y} r={7} />
        <circle className="equipment-pin-rotor-dot" cx={x - 4} cy={y - 2} r={1.8} />
        <circle className="equipment-pin-rotor-dot" cx={x + 4} cy={y - 2} r={1.8} />
        <circle className="equipment-pin-rotor-dot" cx={x} cy={y + 5} r={1.8} />
      </g>
    )
  }

  if (symbol.kind === 'microscope') {
    return (
      <g className="equipment-pin-microscope">
        <rect className="equipment-pin-hit-area" x={x - 21} y={y - 21} width={42} height={42} rx={6} />
        <g transform={`translate(${x - 24} ${y - 24})`}>
          <path className="equipment-pin-body equipment-pin-outline" d="M 11 39 H 38 M 18 35 L 28 25 L 19 11 L 13 16 L 22 27 L 15 35" />
          <circle className="equipment-pin-body" cx={29} cy={16} r={5} />
          <path className="equipment-pin-detail" d="M 18 35 H 35 M 19 11 L 24 8" />
        </g>
      </g>
    )
  }

  if (symbol.kind === 'bsc') {
    return (
      <g className="equipment-pin-bsc">
        <g transform={`translate(${x - 24} ${y - 24})`}>
          <rect className="equipment-pin-body" x={4} y={10} width={40} height={28} rx={4} />
          <path className="equipment-pin-detail" d="M 9 18 H 39 M 9 24 H 39 M 9 30 H 39" />
        </g>
      </g>
    )
  }

  return (
    <g className="equipment-pin-code-marker">
      <rect className="equipment-pin-body" x={x - 19} y={y - 16} width={38} height={32} rx={8} />
      <text className="equipment-pin-code" x={x} y={y}>{symbol.code}</text>
    </g>
  )
}

const inRect = (rect: EquipmentRect, point: { x: number; y: number }) =>
  point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height

function inPolygon(polygon: readonly { x: number; y: number }[], point: { x: number; y: number }): boolean {
  let inside = false
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const a = polygon[current]
    const b = polygon[previous]
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

const inArea = (area: EquipmentAreaDTO, point: { x: number; y: number }) =>
  area.polygon ? inPolygon(area.polygon, point) : Boolean(area.rect && inRect(area.rect, point))

function labelPositionAwayFromPins(area: EquipmentAreaDTO, pins: readonly EquipmentPinDTO[]): { x: number; y: number } {
  const label = area.label
  if (!label || !area.rect) return { x: 0, y: 0 }

  const areaPins = pins.filter((pin) => pin.areaCode === area.code && pin.x !== null && pin.y !== null)
  if (areaPins.length === 0) return { x: label.x, y: label.y }

  const lineHeight = label.fontSize * 1.25
  const labelHeight = Math.min(area.rect.height - 12, label.lines.length * lineHeight)
  const widestLine = Math.max(...label.lines.map((line) => [...line].length))
  const labelWidth = Math.min(area.rect.width - 8, widestLine * label.fontSize * 0.62 + 8)
  const minY = area.rect.y + labelHeight / 2 + 8
  const maxY = area.rect.y + area.rect.height - labelHeight / 2 - 8
  if (minY > maxY) return { x: label.x, y: label.y }

  const candidates = [...new Set([
    Math.max(minY, Math.min(maxY, label.y)),
    minY,
    maxY,
  ])]
  const score = (y: number) => areaPins.reduce((total, pin) => {
    const overlaps = Math.abs(pin.x! - label.x) < labelWidth / 2 + 20
      && Math.abs(pin.y! - y) < labelHeight / 2 + 20
    return total + (overlaps ? 10_000 : 0)
  }, Math.abs(y - label.y))
  const y = candidates.reduce((best, candidate) => score(candidate) < score(best) ? candidate : best)
  return { x: label.x, y }
}

export function EquipmentMapCanvas({
  viewBox,
  walls,
  doors,
  areas,
  pins,
  selectedAreaCode,
  selectedPinId,
  onSelectArea,
  onSelectPin,
  onCoordinateSelect,
  onMovePin,
  focus,
  hasActiveRound,
}: EquipmentMapCanvasProps) {
  const [view, setView] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 })
  const dragStart = useRef<{ pointerX: number; pointerY: number; viewX: number; viewY: number } | null>(null)
  const [draggedPin, setDraggedPin] = useState<PinDrag | null>(null)
  const [dragPreview, setDragPreview] = useState<PinDragPreview | null>(null)
  const draggedPinRef = useRef<PinDrag | null>(null)
  const dragPreviewRef = useRef<PinDragPreview | null>(null)
  const pendingPinDragRef = useRef<PinDrag | null>(null)
  const pinDragArmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressPinClickRef = useRef<string | null>(null)

  const [viewMinX, viewMinY, viewWidth, viewHeight] = useMemo(() => viewBox.split(' ').map(Number), [viewBox])

  const drawableAreas = useMemo(() => areas.filter((area) => area.hasGeometry && area.rect), [areas])
  // โซนย่อยต้องวาดทับห้องแม่ จึงเรียงห้องก่อนเสมอ
  const rooms = useMemo(() => drawableAreas.filter((area) => area.kind === 'room'), [drawableAreas])
  const zones = useMemo(() => drawableAreas.filter((area) => area.kind === 'zone'), [drawableAreas])
  const zoneParentCodes = useMemo(() => new Set(zones.map((zone) => zone.parentCode)), [zones])

  const areasWithMatches = useMemo(() => {
    if (focus === 'all') return null
    const codes = new Set<string>()
    for (const pin of pins) {
      if (matchesFocus(pin, focus)) codes.add(pin.areaCode)
    }
    return codes
  }, [pins, focus])

  function resetView() { setView({ scale: 1, x: 0, y: 0 }) }
  function changeZoom(delta: number) {
    setView((current) => ({ ...current, scale: Math.min(2.5, Math.max(0.75, current.scale + delta)) }))
  }

  function handleAreaKeyDown(event: KeyboardEvent<SVGGElement>, code: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onSelectArea(code)
  }

  function startPan(event: ReactPointerEvent<SVGSVGElement>) {
    const target = event.target as Element
    if (target.closest('[data-area-code], [data-pin-id]')) return
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function resolveSvgClientPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
    const point = svg.createSVGPoint()
    point.x = clientX
    point.y = clientY
    const matrix = svg.getScreenCTM()?.inverse()
    if (!matrix) return null
    const svgPoint = point.matrixTransform(matrix)
    return {
      x: Math.max(viewMinX, Math.min(viewMinX + viewWidth, (svgPoint.x - view.x) / view.scale)),
      y: Math.max(viewMinY, Math.min(viewMinY + viewHeight, (svgPoint.y - view.y) / view.scale)),
    }
  }

  function resolveSvgPoint(event: ReactMouseEvent<SVGSVGElement>): { x: number; y: number } | null {
    return resolveSvgClientPoint(event.currentTarget, event.clientX, event.clientY)
  }

  function clearPinDrag() {
    if (pinDragArmTimerRef.current) { clearTimeout(pinDragArmTimerRef.current); pinDragArmTimerRef.current = null }
    pendingPinDragRef.current = null
    draggedPinRef.current = null
    dragPreviewRef.current = null
    setDraggedPin(null)
    setDragPreview(null)
  }

  function startPinDrag(event: ReactPointerEvent<SVGGElement>, pin: EquipmentPinDTO) {
    if (!onMovePin || pin.x == null || pin.y == null) return
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const nextDrag: PinDrag = { id: pin.id, areaCode: pin.areaCode, pointerId: event.pointerId, x: pin.x, y: pin.y }
    pendingPinDragRef.current = nextDrag
    if (pinDragArmTimerRef.current) clearTimeout(pinDragArmTimerRef.current)
    // Nothing is armed yet — draggedPinRef/dragPreviewRef stay null, so movePinDrag ignores every
    // pointermove until this timer fires, which is what makes a quick click never move the pin.
    pinDragArmTimerRef.current = setTimeout(() => {
      pinDragArmTimerRef.current = null
      if (pendingPinDragRef.current?.pointerId !== nextDrag.pointerId) return
      const nextPreview: PinDragPreview = { id: nextDrag.id, x: nextDrag.x, y: nextDrag.y }
      draggedPinRef.current = nextDrag
      dragPreviewRef.current = nextPreview
      setDraggedPin(nextDrag)
      setDragPreview(nextPreview)
    }, PIN_DRAG_HOLD_MS)
  }

  function movePinDrag(event: ReactPointerEvent<SVGGElement>) {
    const draggedPin = draggedPinRef.current
    if (!draggedPin || event.pointerId !== draggedPin.pointerId) return
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    event.stopPropagation()
    const point = resolveSvgClientPoint(svg, event.clientX, event.clientY)
    const assignedArea = areas.find((area) => area.code === draggedPin.areaCode)
    if (!point || !assignedArea || !assignedArea.hasGeometry || !inArea(assignedArea, point)) return
    const nextPreview: PinDragPreview = { id: draggedPin.id, x: point.x, y: point.y }
    dragPreviewRef.current = nextPreview
    setDragPreview(nextPreview)
  }

  function finishPinDrag(event: ReactPointerEvent<SVGGElement>) {
    const pending = pendingPinDragRef.current
    if (!pending || event.pointerId !== pending.pointerId) return
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const draggedPin = draggedPinRef.current
    const dragPreview = dragPreviewRef.current
    clearPinDrag()
    if (!draggedPin || !dragPreview || (dragPreview.x === draggedPin.x && dragPreview.y === draggedPin.y)) return
    suppressPinClickRef.current = draggedPin.id
    onMovePin?.({ id: draggedPin.id, areaCode: draggedPin.areaCode, x: Math.round(dragPreview.x), y: Math.round(dragPreview.y) })
  }

  function handleCanvasClick(event: ReactMouseEvent<SVGSVGElement>) {
    if (!onCoordinateSelect) return
    const target = event.target as Element
    if (target.closest('[data-pin-id]')) return
    const point = resolveSvgPoint(event)
    if (!point) return
    // เลือกโซนย่อยก่อนห้องแม่เสมอ เพราะเจาะจงกว่า
    const zoneMatch = zones.find((area) => inArea(area, point))
    const roomMatch = zoneMatch ? null : rooms.find((area) => inArea(area, point))
    const match = zoneMatch ?? roomMatch
    if (!match) {
      onCoordinateSelect({ error: 'outside_area' })
      return
    }
    onCoordinateSelect({ areaCode: match.code, x: Math.round(point.x), y: Math.round(point.y) })
  }

  const renderArea = (area: EquipmentAreaDTO) => {
    if (!area.rect) return null
    const isSelected = selectedAreaCode === area.code
    const isDimmed = areasWithMatches !== null && !areasWithMatches.has(area.code)
    // ห้องที่ถูกซอยเป็นโซนแล้ว ไม่ต้องระบายทับโซนลูก แค่วาดกรอบไว้
    const isSplitRoom = area.kind === 'room' && zoneParentCodes.has(area.code)
    return (
      <g
        key={area.code}
        className="lab-map-space equipment-map-space"
        data-area-code={area.code}
        data-selected={isSelected || undefined}
        data-dimmed={isDimmed || undefined}
        data-split-room={isSplitRoom || undefined}
        role="button"
        tabIndex={0}
        aria-label={`${area.nameTh}${area.kind === 'zone' ? ' (โซน)' : ' (ห้อง)'}`}
        onClick={(event) => { if (!onCoordinateSelect) { event.stopPropagation(); onSelectArea(area.code) } }}
        onKeyDown={(event) => handleAreaKeyDown(event, area.code)}
        style={{ '--space-fill': 'var(--map-controlled)' } as React.CSSProperties}
      >
        {area.polygon ? (
          <polygon points={area.polygon.map((point) => `${point.x},${point.y}`).join(' ')} />
        ) : (
          <rect x={area.rect.x} y={area.rect.y} width={area.rect.width} height={area.rect.height} />
        )}
      </g>
    )
  }

  const renderLabel = (area: EquipmentAreaDTO) => {
    if (!area.label) return null
    const { x, y } = labelPositionAwayFromPins(area, pins)
    const { lines, fontSize } = area.label
    const lineHeight = fontSize * 1.25
    const firstY = y - ((lines.length - 1) * lineHeight) / 2
    return (
      <text
        key={area.code}
        className="lab-map-label"
        x={x}
        y={firstY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
      >
        {lines.map((line, index) => (
          <tspan key={index} x={x} dy={index === 0 ? 0 : lineHeight}>{line}</tspan>
        ))}
      </text>
    )
  }

  return (
    <section className="lab-map-canvas-frame" aria-label="แผนผังเครื่องมือ">
      <div className="lab-map-zoom-controls" aria-label="เครื่องมือย่อขยายแผนที่">
        <button type="button" onClick={() => changeZoom(0.2)} aria-label="ขยายแผนที่">+</button>
        <button type="button" onClick={() => changeZoom(-0.2)} aria-label="ย่อแผนที่">−</button>
        <button type="button" className="lab-map-reset" onClick={resetView}>คืนมุมมอง</button>
      </div>

      <div className="lab-map-svg-scroll">
        <svg
          className="lab-map-svg"
          viewBox={viewBox}
          preserveAspectRatio="xMidYMin meet"
          role="img"
          aria-label="แผนผังเครื่องมือ ชั้น 3 กลุ่มงานเทคนิคการแพทย์"
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={stopPan}
          onPointerCancel={stopPan}
          onClick={handleCanvasClick}
          style={{ cursor: onCoordinateSelect ? 'crosshair' : undefined }}
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
            <rect className="lab-map-floor" x={viewMinX} y={viewMinY} width={viewWidth} height={viewHeight} rx="6" />

            {rooms.map(renderArea)}
            {zones.map(renderArea)}

            <g className="lab-map-structures" aria-hidden="true">
              {walls.map((item) => (
                <path key={item.code} className="lab-map-structure lab-map-structure--wall" d={item.d} />
              ))}
              {doors.map((item) => {
                const width = item.orientation === 'horizontal' ? item.length : 6
                const height = item.orientation === 'horizontal' ? 6 : item.length
                return <rect key={item.code} className="equipment-map-door" x={item.x - width / 2} y={item.y - height / 2} width={width} height={height} rx="1" />
              })}
            </g>

            <g className="lab-map-labels" aria-hidden="true">
              {drawableAreas.map(renderLabel)}
            </g>

            {pins.map((pin) => {
              if (pin.x == null || pin.y == null) return null
              const preview = dragPreview?.id === pin.id ? dragPreview : null
              const pinX = preview?.x ?? pin.x
              const pinY = preview?.y ?? pin.y
              const pinRotation = pin.rotation
              const isDimmed = !matchesFocus(pin, focus)
              const symbol = getEquipmentPinSymbol(pin.classification, pin.name)
              return (
                <g
                  key={pin.id}
                  className="equipment-pin"
                  data-pin-id={pin.id}
                  data-due={pin.due}
                  data-surveyed={hasActiveRound ? String(pin.surveyed) : 'none'}
                  data-selected={selectedPinId === pin.id || undefined}
                  data-dimmed={isDimmed || undefined}
                  data-draggable={onMovePin ? '' : undefined}
                  data-dragging={draggedPin?.id === pin.id || undefined}
                  role="button"
                  tabIndex={0}
                  aria-label={`${pin.name}${pin.code ? ' ' + pin.code : ''} — ${symbol.label} — ${pin.status}`}
                  onPointerDown={(event) => startPinDrag(event, pin)}
                  onPointerMove={movePinDrag}
                  onPointerUp={finishPinDrag}
                  onPointerCancel={clearPinDrag}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (suppressPinClickRef.current === pin.id) {
                      suppressPinClickRef.current = null
                      return
                    }
                    onSelectPin(pin.id)
                  }}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectPin(pin.id) } }}
                >
                  <g className="equipment-pin-scale" transform={`rotate(${pinRotation} ${pinX} ${pinY}) translate(${pinX} ${pinY}) scale(0.7) translate(${-pinX} ${-pinY})`}>
                    <PinShape x={pinX} y={pinY} symbol={symbol} />
                  </g>
                </g>
              )
            })}

            {/* Badges paint in their own pass, after every pin body, so a badge is never hidden
                behind a neighboring pin — SVG paints in document order, and a fixed offset badge
                can otherwise land underneath whichever pin happens to be drawn later. */}
            <g className="equipment-pin-badge-layer" aria-hidden="true">
              {pins.map((pin) => {
                if (pin.x == null || pin.y == null) return null
                const flag = pinGlyph(pin)
                if (!flag) return null
                const preview = dragPreview?.id === pin.id ? dragPreview : null
                const pinX = preview?.x ?? pin.x
                const pinY = preview?.y ?? pin.y
                const pinRotation = pin.rotation
                const isDimmed = !matchesFocus(pin, focus)
                return (
                  <g key={`badge-${pin.id}`} className="equipment-pin-badge" data-due={pin.due} data-dimmed={isDimmed || undefined}>
                    <g transform={`rotate(${pinRotation} ${pinX} ${pinY}) translate(${pinX} ${pinY}) scale(0.7) translate(${-pinX} ${-pinY})`}>
                      {/* Leader line ties the badge back to its own pin so a crowded cluster of pins doesn't leave it ambiguous which badge belongs to which pin. */}
                      <line className="equipment-pin-status-leader" x1={pinX} y1={pinY} x2={pinX + 16} y2={pinY - 16} />
                      <g className="equipment-pin-status-badge" transform={`translate(${pinX + 16} ${pinY - 16})`}>
                        <circle r={7} />
                        <text className="equipment-pin-glyph" x={0} y={0}>{flag}</text>
                      </g>
                    </g>
                  </g>
                )
              })}
            </g>
          </g>
        </svg>
      </div>
    </section>
  )
}
