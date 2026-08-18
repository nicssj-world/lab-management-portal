'use client'

import { useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
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
  onCoordinateSelect?: (x: number, y: number) => void
  onMoveSafetyEquipment?: (input: { id: string; code: string; x: number; y: number; spaceCode: string | null }) => void
  showAllSafetyEquipment?: boolean
  draftSafetyEquipment?: Pick<LabSafetyEquipmentDefinition, 'code' | 'nameTh' | 'kind' | 'x' | 'y'> | null
  onMoveDraftSafetyEquipment?: (input: { x: number; y: number; spaceCode: string | null }) => void
  spaceTones?: Readonly<Record<string, 'low' | 'medium' | 'high' | 'unassessed'>>
  highlightedSpaceCodes?: readonly string[]
  /** จุดสแกนปลายทางของเส้นทางที่กำลังแสดง — ไฮไลต์และประกาศให้ผู้ใช้ทราบว่าเส้นทางจบที่นี่ */
  destinationPointCode?: string | null
  /** สถานีที่ใช้วางหมุด "คุณอยู่ที่นี่" — ไม่ระบุ = ใช้ map.stationCode ตามเดิม */
  activeStationCode?: string | null
  /**
   * บังคับให้แสดงหมุด "คุณอยู่ที่นี่" และกรองจุดสแกน/ประตูเหลือเฉพาะที่เกี่ยวกับเส้นทางที่กำลังแสดง
   * เหมือนโหมดเส้นทางหนีไฟ — ใช้กับแผ่นนำทางผู้มาติดต่อซึ่งโฟกัสเส้นทางเดียวแต่ไม่ใช่โหมด 'safety'
   * (ไม่ดึงกากบาทห้ามใช้ลิฟต์มาด้วย นั่นเป็นความหมายเฉพาะเหตุฉุกเฉินเท่านั้น)
   */
  stationFocused?: boolean
  interactive?: boolean
}

interface ViewTransform {
  scale: number
  x: number
  y: number
}

const RESTRICTED_LIFT_CODES = new Set<string>(EVACUATION_RESTRICTED_SPACE_CODES)
const SAFETY_DRAG_HOLD_MS = 250
const SAFETY_DRAG_MOVE_THRESHOLD_PX = 4

interface SafetyDrag {
  id: string
  code: string
  pointerId: number
  clientX: number
  clientY: number
  x: number
  y: number
}

