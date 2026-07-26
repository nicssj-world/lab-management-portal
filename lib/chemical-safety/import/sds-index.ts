import { createHash } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { lstat, readFile, readdir } from 'node:fs/promises'
import { basename, extname, isAbsolute, relative, resolve, sep } from 'node:path'

import mammoth from 'mammoth'
import { getDocumentProxy } from 'unpdf'

export type SdsEvidenceExtension = '.pdf' | '.docx' | '.doc' | '.html'

export interface SdsIndexedFile {
  absolutePath: string
  relativePath: string
  sourceUnitName: string
  extension: SdsEvidenceExtension
  sizeBytes: number
  sha256: string
  extractedText: string | null
  importSupport: 'pdf' | 'metadata_only'
  duplicateOfSha256: string | null
}

const SUPPORTED_EXTENSIONS = new Set<SdsEvidenceExtension>(['.pdf', '.docx', '.doc', '.html'])

export async function indexSdsArchive(rootPath: string): Promise<SdsIndexedFile[]> {
  const absoluteRoot = resolve(rootPath)
  const rootStats = await lstat(absoluteRoot)
  if (rootStats.isSymbolicLink()) throw new Error(`SDS archive root must not be a symbolic link: ${rootPath}`)
  if (!rootStats.isDirectory()) throw new Error(`SDS archive root is not a directory: ${rootPath}`)

  const entries = await readdir(absoluteRoot, { recursive: true, withFileTypes: true })
  const supportedFiles = entries
    .filter(entry => entry.isFile() && !entry.isSymbolicLink())
    .map(entry => indexedPath(absoluteRoot, entry))
    .filter((entry): entry is IndexedPath => entry !== null)
    .sort((left, right) => compareText(left.relativePath, right.relativePath))

  const seenHashes = new Set<string>()
  const indexed: SdsIndexedFile[] = []
  for (const entry of supportedFiles) {
    const bytes = await readFile(entry.absolutePath)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const duplicateOfSha256 = seenHashes.has(sha256) ? sha256 : null
    seenHashes.add(sha256)

    indexed.push({
      absolutePath: entry.absolutePath,
      relativePath: entry.relativePath,
      sourceUnitName: sourceUnitName(absoluteRoot, entry.relativePath),
      extension: entry.extension,
      sizeBytes: bytes.byteLength,
      sha256,
      extractedText: await extractEvidenceText(entry.extension, bytes),
      importSupport: entry.extension === '.pdf' ? 'pdf' : 'metadata_only',
      duplicateOfSha256,
    })
  }

  return indexed
}

interface IndexedPath {
  absolutePath: string
  relativePath: string
  extension: SdsEvidenceExtension
}

function indexedPath(rootPath: string, entry: Dirent): IndexedPath | null {
  const entryWithParent = entry as Dirent & { parentPath?: string }
  const parentPath = entryWithParent.parentPath ?? entry.path
  const absolutePath = resolve(parentPath, entry.name)
  const nativeRelativePath = relative(rootPath, absolutePath)
  if (nativeRelativePath === '' || nativeRelativePath === '..' || nativeRelativePath.startsWith(`..${sep}`) || isAbsolute(nativeRelativePath)) {
    throw new Error(`Archive entry escapes the SDS root: ${absolutePath}`)
  }

  const extension = extname(entry.name).toLowerCase() as SdsEvidenceExtension
  if (!SUPPORTED_EXTENSIONS.has(extension)) return null

  return {
    absolutePath,
    relativePath: nativeRelativePath.split(sep).join('/'),
    extension,
  }
}

async function extractEvidenceText(extension: SdsEvidenceExtension, bytes: Buffer): Promise<string | null> {
  try {
    if (extension === '.pdf') return extractFirstTwoPdfPages(bytes)
    if (extension === '.docx') {
      const result = await mammoth.extractRawText({ buffer: bytes })
      return result.value.trim() || null
    }
  } catch {
    return null
  }
  return null
}

async function extractFirstTwoPdfPages(bytes: Buffer): Promise<string | null> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes))
  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 2); pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(content.items
      .filter((item): item is typeof item & { str: string; hasEOL?: boolean } => 'str' in item)
      .map(item => `${item.str}${item.hasEOL ? '\n' : ''}`)
      .join(''))
  }
  const extracted = pages.join('\n').replace(/\s+/g, ' ').trim()
  return extracted || null
}

function sourceUnitName(rootPath: string, relativePath: string): string {
  const firstSeparator = relativePath.indexOf('/')
  return firstSeparator === -1 ? basename(rootPath) : relativePath.slice(0, firstSeparator)
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
