import { Icon } from '@/components/ui/Icon'
import { H3, P, Callout } from '../../_primitives'
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
  { name: 'Cary & Blair',  useTh: 'Rectal swab · Stool swab',                          useEn: 'Rectal/Stool swab',                    icon: 'petri' },
  { name: 'Amies',          useTh: 'Wound · Genital · Throat swab',                      useEn: 'Wound · Genital · Throat swab',         icon: 'petri' },
  { name: 'Sterile cup',   useTh: 'Urine culture · Fluid culture · Sputum',             useEn: 'Urine / Fluid / Sputum culture',         icon: 'beaker' },
  { name: 'Sterile bottle',useTh: 'CSF · Body fluid (cell count, culture)',             useEn: 'CSF / Body fluid (count, culture)',      icon: 'droplet' },
  { name: 'Hemoculture',   useTh: 'Blood culture aerobic / anaerobic / fungal / TB',    useEn: 'Blood culture aerobic / anaerobic / fungal / TB', icon: 'blood' },
  { name: 'NP swab + VTM', useTh: 'COVID PCR · Xpert',                                 useEn: 'COVID PCR · Xpert',                     icon: 'biohazard' },
]

const URINE_PATHS = [
  {
    kind: 'Clean-voided midstream',
    bodyTh: 'ผู้ป่วยถ่ายเอง — ล้างมือ + ทำความสะอาดอวัยวะเพศ ถ่ายช่วงแรกทิ้ง เก็บช่วงกลาง 15–20 mL',
    bodyEn: 'Patient self-collects: wash hands + genital area. Discard first stream. Collect midstream 15–20 mL.',
  },
  {
    kind: 'Catheterized',
    bodyTh: 'ผู้ป่วยใส่สายสวน — clamp ด้านล่าง sampling port 10–15 นาที · เช็ด port ด้วย 70% alcohol หรือ 2% chlorhexidine · ใช้เข็มดูด 15–20 mL',
    bodyEn: 'Indwelling catheter: clamp below sampling port 10–15 min. Disinfect port (70% alcohol or 2% chlorhexidine). Aspirate 15–20 mL.',
  },
  {
    kind: 'Intermittent catheter',
    bodyTh: 'ผู้ป่วยไม่สามารถถ่ายเอง — ใส่ถุงมือ aseptic technique ปล่อยช่วงแรกทิ้ง เก็บช่วงกลาง 15–20 mL',
    bodyEn: 'Patient unable to void: gloved, aseptic in-and-out catheter. Discard first stream, collect midstream 15–20 mL.',
  },
]

const SPUTUM = [
  { k: 'Expectorated', th: 'ให้ผู้ป่วยบ้วนปากด้วยน้ำ · หายใจลึก กลั้น · ไอแรงเอาเสมหะออก · บ้วนใน sterile cup โดยให้ปนเปื้อนน้ำลายน้อยที่สุด', en: 'Patient rinses mouth with water. Deep breath, hold, then cough deeply into a sterile cup with minimal saliva.' },
  { k: 'Endotracheal',  th: 'ผู้ป่วยใส่ท่อช่วยหายใจ — aseptic technique · ใส่สายลึกเท่าท่อ ไม่ดูดขณะใส่ · ดูด 5–10 วินาที (≤ 15) · ไม่ดูดขณะดึงสายออก', en: 'Intubated patient — aseptic. Insert to tube depth WITHOUT suction. Suction 5–10 s (≤ 15). No suction on withdrawal.' },
  { k: 'BAL',           th: 'แพทย์ทำระหว่าง Bronchoscopy — ใส่ 0.9% NaCl ในหลอดลมส่วนปลาย ดูดกลับ · หุ้ม parafilm นำส่งทันที', en: 'BAL — physician procedure during bronchoscopy. Instill 0.9% NaCl distally, re-aspirate. Wrap with parafilm.' },
]

