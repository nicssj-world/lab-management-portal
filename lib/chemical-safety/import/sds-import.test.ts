import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

import JSZip from 'jszip'
import { PDFDocument, StandardFonts } from 'pdf-lib'

import {
  CHEMICAL_PDF_MAX_BYTES,
  CHEMICAL_PDF_MIN_BYTES,
  buildChemicalSdsImportKey,
  buildChemicalSourceKey,
  isPdfSignature,
  safeChemicalFilename,
  validateChemicalPdf,
} from '../files'
import { indexSdsArchive } from './sds-index'
import { classifySdsCandidate, scoreSdsCandidate } from './sds-match'

const pdfSignature = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])

function candidate(fileName: string, extractedText: string | null, shaCharacter: string) {
  return { fileName, extractedText, sha256: shaCharacter.repeat(64) }
}

const aceticMismatch = scoreSdsCandidate(
  { name: 'Acetic acid', casNumber: '64-19-7', concentration: null },
  candidate('Acetic acid.pdf', 'Sodium acetate CAS 127-09-3', 'a'),
)
assert.equal(classifySdsCandidate(aceticMismatch), 'mismatch')
assert.equal(aceticMismatch.hardMismatch, true)
assert.ok(aceticMismatch.negativeEvidence.some(evidence => evidence.includes('127-09-3')))

const tfaMismatch = scoreSdsCandidate(
  { name: 'Trifluoroacetic acid', casNumber: '76-05-1', concentration: null },
  candidate('Trifluoroacetic acid.pdf', 'TFA-d CAS 599-00-8', 'b'),
)
assert.equal(classifySdsCandidate(tfaMismatch), 'mismatch')
assert.equal(tfaMismatch.hardMismatch, true)

const alcoholCandidate = scoreSdsCandidate(
  { name: '70% Alcohol', aliases: ['Ethanol'], casNumber: '64-17-5', concentration: '70%', productCode: '05S0031' },
  candidate('RCI Ethanol 70%.pdf', 'Ethanol 70% CAS 64-17-5 product 05S0031', 'c'),
)
assert.equal(classifySdsCandidate(alcoholCandidate), 'candidate')
assert.equal(alcoholCandidate.exactCas, true)
assert.equal(alcoholCandidate.concentrationConfirmed, true)
assert.equal(alcoholCandidate.hardMismatch, false)
assert.ok(alcoholCandidate.positiveEvidence.some(evidence => evidence.includes('product code')))

const conflictingCas = scoreSdsCandidate(
  { name: 'Ethanol', casNumber: '64-17-5', concentration: null },
  candidate('Ethanol.pdf', 'Ethanol CAS 64-17-5; contaminant CAS 67-56-1', 'd'),
)
assert.equal(conflictingCas.exactCas, true)
assert.equal(conflictingCas.hardMismatch, true, 'any conflicting CAS is a hard mismatch')
assert.equal(classifySdsCandidate(conflictingCas), 'mismatch')

const filenameOnly = scoreSdsCandidate(
  { name: 'Citric acid', casNumber: '77-92-9', concentration: null },
  candidate('Citric acid.pdf', null, 'e'),
)
assert.equal(classifySdsCandidate(filenameOnly), 'candidate', 'filename-only evidence stays reviewable')
assert.equal(filenameOnly.exactCas, false)

const missingConcentration = scoreSdsCandidate(
  { name: 'Hydrochloric acid', casNumber: '7647-01-0', concentration: '37%' },
  candidate('Hydrochloric acid.pdf', 'Hydrochloric acid CAS 7647-01-0', 'f'),
)
assert.equal(missingConcentration.exactCas, true)
assert.equal(missingConcentration.concentrationConfirmed, false)
assert.equal(classifySdsCandidate(missingConcentration), 'candidate')
assert.ok(missingConcentration.negativeEvidence.includes('concentration not confirmed: 37%'))

