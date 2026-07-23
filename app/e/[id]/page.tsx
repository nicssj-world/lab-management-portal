import type { Metadata } from 'next'
import { getPublicEquipment, type PublicEquipment } from '@/lib/queries/equipment-public'

export const dynamic = 'force-dynamic'

// ─── helpers ────────────────────────────────────────────────────────────────
function formatDate(d: string | null): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return d }
}

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  Active: { bg: 'rgba(22,163,74,.10)', fg: '#15803D' },
  Inactive: { bg: 'var(--surface-2)', fg: 'var(--muted)' },
  ชำรุด: { bg: 'rgba(220,38,38,.10)', fg: '#B91C1C' },
  มาใหม่: { bg: 'rgba(37,99,235,.10)', fg: '#1D4ED8' },
  ย้าย: { bg: 'rgba(147,51,234,.10)', fg: '#7E22CE' },
  สูญหาย: { bg: 'rgba(217,119,6,.12)', fg: '#B45309' },
}
const RISK_COLOR: Record<string, { bg: string; fg: string }> = {
  High: { bg: 'rgba(220,38,38,.10)', fg: '#B91C1C' },
  Medium: { bg: 'rgba(217,119,6,.12)', fg: '#B45309' },
  Low: { bg: 'rgba(22,163,74,.10)', fg: '#15803D' },
}

type CalTone = 'gray' | 'green' | 'amber' | 'red'
const CAL_TONE: Record<CalTone, { bg: string; fg: string; border: string }> = {
  gray: { bg: 'var(--surface-2)', fg: 'var(--muted)', border: 'var(--border)' },
  green: { bg: 'rgba(22,163,74,.10)', fg: '#15803D', border: 'rgba(22,163,74,.30)' },
  amber: { bg: 'rgba(217,119,6,.12)', fg: '#B45309', border: 'rgba(217,119,6,.30)' },
  red: { bg: 'rgba(220,38,38,.10)', fg: '#B91C1C', border: 'rgba(220,38,38,.30)' },
}

// คำนวณสถานะสอบเทียบจากวันสอบเทียบล่าสุด (สมมติรอบ 1 ปีเป็นค่าเริ่มต้น)
function calibrationStatus(eq: PublicEquipment): { tone: CalTone; label: string; sub: string | null } {
  if (!eq.needs_calibration) return { tone: 'gray', label: 'ไม่ต้องสอบเทียบ', sub: null }
  const last = eq.cal.last_cal_date
  if (!last) return { tone: 'amber', label: 'ยังไม่มีบันทึกการสอบเทียบ', sub: null }

  const lastTime = new Date(last).getTime()
  if (Number.isNaN(lastTime)) return { tone: 'gray', label: `สอบเทียบล่าสุด ${formatDate(last)}`, sub: null }

  const due = new Date(lastTime)
  due.setFullYear(due.getFullYear() + 1)
  const days = Math.round((due.getTime() - Date.now()) / 86400000)
  const dueLabel = formatDate(due.toISOString())
  const lastSub = `สอบเทียบล่าสุด ${formatDate(last)}`

  if (days < 0) return { tone: 'red', label: `เลยกำหนดสอบเทียบ (ครบ ${dueLabel})`, sub: lastSub }
  if (days <= 60) return { tone: 'amber', label: `ใกล้ครบกำหนด ภายใน ${days} วัน (${dueLabel})`, sub: lastSub }
  return { tone: 'green', label: `สอบเทียบปกติ (ครบกำหนด ${dueLabel})`, sub: lastSub }
}

function normalizeOwner(value: string | null): string {
  const raw = String(value ?? '').trim()
  const key = raw.toLowerCase()
  if (!raw) return '—'
  if (raw === 'รพ' || raw === 'โรงพยาบาล' || key === 'hospital') return 'Hospital'
  if (key === 'vendor') return 'Vendor'
  return raw
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const eq = await getPublicEquipment(id)
  if (!eq) return { title: 'ไม่พบเครื่องมือ' }
  return { title: `${eq.cbh_code ?? eq.equipment_type} · ${eq.equipment_type}` }
}

// ─── row / section helpers (server) ───────────────────────────────────────────
function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  const empty = value == null || value === '' || value === '—'
  return (
    <div className="eqp-row">
      <span className="eqp-row-label">{label}</span>
      <span className="eqp-row-value" style={{ fontFamily: mono ? 'ui-monospace, monospace' : undefined, color: empty ? 'var(--muted)' : 'var(--ink)' }}>
        {empty ? '—' : value}
      </span>
    </div>
  )
}

