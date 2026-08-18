import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const canvas = readFileSync('components/lab-map/LabMapCanvas.tsx', 'utf8')
const shell = readFileSync('components/lab-map/LabMapShell.tsx', 'utf8')
const styles = readFileSync('components/lab-map/LabMapStyles.tsx', 'utf8')
const types = readFileSync('lib/lab-map/types.ts', 'utf8')

assert.match(canvas, /^'use client'/)
assert.match(canvas, /<svg/)
assert.match(canvas, /data-space-code=/)
assert.match(canvas, /role=\{interactive \? 'button'/)
assert.match(canvas, /interactive \? 0 : -1/)
assert.match(canvas, /tabIndex=/)
assert.match(canvas, /onKeyDown=/)
assert.match(canvas, /<pattern/)
assert.match(canvas, /aria-label=/)
assert.match(canvas, /resetView/)
assert.match(canvas, /const start = dragStart\.current/)
assert.match(canvas, /if \(!start\) return/)
assert.doesNotMatch(canvas, /dragStart\.current!\.viewX/)
assert.doesNotMatch(canvas, /dragStart\.current!\.viewY/)
assert.doesNotMatch(canvas, /from ['"]@\/lib\/lab-map\/manifest['"]/)

// ── Mobile gestures ──
// Rooms cover almost the whole SVG, so panning must begin from a room as well as empty floor.
const labMapStartPan = canvas.match(/function startPan[\s\S]*?\n  function movePan/)?.[0] ?? ''
assert.match(labMapStartPan, /target\.closest\('\[data-equipment-code\]'\)/, 'equipment markers must not start a map pan')
assert.doesNotMatch(labMapStartPan, /data-space-code/, 'room taps must remain eligible to begin a map pan')
assert.match(canvas, /const activePointers = useRef\(new Map<number, \{ clientX: number; clientY: number; svgX: number; svgY: number \}>\(\)\)/, 'the map must track simultaneous pointers in screen and SVG coordinates')
assert.match(canvas, /activePointers\.current\.size >= 2/, 'two-finger input must enter a pinch gesture')
assert.match(canvas, /initialDistance/, 'pinch zoom must calculate scale from the initial finger distance')
assert.match(canvas, /didGesture/, 'a completed pan or pinch must not also select a room on click')
assert.match(canvas, /function resolveSvgViewportPoint\(/, 'dragging must convert screen coordinates through the SVG viewport matrix')
assert.doesNotMatch(canvas, /const factor = 1 \/ view\.scale/, 'dragging must not treat CSS pixels as SVG units')

// ── ชั้นข้อมูลใหม่ ──
assert.match(canvas, /StructureLayer/, 'structural geometry is rendered as its own layer')
assert.match(canvas, /map\.labels\.map/, 'labels come from the manifest, not from truncated room names')
assert.doesNotMatch(canvas, /labelLines/, 'no automatic label wrapping remains')
assert.doesNotMatch(canvas, /slice\(0, 3\)/, 'no three-line truncation remains')

// ── หัวลูกศร สถานี และเส้นทางสองแบบ ──
assert.match(canvas, /<marker/, 'route arrowheads are defined')
assert.match(canvas, /markerMid=/)
assert.match(canvas, /markerEnd=/)
assert.match(canvas, /arrow-alternate/)
assert.match(canvas, /คุณอยู่ที่นี่/, 'the active station is labelled')
// หมุด "คุณอยู่ที่นี่" ต้องไม่ขึ้นในโหมดเขตควบคุมการติดเชื้อ
// หมุด "คุณอยู่ที่นี่" แสดงเฉพาะโหมดความปลอดภัย หรือเมื่อผู้เรียกขอ (stationFocused) อย่างแผ่นนำทางผู้มาติดต่อ —
// ไม่โผล่ในโหมดพื้นที่/หน่วยงานหรือเขตควบคุมการติดเชื้อตามปกติ
assert.match(canvas, /mode === 'safety' \|\| stationFocused\s*\n\s*\? map\.stations\.find/, 'the station marker only renders in safety mode or when explicitly focused')
assert.match(canvas, /data-variant=\{route\.variant\}/)
assert.match(canvas, /data-destination=/, 'the destination checkpoint is highlighted')
assert.match(styles, /\.lab-map-route\[data-variant="primary"\]/)
assert.match(styles, /\.lab-map-route\[data-variant="alternate"\][\s\S]*?stroke-dasharray/)
assert.match(styles, /\.lab-map-structure--scanner-barrier/)

// โหมดความปลอดภัย (หรือ stationFocused) ซ่อนจุดสแกนที่ไม่เกี่ยวกับเส้นทางที่กำลังแสดง
assert.match(canvas, /mode !== 'safety' && !stationFocused\) return true/)

// ── ไม่มีโหมดบุคลากรเหลืออยู่ ──
assert.doesNotMatch(types.match(/export type MapMode[^\n]+/)?.[0] ?? '', /personnel/)
for (const source of [canvas, shell]) assert.doesNotMatch(source, /personnel|บุคลากร/)

assert.match(shell, /aria-pressed=/)
assert.match(shell, /type="search"/)
assert.match(shell, /คำอธิบายสัญลักษณ์ความปลอดภัย/, 'safety mode has a legend')
assert.match(shell, /เส้นทางหลัก/)
assert.match(shell, /เส้นทางสำรอง/)
assert.match(shell, /ประตูล็อคถาวร/)
assert.match(shell, /เดินตามป้ายทางหนีไฟจริง/, 'missing presets fail closed with physical-sign guidance')
assert.match(shell, /evacuationRoutes/, 'evacuation presets are selected automatically by station')

assert.match(styles, /min-height:\s*44px/)
assert.match(styles, /min-width:\s*44px/)
assert.match(styles, /@media\s*\(max-width:\s*767px\)/)
assert.match(styles, /prefers-reduced-motion/)
assert.match(styles, /:focus-visible/)

// ── สถานีความปลอดภัยเลือกได้ — จุดเริ่มต้นของแผนหนีไฟตรงกับตำแหน่งจริง ไม่ใช่แผนสำนักงานเสมอ ──
assert.match(canvas, /activeStationCode/, 'the canvas can render the "you are here" pin at a caller-chosen station')
assert.match(shell, /import { FilterChips }/, 'the station picker reuses the shared FilterChips control')
assert.match(shell, /safetyStationCode/)
assert.match(shell, /initialSafetyStationCode/)
assert.match(shell, /lab-map-station-picker/)

// ── ลิฟต์ที่ห้ามใช้ขณะเกิดเหตุ — ไม่สื่อด้วยสีอย่างเดียว ต้องมีลายกากบาทและ aria-label ──
assert.match(canvas, /EVACUATION_RESTRICTED_SPACE_CODES/)
assert.match(canvas, /ห้ามใช้ลิฟต์ขณะเกิดเหตุ/)
assert.match(styles, /\.lab-map-lift-restricted-cross/)
assert.match(shell, /data-class="lift-restricted"/)

// ── อุปกรณ์ความปลอดภัย — แยกรูปทรงต่อชนิด จุดที่ยังไม่ยืนยันมีลักษณะภาพต่างจากจุดที่ยืนยันแล้ว ──
assert.match(canvas, /safetyEquipmentSymbol/)
assert.match(canvas, /data-verified=\{item\.verified/)
assert.match(canvas, /รอยืนยันตำแหน่ง/)
assert.match(styles, /\.lab-map-equipment:not\(\[data-verified\]\)/)
assert.match(shell, /data-class="fire-extinguisher"/)

// ── จุดรวมพลแสดงในแผงความปลอดภัยตามทางออกที่กำลังแสดงจริง ──
assert.match(shell, /relevantAssemblyPoints/)
assert.match(shell, /lab-map-assembly-note/)
assert.match(shell, /จุดรวมพล/)

console.log('lab map UI contract passed')
