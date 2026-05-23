import { Icon } from '@/components/ui/Icon'
import type { Test, Category } from '@/lib/supabase/types'

interface Props {
  test: Test
  category?: Category
}

function InfoBox({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="test-detail-info-box" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px', flex: 1, minWidth: 130 }}>
      <Icon name={icon} size={16} style={{ color: 'var(--muted)', marginTop: 2, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{value}</div>
      </div>
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
          รหัส E-Phis: <strong>{test.code}</strong>
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
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>TAT {tatDisplay}</div>
          </div>
        )}
      </div>

      {/* Info boxes */}
      <div className="test-detail-info-grid" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {test.tube && (
          <div className="test-detail-info-box" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px', flex: 1, minWidth: 130 }}>
            <Icon name="flask" size={16} style={{ color: 'var(--muted)', marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>Specimen</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: test.tube_color ?? '#94A3B8', flexShrink: 0, display: 'inline-block' }} />
                {test.tube}
              </div>
            </div>
          </div>
        )}
        {test.volume && <InfoBox icon="droplet" label="ปริมาตร" value={test.volume} />}
        <InfoBox icon="clock" label="TAT" value={tatDisplay} />
        <InfoBox icon="check" label="วัน-เวลาที่ตรวจวิเคราะห์" value={test.available_24hr ? 'ตลอด 24 ชั่วโมง' : (test.service ?? '—')} />
      </div>
    </div>
  )
}
