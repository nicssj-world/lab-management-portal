export type Lang = 'th' | 'en'

export interface ManualSection {
  id: string
  th: string
  en: string
  icon: string
}

export const MANUAL_SECTIONS: ManualSection[] = [
  { id: 'home',       th: 'หน้าแรก',                              en: 'Home',                               icon: 'home' },
  { id: 'collection', th: 'การเก็บตัวอย่างส่งตรวจ',               en: 'Specimen Collection',                icon: 'syringe' },
  { id: 'transport',  th: 'การส่งตัวอย่างส่งตรวจ',                en: 'Specimen Transport',                 icon: 'bloodBag' },
  { id: 'addon',      th: 'การขอตรวจเพิ่มหรือขอตรวจซ้ำ',           en: 'Add-on / Repeat Requests',           icon: 'plus' },
  { id: 'report',     th: 'การรายงานผลตรวจ / ค่าวิกฤติ',           en: 'Result Reporting · Critical Values', icon: 'alert' },
  { id: 'outlab',     th: 'การใช้บริการ OUT LAB',                  en: 'OUT LAB Service',                    icon: 'biohazard' },
  { id: 'micro',      th: 'การใช้บริการห้องจุลชีววิทยา',          en: 'Microbiology Service',               icon: 'petri' },
  { id: 'bloodbank',  th: 'การใช้บริการคลังเลือด',               en: 'Blood Bank Service',                 icon: 'bloodBag' },
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
  { color: '#fbbf24', cap: 'ขวด aerobic',        use: 'Hemoculture (aerobic) ผู้ใหญ่ — เลือด 8–10 mL คว่ำเบาๆ 5–10 ครั้ง',                                  req: 'คลังพัสดุ รพ.' },
  { color: '#60a5fa', cap: 'ขวด aerobic (เด็ก)', use: 'Hemoculture (aerobic) เด็ก — เลือด 1–3 mL',                                                        req: 'คลังพัสดุ รพ.' },
  { color: '#a3a3a3', cap: 'ขวด anaerobic',      use: 'Hemoculture (anaerobic) — เลือด 8–10 mL',                                                          req: 'คลังพัสดุ รพ.' },
  { color: '#fb923c', cap: 'ขวด fungal/TB',      use: 'Hemoculture สำหรับเชื้อรา / TB',                                                                   req: 'คลังพัสดุ รพ.' },
  { color: '#0891b2', cap: 'ฟ้า · Citrate',      use: 'PT · PTT · TT · INR · D-dimer (3.2% Sodium citrate, 9:1)',                                          req: 'สำนักงาน · 1455' },
  { color: '#dc2626', cap: 'แดง · SST',          use: 'Chemistry · Thyroid · ระดับยา · Anti-HIV · HBsAg · Anti-HCV · Syphilis',                          req: 'สำนักงาน · 1455' },
  { color: '#16a34a', cap: 'เขียว · Li Heparin', use: 'BUN · Creatinine · Electrolyte · SGOT · SGPT',                                                     req: 'สำนักงาน · 1455' },
  { color: '#7c3aed', cap: 'ม่วง · EDTA',        use: 'CBC · ESR · Hb typing · CD4 · Pharmacogenetics · Viral Load · Drug resistant (6 mL ให้ถึงขีด)',  req: 'สำนักงาน · 1455' },
  { color: '#6b7280', cap: 'เทา · NaF',          use: 'Glucose · Lactate · Blood alcohol',                                                                req: 'สำนักงาน · 1455' },
  { color: '#facc15', cap: 'กระป๋อง · เหลือง',  use: 'Urinalysis · UPT · สารเสพติด · Urine Protein · Urine Cr · Urine electrolyte',                    req: 'สำนักงาน · 1455' },
  { color: '#e5e7eb', cap: 'กระป๋องเทา · ใส',   use: 'Stool exam · Stool Parasite · Occult Blood · Rota / Adenovirus Ag (≈ 5 g)',                       req: 'สำนักงาน · 1455' },
  { color: '#1e5fad', cap: 'Blood gas syringe',  use: 'ABG · ABG with Electrolyte (Li-heparin, 0.5–1 mL)',                                                req: 'คลังพัสดุ รพ.' },
  { color: '#1e5fad', cap: 'Blood gas capillary',use: 'ABG เด็กเล็ก (120 µL Li-heparin)',                                                                req: 'งานเคมีคลินิก · 1469' },
  { color: '#dc2626', cap: 'Sterile · แดง',      use: 'Urine culture · Fluid culture · Sputum culture',                                                   req: 'คลังพัสดุ รพ.' },
  { color: '#94a3b8', cap: 'ขวด Sterile',        use: 'CSF · body fluid (cell count, Diff, Protein, Glucose, culture)',                                   req: 'คลังพัสดุ รพ.' },
  { color: '#dc2626', cap: 'Cary & Blair',       use: 'Rectal swab · Stool swab (เพาะเชื้อ)',                                                             req: 'งานจุลชีววิทยา · 1463' },
  { color: '#1e40af', cap: 'Amies · น้ำเงิน',   use: 'Wound · Genital · Throat swab',                                                                    req: 'งานจุลชีววิทยา · 1463' },
  { color: '#94a3b8', cap: 'Nasopharyngeal',     use: 'COVID-19 Rapid Ag · Influenza A/B · RSV (Rapid)',                                                  req: 'งานภูมิคุ้มกัน · 1469' },
  { color: '#0891b2', cap: 'VTM',                use: 'PCR COVID-19 · Xpert COVID-19',                                                                    req: 'งานอณูชีววิทยา · 1467' },
  { color: '#9333ea', cap: 'Cowin tube',         use: 'NGS NIPT คัดกรองดาวน์ซินโดรม',                                                                    req: 'งานอณูชีววิทยา · 1467' },
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
]

export interface CriticalValue {
  test: string
  adult: string
  child: string
  unit: string
}

export const CRITICAL_VALUES: CriticalValue[] = [
  { test: 'Sodium (Na)',              adult: '—',                                   child: '< 125, > 150',              unit: 'mEq/L' },
  { test: 'Potassium (K)',            adult: '< 2.5, > 5.5  (HD: < 2.5, > 6)',      child: '< 3.0, > 6.0',              unit: 'mEq/L' },
  { test: 'Glucose',                  adult: '< 55, > 600',                          child: '—',                         unit: 'mg/dL' },
  { test: 'Magnesium',                adult: '> 8',                                  child: '—',                         unit: 'mg/dL' },
  { test: 'Troponin T (hs)',          adult: '— (ยกเลิกตามมติ IPSG-2 พ.ย. 65)',      child: '≥ 100',                     unit: 'ng/L' },
  { test: 'WBC',                      adult: '—',                                   child: '> 50,000 · > 100,000 (สูง)', unit: 'cells/mm³' },
  { test: 'Platelet',                 adult: '< 5,000 (ศัลยกรรม)',                  child: '< 100,000',                 unit: 'cells/mm³' },
  { test: 'PT INR',                   adult: '> 4.0',                               child: '> 3.0',                     unit: '' },
  { test: 'PTT',                      adult: '> 2× upper limit (ยกเว้นศัลยกรรม)',   child: '> 2× upper limit',          unit: 'sec' },
  { test: 'Hemoculture / Body fluid', adult: 'พบเชื้อแบคทีเรีย',                    child: 'พบเชื้อแบคทีเรีย',         unit: '—' },
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
