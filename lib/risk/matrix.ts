// ตรรกะของตารางความเสี่ยง (โอกาสเกิด × ผลกระทบ) แยกออกจากการวาด
// เพื่อให้เขียนเทสต์ครอบได้โดยไม่ต้องพึ่ง DOM และให้หน้าจอกับ PDF ใช้ตัวคำนวณเดียวกัน
// ตัวเลขในไฟล์ที่ export จึงตรงกับที่เห็นบนจอเสมอ

export const MATRIX_SIZE = 5

/** โอกาสเกิด 1→5 จากซ้ายไปขวา */
export const MATRIX_COLS = [1, 2, 3, 4, 5] as const
/** ผลกระทบ 5→1 จากบนลงล่าง — ความเสี่ยงสูงอยู่มุมขวาบนตามธรรมเนียม */
export const MATRIX_ROWS = [5, 4, 3, 2, 1] as const

/**
 * ช่วงคะแนนต้องตรงกับ generated column `level` ใน scripts/risk-module-v2.sql
 * ถ้าแก้ที่นี่ต้องแก้ทั้ง SQL และ riskLevel() ใน components/risk/shared/tokens.ts
 */
export const MATRIX_BANDS = [
  { min: 15, max: 25, label: 'สูงมาก', token: 'var(--danger)' },
  { min: 8, max: 14, label: 'สูง', token: 'var(--warning)' },
  { min: 4, max: 7, label: 'ปานกลาง', token: 'var(--success)' },
  { min: 1, max: 3, label: 'ต่ำ', token: 'var(--muted)' },
] as const

export type MatrixBand = (typeof MATRIX_BANDS)[number]

export function bandFor(score: number | null | undefined): MatrixBand | null {
  if (!score || score < 1) return null
  return MATRIX_BANDS.find(b => score >= b.min) ?? null
}

export type MatrixView = 'inherent' | 'residual' | 'movement'

export type MatrixRisk = {
  id: string
  name: string
  status: string
  likelihood: number | null
  impact: number | null
  residualLikelihood: number | null
  residualImpact: number | null
}

export type MatrixPoint = { likelihood: number; impact: number }

/** พิกัดของรายการในมุมมองที่กำหนด — คืน null เมื่อยังประเมินไม่ครบ */
export function pointFor(risk: MatrixRisk, view: 'inherent' | 'residual'): MatrixPoint | null {
  const likelihood = view === 'residual' ? risk.residualLikelihood : risk.likelihood
  const impact = view === 'residual' ? risk.residualImpact : risk.impact
  if (!likelihood || !impact) return null
  return { likelihood, impact }
}

export function scoreOf(point: MatrixPoint | null) {
  return point ? point.likelihood * point.impact : null
}

export type MatrixCell = {
  likelihood: number
  impact: number
  score: number
  band: MatrixBand
  risks: MatrixRisk[]
}

/**
 * จัดรายการลงช่อง 5×5 ตามมุมมองที่เลือก
 * เรียงจากผลกระทบสูงลงต่ำ เพื่อให้ index ตรงกับลำดับแถวที่วาดบนหน้าจอ
 */
export function cellsFor(risks: MatrixRisk[], view: 'inherent' | 'residual'): MatrixCell[] {
  return MATRIX_ROWS.flatMap(impact =>
    MATRIX_COLS.map(likelihood => {
      const score = likelihood * impact
      return {
        likelihood,
        impact,
        score,
        band: bandFor(score)!,
        risks: risks.filter(risk => {
          const point = pointFor(risk, view)
          return point?.likelihood === likelihood && point.impact === impact
        }),
      }
    }),
  )
}

export type Movement = 'improved' | 'unchanged' | 'worsened' | 'unassessed'

/**
 * ทิศทางการเปลี่ยนแปลงหลังทำมาตรการ
 * ใช้เกณฑ์เดียวกับป้าย ลดลง/เท่าเดิม/สูงขึ้น ใน RegisterDetailModal (ResidualSection)
 * เพื่อไม่ให้ตารางกับหน้ารายละเอียดตอบไม่ตรงกัน
 */
export function movementOf(risk: MatrixRisk): Movement {
  const before = scoreOf(pointFor(risk, 'inherent'))
  const after = scoreOf(pointFor(risk, 'residual'))
  if (!before || !after) return 'unassessed'
  if (after < before) return 'improved'
  if (after > before) return 'worsened'
  return 'unchanged'
}

