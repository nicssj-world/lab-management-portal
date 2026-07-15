import { Icon } from '@/components/ui/Icon'
import type { ReactNode } from 'react'
import type { Test, Category } from '@/lib/supabase/types'

interface Props {
  test: Test
  category?: Category
}

function InfoBox({
  icon,
  label,
  value,
  variant,
  className = '',
}: {
  icon: string
  label: string
  value: ReactNode
  variant: 'metric' | 'descriptive'
  className?: string
}) {
  return (
    <div className={`test-detail-info-box test-detail-info-box--${variant} ${className}`.trim()}>
      <div className="test-detail-info-label">
        <Icon name={icon} size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
        <span>{label}</span>
      </div>
      <div className="test-detail-info-value">{value}</div>
    </div>
  )
}

export function TestDetailCard({ test, category }: Props) {
  const tatDisplay = test.tat_minutes ?? test.tat ?? '—'

  return (
    <div>
      <style>{`
        @keyframes contactStaffPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.5); }
          60% { box-shadow: 0 0 0 7px rgba(220,38,38,0); }
        }
        @keyframes contactStaffShimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .contact-staff-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 13px 4px 9px;
          border-radius: 20px;
          background: linear-gradient(120deg, #DC2626 0%, #EF4444 50%, #DC2626 100%);
          background-size: 200% 200%;
          color: #fff;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          animation: contactStaffPulse 2s ease-out infinite, contactStaffShimmer 3s ease-in-out infinite;
          cursor: default;
        }
        .test-detail-info-grid {
          display: grid !important;
          grid-template-columns: minmax(0, 1.35fr) minmax(112px, .8fr) minmax(112px, .8fr) minmax(0, 1.2fr);
          gap: 10px;
        }
        .test-detail-info-box {
          min-width: 0;
          padding: 14px;
          border-radius: 12px;
          background: var(--surface-2);
        }
        .test-detail-info-label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--muted);
          font-size: 12px;
        }
        .test-detail-info-value {
          min-width: 0;
          margin-top: 8px;
          color: var(--ink);
          font-size: 14px;
          font-weight: 600;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .test-detail-info-box--metric {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 96px;
          text-align: center;
        }
        .test-detail-info-box--descriptive {
          text-align: left;
        }
        .test-detail-specimen-value {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          min-width: 0;
        }
        .test-detail-specimen-text {
          min-width: 0;
          overflow-wrap: anywhere;
        }
        @media (max-width: 1100px) {
          .test-detail-info-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .test-detail-info-box--wide {
            grid-column: 1 / -1;
          }
        }
        @media (max-width: 767px) {
          .test-detail-badge-row {
            margin-bottom: 12px !important;
          }
          .test-detail-title-price {
            display: block !important;
            margin-bottom: 16px !important;
          }
          .test-detail-title-price h1 {
            font-size: 24px !important;
            line-height: 1.25 !important;
          }
          .test-detail-price {
            text-align: left !important;
            margin-top: 14px;
            padding-top: 12px;
            border-top: 1px solid var(--border);
          }
          .test-detail-price-value {
            font-size: 22px !important;
          }
          .test-detail-info-grid {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
          .test-detail-info-box {
            min-width: 0 !important;
            width: 100%;
            flex: none !important;
            border-radius: 12px !important;
            padding: 12px 14px !important;
          }
          .test-detail-info-box--wide {
            grid-column: auto;
          }
        }
      `}</style>
      {/* Badge row */}
      <div className="test-detail-badge-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {test.contact_staff && (
          <span className="contact-staff-badge">
            <Icon name="phone" size={12} style={{ color: '#fff', flexShrink: 0 }} />
            ติดต่อเจ้าหน้าที่ ก่อนเก็บตัวอย่าง
          </span>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, background: '#2563EB', fontSize: 12, fontWeight: 600, color: '#fff' }}>
          <strong>รหัส E-Phis:</strong>{' '}<strong>{test.code}</strong>
        </span>
       
        {test.loinc && (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, background: 'var(--surface-2)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
            LOINC {test.loinc}
          </span>
        )}
        {category && (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, background: category.color, fontSize: 12, fontWeight: 600, color: '#fff' }}>
            {category.th}
          </span>
        )}
      </div>

      {/* Title + price */}
      <div className="test-detail-title-price" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: 0, lineHeight: 1.2 }}>{test.th}</h1>
          {test.en && <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>{test.en}</div>}
        </div>
        {test.price != null && (
          <div className="test-detail-price" style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>ราคา</div>
            <div className="test-detail-price-value" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)' }}>฿{test.price}</div>
          </div>
        )}
      </div>

      {/* Info boxes */}
      <div className="test-detail-info-grid">
        {test.tube && (
          <InfoBox
            icon="flask"
            label="Specimen"
            variant="descriptive"
            className="test-detail-info-box--wide"
            value={
              <span className="test-detail-specimen-value">
                <span style={{ width: 8, height: 8, borderRadius: 2, background: test.tube_color ?? '#94A3B8', flexShrink: 0, display: 'inline-block' }} />
                <span className="test-detail-specimen-text">{test.tube}</span>
              </span>
            }
          />
        )}
        {test.volume && <InfoBox icon="droplet" label="ปริมาตร" value={test.volume} variant="metric" />}
        <InfoBox icon="clock" label="TAT" value={tatDisplay} variant="metric" />
        <InfoBox icon="check" label="วัน-เวลาที่ตรวจ" value={test.available_24hr ? 'ตลอด 24 ชั่วโมง' : (test.service ?? '—')} variant="descriptive" className="test-detail-info-box--wide" />
      </div>
    </div>
  )
}
