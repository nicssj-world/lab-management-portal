import { Callout, StepList } from '../../_primitives'
import { type Lang } from '../../data'
import { URINE_SECTIONS } from '../collection-data'

interface Props { lang: Lang }

export function CollectionUrine({ lang }: Props) {
  return (
    <div>
      {URINE_SECTIONS.map((section, index) => (
        <section key={section.id} style={{ marginBottom: index < URINE_SECTIONS.length - 1 ? 20 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 13px', background: section.bg, border: `1px solid ${section.color}25`, borderRadius: '8px 8px 0 0', borderBottom: 'none' }}>
            <span style={{ padding: '2px 8px', borderRadius: 5, background: section.color, color: '#fff', fontSize: 11, fontWeight: 800 }}>{section.id}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: section.color }}>{lang === 'th' ? section.titleTh : section.titleEn}</span>
          </div>
          <div style={{ border: `1px solid ${section.color}20`, borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: 'var(--card)', borderBottom: `1px solid ${section.color}15`, fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
              {lang === 'th' ? section.noteTh : section.noteEn}
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--bg)' }}>
              <StepList steps={lang === 'th' ? section.stepsTh : section.stepsEn} color={section.color} />
            </div>
          </div>
        </section>
      ))}

      <Callout tone="info" icon="clock">
        {lang === 'th'
          ? <span><strong>หมายเหตุ:</strong> กรณีการส่งตรวจ Creatinine Clearance ต้องเจาะเลือดใส่หลอด Li-heparin 3 mL นำส่งพร้อมปัสสาวะ 24 ชั่วโมง เพื่อใช้ในการคำนวณค่า Creatinine Clearance หากเก็บปัสสาวะไม่ครบหรือทำหก จะทำให้ผลการตรวจวิเคราะห์ไม่ถูกต้อง และหากผู้ป่วยมีรอบเดือน ให้เลื่อนการตรวจวิเคราะห์ไปจนกว่ารอบเดือนจะหมด</span>
          : <span><strong>Note:</strong> For Creatinine Clearance, draw 3 mL of blood into a Li-heparin tube and send it with the 24-hour urine for calculation. If the urine is incomplete or spilled, the analytical result will be incorrect. If the patient is menstruating, defer analysis until menstruation has ended.</span>}
      </Callout>
    </div>
  )
}
