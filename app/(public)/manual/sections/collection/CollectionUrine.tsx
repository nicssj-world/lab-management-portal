import { Callout, StepList } from '../../_primitives'
import { type Lang } from '../../data'
import { URINE_SECTIONS } from '../collection-data'

interface Props { lang: Lang }

export function CollectionUrine({ lang }: Props) {
  return (
    <div>
      {URINE_SECTIONS.map((sec, i) => (
        <div key={sec.id} style={{ marginBottom: i < URINE_SECTIONS.length - 1 ? 20 : 0 }}>
          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 13px', background: sec.bg, border: `1px solid ${sec.color}25`, borderRadius: '8px 8px 0 0', borderBottom: 'none' }}>
            <span style={{ padding: '2px 8px', borderRadius: 5, background: sec.color, color: '#fff', fontSize: 11, fontWeight: 800 }}>{sec.id}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: sec.color }}>{lang === 'th' ? sec.titleTh : sec.titleEn}</span>
          </div>
          {/* Content */}
          <div style={{ border: `1px solid ${sec.color}20`, borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: 'var(--card)', borderBottom: sec.stepsTh ? `1px solid ${sec.color}15` : 'none', fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
              {lang === 'th' ? sec.noteTh : sec.noteEn}
            </div>
            {(lang === 'th' ? sec.stepsTh : sec.stepsEn) && (
              <div style={{ padding: '12px 14px', background: 'var(--bg)' }}>
                <StepList steps={(lang === 'th' ? sec.stepsTh! : sec.stepsEn!)} color={sec.color} />
              </div>
            )}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 14 }}>
        <Callout tone="info" icon="alert">
          {lang === 'th'
            ? <span>กรณีส่งตรวจ <strong>Creatinine Clearance</strong> ต้องเจาะเลือดใส่หลอด Li-heparin 3 mL ส่งคู่กับปัสสาวะ 24 ชม. เพื่อใช้คำนวณค่า · หากเก็บไม่ครบ หรือทำหก → ผลผิดพลาด · หากผู้ป่วยมีรอบเดือน ให้เลื่อนการตรวจ</span>
            : <span>For <strong>Creatinine Clearance</strong>: also draw 3 mL Li-Heparin blood concurrent with the 24-hr urine for calculation. Incomplete or spilled collection invalidates results. Defer testing during menstruation.</span>}
        </Callout>
      </div>
    </div>
  )
}
