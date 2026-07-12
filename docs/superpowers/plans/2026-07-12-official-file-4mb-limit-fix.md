# Official Document File 4.5MB Upload Limit Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the official document file (PDF/DOC/DOCX/XLS/XLSX) and the auto-extract preview bypass Vercel's hard 4.5 MB request-body limit, by uploading directly to R2 via a presigned URL — exactly like the word/excel *source* file already does — instead of sending raw bytes through the Next.js API route body.

**Architecture:** Client presigns a PUT URL, uploads the file straight to Cloudflare R2 from the browser, then sends only the resulting R2 key (+ name/size/type) to the API route. The route treats a `file_key` the same as a raw `file` upload wherever it already branches on `word_file_key` vs `word_file`. Where a route already re-derives and patches DOCX/XLSX headers unconditionally after any file change (`[id]/route.ts`'s `patchTarget` block), the presigned path gets that patch for free. Where it doesn't (`route.ts` create), the plan explicitly matches the *existing* accepted behavior for `word_file_key` (header patch is skipped for presigned uploads on create — a pre-existing, intentional trade-off in this codebase, not a new regression) with one exception: the legacy-import PDF footer stamp, which is a correctness-critical step for a regulated document and is reproduced for the presigned path by fetching the object back from R2 (no body-size limit applies to that — it's an outbound SDK call, not an inbound HTTP request), stamping, and overwriting the same key in place.

**Tech Stack:** Next.js 16 App Router route handlers, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, Cloudflare R2, React 19 client component (`DocumentUploadModal.tsx`).

## Global Constraints

- No lint/test scripts exist in this repo. The only automated verification is `npx tsc --noEmit` (per `CLAUDE.md`). Every task ends with running it.
- Match existing code style exactly: 2-space indent, no semicolons-first style changes, Thai error strings copied verbatim where reused.
- Do not touch `app/api/admin/documents/[id]/revision-drafts/[draftId]/route.ts` or `components/documents/RevisionPanel.tsx` / `QuickUpdateModal.tsx` — that flow (Rev+ / Upd+) **already** implements the presign-then-direct-R2-PUT pattern correctly (verified: `POST`/`GET?intent=upload` presign handlers + `PATCH` consuming `uploaded_file: {kind,key,fileName,fileType,fileSize}` + `patchDraftTarget` header-patch-in-place). No changes needed there.
- `EXTRACT_MAX_BYTES` (20 MB) and the 50 MB official-file cap are pre-existing app-level limits — keep them as-is; this plan only removes the *platform* 4.5 MB ceiling that currently sits below them.
- R2 key hygiene: presigned-upload keys are **not** added to the `uploadedKeys` cleanup-on-error array in `route.ts` (create). This matches the pre-existing behavior for `word_file_key` in the same file — an accepted, already-present trade-off. Do not "fix" this as part of this plan (out of scope; would be scope creep beyond what was asked).
- No new shared `lib/` helper module for R2 object reads: each of `route.ts`, `[id]/route.ts`, and `revision-drafts/[draftId]/route.ts` already keeps its own local copy of `uploadDocumentObject`/`getObjectBuffer`/`patchR2DocxObject`/etc. rather than importing a shared one — that's the established pattern in this codebase (confirmed by reading all three files). Tasks 2, 3, and 5 add `getObjectBuffer`/`getStoredObjectSize` as local copies per file, matching that convention, instead of introducing a new cross-file abstraction.

---

### Task 1: Presign route for the official document file

**Files:**
- Create: `app/api/admin/documents/presign-file/route.ts`

**Interfaces:**
- Consumes: `lib/env.ts` → `requiredEnv(name: string): string`; `lib/auth/guards.ts` → `getActor(): Promise<{id:string; role:string; doc_role:string|null; name:string|null} | null>`, `canAccessDocuments(actor, 'edit'): Promise<boolean>`; `lib/documents/workflow.ts` → `isCoverRequiredType(type: string|null|undefined): boolean`, `isPdfFile(file): boolean`, `isSourceFile(file): boolean`.
- Produces: `GET /api/admin/documents/presign-file?fileName=&fileType=&fileSize=&type=` → `{ uploadMode: 'direct-r2', uploadUrl: string, key: string, contentType: string }` on success, `{ error: string }` with 401/403/422/500 otherwise. Task 6 (client) calls this exact query-param shape.

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requiredEnv } from '@/lib/env'
import { getActor, canAccessDocuments } from '@/lib/auth/guards'
import { isCoverRequiredType, isPdfFile, isSourceFile } from '@/lib/documents/workflow'

const MAX_OFFICIAL_FILE_SIZE = 50 * 1024 * 1024

let cachedR2: S3Client | null = null
function getR2Client() {
  if (!cachedR2) {
    cachedR2 = new S3Client({
      region: 'auto',
      endpoint: `https://${requiredEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requiredEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: requiredEnv('R2_SECRET_ACCESS_KEY'),
      },
    })
  }
  return cachedR2
}

function inferredContentType(filename: string, contentType: string | null | undefined) {
  if (contentType?.trim() && contentType !== 'application/octet-stream') return contentType.trim()
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'doc') return 'application/msword'
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (ext === 'xls') return 'application/vnd.ms-excel'
  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  return 'application/octet-stream'
}

function safeStorageName(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

// Returns a presigned PUT URL so the browser can upload the official document file
// directly to R2, bypassing Vercel's 4.5 MB API-route body-size limit.
export async function GET(req: NextRequest) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await canAccessDocuments(actor, 'edit'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sp = req.nextUrl.searchParams
    const fileName = (sp.get('fileName') ?? '').trim()
    const fileType = inferredContentType(fileName, sp.get('fileType'))
    const fileSize = Number(sp.get('fileSize') ?? '')
    const docType = (sp.get('type') ?? 'others').trim()

    if (!fileName) return NextResponse.json({ error: 'ต้องระบุชื่อไฟล์' }, { status: 422 })

    const fileRef = { name: fileName, type: fileType }
    const coverRequired = isCoverRequiredType(docType.toUpperCase())
    if (coverRequired && !isPdfFile(fileRef)) {
      return NextResponse.json({ error: 'QP/WI ต้องใช้ PDF เนื้อหาในช่องไฟล์ทางการ' }, { status: 422 })
    }
    if (!coverRequired && !isPdfFile(fileRef) && !isSourceFile(fileRef)) {
      return NextResponse.json({ error: 'ไฟล์ทางการรองรับ PDF, DOC, DOCX, XLS, XLSX' }, { status: 422 })
    }
    if (Number.isFinite(fileSize) && fileSize > MAX_OFFICIAL_FILE_SIZE) {
      return NextResponse.json({ error: 'ไฟล์ทางการใหญ่เกิน 50 MB' }, { status: 422 })
    }

    const year = new Date().getFullYear()
    const safeName = safeStorageName(fileName)
    const key = `documents/${docType.toLowerCase().replace(/[^a-z]/g, '') || 'others'}/${year}/${Date.now()}-${safeName}`
    const uploadUrl = await getSignedUrl(
      getR2Client(),
      new PutObjectCommand({
        Bucket: requiredEnv('R2_BUCKET_NAME'),
        Key: key,
        ContentType: fileType,
      }),
      { expiresIn: 300 },
    )
    return NextResponse.json({ uploadMode: 'direct-r2', uploadUrl, key, contentType: fileType })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' },
      { status: 500 },
    )
  }
}
```

This mirrors `app/api/admin/documents/presign-word/route.ts` almost exactly (same auth, same 300s expiry, same key convention `documents/{type}/{year}/{timestamp}-{name}` — note **no** `source-` prefix here, matching how `uploadDocumentObject(file, type, '', ...)` builds the official-file key with an empty prefix in `route.ts`).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/documents/presign-file/route.ts
git commit -m "feat: add presigned direct-R2 upload route for official document files"
```

---

### Task 2: Accept a presigned official file on document create

**Files:**
- Modify: `app/api/admin/documents/route.ts`

**Interfaces:**
- Consumes: Task 1's route is called from the client (Task 6), which then submits `file_key` (string), `file_name` (string), `file_size` (string, numeric), `file_type` (string) as additional `FormData` fields to `POST /api/admin/documents`, as an alternative to the existing raw `file` field. All four are optional and only present when the client used the presigned path.
- Produces: identical `officialFields` shape as before (`file_url`, `file_name`, `file_size`, `mime_type`, optionally `source_pdf_*`) — no change to what gets written to `documents`.

- [ ] **Step 1: Add `HeadObjectCommand`/`GetObjectCommand` imports and two helpers**

In `app/api/admin/documents/route.ts`, change the import line:

```ts
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
```

to:

```ts
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
```

Then add these two helpers directly after the existing `uploadDocumentObject` function (after its closing `}` around line 81):

```ts
async function getObjectBuffer(key: string) {
  const object = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  const body = object.Body
  if (!body) throw new Error('ไม่พบไฟล์ที่อัปโหลดใน R2')
  if ('transformToByteArray' in body && typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray())
  }
  const chunks: Uint8Array[] = []
  for await (const chunk of body as AsyncIterable<Uint8Array | Buffer>) {
    chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk))
  }
  return Buffer.concat(chunks)
}

async function getStoredObjectSize(key: string) {
  const object = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  return object.ContentLength ?? null
}
```

(Both are copied verbatim from the identical helpers already in `app/api/admin/documents/[id]/route.ts`, just using this file's module-level `r2`/`R2_BUCKET` instead of a per-request client.)

- [ ] **Step 2: Parse the new form fields**

Find this block (around line 156-160):

```ts
    // Pre-uploaded path: browser PUT the file directly to R2 via presigned URL.
    const wordFileKey = (form.get('word_file_key') as string | null)?.trim() || null
    const wordFileName = (form.get('word_file_name') as string | null)?.trim() || null
    const wordFileSizeRaw = form.get('word_file_size')
    const wordFileSizePresigned = wordFileSizeRaw ? Number(wordFileSizeRaw) : null
```

Add immediately after it:

```ts
    const fileKey = (form.get('file_key') as string | null)?.trim() || null
    const fileKeyName = (form.get('file_name') as string | null)?.trim() || null
    const fileKeyType = (form.get('file_type') as string | null)?.trim() || null
    const fileKeySizeRaw = form.get('file_size')
    const fileKeySizePresigned = fileKeySizeRaw ? Number(fileKeySizeRaw) : null
```

- [ ] **Step 3: Extend validation to cover the presigned path**

Find this block (around line 183-203):

```ts
    if (file && file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'ไฟล์ทางการใหญ่เกิน 50 MB' }, { status: 422 })
    }
    if (wordFile && wordFile.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'ไฟล์ Word/Excel ใหญ่เกิน 50 MB' }, { status: 422 })
    }
    if (file && isCoverRequiredType(meta.type) && !isPdfFile(file)) {
      return NextResponse.json({ error: 'QP/WI ต้องใช้ PDF เนื้อหาในช่องไฟล์ทางการ' }, { status: 422 })
    }
    if (file && !isCoverRequiredType(meta.type) && !isPdfFile(file) && !isSourceFile(file)) {
      return NextResponse.json({ error: 'ไฟล์ทางการรองรับ PDF, DOC, DOCX, XLS, XLSX' }, { status: 422 })
    }
    if (wordFile && !isSourceFile(wordFile)) {
      return NextResponse.json({ error: 'ไฟล์ต้นฉบับรองรับ DOC, DOCX, XLS, XLSX เท่านั้น' }, { status: 422 })
    }
    if (wordFileKey && wordFileName && !isSourceFile({ name: wordFileName })) {
      return NextResponse.json({ error: 'ไฟล์ต้นฉบับรองรับ DOC, DOCX, XLS, XLSX เท่านั้น' }, { status: 422 })
    }
    if (isImportCurrent && !file) {
      return NextResponse.json({ error: 'โหมดนำเข้าเอกสารเดิม Rev.>0 ต้องแนบไฟล์ทางการ Rev ปัจจุบัน' }, { status: 422 })
    }