interface SafetyDragPreview {
  code: string
  x: number
  y: number
  spaceCode: string | null
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

function fillForSpace(space: LabMapSpaceDTO, mode: MapMode, patternIds: Record<string, string>, riskTone?: string): string {
  if (riskTone === 'high') return 'color-mix(in srgb,var(--danger) 42%,var(--map-room))'
  if (riskTone === 'medium') return 'color-mix(in srgb,var(--warning) 38%,var(--map-room))'
  if (riskTone === 'low') return 'color-mix(in srgb,var(--success) 30%,var(--map-room))'
  if (riskTone === 'unassessed') return 'color-mix(in srgb,var(--muted) 24%,var(--map-room))'
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
  if (item.kind === 'manual-call-point') return <polygon points={`${item.x},${item.y - 10} ${item.x + 9},${item.y + 7} ${item.x - 9},${item.y + 7}`} />
  if (item.kind === 'aed') return <path d={`M ${item.x} ${item.y + 10} C ${item.x - 18} ${item.y}, ${item.x - 8} ${item.y - 13}, ${item.x} ${item.y - 5} C ${item.x + 8} ${item.y - 13}, ${item.x + 18} ${item.y}, ${item.x} ${item.y + 10} M ${item.x + 2} ${item.y - 7} L ${item.x - 3} ${item.y + 1} H ${item.x + 2} L ${item.x - 2} ${item.y + 8}`} />
  if (item.kind === 'first-aid-kit') return <path d={`M ${item.x - 10} ${item.y - 7} H ${item.x + 10} V ${item.y + 8} H ${item.x - 10} Z M ${item.x - 3} ${item.y} H ${item.x + 3} M ${item.x} ${item.y - 3} V ${item.y + 3}`} />
  if (item.kind === 'eyewash' || item.kind === 'nss-eyewash') return <path d={`M ${item.x - 10} ${item.y} Q ${item.x} ${item.y - 10} ${item.x + 10} ${item.y} Q ${item.x} ${item.y + 10} ${item.x - 10} ${item.y} M ${item.x} ${item.y - 4} A 4 4 0 1 0 ${item.x} ${item.y + 4} A 4 4 0 1 0 ${item.x} ${item.y - 4}`} />
  if (item.kind === 'emergency-shower') return <path d={`M ${item.x - 8} ${item.y - 7} H ${item.x + 8} M ${item.x} ${item.y - 12} V ${item.y - 7} M ${item.x - 6} ${item.y - 3} L ${item.x - 9} ${item.y + 4} M ${item.x} ${item.y - 3} V ${item.y + 7} M ${item.x + 6} ${item.y - 3} L ${item.x + 9} ${item.y + 4}`} />
  if (item.kind === 'spill-kit') return <path d={`M ${item.x - 9} ${item.y - 8} H ${item.x + 9} V ${item.y + 9} H ${item.x - 9} Z M ${item.x - 5} ${item.y - 8} V ${item.y - 12} H ${item.x + 5} V ${item.y - 8} M ${item.x} ${item.y - 4} V ${item.y + 5}`} />
  if (item.kind === 'emergency-shutoff') return <path d={`M ${item.x - 10} ${item.y} H ${item.x + 10} M ${item.x} ${item.y - 10} V ${item.y + 10} M ${item.x - 7} ${item.y - 7} L ${item.x + 7} ${item.y + 7}`} />
  return <circle cx={item.x} cy={item.y} r={9} />
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
  onCoordinateSelect,
  onMoveSafetyEquipment,
  showAllSafetyEquipment = false,
  draftSafetyEquipment = null,
  onMoveDraftSafetyEquipment,
  spaceTones,
  highlightedSpaceCodes = [],
  destinationPointCode = null,
  activeStationCode = null,
  stationFocused = false,
  interactive = true,
}: LabMapCanvasProps) {
  const rawId = useId()
  const idPrefix = rawId.replace(/:/g, '')
  const patternIds = useMemo(
    () => ({ infectious: `${idPrefix}-infectious`, risk: `${idPrefix}-risk` }),
    [idPrefix],
  )
  const [view, setView] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 })
  const dragStart = useRef<{ pointerId: number; clientX: number; clientY: number; svgX: number; svgY: number; viewX: number; viewY: number } | null>(null)
  const activePointers = useRef(new Map<number, { clientX: number; clientY: number; svgX: number; svgY: number }>())
  const pinchStart = useRef<{
    initialDistance: number
    initialScale: number
    contentX: number
    contentY: number
  } | null>(null)
  const didGesture = useRef(false)
  const [pendingSafetyCode, setPendingSafetyCode] = useState<string | null>(null)
  const [draggedSafetyCode, setDraggedSafetyCode] = useState<string | null>(null)
  const [safetyDragPreview, setSafetyDragPreview] = useState<SafetyDragPreview | null>(null)
  const pendingSafetyDragRef = useRef<SafetyDrag | null>(null)
  const draggedSafetyRef = useRef<SafetyDrag | null>(null)
  const safetyDragPreviewRef = useRef<SafetyDragPreview | null>(null)
  const safetyDragArmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressSafetyClickRef = useRef<string | null>(null)

  const activeRoutes = useMemo(
    () => map.routes.filter((route) => activeRouteCodes.includes(route.code)),
    [map.routes, activeRouteCodes],
  )
  const highlighted = useMemo(() => new Set(highlightedSpaceCodes), [highlightedSpaceCodes])
  const resolvedStationCode = activeStationCode ?? map.stationCode
  // หมุด "คุณอยู่ที่นี่" มีความหมายเฉพาะตอนดูเส้นทางหนีไฟหรือแผ่นนำทางผู้มาติดต่อ (stationFocused) —
  // โหมดพื้นที่/หน่วยงานและเขตควบคุมการติดเชื้ออ่านข้อมูลคนละแบบ หมุดตำแหน่งผู้ใช้ไม่เกี่ยวและรบกวนการอ่านผังเปล่า ๆ
  const station = mode === 'safety' || stationFocused
    ? map.stations.find((item) => item.code === resolvedStationCode) ?? null
    : null

  /**
   * โหมดความปลอดภัยและแผ่นนำทางผู้มาติดต่อ (stationFocused) แสดงเฉพาะสิ่งที่เกี่ยวกับเส้นทางเดียวที่กำลังแสดง —
   * ทางออก ประตูล็อคถาวร และจุดสแกนที่อยู่บนเส้นทางนั้นเท่านั้น จุดสแกนอื่นถูกซ่อนเพื่อไม่ให้อ่านผิด/รก
   */
  const routePointCodes = useMemo(
    () => new Set(activeRoutes.flatMap((route) => [...route.pointCodes, route.destinationCode])),
    [activeRoutes],
  )
  const visiblePoints = map.accessPoints.filter((point) => {
    if (mode === 'safety-assets') return false
    if (mode !== 'safety' && !stationFocused) return true
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

  function resolveSvgViewportPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
    const point = svg.createSVGPoint()
    point.x = clientX
    point.y = clientY
    const matrix = svg.getScreenCTM()?.inverse()
    return matrix ? point.matrixTransform(matrix) : null
  }

  function resolveSafetyDragPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
    const svgPoint = resolveSvgViewportPoint(svg, clientX, clientY)
    if (!svgPoint) return null
    const spaceElement = document.elementsFromPoint(clientX, clientY)
      .map(element => element.closest('[data-space-code]'))
      .find((element): element is Element => Boolean(element))
    return {
      x: Math.max(0, Math.min(1477, (svgPoint.x - view.x) / view.scale)),
      y: Math.max(0, Math.min(892, (svgPoint.y - view.y) / view.scale)),
      spaceCode: spaceElement?.getAttribute('data-space-code') ?? null,
    }
  }

  function clearSafetyDrag() {
    if (safetyDragArmTimerRef.current) {
      clearTimeout(safetyDragArmTimerRef.current)
      safetyDragArmTimerRef.current = null
    }
    pendingSafetyDragRef.current = null
    draggedSafetyRef.current = null
    safetyDragPreviewRef.current = null
    setPendingSafetyCode(null)
    setDraggedSafetyCode(null)
    setSafetyDragPreview(null)
  }

  function armSafetyDrag(pending: SafetyDrag) {
    if (pendingSafetyDragRef.current?.pointerId !== pending.pointerId || draggedSafetyRef.current) return
    if (safetyDragArmTimerRef.current) {
      clearTimeout(safetyDragArmTimerRef.current)
      safetyDragArmTimerRef.current = null
    }
    const preview: SafetyDragPreview = { code: pending.code, x: pending.x, y: pending.y, spaceCode: null }
    draggedSafetyRef.current = pending
    safetyDragPreviewRef.current = preview
    setDraggedSafetyCode(pending.code)
    setSafetyDragPreview(preview)
  }

  function startSafetyDrag(event: ReactPointerEvent<SVGGElement>, item: LabSafetyEquipmentDefinition & { id?: string }) {
    const isDraft = item.code === draftSafetyEquipment?.code && !item.id
    if ((!isDraft && (!onMoveSafetyEquipment || !item.id)) || (isDraft && !onMoveDraftSafetyEquipment)) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const pending: SafetyDrag = {
      id: item.id ?? '__draft__', code: item.code, pointerId: event.pointerId,
      clientX: event.clientX, clientY: event.clientY, x: item.x, y: item.y,
    }
    pendingSafetyDragRef.current = pending
    setPendingSafetyCode(item.code)
    if (safetyDragArmTimerRef.current) clearTimeout(safetyDragArmTimerRef.current)
    safetyDragArmTimerRef.current = setTimeout(() => {
      safetyDragArmTimerRef.current = null
      armSafetyDrag(pending)
    }, SAFETY_DRAG_HOLD_MS)
  }

  function moveSafetyDrag(event: ReactPointerEvent<SVGGElement>) {
    const pending = pendingSafetyDragRef.current
    if (!pending || event.pointerId !== pending.pointerId) return
    event.stopPropagation()
    if (!draggedSafetyRef.current) {
      const distance = Math.hypot(event.clientX - pending.clientX, event.clientY - pending.clientY)
      if (distance < SAFETY_DRAG_MOVE_THRESHOLD_PX) return
      armSafetyDrag(pending)
    }
    const dragged = draggedSafetyRef.current
    if (!dragged) return
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    const point = resolveSafetyDragPoint(svg, event.clientX, event.clientY)
    if (!point) return
    const preview = { code: dragged.code, ...point }
    safetyDragPreviewRef.current = preview
    setSafetyDragPreview(preview)
  }

  function finishSafetyDrag(event: ReactPointerEvent<SVGGElement>) {
    const pending = pendingSafetyDragRef.current
    if (!pending || event.pointerId !== pending.pointerId) return
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const dragged = draggedSafetyRef.current
    const preview = safetyDragPreviewRef.current
    clearSafetyDrag()
    if (!dragged || !preview || (preview.x === dragged.x && preview.y === dragged.y)) return
    suppressSafetyClickRef.current = dragged.code
    const position = { x: Math.round(preview.x), y: Math.round(preview.y), spaceCode: preview.spaceCode }
    if (dragged.id === '__draft__') onMoveDraftSafetyEquipment?.(position)
    else onMoveSafetyEquipment?.({ id: dragged.id, code: dragged.code, ...position })
  }

  function pointerPair() {
    const pointers = [...activePointers.current.values()]
    return pointers.length >= 2 ? [pointers[0], pointers[1]] as const : null
  }

  function beginPinch() {
    const pair = pointerPair()
    if (!pair) return
    const [first, second] = pair
    const centerX = (first.svgX + second.svgX) / 2
    const centerY = (first.svgY + second.svgY) / 2
    pinchStart.current = {
      initialDistance: Math.hypot(second.svgX - first.svgX, second.svgY - first.svgY),
      initialScale: view.scale,
      contentX: (centerX - view.x) / view.scale,
      contentY: (centerY - view.y) / view.scale,
    }
    dragStart.current = null
    didGesture.current = true
  }

  function consumeGestureClick() {
    if (!didGesture.current) return false
    didGesture.current = false
    return true
  }

  function startPan(event: ReactPointerEvent<SVGSVGElement>) {
    if (!interactive) return
    const target = event.target as Element
    if (target.closest('[data-equipment-code]')) return
    const svgPoint = resolveSvgViewportPoint(event.currentTarget, event.clientX, event.clientY)
    if (!svgPoint) return
    activePointers.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY, svgX: svgPoint.x, svgY: svgPoint.y })
    if (activePointers.current.size >= 2) {
      beginPinch()
    } else {
      dragStart.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, svgX: svgPoint.x, svgY: svgPoint.y, viewX: view.x, viewY: view.y }
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function movePan(event: ReactPointerEvent<SVGSVGElement>) {
    const pointer = activePointers.current.get(event.pointerId)
    if (!pointer) return
    const svgPoint = resolveSvgViewportPoint(event.currentTarget, event.clientX, event.clientY)
    if (!svgPoint) return
    pointer.clientX = event.clientX
    pointer.clientY = event.clientY
    pointer.svgX = svgPoint.x
    pointer.svgY = svgPoint.y

    const pinch = pinchStart.current
    const pair = pointerPair()
    if (pinch && pair) {
      const [first, second] = pair
      const distance = Math.hypot(second.svgX - first.svgX, second.svgY - first.svgY)
      if (pinch.initialDistance === 0) return
      const scale = Math.min(2.5, Math.max(0.75, pinch.initialScale * distance / pinch.initialDistance))
      const centerX = (first.svgX + second.svgX) / 2
      const centerY = (first.svgY + second.svgY) / 2
      setView({
        scale,
        x: centerX - pinch.contentX * scale,
        y: centerY - pinch.contentY * scale,
      })
      return
    }

    const start = dragStart.current
    if (!start) return
    if (event.pointerId !== start.pointerId) return
    const distance = Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY)
    if (distance > 4) didGesture.current = true
    setView((current) => ({
      ...current,
      x: start.viewX + svgPoint.x - start.svgX,
      y: start.viewY + svgPoint.y - start.svgY,
    }))
  }

  function stopPan(event: ReactPointerEvent<SVGSVGElement>) {
    activePointers.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (activePointers.current.size >= 2) {
      beginPinch()
      return
    }
    pinchStart.current = null
    const remaining = activePointers.current.entries().next().value as [number, { clientX: number; clientY: number; svgX: number; svgY: number }] | undefined
    dragStart.current = remaining
      ? { pointerId: remaining[0], clientX: remaining[1].clientX, clientY: remaining[1].clientY, svgX: remaining[1].svgX, svgY: remaining[1].svgY, viewX: view.x, viewY: view.y }
      : null
  }

  function selectCoordinate(event: ReactMouseEvent<SVGSVGElement | SVGGElement>) {
    if (!onCoordinateSelect) return
    const svg = event.currentTarget instanceof SVGSVGElement
      ? event.currentTarget
      : event.currentTarget.ownerSVGElement
    if (!svg) return
    const svgPoint = resolveSvgViewportPoint(svg, event.clientX, event.clientY)
    if (!svgPoint) return
    onCoordinateSelect(
      Math.max(0, Math.min(1477, (svgPoint.x - view.x) / view.scale)),
      Math.max(0, Math.min(892, (svgPoint.y - view.y) / view.scale)),
    )
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
          onClick={(event) => {
            if (consumeGestureClick()) return
            selectCoordinate(event)
          }}
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
                  data-risk-level={spaceTones?.[space.code]}
                  role={interactive ? 'button' : undefined}
                  tabIndex={interactive ? 0 : -1}
                  aria-label={`${space.nameTh}${space.controlled ? ' พื้นที่ควบคุม' : ''}`}
                  onClick={(event) => {
                    if (consumeGestureClick()) {
                      event.stopPropagation()
                      return
                    }
                    if (onCoordinateSelect) {
                      event.stopPropagation()
                      selectCoordinate(event)
                      return
                    }
                    if (interactive) onSelect(space.code)
                  }}
                  onKeyDown={(event) => handleSpaceKeyDown(event, space.code)}
                  style={{ '--space-fill': fillForSpace(space, mode, patternIds, spaceTones?.[space.code]) } as React.CSSProperties}
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

            {mode === 'safety' || mode === 'safety-assets' ? (
              <g className="lab-map-safety-equipment">
                {[...map.safetyEquipment, ...(draftSafetyEquipment ? [{ ...draftSafetyEquipment, verified: false }] : [])]
                  .filter((item) => showAllSafetyEquipment || onMoveSafetyEquipment || draftSafetyEquipment
                    ? true
                    : mode === 'safety' ? item.kind === 'fire-extinguisher' : item.kind !== 'fire-extinguisher')
                  .map((sourceItem) => {
                  const item = safetyDragPreview?.code === sourceItem.code
                    ? { ...sourceItem, x: safetyDragPreview.x, y: safetyDragPreview.y }
                    : sourceItem
                  const draggableItem = sourceItem as LabSafetyEquipmentDefinition & { id?: string }
                  return (
                  <g
                    key={item.code}
                    className={`lab-map-equipment lab-map-equipment--${item.kind}`}
                    data-verified={item.verified || undefined}
                    data-operational-status={item.operationalStatus}
                    data-equipment-code={item.code}
                    data-draft={item.code === draftSafetyEquipment?.code || undefined}
                    data-selected={selectedCode === item.code || undefined}
                    data-drag-pending={pendingSafetyCode === item.code || undefined}
                    data-dragging={draggedSafetyCode === item.code || undefined}
                    role={interactive ? 'button' : 'img'}
                    tabIndex={interactive ? 0 : -1}
                    aria-label={`${item.nameTh}${item.verified ? '' : ' — รอยืนยันตำแหน่ง'}${item.operationalStatus === 'failed' ? ' — ไม่พร้อมใช้' : ''}${selectedCode === item.code ? ' — กำลังเลือก' : ''}`}
                    onPointerDown={(event) => startSafetyDrag(event, draggableItem)}
                    onPointerMove={moveSafetyDrag}
                    onPointerUp={finishSafetyDrag}
                    onPointerCancel={clearSafetyDrag}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (suppressSafetyClickRef.current === item.code) {
                        suppressSafetyClickRef.current = null
                        return
                      }
                      if (interactive) onSelect(item.code)
                    }}
                    onKeyDown={(event) => handleSpaceKeyDown(event, item.code)}
                  >
                    {selectedCode === item.code || item.code === draftSafetyEquipment?.code || pendingSafetyCode === item.code || draggedSafetyCode === item.code
                      ? <circle className="lab-map-equipment-selection-halo" cx={item.x} cy={item.y} r={19} />
                      : null}
                    <g className="lab-map-equipment-icon">{safetyEquipmentSymbol(item)}</g>
                    {selectedCode === item.code || item.code === draftSafetyEquipment?.code
                      ? <text className="lab-map-equipment-selection-label" x={item.x} y={item.y - 25} textAnchor="middle">{item.nameTh}</text>
                      : null}
                    {item.operationalStatus === 'failed' ? (
                      <path className="lab-map-equipment-alert" d={`M ${item.x - 11} ${item.y - 11} L ${item.x + 11} ${item.y + 11} M ${item.x + 11} ${item.y - 11} L ${item.x - 11} ${item.y + 11}`} />
                    ) : null}
                  </g>
                  )})}
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
      <p className="lab-map-safety-drag-status" aria-live="polite">
        {draggedSafetyCode ? 'ลากเพื่อย้ายตำแหน่ง ปล่อยเพื่อบันทึก' : pendingSafetyCode ? 'กดค้างเพื่อเริ่มลาก…' : ''}
      </p>
    </section>
  )
}