export default async function PublicEquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const eq = await getPublicEquipment(id)

  const css = `
    .eqp{min-height:100vh;padding:clamp(12px,4vw,32px) clamp(10px,4vw,24px) 56px;background:radial-gradient(circle at 0 0,rgba(30,95,173,.10),transparent 34%),var(--surface,#F6F8FB)}
    .eqp-inner{width:min(560px,100%);margin:0 auto;display:flex;flex-direction:column;gap:12px}
    .eqp-card{background:var(--card,#fff);border:1px solid var(--border,#DDE6EF);border-radius:16px;box-shadow:0 8px 22px rgba(11,22,38,.055);overflow:hidden}
    .eqp-hero{padding:18px 18px 16px;text-align:center}
    .eqp-photo{width:100%;max-width:240px;max-height:220px;object-fit:contain;border-radius:12px;border:1px solid var(--border);background:var(--surface-2);padding:8px;margin:0 auto 14px;display:block}
    .eqp-photo-ph{width:120px;height:120px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:34px}
    .eqp-name{font-size:19px;font-weight:800;color:var(--ink);line-height:1.35;margin:0}
    .eqp-code{display:inline-block;margin-top:8px;font-family:ui-monospace,monospace;font-size:13px;color:var(--primary,#1E5FAD);background:var(--primary-soft,rgba(30,95,173,.11));padding:3px 12px;border-radius:8px;letter-spacing:.5px}
    .eqp-calbar{margin:0 14px 14px;padding:12px 14px;border-radius:12px;border:1px solid;display:flex;flex-direction:column;gap:2px}
    .eqp-calbar-label{font-size:14px;font-weight:800}
    .eqp-calbar-sub{font-size:12px;opacity:.85}
    .eqp-badges{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;padding:0 14px 16px}
    .eqp-badge{font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px}
    .eqp-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:14px}
    .eqp-tile{background:var(--surface-2);border:1px solid var(--border);border-radius:11px;padding:11px 10px;text-align:center;min-width:0}
    .eqp-tile-v{font-size:13px;font-weight:700;color:var(--ink);line-height:1.3;word-break:break-word}
    .eqp-tile-l{font-size:10.5px;color:var(--muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px}
    .eqp-person{display:flex;align-items:center;gap:12px;padding:14px}
    .eqp-person-av{width:42px;height:42px;border-radius:999px;background:var(--primary-soft);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;flex-shrink:0}
    .eqp-person-name{font-size:14px;font-weight:700;color:var(--ink)}
    .eqp-person-sub{font-size:12px;color:var(--muted);margin-top:1px}
    details.eqp-sec{border-top:1px solid var(--border)}
    details.eqp-sec:first-of-type{border-top:none}
    summary.eqp-sum{list-style:none;cursor:pointer;padding:13px 16px;font-size:12px;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:.8px;display:flex;align-items:center;justify-content:space-between}
    summary.eqp-sum::-webkit-details-marker{display:none}
    summary.eqp-sum::after{content:'▾';font-size:12px;color:var(--muted);transition:transform .2s}
    details[open]>summary.eqp-sum::after{transform:rotate(180deg)}
    .eqp-sec-body{padding:0 16px 14px}
    .eqp-row{display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-top:1px solid var(--border);font-size:13px}
    .eqp-sec-body>.eqp-row:first-child{border-top:none}
    .eqp-row-label{color:var(--muted);flex-shrink:0}
    .eqp-row-value{text-align:right;word-break:break-word}
    .eqp-remark{font-size:13px;color:var(--ink);line-height:1.6;white-space:pre-wrap}
    .eqp-doc{display:flex;align-items:center;gap:9px;padding:10px 12px;border:1px solid var(--border);border-radius:9px;color:var(--primary);text-decoration:none;font-size:13px;font-weight:600}
    .eqp-foot{text-align:center;font-size:11px;color:var(--muted);padding:4px 0}
    .eqp-notfound{margin-top:14vh;padding:34px 24px;text-align:center}
  `

  if (!eq) {
    return (
      <main className="eqp">
        <style>{css}</style>
        <div className="eqp-inner">
          <div className="eqp-card eqp-notfound" role="alert">
            <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
            <h1 style={{ color: 'var(--ink)', margin: 0, fontSize: 20 }}>ไม่พบเครื่องมือ</h1>
            <p style={{ color: 'var(--muted)', margin: '8px 0 0', fontSize: 13 }}>กรุณาตรวจสอบ QR Code หรือลิงก์อีกครั้ง</p>
          </div>
        </div>
      </main>
    )
  }

  const cal = calibrationStatus(eq)
  const st = STATUS_COLOR[eq.status] ?? STATUS_COLOR.Inactive
  const rk = eq.risk_level ? RISK_COLOR[eq.risk_level] : null
  const person = (eq.responsible_person ?? '').trim()

  return (
    <main className="eqp">
      <style>{css}</style>
      <div className="eqp-inner">
        <div className="eqp-card">
          {/* 1. Hero */}
          <div className="eqp-hero">
            {eq.photoSignedUrl
              ? <img className="eqp-photo" src={eq.photoSignedUrl} alt={eq.equipment_type} />
              : <div className="eqp-photo-ph">🧪</div>}
            <h1 className="eqp-name">{eq.equipment_type}</h1>
            {eq.cbh_code && <div className="eqp-code">{eq.cbh_code}</div>}
          </div>

          {/* 2. Calibration status bar */}
          <div className="eqp-calbar" style={{ background: CAL_TONE[cal.tone].bg, color: CAL_TONE[cal.tone].fg, borderColor: CAL_TONE[cal.tone].border }}>
            <span className="eqp-calbar-label">{cal.label}</span>
            {cal.sub && <span className="eqp-calbar-sub">{cal.sub}</span>}
          </div>

          {/* 3. Status / risk badges */}
          <div className="eqp-badges">
            <span className="eqp-badge" style={{ background: st.bg, color: st.fg }}>{eq.status}</span>
            {rk && <span className="eqp-badge" style={{ background: rk.bg, color: rk.fg }}>ความเสี่ยง {eq.risk_level}</span>}
          </div>

          {/* 4. Quick tiles */}
          <div className="eqp-tiles">
            <div className="eqp-tile"><div className="eqp-tile-v">{eq.department || '—'}</div><div className="eqp-tile-l">แผนก</div></div>
            <div className="eqp-tile"><div className="eqp-tile-v">{formatDate(eq.cal.last_cal_date)}</div><div className="eqp-tile-l">สอบเทียบล่าสุด</div></div>
            <div className="eqp-tile"><div className="eqp-tile-v">{eq.classification || '—'}</div><div className="eqp-tile-l">ประเภท</div></div>
          </div>

          {/* 5. Responsible person */}
          {person && (
            <div className="eqp-person" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="eqp-person-av">{person.charAt(0)}</div>
              <div>
                <div className="eqp-person-name">{person}</div>
                <div className="eqp-person-sub">ผู้รับผิดชอบ · {eq.department}</div>
              </div>
            </div>
          )}
        </div>

        {/* 6. Collapsible full details */}
        <div className="eqp-card">
          <details className="eqp-sec">
            <summary className="eqp-sum">ข้อมูลทั่วไป</summary>
            <div className="eqp-sec-body">
              <Row label="แผนก" value={eq.department} />
              <Row label="เลขทะเบียนสินทรัพย์" value={eq.hospital_asset_no} mono />
              <Row label="LAB Code" value={eq.cbh_code} mono />
              <Row label="Classification" value={eq.classification} />
              <Row label="ผู้รับผิดชอบ" value={eq.responsible_person} />
              <Row label="เจ้าของ" value={normalizeOwner(eq.owner)} />
              <Row label="Owner Status" value={eq.owner_status} />
            </div>
          </details>

          <details className="eqp-sec">
            <summary className="eqp-sum">ผู้ผลิต / จำหน่าย</summary>
            <div className="eqp-sec-body">
              <Row label="Manufacturer" value={eq.manufacturer} />
              <Row label="Model" value={eq.model} />
              <Row label="Serial Number" value={eq.serial_number} mono />
              <Row label="Vendor" value={eq.vendor} />
            </div>
          </details>

          <details className="eqp-sec">
            <summary className="eqp-sum">การจัดซื้อ</summary>
            <div className="eqp-sec-body">
              <Row label="วันที่ซื้อ" value={formatDate(eq.purchase_date)} />
              <Row label="วันหมดประกัน" value={formatDate(eq.warranty_exp)} />
            </div>
          </details>

          <details className="eqp-sec">
            <summary className="eqp-sum">การสอบเทียบ</summary>
            <div className="eqp-sec-body">
              <Row label="ต้องการสอบเทียบ" value={eq.needs_calibration ? 'ต้องการ' : 'ไม่ต้องการ'} />
              <Row label="จุดประสงค์การใช้งาน" value={eq.purpose} />
              <Row label="เลขใบรับรอง (Cert No.)" value={eq.cal.certificate_no} />
              <Row label="ผลการสอบเทียบ" value={eq.cal.cal_result} />
              <Row label="PM ล่าสุด" value={formatDate(eq.cal.last_pm_date)} />
            </div>
          </details>

          {eq.remark && (
            <details className="eqp-sec">
              <summary className="eqp-sum">หมายเหตุ</summary>
              <div className="eqp-sec-body"><div className="eqp-remark">{eq.remark}</div></div>
            </details>
          )}

          {eq.manualSignedUrl && (
            <details className="eqp-sec">
              <summary className="eqp-sum">เอกสารประกอบ</summary>
              <div className="eqp-sec-body">
                <a className="eqp-doc" href={eq.manualSignedUrl} target="_blank" rel="noopener noreferrer">📄 คู่มือการใช้งานเครื่องมือ</a>
              </div>
            </details>
          )}
        </div>

        <div className="eqp-foot">กลุ่มงานเทคนิคการแพทย์ · ข้อมูลทะเบียนเครื่องมือ</div>
      </div>
    </main>
  )
}
