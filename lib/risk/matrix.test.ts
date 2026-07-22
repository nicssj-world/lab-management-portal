import assert from 'node:assert/strict'
import {
  MATRIX_BANDS, assessedCount, bandFor, cellsFor, cellCenterPercent, flowStrokeWidth,
  isMatrixView, movementFlows, movementOf, movementSummary, pointFor, scoreOf,
  type MatrixRisk,
} from './matrix'
import { riskLevel } from '@/components/risk/shared/tokens'

function risk(partial: Partial<MatrixRisk> & { id: string }): MatrixRisk {
  return {
    name: 'ทดสอบ', status: 'open',
    likelihood: null, impact: null,
    residualLikelihood: null, residualImpact: null,
    ...partial,
  }
}

// ── bandFor ต้องตรงกับ generated column `level` ใน scripts/risk-module-v2.sql ──
assert.equal(bandFor(25)?.label, 'สูงมาก')
assert.equal(bandFor(15)?.label, 'สูงมาก')   // ขอบล่างของสูงมาก
assert.equal(bandFor(14)?.label, 'สูง')
assert.equal(bandFor(8)?.label, 'สูง')       // ขอบล่างของสูง
assert.equal(bandFor(7)?.label, 'ปานกลาง')
assert.equal(bandFor(4)?.label, 'ปานกลาง')   // ขอบล่างของปานกลาง
assert.equal(bandFor(3)?.label, 'ต่ำ')
assert.equal(bandFor(1)?.label, 'ต่ำ')
assert.equal(bandFor(0), null)
assert.equal(bandFor(null), null)

// ช่วงต้องต่อกันสนิทและครอบคลุม 1–25 โดยไม่ทับกัน — ป้องกันช่องโหว่ตอนแก้ตัวเลข
for (let score = 1; score <= 25; score += 1) {
  const matches = MATRIX_BANDS.filter(b => score >= b.min && score <= b.max)
  assert.equal(matches.length, 1, `คะแนน ${score} ต้องอยู่ในช่วงเดียวเท่านั้น`)
  assert.equal(bandFor(score), matches[0], `bandFor(${score}) ต้องตรงกับช่วงที่ครอบคลุมมัน`)
}

// เกณฑ์เดียวกับ riskLevel ที่ tokens.ts ใช้ตัดสินป้ายระดับ — สองที่ต้องไม่ขัดกัน
const BAND_TO_LEVEL: Record<string, string> = { 'สูงมาก': 'high', 'สูง': 'medium', 'ปานกลาง': 'low', 'ต่ำ': 'low' }
for (let score = 1; score <= 25; score += 1) {
  assert.equal(BAND_TO_LEVEL[bandFor(score)!.label], riskLevel(score), `คะแนน ${score} ต้องได้ระดับตรงกับ riskLevel`)
}

// ── pointFor / scoreOf ─────────────────────────────────────────────────────
const assessed = risk({ id: 'A', likelihood: 4, impact: 5, residualLikelihood: 2, residualImpact: 3 })
assert.deepEqual(pointFor(assessed, 'inherent'), { likelihood: 4, impact: 5 })
assert.deepEqual(pointFor(assessed, 'residual'), { likelihood: 2, impact: 3 })
assert.equal(scoreOf(pointFor(assessed, 'inherent')), 20)
assert.equal(scoreOf(pointFor(assessed, 'residual')), 6)

// ประเมินไม่ครบ = ไม่มีพิกัด ต้องไม่เดาค่าให้
assert.equal(pointFor(risk({ id: 'B', likelihood: 4 }), 'inherent'), null)
assert.equal(pointFor(risk({ id: 'C', impact: 4 }), 'inherent'), null)
assert.equal(scoreOf(null), null)

// ── cellsFor ───────────────────────────────────────────────────────────────
const population = [
  risk({ id: 'R1', likelihood: 4, impact: 5, residualLikelihood: 2, residualImpact: 3 }),
  risk({ id: 'R2', likelihood: 4, impact: 5 }),                                      // ยังไม่ประเมิน residual
  risk({ id: 'R3', likelihood: 1, impact: 1, residualLikelihood: 1, residualImpact: 1 }),
]

