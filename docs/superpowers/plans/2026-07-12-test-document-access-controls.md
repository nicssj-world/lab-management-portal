# Test Document Access Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each test document expose only the permitted View and/or Download action while keeping Internal documents out of the public catalog.

**Architecture:** The library document's existing `documents.visibility` remains the source of truth for linked library documents. A `related_doc_access` JSON object on `tests` stores each linked document's action. Direct attachments receive `visibility` and `access_mode` columns. Shared helpers normalize legacy records to Internal + View.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase PostgreSQL, Cloudflare R2, TypeScript, Node assert scripts run with `tsx`.

## Global Constraints

- Keep `tests.related_doc_ids uuid[]`; do not delete or rewrite legacy links.
- Internal documents are staff-only and always View-only.
- Public library documents must be non-deleted, `status = 'Published'`, and `visibility = 'Public'`.
- Legacy direct attachments and library links default to Internal + View.
- Public action endpoints must reject Internal or unpermitted actions.
- Run the SQL migration manually through Supabase Dashboard before live use.
- Do not introduce DRM or a new PDF viewer.

---

### Task 1: Data model and access policy

**Files:**

- Create: `scripts/test-document-access-controls.sql`
- Create: `lib/tests/document-access.ts`
- Create: `scripts/test-document-access.test.ts`
- Modify: `lib/supabase/types.ts`
- Modify: `lib/validations/test-schema.ts`

**Produces:** `DocumentVisibility = 'Internal' | 'Public'`, `DocumentAccessMode = 'view' | 'download' | 'both'`, `DocumentAction = 'view' | 'download'`, `normalizeDocumentAccess()`, and `canUseDocumentAction()`.

- [ ] **Step 1: Write the failing policy test**

    import assert from 'node:assert/strict'
    import { canUseDocumentAction, normalizeDocumentAccess } from '../lib/tests/document-access'

    assert.deepEqual(normalizeDocumentAccess('Internal', 'download'), {
      visibility: 'Internal', accessMode: 'view',
    })
    assert.deepEqual(normalizeDocumentAccess('Public', undefined), {
      visibility: 'Public', accessMode: 'both',
    })
    assert.equal(canUseDocumentAction('both', 'view'), true)
    assert.equal(canUseDocumentAction('both', 'download'), true)
    assert.equal(canUseDocumentAction('view', 'download'), false)
    assert.equal(canUseDocumentAction('download', 'view'), false)

- [ ] **Step 2: Verify RED**

Run: `npx tsx scripts/test-document-access.test.ts`

Expected: failure because `lib/tests/document-access.ts` does not exist.

- [ ] **Step 3: Add the migration**

    alter table public.tests
      add column if not exists related_doc_access jsonb not null default '{}'::jsonb;

    alter table public.test_documents
      add column if not exists visibility text not null default 'Internal',
      add column if not exists access_mode text not null default 'view';

    alter table public.test_documents
      drop constraint if exists test_documents_visibility_check,
      add constraint test_documents_visibility_check check (visibility in ('Internal', 'Public')),
      drop constraint if exists test_documents_access_mode_check,
      add constraint test_documents_access_mode_check check (access_mode in ('view', 'download', 'both'));

- [ ] **Step 4: Add the policy module and fields**

    export type DocumentVisibility = 'Internal' | 'Public'
    export type DocumentAccessMode = 'view' | 'download' | 'both'
    export type DocumentAction = 'view' | 'download'

    export function normalizeDocumentAccess(visibility: string | null | undefined, accessMode: string | null | undefined) {
      const normalizedVisibility: DocumentVisibility = visibility === 'Public' ? 'Public' : 'Internal'
      if (normalizedVisibility === 'Internal') return { visibility: normalizedVisibility, accessMode: 'view' as const }
      const normalizedAccess: DocumentAccessMode =
        accessMode === 'view' || accessMode === 'download' || accessMode === 'both' ? accessMode : 'both'
      return { visibility: normalizedVisibility, accessMode: normalizedAccess }
    }

    export function canUseDocumentAction(accessMode: DocumentAccessMode, action: DocumentAction) {
      return accessMode === 'both' || accessMode === action
    }

