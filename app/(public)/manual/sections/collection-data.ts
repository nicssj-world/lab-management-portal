// Single source of truth for all Specimen Collection section content.
// Edit data here; components in collection/ are render-only.

// ── Overview ──────────────────────────────────────────────────────────────────

export const ORDER_OF_DRAW = [
  { color: '#fbbf24', cap: 'Yellow',  name: 'Blood culture',    num: 1 },
  { color: '#0891b2', cap: 'Blue',    name: 'Citrate · PT/PTT', num: 2 },
  { color: '#dc2626', cap: 'Red',     name: 'SST · Chemistry',  num: 3 },
  { color: '#16a34a', cap: 'Green',   name: 'Li-Heparin',       num: 4 },
  { color: '#7c3aed', cap: 'Purple',  name: 'EDTA · CBC',       num: 5 },
  { color: '#6b7280', cap: 'Gray',    name: 'NaF · Glucose',    num: 6 },
]

export const SITES_TO_AVOID = [
  { th: 'บริเวณที่เป็นแผลเป็น เนื้อเยื่อหนา ทำให้เจาะยาก',                                       en: 'Scarred tissue — thick and hard to puncture.' },
  { th: 'บริเวณที่มีเส้นเลือดดำขอด (Thrombosis vein)',                                              en: 'Areas with thrombosed or varicose veins.' },
  { th: 'บริเวณที่มีรอยช้ำ หรือเลือดออกใต้ผิวหนัง',                                                en: 'Bruised areas with subcutaneous bleeding.' },
  { th: 'แขนข้างเดียวกับหน้าอกที่ผ่าตัด (Mastectomy) — ต้องได้รับความยินยอมจากแพทย์',                en: 'Arm ipsilateral to mastectomy — requires physician consent.' },
  { th: 'แขนที่ทำ AV shunt (Dialysis) — เสี่ยงต่อการติดเชื้อ',                                     en: 'Arm with AV shunt (dialysis) — infection risk.' },
  { th: 'แขนที่กำลังให้ IV — เลือดอาจปนเปื้อนทำให้ Glucose สูง / Hct ต่ำ หากจำเป็นให้เจาะต่ำกว่าจุดให้ IV หยุด IV อย่างน้อย 2 นาที และปรึกษาแพทย์', en: 'Arm receiving IV — contamination may cause falsely high glucose and low Hct. If unavoidable, draw below the IV site, stop the IV for at least 2 min, and consult the physician.' },
]

export const PATIENT_PREP = [
  {
    th: 'FBS · น้ำตาลในเลือด', en: 'Fasting Blood Sugar',
    prepTh: 'การเก็บตัวอย่างส่งตรวจหาระดับน้ำตาล (FBS) ในเลือด ผู้รับบริการตรวจจะต้องงดอาหารทุกชนิด รวมถึงเครื่องดื่มทุกประเภท เช่น ชา กาแฟ น้ำผลไม้ อย่างน้อย 8 ชั่วโมงก่อนการเจาะเก็บตัวอย่างเลือด (ดื่มน้ำเปล่าได้)',
    prepEn: 'For fasting blood sugar (FBS), the patient must avoid all food and all beverages, including tea, coffee, and fruit juice, for at least 8 hours before blood collection. Plain water is allowed.',
    detailsTh: [],
    detailsEn: [],
  },
  {
    th: 'Lipid profile · Triglyceride', en: 'Lipid Profile',
    prepTh: 'การเก็บตัวอย่างส่งตรวจหาไขมัน Triglyceride หรือ Lipid profile ผู้รับบริการตรวจจะต้องงดอาหารทุกชนิด รวมถึงเครื่องดื่มทุกประเภท เช่น ชา กาแฟ น้ำผลไม้ อย่างน้อย 12 ชั่วโมงก่อนการเจาะเก็บตัวอย่างเลือด (ดื่มน้ำเปล่าได้)',
    prepEn: 'For triglyceride or lipid-profile testing, the patient must avoid all food and all beverages, including tea, coffee, and fruit juice, for at least 12 hours before blood collection. Plain water is allowed.',
    detailsTh: [],
    detailsEn: [],
  },
  {
    th: 'OGTT · ผู้ใหญ่', en: 'OGTT — Adult',
    prepTh: 'การเก็บตัวอย่างส่งตรวจ oral glucose tolerance test (OGTT) ในผู้ใหญ่ (ยกเว้นหญิงมีครรภ์) ให้เตรียมผู้ป่วยดังนี้',
    prepEn: 'For oral glucose tolerance testing (OGTT) in adults, except pregnant women, prepare the patient as follows.',
    detailsTh: [
      '9.1 ผู้ป่วยหรือผู้รับบริการตรวจทำกิจกรรมประจำวันและกินอาหารตามปกติ ซึ่งมีปริมาณคาร์โบไฮเดรตมากกว่า 150 กรัมต่อวัน เป็นเวลาอย่างน้อย 3 วันก่อนการทดสอบ',
      '9.2 งดสูบบุหรี่ระหว่างการทดสอบ และบันทึกโรคหรือภาวะที่อาจมีอิทธิพลต่อผลการทดสอบ เช่น ยา ภาวะติดเชื้อ เป็นต้น',
      '9.3 ผู้ป่วยหรือผู้รับบริการตรวจจะต้องงดอาหารข้ามคืนอย่างน้อย 8 ชั่วโมง (ดื่มน้ำเปล่าได้)',
      '9.4 เช้าวันทดสอบ ให้เจาะเลือดผู้ป่วยหรือผู้รับบริการตรวจก่อนดื่มน้ำตาลเพื่อเป็น fasting blood glucose (FBS 0 ชม.)',
      '9.4.2 หลังจากนั้นให้ผู้ป่วยดื่มน้ำตาลกลูโคส 75 กรัม ละลายน้ำประมาณ 250–300 มิลลิลิตร ดื่มให้หมดภายใน 5 นาที (เริ่มนับเวลา) และเจาะเลือดตรวจ glucose หลังจากดื่มน้ำตาลไปแล้วที่ 2 ชั่วโมง',
    ],
    detailsEn: [
      '9.1 Maintain usual daily activities and diet, with more than 150 g of carbohydrate per day for at least 3 days before testing.',
      '9.2 Do not smoke during the test. Record diseases or conditions that may influence the result, such as medication or infection.',
      '9.3 Fast overnight for at least 8 hours; plain water is allowed.',
      '9.4 On the test morning, collect blood before the glucose drink as fasting blood glucose (FBS, 0 hr).',
      '9.4.2 Then drink 75 g glucose dissolved in approximately 250–300 mL of water within 5 minutes (start timing), and collect glucose blood at 2 hours after drinking.',
    ],
  },
  {
    th: 'OGTT · เด็ก', en: 'OGTT — Pediatric',
    prepTh: 'การเก็บตัวอย่างส่งตรวจ OGTT ในเด็ก มีวิธีการเตรียมตัวก่อนการจัดเก็บตัวอย่างเช่นเดียวกับผู้ใหญ่ แต่ปริมาณน้ำตาลกลูโคสที่ใช้ทดสอบ คือ 1.75 กรัมต่อน้ำหนักตัว 1 กิโลกรัม รวมแล้วไม่เกิน 75 กรัม',
    prepEn: 'Pediatric OGTT preparation is the same as for adults, but the glucose dose is 1.75 g per kilogram of body weight, with a maximum total of 75 g.',
    detailsTh: [],
    detailsEn: [],
  },
  {
    th: 'GCT · หญิงมีครรภ์', en: 'GCT — Pregnancy',
    prepTh: 'การเก็บตัวอย่างส่งตรวจ glucose challenge test (GCT) ในหญิงมีครรภ์เท่านั้น ผู้ป่วยไม่ต้องอดอาหาร ก่อนการทดสอบให้ผู้ป่วยหรือผู้รับบริการดื่มน้ำตาลกลูโคส 50 กรัม ละลายน้ำประมาณ 100–150 มิลลิลิตร ดื่มให้หมดภายใน 5 นาที และเจาะเลือดหลังจากดื่มน้ำตาลแล้วที่ 1 ชั่วโมง',
    prepEn: 'Glucose challenge testing (GCT) is for pregnant women only and does not require fasting. Before testing, drink 50 g glucose dissolved in approximately 100–150 mL of water within 5 minutes, then collect blood 1 hour after drinking.',
    detailsTh: [],
    detailsEn: [],
  },
  {
    th: 'OGTT · หญิงมีครรภ์', en: 'OGTT — Pregnancy',
    prepTh: 'การเก็บตัวอย่างส่งตรวจ oral glucose tolerance test (OGTT) ในหญิงมีครรภ์ ให้เตรียมผู้ป่วยดังนี้',
    prepEn: 'For oral glucose tolerance testing (OGTT) in pregnant women, prepare the patient as follows.',
    detailsTh: [
      '12.1 ผู้ป่วยหรือผู้รับบริการตรวจจะต้องงดอาหารข้ามคืนอย่างน้อย 8 ชั่วโมง (ดื่มน้ำเปล่าได้)',
      '12.2 เจาะเลือดผู้ป่วยหรือผู้รับบริการตรวจก่อนดื่มน้ำตาล เพื่อเป็น fasting blood glucose (FBS 0 ชม.) หลังจากนั้นให้ดื่มน้ำตาลกลูโคส 75 กรัม หรือ 100 กรัม ละลายน้ำประมาณ 250–300 มิลลิลิตร ดื่มให้หมดภายใน 5 นาที',
      '12.3 หากดื่มน้ำตาลกลูโคส 75 กรัม ให้เจาะเลือดที่ 1 และ 2 ชั่วโมงหลังจากดื่มน้ำตาลกลูโคสแล้ว',
      '12.4 หากดื่มน้ำตาลกลูโคส 100 กรัม ให้เจาะเลือดที่ 1, 2 และ 3 ชั่วโมงหลังจากดื่มน้ำตาลกลูโคสแล้ว',
    ],
    detailsEn: [
      '12.1 Fast overnight for at least 8 hours; plain water is allowed.',
      '12.2 Collect fasting blood glucose (FBS, 0 hr) before the glucose drink. Then drink 75 g or 100 g glucose dissolved in approximately 250–300 mL of water within 5 minutes.',
      '12.3 For 75 g glucose, collect blood at 1 and 2 hours after drinking.',
      '12.4 For 100 g glucose, collect blood at 1, 2, and 3 hours after drinking.',
    ],
  },
]

export const SPECIMEN_TYPES = [
  { th: 'เลือด', en: 'Blood' },
  { th: 'ปัสสาวะ', en: 'Urine' },
  { th: 'อุจจาระ', en: 'Stool' },
  { th: 'เสมหะ', en: 'Sputum' },
  { th: 'หนอง', en: 'Pus' },
  { th: 'สารน้ำต่าง ๆ ในร่างกาย', en: 'Body fluids' },
]

export interface BilingualText {
  th: string
  en: string
}

export interface ContainerDetail {
  image: string
  volume: BilingualText
  contents: BilingualText
  handling: BilingualText
  tests: BilingualText
}