const inherentCells = cellsFor(population, 'inherent')
assert.equal(inherentCells.length, 25, 'ต้องได้ครบ 5×5 ช่องเสมอ แม้ช่องว่าง')
assert.equal(inherentCells[0].impact, 5, 'แถวแรกคือผลกระทบสูงสุด')
assert.equal(inherentCells[0].likelihood, 1, 'คอลัมน์แรกคือโอกาสเกิดต่ำสุด')

const inherentHigh = inherentCells.find(c => c.likelihood === 4 && c.impact === 5)!
assert.equal(inherentHigh.risks.length, 2, 'R1 กับ R2 อยู่ช่องเดียวกันก่อนมาตรการ')
assert.equal(inherentHigh.score, 20)
assert.equal(inherentHigh.band.label, 'สูงมาก')

const residualCells = cellsFor(population, 'residual')
assert.equal(residualCells.find(c => c.likelihood === 4 && c.impact === 5)!.risks.length, 0,
  'หลังมาตรการต้องไม่มีใครค้างอยู่ช่องเดิม')
assert.equal(residualCells.find(c => c.likelihood === 2 && c.impact === 3)!.risks.map(r => r.id).join(), 'R1')
// R2 ยังไม่ประเมิน residual จึงต้องไม่โผล่ในมุมมองนี้เลย
assert.equal(residualCells.flatMap(c => c.risks).some(r => r.id === 'R2'), false)

// ── movementOf ─────────────────────────────────────────────────────────────
assert.equal(movementOf(risk({ id: 'x', likelihood: 4, impact: 5, residualLikelihood: 2, residualImpact: 3 })), 'improved')  // 20 → 6
assert.equal(movementOf(risk({ id: 'x', likelihood: 3, impact: 3, residualLikelihood: 3, residualImpact: 3 })), 'unchanged') // 9 → 9
assert.equal(movementOf(risk({ id: 'x', likelihood: 2, impact: 3, residualLikelihood: 4, residualImpact: 5 })), 'worsened')  // 6 → 20
assert.equal(movementOf(risk({ id: 'x', likelihood: 4, impact: 5 })), 'unassessed')
assert.equal(movementOf(risk({ id: 'x' })), 'unassessed')

// คะแนนเท่ากันแต่คนละช่อง (2×6 ไม่มีจริง แต่ 2×3 กับ 3×2 มี) ต้องนับเป็น 'เท่าเดิม'
assert.equal(movementOf(risk({ id: 'x', likelihood: 2, impact: 3, residualLikelihood: 3, residualImpact: 2 })), 'unchanged')

// ── movementSummary ────────────────────────────────────────────────────────
const summary = movementSummary(population)
assert.deepEqual(summary, { improved: 1, unchanged: 1, worsened: 0, unassessed: 1 })
assert.equal(Object.values(summary).reduce((a, b) => a + b, 0), population.length,
  'ผลรวมทุกทิศทางต้องเท่าจำนวนรายการทั้งหมด')

// ── movementFlows ──────────────────────────────────────────────────────────
// นี่คือสิ่งที่ทำให้ตารางยังอ่านได้เมื่อทะเบียนโต — จำนวนเส้นต้องโตตามจำนวน
// "เส้นทางที่ต่างกัน" ไม่ใช่จำนวนความเสี่ยง
const flows = movementFlows(population)
assert.equal(flows.length, 2, 'เฉพาะรายการที่ประเมินครบทั้งสองฝั่งเท่านั้นที่มีเส้นทาง')
assert.equal(assessedCount(population), 2)

// 20 รายการที่เดินเส้นทางเดียวกันต้องยุบเหลือเส้นเดียวที่นับได้ 20
const crowd = Array.from({ length: 20 }, (_, i) =>
  risk({ id: `C${i}`, likelihood: 4, impact: 5, residualLikelihood: 2, residualImpact: 2 }))
