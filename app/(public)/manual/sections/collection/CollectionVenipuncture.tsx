import { Callout, StepList } from '../../_primitives'
import { type Lang } from '../../data'
import { VENIPUNCTURE_SITES, VENIPUNCTURE_STEPS_TH, VENIPUNCTURE_STEPS_EN } from '../collection-data'

interface Props { lang: Lang }

export function CollectionVenipuncture({ lang }: Props) {
  return (
    <div>
      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'ตำแหน่งที่เหมาะสม' : 'Suitable Sites'}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
        {VENIPUNCTURE_SITES.map((s) => (
          <div key={s.num} style={{ padding: '13px 14px', border: `1px solid ${s.border}`, borderTop: `3px solid ${s.color}`, borderRadius: 9, background: s.bg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{s.num}</div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: s.color, letterSpacing: '.04em', textTransform: 'uppercase' }}>{lang === 'th' ? s.priority : s.priorityEn}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{lang === 'th' ? s.th : s.en}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>{lang === 'th' ? s.detail : s.detailEn}</div>
          </div>
        ))}
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'วิธีการเจาะเก็บเลือด' : 'Procedure'}
      </h3>
      <StepList steps={lang === 'th' ? VENIPUNCTURE_STEPS_TH : VENIPUNCTURE_STEPS_EN} />

      <div style={{ marginTop: 14 }}>
        <Callout tone="warning" icon="alert">
          {lang === 'th'
            ? 'ลำดับหลอด: 1) Hemoculture → 2) Citrate (ฟ้า) → 3) SST (แดง) → 4) Li-Heparin (เขียว) → 5) EDTA (ม่วง) → 6) NaF (เทา)'
            : 'Order: 1) Blood culture → 2) Citrate (blue) → 3) SST (red) → 4) Li-Heparin (green) → 5) EDTA (purple) → 6) NaF (gray).'}
        </Callout>
      </div>
    </div>
  )
}
