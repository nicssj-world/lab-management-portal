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
  { th: 'แขนที่กำลังให้ IV — เลือดอาจปนเปื้อน Glucose สูง / Hct ต่ำ',                               en: 'Arm receiving IV — contamination causes falsely high glucose, low Hct.' },
]

export const PATIENT_PREP = [
  { th: 'FBS · น้ำตาลในเลือด',          en: 'Fasting Blood Sugar', prepTh: 'งดอาหารและเครื่องดื่มทุกชนิด ≥ 8 ชั่วโมง (ดื่มน้ำเปล่าได้)',              prepEn: 'NPO ≥ 8 hr (water permitted)' },
  { th: 'Lipid profile · Triglyceride',  en: 'Lipid Profile',       prepTh: 'งดอาหารและเครื่องดื่มทุกชนิด ≥ 12 ชั่วโมง (ดื่มน้ำเปล่าได้)',             prepEn: 'NPO ≥ 12 hr (water permitted)' },
  { th: 'OGTT · ผู้ใหญ่',               en: 'OGTT — Adult',        prepTh: 'NPO ≥ 8 ชม. ดื่ม Glucose 75 g ใน 250–300 mL ภายใน 5 นาที เจาะ 0 ชม. และ 2 ชม.', prepEn: 'NPO ≥ 8 hr. Drink 75 g glucose in 250–300 mL within 5 min. Draw at 0 hr and 2 hr.' },
  { th: 'OGTT · เด็ก',                  en: 'OGTT — Pediatric',    prepTh: 'กลูโคส 1.75 g/kg น้ำหนัก ไม่เกิน 75 g รวม',                               prepEn: 'Glucose 1.75 g/kg, max 75 g total.' },
  { th: 'GCT · หญิงมีครรภ์',            en: 'GCT — Pregnancy',     prepTh: 'ไม่ต้องงดอาหาร ดื่ม Glucose 50 g ใน 100–150 mL ใน 5 นาที เจาะที่ 1 ชม.',     prepEn: 'No fasting. Drink 50 g glucose in 100–150 mL within 5 min. Draw at 1 hr.' },
  { th: 'OGTT · หญิงมีครรภ์',           en: 'OGTT — Pregnancy',    prepTh: 'NPO ≥ 8 ชม. ดื่ม Glucose 100 g เจาะที่ 0, 1, 2, 3 ชม.',                     prepEn: 'NPO ≥ 8 hr. Drink 100 g glucose. Draw at 0, 1, 2, 3 hr.' },
]

// ── Venipuncture ──────────────────────────────────────────────────────────────

export const VENIPUNCTURE_SITES = [
  { num: '1', priority: 'แนะนำ', priorityEn: 'Preferred', th: 'ข้อพับแขน (Antecubital fossa)', en: 'Antecubital fossa', detail: 'Median cubital → Cephalic → Basilic — เลือกตามลำดับ', detailEn: 'Median cubital → Cephalic → Basilic — in order of preference.', color: 'var(--success)', bg: 'rgba(22,163,74,.08)', border: 'rgba(22,163,74,.2)' },
  { num: '2', priority: 'ทางเลือก', priorityEn: 'Alternative', th: 'หลังมือ (Dorsal hand)', en: 'Dorsal hand', detail: 'Metacarpal plexus · Dorsal venous arch', detailEn: 'Metacarpal plexus · Dorsal venous arch', color: '#D97706', bg: 'rgba(217,119,6,.08)', border: 'rgba(217,119,6,.2)' },
  { num: '3', priority: 'สุดท้าย', priorityEn: 'Last resort', th: 'หลังเท้า (Dorsal foot)', en: 'Dorsal foot', detail: 'ใช้เฉพาะกรณีที่เจาะแขนไม่ได้', detailEn: 'Last resort if arms unavailable.', color: 'var(--muted)', bg: 'var(--surface-2)', border: 'var(--border)' },
]

