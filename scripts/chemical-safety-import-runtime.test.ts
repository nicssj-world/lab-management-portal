import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  JUNE_2026_MASTERLIST_ROWS,
  JUNE_2026_MASTERLIST_SHA256,
  buildJune2026NormalizedProposals,
} from '../lib/chemical-safety/import/masterlist-june-2026'
import type { SdsIndexedFile } from '../lib/chemical-safety/import/sds-index'
import {
  REVIEWED_ASSOCIATIONS,
  applyImport,
  hashArchiveManifest,
  parseCli,
  redactCliError,
  runChemicalSafetyCli,
  validateReviewedAssociations,
  type ApplyFileAccess,
  type ChemicalImportDatabase,
  type ChemicalObjectStore,
  type ImportBatch,
  type ImportBatchPayload,
  type ImportSummary,
  type PreparedImport,
  type ReviewedAssociation,
  type ReviewedAssociationPolicy,
} from './import-chemical-safety'

function hash(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function evidenceText(association: ReviewedAssociation): string {
  if (association.validationRule === 'hard_identity_mismatch') {
    if (association.rowNo === 2) return 'Sodium acetate CAS 127-09-3'
    if (association.rowNo === 23) return 'TFA-d CAS 599-00-8'
    return 'Anhydrous ammonia CAS 7664-41-7'
  }
  if (association.validationRule === 'concentration_not_confirmed') return association.product.name
  if (association.validationRule === 'identity_not_confirmed') return 'Unrelated eosin methylene blue stain'
  return association.product.name
}

function reviewedFixture(): { files: SdsIndexedFile[]; policy: ReviewedAssociationPolicy } {
  const byPath = new Map<string, SdsIndexedFile>()
  for (const association of REVIEWED_ASSOCIATIONS) {
    if (!association.sourcePath || !association.evidenceSha256) continue
    if (!byPath.has(association.sourcePath)) {
      byPath.set(association.sourcePath, {
        absolutePath: join('X:\\fixture-archive', ...association.sourcePath.split('/')),
        relativePath: association.sourcePath,
        sourceUnitName: association.sourcePath.split('/')[0],
        extension: '.pdf',
        sizeBytes: 1024,
        sha256: association.evidenceSha256,
        extractedText: evidenceText(association),
        importSupport: 'pdf',
        duplicateOfSha256: null,
      })
    }
  }
  const files = [...byPath.values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'en'))
  return {
    files,
    policy: {
      archiveSha256: hashArchiveManifest(files),
      associations: REVIEWED_ASSOCIATIONS,
    },
  }
}

function cloneAssociations(): ReviewedAssociation[] {
  return REVIEWED_ASSOCIATIONS.map(association => ({
    ...association,
    product: { ...association.product, aliases: association.product.aliases ? [...association.product.aliases] : undefined },
  }))
}

