export type Lang = 'th' | 'en'

export interface ManualSection {
  id: string
  th: string
  en: string
  icon: string
  /** Short labels for the compact mobile nav grid (no blind truncation). */
  shortTh: string
  shortEn: string
}

export const MANUAL_SECTIONS: ManualSection[] = [
  { id: 'home',       th: 'หน้าแรก',                              en: 'Home',                               icon: 'home',      shortTh: 'หน้าแรก',       shortEn: 'Home' },
  { id: 'collection', th: 'การเก็บตัวอย่างส่งตรวจ',               en: 'Specimen Collection',                icon: 'syringe',   shortTh: 'เก็บตัวอย่าง',   shortEn: 'Collect' },
  { id: 'transport',  th: 'การส่งตัวอย่างส่งตรวจ',                en: 'Specimen Transport',                 icon: 'bloodBag',  shortTh: 'ส่งตัวอย่าง',    shortEn: 'Transport' },
  { id: 'addon',      th: 'การขอตรวจเพิ่มหรือขอตรวจซ้ำ',           en: 'Add-on / Repeat Requests',           icon: 'plus',      shortTh: 'ขอตรวจเพิ่ม',    shortEn: 'Add-on' },
  { id: 'report',     th: 'การรายงานผลตรวจ / ค่าวิกฤติ',           en: 'Result Reporting · Critical Values', icon: 'alert',     shortTh: 'รายงานผล',       shortEn: 'Reporting' },
  { id: 'outlab',     th: 'การใช้บริการ OUT LAB',                  en: 'OUT LAB Service',                    icon: 'biohazard', shortTh: 'OUT LAB',        shortEn: 'OUT LAB' },
  { id: 'micro',      th: 'การใช้บริการห้องจุลชีววิทยา',          en: 'Microbiology Service',               icon: 'petri',     shortTh: 'จุลชีววิทยา',    shortEn: 'Microbio' },
  { id: 'bloodbank',  th: 'การใช้บริการคลังเลือด',               en: 'Blood Bank Service',                 icon: 'bloodBag',  shortTh: 'คลังเลือด',      shortEn: 'Blood Bank' },
  { id: 'amendment',  th: 'การแก้ไขและเปลี่ยนแปลงข้อมูลทางห้องปฏิบัติการ', en: 'Result Amendment & Correction', icon: 'edit', shortTh: 'แก้ไขข้อมูล',    shortEn: 'Amendment' },
]

export interface PhoneEntry {
  label: string
  ext: string
}

export const PHONE_DIRECTORY: PhoneEntry[] = [
  { label: 'สำนักงาน',    ext: '1455' },
  { label: 'OPD',         ext: '1606-07' },
  { label: 'Chemistry',   ext: '1464' },
  { label: 'Immunology',  ext: '1469' },
  { label: 'Hematology',  ext: '1466' },
  { label: 'Microscopy',  ext: '1468' },
  { label: 'Microbiology',ext: '1462-63' },
  { label: 'Biomolecular',ext: '1467' },
  { label: 'Blood Bank',  ext: '1458' },
  { label: 'OUT LAB',     ext: '1461' },
  { label: 'ศสม.',     ext: '1633-4' },
]

export interface TeamMember {
  name: string
  role: string
  ext: string
}

export const TEAM: TeamMember[] = [
  { name: 'น.ส.ณัฏฐ์ฤทัย ไพโรจน์',  role: 'หัวหน้ากลุ่มงานเทคนิคการแพทย์',                   ext: '1453' },
  { name: 'นายสิทธิพงศ์ ทับทิม',     role: 'รองหัวหน้าฯ · งานเคมีคลินิก & ภูมิคุ้มกัน',        ext: '1464, 1469' },
  { name: 'น.ส.พรหทัย สร้อยสุวรรณ', role: 'งานโลหิตวิทยา & จุลทรรศนศาสตร์คลินิก',           ext: '1465–66, 1468' },
  { name: 'นายศิริวัฒน์ จำปีรัตน์',  role: 'งานอณูชีววิทยา & OUT LAB',                       ext: '1452, 1461, 1467' },
  { name: 'น.ส.ปภัชญา สุขจำรัส',    role: 'งานจุลชีววิทยาคลินิก & คลังน้ำยา',                ext: '1462–63' },
  { name: 'น.ส.ภสพร อินทร์อาสา',    role: 'งานคลังเลือด',                                    ext: '1458' },
  { name: 'น.ส.ลลิตา เหลืองพิพัฒน์สร',              role: 'หัวหน้างานบริการผู้ป่วยนอก',                          ext: '1606-7' },
  { name: 'นางนฤมล งามวชิราพร',              role: 'หัวหน้างานห้องปฏิบัติการ ศสม.เมืองชลบุรี',                          ext: '1633-4' },
]

