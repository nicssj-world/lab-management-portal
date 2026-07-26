import { createHash } from 'node:crypto'
import { constants, type Dirent, type Stats } from 'node:fs'
import { lstat, open, readdir, realpath } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'

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
  const rootStats = await lstatWithoutLinkedComponents(absoluteRoot)
  if (!rootStats.isDirectory()) throw new Error(`SDS archive root is not a directory: ${rootPath}`)
  const canonicalRoot = await realpath(absoluteRoot)

  const entries = await readdir(absoluteRoot, { recursive: true, withFileTypes: true })
  const supportedFiles = entries
    .filter(entry => entry.isFile() && !entry.isSymbolicLink())
    .map(entry => indexedPath(absoluteRoot, entry))
    .filter((entry): entry is IndexedPath => entry !== null)
    .sort((left, right) => compareText(left.relativePath, right.relativePath))

  const seenHashes = new Set<string>()
  const indexed: SdsIndexedFile[] = []
  for (const entry of supportedFiles) {
    const bytes = await readContainedRegularFile(entry.absolutePath, canonicalRoot)
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

async function readContainedRegularFile(absolutePath: string, canonicalRoot: string): Promise<Buffer> {
  const beforeStats = await validateCandidatePath(absolutePath, canonicalRoot)
  const noFollowFlag = constants.O_NOFOLLOW
  const handle = await open(
    absolutePath,
    noFollowFlag === undefined ? constants.O_RDONLY : constants.O_RDONLY | noFollowFlag,
  )

  try {
    const openedStats = await handle.stat()
    if (!openedStats.isFile()) throw new Error(`SDS archive candidate is not a regular file: ${absolutePath}`)
    if (!sameFile(beforeStats, openedStats)) {
      throw new Error(`SDS archive candidate changed before it could be read: ${absolutePath}`)
    }

    const afterStats = await validateCandidatePath(absolutePath, canonicalRoot)
    if (!sameFile(openedStats, afterStats)) {
      throw new Error(`SDS archive candidate changed while it was being opened: ${absolutePath}`)
    }
    return await handle.readFile()
  } finally {
    await handle.close()
  }
}

async function validateCandidatePath(absolutePath: string, canonicalRoot: string): Promise<Stats> {
  const stats = await lstatWithoutLinkedComponents(absolutePath)
  if (!stats.isFile()) throw new Error(`SDS archive candidate is not a regular file: ${absolutePath}`)

  const canonicalPath = await realpath(absolutePath)
  const canonicalRelativePath = relative(canonicalRoot, canonicalPath)
  if (
    canonicalRelativePath === ''
    || canonicalRelativePath === '..'
    || canonicalRelativePath.startsWith(`..${sep}`)
    || isAbsolute(canonicalRelativePath)
  ) {
    throw new Error(`SDS archive candidate escapes the canonical archive root: ${absolutePath}`)
  }
  return stats
}

async function lstatWithoutLinkedComponents(absolutePath: string): Promise<Stats> {
  const components: string[] = []
  let currentPath = resolve(absolutePath)
  while (true) {
    components.push(currentPath)
    const parentPath = dirname(currentPath)
    if (parentPath === currentPath) break
    currentPath = parentPath
  }

  let targetStats: Stats | null = null
  for (const componentPath of components.reverse()) {
    const componentStats = await lstat(componentPath)
    if (componentStats.isSymbolicLink()) {
      throw new Error(`SDS archive path contains a symbolic link, junction, or reparse point: ${componentPath}`)
    }
    targetStats = componentStats
  }
  if (!targetStats) throw new Error(`Unable to inspect SDS archive path: ${absolutePath}`)
  return targetStats
}

function sameFile(left: Stats, right: Stats): boolean {
  if (left.dev !== 0 || left.ino !== 0 || right.dev !== 0 || right.ino !== 0) {
    return left.dev === right.dev && left.ino === right.ino
  }
  return left.size === right.size
    && left.birthtimeMs === right.birthtimeMs
    && left.mtimeMs === right.mtimeMs
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

export type SdsPdfLoader = (bytes: Uint8Array) => Promise<SdsPdfProxy>

export async function extractEvidenceText(
  extension: SdsEvidenceExtension,
  bytes: Buffer,
  loadPdf: SdsPdfLoader = getDocumentProxy,
): Promise<string | null> {
  try {
    if (extension === '.pdf') {
      const pdf = await loadPdf(new Uint8Array(bytes))
      return await extractFirstTwoPdfPages(pdf)
    }
    if (extension === '.docx') {
      const result = await mammoth.extractRawText({ buffer: bytes })
      return result.value.trim() || null
    }
  } catch {
    return null
  }
  return null
}

export interface SdsPdfProxy {
  numPages: number
  getPage(pageNumber: number): Promise<{
    getTextContent(): Promise<{ items: readonly unknown[] }>
  }>
  destroy(): Promise<void>
}

export async function extractFirstTwoPdfPages(pdf: SdsPdfProxy): Promise<string | null> {
  try {
    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 2); pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push(content.items
        .filter(isPdfTextItem)
        .map(item => `${item.str}${item.hasEOL ? '\n' : ''}`)
        .join(''))
    }
    const extracted = pages.join('\n').replace(/\s+/g, ' ').trim()
    return extracted || null
  } finally {
    await pdf.destroy()
  }
}

function isPdfTextItem(item: unknown): item is { str: string; hasEOL?: boolean } {
  return typeof item === 'object'
    && item !== null
    && 'str' in item
    && typeof (item as { str?: unknown }).str === 'string'
}

function sourceUnitName(rootPath: string, relativePath: string): string {
  const firstSeparator = relativePath.indexOf('/')
  return firstSeparator === -1 ? basename(rootPath) : relativePath.slice(0, firstSeparator)
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
