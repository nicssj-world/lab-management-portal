import assert from 'node:assert/strict'
import { buildChemicalHoldingDeleteImpact } from './holding-delete'

const targetHolding = {
  id: 'holding-target',
  productId: 'product-target',
  unitId: 'unit-target',
}

const baseInput = {
  holding: targetHolding,
  product: { id: 'product-target', canonicalName: 'Target reagent' },
  unit: { id: 'unit-target', nameTh: 'ห้องปฏิบัติการ' },
  versions: [
    {
      id: 'version-target', productId: 'product-target', sourceHoldingId: 'holding-target',
      status: 'approved', revisionLabel: '2026-01', fileId: 'file-target',
    },
  ],
  publications: [
    {
      id: 'publication-room', sourceHoldingId: 'holding-target', sdsVersionId: 'version-target',
      destination: 'room', departmentCode: null, displayName: 'Target reagent · ห้องสารเคมี', status: 'active',
    },
  ],
  links: [],
  departmentSds: [],
  files: [{ id: 'file-target', fileName: 'target.pdf', r2Key: 'sds/target.pdf' }],
} as const

const impact = buildChemicalHoldingDeleteImpact(baseInput)
assert.equal(impact.canDelete, true)
assert.deepEqual(impact.deletePlan.publicationIds, ['publication-room'])
assert.deepEqual(impact.deletePlan.sdsVersionIds, ['version-target'])
assert.deepEqual(impact.deletePlan.fileIds, ['file-target'])
assert.equal(impact.filesToDelete[0]?.r2Key, 'sds/target.pdf')
assert.deepEqual(impact.sharedDependencies, [])

const legacyPublicationImpact = buildChemicalHoldingDeleteImpact({
  ...baseInput,
  versions: [{
    id: 'version-legacy', productId: 'product-target', sourceHoldingId: null,
    status: 'approved', revisionLabel: null, fileId: 'file-target',
  }],
  publications: [{
    id: 'publication-legacy', sourceHoldingId: 'holding-target', sdsVersionId: 'version-legacy',
    destination: 'room', departmentCode: null, displayName: 'Legacy publication', status: 'active',
  }],
})
assert.deepEqual(legacyPublicationImpact.deletePlan.sdsVersionIds, ['version-legacy'])

const departmentImpact = buildChemicalHoldingDeleteImpact({
  ...baseInput,
  publications: [],
  links: [{
    id: 'department-link', departmentSdsId: 'department-sds', productId: 'product-target',
    holdingId: 'holding-target', sdsVersionId: 'version-target',
  }],
  departmentSds: [{
    id: 'department-sds', departmentCode: 'chemistry', displayName: 'Target reagent · งานเคมีคลินิก', fileId: 'file-department',
  }],
  files: [
    ...baseInput.files,
    { id: 'file-department', fileName: 'department.pdf', r2Key: 'sds/department.pdf' },
  ],
})
assert.deepEqual(departmentImpact.deletePlan.departmentLinkIds, ['department-link'])
assert.deepEqual(departmentImpact.deletePlan.departmentSdsIds, ['department-sds'])

const sharedImpact = buildChemicalHoldingDeleteImpact({
  ...baseInput,
  publications: [
    ...baseInput.publications,
    {
      id: 'publication-other', sourceHoldingId: 'holding-other', sdsVersionId: 'version-target',
      destination: 'department', departmentCode: 'hematology', displayName: 'Target reagent · งานโลหิตวิทยา', status: 'active',
    },
  ],
})
assert.equal(sharedImpact.canDelete, false)
assert.ok(sharedImpact.sharedDependencies.some(dependency => dependency.relatedHoldingId === 'holding-other'))
assert.deepEqual(sharedImpact.deletePlan, {
  publicationIds: [], departmentLinkIds: [], departmentSdsIds: [], sdsVersionIds: [], fileIds: [], fileKeys: [],
})

const reusedFileImpact = buildChemicalHoldingDeleteImpact({
  ...baseInput,
  versions: [
    ...baseInput.versions,
    {
      id: 'version-other-file', productId: 'product-other', sourceHoldingId: 'holding-other',
      status: 'approved', revisionLabel: null, fileId: 'file-target',
    },
  ],
})
assert.equal(reusedFileImpact.canDelete, true)
assert.deepEqual(reusedFileImpact.filesToDelete, [])
assert.equal(reusedFileImpact.filesToKeep[0]?.reason, 'อ้างอิงโดย SDS รายการอื่น')
assert.equal(reusedFileImpact.productIdsPreserved.includes('product-target'), true)
assert.equal(reusedFileImpact.holdingIdsPreserved.includes('holding-other'), true)

console.log('chemical holding-delete impact planner contract passed')