Add `related_doc_access?: Record<string, DocumentAccessMode> | null` to `Test`; add `visibility: DocumentVisibility` and `access_mode: DocumentAccessMode` to `TestDocument`; add `related_doc_access: z.record(z.enum(['view', 'download', 'both'])).optional()` to `testSchema`.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npx tsx scripts/test-document-access.test.ts; npx tsc --noEmit`

Expected: the policy test prints success and TypeScript exits 0.

    git add scripts/test-document-access-controls.sql lib/tests/document-access.ts scripts/test-document-access.test.ts lib/supabase/types.ts lib/validations/test-schema.ts
    git commit -m "feat: add test document access policy"

### Task 2: Configure access in section G

**Files:**

- Modify: `components/tests/TestForm.tsx`
- Modify: `components/tests/TestDocuments.tsx`
- Modify: `app/api/admin/tests/[id]/documents/route.ts`
- Modify: `app/api/admin/tests/[id]/documents/[docId]/route.ts`
- Create: `scripts/test-document-access-form.test.ts`

**Consumes:** Task 1 policy types/functions.

**Produces:** The form posts `related_doc_access`; direct upload and PATCH persist `visibility` and `access_mode`.

- [ ] **Step 1: Write the failing form/API test**

    import assert from 'node:assert/strict'
    import { readFileSync } from 'node:fs'

    const form = readFileSync('components/tests/TestForm.tsx', 'utf8')
    const attachments = readFileSync('components/tests/TestDocuments.tsx', 'utf8')
    const route = readFileSync('app/api/admin/tests/[id]/documents/route.ts', 'utf8')

    assert.match(form, /related_doc_access/)
    assert.match(form, /visibility/)
    assert.match(attachments, /access_mode/)
    assert.match(attachments, /visibility/)
    assert.match(route, /access_mode/)
    assert.match(route, /export async function PATCH/)

- [ ] **Step 2: Verify RED**

Run: `npx tsx scripts/test-document-access-form.test.ts`

Expected: failure for missing `related_doc_access` control.

- [ ] **Step 3: Implement library document controls**

Extend the form's loaded document type with `visibility`. Keep `related_doc_ids` as-is and maintain a separate `related_doc_access` object. On add, initialize an Internal document to `view` and a Public one to `both`; on removal, remove both the ID and its access key. For every selected document chip render its visibility label and:

    const access = normalizeDocumentAccess(doc?.visibility, form.related_doc_access?.[id])
    <select
      value={access.accessMode}
      disabled={access.visibility === 'Internal'}
      onChange={(event) => set('related_doc_access', {
        ...(form.related_doc_access ?? {}),
        [id]: event.target.value as DocumentAccessMode,
      })}
    >
      <option value="view">View</option>
      <option value="download">Download</option>
      <option value="both">View + Download</option>
    </select>

- [ ] **Step 4: Implement direct attachment controls and persistence**

In `TestDocuments.tsx`, create pending upload `visibility` and `accessMode` state. Send `visibility` and `access_mode` in FormData. For each uploaded row render the same selectors; Internal forces `view` and disables the action selector. Send a PATCH request whenever settings change:

    fetch(`/api/admin/tests/${testId}/documents/${doc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility, access_mode: accessMode }),
    })

Parse POST and PATCH values with `normalizeDocumentAccess`. PATCH must require `canEditTests`, update only `visibility, access_mode`, and return the updated row.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npx tsx scripts/test-document-access-form.test.ts; npx tsc --noEmit`

Expected: success output and exit code 0.

    git add components/tests/TestForm.tsx components/tests/TestDocuments.tsx app/api/admin/tests/[id]/documents/route.ts app/api/admin/tests/[id]/documents/[docId]/route.ts scripts/test-document-access-form.test.ts
    git commit -m "feat: configure test document actions"

### Task 3: Serve and render actions for staff

**Files:**

- Create: `app/api/admin/tests/[id]/document-actions/[source]/[docId]/route.ts`
- Create: `components/tests/TestDocumentActions.tsx`
- Modify: `lib/queries/tests.ts`
- Modify: `app/(protected)/staff/tests/[id]/page.tsx`
- Create: `scripts/test-document-action-api.test.ts`

**Consumes:** Task 1 policy and Task 2 persisted settings.

**Produces:** `GET /api/admin/tests/:id/document-actions/:source/:docId?action=view|download`, where `source` is `library` or `attachment`.

- [ ] **Step 1: Write the failing enforcement test**

    import assert from 'node:assert/strict'
    import { existsSync, readFileSync } from 'node:fs'

    const route = 'app/api/admin/tests/[id]/document-actions/[source]/[docId]/route.ts'
    assert.ok(existsSync(route))
    const source = readFileSync(route, 'utf8')
    assert.match(source, /canUseDocumentAction/)
    assert.match(source, /status: 403/)
    assert.match(source, /related_doc_ids/)
    assert.match(source, /access_mode/)

- [ ] **Step 2: Verify RED**

Run: `npx tsx scripts/test-document-action-api.test.ts`

Expected: failure because the staff action route does not exist.

- [ ] **Step 3: Implement the staff action route**

Authenticate with `getActor` and require non-`none` test permission. Validate `action` as `view | download`. For `library`, require the UUID in `test.related_doc_ids`, fetch the non-deleted library document, normalize `document.visibility` with `test.related_doc_access[docId]`, and reject a prohibited action with 403. For `attachment`, fetch by both test ID and attachment ID, normalize its columns, and apply the same rejection. Use R2 `GetObjectCommand`; set `ResponseContentDisposition: 'inline'` for View and `'attachment'` for Download.

- [ ] **Step 4: Implement shared staff buttons**

Create a client `TestDocumentActions` component taking:

    {
      testId: number
      source: 'library' | 'attachment'
      documentId: string
      accessMode: DocumentAccessMode
    }

It calls the Task 3 route and opens the returned signed URL. Render the eye icon only when `canUseDocumentAction(accessMode, 'view')` and the download icon only when `canUseDocumentAction(accessMode, 'download')`.

Extend `getTestDetail` with normalized action/visibility data for library and direct documents. Keep Internal documents in the staff list. Replace `QualityDocumentReadButton` and `DocDownloadButton` in the staff detail page with `TestDocumentActions`.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npx tsx scripts/test-document-action-api.test.ts; npx tsc --noEmit`

