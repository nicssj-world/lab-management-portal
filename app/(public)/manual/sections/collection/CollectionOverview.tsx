import React from 'react'
import { Icon } from '@/components/ui/Icon'
import { H3, P, Callout, Th, TblRow } from '../../_primitives'
import { CONTAINERS, type Lang } from '../../data'

interface Props { lang: Lang }

const ORDER_OF_DRAW = [
  { color: '#fbbf24', cap: 'Yellow',  name: 'Blood culture' },
  { color: '#0891b2', cap: 'Blue',    name: 'Citrate · PT/PTT' },
  { color: '#dc2626', cap: 'Red',     name: 'SST · Chemistry' },
  { color: '#16a34a', cap: 'Green',   name: 'Li-Heparin' },
  { color: '#7c3aed', cap: 'Purple',  name: 'EDTA · CBC' },
  { color: '#6b7280', cap: 'Gray',    name: 'NaF · Glucose' },
]

const SITES_TO_AVOID = [
  { th: 'บริเวณที่เป็นแผลเป็น เนื้อเยื่อหนา ทำให้เจาะยาก',                                       en: 'Scarred tissue — thick and hard to puncture.' },
  { th: 'บริเวณที่มีเส้นเลือดดำขอด (Thrombosis vein)',                                              en: 'Areas with thrombosed or varicose veins.' },
  { th: 'บริเวณที่มีรอยช้ำ หรือเลือดออกใต้ผิวหนัง',                                                en: 'Bruised areas with subcutaneous bleeding.' },
  { th: 'แขนข้างเดียวกับหน้าอกที่ผ่าตัด (Mastectomy) — ต้องได้รับความยินยอมจากแพทย์',                en: 'Arm ipsilateral to mastectomy — requires physician consent.' },
  { th: 'แขนที่ทำ AV shunt (Dialysis) — เสี่ยงต่อการติดเชื้อ',                                     en: 'Arm with AV shunt (dialysis) — infection risk.' },
  { th: 'แขนที่กำลังให้ IV — เลือดอาจปนเปื้อน Glucose สูง / Hct ต่ำ',                               en: 'Arm receiving IV — contamination causes falsely high glucose, low Hct. Draw below IV site only with prior consult.' },
]

const PATIENT_PREP = [
  { th: 'FBS · น้ำตาลในเลือด',          en: 'Fasting Blood Sugar', prepTh: 'งดอาหารและเครื่องดื่มทุกชนิด ≥ 8 ชั่วโมง (ดื่มน้ำเปล่าได้)', prepEn: 'NPO ≥ 8 hr (water permitted)' },
  { th: 'Lipid profile · Triglyceride',  en: 'Lipid Profile',       prepTh: 'งดอาหารและเครื่องดื่มทุกชนิด ≥ 12 ชั่วโมง (ดื่มน้ำเปล่าได้)', prepEn: 'NPO ≥ 12 hr (water permitted)' },
  { th: 'OGTT · ผู้ใหญ่',               en: 'OGTT — Adult',        prepTh: 'NPO ≥ 8 ชม. ดื่ม Glucose 75 g ใน 250–300 mL ภายใน 5 นาที เจาะ 0 ชม. และ 2 ชม.', prepEn: 'NPO ≥ 8 hr. Drink 75 g glucose in 250–300 mL within 5 min. Draw at 0 hr and 2 hr.' },
  { th: 'OGTT · เด็ก',                  en: 'OGTT — Pediatric',    prepTh: 'กลูโคส 1.75 g/kg น้ำหนัก ไม่เกิน 75 g รวม', prepEn: 'Glucose 1.75 g/kg, max 75 g total.' },
  { th: 'GCT · หญิงมีครรภ์',            en: 'GCT — Pregnancy',     prepTh: 'ไม่ต้องงดอาหาร ดื่ม Glucose 50 g ใน 100–150 mL ใน 5 นาที เจาะที่ 1 ชม.', prepEn: 'No fasting. Drink 50 g glucose in 100–150 mL within 5 min. Draw at 1 hr.' },
  { th: 'OGTT · หญิงมีครรภ์',           en: 'OGTT — Pregnancy',    prepTh: 'NPO ≥ 8 ชม. ดื่ม Glucose 100 g เจาะที่ 0, 1, 2, 3 ชม.', prepEn: 'NPO ≥ 8 hr. Drink 100 g glucose. Draw at 0, 1, 2, 3 hr.' },
]

