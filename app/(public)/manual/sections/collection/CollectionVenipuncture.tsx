import { Callout, StepList } from '../../_primitives'
import { type Lang } from '../../data'

interface Props { lang: Lang }

const SITES = [
  { num: '1', priority: 'แนะนำ', priorityEn: 'Preferred', th: 'ข้อพับแขน (Antecubital fossa)', en: 'Antecubital fossa', detail: 'Median cubital → Cephalic → Basilic — เลือกตามลำดับ', detailEn: 'Median cubital → Cephalic → Basilic — in order of preference.', color: 'var(--success)', bg: 'rgba(22,163,74,.08)', border: 'rgba(22,163,74,.2)' },
  { num: '2', priority: 'ทางเลือก', priorityEn: 'Alternative', th: 'หลังมือ (Dorsal hand)', en: 'Dorsal hand', detail: 'Metacarpal plexus · Dorsal venous arch', detailEn: 'Metacarpal plexus · Dorsal venous arch', color: '#D97706', bg: 'rgba(217,119,6,.08)', border: 'rgba(217,119,6,.2)' },
  { num: '3', priority: 'สุดท้าย', priorityEn: 'Last resort', th: 'หลังเท้า (Dorsal foot)', en: 'Dorsal foot', detail: 'ใช้เฉพาะกรณีที่เจาะแขนไม่ได้', detailEn: 'Last resort if arms unavailable.', color: 'var(--muted)', bg: 'var(--surface-2)', border: 'var(--border)' },
]

export function CollectionVenipuncture({ lang }: Props) {
  const steps: React.ReactNode[] = [
    lang === 'th'
      ? 'ชี้บ่งตัวผู้ป่วย: ถามชื่อ-นามสกุล และวัน-เดือน-ปีเกิด ให้ผู้ป่วยตอบเอง · ตรวจชนิดหลอด · ตรวจสติ๊กเกอร์ตรงกับใบนำส่ง'
      : 'Verify identity: ask patient to state name + DOB (have THEM answer). Check tube type matches the order. Confirm label matches request form.',
    lang === 'th' ? 'ใช้สำลี 70% แอลกอฮอล์ เช็ดฆ่าเชื้อผิวหนังบริเวณที่จะเจาะ รอให้แห้ง' : 'Disinfect the puncture site with 70% alcohol — wait for it to dry.',
    lang === 'th'
      ? 'กรณีเข็มสองปลาย: ปล่อยให้สุญญากาศดูดเลือดจนครบปริมาตร แล้วค่อยๆดึงหลอดออก'
      : 'Vacutainer needle: let vacuum draw blood to the indicator line, then withdraw the tube gently.',
    lang === 'th'
      ? 'กรณีใช้ Syringe: เมื่อได้เลือดครบ แทงเข็มผ่านฝาหลอด ปล่อยให้เลือดไหลเข้าหลอดเอง — ห้ามดัน syringe เพื่อป้องกัน Hemolysis · ใช้ one-hand technique'
      : 'Syringe technique: pierce the tube cap and let blood flow in by vacuum — never push the plunger (hemolysis). One-hand technique: tube in rack.',
    lang === 'th' ? 'ห้ามรัดแขนเกิน 2 นาที — หลายค่าจะเปลี่ยนแปลง' : 'Tourniquet ≤ 2 min — longer values shift many analytes.',
    lang === 'th'
      ? 'พลิกหลอดที่มีสารกันเลือดแข็ง 8–10 ครั้ง แบบ End-over-end inversion · หลอดที่ไม่มีสารกันเลือดแข็ง 3–5 ครั้ง'
      : 'Mix anticoagulant tubes 8–10× end-over-end. Clot activator tubes: 3–5× inversion.',
  ]

  return (
    <div>
      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'ตำแหน่งที่เหมาะสม' : 'Suitable Sites'}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
        {SITES.map((s) => (
          <div key={s.num} style={{ padding: '13px 14px', border: `1px solid ${s.border}`, borderTop: `3px solid ${s.color}`, borderRadius: 9, background: s.bg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{s.num}</div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: s.color, letterSpacing: '.04em', textTransform: 'uppercase' }}>{lang === 'th' ? s.priority : s.priorityEn}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{lang === 'th' ? s.th : s.en}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>{lang === 'th' ? s.detail : s.detailEn}</div>
          </div>
        ))}
      </div>

      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'วิธีการเจาะเก็บเลือด' : 'Procedure'}
      </h3>
      <StepList steps={steps} />

      <div style={{ marginTop: 14 }}>
        <Callout tone="warning" icon="alert">
          {lang === 'th'
            ? 'ลำดับหลอด: 1) Hemoculture → 2) Citrate (ฟ้า) → 3) SST (แดง) → 4) Li-Heparin (เขียว) → 5) EDTA (ม่วง) → 6) NaF (เทา)'
            : 'Order: 1) Blood culture → 2) Citrate (blue) → 3) SST (red) → 4) Li-Heparin (green) → 5) EDTA (purple) → 6) NaF (gray).'}
        </Callout>
      </div>
    </div>
  )
}
