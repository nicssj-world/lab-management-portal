import { H3, Callout, StepList } from '../../_primitives'
import { type Lang } from '../../data'

interface Props { lang: Lang }

export function CollectionVenipuncture({ lang }: Props) {
  const sites = [
    { num: '1.1', th: 'ข้อพับแขน (Antecubital fossa)', en: 'Antecubital fossa', detail: 'Median cubital → Cephalic → Basilic — เลือกตามลำดับ' },
    { num: '1.2', th: 'หลังมือ (Dorsal hand)',           en: 'Dorsal hand',       detail: 'Metacarpal plexus · Dorsal venous arch' },
    { num: '1.3', th: 'หลังเท้า (Dorsal foot)',           en: 'Dorsal foot',       detail: lang === 'th' ? 'ใช้เฉพาะกรณีที่เจาะแขนไม่ได้' : 'Last resort if arms unavailable.' },
  ]

  const steps: string[] = [
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
      <H3 mt={4}>{lang === 'th' ? 'ตำแหน่งที่เหมาะสม' : 'Suitable sites'}</H3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {sites.map((s) => (
          <div key={s.num} style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', letterSpacing: '.06em' }}>SITE {s.num}</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginTop: 4 }}>{lang === 'th' ? s.th : s.en}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>{s.detail}</div>
          </div>
        ))}
      </div>

      <H3>{lang === 'th' ? 'วิธีการเจาะเก็บเลือด' : 'Procedure'}</H3>
      <StepList steps={steps} />

      <Callout tone="warning" icon="alert">
        {lang === 'th'
          ? 'การเรียงลำดับหลอด: 1) Hemoculture → 2) Citrate (จุกฟ้า) → 3) Clotted/SST (จุกแดง) → 4) Li-Heparin (จุกเขียว) → 5) EDTA (จุกม่วง) → 6) NaF (จุกเทา)'
          : 'Order of draw: 1) Blood culture → 2) Citrate (blue) → 3) Clotted/SST (red) → 4) Li-Heparin (green) → 5) EDTA (purple) → 6) NaF (gray).'}
      </Callout>
    </div>
  )
}
