# Filtered Documents ZIP Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a server-side ZIP download for Published documents matching the current document library filters.

**Architecture:** Add a focused server helper that plans ZIP contents from document rows and filters, then expose a route handler that verifies document permissions, queries Published documents, reads selected files from R2, and returns a ZIP response. Add client UI in `DocumentsClient` to select PDF, Word/Excel, or both, show preparation steps, show real byte download percentage, and trigger the browser save.

**Tech Stack:** Next.js 16 App Router route handlers, React 19 client component, Supabase admin queries, AWS S3-compatible R2 `GetObjectCommand`, `fflate` for ZIP generation, Node `assert` tests run with `tsx`.

## Global Constraints

- Visible and callable only for Reviewer, Document Controller, and Admin.
- Export always enforces `status = Published`.
- Use current filters: document type, department, search text, visibility.
- File choices: PDF, Word/Excel, PDF + Word/Excel.
- ZIP folders: `PDF/`, `Word-Excel/`, plus `download-summary.txt`.
- Skip missing files and record skips in `download-summary.txt`.
- Warning threshold is 200 MB estimated file size.
- Hard limit is 300 MB estimated file size.
- Hard limit is 100 matching documents.
- Client progress is step-based during preparation and percentage-based while downloading the ZIP response.

---

### Task 1: ZIP Planning Helper

**Files:**
- Create: `lib/documents/bulk-download.ts`
- Test: `lib/documents/bulk-download.test.ts`

**Interfaces:**
- Produces: `type BulkDownloadKind = 'pdf' | 'source' | 'both'`
- Produces: `planDocumentZip(rows, options): BulkDownloadPlan`
- Produces: `buildBulkDownloadFilename(filters): string`

- [ ] **Step 1: Write failing tests**

Add tests for Published enforcement at the query layer inputs, PDF/source/both planning, missing file skips, folder paths, summary text, and limits.

- [ ] **Step 2: Run failing tests**

Run: `npx tsx lib\documents\bulk-download.test.ts`
Expected: FAIL because `lib/documents/bulk-download.ts` does not exist.

- [ ] **Step 3: Implement helper**

Create pure functions for filtering payload normalization, selected file planning, ZIP entry names, summary content, warning/hard limits, and export filename construction.

- [ ] **Step 4: Run tests**

Run: `npx tsx lib\documents\bulk-download.test.ts`
Expected: PASS.

### Task 2: Server Route

**Files:**
- Create: `app/api/admin/documents/bulk-download/route.ts`
- Modify: `lib/documents/bulk-download.ts`
- Test: extend `lib/documents/bulk-download.test.ts`

**Interfaces:**
- Consumes: `planDocumentZip(rows, options)` from Task 1.
- Produces: `POST /api/admin/documents/bulk-download` accepting JSON filters and `kind`.

- [ ] **Step 1: Add failing tests for query params and limits**

Pure tests should assert route query options force `status = Published`, map type/department/search/visibility, and reject over-limit plans.

- [ ] **Step 2: Run failing tests**

Run: `npx tsx lib\documents\bulk-download.test.ts`
Expected: FAIL until helper supports route filter parsing.

- [ ] **Step 3: Implement route**

Verify actor and role/doc role, query Published docs with current filters, plan ZIP entries, fetch R2 objects, generate ZIP with `fflate`, and return `application/zip` with `Content-Disposition` and `Content-Length`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx tsx lib\documents\bulk-download.test.ts`
Run: `npx tsc --noEmit`
Expected: PASS.

### Task 3: Client UI and Progress

**Files:**
- Modify: `app/(protected)/staff/documents/DocumentsClient.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/documents/bulk-download`.

- [ ] **Step 1: Add UI state**

Add selected kind, menu/modal state, step status text, download percentage, and busy state.

- [ ] **Step 2: Add button**

Show “ดาวน์โหลดตาม Filter” only for Reviewer, Document Controller, and Admin. Keep it near the existing filter controls.

- [ ] **Step 3: Add download function**

POST current filters and selected kind. Read the response body stream, update percentage from `Content-Length`, create a Blob URL, and click a temporary `<a download>`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Run: `npm run build`
Expected: PASS.

