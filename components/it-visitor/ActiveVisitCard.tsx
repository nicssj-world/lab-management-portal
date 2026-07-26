'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { VisitorMapDialog, type VisitorMapDialogMode } from '@/components/lab-map/VisitorMapDialog'
import type { ActiveVisitorDTO } from '@/lib/it-visitor/types'
import type { LabMapDTO } from '@/lib/lab-map/types'

function formatThaiDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function ActiveVisitCard({ token, visit, map }: {
  token: string
  visit: ActiveVisitorDTO
  map: LabMapDTO
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [checkedOutAt, setCheckedOutAt] = useState<string | null>(null)
  // ป๊อปอัพเปิดในหน้าเดิม — ไม่เปลี่ยน URL และไม่ทิ้งปุ่มบันทึกออก
  const [mapDialog, setMapDialog] = useState<VisitorMapDialogMode | null>(null)

  async function checkout() {
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`/api/it-visitors/${token}`, {
        method: 'PATCH',
        credentials: 'same-origin',
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'บันทึกเวลาออกไม่สำเร็จ')
      setCheckedOutAt(result.exitedAt)
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'บันทึกเวลาออกไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  if (checkedOutAt) {
    return (
      <section className="active-visit-card active-visit-card--complete" aria-live="polite">
        <style>{ACTIVE_VISIT_CSS}</style>
        <div className="active-visit-complete-icon"><Icon name="check" size={28} /></div>
        <p className="active-visit-kicker">CHECK-OUT COMPLETE</p>
        <h1>บันทึกเวลาออกแล้ว</h1>
        <p>เวลาออก {formatThaiDateTime(checkedOutAt)}</p>
        <p className="active-visit-muted">ขอบคุณที่ปฏิบัติตามข้อกำหนดการเข้า–ออกพื้นที่</p>
      </section>
    )
  }

  return (
    <section className="active-visit-card">
      <style>{ACTIVE_VISIT_CSS}</style>
      <header className="active-visit-head">
        <div className="active-visit-status" aria-label="สถานะกำลังอยู่ในพื้นที่">
          <i aria-hidden="true" /> ACTIVE VISIT
        </div>
        <span className="active-visit-entered">เข้าเมื่อ {formatThaiDateTime(visit.enteredAt)}</span>
      </header>

      <div className="active-visit-destination">
        <span className="active-visit-pin" aria-hidden="true"><Icon name="building" size={22} /></span>
        <div>
          <p>หน่วยงานปลายทาง</p>
          <h1>{visit.contactDept}</h1>
          <span>
            {visit.checkpointCode
              ? 'กรุณาหยุดและติดต่อเจ้าหน้าที่ ณ จุดสแกนนิ้วมือ ห้ามเข้าพื้นที่ต่อ'
              : 'ยังไม่มีเส้นทางที่อนุมัติสำหรับหน่วยงานนี้ กรุณาติดต่อสำนักงานกลุ่มงานเทคนิคการแพทย์'}
          </span>
        </div>
      </div>

      {visit.directionsTh.length > 0 ? (
        <ol className="active-visit-directions">
          {visit.directionsTh.map((direction, index) => (
            <li key={`${index}-${direction}`}><b>{index + 1}</b><span>{direction}</span></li>
          ))}
        </ol>
      ) : null}

      <div className="active-visit-links">
        <button
          type="button"
          onClick={() => setMapDialog('navigation')}
          disabled={!visit.checkpointCode}
          aria-haspopup="dialog"
        >
          <Icon name="building" size={16} /> เปิดแผนที่ไปจุดสแกน
        </button>
        <button type="button" onClick={() => setMapDialog('safety')} aria-haspopup="dialog">
          <Icon name="shield" size={16} /> ดูทางออกและความปลอดภัย
        </button>
      </div>

      <VisitorMapDialog
        open={mapDialog !== null}
        mode={mapDialog ?? 'navigation'}
        map={map}
        routeCode={visit.routeCode}
        checkpointCode={visit.checkpointCode}
        checkpointNameTh={visit.checkpointNameTh}
        safetyStationCode={visit.safetyStationCode}
        onClose={() => setMapDialog(null)}
      />

      <div className="active-visit-checkout">
        <div>
          <strong>เมื่อออกจากพื้นที่</strong>
          <span>กดปุ่มนี้จากหน้าเดิม ไม่ต้องสแกน QR ซ้ำ</span>
        </div>
        <button type="button" onClick={checkout} disabled={submitting}>
          {submitting ? 'กำลังบันทึก…' : 'บันทึกออก'}
        </button>
      </div>

      {error ? <div className="active-visit-error" role="alert">{error}</div> : null}
      <p className="active-visit-help">หากปิดหน้านี้หรือเปลี่ยนอุปกรณ์ กรุณาแจ้งเจ้าหน้าที่สำนักงานให้บันทึกออกแทน</p>
    </section>
  )
}

const ACTIVE_VISIT_CSS = `
.active-visit-card{--av-navy:#12324a;--av-blue:#1d6f96;--av-yellow:#f0b429;margin:clamp(12px,4vh,36px) auto 0;overflow:hidden;border:1px solid #d7e3e7;border-radius:22px;background:var(--card);color:var(--ink);box-shadow:0 22px 58px rgba(18,50,74,.13)}
.active-visit-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 18px;background:var(--av-navy);color:#fff}
.active-visit-status{display:flex;align-items:center;gap:8px;font:700 .68rem "DM Mono",monospace;letter-spacing:.12em}.active-visit-status i{width:9px;height:9px;border-radius:50%;background:#6ee7a3;box-shadow:0 0 0 5px rgba(110,231,163,.14)}
.active-visit-entered{font-size:.72rem;color:rgba(255,255,255,.75)}
.active-visit-destination{display:flex;gap:15px;padding:24px 22px 20px;border-bottom:1px solid var(--border)}
.active-visit-pin{display:grid;place-items:center;flex:0 0 auto;width:50px;height:50px;border-radius:15px;background:#e6f1f4;color:var(--av-blue)}
.active-visit-destination p{margin:0;color:var(--muted);font-size:.72rem}.active-visit-destination h1{margin:3px 0 4px;color:var(--av-navy);font-size:clamp(1.05rem,4vw,1.35rem);line-height:1.35}.active-visit-destination span{font-size:.78rem;color:var(--muted)}
.active-visit-directions{display:grid;gap:10px;margin:0;padding:18px 22px 8px;list-style:none}.active-visit-directions li{display:flex;align-items:flex-start;gap:11px;font-size:.84rem}.active-visit-directions b{display:grid;place-items:center;flex:0 0 auto;width:24px;height:24px;border-radius:50%;background:var(--av-navy);color:#fff;font:700 .7rem "DM Mono",monospace}
.active-visit-links{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:14px 22px 20px}.active-visit-links button{display:flex;align-items:center;justify-content:center;gap:7px;min-height:46px;padding:9px 11px;border:1px solid #cbdce1;border-radius:10px;background:var(--card);color:var(--av-blue);font:700 .78rem "Noto Sans Thai",sans-serif;text-align:center;cursor:pointer}.active-visit-links button:hover:not(:disabled){background:#eef6f8}.active-visit-links button:disabled{cursor:not-allowed;opacity:.5}
.active-visit-checkout{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;background:#fff8df;border-top:1px solid #f2df98}.active-visit-checkout strong,.active-visit-checkout span{display:block}.active-visit-checkout strong{color:#5b4608;font-size:.88rem}.active-visit-checkout span{margin-top:2px;color:#7e681e;font-size:.72rem}.active-visit-checkout button{flex:0 0 auto;min-height:46px;padding:0 18px;border:0;border-radius:10px;background:var(--av-navy);color:#fff;font:700 .86rem "Noto Sans Thai",sans-serif;cursor:pointer}.active-visit-checkout button:disabled{cursor:wait;opacity:.62}.active-visit-checkout button:focus-visible,.active-visit-links button:focus-visible{outline:3px solid var(--av-yellow);outline-offset:2px}
.active-visit-error{margin:14px 22px 0;padding:10px 12px;border-radius:9px;background:rgba(220,38,38,.08);color:var(--danger);font-size:.78rem}.active-visit-help{margin:0;padding:13px 22px 18px;color:var(--muted);font-size:.7rem;text-align:center}
.active-visit-card--complete{padding:38px 24px;text-align:center}.active-visit-complete-icon{display:grid;place-items:center;width:62px;height:62px;margin:0 auto 15px;border-radius:18px;background:rgba(22,163,74,.11);color:var(--success)}.active-visit-kicker{margin:0;color:var(--success);font:700 .68rem "DM Mono",monospace;letter-spacing:.12em}.active-visit-card--complete h1{margin:6px 0 2px;color:var(--av-navy);font-size:1.45rem}.active-visit-card--complete>p:not(.active-visit-kicker){margin:5px 0}.active-visit-muted{color:var(--muted);font-size:.78rem}
@media(max-width:560px){.active-visit-head{align-items:flex-start;flex-direction:column}.active-visit-links{grid-template-columns:1fr}.active-visit-checkout{align-items:stretch;flex-direction:column}.active-visit-checkout button{width:100%}}
@media(prefers-reduced-motion:reduce){.active-visit-links button{transition:none}}
[data-theme="dark"] .active-visit-card{--av-navy:#dcecf2;--av-blue:#8fc9df}.active-visit-head{background:#12324a}[data-theme="dark"] .active-visit-destination h1{color:var(--ink)}[data-theme="dark"] .active-visit-checkout{background:#3a321b}
`
