# Viewer/Public Uncontrolled PDF Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve a clearly stamped, cached “uncontrolled copy” to document-role Viewer and public users for Published QM/QP/WI/MN PDFs, without modifying the official PDF and without stamping any recognizable revision-history page.

**Architecture:** Keep the existing R2 official object authoritative. On the first eligible preview/download, render/analyze the PDF, stamp safe pages, and store one derived object at `documents/uncontrolled/{documentId}/current.pdf`; R2 metadata records the source-key hash and stamp version so a new revision overwrites the stale derivative automatically. Viewer/Public always resolve through the derived copy, while workflow roles continue to receive the official file.

**Tech Stack:** Next.js 16.2 Route Handlers (Node.js runtime), TypeScript, `pdf-lib`, `@pdf-lib/fontkit`, `pdfjs-dist`, `@napi-rs/canvas`, AWS S3 client for Cloudflare R2.

## Global Constraints

- Eligible document values are exactly `QM`, `QP`, `WI`, and `Manual` (UI label MN), with `status === 'Published'` and an official PDF matching `documents.file_url`.
- Audiences are authenticated users with `actor.doc_role === 'Viewer'` and all callers of the public download endpoint; workflow roles keep the official file.
- Preview and explicit download must use the same uncontrolled derivative so an original PDF cannot be saved from the preview path.
- Stamp text is exactly `เอกสารไม่ควบคุม กรุณาตรวจสอบฉบับปัจจุบันก่อนใช้งาน`.
- Preferred style is TH Sarabun New Bold, 20 pt, RGB `#FF5959`, one line, horizontally centered, no background, border, or rule.
- Preferred baseline is 12 mm below the page CropBox top; keep at least 12 mm horizontal margins and shrink only on narrower pages.
- Never move, resize, crop, or cover original page content. Analyze the top band before stamping; if no safe size of at least 12 pt fits, fail closed and never return the official PDF.
- Skip Portal history pages carrying `CARS_PORTAL_REVISION_HISTORY` and legacy text-layer pages recognizable by the revision-history heading/form code. Do not add OCR; an unrecognized scanned history page is stamped.
- Cache only one derivative per document. A source-key hash or stamp-version mismatch regenerates and overwrites `current.pdf`; no database migration is required.
- Read the relevant Next.js guide in `node_modules/next/dist/docs/` immediately before editing Route Handlers, per `AGENTS.md`.
- No new protected route is added, so `proxy.ts` is unchanged.

---

### Task 1: Uncontrolled-copy policy and page-layout analysis

**Files:**
- Create: `lib/documents/uncontrolled-copy.ts`
- Create: `lib/documents/uncontrolled-copy.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `isUncontrolledCopyType(type)`, `shouldUseUncontrolledCopy(input)`, `isRevisionHistoryText(text)`, `chooseStampLayout(input)`, `UnsafeStampLayoutError`.
- Consumes later: Task 2 uses these functions to decide eligibility and stamp placement.

- [ ] **Step 1: Add the canvas dependency used to inspect rendered top margins**

Run:

```powershell
npm install @napi-rs/canvas
```

Expected: `package.json` and `package-lock.json` contain `@napi-rs/canvas`; no other dependency versions change unexpectedly.

- [ ] **Step 2: Write failing pure-policy and layout tests**

Create `lib/documents/uncontrolled-copy.test.ts` with assertions covering:

```ts
import assert from 'node:assert/strict'
import {
  UnsafeStampLayoutError,
  chooseStampLayout,
  isRevisionHistoryText,
  shouldUseUncontrolledCopy,
} from './uncontrolled-copy'

const base = {
  documentId: 'doc-1',
  requestedPath: 'documents/doc-1/final.pdf',
  officialPath: 'documents/doc-1/final.pdf',
  type: 'QP',
  status: 'Published',
  fileName: 'QP-LAB-22.pdf',
  mimeType: 'application/pdf',
}