```

Replace it with:

```ts
    if (file && file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'ไฟล์ทางการใหญ่เกิน 50 MB' }, { status: 422 })
    }
    if (fileKeySizePresigned && fileKeySizePresigned > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'ไฟล์ทางการใหญ่เกิน 50 MB' }, { status: 422 })
    }
    if (wordFile && wordFile.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'ไฟล์ Word/Excel ใหญ่เกิน 50 MB' }, { status: 422 })
    }
    if (file && isCoverRequiredType(meta.type) && !isPdfFile(file)) {
      return NextResponse.json({ error: 'QP/WI ต้องใช้ PDF เนื้อหาในช่องไฟล์ทางการ' }, { status: 422 })
    }
    if (file && !isCoverRequiredType(meta.type) && !isPdfFile(file) && !isSourceFile(file)) {
      return NextResponse.json({ error: 'ไฟล์ทางการรองรับ PDF, DOC, DOCX, XLS, XLSX' }, { status: 422 })
    }
    if (fileKey && fileKeyName) {
      const fileKeyRef = { name: fileKeyName, type: fileKeyType ?? '' }
      if (isCoverRequiredType(meta.type) && !isPdfFile(fileKeyRef)) {
        return NextResponse.json({ error: 'QP/WI ต้องใช้ PDF เนื้อหาในช่องไฟล์ทางการ' }, { status: 422 })
      }
      if (!isCoverRequiredType(meta.type) && !isPdfFile(fileKeyRef) && !isSourceFile(fileKeyRef)) {
        return NextResponse.json({ error: 'ไฟล์ทางการรองรับ PDF, DOC, DOCX, XLS, XLSX' }, { status: 422 })
      }
    }
    if (wordFile && !isSourceFile(wordFile)) {
      return NextResponse.json({ error: 'ไฟล์ต้นฉบับรองรับ DOC, DOCX, XLS, XLSX เท่านั้น' }, { status: 422 })
    }
    if (wordFileKey && wordFileName && !isSourceFile({ name: wordFileName })) {
      return NextResponse.json({ error: 'ไฟล์ต้นฉบับรองรับ DOC, DOCX, XLS, XLSX เท่านั้น' }, { status: 422 })
    }
    if (isImportCurrent && !file && !fileKey) {
      return NextResponse.json({ error: 'โหมดนำเข้าเอกสารเดิม Rev.>0 ต้องแนบไฟล์ทางการ Rev ปัจจุบัน' }, { status: 422 })
    }
