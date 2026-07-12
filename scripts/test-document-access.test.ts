import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

async function main() {
  assert.ok(existsSync('lib/tests/document-access.ts'), 'document access policy module must exist')
  const { canUseDocumentAction, normalizeDocumentAccess } = await import('../lib/tests/document-access')

  assert.deepEqual(normalizeDocumentAccess('Internal', 'download'), {
    visibility: 'Internal', accessMode: 'view',
  })
  assert.deepEqual(normalizeDocumentAccess('Public', undefined), {
    visibility: 'Public', accessMode: 'both',
  })
  assert.equal(canUseDocumentAction('both', 'view'), true)
  assert.equal(canUseDocumentAction('both', 'download'), true)
  assert.equal(canUseDocumentAction('view', 'download'), false)
  assert.equal(canUseDocumentAction('download', 'view'), false)

  console.log('test document access policy tests passed')
}

main()
