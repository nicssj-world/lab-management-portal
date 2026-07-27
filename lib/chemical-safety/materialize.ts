import { parseThaiGhsTextOrThrow, type ThaiGhsHazardClass } from './ghs'
import type { MasterlistNormalizedProposal, MasterlistRawRow } from './import/masterlist-june-2026'
import { CHEMICAL_PREP_LOCATIONS, CHEMICAL_ROOM_NAME_TH } from './storage-manifest'
import type { GhsPictogramCode, QuantityUnit, SdsMatchStatus } from './types'

const UNIT_BY_SOURCE: Record<string, { code: string; nameTh: string }> = {
  'กลุ่มงานเทคนิคฯ': { code: 'TECHMED', nameTh: 'กลุ่มงานเทคนิคการแพทย์' },
  'โลหิตวิทยา/ภูมิคุ้มกันวิทยา': { code: 'HEMA-IMMUNO', nameTh: 'โลหิตวิทยา/ภูมิคุ้มกันวิทยา' },
  'จุลชีววิทยา': { code: 'MICRO', nameTh: 'จุลชีววิทยา' },
  'ภูมิคุ้มกันวิทยา': { code: 'IMMUNO', nameTh: 'ภูมิคุ้มกันวิทยา' },
  'โลหิตวิทยา': { code: 'HEMA', nameTh: 'โลหิตวิทยา' },
}

export interface ChemicalMaterializationProduct {
  rowNo: number
  canonicalName: string
  sourceName: string
  unitCode: string
  positionCode: string
  packageValue: number
  packageUnit: QuantityUnit
  currentContainerCount: number
  minimumStock: number
  reportedTotalRaw: string
  calculatedTotalValue: number
  calculatedTotalUnit: QuantityUnit
  quantityConflict: boolean
  publicEligible: boolean
  /** ข้อความจำแนกภาษาไทยจาก master list เก็บไว้เพื่อสอบกลับได้ว่าสัญลักษณ์มาจากไหน */
  ghsSourceText: string
  ghsPictogramCodes: GhsPictogramCode[]
  ghsHazardClasses: ThaiGhsHazardClass[]
}

export interface ChemicalMasterlistMaterializationPlan {
  room: { code: string; nameTh: string }
  locations: Array<{ code: string; zoneCode: string; locationKind: string; displayOrder: number }>
  units: Array<{ code: string; nameTh: string }>
  products: ChemicalMaterializationProduct[]
}

export interface ChemicalMaterializationEvidence {
  rowNo: number
  matchStatus: SdsMatchStatus
  fileId: string | null
}

export interface ChemicalMaterializationDatabase {
  ensureUnit(input: { code: string; nameTh: string }): Promise<string>
  ensureRoom(input: { code: string; nameTh: string }): Promise<string>
  ensureLocation(
    roomId: string,
    input: { code: string; zoneCode: string; locationKind: string; displayOrder: number },
  ): Promise<string>
  ensureProduct(input: ChemicalMaterializationProduct): Promise<string>
  ensureAlias(productId: string, alias: string): Promise<void>
  ensureUnitProduct(
    productId: string,
    unitId: string,
    preferredName: string,
    publicEligible: boolean,
  ): Promise<void>
  ensureHolding(
    productId: string,
    unitId: string,
    locationId: string,
    input: ChemicalMaterializationProduct,
  ): Promise<void>
  linkImportRow(batchId: string, rowNo: number, productId: string): Promise<void>
  ensureDraftSds(productId: string, fileId: string): Promise<void>
}

