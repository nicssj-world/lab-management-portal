import { Callout, H3, StepList } from '../../_primitives'
import { type Lang } from '../../data'
import { ABG_CAPILLARY_EN, ABG_CAPILLARY_TH, ABG_SOURCES, ABG_SYRINGE_EN, ABG_SYRINGE_TH } from '../collection-data'

interface Props { lang: Lang }

export function CollectionBloodGas({ lang }: Props) {
  return (
    <div>
      <Callout tone="info" icon="droplet">
        {lang === 'th'
          ? 'การส่งตรวจวิเคราะห์ Blood gas สามารถใช้ตัวอย่างเลือดได้หลายชนิด ซึ่งมีข้อบ่งใช้ที่แตกต่างกันไป ได้แก่ เลือดจากเส้นเลือดแดง เลือดจากเส้นเลือดฝอย และตัวอย่างเลือดจากเส้นเลือดดำ นอกจากตัวอย่างเลือดแล้ว น้ำเจาะปอด (Pleural fluid) เป็นสิ่งส่งตรวจอีกชนิดหนึ่งที่ใช้ตรวจ Gas analysis และนิยมส่งตรวจเพื่อหาค่า pH'
          : 'Blood-gas analysis can use several specimen types with different indications: arterial, capillary, and venous blood. In addition to blood, pleural fluid is another specimen for gas analysis and is commonly submitted for pH.'}
      </Callout>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 8, marginBottom: 20 }}>
        {ABG_SOURCES.map(source => (
          <article key={source.kind} style={{ padding: '12px 14px', border: `1px solid ${source.color}25`, borderLeft: `3px solid ${source.color}`, borderRadius: 9, background: source.bg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: source.color }}>{source.kind}</span>
              <span style={{ marginLeft: 'auto', padding: '1px 7px', borderRadius: 4, background: source.color, color: '#fff', fontSize: 10, fontWeight: 700 }}>{lang === 'th' ? source.badge : source.badgeEn}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.6 }}>{lang === 'th' ? source.th : source.en}</div>
          </article>
        ))}
      </div>

      <H3 mt={0}>{lang === 'th' ? '3.1 การเก็บโดยใช้ Blood Gas Syringe' : '3.1 Blood-gas syringe'}</H3>
      <StepList steps={lang === 'th' ? ABG_SYRINGE_TH : ABG_SYRINGE_EN} />

      <H3>{lang === 'th' ? '3.2 การเก็บโดยใช้ Blood Gas Capillary Tube (เด็กเล็ก)' : '3.2 Blood-gas capillary tube (neonate / infant)'}</H3>
      <StepList steps={lang === 'th' ? ABG_CAPILLARY_TH : ABG_CAPILLARY_EN} />

    </div>
  )
}
