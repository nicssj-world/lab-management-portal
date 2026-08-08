# Personnel Exam Question Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic image upload, compression, and rendering for competency-exam questions and multiple-choice options at `/staff/personnel/exams`.

**Architecture:** Keep image metadata in the existing `competency_exams.definition` JSONB, upload compressed WebP files directly to private R2 through a personnel-manager-only presign route, and hydrate short-lived signed read URLs on authenticated exam pages. Separate the browser compression/dropzone code, shared exam validation, server-side R2 operations, and existing exam UI so scoring remains unchanged.

**Tech Stack:** Next.js 16 App Router route handlers, React 19 client components, TypeScript, Zod, Supabase service-role queries already used by the exam module, Cloudflare R2 through `@aws-sdk/client-s3`, and `tsx` tests using `node:assert/strict`.

## Global Constraints

- Preserve the existing exam builder visual language, colors, typography, modal behavior, dark mode, and Thai copy conventions.
- Allow up to 4 images per question target and up to 4 images per multiple-choice option target.
- Allow a question or option to contain text, images, or both; image-only content is valid.
- Accept selection, drag-and-drop, and clipboard paste into the focused image target.
- Compress browser-selected images to WebP, keep the longest edge at or below 1600px, and target an output size at or below approximately 2 MB.
- Store only R2 image metadata in `competency_exams.definition`; never store binary data or signed URLs in JSONB.
- Keep R2 private and protect presign/cleanup operations with `requirePersonnelManage()`.
- Preserve existing answer-key locking after a graded assignment and never expose `isCorrect` to exam takers.
- Do not add a database table or migration; legacy definitions without image arrays must continue to work.
- Write each test before its production implementation, run the new test while it fails for the intended missing behavior, then implement the minimum code needed to pass it.
- Preserve unrelated user changes in the working tree and commit only files belonging to the current task in each feature commit.

## File Map

Create these focused units:

- `lib/personnel/exam.test.ts` — domain/schema regression tests for image-aware definitions and answer-key stripping.
- `lib/personnel/exam-image-validation.ts` — browser-safe constants and pure validation/key utilities.
- `lib/personnel/exam-image-validation.test.ts` — pure tests for limits, metadata, keys, and referenced-image collection.
- `lib/personnel/exam-image-client.ts` — browser compression, runtime URL stripping, and direct presigned upload client.
- `lib/personnel/exam-image-client.test.ts` — injected-codec tests for resize/quality behavior and upload payload shaping.
- `lib/personnel/exam-image-server.ts` — server-only R2 presign, signed-read, object verification, and cleanup helpers.
- `app/api/admin/personnel/exams/images/presign/route.ts` — manager-only presign route.
- `app/api/admin/personnel/exams/images/route.ts` — manager-only draft-image cleanup route.
- `components/personnel/ExamImageDropzone.tsx` — reusable keyboard/drag/paste image target and thumbnail gallery.
- `scripts/personnel-exam-images-route.test.ts` — route/source contract checks matching the repository's existing UI/API contract-test style.
- `scripts/personnel-exam-images-ui.test.ts` — static UI contract checks for dropzone, modal, and taking-view behavior.

Modify these existing units:

- `lib/personnel/exam.ts` — add image metadata/view types, Zod fields/refinements, normalization, and runtime URL stripping.
- `app/api/admin/personnel/exams/route.ts` — validate referenced images and delete newly uploaded objects if insert fails.
- `app/api/admin/personnel/exams/[examId]/route.ts` — normalize lock comparisons, validate images, and delete keys removed by a successful PATCH.
- `app/(protected)/staff/personnel/exams/page.tsx` — sign image keys for manager list data.
- `app/(protected)/staff/personnel/exams/[assignmentId]/take/page.tsx` — sign image keys for the authenticated taker.
- `app/(protected)/staff/personnel/exams/ExamsClient.tsx` — add image state/upload targets to the builder and improve modal/dropzone error states.
- `app/(protected)/staff/personnel/exams/[assignmentId]/take/TakeClient.tsx` — render question/option images in the exam and review states.

