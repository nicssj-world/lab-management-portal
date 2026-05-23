import { H3, P, Callout, StepList } from '../../_primitives'
import { type Lang } from '../../data'

interface Props { lang: Lang }

const STEPS_TH = [
  'ชี้บ่งตัวผู้ป่วย — ชื่อ-สกุล และวัน-เดือน-ปีเกิด ให้ผู้ป่วยตอบเอง · ตรวจชนิดหลอด และสติ๊กเกอร์',
  'เช็ดผิว 70% แอลกอฮอล์ — รอให้แห้ง',
  'เจาะใส่หลอด 3.2% Sodium citrate ให้ถึงขีดบอกปริมาตร — ห้ามขาดหรือเกินโดยเด็ดขาด',
  'คว่ำหลอดไปมา 8–10 ครั้ง เพื่อให้เลือดผสมกับสารกันเลือดแข็ง · ระวังอย่าให้เกิดฟอง — จะทำให้ Fibrinogen, FV, FVIII ลดประสิทธิภาพ',
]

const STEPS_EN = [
  'Identify patient — full name + DOB stated by the patient. Confirm tube + label match the request.',
  'Disinfect with 70% alcohol — let dry.',
  'Fill the 3.2% sodium citrate tube exactly to the indicator line — NEVER under or over.',
  'Invert 8–10× to mix with anticoagulant. Avoid foam — it degrades Fibrinogen, FV, and FVIII activity.',
]

export function CollectionCoag({ lang }: Props) {
  return (
    <div>
      <P>
        {lang === 'th'
          ? 'การเก็บตัวอย่างเลือดสำหรับการตรวจระบบการแข็งตัวของเลือด ใช้สิ่งส่งตรวจคือ Sodium citrate Blood ในหลอด 3.2% Sodium citrate (จุกสีฟ้า) อัตราส่วน สารกันเลือดแข็ง : เลือด เท่ากับ 1 : 9'
          : 'Coagulation specimens use Sodium citrate whole blood in 3.2% Sodium citrate tubes (blue cap). Anticoagulant : blood ratio = 1 : 9.'}
      </P>

      <H3>{lang === 'th' ? 'ขั้นตอนการเก็บตัวอย่าง PT · aPTT · TT' : 'PT · aPTT · TT collection'}</H3>
      <StepList steps={lang === 'th' ? STEPS_TH : STEPS_EN} />

      <Callout tone="danger" icon="biohazard">
        {lang === 'th'
          ? <span>กรณีผู้ป่วยมีค่า <strong>Hct &gt; 55%</strong> หรือ <strong>Hct &lt; 20%</strong> ให้แจ้งห้องปฏิบัติการก่อนการเจาะเลือด เพื่อปรับปริมาณสารกันเลือดแข็งสำหรับผู้ป่วย และขอรับภาชนะบรรจุเลือดเป็นกรณีพิเศษ</span>
          : <span>If patient <strong>Hct &gt; 55%</strong> or <strong>Hct &lt; 20%</strong>, notify the lab BEFORE collection so the anticoagulant ratio can be adjusted with a custom tube.</span>}
      </Callout>
    </div>
  )
}