/** Detailed source table from the 2569-2 manual; order matches CONTAINERS. */
export const CONTAINER_DETAILS: ContainerDetail[] = [
  {
    image: '/images/manual/collection/source/image4.png',
    volume: { th: 'เลือด 8–10 mL', en: 'Blood 8–10 mL' },
    contents: { th: 'ขวดเพาะเชื้อชนิด aerobic (ผู้ใหญ่)', en: 'Aerobic blood-culture bottle (adult)' },
    handling: { th: 'คว่ำขวดเบา ๆ 5–10 ครั้ง', en: 'Invert gently 5–10 times' },
    tests: { th: 'Hemoculture', en: 'Blood culture' },
  },
  {
    image: '/images/manual/collection/source/image4.png',
    volume: { th: 'เลือด 1–3 mL', en: 'Blood 1–3 mL' },
    contents: { th: 'ขวดเพาะเชื้อชนิด aerobic (เด็ก)', en: 'Aerobic blood-culture bottle (pediatric)' },
    handling: { th: 'คว่ำขวดเบา ๆ 5–10 ครั้ง', en: 'Invert gently 5–10 times' },
    tests: { th: 'Hemoculture', en: 'Blood culture' },
  },
  {
    image: '/images/manual/collection/source/image4.png',
    volume: { th: 'เลือด 8–10 mL', en: 'Blood 8–10 mL' },
    contents: { th: 'ขวดเพาะเชื้อชนิด anaerobic', en: 'Anaerobic blood-culture bottle' },
    handling: { th: 'คว่ำขวดเบา ๆ 5–10 ครั้ง', en: 'Invert gently 5–10 times' },
    tests: { th: 'Hemoculture', en: 'Blood culture' },
  },
  {
    image: '/images/manual/collection/source/image8.png',
    volume: { th: 'เลือด 8–10 mL', en: 'Blood 8–10 mL' },
    contents: { th: 'ขวดเพาะเชื้อสำหรับเชื้อรา / TB', en: 'Blood-culture bottle for fungi / TB' },
    handling: { th: 'ใส่เลือดตามปริมาตรที่ระบุข้างขวด 8–10 mL คว่ำขวดไปมาเบา ๆ ตามฉลากขวดและวิธีตรวจ (ข้อมูลในตารางต้นฉบับระบุวิธี Mix ไว้มากกว่าหนึ่งตำแหน่ง จึงให้ยึดฉลากขวดและวิธีตรวจ)', en: 'Fill 8–10 mL as indicated on the bottle and invert gently according to the bottle label and test method (the source table contains more than one mixing notation; follow the bottle label and test method).' },
    tests: { th: 'Hemoculture สำหรับเชื้อรา / TB', en: 'Fungal / TB blood culture' },
  },
  {
    image: '/images/manual/collection/source/image10.png',
    volume: { th: 'ผู้ใหญ่ 2 mL · เด็กเล็ก 1 mL', en: 'Adult 2 mL · pediatric 1 mL' },
    contents: { th: '3.2% Sodium citrate · อัตราส่วน citrate:blood = 1:9', en: '3.2% sodium citrate · citrate:blood ratio 1:9' },
    handling: { th: 'ใส่เลือดให้ถึงขีด แล้ว Mix เบา ๆ 3–4 ครั้ง', en: 'Fill to the line, then mix gently 3–4 times' },
    tests: { th: 'PT · PTT · TT · INR', en: 'PT · PTT · TT · INR' },
  },
  {
    image: '/images/manual/collection/source/image14.jpeg',
    volume: { th: 'ผู้ใหญ่ 4 mL · เด็กเล็ก 1 mL', en: 'Adult 4 mL · pediatric 1 mL' },
    contents: { th: 'ไม่มีสารกันเลือดแข็ง มีตัวกระตุ้นการแข็งตัว (activator)', en: 'No anticoagulant; contains a clot activator' },
    handling: { th: 'ใส่เลือดตามขีด Mix เบา ๆ 5–10 ครั้ง แล้วตั้งทิ้งไว้', en: 'Fill to the line, mix gently 5–10 times, then allow to stand' },
    tests: { th: 'งานเคมีคลินิก (Chemistry) เช่น Thyroid, ระดับยา และงานภูมิคุ้มกันวิทยา (Immunology) เช่น Anti-HIV, HBsAg, Anti-HBs, Anti-HCV, Anti-HAV, Syphilis', en: 'Clinical chemistry (e.g., thyroid and drug levels) and immunology (e.g., Anti-HIV, HBsAg, Anti-HBs, Anti-HCV, Anti-HAV, and syphilis).' },
  },
  {
    image: '/images/manual/collection/source/image16.jpeg',
    volume: { th: 'ผู้ใหญ่ 4 mL · เด็กเล็ก 1 mL', en: 'Adult 4 mL · pediatric 1 mL' },
    contents: { th: 'Lithium heparin', en: 'Lithium heparin' },
    handling: { th: 'ใส่เลือดตามขีด แล้ว Mix เบา ๆ 5–10 ครั้ง', en: 'Fill to the line, then mix gently 5–10 times' },
    tests: { th: 'BUN · Creatinine · Electrolyte · SGOT · SGPT', en: 'BUN · creatinine · electrolytes · SGOT · SGPT' },
  },
  {
    image: '/images/manual/collection/source/image19.png',
    volume: { th: '0.5 mL · 2 mL · 6 mL', en: '0.5 mL · 2 mL · 6 mL' },
    contents: { th: 'K2 EDTA', en: 'K2 EDTA' },
    handling: { th: 'ใส่เลือดตามขีด แล้ว Mix เบา ๆ 5–10 ครั้ง', en: 'Fill to the line, then mix gently 5–10 times' },
    tests: { th: 'CBC · ESR · Hb typing · CD4 · Pharmacogenetics; 6 mL ถึงขีดสำหรับ Viral Load / Drug resistant', en: 'CBC · ESR · Hb typing · CD4 · pharmacogenetics; fill 6 mL to the line for viral load / drug resistance' },
  },
  {
    image: '/images/manual/collection/source/image21.jpeg',
    volume: { th: '2 mL', en: '2 mL' },
    contents: { th: 'NaF', en: 'NaF' },
    handling: { th: 'ใส่เลือดตามขีด แล้ว Mix เบา ๆ 5–10 ครั้ง', en: 'Fill to the line, then mix gently 5–10 times' },
    tests: { th: 'Glucose · Lactate · Blood alcohol', en: 'Glucose · lactate · blood alcohol' },
  },
  {
    image: '/images/manual/collection/source/image24.jpeg',
    volume: { th: 'ตามปริมาตรที่ระบุ', en: 'As indicated on the container' },
    contents: { th: 'กระป๋องเก็บปัสสาวะฝาเหลือง', en: 'Yellow-cap urine cup' },
    handling: { th: 'เก็บในภาชนะสะอาด แห้ง และปิดฝาให้สนิท', en: 'Use a clean, dry container and cap tightly' },
    tests: { th: 'Urine analysis · UPT · สารเสพติด · Urine Protein · Urine creatinine · Urine electrolyte (Na, K)', en: 'Urine analysis · UPT · drugs · urine protein · urine creatinine · urine electrolytes (Na, K)' },
  },
  {
    image: '/images/manual/collection/source/image25.png',
    volume: { th: 'อุจจาระประมาณ 5 g', en: 'Approximately 5 g stool' },
    contents: { th: 'กระป๋องเก็บอุจจาระฝาใส / ตัวกระป๋องสีเทา', en: 'Stool cup with clear lid / gray cup' },
    handling: { th: 'เก็บอุจจาระประมาณ 5 กรัม แล้วปิดฝาภาชนะให้สนิท', en: 'Collect approximately 5 g of stool and cap the container tightly' },
    tests: { th: 'Stool Exam · Stool Parasite · Occult Blood · Rota virus Ag · Adenovirus Ag', en: 'Stool exam · stool parasite · occult blood · rotavirus Ag · adenovirus Ag' },
  },
  {
    image: '/images/manual/collection/source/image27.png',
    volume: { th: 'ประมาณ 0.5–1.0 mL', en: 'Approximately 0.5–1.0 mL' },
    contents: { th: 'Lithium heparin blood-gas syringe ขนาด 1 mL', en: '1 mL lithium-heparin blood-gas syringe' },
    handling: { th: 'Mix เบา ๆ 5–10 ครั้ง', en: 'Mix gently 5–10 times' },
    tests: { th: 'Blood gas · Blood gas with Electrolyte', en: 'Blood gas · blood gas with electrolytes' },
  },
  {
    image: '/images/manual/collection/source/image28.png',
    volume: { th: 'เกือบเต็ม · 120 µL (เด็กเล็ก)', en: 'Nearly full · 120 µL (pediatric)' },
    contents: { th: 'Lithium heparin capillary tube', en: 'Lithium-heparin capillary tube' },
    handling: { th: 'อุดปลายหนึ่งด้าน ใส่แท่งเหล็ก อุดอีกด้าน แล้ว Mix เบา ๆ 5–10 ครั้ง', en: 'Cap one end, insert the iron stirrer, cap the other end, then mix gently 5–10 times' },
    tests: { th: 'Blood gas · Blood gas with Electrolyte', en: 'Blood gas · blood gas with electrolytes' },
  },
  {
    image: '/images/manual/collection/source/image29.png',
    volume: { th: 'ตามปริมาตรที่ระบุ', en: 'As indicated on the container' },
    contents: { th: 'กระป๋อง Sterile (โดยทั่วไปฝาแดง)', en: 'Sterile cup (commonly red cap)' },
    handling: { th: 'เก็บตามปริมาตรที่ระบุ และสังเกต package ที่ระบุว่า “Sterile” สีฝาของกระป๋องอาจเปลี่ยนแปลงตามการจัดซื้อแต่ละรอบ', en: 'Collect the indicated volume and check that the package is marked “Sterile”; the cap color may vary by procurement cycle' },
    tests: { th: 'Urine culture · Fluid culture · Sputum culture', en: 'Urine culture · fluid culture · sputum culture' },
  },
  {
    image: '/images/manual/collection/source/image30.png',
    volume: { th: 'ตามปริมาตรที่เหมาะสมกับการตรวจ', en: 'As appropriate for the test' },
    contents: { th: 'ขวด Sterile', en: 'Sterile bottle' },
    handling: { th: 'ปิดฝาให้สนิท เหมาะสำหรับ CSF และ body fluid', en: 'Cap tightly; suitable for CSF and body fluids' },
    tests: { th: 'Cell count · Cell Diff · Protein · Glucose · เพาะเชื้อใน CSF / body fluid', en: 'Cell count · cell diff · protein · glucose · culture of CSF / body fluid' },
  },
  {
    image: '/images/manual/collection/source/image31.jpeg',
    volume: { th: 'เก็บ swab ให้ปลายอยู่ใน gel', en: 'Keep the swab tip in the gel' },
    contents: { th: 'Cary & Blair transport medium (มักพบสีแดง)', en: 'Cary & Blair transport medium (often red)' },
    handling: { th: 'สีของ swab อาจเปลี่ยนแปลงตามการจัดซื้อแต่ละรอบ', en: 'The swab color may vary by procurement cycle' },
    tests: { th: 'Rectal swab · Stool swab เพื่อเพาะเชื้อ', en: 'Rectal swab · stool swab for culture' },
  },
  {
    image: '/images/manual/collection/source/image33.png',
    volume: { th: 'เก็บ swab ให้ปลายอยู่ใน gel', en: 'Keep the swab tip in the gel' },
    contents: { th: 'Amie’s transport media (มักพบสีน้ำเงิน)', en: 'Amies transport medium (often blue)' },
    handling: { th: 'สีของ swab อาจเปลี่ยนแปลงตามการจัดซื้อแต่ละรอบ', en: 'The swab color may vary by procurement cycle' },
    tests: { th: 'Swab จากแผล อวัยวะสืบพันธุ์ คอ และตำแหน่งอื่นตามการตรวจ', en: 'Swabs from wounds, genital sites, throat, and other test-specific sites' },
  },
  {
    image: '/images/manual/collection/source/image35.png',
    volume: { th: 'ตามชนิดชุดตรวจ', en: 'According to the test kit' },
    contents: { th: 'Nasopharyngeal swab', en: 'Nasopharyngeal swab' },
    handling: { th: 'เก็บ Nasopharyngeal swab ตามวิธีของชุดตรวจและปิดภาชนะให้สนิท', en: 'Collect the nasopharyngeal swab according to the kit instructions and cap securely' },
    tests: { th: 'SARS-CoV-2 Rapid Antigen · Influenza A/B Rapid · RSV Rapid', en: 'SARS-CoV-2 rapid antigen · influenza A/B rapid · RSV rapid' },
  },
  {
    image: '/images/manual/collection/source/image36.png',
    volume: { th: 'ตามชนิดชุดตรวจ', en: 'According to the test kit' },
    contents: { th: 'Nasopharyngeal swab in VTM', en: 'Nasopharyngeal swab in VTM' },
    handling: { th: 'เก็บ Nasopharyngeal swab ใน VTM และปิดฝาให้สนิท', en: 'Place the nasopharyngeal swab in VTM and cap securely' },
    tests: { th: 'PCR COVID-19 · Xpert COVID-19', en: 'COVID-19 PCR · Xpert COVID-19' },
  },
  {
    image: '/images/manual/collection/source/image37.png',
    volume: { th: 'ตามขีดของ Cowin tube', en: 'According to the Cowin tube indicator' },
    contents: { th: 'Cowin tube', en: 'Cowin tube' },
    handling: { th: 'เก็บและนำส่งตามข้อกำหนดของงานอณูชีววิทยาและงานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ', en: 'Collect and transport according to the biomolecular and special/reference laboratory requirements' },
    tests: { th: 'NGS: NIPT คัดกรองกลุ่มอาการดาวน์', en: 'NGS: NIPT screening for Down syndrome' },
  },
]

export interface CollectionFigure {
  id: string
  src: string
  titleTh: string
  titleEn: string
  captionTh: string
  captionEn: string
  ratio?: string
}

