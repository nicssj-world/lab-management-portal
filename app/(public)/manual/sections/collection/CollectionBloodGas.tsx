import { StepList } from '../../_primitives'
import { type Lang } from '../../data'
import { ABG_SOURCES, ABG_SYRINGE_TH, ABG_SYRINGE_EN, ABG_CAPILLARY_TH, ABG_CAPILLARY_EN } from '../collection-data'

interface Props { lang: Lang }

export function CollectionBloodGas({ lang }: Props) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'var(--primary-soft)', border: '1px solid rgba(30,95,173,.2)', borderRadius: 9, marginBottom: 20 }}>
        <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>💡</span>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>
          {lang === 'th'
            ? 'ตัวอย่าง Blood Gas ใช้ได้หลายชนิด — ต้องระบุที่มาในใบนำส่งทุกครั้ง บันทึก อุณหภูมิผู้ป่วย และค่า FIO₂ ขณะเก็บตัวอย่าง'
            : 'Multiple specimen types valid — always declare source on the request form. Record patient temperature and FIO₂ at collection.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 8, marginBottom: 20 }}>
        {ABG_SOURCES.map((s) => (
          <div key={s.kind} style={{ padding: '12px 14px', border: `1px solid ${s.color}25`, borderLeft: `3px solid ${s.color}`, borderRadius: 9, background: s.bg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: s.color }}>{s.kind}</span>
              <span style={{ marginLeft: 'auto', padding: '1px 7px', borderRadius: 4, background: s.color, color: '#fff', fontSize: 10, fontWeight: 700 }}>{lang === 'th' ? s.badge : s.badgeEn}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.6 }}>{lang === 'th' ? s.th : s.en}</div>
          </div>
        ))}
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? '3.1 การเก็บโดยใช้ Blood Gas Syringe' : '3.1 Blood Gas Syringe'}
      </h3>
      <div style={{ marginBottom: 20 }}>
        <StepList steps={lang === 'th' ? ABG_SYRINGE_TH : ABG_SYRINGE_EN} />
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? '3.2 การเก็บโดยใช้ Blood Gas Capillary Tube (เด็กเล็ก)' : '3.2 Blood Gas Capillary Tube (neonate / infant)'}
      </h3>
      <StepList steps={lang === 'th' ? ABG_CAPILLARY_TH : ABG_CAPILLARY_EN} />
    </div>
  )
}