```

- [ ] **Step 4: Replace the `if (file) { ... }` upload block**

Find this block (around line 277-311):

```ts
    if (file) {
      const shouldStampImportedLegacyPdf =
        isImportCurrent &&
        isCoverRequiredType(meta.type) &&
        Boolean(resolvedMeta.legacy_cover_included) &&
        isPdfFile(file)
      const importedEffectiveDate = shouldStampImportedLegacyPdf
        ? parseDateOnly(resolvedMeta.effective_date ?? null)
        : null
      const uploaded = await uploadDocumentObject(
        file,
        meta.type,
        '',
        headerMetadata,
        importedEffectiveDate
          ? (body) => stampPublishedPdfFooter(body, documentCode, meta.revision, importedEffectiveDate)
          : undefined,
      )
      const r2Key = uploaded.key
      uploadedKeys.push(r2Key)
      officialFields = {
        file_url: r2Key,
        file_name: file.name,
        file_size: uploaded.size,
        mime_type: file.type || 'application/octet-stream',
        ...(isCoverRequiredType(meta.type) && !resolvedMeta.legacy_cover_included
          ? {
              source_pdf_url: r2Key,
              source_pdf_name: file.name,
              source_pdf_size: uploaded.size,
              source_pdf_mime_type: file.type || 'application/pdf',
            }
          : {}),
      }
    }
```

Replace it with:

```ts
    if (file || fileKey) {
      const shouldStampImportedLegacyPdf =
        isImportCurrent &&
        isCoverRequiredType(meta.type) &&
        Boolean(resolvedMeta.legacy_cover_included) &&
        isPdfFile(file ?? { name: fileKeyName ?? '', type: fileKeyType ?? '' })
      const importedEffectiveDate = shouldStampImportedLegacyPdf
        ? parseDateOnly(resolvedMeta.effective_date ?? null)
        : null

      let r2Key: string
      let uploadedSize: number
      let finalName: string
      let finalType: string

      if (file) {
        const uploaded = await uploadDocumentObject(
          file,
          meta.type,
          '',
          headerMetadata,
          importedEffectiveDate
            ? (body) => stampPublishedPdfFooter(body, documentCode, meta.revision, importedEffectiveDate)
            : undefined,
        )
        r2Key = uploaded.key
        uploadedSize = uploaded.size
        finalName = file.name
        finalType = file.type
        uploadedKeys.push(r2Key)
      } else {
        // File was already uploaded directly to R2 via presigned URL (bypasses Vercel's
        // 4.5 MB API-route body-size limit). DOCX/XLSX header metadata is intentionally
        // not patched here for this path — same accepted trade-off as word_file_key above.
        r2Key = fileKey as string
        finalName = fileKeyName ?? r2Key.split('/').pop() ?? 'file'
        finalType = fileKeyType ?? ''
        uploadedSize = fileKeySizePresigned && Number.isFinite(fileKeySizePresigned)
          ? fileKeySizePresigned
          : (await getStoredObjectSize(r2Key)) ?? 0
        if (importedEffectiveDate) {
          const original = await getObjectBuffer(r2Key)
          const stamped = await stampPublishedPdfFooter(original, documentCode, meta.revision, importedEffectiveDate)
          await r2.send(new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: r2Key,
            Body: stamped,
            ContentType: 'application/pdf',
          }))
          uploadedSize = stamped.length
        }
      }

      officialFields = {
        file_url: r2Key,
        file_name: finalName,
        file_size: uploadedSize,
        // Two different fallbacks on purpose, copied from the original raw-upload code:
        // mime_type defaults to octet-stream, but source_pdf_mime_type (only ever set here
        // for an already-validated PDF) defaults to application/pdf.
        mime_type: finalType || 'application/octet-stream',
        ...(isCoverRequiredType(meta.type) && !resolvedMeta.legacy_cover_included
          ? {
              source_pdf_url: r2Key,
              source_pdf_name: finalName,
              source_pdf_size: uploadedSize,
              source_pdf_mime_type: finalType || 'application/pdf',
            }
          : {}),
      }
    }
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. (If TypeScript complains that `file` might be `null` inside the `isPdfFile(file ?? {...})` call — it won't, since `isPdfFile` already accepts `File | {name?,type?} | null | undefined` per its signature in `lib/documents/workflow.ts`.)

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/documents/route.ts
git commit -m "feat: accept presigned official file upload on document create"
```

---

### Task 3: Accept a presigned official file on document edit/revision

**Files:**
- Modify: `app/api/admin/documents/[id]/route.ts`

**Interfaces:**
- Consumes: same four `FormData` fields as Task 2 (`file_key`, `file_name`, `file_size`, `file_type`), sent to `PATCH /api/admin/documents/[id]`.
- Produces: same `updates.file_url/file_name/file_size/mime_type[/source_pdf_*]` shape as before. Unlike Task 2, DOCX/XLSX header metadata **is** applied for this path — for free — by the pre-existing unconditional `patchTarget` block near the end of this handler (it re-fetches whatever `updates.file_url` ends up being and patches in place), so no extra header-patch code is needed here.

- [ ] **Step 1: Add `HeadObjectCommand` import and `getStoredObjectSize` helper**

Change:

```ts
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
```

to:

```ts
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
```

Add this helper directly after the existing `getObjectBuffer` function (after its closing `}`, around line 71):

```ts
async function getStoredObjectSize(key: string) {
  const object = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  return object.ContentLength ?? null
}
```

- [ ] **Step 2: Parse the new form fields**

Find (around line 170-183):

```ts
    let newWordFile: File | null = null
    let wordFileKey: string | null = null
    let wordFileName: string | null = null
    let wordFileSizePre: number | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const fileRaw = form.get('file')
      newFile = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null
      const wordRaw = form.get('word_file')
      newWordFile = wordRaw instanceof File && wordRaw.size > 0 ? wordRaw : null
      wordFileKey = (form.get('word_file_key') as string | null)?.trim() || null
      wordFileName = (form.get('word_file_name') as string | null)?.trim() || null
      wordFileSizePre = (form.get('word_file_size') != null) ? Number(form.get('word_file_size')) : null
```

Replace with:

```ts
    let newWordFile: File | null = null
    let wordFileKey: string | null = null
    let wordFileName: string | null = null
    let wordFileSizePre: number | null = null
    let fileKey: string | null = null
    let fileKeyName: string | null = null
    let fileKeyType: string | null = null
    let fileKeySizePre: number | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const fileRaw = form.get('file')
      newFile = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null
      const wordRaw = form.get('word_file')
      newWordFile = wordRaw instanceof File && wordRaw.size > 0 ? wordRaw : null
      wordFileKey = (form.get('word_file_key') as string | null)?.trim() || null
      wordFileName = (form.get('word_file_name') as string | null)?.trim() || null
      wordFileSizePre = (form.get('word_file_size') != null) ? Number(form.get('word_file_size')) : null
      fileKey = (form.get('file_key') as string | null)?.trim() || null
      fileKeyName = (form.get('file_name') as string | null)?.trim() || null
      fileKeyType = (form.get('file_type') as string | null)?.trim() || null
      fileKeySizePre = (form.get('file_size') != null) ? Number(form.get('file_size')) : null
```

- [ ] **Step 3: Include `fileKey` in the three existing `newFile` boolean guards**

Find (around line 215):
```ts
      if (newFile || (newWordFile && newWordFile.size > 0) || wordFileKey) {
        return NextResponse.json({ error: 'การเปลี่ยนสถานะต้องทำแยกจากการอัปโหลดไฟล์' }, { status: 422 })
      }
```
Replace with:
```ts
      if (newFile || fileKey || (newWordFile && newWordFile.size > 0) || wordFileKey) {
        return NextResponse.json({ error: 'การเปลี่ยนสถานะต้องทำแยกจากการอัปโหลดไฟล์' }, { status: 422 })
      }
```

Find (around line 229):
```ts
      if (newFile || (newWordFile && newWordFile.size > 0) || wordFileKey) {
        return NextResponse.json({ error: 'เอกสาร Published ต้องสร้าง Revision ใหม่ก่อนเปลี่ยนไฟล์เนื้อหา' }, { status: 409 })
      }
