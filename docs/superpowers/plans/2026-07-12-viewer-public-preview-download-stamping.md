# Viewer/Public Preview and Download PDF Stamping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Give Viewer/Public a fixed stamped Preview and a dated stamped Download without ever exposing an eligible document’s official PDF URL.

**Architecture:** Keep the official R2 object immutable. Resolve explicit \`variant=preview\` and \`variant=download\` requests through two derivative keys per document: a stable Preview key and a Download key overwritten once the Bangkok calendar date changes. Workflow roles keep current official-file behavior.

**Tech Stack:** Next.js 16.2 Route Handlers, TypeScript, \`pdf-lib\`, \`@pdf-lib/fontkit\`, \`pdfjs-dist\`, \`@napi-rs/canvas\`, AWS S3 SDK for Cloudflare R2.

## Global Constraints

- Eligible source: the current \`documents.file_url\` only, with type \`QM\`, \`QP\`, \`WI\`, or persisted \`Manual\` (MN), status \`Published\`, and PDF MIME/name.
- Audience: authenticated \`doc_role === 'Viewer'\` and public callers only. Workflow roles receive the official object unchanged.
- Preview stamp: \`เอกสารไม่ควบคุม / UNCONTROLLED DOCUMENT\`, TH Sarabun New Bold 18 pt, centered, \`#FF5959\`.
- Download stamp: \`เอกสารไม่ควบคุม / UNCONTROLLED DOCUMENT - Downloaded on: DD/MM/YYYY\`, TH Sarabun New Bold 16 pt, centered, \`#FF5959\`.
- Download date is Gregorian \`dd/MM/yyyy\` in \`Asia/Bangkok\`; no time or user name appears in the PDF. Existing access logs identify the downloader.
- Use 12 mm top baseline and 12 mm side margins. Download may shrink to 13.5 pt only when needed. Any page that cannot fit safely fails closed; never send its official PDF to Viewer/Public.
- Skip Portal history marker \`CARS_PORTAL_REVISION_HISTORY\` and legacy history headings/form code. Do not add OCR; an unrecognized scanned page is stamped.
- Cache keys: \`documents/uncontrolled/{documentId}/preview.pdf\` and \`documents/uncontrolled/{documentId}/download-current.pdf\`. Metadata contains source-key SHA-256, transform version, variant, and download date for the Download key.
- Preview is inline; Download is attachment. PDF.js proxy URLs must always pass \`variant=preview\`.
- Read \`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md\` and \`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md\` before route edits. No protected route changes; leave \`proxy.ts\` unchanged.

---

### Task 1: Stamp policy, page safety, and PDF transformer

**Files:**
- Create: \`lib/documents/uncontrolled-pdf.ts\`
- Create: \`lib/documents/uncontrolled-pdf.test.ts\`
- Modify: \`package.json\`
- Modify: \`package-lock.json\`

**Interfaces:**
- Produces \`DeliveryVariant\`, \`UncontrolledAudience\`, \`buildStampText\`, \`shouldUseUncontrolledCopy\`, \`isRevisionHistoryText\`, \`chooseStampLayout\`, \`stampUncontrolledPdf\`, and \`UnsafeStampLayoutError\`.

- [ ] **Step 1: Add the canvas dependency**

\`\`\`powershell
npm install @napi-rs/canvas
\`\`\`

Expected: \`@napi-rs/canvas\` is in \`dependencies\`, with no unrelated version changes.

- [ ] **Step 2: Write failing policy tests**

Create \`lib/documents/uncontrolled-pdf.test.ts\` with these assertions:

\`\`\`ts
import assert from 'node:assert/strict'
import {
  UnsafeStampLayoutError, buildStampText, chooseStampLayout,
  isRevisionHistoryText, shouldUseUncontrolledCopy,
} from './uncontrolled-pdf'

const input = {
  audience: 'viewer' as const, variant: 'preview' as const,
  requestedPath: 'documents/doc-1/current.pdf', officialPath: 'documents/doc-1/current.pdf',
  type: 'QP', status: 'Published', mimeType: 'application/pdf', fileName: 'QP-LAB-01.pdf',
}
assert.equal(shouldUseUncontrolledCopy(input), true)
assert.equal(shouldUseUncontrolledCopy({ ...input, audience: 'staff' }), false)
assert.equal(shouldUseUncontrolledCopy({ ...input, type: 'Form' }), false)
assert.equal(buildStampText('preview', '12/07/2026'), 'เอกสารไม่ควบคุม / UNCONTROLLED DOCUMENT')
assert.equal(buildStampText('download', '12/07/2026'), 'เอกสารไม่ควบคุม / UNCONTROLLED DOCUMENT - Downloaded on: 12/07/2026')
assert.equal(isRevisionHistoryText('CARS_PORTAL_REVISION_HISTORY'), true)
assert.equal(isRevisionHistoryText('แบบบันทึกประวัติการแก้ไข / ทบทวนเอกสาร'), true)
assert.deepEqual(chooseStampLayout({ variant: 'preview', pageWidthPt: 595.28, firstInkTopMm: 15.5 }), { fontSizePt: 18, baselineTopMm: 12 })
assert.deepEqual(chooseStampLayout({ variant: 'download', pageWidthPt: 595.28, firstInkTopMm: 15.5 }), { fontSizePt: 16, baselineTopMm: 12 })
assert.equal(chooseStampLayout({ variant: 'download', pageWidthPt: 500, firstInkTopMm: 15.5 }).fontSizePt < 16, true)
assert.throws(() => chooseStampLayout({ variant: 'download', pageWidthPt: 595.28, firstInkTopMm: 8 }), UnsafeStampLayoutError)
\`\`\`

- [ ] **Step 3: Confirm failure**

\`\`\`powershell
npx tsx lib/documents/uncontrolled-pdf.test.ts
\`\`\`

Expected: fail because the module is absent.

- [ ] **Step 4: Implement policy and safe layout**

Export:

\`\`\`ts
export type DeliveryVariant = 'preview' | 'download'
export type UncontrolledAudience = 'viewer' | 'public' | 'staff'
export const UNCONTROLLED_TRANSFORM_VERSION = 'uncontrolled-v2'
export class UnsafeStampLayoutError extends Error { readonly code = 'UNCONTROLLED_STAMP_UNSAFE_PAGE' }
export function buildStampText(variant: DeliveryVariant, downloadDate: string): string
export function shouldUseUncontrolledCopy(input: {
  audience: UncontrolledAudience; variant: DeliveryVariant; requestedPath: string; officialPath: string | null
  type: string | null; status: string | null; mimeType: string | null; fileName: string | null
}): boolean
export function isRevisionHistoryText(text: string): boolean
export function chooseStampLayout(input: {
  variant: DeliveryVariant; pageWidthPt: number; firstInkTopMm: number
}): { fontSizePt: number; baselineTopMm: number }
\`\`\`

Normalize history strings by lowercasing and collapsing whitespace. Preview must fit at 18 pt or throw. Download starts at 16 pt and can only reduce to 13.5 pt. Both use ASCII \` - \` before the date.

- [ ] **Step 5: Add rendered page analysis and transformer tests**

Render each unmodified PDF page at scale 1 through \`pdfjs-dist\` + \`@napi-rs/canvas\`; scan from the CropBox top for first non-white ink. Add in-memory \`pdf-lib\` fixtures for portrait, landscape, image-only, history, and unsafe pages. Assert:

\`\`\`ts
const result = await stampUncontrolledPdf(bytes, { variant: 'download', downloadDate: '12/07/2026' })
assert.equal(result.text, 'เอกสารไม่ควบคุม / UNCONTROLLED DOCUMENT - Downloaded on: 12/07/2026')
assert.equal(result.stampedPages, 3)
assert.equal(result.skippedHistoryPages, 2)
assert.equal(result.fontSizes.every((size) => size >= 13.5 && size <= 16), true)
\`\`\`

- [ ] **Step 6: Implement and verify transform**

\`\`\`ts
export async function stampUncontrolledPdf(
  source: Uint8Array | Buffer,
  input: { variant: DeliveryVariant; downloadDate: string },
): Promise<{ bytes: Uint8Array; text: string; stampedPages: number; skippedHistoryPages: number; fontSizes: number[] }>
\`\`\`

Embed \`THSarabunNew_bold-webfont.ttf\` without subsetting; classify history before top-band measurement; center text in the CropBox; save once after all pages.

\`\`\`powershell
npx tsx lib/documents/uncontrolled-pdf.test.ts
git add package.json package-lock.json lib/documents/uncontrolled-pdf.ts lib/documents/uncontrolled-pdf.test.ts
git commit -m \"feat: add preview and download PDF stamps\"
\`\`\`

---

### Task 2: R2 cache with one Preview and one daily Download derivative

**Files:**
- Create: \`lib/documents/uncontrolled-pdf-cache.ts\`
- Create: \`lib/documents/uncontrolled-pdf-cache.test.ts\`

**Interfaces:**
- Produces \`resolveUncontrolledPdf(document, variant, now)\`.

- [ ] **Step 1: Write failing cache tests**

Use injected fake \`head\`, \`get\`, and \`put\` operations:

\`\`\`ts
const preview = await resolveUncontrolledPdf(doc, 'preview', bangkokNoon, fakeStore)
assert.equal(preview.key, 'documents/uncontrolled/doc-1/preview.pdf')
assert.equal(preview.cacheStatus, 'generated')
assert.equal((await resolveUncontrolledPdf(doc, 'preview', bangkokNoon, fakeStore)).cacheStatus, 'hit')

const download = await resolveUncontrolledPdf(doc, 'download', bangkokNoon, fakeStore)
assert.equal(download.key, 'documents/uncontrolled/doc-1/download-current.pdf')
assert.equal(download.downloadDate, '12/07/2026')
assert.equal((await resolveUncontrolledPdf(doc, 'download', nextBangkokDay, fakeStore)).cacheStatus, 'regenerated')
\`\`\`

- [ ] **Step 2: Implement cache resolver**

\`\`\`ts
export type CacheableDocument = {
  id: string; file_url: string; file_name: string | null; mime_type: string | null; type: string; status: string
}
export async function resolveUncontrolledPdf(
  document: CacheableDocument,
  variant: DeliveryVariant,
  now: Date,
  dependencies?: UncontrolledPdfCacheDependencies,
): Promise<{ key: string; cacheStatus: 'hit' | 'generated' | 'regenerated'; downloadDate: string | null; size: number }>
\`\`\`

Format today with \`Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric' })\`. Cache hit metadata must match source SHA-256, transform version, and variant; Download additionally matches the Bangkok date. Never create a date-suffixed key.

- [ ] **Step 3: Pass cache tests and commit**

\`\`\`powershell
npx tsx lib/documents/uncontrolled-pdf-cache.test.ts
git add lib/documents/uncontrolled-pdf-cache.ts lib/documents/uncontrolled-pdf-cache.test.ts
git commit -m \"feat: cache preview and dated download PDFs\"
\`\`\`

---

### Task 3: Explicit route variants and no original-PDF Viewer/Public URLs

**Files:**
- Create: \`lib/documents/document-delivery-variant.ts\`
- Create: \`lib/documents/document-delivery-variant.test.ts\`
- Modify: \`app/api/admin/documents/download/route.ts\`
- Modify: \`app/api/documents/download/route.ts\`
- Modify: \`app/api/admin/documents/[id]/read/route.ts\`
- Modify: \`lib/pdf-viewer-utils.ts\`
- Modify: \`scripts/pdf-viewer.test.ts\`

**Interfaces:**
- Produces \`parseDeliveryVariant\`, \`resolveDownloadAudience\`, and \`resolveServedKey\`.
- Both download routes and the read route consume the helper.

- [ ] **Step 1: Write failing selection tests**

\`\`\`ts
assert.equal(parseDeliveryVariant(null), 'download')
assert.equal(parseDeliveryVariant('preview'), 'preview')
assert.equal(resolveDownloadAudience({ publicRoute: true, actor: null }), 'public')
assert.equal(resolveDownloadAudience({ publicRoute: false, actor: { doc_role: 'Viewer' } }), 'viewer')
assert.equal(resolveDownloadAudience({ publicRoute: false, actor: { doc_role: 'Document Controller' } }), 'staff')
\`\`\`

Also test invalid variant => 422 and eligible non-PDF => explicit 415 decision.

- [ ] **Step 2: Implement route selection**

For Viewer/Public, resolve Task 2’s key. For staff, retain original key. Download defaults to \`variant=download\`; Preview is explicit. A cache/stamp failure returns 503 and never falls back to the original source.

- [ ] **Step 3: Update public/admin download routes**

Use resolved keys for both proxy/range and signed URL flows. Set inline disposition for Preview and attachment for Download. Public additionally requires \`visibility === 'Public'\` and \`status === 'Published'\`.

- [ ] **Step 4: Update document read route**

Select \`visibility\`, \`type\`, \`status\`, and \`deleted_at\`; enforce Viewer Published access. After logging the read, resolve \`variant=preview\` and sign only the resolved key. Workflow roles retain current official-file behavior.

- [ ] **Step 5: Update PDF.js proxy URL**

Change \`documentPdfProxyUrl\` to append:

\`\`\`ts
&variant=preview&inline=1&proxy=1
\`\`\`

Update \`scripts/pdf-viewer.test.ts\` expected URLs accordingly.

- [ ] **Step 6: Run regressions and commit**

\`\`\`powershell
npx tsx lib/documents/document-delivery-variant.test.ts
npx tsx scripts/pdf-viewer.test.ts
npx tsx scripts/test-public-document-access.test.ts
npx tsx scripts/test-document-access.test.ts
git add app/api/admin/documents/download/route.ts app/api/documents/download/route.ts app/api/admin/documents/[id]/read/route.ts lib/pdf-viewer-utils.ts lib/documents/document-delivery-variant.ts lib/documents/document-delivery-variant.test.ts scripts/pdf-viewer.test.ts
git commit -m \"feat: serve safe preview and dated download variants\"
\`\`\`

---

### Task 4: Make client intent explicit

**Files:**
- Modify: \`app/(public)/manual/ManualClient.tsx\`
- Modify: \`app/(protected)/staff/documents/DocumentsClient.tsx\`
- Modify: \`app/(protected)/staff/documents/master-list/MasterListClient.tsx\`
- Modify: \`app/(protected)/staff/documents/categories/CategoriesClient.tsx\`
- Modify: \`app/(protected)/staff/documents/pending/PendingClient.tsx\`
- Modify: \`components/documents/DocumentDetailModal.tsx\`
- Modify: \`components/documents/RevisionPanel.tsx\`

- [ ] **Step 1: Separate Public Manual actions**

Replace its overloaded reader call with \`openPreview(doc)\` requesting \`variant=preview&inline=1\`, then open \`PdfViewerModal\`. Add a dedicated \`download(doc)\` requesting \`variant=download\` and opening the attachment URL.

- [ ] **Step 2: Update all document preview entry points**

Every current official-document preview fetch uses \`variant=preview&inline=1\`. Every explicit download button uses \`variant=download\`. Do not alter draft, historical-revision, or attachment flows because they are not eligible current Published documents.

- [ ] **Step 3: Verify request intent and commit**

\`\`\`powershell
rg -n \"documents/download\\?path=.*(inline=1|setPdfViewer|setViewer)\" app components
npx tsc --noEmit
git add app/(public)/manual/ManualClient.tsx app/(protected)/staff/documents/DocumentsClient.tsx app/(protected)/staff/documents/master-list/MasterListClient.tsx app/(protected)/staff/documents/categories/CategoriesClient.tsx app/(protected)/staff/documents/pending/PendingClient.tsx components/documents/DocumentDetailModal.tsx components/documents/RevisionPanel.tsx
git commit -m \"feat: separate document preview from download\"
\`\`\`

Expected: every current-PDF preview has \`variant=preview\`; every download has \`variant=download\`.

---

### Task 5: Corpus validation and release gate

**Files:**
- Create: \`scripts/validate-uncontrolled-pdf-variants.ts\`
- Modify: \`.gitignore\`

- [ ] **Step 1: Ignore local artifacts**

Add exactly:

\`\`\`gitignore
/.superpowers/
/tmp/
/output/
\`\`\`

- [ ] **Step 2: Create read-only corpus validation**

Query all non-deleted Published QM/QP/WI/Manual documents; run Preview and Download transforms in memory with a fixed Bangkok date; emit JSON totals for eligible/safe/unsafe files, page counts, history skips, and output bytes. Exit 1 for an unsafe or unparsable file and never write R2.

- [ ] **Step 3: Validate all existing PDFs**

\`\`\`powershell
npx tsx --env-file=.env.local scripts/validate-uncontrolled-pdf-variants.ts
\`\`\`

Expected: 170 current PDFs inspected; zero R2 writes; zero unsafe or parse failures before enabling endpoints.

- [ ] **Step 4: Render supplied QP-LAB-22 sample**

Render every page for both variants using:

\`\`\`text
E:\ISO\ISO15189\Upload\QM&QP\QP-LAB-22 การออกรายงานผลโดยระบบอัตโนมัติ .pdf
\`\`\`

Accept only if Preview is 18 pt, Download is 16 pt with \`12/07/2026\`, text is centered without overlap, and recognized history pages are skipped.

- [ ] **Step 5: Run local gate, deploy Preview, and commit**

\`\`\`powershell
npx tsx lib/documents/uncontrolled-pdf.test.ts
npx tsx lib/documents/uncontrolled-pdf-cache.test.ts
npx tsx lib/documents/document-delivery-variant.test.ts
npx tsc --noEmit
npm run build
npm i -g vercel
vercel env pull
vercel deploy
git add .gitignore scripts/validate-uncontrolled-pdf-variants.ts
git commit -m \"test: validate preview and download PDF variants\"
\`\`\`

Verify anonymous Public, Viewer, and Document Controller: Preview source is the Preview derivative, Download has Bangkok date, staff gets official PDF, and a source revision regenerates both derivative keys.

## Acceptance Summary

- Viewer/Public never receive a signed URL to the official PDF for an eligible document.
- Preview is fixed 18 pt; Download is 16 pt with Bangkok date and an automatic 13.5 pt safety fallback only on narrow pages.
- Storage is capped at two derivatives per eligible document, about 484 MB for today’s 170-PDF corpus; no daily object accumulation.
- Unsafe layouts and transformation failures fail closed.