export interface Container {
  color: string
  cap: string
  use: string
  req: string
}

export const CONTAINERS: Container[] = [
  { color: '#fbbf24', cap: 'ขวด aerobic',        use: 'Hemoculture ชนิด aerobic (ผู้ใหญ่): ใส่เลือดตามปริมาตรที่ระบุข้างขวด 8–10 mL แล้วคว่ำขวดเบา ๆ 5–10 ครั้ง',                                  req: 'เบิกที่คลังพัสดุ รพ.' },
  { color: '#60a5fa', cap: 'ขวด aerobic (เด็ก)', use: 'Hemoculture ชนิด aerobic (เด็ก): ใส่เลือดตามปริมาตรที่ระบุข้างขวด 1–3 mL แล้วคว่ำขวดเบา ๆ 5–10 ครั้ง',                              req: 'เบิกที่คลังพัสดุ รพ.' },
  { color: '#a3a3a3', cap: 'ขวด anaerobic',      use: 'Hemoculture ชนิด anaerobic: ใส่เลือดตามปริมาตรที่ระบุข้างขวด 8–10 mL แล้วคว่ำขวดเบา ๆ 5–10 ครั้ง',                                  req: 'เบิกที่คลังพัสดุ รพ.' },
  { color: '#fb923c', cap: 'ขวด fungal/TB',      use: 'ขวดเพาะเชื้อจากเลือดสำหรับเชื้อรา/TB: ใส่เลือดตามปริมาตรที่ระบุข้างขวด 8–10 mL และ Mix ตามฉลากขวด/วิธีตรวจ',                        req: 'เบิกที่คลังพัสดุ รพ.' },
  { color: '#0891b2', cap: 'ฟ้า · Citrate',      use: '3.2% Sodium citrate: ใส่เลือดตามปริมาตรที่ระบุข้างหลอด อัตราส่วน citrate:blood 1:9 แล้ว Mix เบา ๆ 3–4 ครั้ง เหมาะสำหรับ PT, PTT, TT, INR', req: 'เบิกที่สำนักงานกลุ่มงานเทคนิคการแพทย์ โทร.1455' },
  { color: '#dc2626', cap: 'แดง · Clotted blood',use: 'ไม่มีสารกันเลือดแข็ง มีตัวกระตุ้นการแข็งตัว: ใส่เลือดตามปริมาตร Mix เบา ๆ 5–10 ครั้ง แล้วตั้งทิ้งไว้ เหมาะสำหรับ Chemistry, Thyroid, ระดับยา และ Immunology', req: 'เบิกที่สำนักงานกลุ่มงานเทคนิคการแพทย์ โทร.1455' },
  { color: '#16a34a', cap: 'เขียว · Li Heparin', use: 'Lithium heparin: ใส่เลือดตามปริมาตรที่ระบุข้างหลอด แล้ว Mix เบา ๆ 5–10 ครั้ง เหมาะสำหรับ BUN, Creatinine, Electrolyte, SGOT, SGPT',       req: 'เบิกที่สำนักงานกลุ่มงานเทคนิคการแพทย์ โทร.1455' },
  { color: '#7c3aed', cap: 'ม่วง · EDTA',        use: 'K2 EDTA: มีขนาด 0.5, 2 และ 6 mL ใส่เลือดตามขีดแล้ว Mix 5–10 ครั้ง เหมาะสำหรับ CBC, ESR, Hb typing, CD4, Pharmacogenetics; ขนาด 6 mL ต้องถึงขีดสำหรับ Viral Load และ Drug resistant', req: 'เบิกที่สำนักงานกลุ่มงานเทคนิคการแพทย์ โทร.1455' },
  { color: '#6b7280', cap: 'เทา · NaF',          use: 'NaF: ใส่เลือดตามปริมาตรที่ระบุข้างหลอด แล้ว Mix เบา ๆ 5–10 ครั้ง เหมาะสำหรับ Glucose, Lactate และ Blood alcohol',                     req: 'เบิกที่สำนักงานกลุ่มงานเทคนิคการแพทย์ โทร.1455' },
  { color: '#facc15', cap: 'กระป๋อง · เหลือง',  use: 'กระป๋องเก็บปัสสาวะฝาเหลือง: เก็บปัสสาวะตามปริมาตรที่ระบุ เหมาะสำหรับ Urine analysis, Urine pregnancy test, สารเสพติด, Urine Protein, Urine creatinine และ Urine electrolyte (Na, K)', req: 'เบิกที่สำนักงานกลุ่มงานเทคนิคการแพทย์ โทร.1455' },
  { color: '#e5e7eb', cap: 'กระป๋องเทา · ใส',   use: 'กระป๋องเก็บอุจจาระฝาใส/ตัวกระป๋องสีเทา: เก็บอุจจาระประมาณ 5 g เหมาะสำหรับ Stool Exam, Stool Parasite, Occult Blood, Rota virus Ag และ Adenovirus Ag', req: 'เบิกที่สำนักงานกลุ่มงานเทคนิคการแพทย์ โทร.1455' },
  { color: '#1e5fad', cap: 'Blood gas syringe',  use: 'Blood gas syringe ขนาด 1 mL มี Lithium heparin: ดูดเลือดประมาณ 0.5–1.0 mL แล้ว Mix เบา ๆ 5–10 ครั้ง เหมาะสำหรับ Blood gas และ Blood gas with Electrolyte', req: 'เบิกที่คลังพัสดุ รพ.' },
  { color: '#1e5fad', cap: 'Blood gas capillary',use: 'Blood gas capillary tube ขนาด 120 µL สำหรับเด็กเล็ก มี Lithium heparin: ดูดเลือดเกือบเต็ม ปิดจุก ใส่แท่งเหล็ก ปิดอีกด้าน แล้ว Mix 5–10 ครั้ง', req: 'เบิกที่งานเคมีคลินิก โทร.1469' },
  { color: '#dc2626', cap: 'กระป๋อง Sterile',      use: 'กระป๋องเก็บปัสสาวะ Sterile (โดยทั่วไปฝาแดง): เก็บตามปริมาตรที่ระบุ เหมาะสำหรับ Urine culture, Fluid culture และ Sputum culture',         req: 'เบิกที่คลังพัสดุ รพ.' },
  { color: '#94a3b8', cap: 'ขวด Sterile',        use: 'ขวด Sterile: เก็บ CSF และ body fluid สำหรับ Cell count, Cell Diff, Protein, Glucose และการเพาะเชื้อ',                                 req: 'เบิกที่คลังพัสดุ รพ.' },
  { color: '#dc2626', cap: 'Cary & Blair',       use: 'Cary & Blair transport medium (มักพบสีแดง): เก็บ Rectal swab และ Stool swab เพื่อส่งตรวจงานจุลชีววิทยา',                               req: 'เบิกที่งานจุลชีววิทยาคลินิก โทร.1463' },
  { color: '#1e40af', cap: 'Amies · น้ำเงิน',   use: 'Amies transport media (มักพบสีน้ำเงิน): เหมาะสำหรับเก็บ Swab เพื่อส่งตรวจงานจุลชีววิทยา',                                          req: 'เบิกที่งานจุลชีววิทยาคลินิก โทร.1463' },
  { color: '#94a3b8', cap: 'Nasopharyngeal swab', use: 'Nasopharyngeal swab: เหมาะสำหรับ SARS-CoV-2 (COVID-19) Rapid Antigen, Influenza Ag A/B และ RSV Rapid test',                    req: 'เบิกที่งานภูมิคุ้มกันวิทยาคลินิก โทร.1469' },
  { color: '#0891b2', cap: 'VTM',                use: 'Nasopharyngeal swab in VTM: ชุดเก็บตัวอย่างสำหรับ PCR COVID-19 virus และ Xpert-COVID-19',                                        req: 'เบิกที่งานอณูชีววิทยาคลินิก โทร.1467' },
  { color: '#9333ea', cap: 'Cowin tube',         use: 'Cowin tube: ใช้ตรวจคัดกรองกลุ่มอาการดาวน์ด้วย Next Generation Sequencing: Non-Invasive Prenatal Testing (NGS: NIPT)',        req: 'เบิกที่งานอณูชีววิทยาคลินิก และงานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ โทร.1467' },
]

