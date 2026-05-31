import { Callout } from '../../_primitives'
import { type Lang } from '../../data'

interface Props { lang: Lang }

const PRINCIPLES_TH = [
  'ควรเก็บก่อนให้ Antibiotics — หากให้แล้ว ให้เก็บก่อนการให้ครั้งถัดไป เพื่อลดความเข้มข้นใน sample',
  'เลือกเวลาเก็บให้เหมาะกับระยะของโรค (เช่น Typhoid: เลือดในสัปดาห์แรก / อุจจาระในระยะหลัง)',
  'เลือกตำแหน่ง / ปริมาณที่มีโอกาสพบเชื้อสูง',
  'หลีกเลี่ยงการปนเปื้อนของ normal biota — ให้คำแนะนำชัดเจนเมื่อผู้ป่วยเก็บเอง',
  'ใช้ภาชนะปราศจากเชื้อ และ Transport media ที่เหมาะสม',
  'นำส่งโดยเร็วที่สุด — เชื้อบางชนิดตายง่ายเมื่ออยู่นอกร่างกาย',
  'กรอกใบนำส่งให้ครบ + ติดฉลากที่ภาชนะให้ครบ (ชื่อ-สกุล, HN, ตำแหน่งที่เก็บ, เวลาที่เก็บ)',
  'ใช้ aseptic technique ที่เหมาะสมเสมอ — บางการเก็บสามารถนำเชื้อเข้าผู้ป่วยได้',
]
const PRINCIPLES_EN = [
  'Collect BEFORE starting antibiotics — if already on therapy, collect just before the next dose.',
  'Match collection timing to disease stage (e.g., Typhoid: blood in week 1, stool later).',
  'Collect from sites with the highest likelihood of recovery; volume matters.',
  'Avoid normal-biota contamination — give clear instructions if patient self-collects.',
  'Use sterile containers and the correct transport media.',
  'Deliver as fast as possible — some pathogens die rapidly outside the body.',
  'Complete the request form + container label fully (name, HN, source site, time collected).',
  'Always use proper aseptic technique — some collections risk introducing infection.',
]

const TRANSPORTS = [
  { name: 'Cary & Blair',   icon: '🧫', useTh: 'Rectal swab · Stool swab',                       useEn: 'Rectal/Stool swab' },
  { name: 'Amies',           icon: '🧪', useTh: 'Wound · Genital · Throat swab',                   useEn: 'Wound · Genital · Throat swab' },
  { name: 'Sterile cup',    icon: '🥛', useTh: 'Urine culture · Fluid culture · Sputum',          useEn: 'Urine / Fluid / Sputum culture' },
  { name: 'Sterile bottle', icon: '🍶', useTh: 'CSF · Body fluid (cell count, culture)',          useEn: 'CSF / Body fluid (count, culture)' },
  { name: 'Hemoculture',    icon: '🩸', useTh: 'Blood culture aerobic / anaerobic / fungal / TB', useEn: 'Blood culture aerobic / anaerobic / fungal / TB' },
  { name: 'NP swab + VTM',  icon: '💨', useTh: 'COVID PCR · Xpert',                              useEn: 'COVID PCR · Xpert' },
]

const URINE_PATHS = [
  { kind: 'Clean-voided midstream', bodyTh: 'ล้างมือ + ทำความสะอาดอวัยวะเพศ ถ่ายช่วงแรกทิ้ง เก็บช่วงกลาง 15–20 mL', bodyEn: 'Wash hands + genital area. Discard first stream. Collect midstream 15–20 mL.', color: 'var(--primary)', bg: 'var(--primary-soft)' },
  { kind: 'Catheterized', bodyTh: 'clamp ด้านล่าง sampling port 10–15 นาที · เช็ด port ด้วย 70% alcohol หรือ 2% chlorhexidine · ใช้เข็มดูด 15–20 mL', bodyEn: 'Clamp below sampling port 10–15 min. Disinfect port (70% alcohol or 2% chlorhexidine). Aspirate 15–20 mL.', color: '#0891B2', bg: 'rgba(8,145,178,.07)' },
  { kind: 'Intermittent catheter', bodyTh: 'ใส่ถุงมือ aseptic technique ปล่อยช่วงแรกทิ้ง เก็บช่วงกลาง 15–20 mL', bodyEn: 'Gloved, aseptic in-and-out catheter. Discard first stream, collect midstream 15–20 mL.', color: '#7C3AED', bg: 'rgba(124,58,237,.07)' },
]

const SPUTUM = [
  { k: 'Expectorated', th: 'บ้วนปากด้วยน้ำ · หายใจลึก กลั้น · ไอแรงเอาเสมหะออก · บ้วนใน sterile cup โดยให้ปนเปื้อนน้ำลายน้อยที่สุด', en: 'Rinse mouth with water. Deep breath, hold, cough deeply into a sterile cup with minimal saliva.' },
  { k: 'Endotracheal', th: 'aseptic technique · ใส่สายลึกเท่าท่อ ไม่ดูดขณะใส่ · ดูด 5–10 วินาที (≤ 15) · ไม่ดูดขณะดึงสายออก', en: 'Aseptic. Insert to tube depth WITHOUT suction. Suction 5–10 s (≤ 15 s). No suction on withdrawal.' },
  { k: 'BAL', th: 'แพทย์ทำระหว่าง Bronchoscopy — ใส่ 0.9% NaCl ในหลอดลมส่วนปลาย ดูดกลับ · หุ้ม parafilm นำส่งทันที', en: 'Physician procedure during bronchoscopy. Instill 0.9% NaCl distally, re-aspirate. Wrap parafilm, deliver immediately.' },
]