assert.equal(shouldUseUncontrolledCopy({ ...base, audience: 'viewer' }), true)
assert.equal(shouldUseUncontrolledCopy({ ...base, audience: 'public' }), true)
assert.equal(shouldUseUncontrolledCopy({ ...base, audience: 'staff' }), false)
assert.equal(shouldUseUncontrolledCopy({ ...base, type: 'Manual', audience: 'viewer' }), true)
assert.equal(shouldUseUncontrolledCopy({ ...base, type: 'Form', audience: 'viewer' }), false)
assert.equal(shouldUseUncontrolledCopy({ ...base, status: 'Draft', audience: 'viewer' }), false)
assert.equal(shouldUseUncontrolledCopy({ ...base, requestedPath: 'documents/doc-1/source.docx', audience: 'viewer' }), false)

assert.equal(isRevisionHistoryText('CARS_PORTAL_REVISION_HISTORY'), true)
assert.equal(isRevisionHistoryText('แบบบันทึกประวัติการแก้ไข / ทบทวนเอกสาร'), true)
assert.equal(isRevisionHistoryText('Fm-QP-LAB-01/03'), true)
assert.equal(isRevisionHistoryText('5.0 ระเบียบปฏิบัติงาน'), false)

assert.deepEqual(chooseStampLayout({ pageWidthPt: 595.28, firstInkTopMm: 15.5 }), {
  fontSizePt: 20,
  baselineTopMm: 12,
})
assert.equal(chooseStampLayout({ pageWidthPt: 420, firstInkTopMm: 15.5 }).fontSizePt < 20, true)
assert.throws(
  () => chooseStampLayout({ pageWidthPt: 595.28, firstInkTopMm: 8 }),
  UnsafeStampLayoutError,
)
```

- [ ] **Step 3: Run the policy test and verify it fails**

Run:

```powershell
npx tsx lib/documents/uncontrolled-copy.test.ts
```

Expected: FAIL because `uncontrolled-copy.ts` does not exist.

- [ ] **Step 4: Implement policy constants, normalization, and fail-closed layout selection**

Create `lib/documents/uncontrolled-copy.ts` with these exported contracts:

```ts
export const UNCONTROLLED_COPY_VERSION = 'uncontrolled-v1'
export const UNCONTROLLED_TEXT = 'เอกสารไม่ควบคุม กรุณาตรวจสอบฉบับปัจจุบันก่อนใช้งาน'
export const UNCONTROLLED_TYPES = ['QM', 'QP', 'WI', 'Manual'] as const
export const STAMP_COLOR = { r: 1, g: 0.35, b: 0.35 } as const
export const PREFERRED_FONT_SIZE_PT = 20
export const MIN_FONT_SIZE_PT = 12
export const BASELINE_TOP_MM = 12
export const SIDE_MARGIN_MM = 12
export const CONTENT_GAP_MM = 3

export type UncontrolledAudience = 'viewer' | 'public' | 'staff'
export type UncontrolledEligibilityInput = {
  documentId: string
  requestedPath: string
  officialPath: string | null
  type: string | null
  status: string | null
  fileName: string | null
  mimeType: string | null
  audience: UncontrolledAudience
}

export class UnsafeStampLayoutError extends Error {
  readonly code = 'UNCONTROLLED_STAMP_UNSAFE_PAGE'
}