```
Replace with:
```ts
      if (newFile || fileKey || (newWordFile && newWordFile.size > 0) || wordFileKey) {
        return NextResponse.json({ error: 'เอกสาร Published ต้องสร้าง Revision ใหม่ก่อนเปลี่ยนไฟล์เนื้อหา' }, { status: 409 })
      }
```

Find (around line 276):
```ts
    const sourceUploadDate = ((newWordFile && newWordFile.size > 0) || wordFileKey) ? todayIsoDate() : undefined
```
(no change needed — this one is about the *source/word* file only, unrelated to the official `file`/`fileKey`.)

Find (around line 351):
```ts
    if (!skipRevision && (revisionChanged || newFile) && current?.file_url) {
```
Replace with:
```ts
    if (!skipRevision && (revisionChanged || newFile || fileKey) && current?.file_url) {
```

- [ ] **Step 4: Replace the `if (newFile) { ... }` block**

Find (around line 289-319):

```ts
    if (newFile) {
      if (newFile.size > 50 * 1024 * 1024) {
        return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 50 MB' }, { status: 422 })
      }

      const type = (updates.type as string) ?? current?.type ?? 'others'
      if (isCoverRequiredType(type) && !isPdfFile(newFile)) {
        return NextResponse.json({ error: 'QP/WI ต้องใช้ PDF เนื้อหาในช่องไฟล์ทางการ' }, { status: 422 })
      }
      if (!isCoverRequiredType(type) && !isPdfFile(newFile) && !isSourceFile(newFile)) {
        return NextResponse.json({ error: 'ไฟล์ทางการรองรับ PDF, DOC, DOCX, XLS, XLSX' }, { status: 422 })
      }

      const headerMetadata: DocxHeaderMetadata = buildDocxHeaderMetadata({
        ...current,
        ...updates,
      })
      const uploaded = await uploadDocumentObject(newFile, type, '', headerMetadata)
      const r2Key = uploaded.key

      updates.file_url  = r2Key
      updates.file_name = newFile.name
      updates.file_size = uploaded.size
      updates.mime_type = newFile.type || 'application/octet-stream'
      if (isCoverRequiredType(type)) {
        updates.source_pdf_url = r2Key
        updates.source_pdf_name = newFile.name
        updates.source_pdf_size = uploaded.size
        updates.source_pdf_mime_type = newFile.type || 'application/pdf'
      }
    }
```

Replace with:

```ts
    if (newFile || fileKey) {
      const fileSizeForCheck = newFile ? newFile.size : fileKeySizePre
      if (fileSizeForCheck && fileSizeForCheck > 50 * 1024 * 1024) {
        return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 50 MB' }, { status: 422 })
      }

      const type = (updates.type as string) ?? current?.type ?? 'others'
      const fileRef = newFile ?? { name: fileKeyName ?? '', type: fileKeyType ?? '' }
      if (isCoverRequiredType(type) && !isPdfFile(fileRef)) {
        return NextResponse.json({ error: 'QP/WI ต้องใช้ PDF เนื้อหาในช่องไฟล์ทางการ' }, { status: 422 })
      }
      if (!isCoverRequiredType(type) && !isPdfFile(fileRef) && !isSourceFile(fileRef)) {
        return NextResponse.json({ error: 'ไฟล์ทางการรองรับ PDF, DOC, DOCX, XLS, XLSX' }, { status: 422 })
      }

      let r2Key: string
      let uploadedSize: number
      let finalName: string
      let finalType: string

      if (newFile) {
        const headerMetadata: DocxHeaderMetadata = buildDocxHeaderMetadata({
          ...current,
          ...updates,
        })
        const uploaded = await uploadDocumentObject(newFile, type, '', headerMetadata)
        r2Key = uploaded.key
        uploadedSize = uploaded.size
        finalName = newFile.name
        finalType = newFile.type
      } else {
        // File was already uploaded directly to R2 via presigned URL. DOCX/XLSX header
        // metadata still gets patched — the unconditional patchTarget block below re-fetches
        // whatever updates.file_url ends up being and patches it in place either way.
        r2Key = fileKey as string
        finalName = fileKeyName ?? r2Key.split('/').pop() ?? 'file'
        finalType = fileKeyType ?? ''
        uploadedSize = fileKeySizePre && Number.isFinite(fileKeySizePre)
          ? fileKeySizePre
          : (await getStoredObjectSize(r2Key)) ?? 0
      }

      // Two different fallbacks on purpose, copied from the original code: mime_type
      // defaults to octet-stream, but source_pdf_mime_type (only set for cover-required
      // types, i.e. an already-validated PDF) defaults to application/pdf.
      updates.file_url  = r2Key
      updates.file_name = finalName
      updates.file_size = uploadedSize
      updates.mime_type = finalType || 'application/octet-stream'
      if (isCoverRequiredType(type)) {
        updates.source_pdf_url = r2Key
        updates.source_pdf_name = finalName
        updates.source_pdf_size = uploadedSize
        updates.source_pdf_mime_type = finalType || 'application/pdf'
      }
    }
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add "app/api/admin/documents/[id]/route.ts"
git commit -m "feat: accept presigned official file upload on document edit/revision"
```

---

### Task 4: Accept a presigned file on revision-history backfill

**Files:**
- Create: `app/api/admin/documents/[id]/revisions/presign/route.ts`
- Modify: `app/api/admin/documents/[id]/revisions/route.ts`
- Modify: `components/documents/RevisionPanel.tsx`

**Interfaces:**
- Produces (new route): `GET /api/admin/documents/[id]/revisions/presign?fileName=&fileType=&fileSize=` → `{ uploadMode: 'direct-r2', uploadUrl, key, contentType }`.
- Consumes (modified route): `POST /api/admin/documents/[id]/revisions` now also accepts `file_key`, `file_name`, `file_size`, `file_type` FormData fields as an alternative to raw `file`.
- Consumes (client): `RevisionPanel.tsx`'s existing local helpers `uploadFileWithProgress(url, file, contentType, onProgress)` (line 14) and `parseDraftUploadResponse(text): {error?, uploadMode?, uploadUrl?, key?, contentType?}` (line 352) — both already defined in this file for the revision-draft upload flow, reused here rather than duplicated.

- [ ] **Step 1: Write the presign route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'

const MAX_HISTORY_FILE_SIZE = 50 * 1024 * 1024
const ALLOWED_HISTORY_FILE_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx'])

function canBackfillRevisionHistory(actor: { role: string; doc_role: string | null }) {
  return actor.role === 'Admin' || actor.role === 'Document Controller' || actor.doc_role === 'Document Controller'
}

function inferredContentType(filename: string, contentType: string | null | undefined) {
  if (contentType?.trim() && contentType !== 'application/octet-stream') return contentType.trim()
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'doc') return 'application/msword'
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (ext === 'xls') return 'application/vnd.ms-excel'
  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  return 'application/octet-stream'
}

function safeStorageName(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!canBackfillRevisionHistory(actor)) return jsonForbidden()

  const { id } = await params
  const sp = req.nextUrl.searchParams
  const fileName = (sp.get('fileName') ?? '').trim()
  const fileType = inferredContentType(fileName, sp.get('fileType'))
  const fileSize = Number(sp.get('fileSize') ?? '')

  if (!fileName) return NextResponse.json({ error: 'ต้องระบุชื่อไฟล์' }, { status: 422 })
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_HISTORY_FILE_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: 'ไฟล์ประวัติย้อนหลังรองรับ PDF, DOC, DOCX, XLS, XLSX' }, { status: 422 })
  }
  if (Number.isFinite(fileSize) && fileSize > MAX_HISTORY_FILE_SIZE) {
    return NextResponse.json({ error: 'ไฟล์ประวัติย้อนหลังใหญ่เกิน 50 MB' }, { status: 422 })
  }

  const key = `documents/revisions/backfill/${id}/${Date.now()}-${safeStorageName(fileName)}`
  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: fileType }),
    { expiresIn: 300 },
  )
  return NextResponse.json({ uploadMode: 'direct-r2', uploadUrl, key, contentType: fileType })
}
```

- [ ] **Step 2: Loosen `isAllowedHistoryFile`'s parameter type**

In `app/api/admin/documents/[id]/revisions/route.ts`, change:

```ts
function isAllowedHistoryFile(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ALLOWED_HISTORY_FILE_EXTENSIONS.has(ext)
}
```

to:

```ts
function isAllowedHistoryFile(file: { name: string }) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ALLOWED_HISTORY_FILE_EXTENSIONS.has(ext)
}
```

(Only `.name` is used, so this accepts both a real `File` and a plain `{name}` object — needed for the presigned-key branch in Step 3.)

- [ ] **Step 3: Accept `file_key` in the POST handler**

Find (around line 103-126):

```ts
    const fileRaw = form.get('file')
    const file = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null
    let fileFields: Record<string, unknown> = {
      file_url: null,
      file_name: null,
      file_size: null,
      mime_type: null,
    }

    if (file) {
      if (file.size > MAX_HISTORY_FILE_SIZE) {
        return NextResponse.json({ error: 'ไฟล์ประวัติย้อนหลังใหญ่เกิน 50 MB' }, { status: 422 })
      }
      if (!isAllowedHistoryFile(file)) {
        return NextResponse.json({ error: 'ไฟล์ประวัติย้อนหลังรองรับ PDF, DOC, DOCX, XLS, XLSX' }, { status: 422 })
      }
      const uploaded = await uploadHistoryFile(file, id)
      fileFields = {
        file_url: uploaded.key,
        file_name: file.name,
        file_size: uploaded.size,
        mime_type: file.type || 'application/octet-stream',
      }
    }
```

Replace with:

```ts
    const fileRaw = form.get('file')
    const file = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null
    const fileKey = (form.get('file_key') as string | null)?.trim() || null
    const fileKeyName = (form.get('file_name') as string | null)?.trim() || null
    const fileKeyType = (form.get('file_type') as string | null)?.trim() || null
    const fileKeySizeRaw = form.get('file_size')
    const fileKeySize = fileKeySizeRaw ? Number(fileKeySizeRaw) : null
    let fileFields: Record<string, unknown> = {
      file_url: null,
      file_name: null,
      file_size: null,
      mime_type: null,
    }

    if (file) {
      if (file.size > MAX_HISTORY_FILE_SIZE) {
        return NextResponse.json({ error: 'ไฟล์ประวัติย้อนหลังใหญ่เกิน 50 MB' }, { status: 422 })
      }
      if (!isAllowedHistoryFile(file)) {
        return NextResponse.json({ error: 'ไฟล์ประวัติย้อนหลังรองรับ PDF, DOC, DOCX, XLS, XLSX' }, { status: 422 })
      }
      const uploaded = await uploadHistoryFile(file, id)
      fileFields = {
        file_url: uploaded.key,
        file_name: file.name,
        file_size: uploaded.size,
        mime_type: file.type || 'application/octet-stream',
      }
    } else if (fileKey) {
      if (fileKeyName && !isAllowedHistoryFile({ name: fileKeyName })) {
        return NextResponse.json({ error: 'ไฟล์ประวัติย้อนหลังรองรับ PDF, DOC, DOCX, XLS, XLSX' }, { status: 422 })
      }
      if (fileKeySize && fileKeySize > MAX_HISTORY_FILE_SIZE) {
        return NextResponse.json({ error: 'ไฟล์ประวัติย้อนหลังใหญ่เกิน 50 MB' }, { status: 422 })
      }
      fileFields = {
        file_url: fileKey,
        file_name: fileKeyName ?? fileKey.split('/').pop() ?? 'file',
        file_size: fileKeySize,
        mime_type: fileKeyType || 'application/octet-stream',
      }
    }
```

- [ ] **Step 4: Wire the client (`RevisionPanel.tsx`) to use the presigned upload**

The backfill form's submit handler currently sends the file raw in the same request as the rest of the form (`app/api/admin/documents/[id]/revisions` POST), which is exactly the 4.5 MB-limited path Steps 1-3 just worked around server-side — the client must actually use it or nothing changes.

Find `handleAddRevision` in `components/documents/RevisionPanel.tsx` (around line 565-583):

```ts
  async function handleAddRevision() {
    if (!formRev.trim()) { setFormError('กรุณากรอกหมายเลข Revision'); return }
    setFormSaving(true); setFormError('')
    try {
      const fd = new FormData()
      fd.append('revision_number', formRev.trim())
      if (formNote.trim()) fd.append('revision_note', formNote.trim())
      if (formRevisedBy.trim()) fd.append('revised_by', formRevisedBy.trim())
      if (formApprover.trim()) fd.append('approved_by', formApprover.trim())
      if (formDate) fd.append('revision_date', formDate)
      if (formFile) fd.append('file', formFile)
      const res = await fetch(`/api/admin/documents/${doc.id}/revisions`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error ?? 'เกิดข้อผิดพลาด'); return }
      setRevisions(prev => [json, ...prev])
      setShowForm(false); setFormRev(''); setFormNote(''); setFormRevisedBy(''); setFormApprover(''); setFormDate(''); setFormFile(null)
    } catch { setFormError('เกิดข้อผิดพลาด') }
    finally { setFormSaving(false) }
  }
```

Replace with:

```ts
  async function handleAddRevision() {
    if (!formRev.trim()) { setFormError('กรุณากรอกหมายเลข Revision'); return }
    setFormSaving(true); setFormError('')
    try {
      let fileKey: string | null = null
      let fileKeyName: string | null = null
      let fileKeySize: number | null = null
      let fileKeyType: string | null = null
      if (formFile) {
        const fileType = formFile.type || 'application/octet-stream'
        const presignParams = new URLSearchParams({
          fileName: formFile.name,
          fileType,
          fileSize: String(formFile.size),
        })
        const presignRes = await fetch(`/api/admin/documents/${doc.id}/revisions/presign?${presignParams.toString()}`)
        const presignText = await presignRes.text()
        const presignJson = parseDraftUploadResponse(presignText)
        if (!presignRes.ok) {
          setFormError(presignJson.error ?? `สร้าง URL อัปโหลดไฟล์ไม่สำเร็จ (${presignRes.status})`)
          return
        }
        if (presignJson.uploadMode !== 'direct-r2' || !presignJson.uploadUrl || !presignJson.key) {
          setFormError('สร้าง URL อัปโหลดไฟล์ไม่สำเร็จ: production อาจยังไม่ใช่โค้ด direct upload ล่าสุด กรุณา redeploy แล้วลองใหม่')
          return
        }
        await uploadFileWithProgress(presignJson.uploadUrl, formFile, presignJson.contentType ?? fileType, () => {})
        fileKey = presignJson.key
        fileKeyName = formFile.name
        fileKeySize = formFile.size
        fileKeyType = presignJson.contentType ?? fileType
      }

      const fd = new FormData()
      fd.append('revision_number', formRev.trim())
      if (formNote.trim()) fd.append('revision_note', formNote.trim())
      if (formRevisedBy.trim()) fd.append('revised_by', formRevisedBy.trim())
      if (formApprover.trim()) fd.append('approved_by', formApprover.trim())
      if (formDate) fd.append('revision_date', formDate)
      if (fileKey) {
        fd.append('file_key', fileKey)
        fd.append('file_name', fileKeyName!)
        fd.append('file_size', String(fileKeySize!))
        fd.append('file_type', fileKeyType ?? '')
      }
      const res = await fetch(`/api/admin/documents/${doc.id}/revisions`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error ?? 'เกิดข้อผิดพลาด'); return }
      setRevisions(prev => [json, ...prev])
      setShowForm(false); setFormRev(''); setFormNote(''); setFormRevisedBy(''); setFormApprover(''); setFormDate(''); setFormFile(null)
    } catch { setFormError('เกิดข้อผิดพลาด') }
    finally { setFormSaving(false) }
  }
```

This reuses `parseDraftUploadResponse` and `uploadFileWithProgress`, both already defined at the top of this same file (lines 14 and 352) for the revision-draft file flow — no new helpers needed here. The upload has no visible progress bar (matches this form's existing UX, which has no progress indicator today — just the `formSaving` spinner state).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add "app/api/admin/documents/[id]/revisions/presign/route.ts" "app/api/admin/documents/[id]/revisions/route.ts" components/documents/RevisionPanel.tsx
git commit -m "feat: accept presigned file upload for revision-history backfill"
```

---

### Task 5: Let the extract/auto-read route accept an already-uploaded R2 key

**Files:**
- Modify: `app/api/admin/documents/extract/route.ts`

**Interfaces:**
- Produces: `POST /api/admin/documents/extract` now accepts **either** the existing `multipart/form-data` body with a `file` field (unchanged, still capped by the platform's 4.5 MB limit — kept for any caller that doesn't presign), **or** a JSON body `{ file_key: string, file_name: string }` which fetches the object from R2 server-side (no inbound body-size limit) and applies the app's own `EXTRACT_MAX_BYTES` (20 MB) cap via a `HeadObjectCommand` check before downloading.

- [ ] **Step 1: Rewrite the route**

```ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { extractDocxHeaderMetadata } from '@/lib/documents/docx-header'
import { extractXlsxHeaderMetadata } from '@/lib/documents/xlsx-header'

const EXTRACT_MAX_BYTES = 20 * 1024 * 1024

function fileTooLargeResponse() {
  return NextResponse.json(
    { error: 'ดึงข้อมูลจากไฟล์รองรับไฟล์ไม่เกิน 20 MB กรุณาลดขนาดไฟล์หรือกรอกข้อมูลเอง' },
    { status: 413 },
  )
}

async function getObjectBuffer(key: string) {
  const object = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  const body = object.Body
  if (!body) throw new Error('ไม่พบไฟล์ที่อัปโหลดใน R2')
  if ('transformToByteArray' in body && typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray())
  }
  const chunks: Uint8Array[] = []
  for await (const chunk of body as AsyncIterable<Uint8Array | Buffer>) {
    chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk))
  }
  return Buffer.concat(chunks)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = req.headers.get('content-type') ?? ''
  let buffer: Buffer
  let fileName: string

  if (contentType.includes('application/json')) {
    // File was already uploaded directly to R2 via presigned URL — fetch it server-side.
    // This path has no Vercel request-body size limit, so it can use the app's own 20 MB cap.
    const body = await req.json() as { file_key?: string; file_name?: string }
    const fileKey = (body.file_key ?? '').trim()
    fileName = (body.file_name ?? '').trim()
    if (!fileKey || !fileName) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 422 })

    const size = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: fileKey }))
      .then((o) => o.ContentLength ?? 0)
      .catch(() => null)
    if (size === null) return NextResponse.json({ error: 'ไม่พบไฟล์ที่อัปโหลดใน storage' }, { status: 422 })
    if (size > EXTRACT_MAX_BYTES) return fileTooLargeResponse()

    buffer = await getObjectBuffer(fileKey)
  } else {
    const contentLength = Number(req.headers.get('content-length') ?? 0)
    if (contentLength > EXTRACT_MAX_BYTES) return fileTooLargeResponse()

    let form: FormData
    try {
      form = await req.formData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const status = /large|size|body|payload/i.test(msg) ? 413 : 400
      return NextResponse.json(
        { error: status === 413 ? 'ไฟล์ใหญ่เกินขนาดที่ระบบอ่านอัตโนมัติได้ กรุณาลดขนาดไฟล์หรือกรอกข้อมูลเอง' : `ไม่สามารถอ่านข้อมูลไฟล์ได้: ${msg}` },
        { status },
      )
    }

    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 422 })
    if (file.size > EXTRACT_MAX_BYTES) return fileTooLargeResponse()

    fileName = file.name
    buffer = Buffer.from(await file.arrayBuffer())
  }

  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  let text = ''

  try {
    if (ext === 'pdf') {
      const { getDocumentProxy, extractText } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(buffer))
      const { text: pages } = await extractText(pdf, { mergePages: false })
      text = Array.isArray(pages) ? (pages[0] ?? '') : String(pages)
    } else if (ext === 'docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      const header = await extractDocxHeaderMetadata(buffer)
      text = [header.text, result.value].filter(Boolean).join('\n\n')
    } else if (ext === 'xlsx') {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
      const header = await extractXlsxHeaderMetadata(buffer)
      text = [header.text, rows.flat().filter(Boolean).join('\n')].filter(Boolean).join('\n\n')
    } else {
      return NextResponse.json({ error: 'ไม่รองรับไฟล์ประเภทนี้' }, { status: 422 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `ไม่สามารถอ่านไฟล์ได้: ${msg}` }, { status: 500 })
  }

  return NextResponse.json({ text })
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/documents/extract/route.ts
git commit -m "feat: let extract route fetch an already-uploaded R2 file, bypassing the 4.5MB body limit"
```

---

### Task 6: Wire up the client — presign-then-upload for the official file, reused between preview and submit

**Files:**
- Modify: `components/documents/DocumentUploadModal.tsx`

**Interfaces:**
- Consumes: Task 1's `GET /api/admin/documents/presign-file`, Task 5's JSON `POST /api/admin/documents/extract`, the existing `presign-word` route, and the already-defined top-level `uploadFileWithProgress(url, file, contentType, onProgress)` helper.
- Produces: two new component-local async functions, `presignOfficialFile(file: File)` and `presignSourceFile(file: File)`, both returning `Promise<{ key: string; name: string; size: number; type: string }>` and both also calling `setOfficialFileUpload`/`setSourceFileUpload` as a side effect so the result can be reused by both the extract-preview button and the final submit without re-uploading the same bytes twice.

- [ ] **Step 1: Add upload-tracking state next to the existing file state**

Find (around line 323-324):

```ts
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedWordFile, setSelectedWordFile] = useState<File | null>(null)
```

Replace with:

```ts
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedWordFile, setSelectedWordFile] = useState<File | null>(null)
  const [officialFileUpload, setOfficialFileUpload] = useState<{ key: string; name: string; size: number; type: string } | null>(null)
  const [sourceFileUpload, setSourceFileUpload] = useState<{ key: string; name: string; size: number; type: string } | null>(null)
