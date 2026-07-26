import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { S3Client } from '@aws-sdk/client-s3'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  buildChemicalSdsImportKey,
  buildChemicalSourceKey,
} from '../lib/chemical-safety/files'
import {
  JUNE_2026_MASTERLIST_SHA256,
  buildJune2026NormalizedProposals,
  readJune2026Masterlist,
  type MasterlistRawRow,
} from '../lib/chemical-safety/import/masterlist-june-2026'
import {
  indexSdsArchive,
  type SdsIndexedFile,
} from '../lib/chemical-safety/import/sds-index'
import {
  classifySdsCandidate,
  scoreSdsCandidate,
  type SdsCandidateScore,
  type SdsMatchProduct,
} from '../lib/chemical-safety/import/sds-match'
import { assertSourceFile } from '../lib/chemical-safety/import/source-files'
import { CHEMICAL_PREP_LOCATIONS } from '../lib/chemical-safety/storage-manifest'
import type { SdsMatchStatus } from '../lib/chemical-safety/types'

const LAYOUT_SHA256 = '5195b2f1d00672c3f625e464abc743ab9ef0ee2de6215bf64222453f5f7a951d'
const REVIEWED_ARCHIVE_SHA256 = '1eb2b4ebf4b5f8fcf27eb41998887d3d2479b37e045acb9f7cdab5f4b8d34e6f'
const PARSER_VERSION = 'chemical-safety-foundation-v1'
const BATCH_SIZE = 100
const PRIVATE_SOURCE_PREFIX = 'chemical-safety/sources/'
const PRIVATE_IMPORT_PREFIX = 'chemical-safety/imports/'
const TERMINAL_BATCH_STATUSES = new Set(['completed', 'reviewed', 'committed', 'imported'])

export interface CliOptions {
  masterlistPath: string
  layoutPath: string
  sdsRootPath: string
  apply: boolean
}

export interface ImportSummary {
  mode: 'dry-run' | 'apply'
  masterlistRows: number
  positions: number
  archiveFiles: number
  fileTypes: { pdf: number; docx: number; doc: number; html: number }
  laterDuplicates: number
  candidate: number
  mismatch: number
  missing: number
  quantityConflicts: number
  masterlistSha256: string
  layoutSha256: string
  archiveSha256: string
  batchHashes: {
    masterlist: string
    layout: string
    sdsArchive: string
  }
}

export type ReviewedAssociationValidationRule =
  | 'scorer_candidate'
  | 'hard_identity_mismatch'
  | 'concentration_not_confirmed'
  | 'identity_not_confirmed'
  | 'missing_full_archive'

export interface ReviewedAssociation {
  rowNo: number
  matchStatus: Extract<SdsMatchStatus, 'candidate' | 'mismatch' | 'missing'>
  sourcePath?: string
  evidenceSha256?: string
  validationRule: ReviewedAssociationValidationRule
  reviewReason: string
  product: SdsMatchProduct
}

export interface ResolvedAssociation {
  rowNo: number
  matchStatus: ReviewedAssociation['matchStatus']
  reviewReason: string
  file: SdsIndexedFile | null
  score: SdsCandidateScore | null
  automatedClassification: SdsMatchStatus | null
}

export interface PreparedImport {
  options: CliOptions
  masterlist: Awaited<ReturnType<typeof readJune2026Masterlist>>
  proposals: ReturnType<typeof buildJune2026NormalizedProposals>
  files: SdsIndexedFile[]
  associations: ResolvedAssociation[]
  summary: ImportSummary
}

export interface ImportBatch {
  id: string
  status: string
  needsProcessing: boolean
}

export interface ReviewedAssociationPolicy {
  archiveSha256: string
  associations: readonly ReviewedAssociation[]
}

export interface PreparationDependencies {
  readMasterlist: typeof readJune2026Masterlist
  assertSourceFile: typeof assertSourceFile
  indexSdsArchive: typeof indexSdsArchive
  reviewPolicy: ReviewedAssociationPolicy
}

export interface ImportBatchPayload extends Record<string, unknown> {
  source_kind: string
  source_name: string
  source_path: string
  source_sha256: string
  source_r2_key: string | null
}

export interface ChemicalImportDatabase {
  ensureBatch(payload: ImportBatchPayload): Promise<ImportBatch>
  upsertRows(table: string, rows: readonly Record<string, unknown>[], onConflict: string): Promise<void>
  ensureAudit(archiveBatchId: string, summary: ImportSummary): Promise<void>
  completeBatches(ids: readonly string[], summary: ImportSummary): Promise<void>
  failBatches(ids: readonly string[], summary: Record<string, unknown>): Promise<void>
}

export interface ChemicalObjectStore {
  exists(key: string): Promise<boolean>
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>
}

export interface ApplyFileAccess {
  read(path: string): Promise<Uint8Array>
  assertRegular(path: string): Promise<void>
}

export interface ApplyRuntime {
  database: ChemicalImportDatabase
  objects: ChemicalObjectStore
  files: ApplyFileAccess
}

export interface ChemicalSafetyCliDependencies {
  preparation?: Partial<PreparationDependencies>
  loadApplyRuntime?: () => Promise<ApplyRuntime>
}

export interface ChemicalSafetyCliIo {
  stdout(value: string): void
  stderr(value: string): void
}

