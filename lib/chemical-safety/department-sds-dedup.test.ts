import assert from 'node:assert/strict'
import { buildDepartmentSdsDedupPlan, canonicalDepartmentSdsLinkIds } from './department-sds-dedup'

const duplicatePlan = buildDepartmentSdsDedupPlan({
  entries: [
    { id: 'entry-old', fileId: 'file-shared', departmentCode: 'chemistry' },
    { id: 'entry-current', fileId: 'file-current', departmentCode: 'chemistry' },
    { id: 'entry-other', fileId: 'file-shared', departmentCode: 'chemistry' },
  ],
  links: [
    { id: 'link-old', departmentSdsId: 'entry-old', holdingId: 'holding-1', sdsVersionId: 'version-old', linkedAt: '2026-08-21T00:00:00.000Z' },
    { id: 'link-current', departmentSdsId: 'entry-current', holdingId: 'holding-1', sdsVersionId: 'version-current', linkedAt: '2026-08-22T00:00:00.000Z' },
    { id: 'link-other', departmentSdsId: 'entry-other', holdingId: 'holding-2', sdsVersionId: 'version-other', linkedAt: '2026-08-21T00:00:00.000Z' },
  ],
  versions: [
    { id: 'version-old', fileId: 'file-shared', status: 'draft', sourceHoldingId: null, updatedAt: '2026-08-21T00:00:00.000Z' },
    { id: 'version-current', fileId: 'file-current', status: 'approved', sourceHoldingId: null, updatedAt: '2026-08-22T00:00:00.000Z' },
    { id: 'version-other', fileId: 'file-shared', status: 'draft', sourceHoldingId: null, updatedAt: '2026-08-21T00:00:00.000Z' },
  ],
  publications: [],
  files: [
    { id: 'file-shared', r2Key: 'shared.pdf' },
    { id: 'file-current', r2Key: 'current.pdf' },
  ],
})

assert.deepEqual(duplicatePlan.keepers, [
  { holdingId: 'holding-1', linkId: 'link-current', departmentSdsId: 'entry-current', sdsVersionId: 'version-current', source: 'legacy' },
  { holdingId: 'holding-2', linkId: 'link-other', departmentSdsId: 'entry-other', sdsVersionId: 'version-other', source: 'legacy' },
])
assert.deepEqual(duplicatePlan.deleteLinkIds, ['link-old'])
assert.deepEqual(duplicatePlan.deleteDepartmentSdsIds, ['entry-old'])
assert.deepEqual(duplicatePlan.deleteVersionIds, ['version-old'])
assert.deepEqual(duplicatePlan.deleteFileIds, [], 'a file referenced by another SDS version must be retained')
assert.deepEqual([...canonicalDepartmentSdsLinkIds(duplicatePlan)], ['link-current', 'link-other'])

const publicationPlan = buildDepartmentSdsDedupPlan({
  entries: [
    { id: 'legacy-entry', fileId: 'legacy-file', departmentCode: 'chemistry' },
  ],
  links: [
    { id: 'legacy-link', departmentSdsId: 'legacy-entry', holdingId: 'holding-3', sdsVersionId: 'legacy-version', linkedAt: '2026-08-21T00:00:00.000Z' },
  ],
  versions: [
    { id: 'legacy-version', fileId: 'legacy-file', status: 'draft', sourceHoldingId: null, updatedAt: '2026-08-21T00:00:00.000Z' },
    { id: 'registry-version', fileId: 'registry-file', status: 'approved', sourceHoldingId: 'holding-3', updatedAt: '2026-08-22T00:00:00.000Z' },
  ],
  publications: [
    { id: 'publication-3', sourceHoldingId: 'holding-3', sdsVersionId: 'registry-version', status: 'active', linkedAt: '2026-08-22T00:00:00.000Z' },
  ],
  files: [
    { id: 'legacy-file', r2Key: 'legacy.pdf' },
    { id: 'registry-file', r2Key: 'registry.pdf' },
  ],
})

assert.deepEqual(publicationPlan.keepers, [
  { holdingId: 'holding-3', linkId: null, departmentSdsId: null, sdsVersionId: 'registry-version', source: 'registry' },
])
assert.deepEqual(publicationPlan.deleteLinkIds, ['legacy-link'])
assert.deepEqual(publicationPlan.deleteDepartmentSdsIds, ['legacy-entry'])
assert.deepEqual(publicationPlan.deleteVersionIds, ['legacy-version'])
assert.deepEqual(publicationPlan.deleteFileIds, ['legacy-file'])
assert.deepEqual([...canonicalDepartmentSdsLinkIds(publicationPlan)], [])

console.log('department SDS deduplication planner tests passed')
