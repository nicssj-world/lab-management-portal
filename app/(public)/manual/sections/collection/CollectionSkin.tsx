import { StepList } from '../../_primitives'
import { type Lang } from '../../data'

interface Props { lang: Lang }

const TYPES = [
  {
    icon: '👆', titleTh: 'การเจาะปลายนิ้ว (Finger)', titleEn: 'Finger Puncture',
    subtitleTh: 'ผู้ใหญ่ และเด็ก > 1 ปี', subtitleEn: 'Adults & children > 1 yr',
    bodyTh: 'ใช้นิ้วนางและนิ้วกลาง — บางกว่า และมีผลแทรกซ้อนน้อยกว่านิ้วอื่นๆ',
    bodyEn: 'Use the ring or middle finger — thinner skin and lower complication rate.',
    color: 'var(--primary)', bg: 'var(--primary-soft)', border: 'rgba(30,95,173,.2)',
  },
  {
    icon: '👶', titleTh: 'การเจาะส้นเท้า (Heel)', titleEn: 'Heel Puncture',
    subtitleTh: 'ทารกแรกเกิด และเด็กที่ยังไม่เริ่มเดิน', subtitleEn: 'Newborns & pre-walking infants',
    bodyTh: 'ยึดข้อเท้าให้มั่นคง: นิ้วชี้วางตรงโค้งฝ่าเท้า นิ้วหัวแม่มือห่างจากบริเวณที่เจาะ — ตำแหน่งคือด้านข้างทั้งสองของส้นเท้า',
    bodyEn: 'Stabilize the ankle: index finger on the foot arch, thumb away from the puncture site. Target: medial or lateral heel surface.',
    color: '#D97706', bg: 'rgba(217,119,6,.08)', border: 'rgba(217,119,6,.2)',
  },
]

const STEPS_TH = [
  'ชี้บ่งตัวผู้ป่วยและตรวจสติ๊กเกอร์ให้ตรงกับใบนำส่ง',
  'เช็ดผิวด้วยสำลี 70% แอลกอฮอล์ — รอให้แห้ง',
  'ใช้ lancet เจาะลึก 2–3 มม. ตั้งฉากกับลายนิ้ว — ห้ามบีบ',
  'ใช้สำลีแห้งเช็ดเลือดหยดแรกทิ้ง แล้วเก็บหยดต่อไป',
  'ใช้ Capillary Tube (Sodium Heparin, แถบแดง) วางในมุมฉาก เก็บอย่างน้อย 2 ใน 3 ของหลอด · Mix 3–5 ครั้ง · อุดดินน้ำมันสีขาว',
]

const STEPS_EN = [
  'Verify patient identity and label vs. request form.',
  'Disinfect skin with 70% alcohol and let dry completely.',
  'Lancet puncture 2–3 mm deep, perpendicular to the fingerprint lines. Do NOT squeeze.',
  'Wipe away the first drop with dry gauze; collect from the next drop onward.',
  'Hold a Sodium Heparin capillary (red band) at 90° to the drop — fill at least ⅔. Mix 3–5×. Seal one end with white putty.',
]

export function CollectionSkin({ lang }: Props) {
  return (
    <div>
      {/* Warning notice */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'rgba(220,38,38,.04)', border: '1px solid rgba(220,38,38,.18)', borderRadius: 9, marginBottom: 20 }}>
        <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>⚠️</span>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.7 }}>
          {lang === 'th'
            ? 'ใช้กรณีต้องการเลือดจำนวนน้อย หรือเจาะ Venipuncture ไม่ได้ — ห้ามบีบหรือเค้นบริเวณที่เจาะ เพราะเม็ดเลือดแดงอาจแตก และเนื้อเยื่อ/ของเหลวจะปนเปื้อนทำให้ผลผิดพลาด'
            : 'For small-volume needs or when venipuncture fails. Never squeeze the puncture site — RBC hemolysis and tissue/fluid contamination cause result errors.'}
        </p>
      </div>

      {/* Type cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        {TYPES.map((c) => (
          <div key={c.titleEn} style={{ padding: '14px 16px', border: `1px solid ${c.border}`, borderTop: `3px solid ${c.color}`, borderRadius: 9, background: c.bg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 22 }}>{c.icon}</span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{lang === 'th' ? c.titleTh : c.titleEn}</div>
                <div style={{ fontSize: 11, color: c.color, fontWeight: 700 }}>{lang === 'th' ? c.subtitleTh : c.subtitleEn}</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.65, paddingTop: 8, borderTop: `1px dashed ${c.border}` }}>
              {lang === 'th' ? c.bodyTh : c.bodyEn}
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'ขั้นตอนการเจาะ' : 'Procedure'}
      </h3>
      <StepList steps={lang === 'th' ? STEPS_TH : STEPS_EN} />
    </div>
  )
}
