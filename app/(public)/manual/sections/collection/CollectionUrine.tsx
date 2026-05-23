import { H3, P, Callout, StepList } from '../../_primitives'
import { type Lang } from '../../data'

interface Props { lang: Lang }

export function CollectionUrine({ lang }: Props) {
  return (
    <div>
      <H3 mt={4}>{lang === 'th' ? '6.1 Random urine — ครั้งเดียวเวลาใดก็ได้' : '6.1 Random urine'}</H3>
      <P>
        {lang === 'th'
          ? 'เหมาะสำหรับงานจุลทรรศนศาสตร์ และการตรวจเบื้องต้นสำหรับผู้ป่วยนอก'
          : 'For microscopy and basic outpatient screening.'}
      </P>
      <StepList steps={lang === 'th' ? [
        'ผู้ป่วยทำความสะอาดอวัยวะสืบพันธุ์ภายนอก',
        'ถ่ายปัสสาวะช่วงแรกทิ้ง · เก็บช่วงกลาง (midstream) ในภาชนะสะอาดมีฝาปิด · ปัสสาวะช่วงสุดท้ายทิ้ง',
        'นำส่งห้องปฏิบัติการภายใน 2 ชั่วโมง',
      ] : [
        'Patient cleans external genitalia.',
        'Discard first stream → collect midstream in clean container → discard last stream.',
        'Deliver within 2 hours.',
      ]} />

      <H3>{lang === 'th' ? '6.2 First morning urine' : '6.2 First morning urine'}</H3>
      <P>
        {lang === 'th'
          ? 'เหมาะสำหรับ Diabetes screening, Pregnancy test, Urine culture · ไม่เหมาะสำหรับงานจุลทรรศนศาสตร์ เพราะปัสสาวะค้างในกระเพาะปัสสาวะนานทำให้เซลล์สลายตัว'
          : 'For diabetes screening, pregnancy test, urine culture. NOT for microscopy — overnight bladder retention causes cell lysis.'}
      </P>

      <H3>{lang === 'th' ? '6.3 ปัสสาวะ 24 ชั่วโมง' : '6.3 24-hour urine'}</H3>
      <P>
        {lang === 'th'
          ? 'ใช้ตรวจระบบเมตาบอลิซึม — Urea, Creatinine, Glucose, Protein, Electrolyte, Hormones — ค่ามีการขับถ่ายต่างกันระหว่างวัน การเก็บ 24 ชม. ให้ค่าที่คงที่แม่นยำกว่า'
          : 'For metabolic studies — Urea, Creatinine, Glucose, Protein, Electrolyte, Hormones. Excretion varies through the day; 24-hr collection gives a stable, accurate value.'}
      </P>
      <StepList steps={lang === 'th' ? [
        'ก่อนนับเวลา: ปัสสาวะทิ้งให้หมด แล้วเริ่มจดเวลา (เช่น 08.00 น.)',
        'เก็บปัสสาวะทุกครั้งใส่ภาชนะที่เตรียมไว้จนครบ 24 ชม. · เก็บครั้งสุดท้ายก่อนเวลาสิ้นสุด (เช่น 08.00 ของวันรุ่งขึ้น)',
        'เก็บภาชนะในตู้เย็น 4 °C หรือกล่องโฟม + น้ำแข็งตลอดเวลา',
        'ครบ 24 ชม. — นำส่งภายใน 2 ชั่วโมง',
      ] : [
        'Before timing starts: void completely and discard. Record start time (e.g., 08:00).',
        'Collect EVERY void in the container for 24 hr. Final collection just before end time (next day 08:00).',
        'Refrigerate the container at 4 °C or keep in iced foam box throughout the 24-hour period.',
        'After 24 hr — deliver within 2 hours.',
      ]} />

      <Callout tone="info" icon="alert">
        {lang === 'th'
          ? <span>กรณีส่งตรวจ <strong>Creatinine Clearance</strong> ต้องเจาะเลือดใส่หลอด Li-heparin 3 mL ส่งคู่กับปัสสาวะ 24 ชม. เพื่อใช้คำนวณค่า · หากเก็บไม่ครบ หรือทำหก → ผลผิดพลาด · หากผู้ป่วยมีรอบเดือน ให้เลื่อนการตรวจ</span>
          : <span>For <strong>Creatinine Clearance</strong>: also draw 3 mL Li-Heparin blood concurrent with the 24-hr urine for calculation. Incomplete or spilled collection invalidates results. Defer testing during menstruation.</span>}
      </Callout>
    </div>
  )
}