```

- [ ] **Step 2: Invalidate a stale upload when the user picks a different file**

Find `handleFile` (around line 375-388):

```ts
  const handleFile = useCallback((file: File) => {
    if (!isOfficialFileAllowed(type, file)) {
      setError(requiresCover(type)
        ? 'QP/WI ต้องใช้ไฟล์ PDF เนื้อหาในช่องไฟล์ทางการ'
        : 'ช่องไฟล์ทางการรองรับ PDF, DOC, DOCX, XLS, XLSX')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('ไฟล์ต้องไม่เกิน 50 MB')
      return
    }
    setError('')
    setSelectedFile(file)
  }, [type])
```

Replace with:

```ts
  const handleFile = useCallback((file: File) => {
    if (!isOfficialFileAllowed(type, file)) {
      setError(requiresCover(type)
        ? 'QP/WI ต้องใช้ไฟล์ PDF เนื้อหาในช่องไฟล์ทางการ'
        : 'ช่องไฟล์ทางการรองรับ PDF, DOC, DOCX, XLS, XLSX')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('ไฟล์ต้องไม่เกิน 50 MB')
      return
    }
    setError('')
    setSelectedFile(file)
    setOfficialFileUpload(null)
  }, [type])
```

Find `handleWordFile` (around line 390-402):

```ts
  const handleWordFile = useCallback((file: File) => {
    if (!file.name.match(/\.(doc|docx|xlsx)$/i)) {
      setError('ช่องนี้รองรับเฉพาะไฟล์ DOC, DOCX, XLSX เท่านั้น')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('ไฟล์ต้องไม่เกิน 50 MB')
      return
    }
    setError('')
    setSelectedWordFile(file)
    setEditDate((current) => current || todayIsoDate())
  }, [])