export interface CollectionTab {
  id: string
  th: string
  en: string
}

export const COLLECTION_TABS: CollectionTab[] = [
  { id: 'overview',     th: 'ภาพรวม + ภาชนะ',  en: 'Overview + Containers' },
  { id: 'venipuncture', th: 'Venipuncture',       en: 'Venipuncture' },
  { id: 'skin',         th: 'Skin Puncture',      en: 'Skin Puncture' },
  { id: 'abg',          th: 'Blood Gas',          en: 'Blood Gas' },
  { id: 'coag',         th: 'PT · aPTT · TT',     en: 'Coagulation' },
  { id: 'micro',        th: 'จุลชีววิทยา',        en: 'Microbiology' },
  { id: 'urine',        th: 'ปัสสาวะ',            en: 'Urine collection' },
  { id: 'stool',        th: 'อุจจาระ',            en: 'Stool collection' },
  { id: 'semen',        th: 'น้ำอสุจิ',           en: 'Semen collection' },
]

export interface CriticalValue {
  /** category label — must match a CV_CATEGORIES labelTh in ManualReport for grouping */
  cat: string
  test: string
  adult: string
  child: string
  unit: string
}

export const CRITICAL_VALUES: CriticalValue[] = [
  { cat: 'เคมีคลินิก',  test: 'Sodium (Na)',              adult: '—',                                   child: '< 125, > 150',              unit: 'mEq/L' },
  { cat: 'เคมีคลินิก',  test: 'Potassium (K)',            adult: '< 2.5, > 5.5  (HD: < 2.5, > 6)',      child: '< 3.0, > 6.0',              unit: 'mEq/L' },
  { cat: 'เคมีคลินิก',  test: 'Glucose',                  adult: '< 55, > 600',                          child: '—',                         unit: 'mg/dL' },
  { cat: 'เคมีคลินิก',  test: 'Magnesium',                adult: '> 8',                                  child: '—',                         unit: 'mg/dL' },
  { cat: 'เคมีคลินิก',  test: 'Troponin T (hs)',          adult: '— (ยกเลิกตามมติ IPSG-2 พ.ย. 65)',      child: '≥ 100',                     unit: 'ng/L' },
  { cat: 'โลหิตวิทยา',  test: 'WBC',                      adult: '—',                                   child: '> 50,000 · > 100,000 (สูง)', unit: 'cells/mm³' },
  { cat: 'โลหิตวิทยา',  test: 'Platelet',                 adult: '< 5,000 (ศัลยกรรม)',                  child: '< 100,000',                 unit: 'cells/mm³' },
  { cat: 'โลหิตวิทยา',  test: 'PT INR',                   adult: '> 4.0',                               child: '> 3.0',                     unit: '' },
  { cat: 'โลหิตวิทยา',  test: 'PTT',                      adult: '> 2× upper limit (ยกเว้นศัลยกรรม)',   child: '> 2× upper limit',          unit: 'sec' },
  { cat: 'จุลชีววิทยา', test: 'Hemoculture / Body fluid', adult: 'พบเชื้อแบคทีเรีย',                    child: 'พบเชื้อแบคทีเรีย',         unit: '—' },
]