export const VENIPUNCTURE_STEPS_TH = [
  'ชี้บ่งตัวผู้ป่วย: ถามชื่อ-นามสกุล และวัน-เดือน-ปีเกิด ให้ผู้ป่วยตอบเอง · ตรวจชนิดหลอด · ตรวจสติ๊กเกอร์ตรงกับใบนำส่ง',
  'ใช้สำลี 70% แอลกอฮอล์ เช็ดฆ่าเชื้อผิวหนังบริเวณที่จะเจาะ รอให้แห้ง',
  'กรณีเข็มสองปลาย: ปล่อยให้สุญญากาศดูดเลือดจนครบปริมาตร แล้วค่อยๆดึงหลอดออก',
  'กรณีใช้ Syringe: เมื่อได้เลือดครบ แทงเข็มผ่านฝาหลอด ปล่อยให้เลือดไหลเข้าหลอดเอง — ห้ามดัน syringe เพื่อป้องกัน Hemolysis · ใช้ one-hand technique',
  'ห้ามรัดแขนเกิน 2 นาที — หลายค่าจะเปลี่ยนแปลง',
  'พลิกหลอดที่มีสารกันเลือดแข็ง 8–10 ครั้ง แบบ End-over-end inversion · หลอดที่ไม่มีสารกันเลือดแข็ง 3–5 ครั้ง',
]

export const VENIPUNCTURE_STEPS_EN = [
  'Verify identity: ask patient to state name + DOB (have THEM answer). Check tube type matches the order. Confirm label matches request form.',
  'Disinfect the puncture site with 70% alcohol — wait for it to dry.',
  'Vacutainer needle: let vacuum draw blood to the indicator line, then withdraw the tube gently.',
  'Syringe technique: pierce the tube cap and let blood flow in by vacuum — never push the plunger (hemolysis). One-hand technique: tube in rack.',
  'Tourniquet ≤ 2 min — longer values shift many analytes.',
  'Mix anticoagulant tubes 8–10× end-over-end. Clot activator tubes: 3–5× inversion.',
]

// ── Skin Puncture ─────────────────────────────────────────────────────────────