```

Replace with:

```ts
  const handleWordFile = useCallback((file: File) => {
    if (!file.name.match(/\.(doc|docx|xlsx)$/i)) {
      setError('ช่องนี้รองรับเฉพาะไฟล์ DOC, DOCX, XLSX เท่านั้น')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('ไฟล์ต้องไม่เกิน 50 MB')
      return
    }
    setError('')
    setSelectedWordFile(file)
    setSourceFileUpload(null)
    setEditDate((current) => current || todayIsoDate())
  }, [])
```

Find the two "remove file" buttons and clear the matching upload state:

```ts
                    <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', flexShrink: 0 }}>
```

Replace with:

```ts
                    <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setOfficialFileUpload(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', flexShrink: 0 }}>
```

```ts
                    <button onClick={(e) => { e.stopPropagation(); setSelectedWordFile(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', flexShrink: 0 }}>
```

Replace with:

```ts
                    <button onClick={(e) => { e.stopPropagation(); setSelectedWordFile(null); setSourceFileUpload(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', flexShrink: 0 }}>
```

- [ ] **Step 3: Add the two presign-and-upload helpers**

Add these two functions directly above `async function extractFromFile() {` (around line 472):

```ts
  async function presignOfficialFile(file: File): Promise<{ key: string; name: string; size: number; type: string }> {
    const presignParams = new URLSearchParams({
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: String(file.size),
      type,
    })
    const presignRes = await fetch(`/api/admin/documents/presign-file?${presignParams}`)
    const presignJson = await readJsonOrError(presignRes)
    if (!presignRes.ok) throw new Error(presignJson.error ?? 'สร้าง URL อัปโหลดไฟล์ทางการไม่สำเร็จ')
    const { uploadMode, uploadUrl, key, contentType } = presignJson as { uploadMode?: string; uploadUrl: string; key: string; contentType: string }
    if (uploadMode !== 'direct-r2') throw new Error('production อาจยังไม่ใช่โค้ด direct upload ล่าสุด กรุณา redeploy แล้วลองใหม่')
    setUploadProgress(0)
    await uploadFileWithProgress(uploadUrl, file, contentType, setUploadProgress)
    const uploaded = { key, name: file.name, size: file.size, type: contentType }
    setOfficialFileUpload(uploaded)
    return uploaded
  }

  async function presignSourceFile(file: File): Promise<{ key: string; name: string; size: number; type: string }> {
    const presignParams = new URLSearchParams({
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: String(file.size),
      docType: type.toLowerCase(),
    })
    const presignRes = await fetch(`/api/admin/documents/presign-word?${presignParams}`)
    const presignJson = await readJsonOrError(presignRes)
    if (!presignRes.ok) throw new Error(presignJson.error ?? 'สร้าง URL อัปโหลดไฟล์ต้นฉบับไม่สำเร็จ')
    const { uploadMode, uploadUrl, key, contentType } = presignJson as { uploadMode?: string; uploadUrl: string; key: string; contentType: string }
    if (uploadMode !== 'direct-r2') throw new Error('production อาจยังไม่ใช่โค้ด direct upload ล่าสุด กรุณา redeploy แล้วลองใหม่')
    setUploadProgress(0)
    await uploadFileWithProgress(uploadUrl, file, contentType, setUploadProgress)
    const uploaded = { key, name: file.name, size: file.size, type: contentType }
    setSourceFileUpload(uploaded)
    return uploaded
  }

  function reuseOrPresign(
    file: File,
    cached: { key: string; name: string; size: number; type: string } | null,
    presign: (file: File) => Promise<{ key: string; name: string; size: number; type: string }>,
  ) {
    if (cached && cached.name === file.name && cached.size === file.size) return Promise.resolve(cached)
    return presign(file)
  }
```

- [ ] **Step 4: Use presigned upload + JSON body in `extractFromFile`**

Find the non-form-file branch inside `extractFromFile` (around line 505-531):

```ts
      } else {
        const fd = new FormData()
        fd.append('file', selectedFile)
        const res = await fetch('/api/admin/documents/extract', { method: 'POST', body: fd })
        const json = await readJsonOrError(res)
        if (!res.ok) throw new Error(json.error ?? 'ไม่สามารถอ่านไฟล์ได้')
```

Replace with:

```ts
      } else {
        const uploaded = await reuseOrPresign(selectedFile, officialFileUpload, presignOfficialFile)
        const res = await fetch('/api/admin/documents/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_key: uploaded.key, file_name: uploaded.name }),
        })
        const json = await readJsonOrError(res)
        if (!res.ok) throw new Error(json.error ?? 'ไม่สามารถอ่านไฟล์ได้')
```

(The rest of the `else` branch — reading `fields` off `json.text` and populating form state — is unchanged.)

Then find the `finally` block of `extractFromFile` (around line 534-536):

```ts
    } finally {
      setExtracting(false)
    }
  }
```

Replace with:

```ts
    } finally {
      setExtracting(false)
      setUploadProgress(null)
    }
  }
```

- [ ] **Step 5: Use presigned upload + JSON body in `extractFromWordFile`**

Find (around line 543-548):

```ts
    try {
      const fd = new FormData()
      fd.append('file', selectedWordFile)
      const res = await fetch('/api/admin/documents/extract', { method: 'POST', body: fd })
      const json = await readJsonOrError(res)
      if (!res.ok) throw new Error(json.error ?? 'ไม่สามารถอ่านไฟล์ได้')
```

Replace with:

```ts
    try {
      const uploaded = await reuseOrPresign(selectedWordFile, sourceFileUpload, presignSourceFile)
      const res = await fetch('/api/admin/documents/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_key: uploaded.key, file_name: uploaded.name }),
      })
      const json = await readJsonOrError(res)
      if (!res.ok) throw new Error(json.error ?? 'ไม่สามารถอ่านไฟล์ได้')
```

Then find the `finally` block of `extractFromWordFile` (around line 571-573):

```ts
    } finally {
      setExtractingWord(false)
    }
  }
```

Replace with:

```ts
    } finally {
      setExtractingWord(false)
      setUploadProgress(null)
    }
  }