function testEvidenceBinding() {
  const fixture = reviewedFixture()
  const resolved = validateReviewedAssociations(fixture.files, fixture.policy)
  assert.equal(resolved.filter(item => item.matchStatus === 'candidate').length, 13)
  assert.equal(resolved.filter(item => item.matchStatus === 'mismatch').length, 7)
  assert.equal(resolved.filter(item => item.matchStatus === 'missing').length, 5)

  assert.throws(
    () => validateReviewedAssociations(fixture.files, { ...fixture.policy, archiveSha256: '0'.repeat(64) }),
    /reviewed archive hash/i,
  )

  const malformedEvidenceHash = cloneAssociations()
  const evidenceRow = malformedEvidenceHash.find(association => association.evidenceSha256)!
  evidenceRow.evidenceSha256 = 'a'.repeat(63)
  assert.throws(
    () => validateReviewedAssociations(fixture.files, { ...fixture.policy, associations: malformedEvidenceHash }),
    /evidence hash is invalid/i,
  )

  const changedEvidence = fixture.files.map((file, index) => index === 0 ? { ...file, sha256: 'f'.repeat(64) } : file)
  assert.throws(() => validateReviewedAssociations(changedEvidence, fixture.policy), /evidence hash/i)

  const changedStatus = cloneAssociations()
  changedStatus[0].matchStatus = 'mismatch'
  assert.throws(
    () => validateReviewedAssociations(fixture.files, { ...fixture.policy, associations: changedStatus }),
    /status.*validation rule/i,
  )

  const changedIdentity = cloneAssociations()
  changedIdentity[0].product = { ...changedIdentity[0].product, name: 'Different product identity', aliases: [] }
  assert.throws(
    () => validateReviewedAssociations(fixture.files, { ...fixture.policy, associations: changedIdentity }),
    /reviewed candidate/i,
  )

  const missing = REVIEWED_ASSOCIATIONS.find(association => association.matchStatus === 'missing')!
  const viableMissingEvidence: SdsIndexedFile = {
    absolutePath: 'X:\\fixture-archive\\new-evidence.pdf',
    relativePath: 'new-evidence.pdf',
    sourceUnitName: 'fixture-archive',
    extension: '.pdf',
    sizeBytes: 2048,
    sha256: 'e'.repeat(64),
    extractedText: missing.product.name,
    importSupport: 'pdf',
    duplicateOfSha256: null,
  }
  const withViableMissing = [...fixture.files, viableMissingEvidence]
  assert.throws(
    () => validateReviewedAssociations(withViableMissing, {
      ...fixture.policy,
      archiveSha256: hashArchiveManifest(withViableMissing),
    }),
    /viable evidence.*missing/i,
  )
}

async function testCredentialFreeFixtureDryRun() {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'chemical-cli-runtime-'))
  try {
    const masterlistPath = join(fixtureRoot, 'master.pdf')
    const layoutPath = join(fixtureRoot, 'layout.png')
    const archivePath = join(fixtureRoot, 'archive')
    await writeFile(masterlistPath, 'fixture master')
    await writeFile(layoutPath, 'fixture layout')
    await mkdir(archivePath)

    const fixture = reviewedFixture()
    let providerLoads = 0
    let networkCalls = 0
    const stdout: string[] = []
    const stderr: string[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      networkCalls += 1
      throw new Error('network forbidden in dry-run')
    }) as typeof fetch
    try {
      const exitCode = await runChemicalSafetyCli(
        ['--masterlist', masterlistPath, '--layout', layoutPath, '--sds-root', archivePath],
        {
          preparation: {
            readMasterlist: async () => ({
              sha256: JUNE_2026_MASTERLIST_SHA256,
              title: 'Unit Chemical Inventory List',
              unitDepartment: 'fixture unit',
              updatedLabel: 'June 2026',
              rows: JUNE_2026_MASTERLIST_ROWS.map(row => ({ ...row })),
            }),
            assertSourceFile: async (_path, expectedSha256) => expectedSha256,
            indexSdsArchive: async () => fixture.files,
            reviewPolicy: fixture.policy,
          },
          loadApplyRuntime: async () => {
            providerLoads += 1
            throw new Error('apply provider must not load in dry-run')
          },
        },
        {
          stdout: value => { stdout.push(value) },
          stderr: value => { stderr.push(value) },
        },
      )
      assert.equal(exitCode, 0)
    } finally {
      globalThis.fetch = originalFetch
    }

    assert.equal(providerLoads, 0)
    assert.equal(networkCalls, 0)
    assert.equal(stderr.length, 0)
    assert.equal(stdout.length, 1, 'successful dry-run writes stdout exactly once')
    const lines = stdout[0].trim().split(/\r?\n/)
    assert.equal(lines.length, 1)
    const summary = JSON.parse(lines[0]) as ImportSummary
    assert.equal(summary.mode, 'dry-run')
    assert.equal(summary.candidate, 13)
    assert.equal(summary.mismatch, 7)
    assert.equal(summary.missing, 5)
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true })
  }
}