const independentMetadata = scoreSdsCandidate(
  { name: 'Methanol', casNumber: null, concentration: null, manufacturer: 'Merck', supplier: 'Sigma', productCode: 'M-123' },
  candidate('unlabelled.pdf', 'Manufacturer: Merck\nSupplier: Sigma\nProduct code: M-123', '1'),
)
assert.equal(classifySdsCandidate(independentMetadata), 'candidate')
assert.ok(independentMetadata.positiveEvidence.includes('manufacturer confirmed: Merck'))
assert.ok(independentMetadata.positiveEvidence.includes('supplier confirmed: Sigma'))
assert.ok(independentMetadata.positiveEvidence.includes('product code confirmed: M-123'))

assert.deepEqual(validateChemicalPdf('สารเคมี-01.pdf', 'application/pdf', CHEMICAL_PDF_MIN_BYTES, pdfSignature), { ok: true })
assert.deepEqual(validateChemicalPdf('สารเคมี-01.PDF', 'application/pdf', CHEMICAL_PDF_MAX_BYTES, pdfSignature), { ok: true })
assert.equal(validateChemicalPdf('สารเคมี-01.pdf', 'application/pdf', CHEMICAL_PDF_MIN_BYTES - 1, pdfSignature).ok, false)
assert.equal(validateChemicalPdf('สารเคมี-01.pdf', 'application/pdf', CHEMICAL_PDF_MAX_BYTES + 1, pdfSignature).ok, false)
assert.equal(validateChemicalPdf('สารเคมี-01.pdf', 'application/pdf; charset=binary', CHEMICAL_PDF_MIN_BYTES, pdfSignature).ok, false)
assert.equal(validateChemicalPdf('สารเคมี-01.doc', 'application/pdf', CHEMICAL_PDF_MIN_BYTES, pdfSignature).ok, false)
assert.equal(validateChemicalPdf('สารเคมี-01.pdf', 'application/pdf', CHEMICAL_PDF_MIN_BYTES, new Uint8Array([0x50, 0x4b, 0x03, 0x04])).ok, false)
assert.equal(isPdfSignature(pdfSignature), true)
assert.equal(isPdfSignature(new Uint8Array([0x25, 0x50, 0x44, 0x46])), false)
assert.equal(isPdfSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14])), false)

assert.equal(safeChemicalFilename('Acetic acid (สารเคมี)/37%?.pdf'), 'Acetic_acid__สารเคมี__37__.pdf')
assert.equal(safeChemicalFilename('..\\..\\ความลับ.pdf'), '____ความลับ.pdf')
assert.doesNotMatch(safeChemicalFilename('../../escape.pdf'), /\.\./)
assert.equal(safeChemicalFilename(''), 'chemical-sds.pdf')
const hash = 'A'.repeat(64)
assert.equal(
  buildChemicalSourceKey(hash, '..\\..\\ความลับ.pdf'),
  `chemical-safety/sources/${hash.toLowerCase()}-____ความลับ.pdf`,
)
assert.equal(buildChemicalSdsImportKey(hash), `chemical-safety/imports/${hash.toLowerCase()}.pdf`)
assert.throws(() => buildChemicalSourceKey('../../escape', 'safe.pdf'), /SHA-256/)
assert.throws(() => buildChemicalSdsImportKey('f'.repeat(63)), /SHA-256/)

async function createThreePagePdf() {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  for (const text of ['FIRST PAGE SDS IDENTITY', 'SECOND PAGE SDS HAZARDS', 'THIRD PAGE MUST NOT BE EXTRACTED']) {
    const page = document.addPage([420, 300])
    page.drawText(text, { x: 40, y: 240, font, size: 14 })
  }
  return document.save()
}