export const REVIEWED_ASSOCIATIONS: readonly ReviewedAssociation[] = [
  { rowNo: 1, matchStatus: 'candidate', sourcePath: 'งานคลังเลือด/7.SDS 70_ alcohol.pdf', evidenceSha256: '55f06e664a4e59a3a28804e75f87e93b8b6b1356cb698d3e51442919ea420826', validationRule: 'scorer_candidate', reviewReason: 'Filename evidence for 70% alcohol; exact product label remains to be reviewed.', product: { name: '70% Alcohol', aliases: ['70 alcohol', 'Ethanol'], casNumber: null, concentration: null } },
  { rowNo: 2, matchStatus: 'mismatch', sourcePath: 'ห้องสารเคมี/1 Acetic acid.pdf', evidenceSha256: '617421596a59679a939a4b40b4886cf9761e1cf2de2cb1fb3781aa3be6529a90', validationRule: 'hard_identity_mismatch', reviewReason: 'The selected file identifies sodium acetate rather than acetic acid.', product: { name: 'Acetic acid', casNumber: '64-19-7', concentration: null } },
  { rowNo: 3, matchStatus: 'candidate', sourcePath: 'ห้องสารเคมี/31 Acetonitrile.pdf', evidenceSha256: '716f0eeac5cfb25e657af765d7b1c682e82b2f886ee7144a25d66cfe9fe66c51', validationRule: 'scorer_candidate', reviewReason: 'Name evidence is plausible; exact CAS, grade, and supplier remain to be reviewed.', product: { name: 'Acetonitrile', casNumber: null, concentration: null } },
  { rowNo: 4, matchStatus: 'mismatch', sourcePath: 'ห้องสารเคมี/3-5 Ammonia.pdf', evidenceSha256: '507c69ee614612f185e64177ae5340234324a343b3d642b188c025ea7887f29e', validationRule: 'hard_identity_mismatch', reviewReason: 'The selected file describes anhydrous ammonia, not the listed 25% solution.', product: { name: 'Ammonia', aliases: ['Ammonia solution 25%'], casNumber: '1336-21-6', concentration: '25%' } },
  { rowNo: 5, matchStatus: 'mismatch', sourcePath: 'ห้องสารเคมี/3-5 Ammonia.pdf', evidenceSha256: '507c69ee614612f185e64177ae5340234324a343b3d642b188c025ea7887f29e', validationRule: 'hard_identity_mismatch', reviewReason: 'The selected file describes anhydrous ammonia, not the listed 28% solution.', product: { name: 'Ammonia', aliases: ['Ammonia solution 28%'], casNumber: '1336-21-6', concentration: '28%' } },
  { rowNo: 6, matchStatus: 'mismatch', sourcePath: 'ห้องสารเคมี/3-5 Ammonia.pdf', evidenceSha256: '507c69ee614612f185e64177ae5340234324a343b3d642b188c025ea7887f29e', validationRule: 'hard_identity_mismatch', reviewReason: 'The selected file describes anhydrous ammonia, not the listed 30% solution.', product: { name: 'Ammonia', aliases: ['Ammonia solution 30%'], casNumber: '1336-21-6', concentration: '30%' } },
  { rowNo: 7, matchStatus: 'missing', validationRule: 'missing_full_archive', reviewReason: 'No product-specific alcohol hand-rub SDS was found in the supplied archive.', product: { name: 'Alcohol hand rub', casNumber: null, concentration: null } },
  { rowNo: 8, matchStatus: 'candidate', sourcePath: 'ห้องสารเคมี/6 Citric acid.pdf', evidenceSha256: '631b90a50c784886e43849e9566ead76c6d373b1f84cc91618701d41609e767e', validationRule: 'scorer_candidate', reviewReason: 'Name evidence is plausible; hydrate form and exact product remain to be reviewed.', product: { name: 'Citric acid', casNumber: null, concentration: null } },
  { rowNo: 9, matchStatus: 'candidate', sourcePath: 'ห้องสารเคมี/7 Dichloromethane.pdf', evidenceSha256: '138830277e6f1ea1746d5ea7bd040db15a2657b3000d11ce6dfff44853d1ec79', validationRule: 'scorer_candidate', reviewReason: 'Name evidence is plausible; exact product remains to be reviewed.', product: { name: 'Dichloromethane', casNumber: null, concentration: null } },
  { rowNo: 10, matchStatus: 'candidate', sourcePath: 'ห้องสารเคมี/8 Ethanol.pdf', evidenceSha256: 'd10b7072c475d334c7ebf07adae6a5d09257b50499f784634b8622846902fbc6', validationRule: 'scorer_candidate', reviewReason: 'Name evidence is plausible; exact product and grade remain to be reviewed.', product: { name: 'Ethanol', casNumber: null, concentration: null } },
  { rowNo: 11, matchStatus: 'mismatch', sourcePath: 'ห้องสารเคมี/9 Ethyl alcohol 95_.pdf', evidenceSha256: 'd10b7072c475d334c7ebf07adae6a5d09257b50499f784634b8622846902fbc6', validationRule: 'concentration_not_confirmed', reviewReason: 'The selected ethanol file does not confirm the listed 95% concentration.', product: { name: 'Ethyl alcohol', aliases: ['Ethanol'], casNumber: null, concentration: '95%' } },
  { rowNo: 12, matchStatus: 'candidate', sourcePath: 'ห้องสารเคมี/30.formaldehyde.pdf', evidenceSha256: 'de120560ab92e51c9c0c0c9d9377453f2128328c0af49f9a37433749883a73f4', validationRule: 'scorer_candidate', reviewReason: 'Formaldehyde name evidence is plausible for formalin; solution identity remains to be reviewed.', product: { name: 'Formalin', aliases: ['Formaldehyde'], casNumber: null, concentration: null } },
  { rowNo: 13, matchStatus: 'candidate', sourcePath: 'ห้องสารเคมี/33 Formic acid.pdf', evidenceSha256: 'fed4343d73a111b27faf2bd39555779353a6b899e758305fbc935b140fd46afe', validationRule: 'scorer_candidate', reviewReason: 'Name evidence is plausible; exact product remains to be reviewed.', product: { name: 'Formic acid', casNumber: null, concentration: null } },
  { rowNo: 14, matchStatus: 'candidate', sourcePath: 'ห้องสารเคมี/11 Hydrochloric acid.pdf', evidenceSha256: 'ac04c9736e775f4aab1f4289dbed8e2af3039cc26e5c05ee2db6004d288b3e14', validationRule: 'scorer_candidate', reviewReason: 'Name evidence is plausible; the listed 37% concentration remains to be reviewed.', product: { name: 'Hydrochloric acid', casNumber: null, concentration: null } },
  { rowNo: 15, matchStatus: 'candidate', sourcePath: 'ห้องสารเคมี/36 Methanol.pdf', evidenceSha256: '41bf90fa198a4003417488b7fa15b817ef941b1ad5948131cb78dfcf2209f99d', validationRule: 'scorer_candidate', reviewReason: 'Name evidence is plausible; exact product remains to be reviewed.', product: { name: 'Methanol', casNumber: null, concentration: null } },
  { rowNo: 16, matchStatus: 'candidate', sourcePath: 'ห้องสารเคมี/25 Papanicolaou_s solution 1a Harris hematoxylin solution.pdf', evidenceSha256: 'f50f90ec92c1380d315de88f309e92ac39af664a6665afa46ef1ff4422de0d9d', validationRule: 'scorer_candidate', reviewReason: 'Product-name evidence is plausible; exact stain product remains to be reviewed.', product: { name: 'Papanicolaou’s solution 1a Harris hematoxylin solution', aliases: ["Papanicolaou's solution 1a Harris hematoxylin solution"], casNumber: null, concentration: null } },
  { rowNo: 17, matchStatus: 'missing', validationRule: 'missing_full_archive', reviewReason: 'No product-specific Papanicolaou solution 2a (OG6) SDS was found.', product: { name: 'Papanicolaou solution 2a OG6', casNumber: null, concentration: null } },
  { rowNo: 18, matchStatus: 'missing', validationRule: 'missing_full_archive', reviewReason: 'No product-specific Papanicolaou solution 3b (EA50) SDS was found.', product: { name: 'Papanicolaou solution 3b EA50', casNumber: null, concentration: null } },
  { rowNo: 19, matchStatus: 'missing', validationRule: 'missing_full_archive', reviewReason: 'No product-specific Permount/Toluene solution SDS was found.', product: { name: 'Permount Toluene solution', casNumber: null, concentration: null } },
  { rowNo: 20, matchStatus: 'candidate', sourcePath: 'ห้องสารเคมี/24 Propan-2-ol.pdf', evidenceSha256: 'a052489d21f8b0804855896fba519b80f6066f4b3f455b3052ca428d525ee0c3', validationRule: 'scorer_candidate', reviewReason: 'Name evidence is plausible; exact product remains to be reviewed.', product: { name: 'Propan-2-ol', aliases: ['Isopropanol'], casNumber: null, concentration: null } },
  { rowNo: 21, matchStatus: 'candidate', sourcePath: 'ห้องสารเคมี/13 Sodium acetate.pdf', evidenceSha256: 'ef342289bbbd3d7fd6f6bd2f8d86d484261d83ac9a8ef00ab9517992a87605e5', validationRule: 'scorer_candidate', reviewReason: 'Name evidence is plausible; anhydrous form remains to be reviewed.', product: { name: 'Sodium acetate', casNumber: null, concentration: null } },
  { rowNo: 22, matchStatus: 'candidate', sourcePath: 'ห้องสารเคมี/14 Sulfuric acid.pdf', evidenceSha256: '61fbc5b14af503ff6e2a61a3e8d116723ec10e7d016b04dd52d89492486a0e5d', validationRule: 'scorer_candidate', reviewReason: 'Name evidence is plausible; exact product remains to be reviewed.', product: { name: 'Sulfuric acid', aliases: ['Sulphuric acid'], casNumber: null, concentration: null } },
  { rowNo: 23, matchStatus: 'mismatch', sourcePath: 'ห้องสารเคมี/32 Trifluoroacetic acid.pdf', evidenceSha256: 'b2a2d7bead57a12fe4e4671bcbd6cad9977158355d987e88f0c25ae8a495e1c2', validationRule: 'hard_identity_mismatch', reviewReason: 'The selected file identifies deuterated TFA rather than trifluoroacetic acid.', product: { name: 'Trifluoroacetic acid', casNumber: '76-05-1', concentration: null } },
  { rowNo: 24, matchStatus: 'mismatch', sourcePath: 'ห้องสารเคมี/15 Wright_s  Eosin Methylene blue.PDF', evidenceSha256: '547015d9c9abcd0e322e82a69d4d0402fe90adf5ee635aa460ee5f0a89c2a62d', validationRule: 'identity_not_confirmed', reviewReason: 'The selected stain file does not clearly identify the listed Wright’s Baso product.', product: { name: 'Wright’s Baso', casNumber: null, concentration: null } },
  { rowNo: 25, matchStatus: 'missing', validationRule: 'missing_full_archive', reviewReason: 'No product-specific xylene SDS was found in the supplied archive.', product: { name: 'Xylene', casNumber: null, concentration: null } },
] as const