function testArgumentContract() {
  assert.deepEqual(
    parseCli(['--sds-root', 'archive', '--masterlist', 'master.pdf', '--layout', 'layout.png']),
    {
      masterlistPath: join(process.cwd(), 'master.pdf'),
      layoutPath: join(process.cwd(), 'layout.png'),
      sdsRootPath: join(process.cwd(), 'archive'),
      apply: false,
    },
  )
  assert.throws(() => parseCli([]), /--masterlist/)
  assert.throws(
    () => parseCli(['--masterlist', 'a.pdf', '--masterlist', 'b.pdf', '--layout', 'l.png', '--sds-root', 'root']),
    /Duplicate argument: --masterlist/,
  )
  assert.throws(
    () => parseCli(['--masterlist', 'a.pdf', '--layout', 'l.png', '--sds-root', 'root', '--unknown']),
    /Unexpected argument: --unknown/,
  )
  assert.throws(
    () => parseCli(['--masterlist', '--layout', 'l.png', '--sds-root', 'root']),
    /Missing value for --masterlist/,
  )
}

function testTerminalPathRedaction() {
  const probes = [
    'C:\\private lab\\secret-master.pdf',
    '\\\\server\\private-share\\MSDS 2568',
    '/home/private-user/source/MSDS 2568',
  ]
  for (const privatePath of probes) {
    const redacted = redactCliError(
      new Error(`Unable to inspect source ${privatePath}: permission denied`),
      ['--sds-root', privatePath],
    )
    assert.doesNotMatch(redacted, /private lab|private-share|private-user|secret-master|MSDS 2568/i)
    assert.match(redacted, /Unable to inspect source/)
    assert.match(redacted, /permission denied/)
    assert.match(redacted, /\[local source\]/)
  }
}

class RecordingFakeSupabase implements ChemicalImportDatabase {
  readonly batches = new Map<string, ImportBatch>()
  readonly batchPayloads: ImportBatchPayload[] = []
  readonly chunks: Array<{ table: string; rows: readonly Record<string, unknown>[]; onConflict: string }> = []
  readonly failed: Array<{ ids: string[]; summary: Record<string, unknown> }> = []
  readonly completed: Array<{ ids: string[]; summary: ImportSummary }> = []
  readonly audits: string[] = []
  readonly sourcePaths = new Map<string, string[]>()
  failUpsertCall: number | null = null
  private upsertCalls = 0

  async ensureBatch(payload: ImportBatchPayload): Promise<ImportBatch> {
    this.batchPayloads.push(payload)
    const key = `${payload.source_kind}:${payload.source_sha256}`
    const existing = this.batches.get(key)
    if (existing?.status === 'completed') return { ...existing, needsProcessing: false }
    const batch = { id: existing?.id ?? `batch-${this.batches.size + 1}`, status: 'processing', needsProcessing: true }
    this.batches.set(key, batch)
    return { ...batch }
  }

  async upsertRows(table: string, rows: readonly Record<string, unknown>[], onConflict: string): Promise<void> {
    this.upsertCalls += 1
    this.chunks.push({ table, rows: rows.map(row => ({ ...row })), onConflict })
    if (this.failUpsertCall === this.upsertCalls) {
      throw new Error('fake Supabase rejected a write for C:\\private lab\\archive')
    }
    if (table === 'chemical_sds_files') {
      for (const row of rows) {
        const sha256 = String(row.sha256)
        const incoming = Array.isArray(row.source_paths) ? row.source_paths.map(String) : []
        this.sourcePaths.set(sha256, [...new Set([...(this.sourcePaths.get(sha256) ?? []), ...incoming])].sort())
      }
    }
  }

  async ensureAudit(archiveBatchId: string): Promise<void> {
    if (!this.audits.includes(archiveBatchId)) this.audits.push(archiveBatchId)
  }

  async completeBatches(ids: readonly string[], summary: ImportSummary): Promise<void> {
    this.completed.push({ ids: [...ids], summary })
    for (const [key, batch] of this.batches) {
      if (ids.includes(batch.id)) this.batches.set(key, { ...batch, status: 'completed', needsProcessing: false })
    }
  }

  async failBatches(ids: readonly string[], summary: Record<string, unknown>): Promise<void> {
    this.failed.push({ ids: [...ids], summary })
    for (const [key, batch] of this.batches) {
      if (ids.includes(batch.id)) this.batches.set(key, { ...batch, status: 'failed', needsProcessing: true })
    }
  }
}

