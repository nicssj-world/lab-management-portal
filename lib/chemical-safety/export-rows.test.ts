import assert from 'node:assert/strict'
import { formatChemicalRegistryScopeLabel, formatGhsClassification, toChemicalExportRows, toChemicalPdfRows } from './export-rows'
import type { ChemicalRegistryRow } from './types'

assert.equal(formatGhsClassification(['GHS02'], []), 'ก๊าซไวไฟ')
assert.equal(formatGhsClassification(['GHS05'], []), 'สารกัดกร่อน')

const row = {
  productId: '11111111-1111-4111-8111-111111111111',
  holdingId: '22222222-2222-4222-8222-222222222222',
  publicId: 'CHEM-001',
  canonicalName: 'Acetone',
  aliases: [],
  casNumber: '67-64-1',
  concentration: null,
  storageScope: 'room',
  roomId: '33333333-3333-4333-8333-333333333333',
  locationId: '44444444-4444-4444-8444-444444444444',
  packageValue: null,
  packageUnit: null,
  packageRaw: '500 มิลลิลิตร',
  currentContainerCount: null,
  minimumStock: 2,
  lotNumber: null,
  reportedTotalRaw: '12 ลิตร',
  calculatedTotalValue: null,
  calculatedTotalUnit: null,
  receivedOn: null,
  openedOn: null,
  expiresOn: null,
  effectiveOn: null,
  quantityConflict: false,
  positionCode: 'A1',
  unitId: '55555555-5555-4555-8555-555555555555',
  unitName: 'ห้องปฏิบัติการ',
  sdsStatus: 'approved',
  pictogramCodes: ['GHS05'],
  signalWord: 'Danger',
  hazards: [],
  hStatements: [],
  updatedAt: '2026-08-09T00:00:00.000Z',
  lifecycleStatus: 'retired',
  hasSdsFile: false,
} satisfies ChemicalRegistryRow

assert.deepEqual(toChemicalExportRows([row], new Set([row.holdingId])), [{
  no: '1',
  chemicalName: 'Acetone',
  packingSize: '500 มิลลิลิตร',
  minimumStock: '2',
  totalVolume: '12 ลิตร',
  ghsClassification: 'สารกัดกร่อน',
  status: 'Inactive',
  sdsFile: 'No',
  highlighted: true,
}])

const zeroPackageRow = {
  ...row,
  packageValue: 0,
  packageUnit: 'mL' as const,
  packageRaw: '500 มิลลิลิตร',
}
assert.equal(
  toChemicalExportRows([zeroPackageRow])[0].packingSize,
  '500 มิลลิลิตร',
  'a zero normalized package value must use the survey raw package size when available',
)

assert.equal(toChemicalPdfRows([row], new Set(), true)[0].groupLabel, 'ห้องปฏิบัติการ')
assert.equal(
  formatChemicalRegistryScopeLabel({ unitId: row.unitId }, [row]),
  'ห้องปฏิบัติการ (1 รายการ)',
)

console.log('chemical-safety export rows: ok')