Expected: success output and exit code 0.

    git add app/api/admin/tests/[id]/document-actions/[source]/[docId]/route.ts components/tests/TestDocumentActions.tsx lib/queries/tests.ts app/(protected)/staff/tests/[id]/page.tsx scripts/test-document-action-api.test.ts
    git commit -m "feat: enforce test document actions for staff"

### Task 4: Filter and serve public catalog documents

**Files:**

- Create: `app/api/tests/[id]/document-actions/[source]/[docId]/route.ts`
- Modify: `app/api/tests/[id]/route.ts`
- Modify: `components/tests/CatalogDetailModal.tsx`
- Modify: `app/(public)/catalog/[code]/page.tsx`
- Modify: `lib/catalog/public-test.ts`
- Create: `scripts/test-public-document-access.test.ts`

**Consumes:** Task 1 policy and Task 2 metadata.

**Produces:** Public detail payloads and public action URLs that contain only public resources with their permitted buttons.

- [ ] **Step 1: Write the failing public-boundary test**

    import assert from 'node:assert/strict'
    import { existsSync, readFileSync } from 'node:fs'

    const detailApi = readFileSync('app/api/tests/[id]/route.ts', 'utf8')
    assert.match(detailApi, /visibility.*Public/)
    assert.match(detailApi, /status.*Published/)
    assert.match(detailApi, /related_doc_access/)

    const actionRoute = 'app/api/tests/[id]/document-actions/[source]/[docId]/route.ts'
    assert.ok(existsSync(actionRoute))
    const actionApi = readFileSync(actionRoute, 'utf8')
    assert.match(actionApi, /visibility.*Public/)
    assert.match(actionApi, /canUseDocumentAction/)

- [ ] **Step 2: Verify RED**

Run: `npx tsx scripts/test-public-document-access.test.ts`

Expected: failure because no public action route exists.

- [ ] **Step 3: Filter the public detail API**

Query direct attachments with `.eq('visibility', 'Public')`. Query library documents only from `test.related_doc_ids`, then require `.is('deleted_at', null).eq('visibility', 'Public').eq('status', 'Published')`. Return normalized access settings but never return storage paths.

- [ ] **Step 4: Add a public action route and buttons**

Implement the public action route with the exact resource lookup from Task 3 but no authentication. For either source reject non-Public records and prohibited actions; additionally reject library records that are not Published. Return only a signed URL with inline/attachment disposition. Update the public full detail page and catalog modal to render eye/download buttons from the sanitized action mode. Do not render Internal items because the API excludes them.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npx tsx scripts/test-public-document-access.test.ts; npx tsc --noEmit`

Expected: success output and exit code 0.

    git add app/api/tests/[id]/document-actions/[source]/[docId]/route.ts app/api/tests/[id]/route.ts components/tests/CatalogDetailModal.tsx app/(public)/catalog/[code]/page.tsx lib/catalog/public-test.ts scripts/test-public-document-access.test.ts
    git commit -m "feat: expose permitted test documents publicly"

### Task 5: Verify and release safely

**Files:**

- Modify: `README.md` only if it already documents manual SQL migrations.

- [ ] **Step 1: Run all focused tests**

Run:

    npx tsx scripts/related-quality-documents.test.ts
    npx tsx scripts/test-document-access.test.ts
    npx tsx scripts/test-document-access-form.test.ts
    npx tsx scripts/test-document-action-api.test.ts
    npx tsx scripts/test-public-document-access.test.ts

Expected: all commands exit 0 and print a success message.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: `✓ Compiled successfully` and exit code 0.

- [ ] **Step 3: Apply the migration manually**

Open Supabase Dashboard → SQL Editor, paste all of `scripts/test-document-access-controls.sql`, and execute it. Do not test the feature on a live database until SQL execution succeeds.

- [ ] **Step 4: Run acceptance checks**

1. Set one Internal and one Public library document; confirm Internal is View-only in staff and Public supports all three modes.
2. Upload one Internal and one Public direct attachment; confirm the same per-file controls.
3. In staff detail, confirm each document has exactly its allowed action buttons.
4. In public catalog detail, confirm Internal documents are absent and Public documents have exactly their allowed action buttons.
5. Request `action=download` for a View-only resource and confirm HTTP 403.

- [ ] **Step 5: Commit migration documentation only if changed**

    git add README.md
    git commit -m "docs: document test document access migration"

Do not make an empty commit when `README.md` is unchanged.

## Self-Review

- Spec coverage: Task 1 preserves legacy data, Task 2 configures both document sources, Task 3 protects staff actions, Task 4 protects and renders public actions, and Task 5 covers migration plus acceptance.
- Scope: No DRM, viewer rewrite, or unrelated document-module changes are included.
- Type consistency: all tasks use the same names: `DocumentVisibility`, `DocumentAccessMode`, `DocumentAction`, `related_doc_access`, `visibility`, and `access_mode`.