---

### Task 1: Extend the exam definition model and validation

**Files:**
- Modify: `lib/personnel/exam.ts`
- Create: `lib/personnel/exam.test.ts`

**Interfaces:**
- Produces `ExamImage`, `ExamImageView`, `ExamOptionView`, `ExamQuestionView`, `ExamDefinitionView`, `normalizeExamDefinition`, and `stripExamImageRuntimeUrls` for later client/server tasks.
- Keeps `ExamDefinition`, `ExamQuestion`, and `ExamOption` valid for existing JSONB rows that omit `images`.

- [ ] **Step 1: Write the failing tests**

Create `lib/personnel/exam.test.ts` with real Zod/domain calls:

```ts
import assert from 'node:assert/strict'
import {
  ExamDefinitionSchema,
  definitionForTaking,
  stripExamImageRuntimeUrls,
  type ExamDefinitionView,
} from './exam'

const image = { id: 'img-1', key: 'personnel-exams/user-1/img-1.webp', alt: 'ภาพตัวอย่าง', width: 1200, height: 800 }

const imageOnly = {
  questions: [{
    id: 'q-1', prompt: '', type: 'single_choice' as const, images: [image],
    options: [
      { id: 'o-1', label: '', isCorrect: true, images: [image] },
      { id: 'o-2', label: 'ตัวเลือกสอง', isCorrect: false, images: [] },
    ],
  }],
}

const parsed = ExamDefinitionSchema.safeParse(imageOnly)
assert.equal(parsed.success, true, 'image-only question and option must be valid')
assert.equal(parsed.success && parsed.data.questions[0].images.length, 1)

const tooMany = {
  ...imageOnly,
  questions: [{ ...imageOnly.questions[0], images: Array.from({ length: 5 }, (_, i) => ({ ...image, id: `img-${i}` })) }],
}
assert.equal(ExamDefinitionSchema.safeParse(tooMany).success, false, 'a target must reject a fifth image')

const twoCorrect = {
  ...imageOnly,
  questions: [{ ...imageOnly.questions[0], options: imageOnly.questions[0].options.map((o) => ({ ...o, isCorrect: true })) }],
}
assert.equal(ExamDefinitionSchema.safeParse(twoCorrect).success, false, 'a question must have exactly one correct option')

const taking = definitionForTaking(parsed.success ? parsed.data : imageOnly)
assert.deepEqual(taking.questions[0].images, [image])
assert.deepEqual(taking.questions[0].options[0].images, [image])
assert.equal(taking.questions[0].options[0].isCorrect, false)

const runtime: ExamDefinitionView = {
  ...imageOnly,
  questions: imageOnly.questions.map((q) => ({
    ...q,
    images: q.images.map((item) => ({ ...item, url: 'https://signed.example/image' })),
    options: q.options.map((o) => ({ ...o, images: o.images.map((item) => ({ ...item, url: 'https://signed.example/option' })) })),
  })),
}
const persisted = stripExamImageRuntimeUrls(runtime)
assert.equal('url' in persisted.questions[0].images[0], false)
assert.equal('url' in persisted.questions[0].options[0].images[0], false)

console.log('personnel exam definition: ok')
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx tsx lib/personnel/exam.test.ts
```

Expected: FAIL because `ExamImageSchema` fields, image-aware refinements, and `stripExamImageRuntimeUrls` do not exist yet; do not change the test to make the failure pass.

- [ ] **Step 3: Implement the minimum domain changes**

In `lib/personnel/exam.ts`:

1. Add `ExamImage` and runtime `ExamImageView` types with `id`, `key`, `alt`, `width`, `height`, and optional runtime `url` only on the view type.
2. Add optional/default `images` arrays to questions and options, capped at 4.
3. Remove the existing `.min(1)` text requirements and refine each question/option so text or images is required.
4. Refine each question so `options.filter((option) => option.isCorrect).length === 1`.
5. Normalize missing arrays for legacy definitions and preserve `authorizeCategory`.
6. Make `definitionForTaking` spread each option/question so image arrays survive while `isCorrect` becomes `false`.
7. Implement `stripExamImageRuntimeUrls` by mapping nested images to `{ id, key, alt, width, height }`.

Use these exact shape helpers as the public boundary for later tasks:

```ts
export type ExamImage = { id: string; key: string; alt: string; width: number; height: number }
export type ExamImageView = ExamImage & { url?: string }
export type ExamOptionView = Omit<ExamOption, 'images'> & { images: ExamImageView[] }
export type ExamQuestionView = Omit<ExamQuestion, 'images' | 'options'> & { images: ExamImageView[]; options: ExamOptionView[] }
export type ExamDefinitionView = Omit<ExamDefinition, 'questions'> & { questions: ExamQuestionView[] }
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx tsx lib/personnel/exam.test.ts
```

Expected: `personnel exam definition: ok`.

- [ ] **Step 5: Commit**

```bash
git add lib/personnel/exam.ts lib/personnel/exam.test.ts
git commit -m "feat: make exam definitions image aware"
```

### Task 2: Add shared image limits and pure validation utilities

**Files:**
- Create: `lib/personnel/exam-image-validation.ts`
- Create: `lib/personnel/exam-image-validation.test.ts`

**Interfaces:**
- Produces `EXAM_IMAGE_PREFIX`, `EXAM_IMAGE_MAX_PER_TARGET`, `EXAM_IMAGE_MAX_BYTES`, `EXAM_IMAGE_MAX_DIMENSION`, `isExamImageKey`, `validateExamImageUploadMetadata`, and `collectExamImageKeys`.
- Consumes `ExamDefinition` from `lib/personnel/exam.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
import assert from 'node:assert/strict'
import {
  EXAM_IMAGE_MAX_BYTES,
  EXAM_IMAGE_MAX_PER_TARGET,
  collectExamImageKeys,
  isExamImageKey,
  validateExamImageUploadMetadata,
} from './exam-image-validation'

assert.equal(EXAM_IMAGE_MAX_PER_TARGET, 4)
assert.equal(isExamImageKey('personnel-exams/user-1/a.webp'), true)
assert.equal(isExamImageKey('../private/a.webp'), false)
assert.equal(isExamImageKey('personnel-exams/user-1/a.png'), false)

assert.deepEqual(validateExamImageUploadMetadata({ contentType: 'image/webp', sizeBytes: 1000 }), { ok: true })
assert.equal(validateExamImageUploadMetadata({ contentType: 'image/png', sizeBytes: 1000 }).ok, false)
assert.equal(validateExamImageUploadMetadata({ contentType: 'image/webp', sizeBytes: EXAM_IMAGE_MAX_BYTES + 1 }).ok, false)

const definition = {
  questions: [{
    id: 'q', prompt: 'x', type: 'single_choice' as const,
    images: [{ id: 'q-img', key: 'personnel-exams/u/q.webp', alt: '', width: 1, height: 1 }],
    options: [
      { id: 'a', label: 'a', isCorrect: true, images: [{ id: 'a-img', key: 'personnel-exams/u/a.webp', alt: '', width: 1, height: 1 }] },
      { id: 'b', label: 'b', isCorrect: false, images: [] },
    ],
  }],
}
assert.deepEqual(collectExamImageKeys(definition), ['personnel-exams/u/q.webp', 'personnel-exams/u/a.webp'])

console.log('exam image validation: ok')
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx tsx lib/personnel/exam-image-validation.test.ts
```

Expected: FAIL because the validation module does not exist.

- [ ] **Step 3: Implement the pure utilities**

Use these exact values and behavior:

```ts
export const EXAM_IMAGE_PREFIX = 'personnel-exams/'
export const EXAM_IMAGE_MAX_PER_TARGET = 4
export const EXAM_IMAGE_MAX_BYTES = 2 * 1024 * 1024
export const EXAM_IMAGE_MAX_DIMENSION = 1600

export function isExamImageKey(key: string): boolean {
  return /^personnel-exams\\/[^\\s]+\\.webp$/.test(key)
}

export function validateExamImageUploadMetadata(input: { contentType: string; sizeBytes: number }) {
  if (input.contentType !== 'image/webp') return { ok: false as const, error: 'รองรับเฉพาะรูป WebP หลังบีบอัด' }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > EXAM_IMAGE_MAX_BYTES) {
    return { ok: false as const, error: 'ขนาดรูปหลังบีบอัดต้องไม่เกิน 2 MB' }
  }
  return { ok: true as const }
}
```

`collectExamImageKeys` must traverse both question images and option images, deduplicate keys while preserving first-seen order, and ignore missing legacy arrays.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx tsx lib/personnel/exam-image-validation.test.ts
```

Expected: `exam image validation: ok`.

- [ ] **Step 5: Commit**

```bash
git add lib/personnel/exam-image-validation.ts lib/personnel/exam-image-validation.test.ts
git commit -m "feat: add exam image validation limits"
```

### Task 3: Implement browser compression and direct-upload client utilities

**Files:**
- Create: `lib/personnel/exam-image-client.ts`
- Create: `lib/personnel/exam-image-client.test.ts`

**Interfaces:**
- Produces `fitExamImageSize`, `compressExamImage`, and `uploadExamImage`.
- `compressExamImage` accepts an injectable codec so resize/quality behavior is testable without a browser DOM.
- `uploadExamImage` returns `{ id, key, url, alt, width, height }` for the builder's runtime state.

- [ ] **Step 1: Write the failing tests**

```ts
import assert from 'node:assert/strict'
import { compressExamImage, fitExamImageSize } from './exam-image-client'

assert.deepEqual(fitExamImageSize(3200, 1600, 1600), { width: 1600, height: 800 })
assert.deepEqual(fitExamImageSize(800, 600, 1600), { width: 800, height: 600 })

const calls: Array<{ width: number; height: number; quality: number }> = []
const fakeCodec = {
  decode: async () => ({ width: 3200, height: 1600 }),
  encode: async (_file: File, width: number, height: number, quality: number) => {
    calls.push({ width, height, quality })
    return new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })
  },
}
const result = await compressExamImage(new File(['source'], 'diagram.png', { type: 'image/png' }), fakeCodec)
assert.equal(result.file.type, 'image/webp')
assert.equal(result.width, 1600)
assert.equal(result.height, 800)
assert.equal(calls[0].quality, 0.82)

