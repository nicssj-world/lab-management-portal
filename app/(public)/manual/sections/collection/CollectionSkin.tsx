import { Icon } from '@/components/ui/Icon'
import { H3, P, StepList } from '../../_primitives'
import { type Lang } from '../../data'

interface Props { lang: Lang }

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
      <P>
        {lang === 'th'
          ? 'ใช้กรณีต้องการเลือดจำนวนน้อย หรือเจาะ Venipuncture ไม่ได้ — ห้ามบีบหรือเค้นบริเวณที่เจาะ เพราะเม็ดเลือดแดงอาจแตก และเนื้อเยื่อ/ของเหลวจะปนเปื้อนทำให้ผลผิดพลาด'
          : 'For small-volume needs or when venipuncture fails. Never squeeze the puncture site — RBC hemolysis and tissue/fluid contamination cause result errors.'}
      </P>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 6 }}>
        {[
          {
            titleTh: 'การเจาะปลายนิ้ว (Finger)', titleEn: 'Finger Puncture',
            subtitleTh: 'ผู้ใหญ่ และเด็ก > 1 ปี', subtitleEn: 'Adults & children > 1 yr',
            bodyTh: 'นิ้วที่ใช้คือนิ้วนางและนิ้วกลาง — บางกว่า และมีผลแทรกซ้อนน้อยกว่านิ้วอื่นๆ',
            bodyEn: 'Use the ring or middle finger — thinner and lower complication rate.',
          },
          {
            titleTh: 'การเจาะส้นเท้า (Heel)', titleEn: 'Heel Puncture',
            subtitleTh: 'ทารกแรกเกิด และเด็กที่ยังไม่เริ่มเดิน', subtitleEn: 'Newborns & pre-walking infants',
            bodyTh: 'ยึดข้อเท้าให้มั่นคง: นิ้วชี้วางตรงโค้งฝ่าเท้า นิ้วหัวแม่มือห่างจากบริเวณที่เจาะ — ตำแหน่งคือด้านข้างทั้งสองของส้นเท้า',
            bodyEn: 'Stabilize the ankle: index finger on the foot arch, thumb away from the puncture site. Target: medial or lateral heel surface.',
          },
        ].map((c) => (
          <div key={c.titleEn} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="syringe" size={16} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{lang === 'th' ? c.titleTh : c.titleEn}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{lang === 'th' ? c.subtitleTh : c.subtitleEn}</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.7 }}>{lang === 'th' ? c.bodyTh : c.bodyEn}</div>
          </div>
        ))}
      </div>

      <H3>{lang === 'th' ? 'ขั้นตอนการเจาะ' : 'Procedure'}</H3>
      <StepList steps={lang === 'th' ? STEPS_TH : STEPS_EN} />
    </div>
  )
}