export const MOVEMENT_META: Record<Movement, { label: string; token: string }> = {
  improved: { label: 'ลดลง', token: 'var(--success)' },
  unchanged: { label: 'เท่าเดิม', token: 'var(--warning)' },
  worsened: { label: 'สูงขึ้น', token: 'var(--danger)' },
  unassessed: { label: 'ยังไม่ประเมิน', token: 'var(--muted)' },
}

export function movementSummary(risks: MatrixRisk[]): Record<Movement, number> {
  const counts: Record<Movement, number> = { improved: 0, unchanged: 0, worsened: 0, unassessed: 0 }
  for (const risk of risks) counts[movementOf(risk)] += 1
  return counts
}

export type MovementFlow = {
  from: MatrixPoint
  to: MatrixPoint
  count: number
  movement: Movement
  /** ต้นทางกับปลายทางเป็นช่องเดียวกัน — ไม่มีระยะให้ลากเส้น */
  inPlace: boolean
}

/**
 * รวมการเคลื่อนเป็น "เส้นทาง" แทนที่จะเป็นเส้นต่อรายการ
 *
 * ถ้าลาก 1 เส้นต่อ 1 ความเสี่ยง จำนวนเส้นจะโตตามขนาดทะเบียนจนอ่านไม่ได้
 * (ทะเบียน 150 รายการ = 150 เส้นบนตาราง 25 ช่อง) การรวมตามคู่ช่องทำให้จำนวนเส้น
 * โตตามจำนวนเส้นทางที่ต่างกันแทน ซึ่งในทางปฏิบัติกระจุกอยู่ไม่กี่แบบ
 *
 * คู่ช่องเดียวกันมีคะแนนเดียวกันเสมอ ทิศทางของทั้งกลุ่มจึงเหมือนกันแน่นอน
 */
export function movementFlows(risks: MatrixRisk[]): MovementFlow[] {
  const byPair = new Map<string, MovementFlow>()

  for (const risk of risks) {
    const from = pointFor(risk, 'inherent')
    const to = pointFor(risk, 'residual')
    if (!from || !to) continue

    const key = `${from.likelihood},${from.impact}>${to.likelihood},${to.impact}`
    const existing = byPair.get(key)
    if (existing) {
      existing.count += 1
      continue
    }

    byPair.set(key, {
      from,
      to,
      count: 1,
      movement: movementOf(risk),
      inPlace: from.likelihood === to.likelihood && from.impact === to.impact,
    })
  }

  // เส้นที่มีรายการมากวาดทีหลังเพื่อให้อยู่บนสุด ไม่ถูกเส้นบางบัง
  return Array.from(byPair.values()).sort((a, b) => a.count - b.count)
}

/** จำนวนรายการที่ประเมินครบทั้งก่อนและหลัง — ที่เหลือไม่มีเส้นให้ลาก */
export function assessedCount(risks: MatrixRisk[]) {
  return risks.filter(r => pointFor(r, 'inherent') && pointFor(r, 'residual')).length
}

/** ความหนาเส้นตามจำนวนรายการ มีเพดานเพื่อไม่ให้เส้นเดียวกลืนทั้งตาราง */
export function flowStrokeWidth(count: number) {
  return Math.min(8, 2 + (count - 1) * 1.2)
}

/** ตำแหน่งกึ่งกลางช่องเป็นเปอร์เซ็นต์ของพื้นที่ข้อมูล ใช้วาง SVG โดยไม่ต้องวัดขนาดจริง */
export function cellCenterPercent(point: MatrixPoint) {
  return {
    x: ((point.likelihood - 0.5) / MATRIX_SIZE) * 100,
    y: ((MATRIX_SIZE - point.impact + 0.5) / MATRIX_SIZE) * 100,
  }
}

export const MATRIX_VIEW_LABELS: Record<MatrixView, string> = {
  inherent: 'ก่อนมาตรการ',
  residual: 'หลังมาตรการ',
  movement: 'การเคลื่อน',
}

export function isMatrixView(value: string | null | undefined): value is MatrixView {
  return value === 'inherent' || value === 'residual' || value === 'movement'
}
