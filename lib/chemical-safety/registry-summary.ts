export interface ChemicalRegistrySummaryRow {
  productId: string
  holdingId: string
  storageScope: 'room' | 'department'
}

export interface ChemicalRegistrySummary {
  productCount: number
  registryEntryCount: number
  roomEntryCount: number
  departmentEntryCount: number
}

export function summarizeChemicalRegistry(rows: readonly ChemicalRegistrySummaryRow[]): ChemicalRegistrySummary {
  return {
    productCount: new Set(rows.map(row => row.productId)).size,
    registryEntryCount: new Set(rows.map(row => row.holdingId)).size,
    roomEntryCount: rows.filter(row => row.storageScope === 'room').length,
    departmentEntryCount: rows.filter(row => row.storageScope === 'department').length,
  }
}
