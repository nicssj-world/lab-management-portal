'use client'

import { useCallback, useEffect, useId, useRef } from 'react'
import { LabMapShell } from './LabMapShell'
import type { LabMapDTO } from '@/lib/lab-map/types'

export type VisitorMapDialogMode = 'navigation' | 'safety'

export interface VisitorMapDialogProps {
  open: boolean
  mode: VisitorMapDialogMode
  map: LabMapDTO
  routeCode?: string | null
  checkpointCode?: string | null
  checkpointNameTh?: string | null
  /** สถานีความปลอดภัยที่ตรงกับจุดสแกนปลายทาง — ใช้เป็นจุดเริ่มต้นของแผนหนีไฟให้ตรงตำแหน่งจริง */
  safetyStationCode?: string | null
  onClose: () => void
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * ป๊อปอัพแผนที่ในบัตรผู้มาติดต่อ — ไม่เปลี่ยน URL และไม่ทิ้งปุ่มบันทึกออก
 * จัดการโฟกัส ปิดด้วย Escape ล็อกการเลื่อนพื้นหลัง และคืนโฟกัสให้ปุ่มที่เปิด
 */
export function VisitorMapDialog({
  open,
  mode,
  map,
  routeCode = null,
  checkpointCode = null,
  checkpointNameTh = null,
  safetyStationCode = null,
  onClose,
}: VisitorMapDialogProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  const close = useCallback(() => onClose(), [onClose])

  useEffect(() => {
    if (!open) return undefined
    openerRef.current = document.activeElement as HTMLElement | null

    const { body } = document
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'

    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel
    first?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter((element) => element.offsetParent !== null || element === panelRef.current)
      if (focusable.length === 0) return
      const firstElement = focusable[0]
      const lastElement = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      body.style.overflow = previousOverflow
      openerRef.current?.focus()
    }
  }, [open, close])

  if (!open) return null

  const heading = mode === 'safety' ? 'ทางออกและความปลอดภัย' : 'เส้นทางไปจุดสแกนนิ้วมือ'
  // เริ่มที่จุดสแกนปลายทางจริงของผู้มาติดต่อ — สลับกลับหน้าสำนักงานได้ถ้าตำแหน่งจริงต่างออกไป
  const resolvedSafetyStation = safetyStationCode ?? 'office'
  const safetyStationOptions = resolvedSafetyStation === 'office' ? ['office'] : [resolvedSafetyStation, 'office']

  return (
    <div className="visitor-map-backdrop">
      <style>{VISITOR_MAP_DIALOG_CSS}</style>
      <div
        className="visitor-map-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        tabIndex={-1}
      >
        <header className="visitor-map-dialog-head">
          <div>
            <p>{mode === 'safety' ? 'SAFETY' : 'NAVIGATION'}</p>
            <h2 id={titleId}>{heading}</h2>
            {mode === 'navigation' && checkpointNameTh ? (
              <p className="visitor-map-dialog-target">ปลายทาง: {checkpointNameTh} — เส้นทางสิ้นสุดที่จุดนี้</p>
            ) : null}
          </div>
          <button type="button" onClick={close} aria-label="ปิดแผนที่" data-autofocus>×</button>
        </header>

        <div className="visitor-map-dialog-body">
          <LabMapShell
            map={map}
            compact
            allowedModes={mode === 'safety' ? ['safety'] : ['overview', 'safety']}
            initialMode={mode === 'safety' ? 'safety' : 'overview'}
            initialRouteCode={mode === 'safety' ? null : routeCode}
            destinationPointCode={mode === 'safety' ? null : checkpointCode}
            initialSafetyStationCode={resolvedSafetyStation}
            safetyStationCodes={safetyStationOptions}
            heading={heading}
            description=""
            eyebrow=""
          />
        </div>
      </div>
    </div>
  )
}

const VISITOR_MAP_DIALOG_CSS = `
.visitor-map-backdrop{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.55)}
.visitor-map-dialog{display:flex;flex-direction:column;width:100%;max-width:1180px;max-height:92vh;overflow:hidden;border-radius:18px;background:var(--card);box-shadow:0 24px 70px rgba(0,0,0,.32)}
.visitor-map-dialog:focus{outline:none}
.visitor-map-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:16px 20px;border-bottom:1px solid var(--border)}
.visitor-map-dialog-head p{margin:0;color:var(--muted);font:700 .62rem "DM Mono",monospace;letter-spacing:.14em}
.visitor-map-dialog-head h2{margin:4px 0 0;color:var(--ink);font-size:1.1rem}
.visitor-map-dialog-target{margin-top:5px !important;color:var(--muted);font:400 .76rem "Noto Sans Thai",sans-serif !important;letter-spacing:0 !important}
.visitor-map-dialog-head button{flex:0 0 auto;min-width:44px;min-height:44px;border:1px solid var(--border);border-radius:50%;background:var(--surface-2);color:var(--ink);font-size:1.3rem;cursor:pointer}
.visitor-map-dialog-head button:focus-visible{outline:3px solid var(--primary);outline-offset:2px}
.visitor-map-dialog-body{flex:1 1 auto;min-height:0;overflow:auto;padding:0}
@media(max-width:767px){.visitor-map-backdrop{padding:0}.visitor-map-dialog{max-width:none;height:100%;max-height:100%;border-radius:0}}
`