const CONTAINER_SOURCE_IMAGE_META = [
  { file: 'image4.png', th: 'ขวด Hemoculture', en: 'Hemoculture bottles' },
  { file: 'image5.png', th: 'ฝาขวด Hemoculture ตัวอย่างที่ 1', en: 'Hemoculture cap example 1' },
  { file: 'image6.png', th: 'ฝาขวด Hemoculture ตัวอย่างที่ 2', en: 'Hemoculture cap example 2' },
  { file: 'image7.png', th: 'ฝาขวด Hemoculture ตัวอย่างที่ 3', en: 'Hemoculture cap example 3' },
  { file: 'image8.png', th: 'ขวดเพาะเชื้อจากเลือด', en: 'Blood-culture bottle' },
  { file: 'image9.png', th: 'ฝาขวดเพาะเชื้อจากเลือด', en: 'Blood-culture bottle cap' },
  { file: 'image10.png', th: 'หลอด Sodium citrate', en: 'Sodium-citrate tube' },
  { file: 'image11.png', th: 'หลอด Sodium citrate ตัวอย่างที่ 2', en: 'Sodium-citrate tube example 2' },
  { file: 'image12.png', th: 'ฝาหลอด Sodium citrate', en: 'Sodium-citrate tube cap' },
  { file: 'image13.png', th: 'หลอด Clotted blood', en: 'Clotted-blood tube' },
  { file: 'image14.jpeg', th: 'หลอด Clotted blood ตัวอย่างที่ 2', en: 'Clotted-blood tube example 2' },
  { file: 'image15.png', th: 'ฝาหลอด Clotted blood', en: 'Clotted-blood tube cap' },
  { file: 'image16.jpeg', th: 'หลอด Lithium heparin', en: 'Lithium-heparin tube' },
  { file: 'image17.png', th: 'หลอด Lithium heparin ตัวอย่างที่ 2', en: 'Lithium-heparin tube example 2' },
  { file: 'image18.png', th: 'ฝาหลอด Lithium heparin', en: 'Lithium-heparin tube cap' },
  { file: 'image19.png', th: 'หลอด EDTA ขนาด 6, 2 และ 0.5 mL', en: 'EDTA tubes: 6, 2, and 0.5 mL' },
  { file: 'image20.png', th: 'ฝาหลอด EDTA', en: 'EDTA tube cap' },
  { file: 'image21.jpeg', th: 'หลอด NaF', en: 'NaF tube' },
  { file: 'image22.png', th: 'ฝาหลอด NaF', en: 'NaF tube cap' },
  { file: 'image23.png', th: 'กระป๋องเก็บปัสสาวะฝาเหลือง', en: 'Yellow-cap urine cup' },
  { file: 'image24.jpeg', th: 'กระป๋องเก็บปัสสาวะตัวอย่างที่ 2', en: 'Urine cup example 2' },
  { file: 'image25.png', th: 'กระป๋องเก็บอุจจาระ', en: 'Stool cup' },
  { file: 'image26.png', th: 'ช้อนตักอุจจาระ', en: 'Stool collection spoon' },
  { file: 'image27.png', th: 'Blood gas syringe', en: 'Blood-gas syringe' },
  { file: 'image28.png', th: 'Blood gas capillary tube', en: 'Blood-gas capillary tube' },
  { file: 'image29.png', th: 'กระป๋อง Sterile', en: 'Sterile cup' },
  { file: 'image30.png', th: 'ขวด Sterile', en: 'Sterile bottle' },
  { file: 'image31.jpeg', th: 'Cary & Blair transport medium', en: 'Cary & Blair transport medium' },
  { file: 'image32.png', th: 'ฝา Cary & Blair', en: 'Cary & Blair cap' },
  { file: 'image33.png', th: 'Amies transport media', en: 'Amies transport medium' },
  { file: 'image34.png', th: 'ฝา Amies', en: 'Amies cap' },
  { file: 'image35.png', th: 'Nasopharyngeal swab', en: 'Nasopharyngeal swab' },
  { file: 'image36.png', th: 'VTM', en: 'VTM' },
  { file: 'image37.png', th: 'Cowin tube', en: 'Cowin tube' },
] as const

export const CONTAINER_FIGURES: CollectionFigure[] = CONTAINER_SOURCE_IMAGE_META.map(item => ({
  id: `container-${item.file}`,
  src: `/images/manual/collection/source/${item.file}`,
  titleTh: item.th,
  titleEn: item.en,
  captionTh: 'ภาพประกอบภาชนะจากตารางในคู่มือการใช้บริการห้องปฏิบัติการ 2569-2',
  captionEn: 'Container illustration from the 2569-2 laboratory service manual.',
}))

export const VENIPUNCTURE_FIGURES: CollectionFigure[] = [
  {
    id: 'venipuncture-sites',
    src: '/images/manual/collection/source/image38.png',
    titleTh: 'ตำแหน่งเส้นเลือดบริเวณข้อพับแขนและหลังมือ',
    titleEn: 'Veins of the antecubital fossa and dorsal hand',
    captionTh: 'ภาพประกอบตำแหน่ง Median, Cephalic, Basilic, Metacarpal plexus และ Dorsal venous arch จากคู่มือ (ภาพจาก: https://www.gentlelife-laboratory.com/th/specimen-handing)',
    captionEn: 'Manual illustration of the median, cephalic, basilic, metacarpal plexus, and dorsal venous arch (source: https://www.gentlelife-laboratory.com/th/specimen-handing).',
  },
  {
    id: 'venipuncture-arm',
    src: '/images/manual/collection/source/image39.png',
    titleTh: 'แนวเส้นเลือดบริเวณแขน',
    titleEn: 'Venous pathways of the arm',
    captionTh: 'ใช้ประกอบการเลือกตำแหน่งเจาะเลือดตามลำดับความเหมาะสม (ภาพจาก: https://www.gentlelife-laboratory.com/th/specimen-handing)',
    captionEn: 'Use with the site-selection order described in the procedure (source: https://www.gentlelife-laboratory.com/th/specimen-handing).',
  },
  {
    id: 'venipuncture-foot',
    src: '/images/manual/collection/source/image40.jpeg',
    titleTh: 'ตำแหน่งบริเวณหลังเท้า',
    titleEn: 'Dorsal foot anatomy',
    captionTh: 'หลังเท้าเป็นทางเลือกสุดท้ายเมื่อไม่สามารถเจาะบริเวณแขนได้ (ภาพจาก: https://www.bartleypt.com/Injuries-Conditions/Foot/Foot-Anatomy/a~251/article.html)',
    captionEn: 'The dorsal foot is a last-resort site when arm access is unavailable (source: https://www.bartleypt.com/Injuries-Conditions/Foot/Foot-Anatomy/a~251/article.html).',
  },
  {
    id: 'tube-mixing',
    src: '/images/manual/collection/source/image42.png',
    titleTh: 'การกลับหลอดแบบ End-over-end inversion',
    titleEn: 'End-over-end tube inversion',
    captionTh: 'ภาพประกอบการกลับหลอดเพื่อให้เลือดผสมกับสารในหลอดอย่างทั่วถึง จำนวนครั้งให้ยึดตามชนิดหลอดและวิธีตรวจ',
    captionEn: 'Illustration of end-over-end inversion. Follow the specified number of inversions for each tube and test method.',
  },
]

export const SKIN_FIGURES: CollectionFigure[] = [
  {
    id: 'finger-puncture',
    src: '/images/manual/collection/source/image43.png',
    titleTh: 'การเจาะปลายนิ้ว',
    titleEn: 'Finger puncture',
    captionTh: 'เจาะในทิศทางตั้งฉากกับแนวลายนิ้วตามขั้นตอนของคู่มือ',
    captionEn: 'Puncture perpendicular to the fingerprint lines as described in the manual.',
  },
  {
    id: 'heel-puncture',
    src: '/images/manual/collection/source/image44.png',
    titleTh: 'ตำแหน่งเจาะส้นเท้า',
    titleEn: 'Heel puncture site',
    captionTh: 'ทารกแรกเกิดและเด็กที่ยังไม่เริ่มเดิน: ใช้ด้านข้างของส้นเท้า',
    captionEn: 'For newborns and pre-walking infants: use the sides of the heel.',
  },
  {
    id: 'capillary-tube',
    src: '/images/manual/collection/source/image45.png',
    titleTh: 'Sodium Heparin capillary tube',
    titleEn: 'Sodium-heparin capillary tube',
    captionTh: 'หลอด capillary แถบสีแดงสำหรับเก็บเลือดจากผิวหนัง',
    captionEn: 'Red-band capillary tube for skin-puncture blood collection.',
  },
]

export const BLOOD_GAS_FIGURES: CollectionFigure[] = [
  {
    id: 'blood-gas-syringe',
    src: '/images/manual/collection/source/image27.png',
    titleTh: 'Blood gas syringe และอุปกรณ์',
    titleEn: 'Blood-gas syringe and supplies',
    captionTh: 'เตรียม syringe ที่มี Lithium heparin ให้พร้อมก่อนเจาะเลือด',
    captionEn: 'Prepare the lithium-heparin syringe before collection.',
  },
  {
    id: 'blood-gas-capillary',
    src: '/images/manual/collection/source/image28.png',
    titleTh: 'Blood gas capillary tube',
    titleEn: 'Blood-gas capillary tube',
    captionTh: 'อุปกรณ์สำหรับการเก็บตัวอย่าง Blood gas ในเด็กเล็ก',
    captionEn: 'Supplies for pediatric blood-gas collection.',
  },
  {
    id: 'blood-gas-mixing',
    src: '/images/manual/collection/source/image50.png',
    titleTh: 'การผสมตัวอย่างใน capillary tube',
    titleEn: 'Mixing a capillary specimen',
    captionTh: 'ใช้แม่เหล็กกลิ้งให้แท่งเหล็กเคลื่อนที่เพื่อผสมตัวอย่างเบา ๆ',
    captionEn: 'Roll a magnet to move the iron stirrer and mix the specimen gently.',
  },
  {
    id: 'blood-gas-stirrer',
    src: '/images/manual/collection/source/image49.jpeg',
    titleTh: 'แท่งเหล็กสำหรับ capillary tube',
    titleEn: 'Iron stirrer for the capillary tube',
    captionTh: 'ใส่แท่งเหล็กภายใน capillary tube ก่อนอุดจุกอีกด้านและผสมตัวอย่าง',
    captionEn: 'Insert the iron stirrer into the capillary tube before sealing the second end and mixing.',
  },
  {
    id: 'biohazard-pouch-symbol',
    src: '/images/manual/collection/source/image46.png',
    titleTh: 'สัญลักษณ์ซองสำหรับบรรจุสิ่งส่งตรวจ',
    titleEn: 'Protective specimen-pouch symbol',
    captionTh: 'ใช้ซองที่มีสัญลักษณ์เพื่อป้องกันการปนเปื้อนตัวอย่างระหว่างนำส่ง',
    captionEn: 'Use the labeled protective pouch to prevent specimen contamination during transport.',
  },
]

export const HEMOCULTURE_FIGURES: CollectionFigure[] = [
  {
    id: 'hemoculture-procedure',
    src: '/images/manual/collection/source/image51.png',
    ratio: '3 / 4',
    titleTh: 'สรุปขั้นตอนการเจาะเลือดเพื่อส่งตรวจ Hemoculture',
    titleEn: 'Blood-culture collection workflow',
    captionTh: 'ภาพสรุปขั้นตอนและชุดขวด Hemoculture จากคู่มือ',
    captionEn: 'Manual summary of the blood-culture collection workflow and bottle set.',
  },
]

// ── Venipuncture ──────────────────────────────────────────────────────────────

export const VENIPUNCTURE_SITES = [
  { num: '1', priority: 'แนะนำ', priorityEn: 'Preferred', th: 'ข้อพับแขน (Antecubital fossa)', en: 'Antecubital fossa', detail: 'Median cubital → Cephalic → Basilic — เลือกตามลำดับ', detailEn: 'Median cubital → Cephalic → Basilic — in order of preference.', color: 'var(--success)', bg: 'rgba(22,163,74,.08)', border: 'rgba(22,163,74,.2)' },
  { num: '2', priority: 'ทางเลือก', priorityEn: 'Alternative', th: 'หลังมือ (Dorsal hand)', en: 'Dorsal hand', detail: 'Metacarpal plexus · Dorsal venous arch', detailEn: 'Metacarpal plexus · Dorsal venous arch', color: '#D97706', bg: 'rgba(217,119,6,.08)', border: 'rgba(217,119,6,.2)' },
  { num: '3', priority: 'สุดท้าย', priorityEn: 'Last resort', th: 'หลังเท้า (Dorsal foot)', en: 'Dorsal foot', detail: 'ใช้เฉพาะกรณีที่เจาะแขนไม่ได้', detailEn: 'Last resort if arms unavailable.', color: 'var(--muted)', bg: 'var(--surface-2)', border: 'var(--border)' },
]

export const VENIPUNCTURE_STEPS_TH = [
  'การชี้บ่งตัวผู้ป่วยโดย (1) ถามชื่อ-นามสกุล และ (2) วันเดือนปีเกิดผู้ป่วย โดยให้ผู้ป่วยเป็นผู้ตอบเองทุกครั้งก่อนเจาะเลือด ตรวจสอบชนิดของหลอดเก็บตัวอย่างเลือดให้ตรงกับรายการทดสอบตามคำสั่งแพทย์ และตรวจสอบสติ๊กเกอร์ที่ติดหลอดเก็บตัวอย่างเลือดว่ามีชื่อ–นามสกุลผู้ป่วย วันเดือนปีเกิด หรือ HN. ตรงกันหรือไม่',
  'ใช้สำลี 70% แอลกอฮอล์เช็ดฆ่าเชื้อผิวหนังบริเวณที่จะเจาะ',
  'กรณีเจาะด้วยเข็มสองปลาย ปล่อยให้ระบบสุญญากาศดูดเลือดเข้าไปเองจนครบปริมาตรเลือดที่กำหนดไว้ แล้วค่อย ๆ ดึงหลอดออก',
  'กรณีผู้ป่วยเจาะเลือดยากและต้องเจาะด้วย Syringe เมื่อได้เลือดครบตามปริมาตรที่ต้องการแล้ว ให้แทงเข็มผ่านฝาหลอด แล้วปล่อยให้เลือดไหลเข้าสู่หลอดเลือดเองโดยห้ามดัน syringe เพื่อป้องกันการเกิด Hemolysis ควรทำด้วย one hand technique โดยวางหลอดเลือดใน rack แล้วแทงเข็มผ่านฝาหลอด ให้เลือดไหลเข้าหลอดตามแรงสุญญากาศ (World Health Organization, 2010)',
  'ไม่ควรรัดแขนผู้ป่วยนานเกิน 2 นาที เนื่องจากจะทำให้ค่าของการตรวจบางอย่างเปลี่ยนแปลง',
  'การเรียงลำดับการใส่เลือดลงในหลอดเลือด ให้ยึดตามหัวข้อ ลำดับการใส่เลือดลงในหลอดเลือด (Order of Draw) ที่แสดงในคู่มือนี้',
  'เมื่อใส่เลือดลงหลอดเลือดที่มีสารกันเลือดแข็ง ต้อง Mix เลือดโดยเอียงหลอดเลือดเป็นมุม 180 องศา 5–10 ครั้ง แบบ End-over-end inversion เพื่อให้เลือดและสารกันเลือดแข็งผสมกันดีและเลือดไม่แข็งตัว (Clot) โดยหลอด Sodium citrate ให้ Mix 3–4 ครั้งตามข้อกำหนดที่ยืนยันไว้',
  'หลอดเลือดที่ไม่มีสารกันเลือดแข็ง ต้อง Mix 3–5 ครั้ง เพื่อให้เลือดสัมผัสกับสารกระตุ้นการแข็งตัวของเลือดในหลอดเลือด เพื่อให้เลือดแข็งตัวเร็วขึ้น',
]

