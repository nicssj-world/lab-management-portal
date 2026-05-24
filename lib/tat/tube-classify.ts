// Blood tube classification — used to filter non-blood draw tests from phlebotomy KPIs.
// Urinalysis/stool/swab records go through the phlebotomy queue but are not real blood draws;
// their phleb_wait_minutes ≈ 0 (staff click confirm+done together), which would skew the average.

const BLOOD_TUBE_KEYWORDS = [
  'edta', 'sst', 'plain', 'clot', 'citrate', 'heparin',
  'sodium citrate', 'lithium', 'serum', 'k2', 'k3', 'gel',
  'purple', 'lavender', 'red', 'gold', 'green', 'blue', 'grey', 'gray',
]

const NON_BLOOD_TUBE_KEYWORDS = [
  'urine', 'ปัสสาวะ',
  'stool', 'อุจจาระ', 'feces',
  'swab', 'สวอบ',
  'sputum', 'เสมหะ',
  'csf', 'น้ำไขสันหลัง',
  'fluid', 'ของเหลว',
  'semen', 'น้ำอสุจิ',
  'tissue', 'ชิ้นเนื้อ',
  'aspirate',
  'nasal', 'nasopharyngeal',
]

export type TubeClass = 'blood' | 'non_blood' | 'unknown'

export function classifyTube(tube: string | null | undefined): TubeClass {
  if (!tube) return 'unknown'
  const t = tube.toLowerCase()
  if (NON_BLOOD_TUBE_KEYWORDS.some(k => t.includes(k))) return 'non_blood'
  if (BLOOD_TUBE_KEYWORDS.some(k => t.includes(k))) return 'blood'
  return 'unknown'
}

// Returns true only for confirmed blood tubes.
// non_blood and unknown → false (excluded from phleb wait / total TAT KPIs).
export function isBloodDraw(tube: string | null | undefined): boolean {
  return classifyTube(tube) === 'blood'
}

// For a panel (comma-separated test names), classify if ANY test is blood.
export function isPanelBloodDraw(tubes: (string | null | undefined)[]): boolean {
  return tubes.some(t => isBloodDraw(t))
}