```

- [ ] **Step 6: Reuse (or create) the presigned upload at submit time, for both official and source files**

Find the word-file presign block inside `handleSave` (around line 602-640):

```ts
      // Pre-upload word/excel file directly to R2 via presigned URL to bypass
      // Vercel's 4.5 MB API-route body-size limit.
      let wordFileKey: string | null = null
      let wordFileName: string | null = null
      let wordFileSize: number | null = null
      if (selectedWordFile) {
        const presignParams = new URLSearchParams({
          fileName: selectedWordFile.name,
          fileType: selectedWordFile.type || 'application/octet-stream',
          fileSize: String(selectedWordFile.size),
          docType: type.toLowerCase(),
        })
        const presignRes = await fetch(`/api/admin/documents/presign-word?${presignParams}`)
        const presignJson = await readJsonOrError(presignRes)
        if (!presignRes.ok) {
          setError(presignJson.error ?? 'สร้าง URL อัปโหลดไฟล์ต้นฉบับไม่สำเร็จ')
          setSaving(false)
          return
        }
        const { uploadMode, uploadUrl, key, contentType } = presignJson as { uploadMode?: string; uploadUrl: string; key: string; contentType: string }
        if (uploadMode !== 'direct-r2') {
          setError('production อาจยังไม่ใช่โค้ด direct upload ล่าสุด กรุณา redeploy แล้วลองใหม่')
          setSaving(false)
          return
        }
        try {
          setUploadProgress(0)
          await uploadFileWithProgress(uploadUrl, selectedWordFile, contentType, setUploadProgress)
        } catch (err) {
          setError(`อัปโหลดไฟล์ต้นฉบับไม่สำเร็จ ${err instanceof Error ? err.message : String(err)}`)
          setSaving(false)
          setUploadProgress(null)
          return
        }
        wordFileKey = key
        wordFileName = selectedWordFile.name
        wordFileSize = selectedWordFile.size
      }