export const VENIPUNCTURE_STEPS_EN = [
  'Identify the patient by (1) asking the name and surname and (2) the date of birth; the patient must answer for themselves before every blood draw. Confirm that the blood-collection tube matches the physician-ordered test and that the tube label contains the patient name, date of birth, or HN and matches the request.',
  'Disinfect the puncture site with a 70% alcohol swab.',
  'With a double-ended needle, allow the vacuum system to draw blood into the tube until the specified volume is reached, then remove the tube slowly.',
  'For a difficult draw using a syringe, after obtaining the required volume pierce the tube cap and allow blood to flow into the tube by vacuum. Do not push the syringe, to prevent hemolysis. Use a one-hand technique with the tube in a rack (World Health Organization, 2010).',
  'Do not apply the tourniquet for longer than 2 minutes because some test values may change.',
  'Follow the Order of Draw shown in this manual when filling the tubes.',
  'For anticoagulant tubes, mix by holding the tube at 180 degrees and performing 5–10 end-over-end inversions so the blood and anticoagulant mix well and clotting is prevented. For Sodium citrate, use 3–4 inversions as confirmed for this manual.',
  'Tubes without anticoagulant must be mixed 3–5 times so the blood contacts the clot activator and clots more rapidly.',
]

// ── Skin Puncture ─────────────────────────────────────────────────────────────

export const SKIN_TYPES = [
  {
    icon: 'droplet', titleTh: 'การเจาะปลายนิ้ว (Finger)', titleEn: 'Finger Puncture',
    subtitleTh: 'ผู้ใหญ่ และเด็ก > 1 ปี', subtitleEn: 'Adults & children > 1 yr',
    bodyTh: 'การเจาะปลายนิ้ว (Finger Puncture) ใช้เจาะในผู้ใหญ่และเด็กที่มีอายุมากกว่า 1 ปี นิ้วที่ใช้ในการเจาะคือนิ้วนางและนิ้วกลาง ซึ่งทั้งสองนิ้วนี้บางกว่าและก่อให้เกิดผลแทรกซ้อนน้อยกว่านิ้วอื่น ๆ',
    bodyEn: 'Finger puncture is used for adults and children older than 1 year. Use the ring or middle finger because these fingers are thinner and cause fewer complications than the other fingers.',
    color: 'var(--primary)', bg: 'var(--primary-soft)', border: 'rgba(30,95,173,.2)',
  },
  {
    icon: 'blood', titleTh: 'การเจาะส้นเท้า (Heel)', titleEn: 'Heel Puncture',
    subtitleTh: 'ทารกแรกเกิด และเด็กที่ยังไม่เริ่มเดิน', subtitleEn: 'Newborns & pre-walking infants',
    bodyTh: 'การเจาะส้นเท้า (Heel Puncture) ใช้เจาะในทารกแรกเกิดและเด็กที่ยังไม่เริ่มเดิน ขณะเจาะต้องยึดข้อเท้าเด็กให้มั่นคง โดยใช้นิ้วชี้ของผู้ทำการเจาะเลือดวางหรือจับตรงโค้งของฝ่าเท้า และใช้นิ้วหัวแม่มือวางอยู่ห่างจากบริเวณที่เจาะ ตำแหน่งที่เจาะคือด้านข้างทั้งสองของส้นเท้าเด็ก',
    bodyEn: 'Heel puncture is used for newborns and children who have not started walking. Stabilize the ankle: place or hold the index finger on the arch of the foot and keep the thumb away from the puncture site. The puncture sites are the two sides of the child’s heel.',
    color: '#D97706', bg: 'rgba(217,119,6,.08)', border: 'rgba(217,119,6,.2)',
  },
]

export const SKIN_STEPS_TH = [
  'ชี้บ่งตัวผู้ป่วยโดย (1) ถามชื่อ-นามสกุล และ (2) วันเดือนปีเกิดผู้ป่วย โดยให้ผู้ป่วยเป็นผู้ตอบเองทุกครั้งก่อนเจาะเลือด ตรวจสอบชนิดของหลอดเก็บตัวอย่างเลือดให้ตรงกับรายการทดสอบตามคำสั่งแพทย์ และตรวจสอบสติ๊กเกอร์ที่ติดหลอดเก็บตัวอย่างเลือดว่ามีชื่อ–นามสกุลผู้ป่วย วันเดือนปีเกิด หรือ HN. ตรงกันหรือไม่',
  'ใช้สำลี 70% แอลกอฮอล์เช็ดฆ่าเชื้อผิวหนังบริเวณที่จะเจาะ',
  'รอให้แอลกอฮอล์แห้ง ใช้ lancet หรือเข็มเจาะผิวหนังบริเวณดังกล่าวในทิศทางที่ทำให้รอยแผลที่เกิดขึ้นตั้งฉากกับลายนิ้วมือหรือนิ้วเท้า ลึกประมาณ 2–3 มม. แล้วแต่ขนาดของผู้ป่วย ปล่อยให้เลือดไหลออกมาอิสระ',
  'ห้ามบีบหรือเค้นบริเวณที่เจาะ เพราะอาจทำให้เม็ดเลือดแดงแตกหรือเกิดการปนเปื้อนของเนื้อเยื่อและของเหลว ทำให้ผลผิดพลาดได้',
  'ใช้สำลีแห้งเช็ดเลือดหยดแรกทิ้งไปก่อน แล้วจึงเก็บหยดเลือดต่อไป',
  'ใช้ Capillary Tube (Sodium Heparin: แถบแดง) วางไว้ใกล้หยดเลือดในตำแหน่งเป็นมุมฉากเพื่อรองรับหยดเลือดที่ไหลออกมา อาจต้องบีบนิ้วหรือส้นเท้าเบา ๆ เพื่อให้เลือดไหลอย่างต่อเนื่องจนได้ปริมาตรเลือดอย่างน้อย 2 ใน 3 ของหลอด จากนั้น Mix เลือดไปมา 3–5 ครั้ง',
  'อุดด้วยดินน้ำมันสีขาวข้างใดข้างหนึ่งของ Capillary tube',
]

export const SKIN_STEPS_EN = [
  'Identify the patient by (1) asking the name and surname and (2) the date of birth; the patient must answer for themselves before every draw. Confirm that the blood-collection tube matches the physician-ordered test and that the tube label contains the patient name, date of birth, or HN and matches the request.',
  'Disinfect the puncture site with a 70% alcohol swab.',
  'Wait for the alcohol to dry. Use a lancet or skin-puncture needle in a direction that makes the wound perpendicular to the fingerprint or toe-print lines, to a depth of approximately 2–3 mm depending on patient size. Allow blood to flow freely.',
  'Do not squeeze or milk the puncture site because this may cause red-cell hemolysis or contamination with tissue and fluid, leading to an incorrect result.',
  'Wipe away the first drop with dry gauze, then collect the subsequent drops.',
  'Hold a Capillary Tube (Sodium Heparin, red band) at a right angle near the blood drop. Gentle finger or heel pressure may be needed to maintain flow until at least two-thirds of the tube is filled. Mix the blood back and forth 3–5 times.',
  'Seal one end of the capillary tube with white putty.',
]

// ── Blood Gas ─────────────────────────────────────────────────────────────────

export const ABG_SOURCES = [
  { kind: 'Arterial',   th: 'เลือดจากเส้นเลือดแดง (Arterial blood) เป็นตัวอย่างเลือดที่นิยมใช้มากที่สุด สามารถบอกปริมาณของออกซิเจนในเลือดแดงที่แท้จริง และบอกภาวะความเป็นกรดด่างของร่างกายได้', en: 'Arterial blood is the most commonly used specimen. It reports the true oxygen level in arterial blood and the body’s acid–base status.', color: '#DC2626', bg: 'rgba(220,38,38,.07)', badge: 'แนะนำ', badgeEn: 'Preferred' },
  { kind: 'Capillary',  th: 'เลือดจากเส้นเลือดฝอย (Capillary blood) ใช้ในกรณีผู้ป่วยเด็กเล็ก มีค่าใกล้เคียงกับเลือดจากเส้นเลือดแดง แต่มีค่า PO₂ ต่ำกว่า จึงจำเป็นต้องอุ่นบริเวณที่จะทำหัตถการก่อน', en: 'Capillary blood is used for young children. Values are close to arterial blood, but PO₂ is lower; therefore, warm the procedure site first.', color: '#D97706', bg: 'rgba(217,119,6,.07)', badge: 'เด็กเล็ก', badgeEn: 'Pediatric' },
  { kind: 'Venous',     th: 'เลือดจากเส้นเลือดดำ (Venous blood) ใช้ในกรณีศึกษา Arteriovenous shunt แต่ส่วนใหญ่ตัวอย่างชนิดนี้เกิดจากการเจาะเส้นเลือดแดงพลาด', en: 'Venous blood is used for Arteriovenous shunt studies, although it is often obtained when an arterial puncture is unsuccessful.', color: '#0891b2', bg: 'rgba(8,145,178,.07)', badge: 'AV shunt', badgeEn: 'AV shunt' },
  { kind: 'Pleural pH', th: 'น้ำเจาะปอด (Pleural fluid) เป็นสิ่งส่งตรวจอีกชนิดหนึ่งสำหรับ Gas analysis และนิยมส่งตรวจเพื่อหาค่า pH', en: 'Pleural fluid is another specimen for gas analysis and is commonly submitted for pH measurement.', color: 'var(--primary)', bg: 'var(--primary-soft)', badge: 'pH', badgeEn: 'pH' },
]

export const ABG_SYRINGE_TH = [
  '3.1.1 การเตรียมอุปกรณ์สำหรับเก็บตัวอย่าง Blood gas syringe',
  '3.1.2 ชี้บ่งตัวผู้ป่วยโดย (1) ถามชื่อ-นามสกุล และ (2) วันเดือนปีเกิดผู้ป่วย โดยให้ผู้ป่วยเป็นผู้ตอบเองทุกครั้งก่อนเจาะเลือด และตรวจสอบสติ๊กเกอร์ที่จะติด syringe เพื่อ Identify ตัวอย่างเลือดว่ามีชื่อ–นามสกุลผู้ป่วย วันเดือนปีเกิด หรือ HN. ตรงกันหรือไม่',
  '3.1.3 เลือกตำแหน่งของหลอดเลือดแดงที่จะเจาะ ได้แก่ radial, brachial หรือ femoral (ส่วนใหญ่นิยมเจาะ radial มากที่สุด) และควรตรวจการไหลเวียนเลือดด้วย modified Allen’s test เสียก่อน โดยให้ผู้ป่วยกำมือแน่น แล้วผู้เจาะใช้มือกดบริเวณ ulnar artery และ radial artery ให้ผู้ป่วยกางนิ้วออกและปล่อยการกด ulnar artery ออก มือจะเปลี่ยนจากซีดเป็นสีแดงทันที หากยังคงซีดแสดงว่าการไหลเวียนเลือดมีปัญหา ควรเลือกเจาะจากเส้นเลือดแดงที่อื่น',
  'ใช้สำลี 70% แอลกอฮอล์เช็ดฆ่าเชื้อผิวหนังบริเวณที่จะเจาะ',
  'ดูดเลือดแล้วปิดจุก (Closed-system) อย่าให้มีฟองอากาศ และ Mix ตัวอย่างเลือดให้เลือดผสมเข้ากันกับสารกันเลือดแข็งโดยใช้ฝ่ามือหมุน syringe และพลิกฝ่ามือขึ้นและลงเบา ๆ (Inversion mixing) เพื่อป้องกันการเกิดก้อน clotted ของตัวอย่าง',
  'นำตัวอย่างส่งตรวจห้องปฏิบัติการทันที ระหว่างการขนส่งให้นำ syringe ใส่ในซองที่มีสัญลักษณ์ เพื่อป้องกันการปนเปื้อนตัวอย่าง และควบคุมอุณหภูมิตัวอย่างโดยใช้ ice pack ตลอดระยะเวลาการนำส่งตัวอย่างตรวจ',
  '3.1.7 บันทึกข้อมูลผู้ป่วย ได้แก่ อุณหภูมิผู้ป่วยขณะเก็บตัวอย่าง และค่า FIO2 ในใบส่งตรวจทุกครั้ง',
]