const crowdFlows = movementFlows(crowd)
assert.equal(crowdFlows.length, 1, '20 รายการเส้นทางเดียวกันต้องเหลือเส้นเดียว')
assert.equal(crowdFlows[0].count, 20)
assert.equal(crowdFlows[0].movement, 'improved')
assert.equal(crowdFlows[0].inPlace, false)

// เส้นทางต่างกันต้องแยกกัน และเรียงจากน้อยไปมากเพื่อให้เส้นหนาอยู่บนสุดตอนวาด
const mixed = movementFlows([
  ...Array.from({ length: 5 }, (_, i) => risk({ id: `A${i}`, likelihood: 4, impact: 5, residualLikelihood: 2, residualImpact: 2 })),
  ...Array.from({ length: 2 }, (_, i) => risk({ id: `B${i}`, likelihood: 3, impact: 3, residualLikelihood: 1, residualImpact: 1 })),
])
assert.equal(mixed.length, 2)
assert.deepEqual(mixed.map(f => f.count), [2, 5], 'เรียงจากน้อยไปมาก')

// อยู่ช่องเดิม = ไม่มีระยะให้ลากเส้น ต้องทำเครื่องหมายไว้ให้คนวาดรู้
const stayed = movementFlows([
  risk({ id: 'P1', likelihood: 3, impact: 3, residualLikelihood: 3, residualImpact: 3 }),
])
assert.equal(stayed[0].inPlace, true)
assert.equal(stayed[0].movement, 'unchanged')

// คะแนนเท่ากันแต่คนละช่อง ต้องยังเป็นเส้นที่ลากได้
const swapped = movementFlows([
  risk({ id: 'P2', likelihood: 2, impact: 3, residualLikelihood: 3, residualImpact: 2 }),
])
assert.equal(swapped[0].inPlace, false)
assert.equal(swapped[0].movement, 'unchanged')

// ── flowStrokeWidth ────────────────────────────────────────────────────────
assert.equal(flowStrokeWidth(1), 2)
assert.ok(flowStrokeWidth(5) > flowStrokeWidth(2), 'เส้นทางที่มีรายการมากต้องหนากว่า')
assert.equal(flowStrokeWidth(100), 8, 'ต้องมีเพดาน ไม่งั้นเส้นเดียวกลืนทั้งตาราง')

// ── cellCenterPercent ──────────────────────────────────────────────────────
// โอกาสเกิด 1 ผลกระทบ 5 = ช่องซ้ายบนสุด → 10% จากซ้าย, 10% จากบน
assert.deepEqual(cellCenterPercent({ likelihood: 1, impact: 5 }), { x: 10, y: 10 })
// โอกาสเกิด 5 ผลกระทบ 1 = ช่องขวาล่างสุด
assert.deepEqual(cellCenterPercent({ likelihood: 5, impact: 1 }), { x: 90, y: 90 })
// กึ่งกลางตาราง
assert.deepEqual(cellCenterPercent({ likelihood: 3, impact: 3 }), { x: 50, y: 50 })

// ทุกพิกัดต้องอยู่ในกรอบ 0–100 ไม่งั้นเส้นจะหลุดออกนอกตาราง
for (const likelihood of [1, 2, 3, 4, 5]) {
  for (const impact of [1, 2, 3, 4, 5]) {
    const { x, y } = cellCenterPercent({ likelihood, impact })
    assert.ok(x >= 0 && x <= 100, `x ${x} ต้องอยู่ในกรอบ`)
    assert.ok(y >= 0 && y <= 100, `y ${y} ต้องอยู่ในกรอบ`)
  }
}

// ── isMatrixView ───────────────────────────────────────────────────────────
assert.ok(isMatrixView('inherent') && isMatrixView('residual') && isMatrixView('movement'))
assert.ok(!isMatrixView('initial') && !isMatrixView('') && !isMatrixView(null))

console.log('matrix tests passed')
