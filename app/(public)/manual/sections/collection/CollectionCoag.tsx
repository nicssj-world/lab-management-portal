import { Callout, StepList } from '../../_primitives'
import { type Lang } from '../../data'
import { COAG_STEPS_TH, COAG_STEPS_EN } from '../collection-data'

interface Props { lang: Lang }

export function CollectionCoag({ lang }: Props) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 20 }}>
        <div style={{ padding: '12px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 9 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.75 }}>
            {lang === 'th'
              ? 'การเก็บตัวอย่างเลือดสำหรับการตรวจระบบการแข็งตัวของเลือด ใช้สิ่งส่งตรวจคือ Sodium citrate Blood ในหลอด 3.2% Sodium citrate (จุกสีฟ้า)'
              : 'Coagulation specimens use Sodium citrate whole blood in 3.2% Sodium citrate tubes (blue cap).'}
          </p>
        </div>
        <div style={{ padding: '12px 16px', background: 'rgba(8,145,178,.07)', border: '1.5px solid rgba(8,145,178,.25)', borderRadius: 9, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 100 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0891B2', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 4 }}>อัตราส่วน</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#0891B2', lineHeight: 1 }}>1</div>
              <div style={{ fontSize: 9.5, fontWeight: 600, color: '#0891B2', opacity: .75 }}>Citrate</div>
            </div>
            <div style={{ fontSize: 16, color: '#0891B2', opacity: .5 }}>:</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#0891B2', lineHeight: 1 }}>9</div>
              <div style={{ fontSize: 9.5, fontWeight: 600, color: '#0891B2', opacity: .75 }}>Blood</div>
            </div>
          </div>
        </div>
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'ขั้นตอนการเก็บตัวอย่าง PT · aPTT · TT' : 'PT · aPTT · TT Collection'}
      </h3>
      <StepList steps={lang === 'th' ? COAG_STEPS_TH : COAG_STEPS_EN} />

      <div style={{ marginTop: 14 }}>
        <Callout tone="danger" icon="biohazard">
          {lang === 'th'
            ? <span>กรณีผู้ป่วยมีค่า <strong>Hct &gt; 55%</strong> หรือ <strong>Hct &lt; 20%</strong> ให้แจ้งห้องปฏิบัติการก่อนการเจาะเลือด เพื่อปรับปริมาณสารกันเลือดแข็งสำหรับผู้ป่วย และขอรับภาชนะบรรจุเลือดเป็นกรณีพิเศษ</span>
            : <span>If patient <strong>Hct &gt; 55%</strong> or <strong>Hct &lt; 20%</strong>, notify the lab BEFORE collection so the anticoagulant ratio can be adjusted with a custom tube.</span>}
        </Callout>
      </div>
    </div>
  )
}