export const ABG_SYRINGE_EN = [
  '3.1.1 Prepare the equipment for collecting the blood-gas specimen with a Blood Gas syringe.',
  '3.1.2 Identify the patient by asking the name and surname and the date of birth; the patient must answer for themselves before every draw. Check the syringe label for the patient name, date of birth, or HN and confirm that it matches.',
  '3.1.3 Select the artery: radial, brachial, or femoral (radial is used most often). Perform a modified Allen’s test first: ask the patient to make a fist, compress the ulnar and radial arteries, ask the patient to open the hand, and release the ulnar artery. The hand should change from pale to red immediately; if it remains pale, circulation is impaired and another artery should be selected.',
  'Disinfect the puncture site with a 70% alcohol swab.',
  'Draw blood and cap the syringe as a closed system without air bubbles. Mix the specimen with the anticoagulant by rolling the syringe between the palms and gently turning the palms up and down (inversion mixing), to prevent clot formation.',
  'Deliver the specimen to the laboratory immediately. During transport, place the syringe in a labeled protective pouch and maintain temperature with an ice pack throughout transport.',
  '3.1.7 Record the patient temperature at collection and the FIO2 on the request form every time.',
]

export const ABG_CAPILLARY_TH = [
  '3.2.1 การเตรียมอุปกรณ์ชุด Blood gas capillary tube ให้พร้อม',
  '3.2.2 ชี้บ่งตัวผู้ป่วยโดย (1) ถามชื่อ-นามสกุล และ (2) วันเดือนปีเกิดผู้ป่วย โดยให้ผู้ป่วยเป็นผู้ตอบเองทุกครั้งก่อนเจาะเลือด และตรวจสอบสติ๊กเกอร์ที่จะติด Capillary tube เพื่อ Identify ตัวอย่างเลือดว่ามีชื่อ–นามสกุลผู้ป่วย วันเดือนปีเกิด หรือ HN. ตรงกันหรือไม่',
  '3.2.3 เลือกตำแหน่งที่จะทำการเจาะเลือด Capillary blood gas',
  '3.2.4 ห่อตัวหรือทำการยึดผู้ป่วยทารกหรือเด็กโดยเปิดเฉพาะบริเวณที่จะทำการเจาะเลือด กรณีที่เจาะเลือดบริเวณส้นเท้าต้องทำการอบอุ่นบริเวณส้นเท้าด้วยน้ำอุ่นเพื่อกระตุ้นการไหลเวียนประมาณ 5 นาที และซับบริเวณที่จะทำการเจาะให้แห้ง จับอุ้งเท้าของผู้ป่วยให้กระชับ โดยนิยมให้อุ้งเท้าของผู้ป่วยอยู่ระหว่างนิ้วชี้และนิ้วกลาง หลังจากนั้นทำการบีบและคลายเบา ๆ เพื่อเพิ่มปริมาณการไหลเวียนของเลือด',
  '3.2.5 ใช้สำลี 70% แอลกอฮอล์เช็ดฆ่าเชื้อผิวหนังบริเวณที่จะเจาะ',
  '3.2.6 รอให้แอลกอฮอล์แห้ง ใช้ lancet หรือเข็มเจาะผิวหนังบริเวณดังกล่าวในทิศทางที่ทำให้รอยแผลที่เกิดขึ้นตั้งฉากกับลายนิ้วมือหรือนิ้วเท้า ลึกประมาณ 2–3 มม. แล้วแต่ขนาดของผู้ป่วย ปล่อยให้เลือดไหลออกมาอิสระ',
  '3.2.7 ใช้ Capillary tube รองรับเลือดให้เต็มและระวังไม่ให้มีอากาศเข้าไปผสม เพราะทำให้ผลที่ได้คลาดเคลื่อน',
  'ใช้สำลีแห้งกดบริเวณที่เจาะเลือดจนกว่าเลือดจะหยุด',
  'นำจุกยางมาอุดปลายด้านใดด้านหนึ่ง แล้วนำแท่งเหล็กที่เตรียมไว้ใส่ลงไปใน Capillary tube แล้วจึงนำจุกยางอีก 1 จุกมาปิดด้านที่เหลือ',
  'ใช้แม่เหล็กกลิ้งบริเวณผิวด้านนอกของ Capillary tube เบา ๆ ขึ้น–ลงประมาณ 5–10 ครั้ง เพื่อป้องกันไม่ให้เลือดแข็งตัว Mix capillary tube แบบ Invert เพื่อให้แท่ง Stirrer กลิ้งกลับไป–มาภายใน Capillary ประมาณ 5–10 ครั้ง เพื่อให้เลือดผสมกันได้ดีกับสารกันเลือดแข็ง',
  'นำ Capillary tube ใส่ในซองที่มีสัญลักษณ์ เพื่อป้องกันการปนเปื้อนตัวอย่าง และควบคุมอุณหภูมิตัวอย่างโดยใช้ ice pack ตลอดระยะเวลาการนำส่งตัวอย่าง',
  '3.2.11 บันทึกข้อมูลผู้ป่วย ได้แก่ อุณหภูมิผู้ป่วยขณะเก็บตัวอย่างและค่า FIO2 ลงในใบส่งตรวจทุกครั้ง',
]

export const ABG_CAPILLARY_EN = [
  '3.2.1 Prepare the Blood Gas capillary-tube equipment.',
  '3.2.2 Identify the patient by asking the name and surname and the date of birth; the patient must answer for themselves before every draw. Check the Capillary tube label for the patient name, date of birth, or HN and confirm that it matches.',
  '3.2.3 Select the site for capillary blood-gas collection.',
  '3.2.4 Wrap or secure the infant or child, exposing only the collection site. For heel collection, warm the heel with warm water for approximately 5 minutes to improve circulation and pat the site dry. Hold the foot firmly, usually between the index and middle fingers, then gently compress and release to increase blood flow.',
  '3.2.5 Disinfect the puncture site with a 70% alcohol swab.',
  '3.2.6 Wait for the alcohol to dry. Use a lancet or skin-puncture needle in a direction perpendicular to the fingerprint or toe-print lines, approximately 2–3 mm deep depending on patient size, and allow blood to flow freely.',
  '3.2.7 Use the capillary tube to collect blood until full. Prevent air from entering because it causes inaccurate results.',
  'Press dry gauze on the puncture site until bleeding stops.',
  'Seal one end with a rubber stopper, insert the prepared iron rod into the capillary tube, and close the remaining end with a second rubber stopper.',
  'Roll a magnet gently up and down along the outside of the capillary tube approximately 5–10 times to prevent clotting. Invert the capillary tube so the stirrer rolls back and forth inside the capillary approximately 5–10 times, allowing the blood to mix with the anticoagulant.',
  'Place the capillary tube in a labeled protective pouch to prevent contamination and maintain temperature with an ice pack throughout transport.',
  '3.2.11 Record the patient temperature at collection and FIO2 on the request form every time.',
]

// ── Coagulation ───────────────────────────────────────────────────────────────

export const COAG_STEPS_TH = [
  'ชี้บ่งตัวผู้ป่วย — ชื่อ-สกุล และวัน-เดือน-ปีเกิด ให้ผู้ป่วยตอบเอง · ตรวจชนิดหลอด และสติ๊กเกอร์',
  'เช็ดผิว 70% แอลกอฮอล์ — รอให้แห้ง',
  'เจาะใส่หลอด 3.2% Sodium citrate ให้ถึงขีดบอกปริมาตร — ห้ามขาดหรือเกินโดยเด็ดขาด',
  'คว่ำหลอดไปมาเบา ๆ 3–4 ครั้ง เพื่อให้เลือดผสมกับสารกันเลือดแข็ง · ระวังอย่าให้เกิดฟอง — จะทำให้ Fibrinogen, FV, FVIII ลดประสิทธิภาพ',
]

export const COAG_STEPS_EN = [
  'Identify patient — full name + DOB stated by the patient. Confirm tube + label match the request.',
  'Disinfect with 70% alcohol — let dry.',
  'Fill the 3.2% sodium citrate tube exactly to the indicator line — NEVER under or over.',
  'Invert gently 3–4× to mix with the anticoagulant. Avoid foam — it degrades Fibrinogen, FV, and FVIII activity.',
]

// ── Microbiology ──────────────────────────────────────────────────────────────

export const MICRO_PRINCIPLES_TH = [
  'ควรเก็บสิ่งตัวอย่างส่งตรวจก่อนให้ยาต้านจุลชีพ (Antibiotics) หากผู้ป่วยได้รับยาต้านจุลชีพอยู่ อาจทำให้ลดโอกาสในการแยกเชื้อก่อโรค (Pathogens) จากตัวอย่างผู้ป่วย เนื่องจาก Antibiotics มีผลยับยั้งการเจริญของเชื้อ หากผู้ป่วยได้รับการรักษาด้วย Antibiotics ไปแล้ว ให้เก็บตัวอย่างก่อนการให้ Antibiotics ในครั้งถัดไป เพื่อให้ปริมาณ Antibiotics ในตัวอย่างตรวจอยู่ในระดับต่ำที่สุด',
  'เวลาในการเก็บสิ่งส่งตรวจ การเก็บสิ่งส่งตรวจในโรคติดเชื้อบางชนิดต้องคำนึงถึงเวลาของการเก็บให้เหมาะสมกับระยะของโรค เพื่อช่วยเพิ่มโอกาสของการพบเชื้อ Pathogens เช่น Typhoid fever ในระยะสัปดาห์แรกที่มีไข้จะมีโอกาสตรวจพบเชื้อในกระแสเลือดได้สูง จึงควรเก็บตัวอย่างเลือดเพื่อเพาะเชื้อ ส่วนในระยะหลัง ๆ เชื้อจะเข้าสู่ reticuloendothelial system (RE system) หากตรวจหาเชื้อจากอุจจาระจะมีโอกาสพบเชื้อได้มากกว่า เป็นต้น',
  'เลือกเก็บสิ่งส่งตรวจให้ถูกต้อง คือเก็บสิ่งส่งตรวจตรงตำแหน่งหรือส่วนที่มีโอกาสพบเชื้อได้จำนวนมาก และเก็บให้มีปริมาณมากเพียงพอเพื่อสามารถตรวจพบเชื้อได้ง่ายขึ้น',
  'การเก็บสิ่งส่งตรวจที่ถูกต้อง พยายามหลีกเลี่ยงการปนเปื้อนของจุลชีพประจำถิ่น (normal biota) ให้มากที่สุด และในกรณีที่ให้ผู้ป่วยเก็บสิ่งส่งตรวจเอง ต้องอธิบายขั้นตอนในการเก็บที่ถูกต้องให้ผู้ป่วยเข้าใจก่อนการเก็บสิ่งส่งตรวจ',
  'ภาชนะที่ใช้ในการเก็บสิ่งตัวอย่างส่งตรวจต้องปราศจากเชื้อ ในกรณีที่ต้องเก็บใส่ใน Transport media ต้องเลือกใช้ให้เหมาะสม',
  'นำส่งสิ่งตัวอย่างส่งตรวจให้ถึงห้องปฏิบัติการโดยเร็วที่สุด เนื่องจากเชื้อบางชนิดจะตายง่ายเมื่ออยู่นอกร่างกาย ดังนั้นจึงต้องรู้วิธีที่จะทำให้เชื้อมีชีวิตอยู่จนกว่าจะส่งสิ่งตัวอย่างส่งตรวจถึงห้องปฏิบัติการ โดยเก็บไว้ในสภาพที่เหมาะสม เช่น ใส่ใน transport media หรือการเก็บไว้ในตู้เย็นสำหรับสิ่งตัวอย่างส่งตรวจบางชนิด เป็นต้น',
  'ใบ request ต้องกรอกรายละเอียดต่าง ๆ ให้สมบูรณ์ชัดเจน รวมทั้งการติดฉลากที่ภาชนะที่ใช้เก็บสิ่งตัวอย่างส่งตรวจ โดยบอกรายละเอียดต่าง ๆ ของสิ่งตัวอย่างส่งตรวจอย่างถูกต้องครบถ้วน ได้แก่ ชื่อ-นามสกุล เลขประจำตัวผู้ป่วย หอผู้ป่วย ชนิดของสิ่งส่งตรวจ ตำแหน่งที่เก็บสิ่งส่งตรวจ และเวลาในการเก็บสิ่งส่งตรวจ (ซึ่งอาจเป็นเวลาที่ต่างจากการบันทึกขอตรวจในระบบ HIS)',
  'ต้องใช้เทคนิคปราศจากเชื้อ (aseptic technique) ที่เหมาะสมในการเก็บสิ่งตัวอย่างส่งตรวจแต่ละอย่าง เพราะการเก็บสิ่งตัวอย่างส่งตรวจบางชนิดสามารถเป็นทางในการนำเชื้อโรคเข้าสู่ร่างกายของผู้ป่วยได้',
]