export interface OutLabPartner {
  sector: 'gov' | 'priv'
  name: string
  brand: string
  accred: string
}

export const OUTLAB_PARTNERS: OutLabPartner[] = [
  { sector: 'gov',  name: 'สำนักงานป้องกันควบคุมโรคที่ 6 ชลบุรี',      brand: 'DDC Region 6', accred: 'กรมควบคุมโรค' },
  { sector: 'gov',  name: 'ศูนย์วิทยาศาสตร์การแพทย์ที่ 6 ชลบุรี',       brand: 'RMSc 6',       accred: 'กรมวิทยาศาสตร์การแพทย์' },
  { sector: 'gov',  name: 'สถาบันชีววิทยาศาสตร์ทางการแพทย์',             brand: 'MBI',          accred: 'กรมวิทยาศาสตร์การแพทย์' },
  { sector: 'gov',  name: 'โรงพยาบาลจุฬาลงกรณ์ (TSH and IEM)',           brand: 'KCMH',         accred: 'ISO 15189' },
  { sector: 'priv', name: 'บริษัท เนชั่นแนลเฮลท์แคร์ซิสเต็มส์ จำกัด', brand: 'N Health',     accred: 'ISO 15189' },
]

export interface OutLabTest {
  code: string
  name: string
  method: string
  sample: string
  tat: string
  price: number
}

