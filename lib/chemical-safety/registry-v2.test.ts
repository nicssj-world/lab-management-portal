import assert from 'node:assert/strict'

const ids = {
  unitId: '11111111-1111-4111-8111-111111111111',
  productId: '22222222-2222-4222-8222-222222222222',
  holdingId: '33333333-3333-4333-8333-333333333333',
  locationId: '44444444-4444-4444-8444-444444444444',
  sdsVersionId: '55555555-5555-4555-8555-555555555555',
}

const holding = {
  lotNumber: null,
  packageValue: 500,
  packageUnit: 'mL' as const,
  currentContainerCount: 2,
  minimumStock: 1,
  reportedTotalRaw: null,
  calculatedTotalValue: 1000,
  calculatedTotalUnit: 'mL' as const,
  receivedOn: null,
  openedOn: null,
  expiresOn: null,
  effectiveOn: null,
}

async function main() {
  const schemas = await import('./schemas') as Record<string, any>
  const publication = await import('./sds-publication').catch(() => null) as Record<string, any> | null

  assert.equal(typeof schemas.chemicalSdsPublicationSchema?.safeParse, 'function', 'publication input schema must exist')
  assert.equal(typeof publication?.deriveSdsDestination, 'function', 'publication destination resolver must exist')

  const existingRoom = schemas.chemicalChangeRequestSchema.safeParse({
    entityType: 'registry_entry',
    unitId: ids.unitId,
    proposedData: {
      productMode: 'existing',
      productId: ids.productId,
      storageScope: 'room',
      locationId: ids.locationId,
      ...holding,
    },
  })
  assert.equal(existingRoom.success, true, 'registry_entry must support an existing product in the chemical room')

  const existingDepartment = schemas.chemicalChangeRequestSchema.safeParse({
    entityType: 'registry_entry',
    unitId: ids.unitId,
    proposedData: {
      productMode: 'existing',
      productId: ids.productId,
      storageScope: 'department',
      locationId: null,
      ...holding,
    },
  })
  assert.equal(existingDepartment.success, true, 'registry_entry must support an existing department product')

  const newDepartment = schemas.chemicalChangeRequestSchema.safeParse({
    entityType: 'registry_entry',
    unitId: ids.unitId,
    proposedData: {
      productMode: 'new',
      canonicalName: 'Registry v2 reagent',
      aliases: [],
      casNumber: null,
      manufacturer: null,
      supplier: null,
      productCode: null,
      concentration: null,
      physicalState: 'liquid',
      storageScope: 'department',
      locationId: null,
      ghsSourceText: null,
      ghsPictogramCodes: [],
      ghsHazardClasses: [],
      ...holding,
    },
  })
  assert.equal(newDepartment.success, true, 'registry_entry must support a new department-scoped product')

  const invalidRoomWithoutLocation = schemas.chemicalChangeRequestSchema.safeParse({
    entityType: 'registry_entry',
    unitId: ids.unitId,
    proposedData: {
      productMode: 'existing',
      productId: ids.productId,
      storageScope: 'room',
      locationId: null,
      ...holding,
    },
  })
  assert.equal(invalidRoomWithoutLocation.success, false, 'room entries must require a storage location')

  const invalidDepartmentLocation = schemas.chemicalChangeRequestSchema.safeParse({
    entityType: 'registry_entry',
    unitId: ids.unitId,
    proposedData: {
      productMode: 'existing',
      productId: ids.productId,
      storageScope: 'department',
      locationId: ids.locationId,
      ...holding,
    },
  })
  assert.equal(invalidDepartmentLocation.success, false, 'department entries must reject a room location')

  assert.equal(publication!.deriveSdsDestination('room'), 'room')
  assert.equal(publication!.deriveSdsDestination('department'), 'department')

  assert.equal(schemas.chemicalSdsCreateSchema.safeParse({ holdingId: ids.holdingId, language: 'th' }).success, true)
  assert.equal(schemas.chemicalSdsCreateSchema.safeParse({ productId: ids.productId, unitId: ids.unitId, language: 'th' }).success, false)

  assert.equal(schemas.chemicalSdsPublicationSchema.safeParse({ sdsVersionId: ids.sdsVersionId }).success, true)
  assert.equal(
    schemas.chemicalSdsPublicationSchema.safeParse({ sdsVersionId: ids.sdsVersionId, destination: 'room' }).success,
    false,
    'the client must not choose a publication destination',
  )

  console.log('chemical-safety registry v2 domain contracts passed')
}

void main()