class RecordingFakeR2 implements ChemicalObjectStore {
  readonly keys = new Set<string>()
  readonly puts: Array<{ key: string; contentType: string; sizeBytes: number }> = []
  failPut = false

  async exists(key: string): Promise<boolean> {
    return this.keys.has(key)
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    if (this.failPut) throw new Error('fake R2 failure at \\\\server\\private-share\\blob')
    this.keys.add(key)
    this.puts.push({ key, contentType, sizeBytes: bytes.byteLength })
  }
}

function applyFixture(): { prepared: PreparedImport; fileAccess: ApplyFileAccess; duplicateSha256: string } {
  const byteMap = new Map<string, Uint8Array>()
  const masterlistPath = 'C:\\private lab\\master.pdf'
  const layoutPath = 'C:\\private lab\\layout.png'
  const masterBytes = Buffer.from('master source fixture')
  const layoutBytes = Buffer.from('layout source fixture')
  byteMap.set(masterlistPath, masterBytes)
  byteMap.set(layoutPath, layoutBytes)

  const files: SdsIndexedFile[] = []
  for (let index = 0; index < 101; index += 1) {
    const bytes = Buffer.from(`%PDF-${index}-private evidence`)
    const sha256 = hash(bytes)
    const absolutePath = `C:\\private lab\\archive\\evidence-${index}.pdf`
    byteMap.set(absolutePath, bytes)
    files.push({
      absolutePath,
      relativePath: `unit/evidence-${index}.pdf`,
      sourceUnitName: 'unit',
      extension: '.pdf',
      sizeBytes: bytes.byteLength,
      sha256,
      extractedText: `Product ${index}`,
      importSupport: 'pdf',
      duplicateOfSha256: null,
    })
  }
  const duplicate = { ...files[0], relativePath: 'unit-copy/evidence-0-copy.pdf', duplicateOfSha256: files[0].sha256 }
  files.push(duplicate)
  for (let index = files.length; index < 205; index += 1) {
    files.push({
      absolutePath: `C:\\private lab\\archive\\legacy-${index}.doc`,
      relativePath: `legacy/legacy-${index}.doc`,
      sourceUnitName: 'legacy',
      extension: '.doc',
      sizeBytes: 10,
      sha256: hash(`legacy-${index}`),
      extractedText: null,
      importSupport: 'metadata_only',
      duplicateOfSha256: null,
    })
  }

  const proposals = buildJune2026NormalizedProposals(JUNE_2026_MASTERLIST_ROWS)
  const associations = proposals.map((proposal, index) => ({
    rowNo: proposal.rawRowNo,
    matchStatus: index < 13 ? 'candidate' as const : index < 20 ? 'mismatch' as const : 'missing' as const,
    reviewReason: 'runtime fixture',
    file: index < 20 ? files[index] : null,
    score: index < 20 ? {
      score: index < 13 ? 10 : -10,
      positiveEvidence: index < 13 ? ['fixture identity'] : [],
      negativeEvidence: index < 13 ? [] : ['fixture mismatch'],
      exactCas: false,
      concentrationConfirmed: false,
      hardMismatch: index >= 13,
    } : null,
    automatedClassification: index < 13 ? 'candidate' as const : index < 20 ? 'mismatch' as const : null,
  }))
  const fileTypes = {
    pdf: files.filter(file => file.extension === '.pdf').length,
    docx: 0,
    doc: files.filter(file => file.extension === '.doc').length,
    html: 0,
  }
  const summary: ImportSummary = {
    mode: 'apply',
    masterlistRows: 25,
    positions: 13,
    archiveFiles: files.length,
    fileTypes,
    laterDuplicates: 1,
    candidate: 13,
    mismatch: 7,
    missing: 5,
    quantityConflicts: 5,
    masterlistSha256: hash(masterBytes),
    layoutSha256: hash(layoutBytes),
    archiveSha256: hashArchiveManifest(files),
    batchHashes: {
      masterlist: hash(masterBytes),
      layout: hash(layoutBytes),
      sdsArchive: hashArchiveManifest(files),
    },
  }
  const prepared: PreparedImport = {
    options: { masterlistPath, layoutPath, sdsRootPath: 'C:\\private lab\\archive', apply: true },
    masterlist: {
      sha256: summary.masterlistSha256,
      title: 'Unit Chemical Inventory List',
      unitDepartment: 'fixture unit',
      updatedLabel: 'June 2026',
      rows: JUNE_2026_MASTERLIST_ROWS.map(row => ({ ...row })),
    },
    proposals,
    files,
    associations,
    summary,
  }
  const fileAccess: ApplyFileAccess = {
    async read(path) {
      const bytes = byteMap.get(path)
      if (!bytes) throw new Error(`missing fake bytes for ${path}`)
      return bytes
    },
    async assertRegular(path) {
      if (!byteMap.has(path)) throw new Error(`not a regular fixture file: ${path}`)
    },
  }
  return { prepared, fileAccess, duplicateSha256: files[0].sha256 }
}