export function isUncontrolledCopyType(type: string | null | undefined): boolean
export function shouldUseUncontrolledCopy(input: UncontrolledEligibilityInput): boolean
export function isRevisionHistoryText(text: string): boolean
export function chooseStampLayout(input: {
  pageWidthPt: number
  firstInkTopMm: number
  textWidthAt20Pt?: number
}): { fontSizePt: number; baselineTopMm: number }
```

Normalize history text by lowercasing, collapsing whitespace, and removing spaces around `/` and `-`. Treat a page as history if it contains the Portal marker, `แบบบันทึกประวัติการแก้ไข`, or normalized `fm-qp-lab-01/03`. `chooseStampLayout` starts at 20 pt, shrinks for the 12 mm side margins and measured first-ink boundary, and throws below 12 pt.

- [ ] **Step 5: Add rendered top-band measurement**

Add an internal `measureFirstInkTopMm(page, viewport)` that renders the unmodified page at scale 1 with `@napi-rs/canvas`, scans rows from the CropBox top, and returns the first row containing a pixel whose RGB channels are below 245. Treat a full-page non-white background or a render failure as unsafe rather than guessing. Export only this test seam:

```ts
export function firstInkRowFromRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  whiteThreshold?: number,
): number | null
```

Extend the test with synthetic RGBA buffers proving that blank rows are ignored, gray/colored ink is detected, and all-white pages return `null`.

- [ ] **Step 6: Run the test until it passes**

Run:

```powershell
npx tsx lib/documents/uncontrolled-copy.test.ts
```

Expected: exit code 0 with no assertion output.

- [ ] **Step 7: Commit the policy/layout unit**

```powershell
git add package.json package-lock.json lib/documents/uncontrolled-copy.ts lib/documents/uncontrolled-copy.test.ts
git commit -m "feat: define uncontrolled PDF stamp policy"
```

---

### Task 2: PDF stamping and deterministic R2 lazy cache

**Files:**
- Modify: `lib/documents/uncontrolled-copy.ts`
- Create: `lib/documents/uncontrolled-copy-cache.ts`
- Create: `lib/documents/uncontrolled-copy-cache.test.ts`

**Interfaces:**
- Consumes: policy/layout exports from Task 1, `r2`, `R2_BUCKET`, and the existing TH Sarabun New Bold font.
- Produces: `stampUncontrolledPdf(bytes)` and `resolveUncontrolledCopy(document, dependencies?)`.

- [ ] **Step 1: Write failing PDF-transform tests with synthetic portrait, landscape, narrow, history, and unsafe pages**

Generate test PDFs in memory with `pdf-lib`; do not commit binary fixtures. Assert:

```ts
const result = await stampUncontrolledPdf(sourceBytes)
assert.equal(result.stampedPages, 3)
assert.equal(result.skippedHistoryPages, 2)
assert.equal(result.pageCount, 5)
assert.equal(result.appliedFontSizes.every((size) => size >= 12 && size <= 20), true)
```

Also assert that a page whose rendered ink enters the reserved band rejects with `UnsafeStampLayoutError`, and an image-only non-history page is measured from rendered pixels rather than treated as blank.

- [ ] **Step 2: Run the transform tests and verify they fail**

Run:

```powershell
npx tsx lib/documents/uncontrolled-copy.test.ts
```

Expected: FAIL because `stampUncontrolledPdf` is not implemented.

- [ ] **Step 3: Implement the transform**

Add:

```ts
export type StampUncontrolledResult = {
  bytes: Uint8Array
  pageCount: number
  stampedPages: number
  skippedHistoryPages: number
  appliedFontSizes: number[]
}

export async function stampUncontrolledPdf(
  source: Uint8Array | Buffer,
): Promise<StampUncontrolledResult>
```

Load with `ignoreEncryption: true`, register fontkit, and embed `THSarabunNew_bold-webfont.ttf` without subsetting for consistent rendering. Use PDF.js text extraction to classify history pages; skip classification matches before running top-band analysis. For other pages, measure the rendered first-ink boundary, choose the safe size, center within the CropBox, and draw at the calculated baseline using `#FF5959`. Save once after all pages.

- [ ] **Step 4: Write failing cache hit/miss/stale tests with injected R2 dependencies**

Define a fake store and verify:

```ts
const first = await resolveUncontrolledCopy(document, fakeDependencies)
assert.equal(first.cacheStatus, 'generated')
assert.equal(fake.puts.length, 1)

const second = await resolveUncontrolledCopy(document, fakeDependencies)
assert.equal(second.cacheStatus, 'hit')
assert.equal(fake.puts.length, 1)

document.file_url = 'documents/doc-1/revision-11.pdf'
const third = await resolveUncontrolledCopy(document, fakeDependencies)
assert.equal(third.cacheStatus, 'regenerated')
assert.equal(fake.puts.length, 2)
assert.equal(third.key, 'documents/uncontrolled/doc-1/current.pdf')
```

- [ ] **Step 5: Implement the R2 resolver**

Create `lib/documents/uncontrolled-copy-cache.ts`:

```ts
export type CacheableDocument = {
  id: string
  file_url: string
  file_name: string | null
  mime_type: string | null
  type: string
  status: string
}

export type ResolvedUncontrolledCopy = {
  key: string
  contentType: 'application/pdf'
  cacheStatus: 'hit' | 'generated' | 'regenerated'
  size: number
}

export async function resolveUncontrolledCopy(
  document: CacheableDocument,
  dependencies?: UncontrolledCacheDependencies,
): Promise<ResolvedUncontrolledCopy>
```

Use `documents/uncontrolled/{id}/current.pdf`. SHA-256 the official `file_url`; a `HeadObject` is a hit only when metadata `source-key-sha256` and `stamp-version` match. Otherwise `GetObject` the official PDF, call `stampUncontrolledPdf`, and `PutObject` the result with `ContentType: application/pdf` plus both metadata fields. Concurrent misses may overwrite the same deterministic key safely.

- [ ] **Step 6: Run transform/cache tests**

```powershell
npx tsx lib/documents/uncontrolled-copy.test.ts
npx tsx lib/documents/uncontrolled-copy-cache.test.ts
```

Expected: both exit 0; no R2 network call occurs in unit tests.

- [ ] **Step 7: Commit the transformer/cache unit**

```powershell
git add lib/documents/uncontrolled-copy.ts lib/documents/uncontrolled-copy.test.ts lib/documents/uncontrolled-copy-cache.ts lib/documents/uncontrolled-copy-cache.test.ts
git commit -m "feat: generate cached uncontrolled PDF copies"
```

---

### Task 3: Route Viewer/Public preview and download through the derivative

**Files:**
- Modify: `app/api/admin/documents/download/route.ts`
- Modify: `app/api/documents/download/route.ts`
- Create: `lib/documents/uncontrolled-download.test.ts`

**Interfaces:**
- Consumes: `shouldUseUncontrolledCopy` and `resolveUncontrolledCopy`.
- Preserves: existing `{ url }` JSON for normal downloads and byte-range proxy behavior for PDF.js preview.

- [ ] **Step 1: Re-read the installed Next.js Route Handler documentation**

Run:

```powershell
Get-Content -Raw node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md
Get-Content -Raw node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md
```

Expected: confirm GET Route Handlers remain dynamic when they use request/auth/database data and support native `Response` streaming.

- [ ] **Step 2: Write failing audience/route-decision tests**

Create `lib/documents/uncontrolled-download.test.ts` to assert that:

```ts
assert.equal(resolveDownloadAudience({ publicRoute: true, actor: null }), 'public')
assert.equal(resolveDownloadAudience({ publicRoute: false, actor: { doc_role: 'Viewer' } }), 'viewer')
assert.equal(resolveDownloadAudience({ publicRoute: false, actor: { doc_role: 'Document Controller' } }), 'staff')
```

Also test that an eligible QM/QP/WI/Manual non-PDF produces an explicit `unsupported-controlled-format` decision instead of falling back to the official file.

- [ ] **Step 3: Run the route-decision test and verify it fails**

```powershell
npx tsx lib/documents/uncontrolled-download.test.ts
```

Expected: FAIL because the route decision helpers are missing.

- [ ] **Step 4: Update the authenticated route**

In `app/api/admin/documents/download/route.ts`, retain the original requested path for staff. When `actor.doc_role === 'Viewer'` and the request is for the Published official PDF of QM/QP/WI/Manual, resolve the derivative key before both branches:

```ts
const servedPath = shouldUseUncontrolledCopy(eligibility)
  ? (await resolveUncontrolledCopy(asCacheableDocument(docRow))).key
  : path
```

Use `servedPath` in `GetObjectCommand` for proxy/range responses and signed URLs. Preserve filename/content disposition and the existing access log. If an eligible type is not PDF, return 415. If analysis/stamping/cache generation fails, log document id plus the stable error code and return 503; never fall back to `path` for Viewer.

- [ ] **Step 5: Update and harden the public route**

In `app/api/documents/download/route.ts`, require both `visibility === 'Public'` and `status === 'Published'`. Apply the same derivative resolution for official QM/QP/WI/Manual PDFs, proxy/range responses, signed URLs, 415 behavior, and fail-closed 503 behavior. Other document types retain current behavior.

- [ ] **Step 6: Run focused regressions**