export async function runChemicalSafetyCli(
  args: readonly string[],
  dependencies: ChemicalSafetyCliDependencies = {},
  io: ChemicalSafetyCliIo = {
    stdout: value => { process.stdout.write(value) },
    stderr: value => { process.stderr.write(value) },
  },
): Promise<number> {
  try {
    const options = parseCli(args)
    const prepared = await prepareImport(options, dependencies.preparation)
    if (options.apply) {
      assertApplyBaseline(prepared.summary)
      await applyImport(prepared, dependencies.loadApplyRuntime)
    }
    io.stdout(`${JSON.stringify(prepared.summary)}\n`)
    return 0
  } catch (error) {
    io.stderr(`${redactCliError(error, args)}\n`)
    return 1
  }
}

export function parseCli(args: readonly string[]): CliOptions {
  const values = new Map<string, string>()
  let apply = false

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--apply') {
      if (apply) throw new Error('Duplicate argument: --apply')
      apply = true
      continue
    }
    if (!['--masterlist', '--layout', '--sds-root'].includes(argument)) {
      throw new Error(`Unexpected argument: ${argument}`)
    }
    if (values.has(argument)) throw new Error(`Duplicate argument: ${argument}`)
    const value = args[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`)
    values.set(argument, value)
    index += 1
  }

  for (const required of ['--masterlist', '--layout', '--sds-root']) {
    if (!values.has(required)) {
      throw new Error(`Missing required argument: ${required}`)
    }
  }

  return {
    masterlistPath: resolve(values.get('--masterlist')!),
    layoutPath: resolve(values.get('--layout')!),
    sdsRootPath: resolve(values.get('--sds-root')!),
    apply,
  }
}

export async function prepareImport(
  options: CliOptions,
  dependencyOverrides: Partial<PreparationDependencies> = {},
): Promise<PreparedImport> {
  const dependencies: PreparationDependencies = {
    readMasterlist: readJune2026Masterlist,
    assertSourceFile,
    indexSdsArchive,
    reviewPolicy: {
      archiveSha256: REVIEWED_ARCHIVE_SHA256,
      associations: REVIEWED_ASSOCIATIONS,
    },
    ...dependencyOverrides,
  }
  await assertRegularSource(options.masterlistPath, '.pdf', '--masterlist')
  await assertRegularSource(options.layoutPath, '.png', '--layout')
  const masterlist = await dependencies.readMasterlist(options.masterlistPath)
  const layoutSha256 = await dependencies.assertSourceFile(options.layoutPath, LAYOUT_SHA256)
  const proposals = buildJune2026NormalizedProposals(masterlist.rows)
  const files = await dependencies.indexSdsArchive(options.sdsRootPath)

  if (masterlist.sha256 !== JUNE_2026_MASTERLIST_SHA256) {
    throw new Error('Unexpected June 2026 master-list source hash')
  }
  if (masterlist.rows.length !== 25 || proposals.length !== 25) {
    throw new Error(`Unexpected master-list row count: ${masterlist.rows.length}`)
  }
  if (CHEMICAL_PREP_LOCATIONS.length !== 13) {
    throw new Error(`Unexpected chemical storage location count: ${CHEMICAL_PREP_LOCATIONS.length}`)
  }

  const fileTypes = countFileTypes(files)
  if (fileTypes.pdf === 0) throw new Error('The SDS archive contains zero PDF files')
  const archiveSha256 = hashArchiveManifest(files)
  const associations = validateReviewedAssociations(files, dependencies.reviewPolicy)
  const apply = options.apply
  const summary: ImportSummary = {
    mode: apply ? 'apply' : 'dry-run',
    masterlistRows: masterlist.rows.length,
    positions: CHEMICAL_PREP_LOCATIONS.length,
    archiveFiles: files.length,
    fileTypes,
    laterDuplicates: files.filter(file => file.duplicateOfSha256 !== null).length,
    candidate: associations.filter(item => item.matchStatus === 'candidate').length,
    mismatch: associations.filter(item => item.matchStatus === 'mismatch').length,
    missing: associations.filter(item => item.matchStatus === 'missing').length,
    quantityConflicts: proposals.filter(proposal => proposal.quantityConflict).length,
    masterlistSha256: masterlist.sha256,
    layoutSha256,
    archiveSha256,
    batchHashes: {
      masterlist: masterlist.sha256,
      layout: layoutSha256,
      sdsArchive: archiveSha256,
    },
  }

  return { options, masterlist, proposals, files, associations, summary }
}

async function assertRegularSource(path: string, extension: string, argument: string): Promise<void> {
  if (extname(path).toLowerCase() !== extension) {
    throw new Error(`${argument} must identify a ${extension} file`)
  }
  const stats = await lstat(path)
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`${argument} must identify a regular file`)
  }
}

function countFileTypes(files: readonly SdsIndexedFile[]): ImportSummary['fileTypes'] {
  return {
    pdf: files.filter(file => file.extension === '.pdf').length,
    docx: files.filter(file => file.extension === '.docx').length,
    doc: files.filter(file => file.extension === '.doc').length,
    html: files.filter(file => file.extension === '.html').length,
  }
}

export function validateReviewedAssociations(
  files: readonly SdsIndexedFile[],
  policy: ReviewedAssociationPolicy,
): ResolvedAssociation[] {
  if (!/^[a-f0-9]{64}$/.test(policy.archiveSha256)) {
    throw new Error('Reviewed archive hash must be a lowercase SHA-256 value')
  }
  const indexedByPath = new Map(files.map(file => [file.relativePath, file]))
  for (const association of policy.associations) {
    if (!association.sourcePath || !association.evidenceSha256) continue
    if (!/^[a-f0-9]{64}$/.test(association.evidenceSha256)) {
      throw new Error(`Reviewed SDS evidence hash is invalid for row ${association.rowNo}`)
    }
    const evidence = indexedByPath.get(association.sourcePath)
    if (evidence && evidence.sha256 !== association.evidenceSha256) {
      throw new Error(`Reviewed SDS evidence hash differs for row ${association.rowNo}`)
    }
  }
  const actualArchiveSha256 = hashArchiveManifest(files)
  if (actualArchiveSha256 !== policy.archiveSha256) {
    throw new Error('SDS evidence does not match the reviewed archive hash')
  }
  if (policy.associations.length !== 25) {
    throw new Error(`Unexpected reviewed association count: ${policy.associations.length}`)
  }
  const rowNumbers = new Set(policy.associations.map(association => association.rowNo))
  if (rowNumbers.size !== 25 || [...rowNumbers].some(rowNo => rowNo < 1 || rowNo > 25)) {
    throw new Error('Reviewed associations must contain each master-list row exactly once')
  }

  return policy.associations.map(association => {
    if (!association.sourcePath) {
      if (
        association.matchStatus !== 'missing'
        || association.validationRule !== 'missing_full_archive'
        || association.evidenceSha256 !== undefined
      ) {
        throw new Error(`Association row ${association.rowNo} status does not match its validation rule`)
      }
      const viableEvidence = files.find(file => {
        const score = scoreSdsCandidate(association.product, {
          fileName: basename(file.relativePath),
          extractedText: file.extractedText,
          sha256: file.sha256,
        })
        return classifySdsCandidate(score) === 'candidate'
      })
      if (viableEvidence) {
        throw new Error(`Viable evidence exists for reviewed missing row ${association.rowNo}`)
      }
      return {
        rowNo: association.rowNo,
        matchStatus: association.matchStatus,
        reviewReason: association.reviewReason,
        file: null,
        score: null,
        automatedClassification: null,
      }
    }

    if (association.matchStatus === 'missing' || association.validationRule === 'missing_full_archive') {
      throw new Error(`Association row ${association.rowNo} status does not match its validation rule`)
    }
    if (!association.evidenceSha256) {
      throw new Error(`Reviewed SDS evidence hash is absent for row ${association.rowNo}`)
    }
    const file = indexedByPath.get(association.sourcePath)
    if (!file) throw new Error(`Reviewed SDS evidence is absent for row ${association.rowNo}`)
    if (file.extension !== '.pdf') throw new Error(`Reviewed SDS evidence is not a PDF for row ${association.rowNo}`)
    if (file.sha256 !== association.evidenceSha256) {
      throw new Error(`Reviewed SDS evidence hash differs for row ${association.rowNo}`)
    }
    const score = scoreSdsCandidate(association.product, {
      fileName: basename(file.relativePath),
      extractedText: file.extractedText,
      sha256: file.sha256,
    })
    const automatedClassification = classifySdsCandidate(score)
    if (association.validationRule === 'scorer_candidate') {
      if (association.matchStatus !== 'candidate') {
        throw new Error(`Association row ${association.rowNo} status does not match its validation rule`)
      }
      if (automatedClassification !== 'candidate' || score.positiveEvidence.length === 0) {
        throw new Error(`Conservative scorer rejected the reviewed candidate for row ${association.rowNo}`)
      }
    } else {
      if (association.matchStatus !== 'mismatch') {
        throw new Error(`Association row ${association.rowNo} status does not match its validation rule`)
      }
      if (association.validationRule === 'hard_identity_mismatch' && (!score.hardMismatch || automatedClassification !== 'mismatch')) {
        throw new Error(`Hard identity mismatch was not established for row ${association.rowNo}`)
      }
      if (association.validationRule === 'concentration_not_confirmed' && (
        score.concentrationConfirmed
        || !score.negativeEvidence.some(item => item.includes('concentration not confirmed'))
      )) {
        throw new Error(`Concentration mismatch was not established for row ${association.rowNo}`)
      }
      if (association.validationRule === 'identity_not_confirmed' && automatedClassification !== 'mismatch') {
        throw new Error(`Identity mismatch was not established for row ${association.rowNo}`)
      }
    }

    return {
      rowNo: association.rowNo,
      matchStatus: association.matchStatus,
      reviewReason: association.reviewReason,
      file,
      score,
      automatedClassification,
    }
  })
}

export function hashArchiveManifest(files: readonly SdsIndexedFile[]): string {
  const lines = files
    .map(file => `${file.relativePath}:${file.sha256}`)
    .sort(compareText)
  return createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex')
}

function assertApplyBaseline(summary: ImportSummary): void {
  const expected = {
    masterlistRows: 25,
    positions: 13,
    archiveFiles: 556,
    fileTypes: { pdf: 521, docx: 18, doc: 16, html: 1 },
    candidate: 13,
    mismatch: 7,
    missing: 5,
    quantityConflicts: 5,
  }
  for (const field of ['masterlistRows', 'positions', 'archiveFiles', 'candidate', 'mismatch', 'missing', 'quantityConflicts'] as const) {
    if (summary[field] !== expected[field]) {
      throw new Error(`Apply blocked by unexpected ${field}: ${summary[field]}`)
    }
  }
  for (const extension of ['pdf', 'docx', 'doc', 'html'] as const) {
    if (summary.fileTypes[extension] !== expected.fileTypes[extension]) {
      throw new Error(`Apply blocked by unexpected ${extension.toUpperCase()} count: ${summary.fileTypes[extension]}`)
    }
  }
}

export async function applyImport(
  prepared: PreparedImport,
  loadRuntime?: () => Promise<ApplyRuntime>,
): Promise<void> {
  let runtime: ApplyRuntime
  if (loadRuntime) {
    runtime = await loadRuntime()
  } else {
    const dotenv = await import('dotenv')
    dotenv.default.config({ path: '.env.local', quiet: true })
    const [{ supabaseAdmin }, { r2, R2_BUCKET }, aws] = await Promise.all([
      import('../lib/supabase/admin'),
      import('../lib/r2/client'),
      import('@aws-sdk/client-s3'),
    ])
    const clients: ApplyClients = {
      supabase: supabaseAdmin as SupabaseClient,
      r2: r2 as S3Client,
      bucket: R2_BUCKET,
      HeadObjectCommand: aws.HeadObjectCommand,
      PutObjectCommand: aws.PutObjectCommand,
    }
    runtime = {
      database: createSupabaseDatabase(clients.supabase),
      objects: {
        exists: key => objectExists(clients, key),
        async put(key, bytes, contentType) {
          await clients.r2.send(new clients.PutObjectCommand({
            Bucket: clients.bucket,
            Key: key,
            Body: bytes,
            ContentType: contentType,
          }))
        },
      },
      files: {
        read: path => readFile(path),
        async assertRegular(path) {
          const stats = await lstat(path)
          if (stats.isSymbolicLink() || !stats.isFile()) throw new Error('SDS evidence changed after indexing')
        },
      },
    }
  }
  const masterlistKey = buildChemicalSourceKey(prepared.summary.masterlistSha256, basename(prepared.options.masterlistPath))
  const layoutKey = buildChemicalSourceKey(prepared.summary.layoutSha256, basename(prepared.options.layoutPath))
  assertPrivateKey(masterlistKey, PRIVATE_SOURCE_PREFIX)
  assertPrivateKey(layoutKey, PRIVATE_SOURCE_PREFIX)
  const processingBatchIds: string[] = []
  let batches: { masterlist?: ImportBatch; layout?: ImportBatch; archive?: ImportBatch } = {}

  try {
    batches.masterlist = await runtime.database.ensureBatch({
      source_kind: 'chemical-masterlist-june-2026',
      source_name: basename(prepared.options.masterlistPath),
      source_path: prepared.options.masterlistPath,
      source_sha256: prepared.summary.masterlistSha256,
      source_r2_key: masterlistKey,
      parser_version: PARSER_VERSION,
      status: 'processing',
      summary: prepared.summary,
      imported_by: null,
    })
    if (batches.masterlist.needsProcessing) processingBatchIds.push(batches.masterlist.id)

    batches.layout = await runtime.database.ensureBatch({
      source_kind: 'chemical-layout-2026-02-02',
      source_name: basename(prepared.options.layoutPath),
      source_path: prepared.options.layoutPath,
      source_sha256: prepared.summary.layoutSha256,
      source_r2_key: layoutKey,
      parser_version: PARSER_VERSION,
      status: 'processing',
      summary: prepared.summary,
      imported_by: null,
    })
    if (batches.layout.needsProcessing) processingBatchIds.push(batches.layout.id)

    batches.archive = await runtime.database.ensureBatch({
      source_kind: 'chemical-sds-archive',
      source_name: basename(prepared.options.sdsRootPath),
      source_path: prepared.options.sdsRootPath,
      source_sha256: prepared.summary.archiveSha256,
      source_r2_key: null,
      parser_version: PARSER_VERSION,
      status: 'processing',
      summary: prepared.summary,
      imported_by: null,
    })
    if (batches.archive.needsProcessing) processingBatchIds.push(batches.archive.id)

    if (batches.masterlist.needsProcessing) {
      await uploadSourceIfAbsent(runtime, masterlistKey, prepared.options.masterlistPath, prepared.summary.masterlistSha256, 'application/pdf')
      await upsertInChunks(
        runtime.database,
        'chemical_import_rows',
        buildMasterlistRows(batches.masterlist.id, prepared),
        'batch_id,row_key',
      )
    }

    if (batches.layout.needsProcessing) {
      await uploadSourceIfAbsent(runtime, layoutKey, prepared.options.layoutPath, prepared.summary.layoutSha256, 'image/png')
      await upsertInChunks(
        runtime.database,
        'chemical_import_rows',
        CHEMICAL_PREP_LOCATIONS.map(location => ({
          batch_id: batches.layout!.id,
          row_key: location.code,
          raw_data: { sourceImageSha256: prepared.summary.layoutSha256, locationCode: location.code },
          normalized_data: { ...location, proposalState: 'quarantine' },
          match_status: 'unsupported',
          conflict_codes: [],
          target_product_id: null,
        })),
        'batch_id,row_key',
      )
    }

    if (batches.archive.needsProcessing) {
      await uploadUniquePdfEvidence(runtime, prepared.files)
      await upsertInChunks(
        runtime.database,
        'chemical_sds_files',
        buildSdsFileRows(prepared.files),
        'sha256',
      )
      await upsertInChunks(
        runtime.database,
        'chemical_import_rows',
        buildArchiveRows(batches.archive.id, prepared.files),
        'batch_id,row_key',
      )
    }

    if (processingBatchIds.length > 0) {
      await runtime.database.ensureAudit(batches.archive.id, prepared.summary)
      await runtime.database.completeBatches(processingBatchIds, prepared.summary)
    }
  } catch (error) {
    if (processingBatchIds.length > 0) {
      try {
        await runtime.database.failBatches(processingBatchIds, {
          ...prepared.summary,
          error: redactCliError(error, cliArgsFromOptions(prepared.options)),
        })
      } catch (failureError) {
        throw new AggregateError([error, failureError], 'Chemical safety import failed and failed-batch evidence could not be recorded')
      }
    }
    throw error
  }
}

async function ensureImportBatch(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<ImportBatch> {
  const inserted = await supabase
    .from('chemical_import_batches')
    .upsert(payload, { onConflict: 'source_kind,source_sha256', ignoreDuplicates: true })
    .select('id,status')
    .maybeSingle()
  assertDbResult(inserted, 'create chemical import batch')

  const selected = inserted.data
    ? inserted
    : await supabase
      .from('chemical_import_batches')
      .select('id,status')
      .eq('source_kind', payload.source_kind)
      .eq('source_sha256', payload.source_sha256)
      .single()
  assertDbResult(selected, 'reuse chemical import batch')
  const row = selected.data as { id: string; status: string } | null
  if (!row) throw new Error('Chemical import batch was not returned')

  if (TERMINAL_BATCH_STATUSES.has(row.status)) {
    return { ...row, needsProcessing: false }
  }

  const resumed = await supabase
    .from('chemical_import_batches')
    .update({ status: 'processing', summary: payload.summary })
    .eq('id', row.id)
    .select('id,status')
    .single()
  assertDbResult(resumed, 'resume chemical import batch')
  const resumedRow = resumed.data as { id: string; status: string } | null
  if (!resumedRow) throw new Error('Resumed chemical import batch was not returned')
  return { ...resumedRow, needsProcessing: true }
}

function createSupabaseDatabase(supabase: SupabaseClient): ChemicalImportDatabase {
  return {
    ensureBatch: payload => ensureImportBatch(supabase, payload),
    async upsertRows(table, rows, onConflict) {
      const result = await supabase.from(table).upsert(rows, { onConflict })
      assertDbResult(result, `upsert ${table}`)
    },
    ensureAudit: (archiveBatchId, summary) => ensureImportAudit(supabase, archiveBatchId, summary),
    async completeBatches(ids, summary) {
      const result = await supabase
        .from('chemical_import_batches')
        .update({ status: 'completed', summary })
        .in('id', ids)
        .select('id')
      assertDbResult(result, 'complete chemical import batches')
      assertReturnedIds(result.data, ids, 'complete chemical import batches')
    },
    async failBatches(ids, summary) {
      const result = await supabase
        .from('chemical_import_batches')
        .update({ status: 'failed', summary })
        .in('id', ids)
        .select('id')
      assertDbResult(result, 'record failed chemical import batches')
      assertReturnedIds(result.data, ids, 'record failed chemical import batches')
    },
  }
}

function buildMasterlistRows(batchId: string, prepared: PreparedImport): Record<string, unknown>[] {
  const associationByRow = new Map(prepared.associations.map(item => [item.rowNo, item]))
  const proposalByRow = new Map(prepared.proposals.map(item => [item.rawRowNo, item]))

  return prepared.masterlist.rows.map((rawRow: MasterlistRawRow) => {
    const proposal = proposalByRow.get(rawRow.no)
    const association = associationByRow.get(rawRow.no)
    if (!proposal || !association) throw new Error(`Missing normalized import evidence for row ${rawRow.no}`)
    return {
      batch_id: batchId,
      row_key: String(rawRow.no),
      raw_data: rawRow,
      normalized_data: {
        ...proposal,
        proposalState: 'quarantine',
        sdsEvidence: association.file ? {
          sourcePath: association.file.relativePath,
          sha256: association.file.sha256,
          automatedClassification: association.automatedClassification,
          score: association.score?.score ?? null,
          positiveEvidence: association.score?.positiveEvidence ?? [],
          negativeEvidence: association.score?.negativeEvidence ?? [],
          reviewReason: association.reviewReason,
        } : {
          sourcePath: null,
          sha256: null,
          automatedClassification: null,
          score: null,
          positiveEvidence: [],
          negativeEvidence: [],
          reviewReason: association.reviewReason,
        },
      },
      match_status: association.matchStatus,
      conflict_codes: [
        ...(proposal.quantityConflict ? ['quantity_conflict'] : []),
        ...(association.matchStatus === 'mismatch' ? ['sds_identity_mismatch'] : []),
        ...(association.matchStatus === 'missing' ? ['sds_missing'] : []),
      ],
      target_product_id: null,
    }
  })
}

function buildSdsFileRows(files: readonly SdsIndexedFile[]): Record<string, unknown>[] {
  const pdfGroups = new Map<string, SdsIndexedFile[]>()
  for (const file of files) {
    if (file.extension !== '.pdf') continue
    const group = pdfGroups.get(file.sha256) ?? []
    group.push(file)
    pdfGroups.set(file.sha256, group)
  }

  return [...pdfGroups.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([sha256, group]) => ({
      sha256,
      r2_key: buildChemicalSdsImportKey(sha256),
      file_name: basename(group[0].relativePath),
      content_type: 'application/pdf',
      size_bytes: group[0].sizeBytes,
      source_paths: group.map(file => file.relativePath).sort(compareText),
    }))
}

function buildArchiveRows(batchId: string, files: readonly SdsIndexedFile[]): Record<string, unknown>[] {
  return files.map(file => ({
    batch_id: batchId,
    row_key: file.relativePath,
    raw_data: {
      sourcePath: file.relativePath,
      sourceUnitName: file.sourceUnitName,
      extension: file.extension,
      sizeBytes: file.sizeBytes,
      sha256: file.sha256,
    },
    normalized_data: {
      importSupport: file.importSupport,
      duplicateOfSha256: file.duplicateOfSha256,
      extractedTextAvailable: file.extractedText !== null,
      proposalState: 'quarantine',
    },
    match_status: file.duplicateOfSha256 !== null
      ? 'duplicate'
      : file.importSupport === 'pdf'
        ? 'candidate'
        : 'unsupported',
    conflict_codes: [],
    target_product_id: null,
  }))
}

async function uploadSourceIfAbsent(
  runtime: ApplyRuntime,
  sourceKey: string,
  path: string,
  expectedSha256: string,
  contentType: string,
): Promise<void> {
  if (await runtime.objects.exists(sourceKey)) return
  await runtime.files.assertRegular(path)
  const bytes = await runtime.files.read(path)
  const actualSha256 = createHash('sha256').update(bytes).digest('hex')
  if (actualSha256 !== expectedSha256) throw new Error('Source file changed after validation')
  await runtime.objects.put(sourceKey, bytes, contentType)
}

async function uploadUniquePdfEvidence(runtime: ApplyRuntime, files: readonly SdsIndexedFile[]): Promise<void> {
  const uniquePdfs = new Map<string, SdsIndexedFile>()
  for (const file of files) {
    if (file.extension === '.pdf' && !uniquePdfs.has(file.sha256)) uniquePdfs.set(file.sha256, file)
  }

  for (const [sha256, file] of [...uniquePdfs.entries()].sort(([left], [right]) => compareText(left, right))) {
    const sdsKey = buildChemicalSdsImportKey(sha256)
    assertPrivateKey(sdsKey, PRIVATE_IMPORT_PREFIX)
    if (await runtime.objects.exists(sdsKey)) continue
    await runtime.files.assertRegular(file.absolutePath)
    const bytes = await runtime.files.read(file.absolutePath)
    const actualSha256 = createHash('sha256').update(bytes).digest('hex')
    if (actualSha256 !== sha256 || bytes.byteLength !== file.sizeBytes) {
      throw new Error('SDS evidence changed after indexing')
    }
    await runtime.objects.put(sdsKey, bytes, 'application/pdf')
  }
}

interface ApplyClients {
  supabase: SupabaseClient
  r2: S3Client
  bucket: string
  HeadObjectCommand: typeof import('@aws-sdk/client-s3').HeadObjectCommand
  PutObjectCommand: typeof import('@aws-sdk/client-s3').PutObjectCommand
}

async function objectExists(clients: ApplyClients, key: string): Promise<boolean> {
  try {
    await clients.r2.send(new clients.HeadObjectCommand({ Bucket: clients.bucket, Key: key }))
    return true
  } catch (error) {
    const metadata = (error as { $metadata?: { httpStatusCode?: number }; name?: string }).$metadata
    const name = (error as { name?: string }).name
    if (metadata?.httpStatusCode === 404 || name === 'NotFound' || name === 'NoSuchKey') return false
    throw error
  }
}

async function upsertInChunks(
  database: ChemicalImportDatabase,
  table: string,
  rows: readonly Record<string, unknown>[],
  onConflict: string,
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    await database.upsertRows(table, rows.slice(offset, offset + BATCH_SIZE), onConflict)
  }
}

async function ensureImportAudit(
  supabase: SupabaseClient,
  archiveBatchId: string,
  summary: ImportSummary,
): Promise<void> {
  const existing = await supabase
    .from('audit_log')
    .select('id')
    .eq('action', 'chemical_safety.import.prepared')
    .eq('target', archiveBatchId)
    .limit(1)
    .maybeSingle()
  assertDbResult(existing, 'check chemical import audit')
  if (existing.data) return

  const inserted = await supabase.from('audit_log').insert({
    action: 'chemical_safety.import.prepared',
    user_id: null,
    target: archiveBatchId,
    detail: JSON.stringify({
      mode: 'apply',
      counts: {
        masterlistRows: summary.masterlistRows,
        positions: summary.positions,
        archiveFiles: summary.archiveFiles,
        fileTypes: summary.fileTypes,
        laterDuplicates: summary.laterDuplicates,
        candidate: summary.candidate,
        mismatch: summary.mismatch,
        missing: summary.missing,
        quantityConflicts: summary.quantityConflicts,
      },
      batchHashes: summary.batchHashes,
    }),
  })
  assertDbResult(inserted, 'write chemical import audit')
}

function assertDbResult(result: { error: unknown }, operation: string): void {
  if (result.error) {
    const message = result.error instanceof Error
      ? result.error.message
      : typeof result.error === 'object' && result.error !== null && 'message' in result.error
        ? String((result.error as { message: unknown }).message)
        : String(result.error)
    throw new Error(`${operation} failed: ${message}`)
  }
}

function assertReturnedIds(data: unknown, expectedIds: readonly string[], operation: string): void {
  const returnedIds = new Set(
    Array.isArray(data)
      ? data.flatMap(row => typeof row === 'object' && row !== null && 'id' in row ? [String(row.id)] : [])
      : [],
  )
  if (expectedIds.some(id => !returnedIds.has(id))) {
    throw new Error(`${operation} did not return every requested batch`)
  }
}

export function redactCliError(error: unknown, args: readonly string[] = []): string {
  const message = error instanceof Error ? error.message : String(error)
  let redacted = message
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]
    if (!value || value.startsWith('--')) continue
    for (const localPath of [value, resolve(value)]) {
      redacted = redacted.replaceAll(localPath, '[local source]')
    }
  }
  return redacted
    .replace(/\\\\[^\\\r\n]+\\[^\r\n:]+/g, '[local source]')
    .replace(/[A-Za-z]:\\[^\r\n:]+/g, '[local source]')
    .replace(/\/(?:[^/\s:]+\/)+[^\r\n:]+/g, '[local source]')
    .slice(0, 1000)
}

function cliArgsFromOptions(options: CliOptions): string[] {
  return [
    '--masterlist', options.masterlistPath,
    '--layout', options.layoutPath,
    '--sds-root', options.sdsRootPath,
  ]
}

function assertPrivateKey(key: string, requiredPrefix: string): void {
  if (!key.startsWith(requiredPrefix) || key.includes('..')) {
    throw new Error('Unsafe chemical-safety private object key')
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

const entryPoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entryPoint) {
  void runChemicalSafetyCli(process.argv.slice(2)).then(exitCode => {
    process.exitCode = exitCode
  })
}
