'use client'

import { useCallback, useEffect, useId, useRef } from 'react'
import type { LabSafetyEquipmentDefinition, SafetyAssetDTO } from '@/lib/lab-map/types'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const STATUS_LABELS: Record<string, string> = {
  unverified: 'รอยืนยันตำแหน่ง',
  verified: 'ยืนยันตำแหน่งแล้ว',
  passed: 'ผ่านการตรวจ',
  needs_attention: 'ต้องติดตาม',
  failed: 'ไม่พร้อมใช้',
  overdue: 'เกินกำหนดตรวจ',
  due_soon: 'ใกล้ครบกำหนดตรวจ',
}

function statusLabel(status: string | undefined) {
  return STATUS_LABELS[status ?? ''] ?? 'ยังไม่มีข้อมูลสถานะ'
}

export function SafetyEquipmentDetailDialog({
  equipment,
  asset,
  loading,
  error,
  onClose,
}: {
  equipment: LabSafetyEquipmentDefinition | null
  asset: SafetyAssetDTO | null
  loading: boolean
  error: string | null
  onClose: () => void
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const close = useCallback(() => onClose(), [onClose])

  useEffect(() => {
    if (!equipment) return undefined
    openerRef.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter((element) => element.offsetParent !== null)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = previousOverflow
      openerRef.current?.focus()
    }
  }, [equipment, close])

  if (!equipment) return null
  const inspection = asset?.latestInspection ?? null

  return (
    <div className="lab-map-equipment-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
      <style>{DIALOG_CSS}</style>
      <section className="lab-map-equipment-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panelRef} tabIndex={-1}>
        <header>
          <div>
            <p>FIRE EXTINGUISHER</p>
            <h2 id={titleId}>{equipment.nameTh}</h2>
            <code>{equipment.code}</code>
          </div>
          <button type="button" onClick={close} aria-label="ปิดรายละเอียดถังดับเพลิง" data-autofocus>×</button>
        </header>

        <div className="lab-map-equipment-dialog-body">
          <div className="lab-map-equipment-status" data-status={asset?.operationalStatus ?? equipment.operationalStatus}>
            <span>สถานะปัจจุบัน</span>
            <strong>{statusLabel(asset?.operationalStatus ?? equipment.operationalStatus)}</strong>
          </div>

          {loading ? <p className="lab-map-equipment-dialog-message" role="status">กำลังโหลดผลตรวจและรูปหลักฐาน…</p> : null}
          {error ? <p className="lab-map-equipment-dialog-error" role="alert">{error}</p> : null}

          {!loading && !error && inspection ? (
            <>
              <dl className="lab-map-equipment-inspection">
                <div><dt>ผลตรวจล่าสุด</dt><dd>{statusLabel(inspection.result)}</dd></div>
                <div><dt>วันที่ตรวจ</dt><dd>{inspection.inspectedOn}</dd></div>
                <div><dt>ตรวจครั้งถัดไป</dt><dd>{inspection.nextInspectionDate ?? 'ยังไม่ระบุ'}</dd></div>
                <div><dt>วันหมดอายุ</dt><dd>{inspection.expiresOn ?? 'ยังไม่ระบุ'}</dd></div>
                <div><dt>ผู้ตรวจ</dt><dd>{inspection.inspectorName ?? inspection.inspectedBy}</dd></div>
              </dl>
              {inspection.note ? <p className="lab-map-equipment-note"><b>หมายเหตุ:</b> {inspection.note}</p> : null}
              <figure>
                <img src={inspection.photoUrl} alt={`รูปหลักฐานการตรวจ ${equipment.nameTh} วันที่ ${inspection.inspectedOn}`} />
                <figcaption>รูปหลักฐานการตรวจล่าสุด</figcaption>
              </figure>
            </>
          ) : null}

          {!loading && !error && !inspection ? (
            <p className="lab-map-equipment-dialog-message">ยังไม่มีประวัติการตรวจของถังดับเพลิงนี้</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}

const DIALOG_CSS = `
.lab-map-equipment-dialog-backdrop{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;padding:20px;background:rgba(7,24,38,.58)}
.lab-map-equipment-dialog{width:min(620px,100%);max-height:min(88vh,780px);overflow:auto;border:1px solid rgba(193,211,218,.9);border-radius:18px;background:var(--card);box-shadow:0 28px 90px rgba(4,20,32,.38);color:var(--ink)}
.lab-map-equipment-dialog:focus{outline:none}
.lab-map-equipment-dialog header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:19px 22px 17px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,#f7fbfc,#eef5f7)}
.lab-map-equipment-dialog header p{margin:0;color:#b42318;font:800 .66rem "DM Mono",monospace;letter-spacing:.13em}
.lab-map-equipment-dialog header h2{margin:5px 0 1px;color:var(--ink);font-size:1.25rem;line-height:1.35}
.lab-map-equipment-dialog header code{color:var(--muted);font-size:.76rem}
.lab-map-equipment-dialog header button{flex:0 0 auto;min-width:44px;min-height:44px;border:1px solid var(--border);border-radius:50%;background:var(--card);color:var(--ink);font-size:1.45rem;line-height:1;cursor:pointer}
.lab-map-equipment-dialog header button:focus-visible{outline:3px solid var(--primary);outline-offset:2px}
.lab-map-equipment-dialog-body{display:grid;gap:16px;padding:20px 22px 24px}
.lab-map-equipment-status{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-left:4px solid #1d6f96;background:#edf7fb}
.lab-map-equipment-status[data-status="failed"],.lab-map-equipment-status[data-status="overdue"]{border-left-color:#b42318;background:#fff1f0}
.lab-map-equipment-status[data-status="needs_attention"],.lab-map-equipment-status[data-status="due_soon"],.lab-map-equipment-status[data-status="unverified"]{border-left-color:#9a6700;background:#fff8e6}
.lab-map-equipment-status span{color:var(--muted);font-size:.78rem}.lab-map-equipment-status strong{color:var(--ink);font-size:.9rem;text-align:right}
.lab-map-equipment-dialog-message,.lab-map-equipment-dialog-error{margin:0;padding:12px 14px;border-radius:10px;font-size:.85rem}.lab-map-equipment-dialog-message{background:var(--surface-2);color:var(--muted)}.lab-map-equipment-dialog-error{background:#fff1f0;color:#8f1d15}
.lab-map-equipment-inspection{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;margin:0;border:1px solid var(--border);background:var(--border)}
.lab-map-equipment-inspection div{padding:10px 12px;background:var(--card)}.lab-map-equipment-inspection dt{color:var(--muted);font-size:.72rem}.lab-map-equipment-inspection dd{margin:3px 0 0;color:var(--ink);font-size:.88rem;font-weight:650}
.lab-map-equipment-note{margin:0;padding:11px 13px;border-radius:9px;background:#fff8e6;color:#5b4707;font-size:.84rem;line-height:1.55}
.lab-map-equipment-dialog figure{margin:0}.lab-map-equipment-dialog figure img{display:block;width:100%;max-height:340px;object-fit:contain;border:1px solid var(--border);border-radius:12px;background:#f4f7f8}.lab-map-equipment-dialog figcaption{margin-top:7px;color:var(--muted);font-size:.75rem;text-align:center}
@media(max-width:560px){.lab-map-equipment-dialog-backdrop{align-items:end;padding:0}.lab-map-equipment-dialog{width:100%;max-height:88vh;border-radius:20px 20px 0 0}.lab-map-equipment-dialog header,.lab-map-equipment-dialog-body{padding-left:18px;padding-right:18px}.lab-map-equipment-inspection{grid-template-columns:1fr}.lab-map-equipment-dialog figure img{max-height:42vh}}
@media(prefers-reduced-motion:reduce){.lab-map-equipment-dialog{scroll-behavior:auto}}
`