export const MICRO_PRINCIPLES_EN = [
  'Collect the specimen before antibiotics are given. If the patient is already receiving antibiotics, collect before the next dose so the antibiotic level in the specimen is as low as possible and recovery of pathogens is more likely.',
  'Collection time must suit the stage of the infectious disease. For example, during the first febrile week of typhoid fever, blood culture is more likely to detect the pathogen; later, the organism enters the reticuloendothelial system and stool may be more likely to yield the organism.',
  'Collect from the correct site or portion where pathogens are most abundant, and collect a sufficient volume so the organism can be detected more easily.',
  'Avoid contamination with normal biota as much as possible. When the patient collects the specimen, explain the correct procedure before collection.',
  'The collection container must be sterile. When a transport medium is required, select the medium appropriate for the specimen and test.',
  'Deliver the specimen to the laboratory as quickly as possible because some organisms die easily outside the body. Use appropriate conditions, such as transport medium or refrigeration for specimens that require it.',
  'Complete the request form clearly and label the collection container accurately with the patient name, patient identification number, ward, specimen type, collection site, and collection time, which may differ from the time the request was entered in HIS.',
  'Use an appropriate aseptic technique for each specimen because some collection procedures can introduce pathogens into the patient’s body.',
]

export const MICRO_TRANSPORTS = [
  { name: 'Cary & Blair',   icon: 'petri',   useTh: 'Rectal swab · Stool swab',                       useEn: 'Rectal / stool swab' },
  { name: 'Amies',          icon: 'syringe', useTh: 'Wound · Genital · Throat swab',                   useEn: 'Wound · genital · throat swab' },
  { name: 'Sterile cup',    icon: 'cup',     useTh: 'Urine culture · Fluid culture · Sputum',          useEn: 'Urine / fluid / sputum culture' },
  { name: 'Sterile bottle', icon: 'flask',   useTh: 'CSF · Body fluid (cell count, culture)',          useEn: 'CSF / body fluid (count, culture)' },
  { name: 'Hemoculture',    icon: 'blood',   useTh: 'Blood culture aerobic / anaerobic / fungal / TB', useEn: 'Blood culture aerobic / anaerobic / fungal / TB' },
  { name: 'NP swab + VTM',  icon: 'dna',     useTh: 'COVID PCR · Xpert',                              useEn: 'COVID PCR · Xpert' },
]

export const MICRO_URINE_PATHS = [
  { kind: 'Clean-voided midstream', bodyTh: 'สำหรับกรณีที่ผู้ป่วยสามารถถ่ายปัสสาวะได้เอง แนะนำให้ผู้ป่วยล้างมือด้วยสบู่ให้สะอาด จากนั้นล้างบริเวณอวัยวะเพศด้วยน้ำสะอาดและสบู่ ทำการเก็บปัสสาวะโดยถ่ายปัสสาวะช่วงแรกทิ้ง นำกระปุกปราศจากเชื้อรองปัสสาวะช่วงกลางประมาณ 15–20 มล. หรือประมาณครึ่งกระปุก ถ่ายปัสสาวะที่เหลือทิ้ง ปิดฝากระปุกให้สนิท และนำส่งห้องปฏิบัติการทันที', bodyEn: 'For a patient who can urinate independently: wash hands thoroughly with soap, then wash the genital area with clean water and soap. Discard the first urine, collect approximately 15–20 mL or half a sterile cup from the midstream, discard the remaining urine, cap tightly, and deliver to the laboratory immediately.', color: 'var(--primary)', bg: 'var(--primary-soft)' },
  { kind: 'Catheterized', bodyTh: 'กรณีผู้ป่วยใส่สายสวนปัสสาวะ ผู้ทำการเก็บปัสสาวะล้างมือด้วยสบู่ให้สะอาด ใส่ถุงมือ จากนั้นใช้ตัวหนีบ clamp สายสวนให้อยู่บริเวณด้านล่างของ sampling port ค้างไว้ประมาณ 10–15 นาที เพื่อให้ได้ปัสสาวะใหม่ที่ออกมาจากกระเพาะปัสสาวะ เช็ดบริเวณ sampling port ด้วย 70% แอลกอฮอล์ หรือ 2% chlorhexidine in alcohol รอให้แห้ง ใช้เข็มฉีดยาขนาดเล็กเก็บปัสสาวะประมาณ 15–20 มล. ใส่ในกระปุกปราศจากเชื้อ ปิดฝาให้สนิท และนำส่งห้องปฏิบัติการทันที', bodyEn: 'For a patient with a urinary catheter: wash hands thoroughly and put on gloves. Clamp the catheter below the sampling port for approximately 10–15 minutes so fresh urine from the bladder accumulates. Disinfect the sampling port with 70% alcohol or 2% chlorhexidine in alcohol and let it dry. Use a small syringe to collect approximately 15–20 mL into a sterile cup, cap tightly, and deliver immediately.', color: '#0891B2', bg: 'rgba(8,145,178,.07)' },
  { kind: 'Intermittent catheterized urine', bodyTh: 'กรณีผู้ป่วยไม่สามารถถ่ายปัสสาวะเองได้ ผู้ทำการเก็บปัสสาวะล้างมือด้วยสบู่ให้สะอาด ใส่ถุงมือ จากนั้นทำความสะอาดบริเวณอวัยวะเพศของผู้ป่วย ใช้ชุดสวนเก็บปัสสาวะทำการสวนเก็บปัสสาวะด้วยวิธี aseptic technique ปล่อยปัสสาวะที่ไหลออกมาช่วงแรกทิ้งไปก่อน นำกระปุกปราศจากเชื้อรองปัสสาวะช่วงกลางประมาณ 15–20 มล. ปล่อยปัสสาวะที่เหลือทิ้ง ปิดฝากระปุกให้สนิท และนำส่งห้องปฏิบัติการทันที', bodyEn: 'For a patient unable to urinate independently: wash hands and put on gloves, clean the patient’s genital area, and catheterize using aseptic technique. Discard the initial urine, collect approximately 15–20 mL of midstream urine in a sterile cup, discard the remaining urine, cap tightly, and deliver immediately.', color: '#7C3AED', bg: 'rgba(124,58,237,.07)' },
]

export const MICRO_SPUTUM = [
  { k: 'Expectorated sputum', th: 'การเก็บเสมหะโดยให้ผู้ป่วยไอเอาเสมหะออกมาเอง โดยแนะนำให้ผู้ป่วยบ้วนปากด้วยน้ำสะอาด เรียบร้อยแล้วให้ผู้ป่วยหายใจเข้าลึก ๆ กลั้นหายใจไว้สักครู่ จากนั้นไอลึก ๆ แรง ๆ เพื่อให้ได้เสมหะออกมา บ้วนเสมหะใส่ในกระปุกปราศจากเชื้อโดยพยายามให้ปนเปื้อนน้ำลายน้อยที่สุด ปิดฝากระปุกให้สนิท และนำส่งห้องปฏิบัติการทันที', en: 'Ask the patient to cough up the sputum themselves. Have the patient rinse the mouth with clean water, breathe in deeply and hold briefly, then cough deeply and forcefully to produce sputum. Spit into a sterile cup while minimizing saliva contamination, cap tightly, and deliver immediately.', },
  { k: 'Endotracheal suction', th: 'การเก็บเสมหะในผู้ป่วยที่ใส่ท่อช่วยหายใจหรือผู้ป่วยไม่สามารถไอเอาเสมหะออกมาเองได้ อุปกรณ์ประกอบด้วยอุปกรณ์ดูดเสมหะและชุดเก็บเสมหะ ทำการเก็บตัวอย่างโดย Aseptic technique ปรับความดันของตัวดูดเสมหะให้เหมาะสม สวมถุงมือปราศจากเชื้อ ต่อสายดูดเสมหะเข้ากับหัวต่อเครื่องดูดเสมหะ ใส่สายดูดเสมหะลึกเท่าความยาวท่อหายใจ ขณะใส่สายไม่ต้องทำการดูด (ปิดหรือพับสายดูดเสมหะไว้ก่อน หรือหากเป็นข้อต่อรูปตัว Y ยังไม่ต้องใช้นิ้วปิดบริเวณที่ไม่ได้ต่อกับสาย) เมื่อใส่สายถึงระดับที่ต้องการแล้วจึงทำการดูดเสมหะ 5–10 วินาที (ไม่ควรเกิน 15 วินาที) จากนั้นดึงสายออกช้า ๆ ระหว่างดึงสายออกไม่ต้องทำการดูด เสมหะจะอยู่ในชุดเก็บเสมหะ ปิดฝาให้สนิท และนำส่งห้องปฏิบัติการทันที', en: 'For a patient with an endotracheal tube or unable to cough up sputum: use the suction equipment and collection set with aseptic technique. Adjust suction pressure appropriately, wear sterile gloves, connect the suction catheter to the suction machine, and insert it to the length of the airway tube without suction. Keep the suction line closed or folded; with a Y-connector, do not occlude the unused opening with a finger. Once at the required depth, suction for 5–10 seconds (not more than 15 seconds), then withdraw slowly without suction. The sputum remains in the collection set; cap tightly and deliver immediately.', },
  { k: 'Broncho-alveolar lavage', th: 'แพทย์เป็นผู้เก็บตัวอย่างระหว่างการทำ Bronchoscopy หรือการส่องกล้องหลอดลม โดยใส่สารละลาย 0.9% NaCl เข้าไปในหลอดลมส่วนปลายที่สงสัยว่าเนื้อปอดบริเวณดังกล่าวมีพยาธิสภาพ และดูดสารน้ำดังกล่าวออกมาเพื่อส่งตรวจเพิ่มเติม (แตกต่างจาก Bronchial wash ที่เป็นการดูดน้ำล้างจากหลอดลมขนาดใหญ่) ทำการเก็บตัวอย่างใส่ในภาชนะปลอดเชื้อ ปิดฝาให้สนิท หุ้มด้วย parafilm เพื่อป้องกันการรั่วซึม และนำส่งห้องปฏิบัติการทันที', en: 'A physician collects the specimen during bronchoscopy. Instill 0.9% NaCl into the distal bronchus suspected of pulmonary pathology and aspirate the fluid for further testing. This differs from bronchial wash, which aspirates washings from the larger bronchi. Place the specimen in a sterile container, cap tightly, seal with parafilm to prevent leakage, and deliver immediately.', },
]

export interface MicroCollectionDetail {
  id: string
  titleTh: string
  titleEn: string
  items: { labelTh: string; labelEn: string; bodyTh: string; bodyEn: string }[]
}

