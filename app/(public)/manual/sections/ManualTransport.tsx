import { Icon } from '@/components/ui/Icon'
import { H2, H3, P, Callout, Section } from '../_primitives'
import { type Lang } from '../data'

interface Props { lang: Lang }

const REJECTION_RULES = [
  {
    th: 'ฉลากไม่ครบหรือไม่ชัดเจน',
    en: 'Missing or illegible label',
    bodyTh: 'ตัวชี้บ่งอย่างน้อย 2 รายการ คือ (1) ชื่อ-สกุล และ (2) วันเดือนปีเกิด หรือ HN. หรือ Lab ID',
    bodyEn: 'At least 2 identifiers required: (1) full name and (2) DOB or HN or Lab ID.',
  },
  {
    th: 'ข้อมูลใบนำส่งกับภาชนะไม่ตรงกัน',
    en: 'Form ↔ container mismatch',
    bodyTh: 'ชื่อ-สกุล HN. หรือ LAB ID ของใบนำส่งกับภาชนะบรรจุไม่ตรงกัน',
    bodyEn: 'Patient name, HN, or LAB ID differs between request form and specimen container.',
  },
  {
    th: 'ปริมาตรไม่ได้ตามเกณฑ์',
    en: 'Volume off-spec',
    bodyTh: 'เช่น PT/PTT/ESR ต้องใส่เลือดให้ถึงขีดข้างหลอดพอดี',
    bodyEn: 'e.g., PT, PTT, ESR must fill exactly to the tube indicator line.',
  },
  {
    th: 'ใช้ภาชนะผิดประเภท',
    en: 'Wrong container type',
    bodyTh: 'เช่น ส่ง Electrolyte ในหลอด Clotted (จุกแดง) แทน Li-Heparin (จุกเขียว) หรือ Urine culture ในกระป๋องไม่ Sterile',
    bodyEn: 'e.g., Electrolyte in Clotted (red) instead of Li-Heparin (green); Urine culture in non-sterile container.',
  },
  {
    th: 'ตัวอย่างไม่เหมาะสมสำหรับการตรวจวิเคราะห์',
    en: 'Specimen unsuitable for analysis',
    bodyTh: 'Hemolyzed ≥ 3+ · Fibrin clot (CBC, PT, PTT, ABG) · เก็บผิดวิธี · หกปนเปื้อน · ข้นหนืดเกินดูดวัด',
    bodyEn: 'Hemolysis ≥ 3+, fibrin clot (CBC/PT/PTT/ABG), wrong material, leaked/contaminated, too viscous.',
  },
  {
    th: 'นำส่งไม่ถูกวิธี',
    en: 'Improper transport',
    bodyTh: 'เช่น ABG ที่ไม่ใช้ ice pack · Microbilirubin (เด็ก) ที่ไม่ห่อกระดาษทึบ',
    bodyEn: 'e.g., ABG without ice pack, pediatric microbilirubin not light-protected.',
  },
]

const TEMP_WINDOWS = [
  { temp: 'Room temp',     range: '20–25 °C', tests: 'CBC · BUN · Cr · LFT · Glucose (NaF)',   window: '≤ 2 hr',   color: '#D97706' },
  { temp: 'Refrigerated',  range: '2–8 °C',   tests: 'Coagulation · Lipid · Most TDM',         window: '≤ 24 hr',  color: '#0891b2' },
  { temp: 'Ice pack',      range: '0–4 °C',   tests: 'ABG · NH₃ · Lactate · Renin',            window: '≤ 30 min', color: 'var(--primary)' },
  { temp: 'Light-protected',range: 'Room',    tests: 'Microbilirubin (เด็ก) — ห่อฟอยล์',       window: '≤ 2 hr',   color: '#7E22CE' },
]

const STAT_STEPS = [
  { th: 'แพทย์ พยาบาล หรือผู้รับบริการ โทรประสานกับนักเทคนิคการแพทย์ พร้อมบันทึก Request Lab ในระบบ HIS', en: 'Physician, nurse, or submitter phones the on-duty MT and submits the Lab Request in HIS.' },
  { th: 'จัดเก็บและนำส่งสิ่งตัวอย่างยังห้องปฏิบัติการเทคนิคการแพทย์โดยเร็ว', en: 'Collect and deliver the specimen to the Medical Technology lab without delay.' },
  { th: 'นักเทคนิคการแพทย์ลงทะเบียนรับ ตรวจสอบ และดำเนินการตรวจวิเคราะห์ + รายงานผลกรณีเร่งด่วนก่อน', en: 'MT registers, verifies, and performs analysis + reporting as STAT priority.' },
]

export function ManualTransport({ lang }: Props) {
  return (
    <Section>
      <H2 eyebrow="03 · Transport & Rejection">
        {lang === 'th' ? 'การส่งตัวอย่างส่งตรวจ' : 'Specimen Transport'}
      </H2>
      <P>
        {lang === 'th'
          ? 'สิ่งตัวอย่างส่งตรวจทุกชนิดต้องบรรจุในถุง biohazard ปิดสนิท ใบส่งตรวจอยู่ในช่องด้านนอกของถุง ไม่ปะปนกับตัวอย่าง และจัดส่งห้องปฏิบัติการโดยเร็วที่สุดในสภาวะที่เหมาะสม'
          : 'All specimens are sealed in biohazard bags; request forms travel in the outer pocket and are delivered to the lab as quickly as possible under the appropriate temperature condition.'}
      </P>

      <H3>{lang === 'th' ? 'อุณหภูมิและระยะเวลาส่งตรวจ' : 'Temperature & time windows'}</H3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {TEMP_WINDOWS.map((c) => (
          <div key={c.temp} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: c.color, flexShrink: 0 }} />
              <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{c.temp}</strong>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--muted)', fontFamily: '"IBM Plex Mono",monospace' }}>{c.range}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>{c.tests}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, padding: '2px 8px', borderRadius: 999, background: c.color + '22', color: c.color, fontSize: 11.5, fontWeight: 700 }}>
              <Icon name="clock" size={11} /> {c.window}
            </div>
          </div>
        ))}
      </div>

      <H3>{lang === 'th' ? 'เกณฑ์การปฏิเสธสิ่งตัวอย่างส่งตรวจ' : 'Specimen rejection criteria'}</H3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {REJECTION_RULES.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 14px', border: '1px solid rgba(220,38,38,.25)', borderRadius: 10, background: 'rgba(220,38,38,.04)' }}>
            <div style={{ width: 26, height: 26, borderRadius: 999, background: 'var(--danger)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12.5, flexShrink: 0 }}>
              {i + 1}
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{lang === 'th' ? r.th : r.en}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3, lineHeight: 1.55 }}>{lang === 'th' ? r.bodyTh : r.bodyEn}</div>
            </div>
          </div>
        ))}
      </div>

      <H3>{lang === 'th' ? 'แนวทางการรับสิ่งตัวอย่างกรณีเร่งด่วน (STAT)' : 'Urgent (STAT) specimen flow'}</H3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {STAT_STEPS.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
            <div style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12.5, flexShrink: 0 }}>
              {i + 1}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55 }}>{lang === 'th' ? s.th : s.en}</div>
          </div>
        ))}
      </div>
    </Section>
  )
}
