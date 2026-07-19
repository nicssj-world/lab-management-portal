import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const routes = [
  'app/api/admin/outlab/laboratories/route.ts',
  'app/api/admin/outlab/laboratories/[id]/route.ts',
  'app/api/admin/outlab/services/route.ts',
  'app/api/admin/outlab/services/[id]/route.ts',
  'app/api/admin/outlab/certificates/route.ts',
  'app/api/admin/outlab/certificates/[id]/route.ts',
  'app/api/admin/outlab/editors/route.ts',
  'app/api/admin/outlab/attachments/presign/route.ts',
  'app/api/admin/outlab/attachments/finalize/route.ts',
  'app/api/admin/outlab/attachments/[id]/route.ts',
  'app/api/admin/outlab/export/route.ts',
  'app/api/admin/eqa/providers/route.ts',
  'app/api/admin/eqa/programs/route.ts',
  'app/api/admin/eqa/program-tests/route.ts',
  'app/api/admin/eqa/coverage/route.ts',
  'app/api/admin/eqa/rounds/route.ts',
  'app/api/admin/eqa/rounds/[id]/route.ts',
  'app/api/admin/eqa/rounds/[id]/results/route.ts',
  'app/api/admin/eqa/capas/route.ts',
  'app/api/admin/eqa/capas/[id]/route.ts',
  'app/api/admin/eqa/editors/route.ts',
  'app/api/admin/eqa/attachments/presign/route.ts',
  'app/api/admin/eqa/attachments/finalize/route.ts',
  'app/api/admin/eqa/attachments/[id]/route.ts',
  'app/api/admin/eqa/export/route.ts',
]

for (const route of routes) assert.equal(existsSync(route), true, `route exists: ${route}`)

const attachmentApi = readFileSync('lib/external-quality/attachment-api.ts', 'utf8')
assert.ok(attachmentApi.includes('isAllowedFileSignature'))
assert.ok(attachmentApi.includes('HeadObjectCommand'))
assert.ok(attachmentApi.includes('DeleteObjectCommand'))

const eqaRound = readFileSync('app/api/admin/eqa/rounds/[id]/route.ts', 'utf8')
assert.ok(eqaRound.includes('roundClosureBlockers'), 'round close re-checks closure rules')
assert.ok(eqaRound.includes("status: 'closed'"), 'round close persists closed status')

const eqaResults = readFileSync('app/api/admin/eqa/rounds/[id]/results/route.ts', 'utf8')
assert.ok(eqaResults.includes('export async function DELETE'), 'results can be removed by an EQA editor')

for (const path of ['app/api/admin/outlab/services/route.ts', 'app/api/admin/outlab/services/[id]/route.ts']) {
  const source = readFileSync(path, 'utf8')
  assert.ok(source.includes('assertOutlabCatalogTest'), `services route only accepts the OUTLAB Catalog: ${path}`)
}

console.log('scripts/external-quality-api-contract.test.ts: all assertions passed')
