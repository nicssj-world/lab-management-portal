import { Icon } from '@/components/ui/Icon'
import type { Test, Category } from '@/lib/supabase/types'

interface Props {
  test: Test
  category?: Category
}

function InfoBox({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px', flex: 1, minWidth: 130 }}>
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
      {/* Badge row */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, background: 'var(--surface-2)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
          {test.code}
        </span>
        {test.cgd && (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, background: '#2563EB', fontSize: 12, fontWeight: 600, color: '#fff' }}>
            CGD {test.cgd}
          </span>
        )}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: 0, lineHeight: 1.2 }}>{test.th}</h1>
          {test.en && <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>{test.en}</div>}
        </div>
        {test.price != null && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>ราคา</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)' }}>฿{test.price}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>TAT {tatDisplay}</div>
          </div>
        )}
      </div>

      {/* Info boxes */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {test.tube && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px', flex: 1, minWidth: 130 }}>
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
