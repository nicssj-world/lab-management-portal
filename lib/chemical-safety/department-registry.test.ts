import assert from 'node:assert/strict'

async function main() {
  const registryModule: any = await import('./department-registry').catch(() => null)
  assert.ok(registryModule, 'department registry matching helper must exist')
  if (!registryModule) return

  const registered = [
    {
      productId: 'product-cd5',
      productName: 'CD5 FITC',
      holdingId: 'holding-cd5',
      unitId: 'unit-biomolecular',
    },
    {
      productId: 'product-tritest',
      productName: 'Tritest CD3/CD4/CD45',
      holdingId: 'holding-tritest',
      unitId: 'unit-biomolecular',
    },
    {
      productId: 'product-hla',
      productName: 'Anti-HLA-DR FITC',
      holdingId: 'holding-hla',
      unitId: 'unit-biomolecular',
    },
    {
      productId: 'product-hla-b5801',
      productName: 'HLA-B5801',
      holdingId: 'holding-hla-b5801',
      unitId: 'unit-biomolecular',
    },
    {
      productId: 'product-facs-lysing',
      productName: 'FACSlysing solution',
      holdingId: 'holding-facs-lysing',
      unitId: 'unit-biomolecular',
    },
    {
      productId: 'product-liquichek-level-1',
      productName: 'Liquichek Urinalysis Control, Level 1',
      holdingId: 'holding-liquichek-level-1',
      unitId: 'unit-biomolecular',
    },
    {
      productId: 'product-liquichek-level-2',
      productName: 'Liquichek Urinalysis Control, Level 2',
      holdingId: 'holding-liquichek-level-2',
      unitId: 'unit-biomolecular',
    },
    {
      productId: 'product-alinity-pre-trigger',
      productName: 'Alinity Pre-Trigger Solution',
      holdingId: 'holding-alinity-pre-trigger',
      unitId: 'unit-biomolecular',
    },
    {
      productId: 'product-afp',
      productName: 'AFP',
      holdingId: 'holding-afp',
      unitId: 'unit-biomolecular',
    },
  ]

  assert.equal(
    registryModule.findRegisteredDepartmentChemical(['CD5'], 'unit-biomolecular', registered)?.productId,
    'product-cd5',
    'a department SDS name may omit the registered product suffix',
  )
  assert.equal(
    registryModule.findRegisteredDepartmentChemical(['HLA - DR'], 'unit-biomolecular', registered)?.productId,
    'product-hla',
    'a leading Anti- prefix should not prevent matching the registered product',
  )
  assert.equal(
    registryModule.findRegisteredDepartmentChemical(['CD4'], 'unit-biomolecular', registered),
    null,
    'a marker embedded in a different product name must not be treated as the same product',
  )
  assert.equal(
    registryModule.findRegisteredDepartmentChemical(['CD5'], 'another-unit', registered),
    null,
    'a product registered by another unit must not hide this unit\'s registration action',
  )
  assert.equal(
    registryModule.findRegisteredDepartmentChemical(
      ['HLA - B5801 Real Time PCR'],
      'unit-biomolecular',
      registered,
    )?.productId,
    'product-hla-b5801',
    'an SDS title may include a method suffix omitted from the registered product name',
  )
  assert.equal(
    registryModule.findRegisteredDepartmentChemical(
      ['FACS™ Lysing Solution'],
      'unit-biomolecular',
      registered,
    )?.productId,
    'product-facs-lysing',
    'a trademark symbol must not become an extra TM token during normalization',
  )
  assert.equal(
    registryModule.findRegisteredDepartmentChemical(
      ['Liquichek Urinalysis Control (Thai)'],
      'unit-biomolecular',
      registered,
    )?.productId,
    'product-liquichek-level-1',
    'language labels in an SDS title must not prevent matching a registered product variant',
  )
  assert.equal(
    registryModule.findRegisteredDepartmentChemical(
      ['Alinity Trigger Solution'],
      'unit-biomolecular',
      registered,
    ),
    null,
    'a word inserted in the middle of a product name must remain a different product',
  )
  assert.equal(
    registryModule.findRegisteredDepartmentChemical(
      ['AFP Calibrator ภาษาไทย'],
      'unit-biomolecular',
      registered,
    ),
    null,
    'a registered base reagent must not hide registration for a distinct calibrator SDS',
  )
  assert.deepEqual(
    registryModule.findRegisteredDepartmentChemicals(
      ['Liquichek Urinalysis Control (Thai)'],
      'unit-biomolecular',
      registered,
    ).map((item: { holdingId: string }) => item.holdingId),
    ['holding-liquichek-level-1', 'holding-liquichek-level-2'],
    'ambiguous SDS names must expose every matching holding for explicit user selection',
  )
}

void main()
