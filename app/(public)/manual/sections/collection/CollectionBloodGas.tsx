import { StepList } from '../../_primitives'
import { type Lang } from '../../data'

interface Props { lang: Lang }

const SOURCES = [
  { kind: 'Arterial',   th: 'เลือดจากเส้นเลือดแดง — แนะนำมากที่สุด · บอกค่า PO₂ และภาวะกรด-ด่างที่แท้จริง', en: 'Preferred. Reports true PO₂ and acid-base status.', color: '#DC2626', bg: 'rgba(220,38,38,.07)', badge: '★ แนะนำ', badgeEn: '★ Preferred' },
  { kind: 'Capillary',  th: 'เลือดจากเส้นเลือดฝอย — ใช้ในเด็กเล็ก · ต้องอุ่นบริเวณเจาะก่อน · PO₂ ต่ำกว่า Arterial', en: 'Pediatric use. Pre-warm site. PO₂ runs lower than arterial.', color: '#D97706', bg: 'rgba(217,119,6,.07)', badge: 'เด็กเล็ก', badgeEn: 'Pediatric' },
  { kind: 'Venous',     th: 'เลือดจากเส้นเลือดดำ — ใช้สำหรับ Arteriovenous shunt เป็นหลัก', en: 'Primarily for Arteriovenous shunt studies.', color: '#0891b2', bg: 'rgba(8,145,178,.07)', badge: 'AV shunt', badgeEn: 'AV shunt' },
  { kind: 'Pleural pH', th: 'น้ำเจาะปอด (Pleural fluid) — ส่งตรวจหาค่า pH เฉพาะ', en: 'Pleural fluid — pH analysis only.', color: 'var(--primary)', bg: 'var(--primary-soft)', badge: 'pH only', badgeEn: 'pH only' },
]

const SYRINGE_TH = [
  'เตรียม Blood gas syringe (Li-heparin) ให้พร้อม',
  'ชี้บ่งตัวผู้ป่วย และตรวจสติ๊กเกอร์ที่จะติด syringe',
  "เลือกเส้นเลือดแดง: radial (นิยมที่สุด), brachial หรือ femoral · ตรวจการไหลเวียนด้วย modified Allen's test ก่อน",
  'เช็ด 70% แอลกอฮอล์ — รอให้แห้ง',
  'ดูดเลือด แล้วปิดจุกเป็น Closed-system อย่าให้มีฟองอากาศ · Mix หมุน + พลิกฝ่ามือ',
  'นำส่งห้องปฏิบัติการทันที · ระหว่างขนส่งใช้ ice pack ตลอดเวลา',
  'บันทึก อุณหภูมิผู้ป่วย และ FIO₂ ในใบนำส่ง',
]
const SYRINGE_EN = [
  'Prepare a Blood Gas syringe (Li-Heparin).',
  'Verify patient identity and the syringe label.',
  "Choose artery: radial (preferred), brachial, or femoral. Perform modified Allen's test first.",
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
      <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'var(--primary-soft)', border: '1px solid rgba(30,95,173,.2)', borderRadius: 9, marginBottom: 20 }}>
        <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>💡</span>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>
          {lang === 'th'
            ? 'ตัวอย่าง Blood Gas ใช้ได้หลายชนิด — ต้องระบุที่มาในใบนำส่งทุกครั้ง บันทึก อุณหภูมิผู้ป่วย และค่า FIO₂ ขณะเก็บตัวอย่าง'
            : 'Multiple specimen types valid — always declare source on the request form. Record patient temperature and FIO₂ at collection.'}
        </p>
      </div>

      {/* Sources */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 }}>
        {SOURCES.map((s) => (
          <div key={s.kind} style={{ padding: '12px 14px', border: `1px solid ${s.color}25`, borderLeft: `3px solid ${s.color}`, borderRadius: 9, background: s.bg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: s.color }}>{s.kind}</span>
              <span style={{ marginLeft: 'auto', padding: '1px 7px', borderRadius: 4, background: s.color, color: '#fff', fontSize: 10, fontWeight: 700 }}>{lang === 'th' ? s.badge : s.badgeEn}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.6 }}>{lang === 'th' ? s.th : s.en}</div>
          </div>
        ))}
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? '3.1 การเก็บโดยใช้ Blood Gas Syringe' : '3.1 Blood Gas Syringe'}
      </h3>
      <div style={{ marginBottom: 20 }}>
        <StepList steps={lang === 'th' ? SYRINGE_TH : SYRINGE_EN} />
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? '3.2 การเก็บโดยใช้ Blood Gas Capillary Tube (เด็กเล็ก)' : '3.2 Blood Gas Capillary Tube (neonate / infant)'}
      </h3>
      <StepList steps={lang === 'th' ? CAPILLARY_TH : CAPILLARY_EN} />
    </div>
  )
}