export const OUTLAB_TESTS: OutLabTest[] = [
  { code: '92000', name: '17-Hydroxy Progesterone',         method: 'LC-MS/MS',                 sample: 'Serum 1–2 mL',                       tat: '12 d', price: 500 },
  { code: '98083', name: '1,25(OH) Active Vitamin D',       method: 'Chemiluminescence (CLIA)',  sample: 'Serum 2–3 mL · ภาชนะทึบแสง',          tat: '11 d', price: 2000 },
  { code: '92010', name: 'ACTH',                             method: 'CLIA',                     sample: 'EDTA plasma 1–2 mL · −20°C ทันที',     tat: '9 d',  price: 231 },
  { code: '97125', name: 'Acetylcholine Receptor Ab',        method: 'ELISA',                    sample: 'Serum 1–2 mL',                        tat: '9 d',  price: 500 },
  { code: '97248', name: 'Acetone (urine)',                  method: 'HS-GC-MS',                 sample: 'Urine 30–50 mL (เก็บหลังเลิกงาน)',     tat: '7 d',  price: 120 },
  { code: '95028', name: 'ADAMTS-13 activity',               method: 'ELISA',                    sample: 'Citrated plasma 2–3 mL · −20°C',      tat: '25 d', price: 2000 },
  { code: '92014', name: 'Aldosterone (blood)',              method: 'LIAISON Analyzer',         sample: 'Serum 1–2 mL · ปั่นแยก · −20°C',      tat: '9 d',  price: 200 },
  { code: '97098', name: 'Activated Protein C Resistance',   method: 'APTT-based',               sample: 'Citrated plasma 2–3 mL · frozen',      tat: '9 d',  price: 500 },
  { code: '97183', name: 'Allergy IgE — Food mix (fx5)',     method: 'Phadia 250',               sample: 'Serum 1–2 mL',                        tat: '6 d',  price: 1000 },
  { code: '98045', name: 'Alpha Thalassemia 1 & 2',          method: 'Multiplex GAP-PCR',        sample: 'EDTA whole blood 3–5 mL + CBC',       tat: '8 d',  price: 1500 },
  { code: '98056', name: 'ANA Profile 3 plus',               method: 'Immunoblot',               sample: 'Serum 2–3 mL',                        tat: '4 d',  price: 1500 },
  { code: '92356', name: 'ANCA titer (cANCA / pANCA)',        method: 'EIA',                      sample: 'Serum 1–2 mL',                        tat: '5 d',  price: 360 },
  { code: '97228', name: 'Alcohol (Ethanol)',                method: 'GC-Headspace',             sample: 'NaF 2 mL · paraffin sealed · 2–8°C',  tat: '12 d', price: 300 },
]