export function buildChemicalMasterlistMaterializationPlan(
  rows: readonly MasterlistRawRow[],
  proposals: readonly MasterlistNormalizedProposal[],
): ChemicalMasterlistMaterializationPlan {
  if (rows.length !== proposals.length) throw new Error('Masterlist row and proposal counts differ')

  const units = new Map<string, { code: string; nameTh: string }>()
  const products = rows.map((row, index) => {
    const proposal = proposals[index]
    if (!proposal || proposal.rawRowNo !== row.no) throw new Error(`Masterlist proposal is not aligned with row ${row.no}`)
    const unit = UNIT_BY_SOURCE[row.responsibleUnitRaw]
    if (!unit) throw new Error(`Unsupported responsible unit: ${row.responsibleUnitRaw}`)
    const firstPackage = proposal.packageParts[0]
    if (!firstPackage) throw new Error(`Missing package quantity for row ${row.no}`)
    const minimumStock = Number(row.minimumStockRaw)
    if (!Number.isFinite(minimumStock) || minimumStock < 0) throw new Error(`Invalid minimum stock for row ${row.no}`)
    units.set(unit.code, unit)

    // ล้มทั้งงานถ้าแปลข้อความ GHS ไม่ออก — ข้อมูลนี้ถูกใช้เป็นข้อมูลจริงบนหน้าสาธารณะ
    // จึงยอมให้ขาดหายแบบเงียบ ๆ ไม่ได้
    const ghs = parseThaiGhsTextOrThrow(row.rawGhsText, `masterlist row ${row.no} (${row.chemicalName})`)

    return {
      rowNo: row.no,
      canonicalName: proposal.chemicalName,
      sourceName: row.chemicalName,
      unitCode: unit.code,
      positionCode: proposal.currentPositionCode,
      packageValue: firstPackage.value,
      packageUnit: firstPackage.unit,
      currentContainerCount: proposal.packageParts.reduce((sum, part) => sum + part.count, 0),
      minimumStock,
      reportedTotalRaw: row.reportedTotalRaw,
      calculatedTotalValue: proposal.calculatedTotal.value,
      calculatedTotalUnit: proposal.calculatedTotal.unit,
      quantityConflict: proposal.quantityConflict,
      publicEligible: true,
      ghsSourceText: row.rawGhsText,
      ghsPictogramCodes: ghs.pictogramCodes,
      ghsHazardClasses: ghs.hazardClasses,
    }
  })

  return {
    room: { code: 'chemical-prep', nameTh: CHEMICAL_ROOM_NAME_TH },
    locations: CHEMICAL_PREP_LOCATIONS.map(location => ({ ...location })),
    units: [...units.values()],
    products,
  }
}

export async function materializeChemicalMasterlist(
  batchId: string,
  plan: ChemicalMasterlistMaterializationPlan,
  evidence: readonly ChemicalMaterializationEvidence[],
  database: ChemicalMaterializationDatabase,
): Promise<void> {
  const unitIds = new Map<string, string>()
  for (const unit of plan.units) unitIds.set(unit.code, await database.ensureUnit(unit))

  const roomId = await database.ensureRoom(plan.room)
  const locationIds = new Map<string, string>()
  for (const location of plan.locations) {
    locationIds.set(location.code, await database.ensureLocation(roomId, location))
  }

  const evidenceByRow = new Map(evidence.map(item => [item.rowNo, item]))
  for (const product of plan.products) {
    const unitId = unitIds.get(product.unitCode)
    const locationId = locationIds.get(product.positionCode)
    if (!unitId) throw new Error(`Materialization unit is missing: ${product.unitCode}`)
    if (!locationId) throw new Error(`Materialization location is missing: ${product.positionCode}`)

    const productId = await database.ensureProduct(product)
    if (product.sourceName !== product.canonicalName) await database.ensureAlias(productId, product.sourceName)
    await database.ensureUnitProduct(productId, unitId, product.canonicalName, product.publicEligible)
    await database.ensureHolding(productId, unitId, locationId, product)
    await database.linkImportRow(batchId, product.rowNo, productId)

    const linkedEvidence = evidenceByRow.get(product.rowNo)
    if (linkedEvidence?.matchStatus === 'candidate' && linkedEvidence.fileId) {
      await database.ensureDraftSds(productId, linkedEvidence.fileId)
    }
  }
}