/** Detailed culture-collection procedures from the manual. Acceptance/rejection rules live in Transport. */
export const MICRO_COLLECTION_DETAILS: MicroCollectionDetail[] = [
  {
    id: 'pus-wound',
    titleTh: 'หนองและแผล',
    titleEn: 'Pus and wound specimens',
    items: [
      {
        labelTh: 'หนอง', labelEn: 'Pus',
        bodyTh: 'หนอง: ในผู้ป่วยที่มีฝีหนอง ผู้ทำการเก็บสิ่งส่งตรวจล้างมือให้สะอาดด้วยสบู่ ใส่ถุงมือ ทำความสะอาดผิวหนังบริเวณที่ต้องการเก็บด้วย 2% chlorhexidine in alcohol รอให้แห้ง จากนั้นใช้เข็มดูดหนองออกด้วยวิธี aseptic technique ใส่ตัวอย่างหนองในขวดแก้วปราศจากเชื้อ ปิดฝาให้สนิทและพันด้วย parafilm เพื่อป้องกันการหกรั่วซึมของตัวอย่าง และนำส่งห้องปฏิบัติการทันที',
        bodyEn: 'Pus: for a patient with an abscess, wash hands thoroughly with soap and wear gloves. Clean the collection site with 2% chlorhexidine in alcohol and let it dry. Aspirate the pus using aseptic technique into a sterile glass bottle, cap tightly, and wrap with parafilm to prevent leakage. Deliver to the laboratory immediately.',
      },
      {
        labelTh: 'ชิ้นเนื้อ', labelEn: 'Tissue',
        bodyTh: 'Tissue: ใส่ตัวอย่าง tissue ที่เก็บได้ด้วย aseptic technique ลงในขวดแก้วปราศจากเชื้อ หยด Sterile normal saline เล็กน้อยเพื่อป้องกันการแห้งของตัวอย่าง ห้ามใส่จนท่วมชิ้นเนื้อและห้ามใส่ของเหลวอื่น ๆ ลงไป เช่น formalin ปิดฝาให้สนิทและพันด้วย parafilm และนำส่งห้องปฏิบัติการทันที',
        bodyEn: 'Tissue: place the collected tissue aseptically in a sterile glass bottle. Add a small amount of sterile normal saline to prevent drying, but do not cover the tissue and do not add other fluids such as formalin. Cap tightly, wrap with parafilm, and deliver immediately.',
      },
      {
        labelTh: 'Swab จากแผล', labelEn: 'Wound swab',
        bodyTh: 'Wound swab: ใช้ swab ที่มากับหลอด Amies transport media ป้ายในส่วนลึกของแผลหรือใต้แผล โดยป้องกันไม่ให้สัมผัสกับผิวหนังในบริเวณข้างเคียง และไม่ควรป้ายบริเวณผิวของบาดแผล เนื่องจากมักพบเฉพาะเนื้อเยื่อเน่าตายและปนเปื้อน normal biota เมื่อทำการ swab เรียบร้อย ให้เสียบไม้ swab ลงในหลอด transport media ให้ปลาย swab อยู่ในวุ้น และนำส่งห้องปฏิบัติการทันที',
        bodyEn: 'Wound swab: use the swab supplied with Amies transport medium and swab the deep part or beneath the wound. Prevent contact with nearby skin and do not swab only the wound surface, where necrotic tissue and normal biota are commonly found. After swabbing, insert the swab into the transport-medium tube with the tip in the gel and deliver immediately.',
      },
      {
        labelTh: 'Swab สำหรับ Gram stain', labelEn: 'Swab for Gram stain',
        bodyTh: 'หากมีส่งย้อมสีจาก wound ให้ใช้ไม้พันสำลีปราศจากเชื้อป้ายบริเวณเดียวกันกับการเก็บเพื่อส่งเพาะเชื้อ ห้ามใช้ swab ไม้เดียวกัน จากนั้นป้ายลงบนกระจกสไลด์และปล่อยให้แห้ง แล้วนำส่งห้องปฏิบัติการทันที',
        bodyEn: 'If a wound Gram stain is requested, use a separate sterile cotton swab from the same site as the culture specimen; do not use the same swab. Smear the specimen on a glass slide, allow it to dry, and deliver immediately.',
      },
    ],
  },
  {
    id: 'genital',
    titleTh: 'สิ่งส่งตรวจจากอวัยวะสืบพันธุ์',
    titleEn: 'Genital specimens',
    items: [
      {
        labelTh: 'หนองจากท่อปัสสาวะชาย', labelEn: 'Male urethral pus',
        bodyTh: 'ผู้ป่วยชายที่มีหนองไหลจากท่อปัสสาวะ สามารถเก็บสิ่งส่งตรวจโดยรีดหนองออกจากส่วนปลายท่อปัสสาวะและใช้ไม้ swab ที่มากับหลอด Amies transport media ป้าย แล้วใส่มาในหลอด transport media ให้ปลาย swab อยู่ในวุ้น และนำส่งห้องปฏิบัติการทันที หากหนองมีปริมาณน้อย ควรเก็บตอนเช้าก่อนการปัสสาวะ หรือใช้ swab ก้านเล็กสอดเข้าที่ส่วนปลายของท่อปัสสาวะ ทิ้งไว้สักครู่เพื่อให้ดูดซับหนองภายใน ใส่ไม้ swab มาในหลอด transport media ให้ปลาย swab อยู่ในวุ้น และนำส่งห้องปฏิบัติการทันที ห้ามแช่เย็น เนื่องจากเชื้อที่เป็นสาเหตุของโรคติดต่อทางเพศสัมพันธ์บางชนิดตายง่ายเมื่อเจอความเย็น',
        bodyEn: 'For a male patient with urethral discharge, express the pus from the urethral opening and use the swab supplied with Amies transport medium. Place the swab in the transport medium with its tip in the gel and deliver immediately. If the pus is scant, collect in the morning before urination, or insert a small swab into the urethral opening briefly to absorb the pus. Place the swab in the medium and deliver immediately. Do not refrigerate because some sexually transmitted pathogens die easily when exposed to cold.',
      },
      {
        labelTh: 'แผลบริเวณอวัยวะสืบพันธุ์', labelEn: 'Genital ulcer',
        bodyTh: 'ผู้ป่วยที่มีแผลบริเวณอวัยวะสืบพันธุ์ สามารถใช้ swab ป้ายบริเวณส่วนฐานของแผล โดยหลีกเลี่ยงการป้ายบริเวณผิวหนังที่ขอบหรือโดยรอบแผล เนื่องจากอาจปนเปื้อน normal biota',
        bodyEn: 'For a patient with a genital ulcer, swab the base of the ulcer and avoid the edge and surrounding skin because these areas may be contaminated with normal biota.',
      },
      {
        labelTh: 'ปากมดลูก', labelEn: 'Cervical swab',
        bodyTh: 'ผู้ป่วยหญิงที่ส่งตรวจเพื่อเพาะเชื้อ gonococcal สามารถเก็บสิ่งส่งตรวจได้ที่บริเวณปากมดลูก โดยใช้ไม้ swab ที่มากับหลอด Amies transport media ป้าย แล้วใส่มาในหลอด transport media ให้ปลาย swab อยู่ในวุ้น และนำส่งห้องปฏิบัติการทันที ควรระวังไม่ให้ swab สัมผัสกับผนังช่องคลอด เนื่องจากอาจทำให้ปนเปื้อน normal biota และไม่ควรป้ายตัวอย่างจากช่องคลอด เนื่องจากไม่ใช่ตำแหน่งในการติดเชื้อ ยกเว้นผู้ป่วยหญิงก่อนวัยเจริญพันธุ์',
        bodyEn: 'For a female patient submitted for gonococcal culture, collect from the cervix using the swab supplied with Amies transport medium. Place it in the transport medium with the tip in the gel and deliver immediately. Prevent the swab from touching the vaginal wall because it may contaminate the specimen with normal biota. Do not collect from the vagina because it is not the usual infection site, except in prepubertal girls.',
      },
      {
        labelTh: 'PID และแผลอวัยวะสืบพันธุ์', labelEn: 'PID and genital wounds',
        bodyTh: 'ผู้ป่วยโรคอุ้งเชิงกรานอักเสบ ควรใช้ swab ทำการเก็บตัวอย่างจากเยื่อบุโพรงมดลูก หรือส่องกล้องเพื่อเก็บหนองหรือสารคัดหลั่งภายในช่องท้อง สำหรับผู้ป่วยที่มีแผลบริเวณอวัยวะสืบพันธุ์ ให้เก็บเหมือนผู้ป่วยชาย',
        bodyEn: 'For pelvic inflammatory disease, collect with a swab from the endometrium, or use laparoscopy to collect pus or discharge from the abdominal cavity. Collect a genital wound specimen as described for a male patient.',
      },
      {
        labelTh: 'Bacterial vaginosis', labelEn: 'Bacterial vaginosis',
        bodyTh: 'ผู้ป่วย bacterial vaginosis มักมีสารคัดหลั่งภายในช่องคลอดที่มีกลิ่นเหม็น สามารถใช้ไม้ swab ที่มากับหลอด Amies transport media ป้าย แล้วใส่มาในหลอด transport media ให้ปลาย swab อยู่ในวุ้น และนำส่งห้องปฏิบัติการทันที',
        bodyEn: 'Patients with bacterial vaginosis often have foul-smelling vaginal discharge. Use the swab supplied with Amies transport medium, place the swab in the medium with the tip in the gel, and deliver immediately.',
      },
    ],
  },
  {
    id: 'body-fluids',
    titleTh: 'CSF และสารน้ำจากร่างกาย',
    titleEn: 'CSF and body fluids',
    items: [
      {
        labelTh: 'CSF', labelEn: 'CSF',
        bodyTh: 'Cerebrospinal fluid (CSF): แพทย์ทำการเก็บตัวอย่างด้วยวิธี Aseptic technique โดยการเจาะหลังในส่วนเอว (Lumbar puncture) ระหว่างกระดูกสันหลัง L3 และ L4 เก็บน้ำไขสันหลังในภาชนะปราศจากเชื้อ โดยทั่วไปจะแบ่งออกเป็น 3 ส่วน ส่วนละ 1–3 มิลลิลิตร และส่วนแรกจะเป็นส่วนที่ใช้สำหรับเพาะเชื้อจุลชีพต่าง ๆ (แบคทีเรีย วัณโรค เชื้อรา) หลังเก็บตัวอย่างเรียบร้อย ปิดฝาให้สนิท หุ้มด้วย parafilm เพื่อป้องกันการรั่วซึม และนำส่งห้องปฏิบัติการทันที ห้ามแช่เย็น',
        bodyEn: 'Cerebrospinal fluid (CSF): the physician collects the specimen aseptically by lumbar puncture between L3 and L4. Collect CSF in a sterile container, generally divided into 3 portions of 1–3 mL. Use the first portion for culture of microorganisms, including bacteria, TB, and fungi. After collection, cap tightly, seal with parafilm to prevent leakage, deliver immediately, and do not refrigerate.',
      },
      {
        labelTh: 'Sterile body fluid', labelEn: 'Sterile body fluid',
        bodyTh: 'Sterile body fluid เช่น น้ำในช่องท้อง น้ำในข้อต่าง ๆ น้ำในช่องเยื่อหุ้มปอด และน้ำในช่องเยื่อหุ้มหัวใจ เป็นต้น แพทย์ทำการเก็บตัวอย่างด้วยวิธี Aseptic technique ใส่ในภาชนะปราศจากเชื้อ หลังเก็บตัวอย่างเรียบร้อย ปิดฝาให้สนิท หุ้มด้วย parafilm เพื่อป้องกันการรั่วซึม และนำส่งห้องปฏิบัติการทันที',
        bodyEn: 'Sterile body fluid, such as abdominal, joint, pleural, or pericardial fluid, is collected by the physician using aseptic technique into a sterile container. After collection, cap tightly, seal with parafilm to prevent leakage, and deliver immediately.',
      },
    ],
  },
  {
    id: 'stool-rectal',
    titleTh: 'อุจจาระและ Rectal swab เพื่อเพาะเชื้อ',
    titleEn: 'Stool and rectal swab for culture',
    items: [
      {
        labelTh: 'อุจจาระ', labelEn: 'Stool',
        bodyTh: 'Stool: ในกรณีผู้ป่วยสามารถถ่ายได้เอง ให้ผู้ป่วยถ่ายอุจจาระลงในภาชนะปากกว้าง ใช้ไม้ swab เก็บตัวอย่างอุจจาระเหลวโดยเลือกบริเวณที่มีมูกเลือดปน จำนวน 2 ไม้ ใส่ใน Amies transport media หรือ Cary Blair transport media ให้ปลาย swab อยู่ในวุ้น และนำส่งห้องปฏิบัติการทันที (ไม่เก็บตัวอย่างอุจจาระที่มีลักษณะเป็นก้อนปกติ เนื่องจากไม่มีอาการบ่งชี้การติดเชื้อในระบบทางเดินอาหาร ยกเว้นกลุ่มคัดกรองการเป็นพาหะ)',
        bodyEn: 'Stool: when the patient can defecate independently, collect stool in a wide-mouth container. Use 2 swabs to collect liquid stool, selecting areas containing mucus or blood. Place them in Amies or Cary Blair transport medium with the swab tips in the gel and deliver immediately. Do not collect normally formed stool because it does not indicate gastrointestinal infection, except for carrier screening.',
      },
      {
        labelTh: 'Rectal swab', labelEn: 'Rectal swab',
        bodyTh: 'Rectal swab: ไม่แนะนำให้เก็บโดยวิธีนี้ ยกเว้นเฉพาะกรณีที่ผู้ป่วยไม่สามารถถ่ายเองได้ หรือเป็นการเก็บในกลุ่มคัดกรองจำนวนมาก เนื่องจากได้ปริมาณตัวอย่างน้อย มีผลต่อความถูกต้องของผลเพาะเชื้อ ทำการเก็บตัวอย่างใส่ใน Amies transport media หรือ Cary Blair transport media โดยจุ่มปลาย swab ในวุ้นก่อนเพื่อเป็นตัวหล่อลื่น สอดปลาย swab เข้าทวารหนักลึกประมาณ 1–2 นิ้ว หมุนไม้รอบ ๆ เพื่อให้ได้ปริมาณตัวอย่างมากที่สุด (swab ที่เก็บได้ดีควรมีตัวอย่างติดอยู่ที่ปลายไม้) เก็บตัวอย่างจำนวน 2 ไม้ ใส่ใน Amies transport media หรือ Cary Blair transport media ให้ปลาย swab อยู่ในวุ้น และนำส่งห้องปฏิบัติการทันที',
        bodyEn: 'Rectal swab: this method is not recommended except when the patient cannot defecate or for large-scale carrier screening, because the small sample volume affects culture accuracy. Collect into Amies or Cary Blair transport medium. Dip the swab tip in the gel as lubricant, insert about 1–2 inches into the rectum, and rotate to obtain as much specimen as possible; a good swab has visible material on its tip. Collect 2 swabs, place them in transport medium with the tips in the gel, and deliver immediately.',
      },
    ],
  },
  {
    id: 'hemoculture',
    titleTh: 'การเก็บเลือดเพื่อส่งตรวจ Hemoculture',
    titleEn: 'Blood culture collection',
    items: [
      {
        labelTh: '1. เตรียมอุปกรณ์', labelEn: '1. Prepare equipment',
        bodyTh: 'สรุปขั้นตอนการเจาะเลือดเพื่อส่งตรวจ Hemoculture: รหัสชุดทดสอบ 185 (H/C 1+2+anaerobe) ใช้ในการเจาะ H/C ครั้งแรก หรือสงสัย Sepsis ด้วย Anaerobic bacteria เตรียมอุปกรณ์ ได้แก่ ขวด aerobic H/C ฝาเทา 2 ขวด ขวด anaerobic H/C ฝาม่วง 1 ขวด และเข็มเจาะ H/C Safety-Lok',
        bodyEn: 'Blood-culture collection summary: test set code 185 (H/C 1+2+anaerobe), used for the first H/C collection or suspected sepsis with anaerobic bacteria. Prepare 2 aerobic H/C bottles with gray caps, 1 anaerobic H/C bottle with a purple cap, and an H/C Safety-Lok needle.',
      },
      {
        labelTh: '2. ระบุข้อมูลบนขวด', labelEn: '2. Label the bottles',
        bodyTh: 'ระบุรายละเอียดลงบนขวด ได้แก่ รายละเอียดผู้ป่วย ลำดับขวด ตำแหน่ง และเวลาที่เจาะ พร้อมขีดปริมาตรเลือดที่เหมาะสม และเช็ดฝาขวดด้วย 70% alcohol',
        bodyEn: 'Record the patient details, bottle sequence, collection site, and collection time on the bottles. Mark the appropriate blood volume and disinfect the bottle caps with 70% alcohol.',
      },
      {
        labelTh: '3. ประกอบชุดเข็ม', labelEn: '3. Assemble the needle set',
        bodyTh: 'ประกอบชุดเข็ม Safety-Lok สำหรับการเจาะเลือดเพื่อส่งตรวจ Hemoculture',
        bodyEn: 'Assemble the Safety-Lok needle set for blood-culture collection.',
      },
      {
        labelTh: '4. ทำความสะอาดผิวหนัง', labelEn: '4. Disinfect the skin',
        bodyTh: 'รัดสาย Tourniquet และเช็ดทำความสะอาดผิวหนังด้วย 70% alcohol และ 2% Chlorhexidine',
        bodyEn: 'Apply the tourniquet and disinfect the skin with 70% alcohol and 2% chlorhexidine.',
      },
      {
        labelTh: '5. เจาะและใส่เลือดลงขวด', labelEn: '5. Collect blood into the bottles',
        bodyTh: 'เจาะเลือดให้ได้ปริมาตรเหมาะสมตามที่ขีดไว้ ตำแหน่งที่หนึ่ง เจาะเลือดใส่ขวด Aerobic (ฝาเทา) ก่อน จากนั้นเจาะเลือดใส่ขวด Anaerobic Lytic (ฝาม่วง) ตำแหน่งที่สอง เจาะเลือดใส่ขวด Aerobic (ฝาเทา) อย่างเดียว',
        bodyEn: 'Collect the volume marked on the bottles. At the first site, draw into the aerobic bottle (gray cap) first, then into the anaerobic Lytic bottle (purple cap). At the second site, draw into the aerobic bottle (gray cap) only.',
      },
      {
        labelTh: '6. หลังเจาะเลือด', labelEn: '6. After collection',
        bodyTh: 'ปลดสาย Tourniquet และถอนเข็มออกจากผิวหนังผู้ป่วย ดึงสายยาง ทำการซ่อนปลายเข็มเพื่อป้องกันอันตราย ปลดเข็มและสายยางลงในถังทิ้งเข็ม',
        bodyEn: 'Release the tourniquet and withdraw the needle from the patient’s skin. Pull the tubing, cover the needle tip to prevent injury, and discard the needle and tubing in the sharps container.',
      },
      {
        labelTh: '7. การนำส่ง', labelEn: '7. Transport',
        bodyTh: 'นำส่งห้องปฏิบัติการโดยเร็วที่สุด หมายเหตุ: BACTEC Anaerobic Lytic/F (ฝาม่วง) และเข็มเจาะ H/C Safety Lok เบิกได้ที่สำนักงานกลุ่มงานเทคนิคการแพทย์ ทุกวันจันทร์ พุธ และศุกร์',
        bodyEn: 'Deliver to the laboratory as quickly as possible. Note: BACTEC Anaerobic Lytic/F (purple cap) and H/C Safety-Lok needles are available from the Medical Technology office on Monday, Wednesday, and Friday.',
      },
    ],
  },
]

