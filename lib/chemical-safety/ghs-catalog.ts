/**
 * Common GHS Section 2 choices used by the SDS editor.
 *
 * These choices are a typing aid, not a classification engine. The exact
 * classification and wording on the manufacturer's SDS always remains the
 * source of truth, so the editor also keeps a free-form fallback for values
 * that are not in this list.
 */

export interface GhsHazardClassOption {
  className: string
  label: string
  aliases?: readonly string[]
  categories: readonly string[]
}

export interface GhsStatementOption {
  code: string
  text: string
}

const CATEGORIES_1_TO_4 = ['Category 1', 'Category 2', 'Category 3', 'Category 4'] as const

export const GHS_HAZARD_CLASS_OPTIONS: readonly GhsHazardClassOption[] = Object.freeze([
  {
    className: 'Explosives',
    label: 'วัตถุระเบิด · Explosives',
    categories: ['Unstable explosive', 'Division 1.1', 'Division 1.2', 'Division 1.3', 'Division 1.4', 'Division 1.5', 'Division 1.6'],
  },
  {
    className: 'Flammable gases',
    label: 'ก๊าซไวไฟ · Flammable gases',
    aliases: ['ก๊าซไวไฟ', 'Flammable'],
    categories: ['Category 1A', 'Category 1B', 'Category 1', 'Category 2'],
  },
  {
    className: 'Aerosols',
    label: 'ละอองลอย · Aerosols',
    categories: ['Category 1', 'Category 2', 'Category 3'],
  },
  {
    className: 'Oxidizing gases',
    label: 'ก๊าซออกซิไดซ์ · Oxidizing gases',
    categories: ['Category 1'],
  },
  {
    className: 'Gases under pressure',
    label: 'ก๊าซภายใต้ความดัน · Gases under pressure',
    categories: ['Compressed gas', 'Liquefied gas', 'Refrigerated liquefied gas', 'Dissolved gas'],
  },
  {
    className: 'Flammable liquids',
    label: 'ของเหลวไวไฟ · Flammable liquids',
    categories: ['Category 1', 'Category 2', 'Category 3', 'Category 4'],
  },
  {
    className: 'Flammable solids',
    label: 'ของแข็งไวไฟ · Flammable solids',
    categories: ['Category 1', 'Category 2'],
  },
  {
    className: 'Self-reactive substances and mixtures',
    label: 'สารและสารผสมที่ทำปฏิกิริยาได้เอง · Self-reactive substances and mixtures',
    categories: ['Type A', 'Type B', 'Type C', 'Type D', 'Type E', 'Type F', 'Type G'],
  },
  {
    className: 'Pyrophoric liquids',
    label: 'ของเหลวลุกติดไฟได้เอง · Pyrophoric liquids',
    categories: ['Category 1'],
  },
  {
    className: 'Pyrophoric solids',
    label: 'ของแข็งลุกติดไฟได้เอง · Pyrophoric solids',
    categories: ['Category 1'],
  },
  {
    className: 'Self-heating substances and mixtures',
    label: 'สารและสารผสมที่ทำให้เกิดความร้อนได้เอง · Self-heating substances and mixtures',
    categories: ['Category 1', 'Category 2'],
  },
  {
    className: 'Substances and mixtures which, in contact with water, emit flammable gases',
    label: 'สารที่สัมผัสน้ำแล้วปล่อยก๊าซไวไฟ · Substances and mixtures which, in contact with water, emit flammable gases',
    categories: ['Category 1', 'Category 2', 'Category 3'],
  },
  {
    className: 'Oxidizing liquids',
    label: 'ของเหลวออกซิไดซ์ · Oxidizing liquids',
    categories: ['Category 1', 'Category 2', 'Category 3'],
  },
  {
    className: 'Oxidizing solids',
    label: 'ของแข็งออกซิไดซ์ · Oxidizing solids',
    categories: ['Category 1', 'Category 2', 'Category 3'],
  },
  {
    className: 'Organic peroxides',
    label: 'ออร์แกนิกเปอร์ออกไซด์ · Organic peroxides',
    categories: ['Type A', 'Type B', 'Type C', 'Type D', 'Type E', 'Type F', 'Type G'],
  },
  {
    className: 'Corrosive to metals',
    label: 'สารกัดกร่อนโลหะ · Corrosive to metals',
    aliases: ['สารที่กัดกร่อนโลหะ'],
    categories: ['Category 1'],
  },
  {
    className: 'Acute toxicity',
    label: 'พิษเฉียบพลัน · Acute toxicity',
    aliases: ['พิษเฉียบพลัน (มีความเป็นพิษสูง)', 'พิษเฉียบพลัน (มีความเป็นพิษต่ำ)', 'Acute toxicity — high', 'Acute toxicity — low'],
    categories: [
      'Oral — Category 1', 'Oral — Category 2', 'Oral — Category 3', 'Oral — Category 4',
      'Dermal — Category 1', 'Dermal — Category 2', 'Dermal — Category 3', 'Dermal — Category 4',
      'Inhalation — Category 1', 'Inhalation — Category 2', 'Inhalation — Category 3', 'Inhalation — Category 4',
      ...CATEGORIES_1_TO_4,
    ],
  },
  {
    className: 'Skin corrosion/irritation',
    label: 'การกัดกร่อน/การระคายเคืองผิวหนัง · Skin corrosion/irritation',
    categories: ['Category 1A', 'Category 1B', 'Category 1C', 'Category 1', 'Category 2'],
  },
  {
    className: 'Serious eye damage/eye irritation',
    label: 'ความเสียหายร้ายแรงต่อดวงตา/การระคายเคืองตา · Serious eye damage/eye irritation',
    categories: ['Category 1', 'Category 2A', 'Category 2B', 'Category 2'],
  },
  {
    className: 'Respiratory or skin sensitization',
    label: 'การทำให้ไวต่อการกระตุ้นของระบบทางเดินหายใจหรือผิวหนัง · Respiratory or skin sensitization',
    categories: ['Category 1', 'Category 1A', 'Category 1B'],
  },
  {
    className: 'Germ cell mutagenicity',
    label: 'การก่อให้เกิดการกลายพันธุ์ของเซลล์สืบพันธุ์ · Germ cell mutagenicity',
    categories: ['Category 1A', 'Category 1B', 'Category 2'],
  },
  {
    className: 'Carcinogenicity',
    label: 'การก่อมะเร็ง · Carcinogenicity',
    categories: ['Category 1A', 'Category 1B', 'Category 2'],
  },
  {
    className: 'Reproductive toxicity',
    label: 'ความเป็นพิษต่อระบบสืบพันธุ์ · Reproductive toxicity',
    categories: ['Category 1A', 'Category 1B', 'Category 2', 'Additional category — effects on or via lactation'],
  },
  {
    className: 'Specific target organ toxicity — single exposure',
    label: 'ความเป็นพิษต่ออวัยวะเป้าหมายจำเพาะเมื่อได้รับครั้งเดียว · STOT — single exposure',
    categories: ['Category 1', 'Category 2', 'Category 3'],
  },
  {
    className: 'Specific target organ toxicity — repeated exposure',
    label: 'ความเป็นพิษต่ออวัยวะเป้าหมายจำเพาะเมื่อได้รับซ้ำ · STOT — repeated exposure',
    categories: ['Category 1', 'Category 2'],
  },
  {
    className: 'Aspiration hazard',
    label: 'อันตรายจากการสำลัก · Aspiration hazard',
    categories: ['Category 1'],
  },
  {
    className: 'Hazardous to the aquatic environment',
    label: 'อันตรายต่อสิ่งแวดล้อมทางน้ำ · Hazardous to the aquatic environment',
    aliases: ['ความเป็นอันตรายต่อสิ่งแวดล้อมทางน้ำ'],
    categories: ['Acute — Category 1', 'Chronic — Category 1', 'Chronic — Category 2', 'Chronic — Category 3', 'Chronic — Category 4'],
  },
  {
    className: 'Hazardous to the ozone layer',
    label: 'อันตรายต่อชั้นโอโซน · Hazardous to the ozone layer',
    categories: ['Category 1'],
  },
  {
    className: 'Solid, not otherwise classified',
    label: 'ของแข็งไม่กำหนดประเภท · Solid, not otherwise classified',
    aliases: ['ของแข็งไม่กำหนดประเภท'],
    categories: ['Not otherwise classified'],
  },
  {
    className: 'Serious health hazard',
    label: 'อันตรายต่อสุขภาพ · Serious health hazard',
    aliases: ['อันตรายต่อสุขภาพ'],
    categories: ['Not otherwise classified'],
  },
])