export function CollectionMicro({ lang }: Props) {
  const principles = lang === 'th' ? PRINCIPLES_TH : PRINCIPLES_EN
  return (
    <div>
      <H3 mt={4}>{lang === 'th' ? 'หลักการทั่วไป' : 'General principles'}</H3>
      <ol style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.85, margin: '0 0 6px', paddingLeft: 24 }}>
        {principles.map((p, i) => <li key={i}>{p}</li>)}
      </ol>

      <H3>{lang === 'th' ? 'ภาชนะและ Transport media' : 'Containers & transport media'}</H3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {TRANSPORTS.map((t) => (
          <div key={t.name} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--primary-soft)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={t.icon} size={15} />
              </div>
              <strong style={{ fontSize: 12.5, color: 'var(--ink)' }}>{t.name}</strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>{lang === 'th' ? t.useTh : t.useEn}</div>
          </div>
        ))}
      </div>

      <H3>{lang === 'th' ? 'การเก็บปัสสาวะเพื่อเพาะเชื้อ (3 รูปแบบ)' : 'Urine for culture — 3 methods'}</H3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {URINE_PATHS.map((u) => (
          <div key={u.kind} style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 4 }}>{u.kind}</div>
            <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{lang === 'th' ? u.bodyTh : u.bodyEn}</div>
          </div>
        ))}
      </div>

      <H3>{lang === 'th' ? 'เกณฑ์การปฏิเสธสำหรับ Urine culture' : 'Urine culture rejection rules'}</H3>
      <Callout tone="warning" icon="alert">
        {lang === 'th'
          ? <span>ต้องมีผล Urinalysis บ่งชี้: <strong>WBC ≥ 5–10/HPF</strong> หรือ <strong>Leukocyte esterase ≥ 1+</strong> · ยกเว้นผู้ป่วย Low immune / Febrile neutropenia / ทารก &lt; 6 เดือน / ปลูกถ่ายไต / ระบบทางเดินปัสสาวะ / แพทย์ระบุเหตุผล + เลขใบประกอบฯ</span>
          : <span>Requires Urinalysis evidence: <strong>WBC ≥ 5–10/HPF</strong> OR <strong>Leukocyte esterase ≥ 1+</strong>. Exceptions: low-immune / febrile neutropenia, infant &lt; 6 mo, kidney transplant, urology patients, physician-specified reason with license number.</span>}
      </Callout>

      <H3>{lang === 'th' ? 'การเก็บเสมหะ (3 วิธี)' : 'Sputum collection — 3 methods'}</H3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {SPUTUM.map((m) => (
          <div key={m.k} style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', letterSpacing: '.04em', textTransform: 'uppercase' }}>{m.k}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', marginTop: 6, lineHeight: 1.55 }}>{lang === 'th' ? m.th : m.en}</div>
          </div>
        ))}
      </div>
      <Callout tone="warning" icon="alert">
        {lang === 'th'
          ? <span>คุณภาพเสมหะ: ต้องมี <strong>WBC &gt; 25 cells/LPF</strong> และ <strong>Squamous Epithelial cell &lt; 10 cells/LPF</strong> · ผู้ป่วย low immune / ทารก &lt; 6 ด. ใช้เกณฑ์ SEC อย่างเดียว</span>
          : <span>Sputum quality: <strong>WBC &gt; 25/LPF</strong> AND <strong>SEC &lt; 10/LPF</strong>. For low-immune / infants &lt; 6 mo, only SEC criterion applies.</span>}
      </Callout>

      <H3>{lang === 'th' ? 'CSF · Body fluid' : 'CSF · Body fluid'}</H3>
      <P>
        {lang === 'th'
          ? 'CSF เก็บโดย Lumbar puncture ระหว่าง L3–L4 — แบ่งเป็น 3 ส่วน ส่วนละ 1–3 mL ส่วนแรกใช้สำหรับเพาะเชื้อ (แบคทีเรีย วัณโรค เชื้อรา) · ปิดด้วย parafilm · ห้ามแช่เย็น · Sterile body fluid อื่นๆ ใช้ aseptic technique ลงในภาชนะปราศจากเชื้อ ปิด parafilm นำส่งทันที'
          : 'CSF: lumbar puncture at L3–L4 split into 3 tubes (1–3 mL each); first tube for culture (bacteria, mycobacteria, fungi). Seal with parafilm. NEVER refrigerate. Other sterile body fluids: aseptic collection into sterile container, parafilm-sealed, delivered immediately.'}
      </P>
    </div>
  )
}