async function createDocx() {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`)
  zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`)
  zip.folder('word')?.file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body><w:p><w:r><w:t>DOCX RAW SDS TEXT</w:t></w:r></w:p></w:body>
    </w:document>`)
  return zip.generateAsync({ type: 'uint8array' })
}

async function testArchiveIndex() {
  const rootPath = await mkdtemp(join(tmpdir(), 'chemical-sds-index-'))
  try {
    const firstUnit = join(rootPath, 'unit-a')
    const nestedUnit = join(rootPath, 'unit-b', 'nested')
    await mkdir(firstUnit, { recursive: true })
    await mkdir(nestedUnit, { recursive: true })

    const pdfBytes = await createThreePagePdf()
    const expectedPdfHash = createHash('sha256').update(pdfBytes).digest('hex')
    await writeFile(join(firstUnit, 'duplicate-a.pdf'), pdfBytes)
    await writeFile(join(nestedUnit, 'duplicate-b.pdf'), pdfBytes)
    await writeFile(join(rootPath, 'unit-b', 'legacy.doc'), new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]))
    await writeFile(join(rootPath, 'archive-note.html'), '<html><body>legacy index only</body></html>')
    await writeFile(join(rootPath, 'unit-b', 'raw.docx'), await createDocx())
    await writeFile(join(rootPath, 'ignored.txt'), 'not SDS evidence')

    let symlinkCreated = false
    try {
      await symlink(firstUnit, join(rootPath, 'linked-unit'), 'junction')
      symlinkCreated = true
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'EPERM' && code !== 'EACCES' && code !== 'ENOTSUP') throw error
    }

    const indexed = await indexSdsArchive(rootPath)
    assert.deepEqual(indexed.map(file => file.relativePath), [
      'archive-note.html',
      'unit-a/duplicate-a.pdf',
      'unit-b/legacy.doc',
      'unit-b/nested/duplicate-b.pdf',
      'unit-b/raw.docx',
    ])
    assert.equal(indexed.some(file => file.relativePath === 'ignored.txt'), false)
    if (symlinkCreated) {
      assert.equal(indexed.some(file => file.relativePath.startsWith('linked-unit/')), false, 'symbolic links are not followed')
      await assert.rejects(indexSdsArchive(join(rootPath, 'linked-unit')), /symbolic link/, 'a symbolic-link root is rejected')
    }

    const rootHtml = indexed.find(file => file.relativePath === 'archive-note.html')
    assert.equal(rootHtml?.sourceUnitName, basename(rootPath))
    assert.equal(rootHtml?.importSupport, 'metadata_only')
    assert.equal(rootHtml?.extractedText, null)

    const firstPdf = indexed.find(file => file.relativePath === 'unit-a/duplicate-a.pdf')
    const duplicatePdf = indexed.find(file => file.relativePath === 'unit-b/nested/duplicate-b.pdf')
    assert.equal(firstPdf?.sourceUnitName, 'unit-a')
    assert.equal(firstPdf?.sha256, expectedPdfHash)
    assert.equal(firstPdf?.duplicateOfSha256, null)
    assert.equal(duplicatePdf?.sha256, expectedPdfHash)
    assert.equal(duplicatePdf?.duplicateOfSha256, expectedPdfHash)
    assert.match(firstPdf?.extractedText ?? '', /FIRST PAGE SDS IDENTITY/)
    assert.match(firstPdf?.extractedText ?? '', /SECOND PAGE SDS HAZARDS/)
    assert.doesNotMatch(firstPdf?.extractedText ?? '', /THIRD PAGE MUST NOT BE EXTRACTED/)

    const doc = indexed.find(file => file.relativePath === 'unit-b/legacy.doc')
    assert.equal(doc?.extension, '.doc')
    assert.equal(doc?.importSupport, 'metadata_only')
    assert.equal(doc?.extractedText, null)

    const docx = indexed.find(file => file.relativePath === 'unit-b/raw.docx')
    assert.equal(docx?.importSupport, 'metadata_only')
    assert.match(docx?.extractedText ?? '', /DOCX RAW SDS TEXT/)

    assert.deepEqual(
      (await indexSdsArchive(rootPath)).map(file => ({ relativePath: file.relativePath, sha256: file.sha256, duplicateOfSha256: file.duplicateOfSha256 })),
      indexed.map(file => ({ relativePath: file.relativePath, sha256: file.sha256, duplicateOfSha256: file.duplicateOfSha256 })),
      'index ordering and duplicate selection are deterministic',
    )
  } finally {
    await rm(rootPath, { recursive: true, force: true })
  }
}

void testArchiveIndex().then(() => {
  console.log('chemical safety SDS import tests passed')
})