console.log('exam image client: ok')
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx tsx lib/personnel/exam-image-client.test.ts
```

Expected: FAIL because the compression utilities do not exist.

- [ ] **Step 3: Implement compression and upload**

Implement `fitExamImageSize` with aspect-ratio preservation. Implement `compressExamImage` with this sequence:

1. Reject a non-`image/*` source file.
2. Decode through an injected codec; the browser codec uses `createImageBitmap` with an `HTMLImageElement` fallback.
3. Draw onto a canvas at `EXAM_IMAGE_MAX_DIMENSION` maximum on the longest edge.
4. Encode WebP at quality `0.82`; if the blob exceeds `EXAM_IMAGE_MAX_BYTES`, retry at `0.72`, then `0.62`, then scale the dimensions by `0.8` and retry until the byte limit or a minimum dimension of 640px is reached.
5. Return a `.webp` `File`, dimensions, and an alt fallback based on the original filename.

`uploadExamImage` must POST only `{ contentType: 'image/webp', sizeBytes }` to `/api/admin/personnel/exams/images/presign`, PUT the returned file with `Content-Type: image/webp`, throw a user-readable error for non-2xx responses, and return the server's `readUrl` as runtime `url`. It must not send the original file to a Next.js route.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx tsx lib/personnel/exam-image-client.test.ts
```

Expected: `exam image client: ok`.

- [ ] **Step 5: Commit**

```bash
git add lib/personnel/exam-image-client.ts lib/personnel/exam-image-client.test.ts
git commit -m "feat: compress exam images before upload"
```

### Task 4: Add protected R2 presign, signed-read, and cleanup routes

**Files:**
- Create: `lib/personnel/exam-image-server.ts`
- Create: `app/api/admin/personnel/exams/images/presign/route.ts`
- Create: `app/api/admin/personnel/exams/images/route.ts`
- Create: `scripts/personnel-exam-images-route.test.ts`

**Interfaces:**
- `presignExamImage(actorId, input)` returns `{ key, uploadUrl, readUrl, contentType: 'image/webp' }`.
- `signExamImage(key)` returns a short-lived R2 GET URL after validating the key.
- `verifyExamImageKeys(keys)` uses `HeadObjectCommand` to ensure every referenced object exists and is WebP and within the byte limit.
- `deleteExamImageKeys(keys)` deletes only validated exam-image keys.

- [ ] **Step 1: Write the failing route/source contract test**

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const presign = read('app/api/admin/personnel/exams/images/presign/route.ts')
const cleanup = read('app/api/admin/personnel/exams/images/route.ts')
const server = read('lib/personnel/exam-image-server.ts')

assert.ok(presign.includes('requirePersonnelManage'), 'presign must require personnel manager access')
assert.ok(presign.includes('getSignedUrl') && presign.includes('PutObjectCommand'), 'presign must create a direct R2 PUT URL')
assert.ok(presign.includes("contentType: 'image/webp'"), 'presign must pin the stored content type')
assert.ok(cleanup.includes('DeleteObjectCommand'), 'cleanup must delete through R2')
assert.ok(cleanup.includes('requirePersonnelManage'), 'cleanup must require personnel manager access')
assert.ok(server.includes('HeadObjectCommand'), 'server must verify uploaded objects before persistence')
assert.ok(server.includes('GetObjectCommand'), 'server must create signed read URLs')

console.log('personnel exam image routes: contract ok')
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx tsx scripts/personnel-exam-images-route.test.ts
```

Expected: FAIL because the new files do not exist.

- [ ] **Step 3: Implement the server helper and routes**

In `lib/personnel/exam-image-server.ts`, import `server-only`, `r2`, `R2_BUCKET`, the AWS S3 commands, the presigner, and the pure validation utilities. Generate keys as `personnel-exams/${actorId}/${crypto.randomUUID()}.webp`, and use a 300-second PUT URL and a 3600-second GET URL.

The presign route must parse `{ contentType, sizeBytes }`, call `validateExamImageUploadMetadata`, and return 422 for invalid metadata. The cleanup route must accept `{ key }`, require that the key starts with `personnel-exams/${actor.id}/`, and return 422 for keys outside the caller's draft prefix. Server-side PATCH cleanup may call `deleteExamImageKeys` for old referenced keys after a successful database update.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx tsx scripts/personnel-exam-images-route.test.ts
```

Expected: `personnel exam image routes: contract ok`.

- [ ] **Step 5: Commit**

```bash
git add lib/personnel/exam-image-server.ts app/api/admin/personnel/exams/images scripts/personnel-exam-images-route.test.ts
git commit -m "feat: add protected exam image upload routes"
```

### Task 5: Persist image keys and hydrate signed URLs on exam pages

**Files:**
- Modify: `app/api/admin/personnel/exams/route.ts`
- Modify: `app/api/admin/personnel/exams/[examId]/route.ts`
- Modify: `app/(protected)/staff/personnel/exams/page.tsx`
- Modify: `app/(protected)/staff/personnel/exams/[assignmentId]/take/page.tsx`
- Modify: `lib/personnel/exam.ts`

**Interfaces:**
- Consumes `collectExamImageKeys`, `verifyExamImageKeys`, `deleteExamImageKeys`, `normalizeExamDefinition`, and `stripExamImageRuntimeUrls`.
- Produces manager and taker page props with image `url` fields that are not persisted.

- [ ] **Step 1: Extend the domain test with legacy lock normalization**

Append to `lib/personnel/exam.test.ts`:

```ts
import { normalizeExamDefinition } from './exam'

const legacy = { questions: [{ id: 'q', prompt: 'text', type: 'single_choice' as const, options: [
  { id: 'a', label: 'a', isCorrect: true },
  { id: 'b', label: 'b', isCorrect: false },
] }] }
const normalized = normalizeExamDefinition(legacy)
assert.deepEqual(normalized.questions[0].images, [])
assert.deepEqual(normalized.questions[0].options[0].images, [])
assert.deepEqual(normalized, normalizeExamDefinition({ ...legacy, questions: normalized.questions }))
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx tsx lib/personnel/exam.test.ts
```

Expected: FAIL because legacy definitions are not normalized yet.

- [ ] **Step 3: Implement persistence and hydration**

For `POST`:

1. Parse with `ExamUpsertSchema`.
2. Normalize and verify every referenced key before the insert.
3. If the insert fails, delete the keys from the submitted definition and return the existing 500 error shape.

For `PATCH`:

1. Normalize both the stored and incoming definitions before comparing graded locks, so adding default empty arrays to a legacy exam does not count as a question change.
2. Verify incoming keys before updating.
3. After a successful update, compute `oldKeys - newKeys` and delete only those R2 objects.
4. Keep the current title/description/pass-mark/category editing behavior and current error messages.

In both page components, call a server helper that maps all question and option keys through `signExamImage`. `TakeExamPage` must authenticate and verify assignment ownership before signing. `ExamsPage` must sign only the manager-visible active exam data.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx tsx lib/personnel/exam.test.ts
npx tsx scripts/personnel-exam-images-route.test.ts
```

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add -- 'lib/personnel/exam.ts' 'app/api/admin/personnel/exams/route.ts' 'app/api/admin/personnel/exams/[examId]/route.ts' 'app/(protected)/staff/personnel/exams/page.tsx' 'app/(protected)/staff/personnel/exams/[assignmentId]/take/page.tsx'
git commit -m "feat: persist and sign exam image references"
```

### Task 6: Build the accessible image dropzone and integrate it into the builder

**Files:**
- Create: `components/personnel/ExamImageDropzone.tsx`
- Modify: `app/(protected)/staff/personnel/exams/ExamsClient.tsx`
- Modify: `lib/personnel/exam-image-client.ts`
- Create: `scripts/personnel-exam-images-ui.test.ts`

**Interfaces:**
- `ExamImageDropzone` accepts `{ label, images, pendingCount, disabled, error, onFiles, onRemove, onRetry }`.
- The builder passes target IDs such as `question:${questionId}` and `option:${questionId}:${optionId}` to a shared upload handler.
- The upload handler calls `uploadExamImage` and returns runtime `ExamImageView` objects.

- [ ] **Step 1: Write the failing UI contract test**

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const dropzone = read('components/personnel/ExamImageDropzone.tsx')
const builder = read('app/(protected)/staff/personnel/exams/ExamsClient.tsx')

for (const required of ['onDrop', 'onPaste', 'onKeyDown', 'aria-live', 'focus-visible', 'type="button"']) {
  assert.ok(dropzone.includes(required), `dropzone must include ${required}`)
}
for (const required of ['ExamImageDropzone', 'รูปคำถาม', 'รูปตัวเลือก', 'uploadExamImage', 'stripExamImageRuntimeUrls']) {
  assert.ok(builder.includes(required), `builder must include ${required}`)
}
assert.ok(builder.includes('disabled={locked}'), 'locked exams must disable image editing')

console.log('personnel exam image UI: contract ok')
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx tsx scripts/personnel-exam-images-ui.test.ts
```

Expected: FAIL because the dropzone and builder integration do not exist.

- [ ] **Step 3: Implement the reusable dropzone**

Base the visual treatment on `components/chemical-safety/shared/SdsDropzone.tsx`, but use `accept="image/*"` and a thumbnail grid. The root must be a real `<button type="button">` with `aria-describedby`, `aria-label`, visible `:focus-visible`, hover, drag-over, disabled, and reduced-motion styles. Add `onPaste` that extracts `image/*` clipboard items, `onDrop` that forwards all dropped files, and an explicit `onKeyDown` handler for Enter/Space to preserve the keyboard contract. Reset the hidden input value after every selection so choosing the same file again works.

Render each image with its intrinsic dimensions, fallback alt text, a remove button, and a `กำลังอัปโหลด…` state. Render the inline error inside an `aria-live="polite"` region. Keep all hit targets at least 44px and do not use color as the only status indicator.

- [ ] **Step 4: Integrate upload state into `ExamBuilderModal`**

In `ExamsClient.tsx`:

1. Initialize new questions/options with `images: []`.
2. Track pending uploads by target ID and failed uploads by image ID.
3. Reject additional files after the target reaches four images, while allowing valid files up to the remaining capacity.
4. Call `uploadExamImage` for each accepted file; append successful metadata without replacing existing images; keep other uploads if one fails.
5. Remove newly uploaded draft objects through the cleanup route; leave persisted existing objects for PATCH diff cleanup.
6. Disable the save button while any target is compressing or uploading.
7. Validate prompt/option text-or-image locally, show the error beside the relevant target, and use `stripExamImageRuntimeUrls` before building the POST/PATCH body.
8. When the modal is locked, render all images read-only and do not attach/remove handlers.
9. Add accessible `role="dialog"`, `aria-modal="true"`, and a descriptive close-button label to the existing `Overlay` without changing its close semantics.

- [ ] **Step 5: Run the UI contract test to verify it passes**

```bash
npx tsx scripts/personnel-exam-images-ui.test.ts
```

Expected: `personnel exam image UI: contract ok`.

- [ ] **Step 6: Commit**

```bash
git add -- 'components/personnel/ExamImageDropzone.tsx' 'app/(protected)/staff/personnel/exams/ExamsClient.tsx' 'lib/personnel/exam-image-client.ts' 'scripts/personnel-exam-images-ui.test.ts'
git commit -m "feat: add image uploads to exam builder"
```

### Task 7: Render images in the taking and answer-review views

**Files:**
- Modify: `app/(protected)/staff/personnel/exams/[assignmentId]/take/TakeClient.tsx`
- Modify: `scripts/personnel-exam-images-ui.test.ts`

**Interfaces:**
- Consumes hydrated `ExamQuestionView[]` from `TakeExamPage`.
- Does not change `answers`, submit payloads, grading, or answer-key handling.

- [ ] **Step 1: Extend the failing UI contract test**

Append assertions:

```ts
const take = read('app/(protected)/staff/personnel/exams/[assignmentId]/take/TakeClient.tsx')
for (const required of ['q.images', 'o.images', 'loading="lazy"', 'objectFit', 'alt=']) {
  assert.ok(take.includes(required), `taking view must include ${required}`)
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx tsx scripts/personnel-exam-images-ui.test.ts
```

Expected: FAIL because `TakeClient` does not render image arrays.

- [ ] **Step 3: Implement image rendering**

Add a small local `ExamImageGallery` renderer in `TakeClient.tsx` or a focused component in the same file. Render question images directly below the prompt when present, and render option images beside the option label inside the existing `<label>` radio hit target. Use `maxWidth: '100%'`, intrinsic `width`/`height`, `objectFit: 'contain'`, `loading="lazy"`, and `alt={image.alt || 'ภาพประกอบข้อสอบ'}`. Apply the same gallery to the post-submit review cards. When prompt/label text is empty, render only the gallery and preserve the existing numbering/radio affordance.

- [ ] **Step 4: Run the UI contract test to verify it passes**

```bash
npx tsx scripts/personnel-exam-images-ui.test.ts
```

Expected: `personnel exam image UI: contract ok`.

- [ ] **Step 5: Commit**

```bash
git add -- 'app/(protected)/staff/personnel/exams/[assignmentId]/take/TakeClient.tsx' 'scripts/personnel-exam-images-ui.test.ts'
git commit -m "feat: render images in competency exams"
```

### Task 8: Run the complete verification gate

**Files:**
- Modify: none unless a verification failure identifies a defect in the feature files.

- [ ] **Step 1: Run all focused tests**

```bash
npx tsx lib/personnel/exam.test.ts
npx tsx lib/personnel/exam-image-validation.test.ts
npx tsx lib/personnel/exam-image-client.test.ts
npx tsx scripts/personnel-exam-images-route.test.ts
npx tsx scripts/personnel-exam-images-ui.test.ts
```

Expected: every command exits 0 and prints its `: ok` contract message.

- [ ] **Step 2: Run TypeScript checking**

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors. In particular, confirm that legacy `ExamDefinition` values and hydrated `ExamDefinitionView` values are not mixed in the POST/PATCH payload.

- [ ] **Step 3: Run repository checks relevant to this surface**

```bash
npm run build
git diff --check
git status --short
```

Expected: the production build succeeds, `git diff --check` prints nothing, and the only changed files are the plan's feature files plus any already-existing user changes. Do not run deployment commands as part of this feature verification.

- [ ] **Step 4: Perform the browser acceptance pass**

At `/staff/personnel/exams`, verify all of these manually:

1. Create a text question with one image selected through the picker.
2. Add a second image by dragging it onto the question target.
3. Focus an option target and paste an image with Ctrl+V.
4. Create an image-only question and image-only options, save, assign, and take the exam.
5. Confirm images are visible in the taking view and post-submit review while `isCorrect` remains absent from the client payload before submission.
6. Try a fifth image, an undecodable file, and an interrupted upload; confirm inline error/retry behavior and draft preservation.
7. Open a graded exam and confirm image controls are read-only.
8. Repeat at 375px width, keyboard-only navigation, dark mode, and reduced-motion settings.

- [ ] **Step 5: Commit any verification-only fixes**

```bash
git add -- 'lib/personnel' 'app/api/admin/personnel/exams' 'components/personnel' 'app/(protected)/staff/personnel/exams' 'scripts/personnel-exam-images-route.test.ts' 'scripts/personnel-exam-images-ui.test.ts'
git commit -m "test: verify personnel exam image workflow"
```

Only create this final commit if Task 8 required a code/test fix; do not create an empty commit.

## Plan Self-Review

- **Spec coverage:** Data model and legacy compatibility are covered by Tasks 1 and 5; compression and direct R2 upload by Tasks 2–4; server security and cleanup by Tasks 4–5; builder UX by Task 6; taker/review rendering by Task 7; error, lock, responsive, keyboard, paste, and drag/drop acceptance by Tasks 6–8; TDD and production verification by every task and Task 8.
- **Placeholder scan:** No task depends on `TODO`, `TBD`, an unspecified route, or an undefined helper. Every later helper is named in an earlier task's interface block.
- **Type consistency:** Persisted `ExamImage` objects never carry `url`; runtime `ExamImageView` objects may carry `url`; `stripExamImageRuntimeUrls` is the boundary before POST/PATCH; hydrated pages pass view objects to client components; `definitionForTaking` preserves images while clearing `isCorrect`.
- **Scope check:** The plan changes only the exam definition, image upload pipeline, two exam pages, their route handlers, and focused tests. It does not introduce a new editor, database table, or unrelated UI refactor.
