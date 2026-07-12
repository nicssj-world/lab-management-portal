import type { Test } from '@/lib/supabase/types'
import { sanitizeRichHtml } from '@/lib/html-sanitize'

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

export function parseNumberedSpecimenText(value: string | null | undefined) {
  const lines = String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return null

  const items: { value: number; text: string }[] = []

  for (const line of lines) {
    const match = line.match(/^(\d+)[.)]\s*(.*)$/)

    if (match) {
      items.push({ value: Number(match[1]), text: match[2].trim() })
      continue
    }

    const previous = items.at(-1)
    if (!previous) return null
    previous.text = [previous.text, line].filter(Boolean).join(' ')
  }

  return items.length > 0 ? items : null
}

function TextValue({ value }: { value: string }) {
  const numberedItems = parseNumberedSpecimenText(value)

  if (numberedItems) {
    return (
      <ol className="specimen-numbered-list" style={{ whiteSpace: 'normal' }}>
        {numberedItems.map((item) => (
          <li key={`${item.value}-${item.text}`}>
            <span className="specimen-numbered-marker">{item.value}.</span>
            <span>{item.text}</span>
          </li>
        ))}
      </ol>
    )
  }

  return <div style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{value}</div>
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="specimen-detail-row" style={{ display: 'flex', gap: 12, paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--muted)', minWidth: 140, flexShrink: 0 }}>{label}</span>
      <TextValue value={value} />
    </div>
  )
}

export function SpecimenSection({ test }: Props) {
  const hasData = test.tube || test.stability || test.reject || test.transport_condition || test.specimen_note
  const showTubeIcon = test.tube ? TUBE_ICON_NAMES.includes(test.tube) : false
  const safeSpecimenNote = sanitizeRichHtml(test.specimen_note)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .specimen-numbered-list {
          margin: 0;
          padding-left: 0;
          color: var(--ink);
          font-size: 13px;
          line-height: 1.55;
          list-style: none;
          white-space: normal;
        }
        .specimen-numbered-list li {
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr);
          column-gap: 4px;
          align-items: start;
          margin: 0 0 2px;
        }
        .specimen-numbered-marker {
          color: var(--ink);
          display: inline-block;
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        @media (max-width: 767px) {
          .specimen-detail-row {
            display: block !important;
          }
          .specimen-detail-row > * {
            display: block;
          }
          .specimen-detail-row > * + * {
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
      <Row label="การเก็บรักษาตัวอย่างก่อนนำส่ง" value={test.transport_condition} />
      {safeSpecimenNote && (
        <div className="specimen-detail-row" style={{ display: 'flex', gap: 12, paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, color: 'var(--muted)', minWidth: 140, flexShrink: 0 }}>รายละเอียดอื่นๆ</span>
          <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: safeSpecimenNote }} />
        </div>
      )}
      {!hasData && (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>ไม่มีข้อมูล specimen</div>
      )}
    </div>
  )
}
