import { H2, H3, P, Callout, Section, Th, TblRow } from '../_primitives'
import { type Lang } from '../data'

interface Props { lang: Lang }

const STEPS = [
  { th: 'แพทย์ พยาบาล หรือผู้รับบริการ โทรประสานกับนักเทคนิคการแพทย์ของแต่ละงาน เพื่อประเมินว่าสิ่งตัวอย่างเดิมยังสามารถตรวจวิเคราะห์ซ้ำหรือเพิ่มรายการได้', en: 'Caller phones the MT in the relevant section to confirm the residual specimen is still viable for the requested add-on or repeat.' },
  { th: 'นักเทคนิคการแพทย์ประเมินสภาพตัวอย่างและบันทึกในแบบบันทึกการขอเพิ่มการตรวจวิเคราะห์ทางโทรศัพท์ (Fm-WI-G-OV02/01)', en: 'MT evaluates specimen quality and records the request on form Fm-WI-G-OV02/01 (Add-on Request — phone log).' },
  { th: 'แพทย์ พยาบาล หรือเจ้าหน้าที่ประจำหอผู้ป่วย บันทึกรายการตรวจเพิ่มในระบบ HIS', en: 'Physician, nurse, or ward staff enters the add-on test in HIS.' },
  { th: 'เจ้าหน้าที่ห้องปฏิบัติการลงทะเบียนรับและ print barcode LAB no. ใหม่ ติดที่ภาชนะเดิม — ห้ามทับ barcode เดิม', en: 'Lab staff registers and prints a new LAB no. barcode for the existing container — do not cover the original barcode.' },
  { th: 'นักเทคนิคการแพทย์ดำเนินการตรวจและรายงานผลผ่าน LIS / HIS — แพทย์ดูผลได้ทันที', en: 'MT runs the analysis and reports via LIS / HIS — physician sees the result immediately.' },
]

const RETENTION = [
  { sectionTh: 'งานจุลทรรศนศาสตร์คลินิก',   sectionEn: 'Clinical Microscopy',        retention: '24 ชั่วโมง อุณหภูมิห้อง (Urine สารเสพติด Positive: 2 เดือน 2–8°C)' },
  { sectionTh: 'งานเคมีคลินิก',              sectionEn: 'Clinical Chemistry',         retention: '24 ชั่วโมง 2–8°C' },
  { sectionTh: 'งานโลหิตวิทยาคลินิก',        sectionEn: 'Hematology',                retention: '3 วัน 2–8°C (Blood Smear 7 วัน อุณหภูมิห้อง)' },
  { sectionTh: 'งานภูมิคุ้มกันวิทยาคลินิก', sectionEn: 'Immunology',                retention: '7 วันทำการ 2–8°C (Anti-HIV Positive: 15 วันทำการ)' },
  { sectionTh: 'งานจุลชีววิทยาคลินิก',       sectionEn: 'Microbiology',               retention: '4 วัน 2–8°C' },
  { sectionTh: 'งานคลังเลือด',               sectionEn: 'Blood Bank',                 retention: '7 วัน 2–6°C' },
  { sectionTh: 'งานอณูชีววิทยา',             sectionEn: 'Biomolecular',               retention: 'CD4 / Pharmacogenetics 7 วัน · Viral load 1 เดือน 2–8°C · DNA/RNA 2 ปี −20°C' },
  { sectionTh: 'งานตรวจพิเศษ / OUT LAB',    sectionEn: 'Specialist / OUT LAB',       retention: 'Quadruple test 14 วัน 2–8°C' },
]

export function ManualAddon({ lang }: Props) {
  return (
    <Section>
      <H2 eyebrow="04 · Add-on & Repeat">
        {lang === 'th' ? 'การขอเพิ่มรายการทดสอบโดยใช้สิ่งตัวอย่างเดิม' : 'Add-on / Repeat from Existing Specimen'}
      </H2>
      <P>
        {lang === 'th'
          ? 'การขอตรวจเพิ่มหรือตรวจซ้ำต้องประเมินคุณภาพและอายุของสิ่งตัวอย่างเดิม โดยใช้ตารางระยะเวลาเก็บรักษาสิ่งตัวอย่างหลังการตรวจวิเคราะห์เป็นเกณฑ์ การติดต่อทุกครั้งต้องบันทึกลงในแบบฟอร์ม Fm-WI-G-OV02/01'
          : 'Add-on or repeat tests are gated by specimen viability per the post-analysis storage table. Every request is logged on Fm-WI-G-OV02/01 by the receiving MT.'}
      </P>

      <H3>{lang === 'th' ? 'ขั้นตอน 5 ขั้น' : '5-step workflow'}</H3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
            <div style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12.5, flexShrink: 0 }}>
              {i + 1}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55 }}>{lang === 'th' ? s.th : s.en}</div>
          </div>
        ))}
      </div>

      <H3>{lang === 'th' ? 'ระยะเวลาเก็บสิ่งตัวอย่างหลังการตรวจวิเคราะห์' : 'Post-analysis specimen retention'}</H3>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <Th>{lang === 'th' ? 'งาน' : 'Section'}</Th>
              <Th>{lang === 'th' ? 'ระยะเวลาเก็บ' : 'Retention'}</Th>
            </tr>
          </thead>
          <tbody>
            {RETENTION.map((r) => (
              <TblRow key={r.sectionTh}>
                <td style={{ padding: '10px 12px', color: 'var(--ink)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {lang === 'th' ? r.sectionTh : r.sectionEn}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{r.retention}</td>
              </TblRow>
            ))}
          </tbody>
        </table>
      </div>

      <Callout tone="info" icon="clock">
        {lang === 'th'
          ? <span>หากสิ่งตัวอย่างหมดเวลาเก็บแล้ว ต้องเก็บตัวอย่างใหม่ — ติดต่อ <strong>1455</strong> เพื่อจัดเตรียมภาชนะที่เหมาะสม</span>
          : <span>If the residual specimen has expired, recollection is required — call <strong>1455</strong> to coordinate the appropriate container.</span>}
      </Callout>
    </Section>
  )
}