export function CollectionOverview({ lang }: Props) {
  return (
    <div>
      <P>
        {lang === 'th'
          ? 'การชี้บ่งตัวผู้ป่วยใช้อย่างน้อย 2 รายการ คือ (1) ชื่อ-นามสกุล และ (2) วันเดือนปีเกิด หรือ HN. ห้ามติดสติ๊กเกอร์หลอดล่วงหน้า ต้องตรวจสอบให้ตรงกับใบนำส่งทุกครั้งก่อนเจาะ'
          : 'Patient identification uses at least two identifiers — (1) full name and (2) DOB or HN. Never pre-label tubes; verify against the request form before every venipuncture.'}
      </P>

      <H3>{lang === 'th' ? 'ลำดับการใส่เลือดลงในหลอด (Order of draw)' : 'Order of draw'}</H3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 12px', background: 'var(--surface-2)', borderRadius: 10, overflowX: 'auto' }}>
        {ORDER_OF_DRAW.map((t, i) => (
          <React.Fragment key={t.cap}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 84 }}>
              <span style={{ display: 'inline-block', width: 18, height: 50, borderRadius: 4, background: `linear-gradient(180deg,${t.color} 28%,#fff 28%,#f3f4f6 100%)`, border: '1px solid rgba(0,0,0,.1)' }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink)' }}>{i + 1}. {t.cap}</span>
              <span style={{ fontSize: 10.5, color: 'var(--muted)', textAlign: 'center' }}>{t.name}</span>
            </div>
            {i < ORDER_OF_DRAW.length - 1 && (
              <Icon name="arrowRight" size={12} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            )}
          </React.Fragment>
        ))}
      </div>

      <H3>{lang === 'th' ? 'ภาชนะสำหรับเก็บสิ่งตัวอย่างส่งตรวจ' : 'Specimen containers reference'}</H3>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', maxHeight: 520, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
              <Th>{lang === 'th' ? 'ภาชนะ / สีฝา' : 'Container / cap'}</Th>
              <Th>{lang === 'th' ? 'การใช้งานหลัก' : 'Primary use'}</Th>
              <Th>{lang === 'th' ? 'จุดเบิก' : 'Requisition'}</Th>
            </tr>
          </thead>
          <tbody>
            {CONTAINERS.map((c) => (
              <TblRow key={c.cap}>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 22, borderRadius: 3, background: `linear-gradient(180deg,${c.color} 30%,#fff 30%,#f3f4f6 100%)`, border: '1px solid rgba(0,0,0,.08)', flexShrink: 0 }} />
                    <strong style={{ fontSize: 12.5 }}>{c.cap}</strong>
                  </span>
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--ink)' }}>{c.use}</td>
                <td style={{ padding: '10px 12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{c.req}</td>
              </TblRow>
            ))}
          </tbody>
        </table>
      </div>

      <H3>{lang === 'th' ? 'ตำแหน่งที่ควรหลีกเลี่ยงในการเจาะเลือด' : 'Sites to avoid'}</H3>
      <ul style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.85, margin: '0 0 6px', paddingLeft: 20 }}>
        {SITES_TO_AVOID.map((s, i) => (
          <li key={i}>{lang === 'th' ? s.th : s.en}</li>
        ))}
      </ul>

      <H3>{lang === 'th' ? 'การเตรียมผู้ป่วยตามรายการตรวจ' : 'Patient preparation by test'}</H3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {PATIENT_PREP.map((p) => (
          <div key={p.en} style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{lang === 'th' ? p.th : p.en}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{lang === 'th' ? p.en : p.th}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', marginTop: 6, lineHeight: 1.55 }}>{lang === 'th' ? p.prepTh : p.prepEn}</div>
          </div>
        ))}
      </div>

      <Callout tone="danger" icon="biohazard">
        {lang === 'th'
          ? 'หลอด Sodium citrate (จุกฟ้า) ต้องใส่เลือดให้ถึงขีดข้างหลอดพอดี — ห้ามขาดหรือเกินโดยเด็ดขาด หาก Hct > 55% หรือ < 20% ให้แจ้งห้องปฏิบัติการก่อนเจาะเพื่อปรับสารกันเลือดแข็ง'
          : 'Sodium citrate tubes (blue cap) MUST fill exactly to the indicator line — never under or over. If Hct > 55% or < 20%, notify the lab BEFORE collection so the anticoagulant ratio can be adjusted.'}
      </Callout>

      <Callout tone="warning" icon="alert">
        {lang === 'th'
          ? 'ห้ามรัดแขนผู้ป่วยเกิน 2 นาที — ค่าตรวจหลายรายการจะเปลี่ยนแปลง · ห้ามดัน Syringe เมื่อใส่เลือดลงหลอด (เสี่ยง Hemolysis) · ใช้ one-hand technique โดยวางหลอดใน rack'
          : 'Tourniquet ≤ 2 min — longer values shift many analytes. Do not push the syringe plunger into the tube (hemolysis risk). Use one-hand technique with the tube in a rack.'}
      </Callout>
    </div>
  )
}