// Common H statements. The text is a convenient starting value only; the
// editor keeps it editable so the exact SDS wording can be retained.
export const GHS_H_STATEMENT_OPTIONS: readonly GhsStatementOption[] = Object.freeze([
  { code: 'H200', text: 'Unstable explosive' },
  { code: 'H201', text: 'Explosive; mass explosion hazard' },
  { code: 'H202', text: 'Explosive; severe projection hazard' },
  { code: 'H203', text: 'Explosive; fire, blast or projection hazard' },
  { code: 'H204', text: 'Fire or projection hazard' },
  { code: 'H205', text: 'May mass explode in fire' },
  { code: 'H220', text: 'Extremely flammable gas' },
  { code: 'H221', text: 'Flammable gas' },
  { code: 'H222', text: 'Extremely flammable aerosol' },
  { code: 'H223', text: 'Flammable aerosol' },
  { code: 'H224', text: 'Extremely flammable liquid and vapour' },
  { code: 'H225', text: 'Highly flammable liquid and vapour' },
  { code: 'H226', text: 'Flammable liquid and vapour' },
  { code: 'H228', text: 'Flammable solid' },
  { code: 'H240', text: 'Heating may cause an explosion' },
  { code: 'H241', text: 'Heating may cause a fire or explosion' },
  { code: 'H242', text: 'Heating may cause a fire' },
  { code: 'H250', text: 'Catches fire spontaneously if exposed to air' },
  { code: 'H251', text: 'Self-heating; may catch fire' },
  { code: 'H252', text: 'Self-heating in large quantities; may catch fire' },
  { code: 'H260', text: 'In contact with water releases flammable gases which may ignite spontaneously' },
  { code: 'H261', text: 'In contact with water releases flammable gas' },
  { code: 'H270', text: 'May cause or intensify fire; oxidizer' },
  { code: 'H271', text: 'May cause fire or explosion; strong oxidizer' },
  { code: 'H272', text: 'May intensify fire; oxidizer' },
  { code: 'H280', text: 'Contains gas under pressure; may explode if heated' },
  { code: 'H281', text: 'Contains refrigerated gas; may cause cryogenic burns or injury' },
  { code: 'H290', text: 'May be corrosive to metals' },
  { code: 'H300', text: 'Fatal if swallowed' },
  { code: 'H301', text: 'Toxic if swallowed' },
  { code: 'H302', text: 'Harmful if swallowed' },
  { code: 'H304', text: 'May be fatal if swallowed and enters airways' },
  { code: 'H310', text: 'Fatal in contact with skin' },
  { code: 'H311', text: 'Toxic in contact with skin' },
  { code: 'H312', text: 'Harmful in contact with skin' },
  { code: 'H314', text: 'Causes severe skin burns and eye damage' },
  { code: 'H315', text: 'Causes skin irritation' },
  { code: 'H317', text: 'May cause an allergic skin reaction' },
  { code: 'H318', text: 'Causes serious eye damage' },
  { code: 'H319', text: 'Causes serious eye irritation' },
  { code: 'H330', text: 'Fatal if inhaled' },
  { code: 'H331', text: 'Toxic if inhaled' },
  { code: 'H332', text: 'Harmful if inhaled' },
  { code: 'H334', text: 'May cause allergy or asthma symptoms or breathing difficulties if inhaled' },
  { code: 'H335', text: 'May cause respiratory irritation' },
  { code: 'H336', text: 'May cause drowsiness or dizziness' },
  { code: 'H340', text: 'May cause genetic defects' },
  { code: 'H341', text: 'Suspected of causing genetic defects' },
  { code: 'H350', text: 'May cause cancer' },
  { code: 'H350i', text: 'May cause cancer by inhalation' },
  { code: 'H351', text: 'Suspected of causing cancer' },
  { code: 'H360', text: 'May damage fertility or the unborn child' },
  { code: 'H361', text: 'Suspected of damaging fertility or the unborn child' },
  { code: 'H362', text: 'May cause harm to breast-fed children' },
  { code: 'H370', text: 'Causes damage to organs' },
  { code: 'H371', text: 'May cause damage to organs' },
  { code: 'H372', text: 'Causes damage to organs through prolonged or repeated exposure' },
  { code: 'H373', text: 'May cause damage to organs through prolonged or repeated exposure' },
  { code: 'H400', text: 'Very toxic to aquatic life' },
  { code: 'H410', text: 'Very toxic to aquatic life with long lasting effects' },
  { code: 'H411', text: 'Toxic to aquatic life with long lasting effects' },
  { code: 'H412', text: 'Harmful to aquatic life with long lasting effects' },
  { code: 'H413', text: 'May cause long lasting harmful effects to aquatic life' },
  { code: 'H420', text: 'Harms public health and the environment by destroying ozone in the upper atmosphere' },
])