export const SKIN_TYPES = [
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

export const SKIN_STEPS_TH = [
  'ชี้บ่งตัวผู้ป่วยและตรวจสติ๊กเกอร์ให้ตรงกับใบนำส่ง',
  'เช็ดผิวด้วยสำลี 70% แอลกอฮอล์ — รอให้แห้ง',
  'ใช้ lancet เจาะลึก 2–3 มม. ตั้งฉากกับลายนิ้ว — ห้ามบีบ',
  'ใช้สำลีแห้งเช็ดเลือดหยดแรกทิ้ง แล้วเก็บหยดต่อไป',
  'ใช้ Capillary Tube (Sodium Heparin, แถบแดง) วางในมุมฉาก เก็บอย่างน้อย 2 ใน 3 ของหลอด · Mix 3–5 ครั้ง · อุดดินน้ำมันสีขาว',
]

export const SKIN_STEPS_EN = [
  'Verify patient identity and label vs. request form.',
  'Disinfect skin with 70% alcohol and let dry completely.',
  'Lancet puncture 2–3 mm deep, perpendicular to the fingerprint lines. Do NOT squeeze.',
  'Wipe away the first drop with dry gauze; collect from the next drop onward.',
  'Hold a Sodium Heparin capillary (red band) at 90° to the drop — fill at least ⅔. Mix 3–5×. Seal one end with white putty.',
]

// ── Blood Gas ─────────────────────────────────────────────────────────────────

export const ABG_SOURCES = [
  { kind: 'Arterial',   th: 'เลือดจากเส้นเลือดแดง — แนะนำมากที่สุด · บอกค่า PO₂ และภาวะกรด-ด่างที่แท้จริง', en: 'Preferred. Reports true PO₂ and acid-base status.', color: '#DC2626', bg: 'rgba(220,38,38,.07)', badge: '★ แนะนำ', badgeEn: '★ Preferred' },
  { kind: 'Capillary',  th: 'เลือดจากเส้นเลือดฝอย — ใช้ในเด็กเล็ก · ต้องอุ่นบริเวณเจาะก่อน · PO₂ ต่ำกว่า Arterial', en: 'Pediatric use. Pre-warm site. PO₂ runs lower than arterial.', color: '#D97706', bg: 'rgba(217,119,6,.07)', badge: 'เด็กเล็ก', badgeEn: 'Pediatric' },
  { kind: 'Venous',     th: 'เลือดจากเส้นเลือดดำ — ใช้สำหรับ Arteriovenous shunt เป็นหลัก', en: 'Primarily for Arteriovenous shunt studies.', color: '#0891b2', bg: 'rgba(8,145,178,.07)', badge: 'AV shunt', badgeEn: 'AV shunt' },
  { kind: 'Pleural pH', th: 'น้ำเจาะปอด (Pleural fluid) — ส่งตรวจหาค่า pH เฉพาะ', en: 'Pleural fluid — pH analysis only.', color: 'var(--primary)', bg: 'var(--primary-soft)', badge: 'pH only', badgeEn: 'pH only' },
]

export const ABG_SYRINGE_TH = [
  'เตรียม Blood gas syringe (Li-heparin) ให้พร้อม',
  'ชี้บ่งตัวผู้ป่วย และตรวจสติ๊กเกอร์ที่จะติด syringe',
  "เลือกเส้นเลือดแดง: radial (นิยมที่สุด), brachial หรือ femoral · ตรวจการไหลเวียนด้วย modified Allen's test ก่อน",
  'เช็ด 70% แอลกอฮอล์ — รอให้แห้ง',
  'ดูดเลือด แล้วปิดจุกเป็น Closed-system อย่าให้มีฟองอากาศ · Mix หมุน + พลิกฝ่ามือ',
  'นำส่งห้องปฏิบัติการทันที · ระหว่างขนส่งใช้ ice pack ตลอดเวลา',
  'บันทึก อุณหภูมิผู้ป่วย และ FIO₂ ในใบนำส่ง',
]

export const ABG_SYRINGE_EN = [
  'Prepare a Blood Gas syringe (Li-Heparin).',
  'Verify patient identity and the syringe label.',
  "Choose artery: radial (preferred), brachial, or femoral. Perform modified Allen's test first.",
  'Disinfect with 70% alcohol — wait until dry.',
  'Draw blood, cap as closed-system (NO air bubbles). Mix by rolling between palms + inversion.',
  'Deliver immediately. Use an ice pack throughout transport in a labeled biohazard pouch.',
  'Record patient temperature and FIO₂ on the request form.',
]

export const ABG_CAPILLARY_TH = [
  'เตรียม Blood Gas Capillary tube (120 µL · Li-heparin) + จุกยาง 2 อัน + แท่งเหล็ก',
  'ชี้บ่งตัวผู้ป่วย และตรวจสติ๊กเกอร์',
  'อบอุ่นส้นเท้าด้วยน้ำอุ่น ≈ 5 นาที เพื่อกระตุ้นการไหลเวียน · ซับให้แห้ง · จับอุ้งเท้าให้กระชับ',
  'เช็ด 70% แอลกอฮอล์ รอให้แห้ง · ใช้ lancet เจาะลึก 2–3 มม. ตั้งฉาก',
  'รองเลือดให้เต็ม capillary — ระวังไม่ให้มีอากาศแทรก',
  'อุดจุกยาง 1 ข้าง · ใส่แท่งเหล็ก · ปิดจุกอีกข้าง · ใช้แม่เหล็กกลิ้งให้ stirrer เคลื่อน 5–10 ครั้ง',
  'นำส่งทันทีในซองสัญลักษณ์ + ice pack · บันทึก อุณหภูมิ + FIO₂',
]

export const ABG_CAPILLARY_EN = [
  'Prepare a 120 µL Li-Heparin capillary tube + 2 rubber stoppers + iron stirrer rod.',
  'Verify identity and label.',
  'Pre-warm the heel with warm water ≈ 5 min, pat dry, secure the foot firmly.',
  'Disinfect with 70% alcohol, dry. Lancet puncture 2–3 mm at 90°.',
  'Fill capillary completely — avoid air gaps.',
  'Cap one end, insert iron stirrer, cap the other end. Roll a magnet to move the stirrer 5–10× to mix.',
  'Deliver immediately in labeled pouch with ice pack. Record temperature + FIO₂.',
]

// ── Coagulation ───────────────────────────────────────────────────────────────

export const COAG_STEPS_TH = [
  'ชี้บ่งตัวผู้ป่วย — ชื่อ-สกุล และวัน-เดือน-ปีเกิด ให้ผู้ป่วยตอบเอง · ตรวจชนิดหลอด และสติ๊กเกอร์',
  'เช็ดผิว 70% แอลกอฮอล์ — รอให้แห้ง',
  'เจาะใส่หลอด 3.2% Sodium citrate ให้ถึงขีดบอกปริมาตร — ห้ามขาดหรือเกินโดยเด็ดขาด',
  'คว่ำหลอดไปมา 8–10 ครั้ง เพื่อให้เลือดผสมกับสารกันเลือดแข็ง · ระวังอย่าให้เกิดฟอง — จะทำให้ Fibrinogen, FV, FVIII ลดประสิทธิภาพ',
]

export const COAG_STEPS_EN = [
  'Identify patient — full name + DOB stated by the patient. Confirm tube + label match the request.',
  'Disinfect with 70% alcohol — let dry.',
  'Fill the 3.2% sodium citrate tube exactly to the indicator line — NEVER under or over.',
  'Invert 8–10× to mix with anticoagulant. Avoid foam — it degrades Fibrinogen, FV, and FVIII activity.',
]

// ── Microbiology ──────────────────────────────────────────────────────────────

export const MICRO_PRINCIPLES_TH = [
  'ควรเก็บก่อนให้ Antibiotics — หากให้แล้ว ให้เก็บก่อนการให้ครั้งถัดไป เพื่อลดความเข้มข้นใน sample',
  'เลือกเวลาเก็บให้เหมาะกับระยะของโรค (เช่น Typhoid: เลือดในสัปดาห์แรก / อุจจาระในระยะหลัง)',
  'เลือกตำแหน่ง / ปริมาณที่มีโอกาสพบเชื้อสูง',
  'หลีกเลี่ยงการปนเปื้อนของ normal biota — ให้คำแนะนำชัดเจนเมื่อผู้ป่วยเก็บเอง',
  'ใช้ภาชนะปราศจากเชื้อ และ Transport media ที่เหมาะสม',
  'นำส่งโดยเร็วที่สุด — เชื้อบางชนิดตายง่ายเมื่ออยู่นอกร่างกาย',
  'กรอกใบนำส่งให้ครบ + ติดฉลากที่ภาชนะให้ครบ (ชื่อ-สกุล, HN, ตำแหน่งที่เก็บ, เวลาที่เก็บ)',
  'ใช้ aseptic technique ที่เหมาะสมเสมอ — บางการเก็บสามารถนำเชื้อเข้าผู้ป่วยได้',
]

export const MICRO_PRINCIPLES_EN = [
  'Collect BEFORE starting antibiotics — if already on therapy, collect just before the next dose.',
  'Match collection timing to disease stage (e.g., Typhoid: blood in week 1, stool later).',
  'Collect from sites with the highest likelihood of recovery; volume matters.',
  'Avoid normal-biota contamination — give clear instructions if patient self-collects.',
  'Use sterile containers and the correct transport media.',
  'Deliver as fast as possible — some pathogens die rapidly outside the body.',
  'Complete the request form + container label fully (name, HN, source site, time collected).',
  'Always use proper aseptic technique — some collections risk introducing infection.',
]

export const MICRO_TRANSPORTS = [
  { name: 'Cary & Blair',   icon: '🧫', useTh: 'Rectal swab · Stool swab',                       useEn: 'Rectal/Stool swab' },
  { name: 'Amies',           icon: '🧪', useTh: 'Wound · Genital · Throat swab',                   useEn: 'Wound · Genital · Throat swab' },
  { name: 'Sterile cup',    icon: '🥛', useTh: 'Urine culture · Fluid culture · Sputum',          useEn: 'Urine / Fluid / Sputum culture' },
  { name: 'Sterile bottle', icon: '🍶', useTh: 'CSF · Body fluid (cell count, culture)',          useEn: 'CSF / Body fluid (count, culture)' },
  { name: 'Hemoculture',    icon: '🩸', useTh: 'Blood culture aerobic / anaerobic / fungal / TB', useEn: 'Blood culture aerobic / anaerobic / fungal / TB' },
  { name: 'NP swab + VTM',  icon: '💨', useTh: 'COVID PCR · Xpert',                              useEn: 'COVID PCR · Xpert' },
]

export const MICRO_URINE_PATHS = [
  { kind: 'Clean-voided midstream', bodyTh: 'ล้างมือ + ทำความสะอาดอวัยวะเพศ ถ่ายช่วงแรกทิ้ง เก็บช่วงกลาง 15–20 mL', bodyEn: 'Wash hands + genital area. Discard first stream. Collect midstream 15–20 mL.', color: 'var(--primary)', bg: 'var(--primary-soft)' },
  { kind: 'Catheterized', bodyTh: 'clamp ด้านล่าง sampling port 10–15 นาที · เช็ด port ด้วย 70% alcohol หรือ 2% chlorhexidine · ใช้เข็มดูด 15–20 mL', bodyEn: 'Clamp below sampling port 10–15 min. Disinfect port (70% alcohol or 2% chlorhexidine). Aspirate 15–20 mL.', color: '#0891B2', bg: 'rgba(8,145,178,.07)' },
  { kind: 'Intermittent catheter', bodyTh: 'ใส่ถุงมือ aseptic technique ปล่อยช่วงแรกทิ้ง เก็บช่วงกลาง 15–20 mL', bodyEn: 'Gloved, aseptic in-and-out catheter. Discard first stream, collect midstream 15–20 mL.', color: '#7C3AED', bg: 'rgba(124,58,237,.07)' },
]

export const MICRO_SPUTUM = [
  { k: 'Expectorated', th: 'บ้วนปากด้วยน้ำ · หายใจลึก กลั้น · ไอแรงเอาเสมหะออก · บ้วนใน sterile cup โดยให้ปนเปื้อนน้ำลายน้อยที่สุด', en: 'Rinse mouth with water. Deep breath, hold, cough deeply into a sterile cup with minimal saliva.' },
  { k: 'Endotracheal', th: 'aseptic technique · ใส่สายลึกเท่าท่อ ไม่ดูดขณะใส่ · ดูด 5–10 วินาที (≤ 15) · ไม่ดูดขณะดึงสายออก', en: 'Aseptic. Insert to tube depth WITHOUT suction. Suction 5–10 s (≤ 15 s). No suction on withdrawal.' },
  { k: 'BAL', th: 'แพทย์ทำระหว่าง Bronchoscopy — ใส่ 0.9% NaCl ในหลอดลมส่วนปลาย ดูดกลับ · หุ้ม parafilm นำส่งทันที', en: 'Physician procedure during bronchoscopy. Instill 0.9% NaCl distally, re-aspirate. Wrap parafilm, deliver immediately.' },
]

// ── Stool Collection ──────────────────────────────────────────────────────────

export const STOOL_STEPS_TH = [
  'ให้ผู้ป่วยทำความสะอาดมือก่อนเก็บอุจจาระ',
  'ถ่ายอุจจาระลงบนกระดาษ หรือภาชนะขนาดใหญ่ที่แห้งและสะอาด',
  'ใช้ช้อนตักอุจจาระหลายๆจุด ปริมาณอย่างน้อย 2 ช้อนตัก ใส่กระปุกเก็บอุจจาระ ปิดฝาให้สนิท แล้วล้างมือให้สะอาดอีกครั้ง',
  'นำส่งห้องปฏิบัติการทันทีภายในเวลาไม่เกิน 2 ชั่วโมง หากไม่สามารถนำส่งได้ทันที ควรเก็บไว้ในตู้เย็นอุณหภูมิ 2–8 °C รีบนำส่งภายใน 4 ชั่วโมง',
]

export const STOOL_STEPS_EN = [
  'Patient washes hands thoroughly before collection.',
  'Defecate onto paper or a large clean, dry container — not directly into the toilet.',
  'Use the spoon to collect stool from several areas (at least 2 scoops) into the stool container. Close the lid tightly, then wash hands again.',
  'Deliver to the lab within 2 hours. If immediate delivery is not possible, refrigerate at 2–8 °C and deliver within 4 hours.',
]

// ── Urine Collection ──────────────────────────────────────────────────────────

export const URINE_SECTIONS = [
  {
    id: '6.1', color: 'var(--primary)', bg: 'var(--primary-soft)',
    titleTh: 'Random urine — ครั้งเดียวเวลาใดก็ได้', titleEn: 'Random Urine',
    noteTh: 'เหมาะสำหรับงานจุลทรรศนศาสตร์ และการตรวจเบื้องต้นสำหรับผู้ป่วยนอก', noteEn: 'For microscopy and basic outpatient screening.',
    stepsTh: [
      'ผู้ป่วยทำความสะอาดอวัยวะสืบพันธุ์ภายนอก',
      'ถ่ายปัสสาวะช่วงแรกทิ้ง · เก็บช่วงกลาง (midstream) ในภาชนะสะอาดมีฝาปิด · ปัสสาวะช่วงสุดท้ายทิ้ง',
      'นำส่งห้องปฏิบัติการภายใน 2 ชั่วโมง',
    ] as string[],
    stepsEn: [
      'Patient cleans external genitalia.',
      'Discard first stream → collect midstream in clean container → discard last stream.',
      'Deliver within 2 hours.',
    ] as string[],
  },
  {
    id: '6.2', color: '#0891B2', bg: 'rgba(8,145,178,.07)',
    titleTh: 'First morning urine', titleEn: 'First Morning Urine',
    noteTh: 'เหมาะสำหรับ Diabetes screening, Pregnancy test, Urine culture · ไม่เหมาะสำหรับงานจุลทรรศนศาสตร์ เพราะปัสสาวะค้างในกระเพาะปัสสาวะนานทำให้เซลล์สลายตัว',
    noteEn: 'For diabetes screening, pregnancy test, urine culture. NOT for microscopy — overnight bladder retention causes cell lysis.',
    stepsTh: null as string[] | null,
    stepsEn: null as string[] | null,
  },
  {
    id: '6.3', color: '#7C3AED', bg: 'rgba(124,58,237,.07)',
    titleTh: 'ปัสสาวะ 24 ชั่วโมง', titleEn: '24-Hour Urine',
    noteTh: 'ใช้ตรวจระบบเมตาบอลิซึม — Urea, Creatinine, Glucose, Protein, Electrolyte, Hormones — ค่ามีการขับถ่ายต่างกันระหว่างวัน การเก็บ 24 ชม. ให้ค่าที่คงที่แม่นยำกว่า',
    noteEn: 'For metabolic studies — Urea, Creatinine, Glucose, Protein, Electrolyte, Hormones. Excretion varies through the day; 24-hr collection gives a stable, accurate value.',
    stepsTh: [
      'ก่อนนับเวลา: ปัสสาวะทิ้งให้หมด แล้วเริ่มจดเวลา (เช่น 08.00 น.)',
      'เก็บปัสสาวะทุกครั้งใส่ภาชนะที่เตรียมไว้จนครบ 24 ชม. · เก็บครั้งสุดท้ายก่อนเวลาสิ้นสุด (เช่น 08.00 ของวันรุ่งขึ้น)',
      'เก็บภาชนะในตู้เย็น 4 °C หรือกล่องโฟม + น้ำแข็งตลอดเวลา',
      'ครบ 24 ชม. — นำส่งภายใน 2 ชั่วโมง',
    ] as string[],
    stepsEn: [
      'Before timing starts: void completely and discard. Record start time (e.g., 08:00).',
      'Collect EVERY void in the container for 24 hr. Final collection just before end time (next day 08:00).',
      'Refrigerate the container at 4 °C or keep in iced foam box throughout the 24-hour period.',
      'After 24 hr — deliver within 2 hours.',
    ] as string[],
  },
]
