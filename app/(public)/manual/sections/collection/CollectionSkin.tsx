import { StepList } from '../../_primitives'
import { type Lang } from '../../data'
import { SKIN_TYPES, SKIN_STEPS_TH, SKIN_STEPS_EN } from '../collection-data'

interface Props { lang: Lang }

export function CollectionSkin({ lang }: Props) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'rgba(220,38,38,.04)', border: '1px solid rgba(220,38,38,.18)', borderRadius: 9, marginBottom: 20 }}>
        <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>⚠️</span>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>
          {lang === 'th'
            ? 'ใช้กรณีต้องการเลือดจำนวนน้อย หรือเจาะ Venipuncture ไม่ได้ — ห้ามบีบหรือเค้นบริเวณที่เจาะ เพราะเม็ดเลือดแดงอาจแตก และเนื้อเยื่อ/ของเหลวจะปนเปื้อนทำให้ผลผิดพลาด'
            : 'For small-volume needs or when venipuncture fails. Never squeeze the puncture site — RBC hemolysis and tissue/fluid contamination cause result errors.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {SKIN_TYPES.map((c) => (
          <div key={c.titleEn} style={{ padding: '14px 16px', border: `1px solid ${c.border}`, borderTop: `3px solid ${c.color}`, borderRadius: 9, background: c.bg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 22 }}>{c.icon}</span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{lang === 'th' ? c.titleTh : c.titleEn}</div>
                <div style={{ fontSize: 11, color: c.color, fontWeight: 700 }}>{lang === 'th' ? c.subtitleTh : c.subtitleEn}</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.65, paddingTop: 8, borderTop: `1px dashed ${c.border}` }}>
              {lang === 'th' ? c.bodyTh : c.bodyEn}
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'ขั้นตอนการเจาะ' : 'Procedure'}
      </h3>
      <StepList steps={lang === 'th' ? SKIN_STEPS_TH : SKIN_STEPS_EN} />
    </div>
  )
}