async function testApplyRuntime() {
  const { prepared, fileAccess, duplicateSha256 } = applyFixture()
  const supabase = new RecordingFakeSupabase()
  const r2 = new RecordingFakeR2()
  supabase.sourcePaths.set(duplicateSha256, ['older-unit/original.pdf'])
  supabase.failUpsertCall = 3

  await assert.rejects(
    applyImport(prepared, async () => ({ database: supabase, objects: r2, files: fileAccess })),
    /fake Supabase rejected a write/,
  )
  assert.equal(supabase.completed.length, 0, 'failure never marks a batch completed')
  assert.equal(supabase.failed.length, 1)
  assert.doesNotMatch(JSON.stringify(supabase.failed[0].summary), /private lab/i)
  const putsAfterFailure = r2.puts.length

  supabase.failUpsertCall = null
  await applyImport(prepared, async () => ({ database: supabase, objects: r2, files: fileAccess }))
  assert.equal(supabase.completed.length, 1)
  assert.ok(supabase.chunks.every(chunk => chunk.rows.length <= 100), 'all database chunks are at most 100 rows')
  assert.ok(supabase.chunks.some(chunk => chunk.rows.length === 100), 'the runtime exercises a full 100-row chunk')
  assert.deepEqual(supabase.sourcePaths.get(duplicateSha256), [
    'older-unit/original.pdf',
    'unit-copy/evidence-0-copy.pdf',
    'unit/evidence-0.pdf',
  ])
  assert.equal(r2.puts.length, putsAfterFailure, 'retry does not upload content-addressed objects twice')
  assert.equal(new Set(r2.puts.map(item => item.key)).size, r2.puts.length, 'no duplicate blob key is uploaded')
  assert.ok(r2.puts.every(item => item.key.startsWith('chemical-safety/sources/') || item.key.startsWith('chemical-safety/imports/')))

  const chunksBeforeIdempotentRerun = supabase.chunks.length
  const putsBeforeIdempotentRerun = r2.puts.length
  await applyImport(prepared, async () => ({ database: supabase, objects: r2, files: fileAccess }))
  assert.equal(supabase.chunks.length, chunksBeforeIdempotentRerun)
  assert.equal(r2.puts.length, putsBeforeIdempotentRerun)

  const storageFailureDb = new RecordingFakeSupabase()
  const storageFailureR2 = new RecordingFakeR2()
  storageFailureR2.failPut = true
  await assert.rejects(
    applyImport(prepared, async () => ({ database: storageFailureDb, objects: storageFailureR2, files: fileAccess })),
    /fake R2 failure/,
  )
  assert.equal(storageFailureDb.completed.length, 0)
  assert.equal(storageFailureDb.failed.length, 1, 'storage errors also leave failed batch evidence')
}

async function main() {
  testArgumentContract()
  testTerminalPathRedaction()
  testEvidenceBinding()
  await testCredentialFreeFixtureDryRun()
  await testApplyRuntime()
  console.log('chemical safety import runtime tests passed')
}

void main()