```powershell
npx tsx lib/documents/uncontrolled-download.test.ts
npx tsx scripts/pdf-viewer.test.ts
npx tsx scripts/test-public-document-access.test.ts
npx tsx scripts/test-document-access.test.ts
```

Expected: all exit 0; existing URL shape remains compatible and Viewer/Public proxy URLs still use `inline=1&proxy=1`.

- [ ] **Step 7: Commit route integration**

```powershell
git add app/api/admin/documents/download/route.ts app/api/documents/download/route.ts lib/documents/uncontrolled-download.test.ts
git commit -m "feat: serve uncontrolled copies to viewers and public users"
```

---

### Task 4: Corpus validation, visual QA, and deployment checks

**Files:**
- Create: `scripts/validate-uncontrolled-pdfs.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: the stamping/layout module and read-only document/R2 metadata.
- Produces: a local JSON summary only; it must not upload derivatives unless explicitly passed `--write-cache` (not used during validation).

- [ ] **Step 1: Add local-artifact ignores**

Add:

```gitignore
/.superpowers/
/tmp/
/output/
```

Do not stage or alter unrelated untracked files.

- [ ] **Step 2: Implement a read-only corpus validator**

Create `scripts/validate-uncontrolled-pdfs.ts` to query non-deleted Published `QM/QP/WI/Manual` rows, read current PDF objects, run analysis/stamping in memory, and print JSON totals for eligible, safe, unsafe, history pages skipped, pages stamped, input bytes, and projected derivative bytes. Exit 1 if any PDF is unsafe or cannot be parsed.

- [ ] **Step 3: Validate the full current corpus**

```powershell
npx tsx --env-file=.env.local scripts/validate-uncontrolled-pdfs.ts
```

Expected: 170 eligible PDFs are inspected, zero unsafe/failed PDFs, and no `documents/uncontrolled/` object is written.

- [ ] **Step 4: Verify the supplied QP-LAB-22 sample visually**

Run the validator’s `--input` mode against:

```text
E:\ISO\ISO15189\Upload\QM&QP\QP-LAB-22 การออกรายงานผลโดยระบบอัตโนมัติ .pdf
```

Render all five resulting pages to PNG. Confirm 20 pt centered text, baseline 12 mm below the top, no clipping/overlap, at least 4.5 mm clearance on pages 2–3, and correct history-page skipping under the finalized classifier.

- [ ] **Step 5: Run build and complete regression checks**

```powershell
npx tsc --noEmit
npm run build
npx tsx lib/documents/uncontrolled-copy.test.ts
npx tsx lib/documents/uncontrolled-copy-cache.test.ts
npx tsx lib/documents/uncontrolled-download.test.ts
```

Expected: all commands exit 0 and the Next.js build reports no Route Handler/runtime incompatibility.

- [ ] **Step 6: Install Vercel CLI before deployment verification**

The Vercel CLI is currently unavailable. Install it before environment pull, preview deployment, or production-log verification:

```powershell
npm i -g vercel
vercel env pull
vercel deploy
```

Expected: preview deployment succeeds. Verify as Viewer and anonymous public user that preview and download both resolve to the same stamped copy, while Document Controller receives the official copy. Promote only after checking portrait, landscape, history, range requests, cache miss, cache hit, and revision-change regeneration.

- [ ] **Step 7: Commit validation tooling**

```powershell
git add .gitignore scripts/validate-uncontrolled-pdfs.ts
git commit -m "test: validate uncontrolled PDF copies"
```

## Acceptance Summary

- Viewer/Public receive stamped derivatives only for Published official QM/QP/WI/MN PDFs; staff workflow roles and unrelated types retain existing behavior.
- Every stamped page is single-line, centered, preferred 20 pt `#FF5959`, baseline 12 mm below CropBox top, with no overlap or content movement.
- Portal and recognizable legacy revision-history pages are skipped; scanned/unrecognized history is conservatively stamped without OCR.
- Cache has at most one current derivative per document and regenerates when source key or stamp version changes.
- Unsafe/failed stamping returns an error and never exposes the unstamped official PDF to Viewer/Public.
- Current corpus validation, unit tests, TypeScript, build, preview deployment, and visual checks all pass before production rollout.