// Common P statements, including the combination codes frequently printed
// together on SDS labels.
export const GHS_P_STATEMENT_OPTIONS: readonly GhsStatementOption[] = Object.freeze([
  { code: 'P101', text: 'If medical advice is needed, have product container or label at hand.' },
  { code: 'P102', text: 'Keep out of reach of children.' },
  { code: 'P103', text: 'Read label before use.' },
  { code: 'P201', text: 'Obtain special instructions before use.' },
  { code: 'P202', text: 'Do not handle until all safety precautions have been read and understood.' },
  { code: 'P210', text: 'Keep away from heat, hot surfaces, sparks, open flames and other ignition sources. No smoking.' },
  { code: 'P220', text: 'Keep/Store away from clothing and other combustible materials.' },
  { code: 'P223', text: 'Do not allow contact with water.' },
  { code: 'P260', text: 'Do not breathe dust/fume/gas/mist/vapours/spray.' },
  { code: 'P261', text: 'Avoid breathing dust/fume/gas/mist/vapours/spray.' },
  { code: 'P264', text: 'Wash ... thoroughly after handling.' },
  { code: 'P270', text: 'Do not eat, drink or smoke when using this product.' },
  { code: 'P271', text: 'Use only outdoors or in a well-ventilated area.' },
  { code: 'P272', text: 'Contaminated work clothing should not be allowed out of the workplace.' },
  { code: 'P273', text: 'Avoid release to the environment.' },
  { code: 'P280', text: 'Wear protective gloves/protective clothing/eye protection/face protection.' },
  { code: 'P284', text: 'Wear respiratory protection.' },
  { code: 'P301+P310', text: 'IF SWALLOWED: Immediately call a POISON CENTER/doctor/...' },
  { code: 'P301+P312', text: 'IF SWALLOWED: Call a POISON CENTER/doctor/... if you feel unwell.' },
  { code: 'P302+P352', text: 'IF ON SKIN: Wash with plenty of water/...' },
  { code: 'P303+P361+P353', text: 'IF ON SKIN (or hair): Take off immediately all contaminated clothing. Rinse skin with water/shower.' },
  { code: 'P304+P340', text: 'IF INHALED: Remove person to fresh air and keep comfortable for breathing.' },
  { code: 'P305+P351+P338', text: 'IF IN EYES: Rinse cautiously with water for several minutes. Remove contact lenses, if present and easy to do. Continue rinsing.' },
  { code: 'P308+P313', text: 'IF exposed or concerned: Get medical advice/attention.' },
  { code: 'P310', text: 'Immediately call a POISON CENTER/doctor/...' },
  { code: 'P312', text: 'Call a POISON CENTER/doctor/... if you feel unwell.' },
  { code: 'P321', text: 'Specific treatment (see ... on this label).' },
  { code: 'P330', text: 'Rinse mouth.' },
  { code: 'P331', text: 'Do NOT induce vomiting.' },
  { code: 'P332+P313', text: 'If skin irritation occurs: Get medical advice/attention.' },
  { code: 'P333+P313', text: 'If skin irritation or rash occurs: Get medical advice/attention.' },
  { code: 'P362+P364', text: 'Take off contaminated clothing and wash it before reuse.' },
  { code: 'P370+P378', text: 'In case of fire: Use ... to extinguish.' },
  { code: 'P391', text: 'Collect spillage.' },
  { code: 'P403+P233', text: 'Store in a well-ventilated place. Keep container tightly closed.' },
  { code: 'P403+P235', text: 'Store in a well-ventilated place. Keep cool.' },
  { code: 'P405', text: 'Store locked up.' },
  { code: 'P501', text: 'Dispose of contents/container to ...' },
])

export function findGhsHazardClassOption(className: string): GhsHazardClassOption | undefined {
  const normalized = className.trim().toLocaleLowerCase('en')
  return GHS_HAZARD_CLASS_OPTIONS.find(option => (
    option.className.toLocaleLowerCase('en') === normalized
    || option.aliases?.some(alias => alias.toLocaleLowerCase('en') === normalized)
  ))
}

export function findGhsStatementOption(
  options: readonly GhsStatementOption[],
  code: string,
): GhsStatementOption | undefined {
  const normalized = code.trim().toUpperCase().replace(/\s+/g, '')
  return options.find(option => option.code.toUpperCase() === normalized)
}
