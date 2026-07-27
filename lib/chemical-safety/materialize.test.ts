import assert from 'node:assert/strict'

import {
  JUNE_2026_MASTERLIST_ROWS,
  buildJune2026NormalizedProposals,
} from './import/masterlist-june-2026'
import {
  buildChemicalMasterlistMaterializationPlan,
  materializeChemicalMasterlist,
  type ChemicalMaterializationDatabase,
} from './materialize'

const proposals = buildJune2026NormalizedProposals(JUNE_2026_MASTERLIST_ROWS)
const plan = buildChemicalMasterlistMaterializationPlan(JUNE_2026_MASTERLIST_ROWS, proposals)

assert.equal(plan.room.code, 'chemical-prep')
assert.equal(plan.locations.length, 13)
assert.equal(plan.units.length, 5)
assert.equal(plan.products.length, 25)
assert.equal(plan.products.filter(item => item.quantityConflict).length, 5)
assert.ok(plan.products.every(item => item.publicEligible))

assert.deepEqual(
  plan.products.map(item => item.rowNo),
  Array.from({ length: 25 }, (_, index) => index + 1),
)
assert.deepEqual(
  plan.products.find(item => item.rowNo === 1),
  {
    rowNo: 1,
    canonicalName: '70% Alcohol',
    sourceName: '70 % alcohol',
    unitCode: 'TECHMED',
    positionCode: 'A1',
    packageValue: 450,
    packageUnit: 'mL',
    currentContainerCount: 11,
    minimumStock: 11,
    reportedTotalRaw: '4,950 มิลลิลิตร',
    calculatedTotalValue: 4.95,
    calculatedTotalUnit: 'L',
    quantityConflict: false,
    publicEligible: true,
    ghsSourceText: JUNE_2026_MASTERLIST_ROWS[0].rawGhsText,
    ghsPictogramCodes: ['GHS02', 'GHS07'],
    ghsHazardClasses: [
      { classTh: 'พิษเฉียบพลัน (มีความเป็นพิษต่ำ)', classEn: 'Acute toxicity — low' },
      { classTh: 'ก๊าซไวไฟ', classEn: 'Flammable' },
    ],
  },
)
assert.deepEqual(
  plan.products.find(item => item.rowNo === 13),
  {
    rowNo: 13,
    canonicalName: 'Formic acid',
    sourceName: 'Formic acid',
    unitCode: 'MICRO',
    positionCode: 'B3',
    packageValue: 2.5,
    packageUnit: 'L',
    currentContainerCount: 2,
    minimumStock: 1,
    reportedTotalRaw: '2.5 ลิตร',
    calculatedTotalValue: 3.5,
    calculatedTotalUnit: 'L',
    quantityConflict: true,
    publicEligible: true,
    ghsSourceText: JUNE_2026_MASTERLIST_ROWS[12].rawGhsText,
    ghsPictogramCodes: ['GHS02', 'GHS05', 'GHS06'],
    ghsHazardClasses: [
      { classTh: 'พิษเฉียบพลัน (มีความเป็นพิษสูง)', classEn: 'Acute toxicity — high' },
      { classTh: 'สารที่กัดกร่อนโลหะ', classEn: 'Corrosive to metals' },
      { classTh: 'ก๊าซไวไฟ', classEn: 'Flammable' },
    ],
  },
)

// ทุกสารต้องได้การจำแนก GHS จาก master list — ถ้าแปลไม่ออกต้องล้มตั้งแต่สร้างแผน
assert.ok(plan.products.every(item => item.ghsHazardClasses.length > 0))
// Sodium acetate จำแนกเป็น "ของแข็งไม่กำหนดประเภท" จึงไม่มีสัญลักษณ์ แต่ต้องมีการจำแนก
const sodiumAcetate = plan.products.find(item => item.rowNo === 21)
assert.deepEqual(sodiumAcetate?.ghsPictogramCodes, [])
assert.deepEqual(sodiumAcetate?.ghsHazardClasses.map(item => item.classTh), ['ของแข็งไม่กำหนดประเภท'])

assert.throws(
  () => buildChemicalMasterlistMaterializationPlan(JUNE_2026_MASTERLIST_ROWS.slice(0, 24), proposals),
  /row and proposal counts differ/i,
)

class RecordingDatabase implements ChemicalMaterializationDatabase {
  units = new Map<string, string>()
  locations = new Map<string, string>()
  products = new Map<string, string>()
  aliases = new Set<string>()
  unitProducts = new Set<string>()
  holdings = new Set<string>()
  links = new Set<string>()
  drafts = new Set<string>()

  async ensureUnit(input: { code: string }): Promise<string> {
    const id = this.units.get(input.code) ?? `unit-${input.code}`
    this.units.set(input.code, id)
    return id
  }
  async ensureRoom(): Promise<string> { return 'room-chemical-prep' }
  async ensureLocation(_roomId: string, input: { code: string }): Promise<string> {
    const id = this.locations.get(input.code) ?? `location-${input.code}`
    this.locations.set(input.code, id)
    return id
  }
  async ensureProduct(input: { canonicalName: string }): Promise<string> {
    const id = this.products.get(input.canonicalName) ?? `product-${this.products.size + 1}`
    this.products.set(input.canonicalName, id)
    return id
  }
  async ensureAlias(productId: string, alias: string): Promise<void> { this.aliases.add(`${productId}:${alias}`) }
  async ensureUnitProduct(productId: string, unitId: string): Promise<void> { this.unitProducts.add(`${productId}:${unitId}`) }
  async ensureHolding(productId: string, unitId: string, locationId: string): Promise<void> { this.holdings.add(`${productId}:${unitId}:${locationId}`) }
  async linkImportRow(batchId: string, rowNo: number, productId: string): Promise<void> { this.links.add(`${batchId}:${rowNo}:${productId}`) }
  async ensureDraftSds(productId: string, fileId: string): Promise<void> { this.drafts.add(`${productId}:${fileId}`) }
}

async function main() {
  const database = new RecordingDatabase()
  const evidence = plan.products.map(item => ({
    rowNo: item.rowNo,
    matchStatus: item.rowNo <= 13 ? 'candidate' as const : item.rowNo <= 20 ? 'mismatch' as const : 'missing' as const,
    fileId: item.rowNo <= 13 ? `file-${item.rowNo}` : null,
  }))

  await materializeChemicalMasterlist('master-batch', plan, evidence, database)
  await materializeChemicalMasterlist('master-batch', plan, evidence, database)
  assert.equal(database.units.size, 5)
  assert.equal(database.locations.size, 13)
  assert.equal(database.products.size, 25)
  assert.equal(database.unitProducts.size, 25)
  assert.equal(database.holdings.size, 25)
  assert.equal(database.links.size, 25)
  assert.equal(database.drafts.size, 13)
  console.log('chemical safety materialization tests passed')
}

void main()
