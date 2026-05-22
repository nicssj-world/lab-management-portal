import type { Test } from '@/lib/supabase/types'

interface Props { test: Test }

const TUBE_ICON_NAMES = [
  'Sodium citrate (ฟ้า)',
  'Clotted blood (แดง)',
  'Lithium heparin (เขียว)',
  'EDTA (ม่วง)',
  'NaF (เทา)',
]

function TubeIcon({ color }: { color: string }) {
  return (
    <svg width="11" height="28" viewBox="0 0 11 28" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      {/* Cap */}
      <rect x="0" y="0" width="11" height="8" rx="2" fill={color} />
      {/* Tube body */}
      <rect x="1.5" y="7" width="8" height="14" fill="white" stroke="#CBD5E1" strokeWidth="1" />
      {/* Rounded bottom */}
      <path d="M1.5 21 L1.5 24 Q1.5 27 5.5 27 Q9.5 27 9.5 24 L9.5 21 Z" fill="white" stroke="#CBD5E1" strokeWidth="1" />
    </svg>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="specimen-detail-row" style={{ display: 'flex', gap: 12, paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--muted)', minWidth: 140, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{value}</span>
    </div>
  )
}

export function SpecimenSection({ test }: Props) {
  const hasData = test.tube || test.stability || test.reject || test.transport_condition || test.specimen_note
  const showTubeIcon = test.tube ? TUBE_ICON_NAMES.includes(test.tube) : false

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @media (max-width: 767px) {
          .specimen-detail-row {
            display: block !important;
          }
          .specimen-detail-row span {
            display: block;
          }
          .specimen-detail-row span + span {
            margin-top: 4px;
          }
        }
      `}</style>
      {test.tube && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
          {showTubeIcon
            ? <TubeIcon color={test.tube_color ?? '#94A3B8'} />
            : <div style={{ width: 14, height: 14, borderRadius: 3, background: test.tube_color ?? '#94A3B8', flexShrink: 0 }} />
          }
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{test.tube}</div>
            {test.volume && <div style={{ fontSize: 12, color: 'var(--muted)' }}>ปริมาตร: {test.volume}</div>}
          </div>
        </div>
      )}
      <Row label="การเก็บรักษาหลังตรวจ" value={test.stability} />
      <Row label="เงื่อนไขปฏิเสธ" value={test.reject} />
      <Row label="เงื่อนไขการขนส่ง" value={test.transport_condition} />
      <Row label="รายละเอียดอื่นๆ" value={test.specimen_note} />
      {!hasData && (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>ไม่มีข้อมูล specimen</div>
      )}
    </div>
  )
}
