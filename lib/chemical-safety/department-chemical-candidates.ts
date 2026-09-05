export interface ChemicalCandidateProduct {
  id: string
  lifecycleStatus: string
}

export interface ChemicalCandidateHolding {
  productId: string
  storageScope: 'room' | 'department'
}

export function hasDepartmentChemicalHolding(
  productId: string,
  holdings: ChemicalCandidateHolding[],
): boolean {
  return holdings.some(holding => holding.productId === productId && holding.storageScope === 'department')
}

export function filterDepartmentChemicalCandidates<T extends ChemicalCandidateProduct>(
  products: T[],
  holdings: ChemicalCandidateHolding[],
): T[] {
  return products.filter(product => (
    product.lifecycleStatus === 'active'
    && hasDepartmentChemicalHolding(product.id, holdings)
  ))
}