export function CollectionMicro({ lang }: Props) {
  const principles = lang === 'th' ? PRINCIPLES_TH : PRINCIPLES_EN

  return (
    <div>
      {/* Principles */}
      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'หลักการทั่วไป' : 'General Principles'}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 20 }}>
        {principles.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', background: i % 2 === 0 ? 'var(--card)' : 'var(--bg)', border: '1px solid var(--border)', borderLeft: '3px solid var(--primary)', borderRadius: 7 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--primary-soft)', border: '1.5px solid rgba(30,95,173,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 800, color: 'var(--primary)', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
            <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>{p}</span>
          </div>
        ))}
      </div>

      {/* Transport media */}
      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'ภาชนะและ Transport Media' : 'Containers & Transport Media'}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
        {TRANSPORTS.map((t) => (
          <div key={t.name} style={{ padding: '11px 13px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <strong style={{ fontSize: 12.5, color: 'var(--ink)' }}>{t.name}</strong>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>{lang === 'th' ? t.useTh : t.useEn}</div>
          </div>
        ))}
      </div>

      {/* Urine culture */}
      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'การเก็บปัสสาวะเพื่อเพาะเชื้อ (3 รูปแบบ)' : 'Urine for Culture — 3 Methods'}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 8 }}>
        {URINE_PATHS.map((u, i) => (
          <div key={u.kind} style={{ display: 'flex', gap: 10, padding: '11px 13px', border: `1px solid ${u.color}25`, borderLeft: `3px solid ${u.color}`, borderRadius: 9, background: u.bg }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: u.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: u.color, letterSpacing: '.03em', marginBottom: 3 }}>{u.kind}</div>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>{lang === 'th' ? u.bodyTh : u.bodyEn}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <Callout tone="warning" icon="alert">
          {lang === 'th'
            ? <span>ต้องมีผล Urinalysis บ่งชี้: <strong>WBC ≥ 5–10/HPF</strong> หรือ <strong>Leukocyte esterase ≥ 1+</strong> · ยกเว้นผู้ป่วย Low immune / Febrile neutropenia / ทารก &lt; 6 เดือน / ปลูกถ่ายไต / ระบบทางเดินปัสสาวะ / แพทย์ระบุเหตุผล + เลขใบประกอบฯ</span>
            : <span>Requires Urinalysis evidence: <strong>WBC ≥ 5–10/HPF</strong> OR <strong>Leukocyte esterase ≥ 1+</strong>. Exceptions: low-immune / febrile neutropenia, infant &lt; 6 mo, kidney transplant, urology, physician-specified reason with license number.</span>}
        </Callout>
      </div>

      {/* Sputum */}
      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'การเก็บเสมหะ (3 วิธี)' : 'Sputum Collection — 3 Methods'}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        {SPUTUM.map((m, i) => (
          <div key={m.k} style={{ padding: '11px 13px', border: '1px solid var(--border)', borderTop: '3px solid var(--primary)', borderRadius: 9, background: 'var(--card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{i + 1}</div>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--primary)', letterSpacing: '.04em' }}>{m.k}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.6 }}>{lang === 'th' ? m.th : m.en}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <Callout tone="warning" icon="alert">
          {lang === 'th'
            ? <span>คุณภาพเสมหะ: ต้องมี <strong>WBC &gt; 25 cells/LPF</strong> และ <strong>Squamous Epithelial cell &lt; 10 cells/LPF</strong> · ผู้ป่วย low immune / ทารก &lt; 6 ด. ใช้เกณฑ์ SEC อย่างเดียว</span>
            : <span>Sputum quality: <strong>WBC &gt; 25/LPF</strong> AND <strong>SEC &lt; 10/LPF</strong>. For low-immune / infants &lt; 6 mo, only SEC criterion applies.</span>}
        </Callout>
      </div>

      {/* CSF */}
      <h3 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        {lang === 'th' ? 'CSF · Body Fluid' : 'CSF · Body Fluid'}
      </h3>
      <div style={{ padding: '12px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 9, fontSize: 13, color: 'var(--ink)', lineHeight: 1.8 }}>
        {lang === 'th'
          ? 'CSF เก็บโดย Lumbar puncture ระหว่าง L3–L4 — แบ่งเป็น 3 ส่วน ส่วนละ 1–3 mL ส่วนแรกใช้สำหรับเพาะเชื้อ (แบคทีเรีย วัณโรค เชื้อรา) · ปิดด้วย parafilm · ห้ามแช่เย็น · Sterile body fluid อื่นๆ ใช้ aseptic technique ลงในภาชนะปราศจากเชื้อ ปิด parafilm นำส่งทันที'
          : 'CSF: lumbar puncture at L3–L4 split into 3 tubes (1–3 mL each); first tube for culture (bacteria, mycobacteria, fungi). Seal with parafilm. NEVER refrigerate. Other sterile body fluids: aseptic collection into sterile container, parafilm-sealed, delivered immediately.'}
      </div>
    </div>
  )
}