// ── Stool Collection ──────────────────────────────────────────────────────────

export const STOOL_STEPS_TH = [
  'ให้ผู้ป่วยทำความสะอาดมือก่อนเก็บอุจจาระ',
  'ถ่ายอุจจาระลงบนกระดาษ หรือภาชนะขนาดใหญ่ที่แห้งและสะอาด',
  'ใช้ช้อนตักอุจจาระจากหลายจุด ปริมาณประมาณ 5 กรัม ใส่กระปุกเก็บอุจจาระ ปิดฝาให้สนิท แล้วล้างมือให้สะอาดอีกครั้ง',
  'นำส่งห้องปฏิบัติการทันทีภายในเวลาไม่เกิน 2 ชั่วโมง หากไม่สามารถนำส่งได้ทันที ควรเก็บไว้ในตู้เย็นอุณหภูมิ 2–8 °C รีบนำส่งภายใน 4 ชั่วโมง',
]

export const STOOL_STEPS_EN = [
  'Patient washes hands thoroughly before collection.',
  'Defecate onto paper or a large clean, dry container — not directly into the toilet.',
  'Use the spoon to collect approximately 5 g of stool from several areas into the stool container. Close the lid tightly, then wash hands again.',
  'Deliver to the lab within 2 hours. If immediate delivery is not possible, refrigerate at 2–8 °C and deliver within 4 hours.',
]

// ── Urine Collection ──────────────────────────────────────────────────────────

export const URINE_SECTIONS = [
  {
    id: '6.1', color: 'var(--primary)', bg: 'var(--primary-soft)',
    titleTh: '6.1 ปัสสาวะที่เก็บครั้งเดียวเวลาใดเวลาหนึ่ง (Random urine)', titleEn: '6.1 Random urine',
    noteTh: 'ปัสสาวะที่เก็บครั้งเดียวเวลาใดเวลาหนึ่ง (Random urine) เหมาะสำหรับใช้ในงานตรวจทางจุลทรรศนศาสตร์และใช้ในการตรวจเบื้องต้นสำหรับผู้ป่วยนอก', noteEn: 'Random urine is suitable for microscopy and preliminary testing for outpatients.',
    stepsTh: [
      '6.1.2.1 ให้ผู้ป่วยทำความสะอาดบริเวณอวัยวะสืบพันธุ์ภายนอก',
      '6.1.2.2 ให้ผู้ป่วยถ่ายปัสสาวะในช่วงแรกทิ้งไปก่อน แล้วเก็บปัสสาวะช่วงกลาง (midstream) ลงในภาชนะเก็บปัสสาวะที่แห้งและสะอาด มีฝาปิด ปัสสาวะในช่วงสุดท้ายทิ้งไป',
      '6.1.2.3 นำปัสสาวะส่งห้องปฏิบัติการทันทีภายในเวลาไม่เกิน 2 ชั่วโมง',
    ] as string[],
    stepsEn: [
      '6.1.2.1 Have the patient clean the external genitalia.',
      '6.1.2.2 Have the patient discard the first stream, collect the midstream in a dry, clean, capped urine container, and discard the last stream.',
      '6.1.2.3 Deliver the urine to the laboratory immediately and within 2 hours.',
    ] as string[],
  },
  {
    id: '6.2', color: '#0891B2', bg: 'rgba(8,145,178,.07)',
    titleTh: '6.2 ปัสสาวะที่เก็บครั้งแรกในตอนเช้า (First morning urine)', titleEn: '6.2 First morning urine',
    noteTh: 'ปัสสาวะที่เก็บครั้งแรกในตอนเช้า (First morning urine) เหมาะสำหรับใช้ในการทดสอบหาเบาหวาน การทดสอบการตั้งครรภ์ และการเพาะเลี้ยงแบคทีเรีย แต่ไม่เหมาะสำหรับการทดสอบทางจุลทรรศนศาสตร์ เนื่องจากปัสสาวะตกค้างอยู่ในกระเพาะปัสสาวะนานหลายชั่วโมง เซลล์ส่วนใหญ่จึงสลายตัว',
    noteEn: 'First morning urine is suitable for diabetes testing, pregnancy testing, and bacterial culture, but is not suitable for microscopy because urine remains in the bladder for many hours and most cells disintegrate.',
    stepsTh: [
      '6.2.2.1 ให้ผู้ป่วยทำความสะอาดบริเวณอวัยวะสืบพันธุ์ภายนอก',
      '6.2.2.2 ให้ผู้ป่วยถ่ายปัสสาวะในช่วงแรกทิ้งไปก่อน แล้วเก็บปัสสาวะช่วงกลาง (midstream) ลงในภาชนะเก็บปัสสาวะที่แห้งและสะอาด มีฝาปิด ปัสสาวะในช่วงสุดท้ายทิ้งไป',
      '6.2.2.3 นำปัสสาวะส่งห้องปฏิบัติการทันทีภายในเวลาไม่เกิน 2 ชั่วโมง',
    ] as string[],
    stepsEn: [
      '6.2.2.1 Have the patient clean the external genitalia.',
      '6.2.2.2 Have the patient discard the first stream, collect the midstream in a dry, clean, capped urine container, and discard the last stream.',
      '6.2.2.3 Deliver the urine to the laboratory immediately and within 2 hours.',
    ] as string[],
  },
  {
    id: '6.3', color: '#7C3AED', bg: 'rgba(124,58,237,.07)',
    titleTh: '6.3 ปัสสาวะที่เก็บ 24 ชั่วโมง', titleEn: '6.3 24-hour urine',
    noteTh: 'ปัสสาวะที่เก็บ 24 ชั่วโมงมักใช้ในการตรวจเกี่ยวกับระบบเมตาบอลิซึมของร่างกาย การตรวจหาสารต่าง ๆ หลายชนิด เช่น Urea, Creatinine, Glucose, Protein, Electrolyte และฮอร์โมนต่าง ๆ เนื่องจากสารต่าง ๆ เหล่านี้มีการขับถ่ายทางปัสสาวะระหว่างวันไม่เท่ากัน การหาปริมาณโดยใช้ปัสสาวะ 24 ชั่วโมงจะให้ค่าที่คงที่และถูกต้องแน่นอนกว่า มักใช้ในงานตรวจทางเคมีคลินิก',
    noteEn: 'Twenty-four-hour urine is used for metabolic studies and measurement of Urea, Creatinine, Glucose, Protein, Electrolytes, and hormones. Excretion varies throughout the day, so a 24-hour collection provides a more constant and accurate quantity and is commonly used in clinical chemistry.',
    stepsTh: [
      '6.3.2.1 ก่อนนับเวลาให้ปัสสาวะทิ้งไปให้หมด และเริ่มนับเวลา โดยจดเวลาที่เริ่มเก็บ',
      '6.3.2.2 หลังจากนั้นให้เก็บปัสสาวะที่ถ่ายทั้งหมดใส่ภาชนะที่เตรียมให้จนครบ 24 ชั่วโมง เช่น เริ่มเก็บเวลา 08.00 น. เวลาสิ้นสุดคือ 08.00 น. ของวันรุ่งขึ้น และเก็บปัสสาวะครั้งสุดท้ายก่อนสิ้นสุดเวลา 08.00 น.',
      'หมายเหตุ: ปัสสาวะที่เก็บได้ทั้งหมดในแต่ละครั้งให้แช่ในตู้เย็นอุณหภูมิ 4 องศาเซลเซียส หรือเก็บขวดปัสสาวะในกล่องโฟมที่แช่น้ำแข็งไว้ตลอดเวลา',
      '6.3.2.3 เมื่อเก็บปัสสาวะครบเวลา 24 ชั่วโมงแล้ว ให้นำส่งห้องปฏิบัติการทันทีหรือภายในเวลาไม่เกิน 2 ชั่วโมง',
    ] as string[],
    stepsEn: [
      '6.3.2.1 Before starting the timed collection, void completely and discard the urine. Start timing and record the start time.',
      '6.3.2.2 Collect all urine passed into the prepared container for 24 hours. For example, if collection starts at 08:00, it ends at 08:00 the next day; collect the final urine just before 08:00.',
      'Note: Refrigerate every collected portion at 4 °C, or keep the urine container in a foam box with ice throughout the collection period.',
      '6.3.2.3 After 24 hours, deliver to the laboratory immediately or within 2 hours.',
    ] as string[],
  },
]

export const SEMEN_STEPS_TH = [
  '13.1 ให้งดการร่วมเพศ 2–3 วัน (ไม่เกิน 7 วัน)',
  '13.2 ควรงดยาทุกประเภท 7 วันก่อนการเก็บ',
  '13.3 การเก็บน้ำอสุจิให้เก็บโดยใช้ขวดแก้วปากกว้างที่แห้งและสะอาด มีฝาปิดสนิท น้ำอสุจิต้องเก็บให้หมดทุกครั้งที่มีการหลั่ง ถ้าเก็บไม่หมดห้ามนำมาทดสอบ โดยเฉพาะส่วนที่ออกมาครั้งแรกจะมีตัวอสุจิมาก',
  '13.4 นำส่งห้องปฏิบัติการภายในเวลา 1 ชั่วโมง ห้ามแช่เย็นน้ำอสุจิ',
  '13.5 ภาชนะที่ใส่น้ำอสุจิต้องเขียนชื่อ–สกุลผู้ป่วย วันเวลาที่เก็บให้ชัดเจน',
  'หมายเหตุ: การเก็บน้ำอสุจิส่งตรวจควรเก็บ 2 ครั้ง โดยให้แต่ละครั้งห่างกัน 7 วัน แต่ไม่เกิน 3 เดือน',
]

export const SEMEN_STEPS_EN = [
  '13.1 Abstain from sexual intercourse for 2–3 days, and not more than 7 days.',
  '13.2 Avoid all medications for 7 days before collection.',
  '13.3 Collect semen by masturbation into a wide-mouth, dry, clean glass bottle with a tight lid. Collect the entire ejaculate every time; if it is incomplete, do not submit it for testing. The first portion contains the highest number of sperm.',
  '13.4 Deliver to the laboratory within 1 hour. Do not refrigerate the semen.',
  '13.5 Clearly write the patient name and surname and the collection date and time on the semen container.',
  'Note: Semen for testing should be collected twice, with 7 days between collections and no more than 3 months between collections.',
]
