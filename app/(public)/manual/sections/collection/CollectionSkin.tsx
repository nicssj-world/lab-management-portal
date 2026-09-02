import { Callout, H3, StepList } from '../../_primitives'
import { Icon } from '@/components/ui/Icon'
import { type Lang } from '../../data'
import { SKIN_STEPS_EN, SKIN_STEPS_TH, SKIN_TYPES } from '../collection-data'

interface Props { lang: Lang }

export function CollectionSkin({ lang }: Props) {
  return (
    <div>
      <Callout tone="warning" icon="alert">
        {lang === 'th'
          ? 'ใช้เมื่อจำเป็นต้องการเลือดจำนวนน้อย หรือไม่สามารถเจาะ Venipuncture ได้ ห้ามบีบหรือเค้นบริเวณที่เจาะ เพราะเม็ดเลือดแดงอาจแตก และเนื้อเยื่อหรือของเหลวอาจปนเปื้อนตัวอย่าง'
          : 'Use when only a small volume is needed or venipuncture is not possible. Never squeeze or milk the site; red-cell hemolysis and tissue or fluid contamination may affect the specimen.'}
      </Callout>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 10, marginBottom: 20 }}>
        {SKIN_TYPES.map(type => (
          <article key={type.titleEn} style={{ padding: '14px 16px', border: `1px solid ${type.border}`, borderTop: `3px solid ${type.color}`, borderRadius: 9, background: type.bg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon name={type.icon} size={21} style={{ color: type.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{lang === 'th' ? type.titleTh : type.titleEn}</div>
                <div style={{ fontSize: 11, color: type.color, fontWeight: 700 }}>{lang === 'th' ? type.subtitleTh : type.subtitleEn}</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.65, paddingTop: 8, borderTop: `1px dashed ${type.border}` }}>
              {lang === 'th' ? type.bodyTh : type.bodyEn}
            </div>
          </article>
        ))}
      </div>

      <H3 mt={0}>{lang === 'th' ? 'ขั้นตอนการเจาะ' : 'Skin-puncture Procedure'}</H3>
      <StepList steps={lang === 'th' ? SKIN_STEPS_TH : SKIN_STEPS_EN} />

    </div>
  )
}
