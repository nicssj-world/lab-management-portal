import { H3, P, StepList } from '../../_primitives'
import { type Lang } from '../../data'

interface Props { lang: Lang }

const SOURCES = [
  { kind: 'Arterial',   th: 'เลือดจากเส้นเลือดแดง — แนะนำมากที่สุด · บอกค่า PO₂ และภาวะกรด-ด่างที่แท้จริง', en: 'Arterial blood — preferred. Reports true PO₂ and acid-base status.', color: '#DC2626' },
  { kind: 'Capillary',  th: 'เลือดจากเส้นเลือดฝอย — ใช้ในเด็กเล็ก · ต้องอุ่นบริเวณเจาะก่อน · PO₂ ต่ำกว่า Arterial', en: 'Capillary — pediatric use. Pre-warm site. PO₂ runs lower than arterial.', color: '#D97706' },
  { kind: 'Venous',     th: 'เลือดจากเส้นเลือดดำ — ใช้สำหรับ Arteriovenous shunt เป็นหลัก', en: 'Venous — primarily for Arteriovenous shunt studies.', color: '#0891b2' },
  { kind: 'Pleural pH', th: 'น้ำเจาะปอด (Pleural fluid) — ส่งตรวจหาค่า pH เฉพาะ', en: 'Pleural fluid — pH analysis only.', color: 'var(--primary)' },
]

const SYRINGE_TH = [
  'เตรียม Blood gas syringe (Li-heparin) ให้พร้อม',
  'ชี้บ่งตัวผู้ป่วย และตรวจสติ๊กเกอร์ที่จะติด syringe',
  'เลือกเส้นเลือดแดง: radial (นิยมที่สุด), brachial หรือ femoral · ตรวจการไหลเวียนด้วย modified Allen\'s test ก่อน',
  'เช็ด 70% แอลกอฮอล์ — รอให้แห้ง',
  'ดูดเลือด แล้วปิดจุกเป็น Closed-system อย่าให้มีฟองอากาศ · Mix หมุน + พลิกฝ่ามือ',
  'นำส่งห้องปฏิบัติการทันที · ระหว่างขนส่งใช้ ice pack ตลอดเวลา',
  'บันทึก อุณหภูมิผู้ป่วย และ FIO₂ ในใบนำส่ง',
]

const SYRINGE_EN = [
  'Prepare a Blood Gas syringe (Li-Heparin).',
  'Verify patient identity and the syringe label.',
  'Choose artery: radial (preferred), brachial, or femoral. Perform modified Allen\'s test first.',
  'Disinfect with 70% alcohol — wait until dry.',
  'Draw blood, cap as closed-system (NO air bubbles). Mix by rolling between palms + inversion.',
  'Deliver immediately. Use an ice pack throughout transport in a labeled biohazard pouch.',
  'Record patient temperature and FIO₂ on the request form.',
]

const CAPILLARY_TH = [
  'เตรียม Blood Gas Capillary tube (120 µL · Li-heparin) + จุกยาง 2 อัน + แท่งเหล็ก',
  'ชี้บ่งตัวผู้ป่วย และตรวจสติ๊กเกอร์',
  'อบอุ่นส้นเท้าด้วยน้ำอุ่น ≈ 5 นาที เพื่อกระตุ้นการไหลเวียน · ซับให้แห้ง · จับอุ้งเท้าให้กระชับ',
  'เช็ด 70% แอลกอฮอล์ รอให้แห้ง · ใช้ lancet เจาะลึก 2–3 มม. ตั้งฉาก',
  'รองเลือดให้เต็ม capillary — ระวังไม่ให้มีอากาศแทรก',
  'อุดจุกยาง 1 ข้าง · ใส่แท่งเหล็ก · ปิดจุกอีกข้าง · ใช้แม่เหล็กกลิ้งให้ stirrer เคลื่อน 5–10 ครั้ง',
  'นำส่งทันทีในซองสัญลักษณ์ + ice pack · บันทึก อุณหภูมิ + FIO₂',
]

const CAPILLARY_EN = [
  'Prepare a 120 µL Li-Heparin capillary tube + 2 rubber stoppers + iron stirrer rod.',
  'Verify identity and label.',
  'Pre-warm the heel with warm water ≈ 5 min, pat dry, secure the foot firmly.',
  'Disinfect with 70% alcohol, dry. Lancet puncture 2–3 mm at 90°.',
  'Fill capillary completely — avoid air gaps.',
  'Cap one end, insert iron stirrer, cap the other end. Roll a magnet to move the stirrer 5–10× to mix.',
  'Deliver immediately in labeled pouch with ice pack. Record temperature + FIO₂.',
]

export function CollectionBloodGas({ lang }: Props) {
  return (
    <div>
      <P>
        {lang === 'th'
          ? 'ตัวอย่าง Blood Gas ใช้ได้หลายชนิด — ต้องระบุที่มาในใบนำส่งทุกครั้ง บันทึก อุณหภูมิผู้ป่วย และค่า FIO₂ ขณะเก็บตัวอย่าง'
          : 'Multiple specimen types are valid — always declare source on the request form. Record patient temperature and FIO₂ at collection.'}
      </P>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
        {SOURCES.map((s) => (
          <div key={s.kind} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: s.color, flexShrink: 0 }} />
              <strong style={{ fontSize: 13, color: 'var(--ink)' }}>{s.kind}</strong>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>{lang === 'th' ? s.th : s.en}</div>
          </div>
        ))}
      </div>

      <H3>{lang === 'th' ? '3.1 การเก็บโดยใช้ Blood Gas Syringe (ผู้ใหญ่และเด็ก)' : '3.1 Blood Gas Syringe (adult & pediatric)'}</H3>
      <StepList steps={lang === 'th' ? SYRINGE_TH : SYRINGE_EN} />

      <H3>{lang === 'th' ? '3.2 การเก็บโดยใช้ Blood Gas Capillary Tube (เด็กเล็ก)' : '3.2 Blood Gas Capillary Tube (neonate / infant)'}</H3>
      <StepList steps={lang === 'th' ? CAPILLARY_TH : CAPILLARY_EN} />
    </div>
  )
}
