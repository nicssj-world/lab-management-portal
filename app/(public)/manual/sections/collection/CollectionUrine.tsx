import { Callout, StepList } from '../../_primitives'
import { type Lang } from '../../data'

interface Props { lang: Lang }

const SECTIONS = [
  {
    id: '6.1', color: 'var(--primary)', bg: 'var(--primary-soft)',
    titleTh: 'Random urine — ครั้งเดียวเวลาใดก็ได้', titleEn: 'Random Urine',
    noteTh: 'เหมาะสำหรับงานจุลทรรศนศาสตร์ และการตรวจเบื้องต้นสำหรับผู้ป่วยนอก', noteEn: 'For microscopy and basic outpatient screening.',
    stepsTh: [
      'ผู้ป่วยทำความสะอาดอวัยวะสืบพันธุ์ภายนอก',
      'ถ่ายปัสสาวะช่วงแรกทิ้ง · เก็บช่วงกลาง (midstream) ในภาชนะสะอาดมีฝาปิด · ปัสสาวะช่วงสุดท้ายทิ้ง',
      'นำส่งห้องปฏิบัติการภายใน 2 ชั่วโมง',
    ],
    stepsEn: [
      'Patient cleans external genitalia.',
      'Discard first stream → collect midstream in clean container → discard last stream.',
      'Deliver within 2 hours.',
    ],
  },
  {
    id: '6.2', color: '#0891B2', bg: 'rgba(8,145,178,.07)',
    titleTh: 'First morning urine', titleEn: 'First Morning Urine',
    noteTh: 'เหมาะสำหรับ Diabetes screening, Pregnancy test, Urine culture · ไม่เหมาะสำหรับงานจุลทรรศนศาสตร์ เพราะปัสสาวะค้างในกระเพาะปัสสาวะนานทำให้เซลล์สลายตัว',
    noteEn: 'For diabetes screening, pregnancy test, urine culture. NOT for microscopy — overnight bladder retention causes cell lysis.',
    stepsTh: null, stepsEn: null,
  },
  {
    id: '6.3', color: '#7C3AED', bg: 'rgba(124,58,237,.07)',
    titleTh: 'ปัสสาวะ 24 ชั่วโมง', titleEn: '24-Hour Urine',
    noteTh: 'ใช้ตรวจระบบเมตาบอลิซึม — Urea, Creatinine, Glucose, Protein, Electrolyte, Hormones — ค่ามีการขับถ่ายต่างกันระหว่างวัน การเก็บ 24 ชม. ให้ค่าที่คงที่แม่นยำกว่า',
    noteEn: 'For metabolic studies — Urea, Creatinine, Glucose, Protein, Electrolyte, Hormones. Excretion varies through the day; 24-hr collection gives a stable, accurate value.',
    stepsTh: [
      'ก่อนนับเวลา: ปัสสาวะทิ้งให้หมด แล้วเริ่มจดเวลา (เช่น 08.00 น.)',
      'เก็บปัสสาวะทุกครั้งใส่ภาชนะที่เตรียมไว้จนครบ 24 ชม. · เก็บครั้งสุดท้ายก่อนเวลาสิ้นสุด (เช่น 08.00 ของวันรุ่งขึ้น)',
      'เก็บภาชนะในตู้เย็น 4 °C หรือกล่องโฟม + น้ำแข็งตลอดเวลา',
      'ครบ 24 ชม. — นำส่งภายใน 2 ชั่วโมง',
    ],
    stepsEn: [
      'Before timing starts: void completely and discard. Record start time (e.g., 08:00).',
      'Collect EVERY void in the container for 24 hr. Final collection just before end time (next day 08:00).',
      'Refrigerate the container at 4 °C or keep in iced foam box throughout the 24-hour period.',
      'After 24 hr — deliver within 2 hours.',
    ],
  },
]

export function CollectionUrine({ lang }: Props) {
  return (
    <div>
      {SECTIONS.map((sec, i) => (
        <div key={sec.id} style={{ marginBottom: i < SECTIONS.length - 1 ? 20 : 0 }}>
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