```

Replace with:

```ts
      // Pre-upload word/excel and official files directly to R2 via presigned URL to bypass
      // Vercel's 4.5 MB API-route body-size limit. Reuse an upload already done by the
      // "ดึงข้อมูล" preview button when it matches the currently selected file, instead of
      // uploading the same bytes twice.
      let wordFileKey: string | null = null
      let wordFileName: string | null = null
      let wordFileSize: number | null = null
      if (selectedWordFile) {
        try {
          const uploaded = await reuseOrPresign(selectedWordFile, sourceFileUpload, presignSourceFile)
          wordFileKey = uploaded.key
          wordFileName = uploaded.name
          wordFileSize = uploaded.size
        } catch (err) {
          setError(`อัปโหลดไฟล์ต้นฉบับไม่สำเร็จ ${err instanceof Error ? err.message : String(err)}`)
          setSaving(false)
          setUploadProgress(null)
          return
        }
      }

      let officialFileKey: string | null = null
      let officialFileName: string | null = null
      let officialFileSize: number | null = null
      let officialFileType: string | null = null
      if (selectedFile) {
        try {
          const uploaded = await reuseOrPresign(selectedFile, officialFileUpload, presignOfficialFile)
          officialFileKey = uploaded.key
          officialFileName = uploaded.name
          officialFileSize = uploaded.size
          officialFileType = uploaded.type
        } catch (err) {
          setError(`อัปโหลดไฟล์ทางการไม่สำเร็จ ${err instanceof Error ? err.message : String(err)}`)
          setSaving(false)
          setUploadProgress(null)
          return
        }
      }
```

- [ ] **Step 7: Send `file_key`/`file_name`/`file_size`/`file_type` instead of the raw `file`**

Find (around line 670-701):

```ts
      let res: Response

      if (isEdit) {
        const editUrl = `/api/admin/documents/${doc!.id}${!saveRevision ? '?skipRevision=1' : ''}`
        if (!isPublishedCorrection && (selectedFile || wordFileKey)) {
          const fd = new FormData()
          if (selectedFile) fd.append('file', selectedFile)
          if (wordFileKey) {
            fd.append('word_file_key', wordFileKey)
            fd.append('word_file_name', wordFileName!)
            fd.append('word_file_size', String(wordFileSize!))
          }
          fd.append('meta', JSON.stringify(meta))
          res = await fetch(editUrl, { method: 'PATCH', body: fd })
        } else {
          res = await fetch(editUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(meta),
          })
        }
      } else {
        const fd = new FormData()
        if (selectedFile) fd.append('file', selectedFile)
        if (wordFileKey) {
          fd.append('word_file_key', wordFileKey)
          fd.append('word_file_name', wordFileName!)
          fd.append('word_file_size', String(wordFileSize!))
        }
        fd.append('meta', JSON.stringify(meta))
        res = await fetch('/api/admin/documents', { method: 'POST', body: fd })
      }
```

Replace with:

```ts
      let res: Response

      if (isEdit) {
        const editUrl = `/api/admin/documents/${doc!.id}${!saveRevision ? '?skipRevision=1' : ''}`
        if (!isPublishedCorrection && (officialFileKey || wordFileKey)) {
          const fd = new FormData()
          if (officialFileKey) {
            fd.append('file_key', officialFileKey)
            fd.append('file_name', officialFileName!)
            fd.append('file_size', String(officialFileSize!))
            fd.append('file_type', officialFileType ?? '')
          }
          if (wordFileKey) {
            fd.append('word_file_key', wordFileKey)
            fd.append('word_file_name', wordFileName!)
            fd.append('word_file_size', String(wordFileSize!))
          }
          fd.append('meta', JSON.stringify(meta))
          res = await fetch(editUrl, { method: 'PATCH', body: fd })
        } else {
          res = await fetch(editUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(meta),
          })
        }
      } else {
        const fd = new FormData()
        if (officialFileKey) {
          fd.append('file_key', officialFileKey)
          fd.append('file_name', officialFileName!)
          fd.append('file_size', String(officialFileSize!))
          fd.append('file_type', officialFileType ?? '')
        }
        if (wordFileKey) {
          fd.append('word_file_key', wordFileKey)
          fd.append('word_file_name', wordFileName!)
          fd.append('word_file_size', String(wordFileSize!))
        }
        fd.append('meta', JSON.stringify(meta))
        res = await fetch('/api/admin/documents', { method: 'POST', body: fd })
      }
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 9: Manual smoke test (no automated UI tests exist in this repo)**

Run: `npm run dev`, sign in as a Document Controller/Admin, open Documents → create a new Draft:
1. Pick an official PDF file **larger than 5 MB** (bigger than Vercel's real 4.5 MB cap). Click "ดึงข้อมูล" — it should no longer show "ไฟล์ใหญ่เกินขนาดที่ระบบอ่านอัตโนมัติได้..."; the progress bar should show an upload, then autofill fields from the extracted text.
2. Submit the form. Confirm the document is created and its official file downloads correctly (open it from the document detail page) — this exercises the `file_key` path end-to-end through `route.ts`.
3. Repeat for a QP/WI document with both an official PDF > 5 MB and a Word/Excel source file > 5 MB, confirming both upload and the created draft has both files attached.
4. Edit/replace the official file on an existing Draft document with a file > 5 MB; confirm the edit succeeds and the new file is retrievable (exercises `[id]/route.ts`).
5. As Admin/DCC, use "เพิ่มประวัติ Revision ย้อนหลัง" (backfill) on an existing document with a file > 5 MB; confirm it saves (exercises the new `revisions/presign` route).

- [ ] **Step 10: Commit**

```bash
git add components/documents/DocumentUploadModal.tsx
git commit -m "feat: presign-upload official/source files to R2 before submit, reusing extract-preview uploads"
```

---

## Post-plan note

`app/api/admin/documents/extract/route.ts`'s stated Thai error message already says "20 MB" — that number is now actually reachable (previously it was aspirational since the platform's real 4.5 MB ceiling sat underneath it). No message text needs to change.
