import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import { JUNE_2026_MASTERLIST_SHA256 } from '../lib/chemical-safety/import/masterlist-june-2026'

const importerPath = 'scripts/import-chemical-safety.ts'
const importer = readFileSync(importerPath, 'utf8')

function functionSource(name: string) {
  const match = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\b`).exec(importer)
  const start = match?.index ?? -1
  assert.notEqual(start, -1, `missing function ${name}`)
  const next = /\n(?:export\s+)?(?:async\s+)?function\s+\w+\b/g
  next.lastIndex = start + 1
  const nextMatch = next.exec(importer)
  return importer.slice(start, nextMatch?.index)
}

assert.equal(
  JUNE_2026_MASTERLIST_SHA256,
  '71d25b0e50b3056f97edb3238a1a7949584744f67fc0bfbfafcaa70273d83ddb',
)
assert.match(importer, /5195b2f1d00672c3f625e464abc743ab9ef0ee2de6215bf64222453f5f7a951d/)

for (const argument of ['--masterlist', '--layout', '--sds-root', '--apply']) {
  assert.ok(importer.includes(argument), `CLI recognizes ${argument}`)
}
assert.doesNotMatch(importer, /^import\s+dotenv\s+from\s+['"]dotenv['"]/m, 'dry-run module loading has no dotenv side effect')
assert.doesNotMatch(importer.slice(0, importer.indexOf('function applyImport')), /dotenv\.config/, 'dotenv is not configured before apply')
const applySource = functionSource('applyImport')
assert.match(applySource, /await import\(['"]dotenv['"]\)/, 'apply lazily loads dotenv')
assert.match(applySource, /config\(\{\s*path:\s*['"]\.env\.local['"]/, 'apply loads .env.local')
assert.ok(
  applySource.indexOf("await import('dotenv')") < applySource.indexOf("import('../lib/supabase/admin')"),
  'dotenv is configured before provider clients are loaded',
)
assert.match(importer, /mode:\s*apply\s*\?\s*['"]apply['"]\s*:\s*['"]dry-run['"]/)

for (const summaryField of [
  'masterlistRows',
  'positions',
  'fileTypes',
  'laterDuplicates',
  'candidate',
  'mismatch',
  'missing',
  'quantityConflicts',
  'masterlistSha256',
  'layoutSha256',
  'archiveSha256',
]) {
  assert.match(importer, new RegExp(`\\b${summaryField}\\b`), `summary includes ${summaryField}`)
}

assert.doesNotMatch(importer, /status\s*:\s*['"]approved['"]/i, 'the importer never assigns approved status')
assert.doesNotMatch(importer, /['"]public_eligible['"]\s*:\s*true/i, 'the importer never enables public listing')
assert.doesNotMatch(importer, /chemical_qr_tokens[\s\S]{0,200}(insert|upsert|update)/i, 'the importer never creates a QR token')
assert.match(importer, /chemical-safety\/sources\//)
assert.match(importer, /chemical-safety\/imports\//)
assert.match(functionSource('uploadSourceIfAbsent'), /objects\.put\(sourceKey,/, 'source uploads use the object-store boundary')
const pdfUploadSource = functionSource('uploadUniquePdfEvidence')
assert.match(pdfUploadSource, /assertPrivateKey\(sdsKey,\s*PRIVATE_IMPORT_PREFIX\)/, 'SDS keys are validated as private')
assert.match(pdfUploadSource, /objects\.put\(sdsKey,/, 'SDS uploads use only the validated key')

assert.match(importer, /\.upsert\(/, 'database writes are idempotent upserts')
assert.match(importer, /onConflict:\s*['"]source_kind,source_sha256['"]/, 'source batches use the unique source kind/hash')
assert.match(importer, /upsertInChunks\([\s\S]*?['"]batch_id,row_key['"]/, 'import rows use their unique batch/row key')
assert.match(importer, /upsertInChunks\([\s\S]*?['"]sha256['"]/, 'SDS files use their unique content hash')
assert.match(importer, /BATCH_SIZE\s*=\s*100/)
assert.match(importer, /status:\s*['"]failed['"]/, 'apply records a failed batch before surfacing an error')
assert.match(importer, /status:\s*['"]completed['"]/, 'apply completes a batch only after its work succeeds')
assert.doesNotMatch(importer, /^import .*\/(?:r2\/client|supabase\/admin)['"]/m, 'write clients are not loaded during dry-run')
assert.doesNotMatch(
  functionSource('uploadUniquePdfEvidence'),
  /isPdfSignature|validateChemicalPdf/,
  'extension-identified archive evidence remains quarantined even when it cannot pass the later approval validator',
)

const noArgs = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', importerPath], {
  cwd: process.cwd(),
  encoding: 'utf8',
  env: { NODE_ENV: 'test' },
})
assert.notEqual(noArgs.status, 0)
assert.equal(noArgs.stdout, '', 'argument failures do not emit a JSON summary')
assert.match(noArgs.stderr, /--masterlist/)
assert.doesNotMatch(noArgs.stderr, /SUPABASE|R2_ACCOUNT|R2_ACCESS|R2_SECRET|R2_BUCKET/i)

const unexpected = spawnSync(
  process.execPath,
  [
    'node_modules/tsx/dist/cli.mjs', importerPath,
    '--masterlist', 'master.pdf', '--layout', 'layout.png', '--sds-root', 'archive', '--surprise',
  ],
  { cwd: process.cwd(), encoding: 'utf8', env: { NODE_ENV: 'test' } },
)
assert.notEqual(unexpected.status, 0)
assert.equal(unexpected.stdout, '')
assert.match(unexpected.stderr, /Unexpected argument: --surprise/)
assert.doesNotMatch(unexpected.stderr, /SUPABASE|R2_ACCOUNT|R2_ACCESS|R2_SECRET|R2_BUCKET/i)

console.log('chemical safety import CLI contract passed')
