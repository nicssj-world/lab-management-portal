# Chemical Registry PDF Export and Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export the filtered chemical registry as a Thai-capable A4 landscape PDF comparable to the supplied master list, then complete data, security, visual, and operational release checks for the entire chemical-safety module.

**Architecture:** The export Route Handler calls the same registry repository and filter schema as the on-screen table, then passes safe rows into a pure jsPDF/AutoTable builder with embedded Sarabun. Automated tests validate dimensions, text, status semantics, pagination, and filter parity; a rendered-image acceptance check compares the initial 25-row output with the supplied source before public launch.

**Tech Stack:** Next.js 16.2.6 Route Handlers, TypeScript 5, jsPDF 4.2.1, jspdf-autotable 5.0.8, embedded Sarabun through the existing PDF helper, `pdf-lib` 1.17, `unpdf` 1.6, `@napi-rs/canvas` 0.1, Supabase/Postgres, Node `assert` + `tsx` tests.

## Global Constraints

- Requires the foundation/import, internal-workflow, and public-SDS plans.
- Source design: `docs/superpowers/specs/2026-07-26-chemical-room-sds-design.md`.
- Source format is one-page A4 landscape, 841.92 × 595.32 pt, titled `Unit Chemical Inventory List`, updated June 2026.
- Export uses the exact active registry filters and shared repository query; no duplicate export-only query logic.
- Default export represents the current approved registry view.
- Only a current approved SDS prints an affirmative/check indicator. Draft, mismatch, missing, superseded, rejected, expired, or review-due states print explicit text.
- PDF includes No., Chemical Name, SDS status, package/container volume, current count, minimum stock, total volume, GHS classification, storage position, and responsible unit.
- Embed Thai Sarabun; Thai/English text wraps without clipping and remains extractable.
- Repeat headers, prevent row splitting, add page number/generated timestamp/record count, and paginate safely beyond the initial 25 rows.
- Export is staff-only, permission checked, audited, and returned with `Cache-Control: private, no-store`.
- Physical storage/GHS validation by responsible safety personnel remains mandatory before production approval/public access.

---

### Task 1: Lock filter parity and export-row formatting

**Files:**
- Create: `lib/chemical-safety/export-rows.ts`
- Create: `lib/chemical-safety/export-rows.test.ts`
- Modify: `lib/chemical-safety/repository.ts`
- Modify: `lib/chemical-safety/schemas.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: one exported `chemicalRegistryFiltersSchema` used by registry GET, staff page URLs, and PDF export.
- Produces: `toChemicalPdfRows(rows): ChemicalPdfRow[]` and deterministic display/status formatters.

- [ ] **Step 1: Write failing filter/status parity tests**

Build fixture rows for approved, draft, mismatch, missing, review-due, and quantity-conflict states. Assert:

```ts
assert.equal(formatPdfSdsStatus({ sdsStatus: 'approved' }), '✓ มี SDS ที่อนุมัติแล้ว')
assert.equal(formatPdfSdsStatus({ sdsStatus: 'draft' }), 'รอตรวจสอบ SDS')
assert.equal(formatPdfSdsStatus({ sdsStatus: 'mismatch' }), 'SDS ไม่ตรงผลิตภัณฑ์')
assert.equal(formatPdfSdsStatus({ sdsStatus: 'missing' }), 'ไม่พบ SDS')
assert.equal(formatPdfSdsStatus({ sdsStatus: 'review_due' }), 'มี SDS — ถึงกำหนดทบทวน')
```

Assert the filter object parsed for `/registry` equals the object passed to `listChemicalRegistry` for `/export`, including q/unit/room/position/lifecycle/SDS/GHS.

- [ ] **Step 2: Verify failure**

Run: `npx tsx lib/chemical-safety/export-rows.test.ts`

Expected: FAIL because `export-rows.ts` does not exist.

- [ ] **Step 3: Implement deterministic export formatting**

Define:

```ts
export interface ChemicalPdfRow {
  no: string
  chemicalName: string
  sdsStatus: string
  packageVolume: string
  currentCount: string
  minimumStock: string
  totalVolume: string
  ghsClassification: string
  storagePosition: string
  responsibleUnit: string
}
```

Package/count/minimum use `—` when absent. Total volume shows the normalized calculated total; when a conflict is unresolved, print `รายงาน: <raw> / คำนวณ: <normalized>` so the PDF never hides the discrepancy. GHS classification combines approved hazard class/category, signal word, and pictogram codes; when no approved exact SDS exists, print `รอยืนยันจาก SDS` rather than the raw master-list claim.

- [ ] **Step 4: Export and reuse one filter schema**

Move/retain `chemicalRegistryFiltersSchema` in `schemas.ts` and import it from both the registry Route Handler and export Route Handler. `listChemicalRegistry(filters)` remains the single data function. Add a static test that fails if the export route queries `supabaseAdmin.from('chemical_` directly.

- [ ] **Step 5: Run tests and commit**

Append the export-row test to `test:chemical-safety`, then run:

```bash
npm run test:chemical-safety
```

Expected: all tests pass.

```bash
git add lib/chemical-safety app/api/admin/chemical-safety/registry package.json
git commit -m "refactor(chemical-safety): share registry export filters"
```

---

### Task 2: Build and verify the A4 landscape Thai PDF

**Files:**
- Create: `lib/chemical-safety/registry-pdf.ts`
- Create: `lib/chemical-safety/registry-pdf.test.ts`
- Create: `scripts/render-chemical-registry-pdf.ts`
- Modify: `lib/external-quality/export.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `buildChemicalRegistryPdf(input): Buffer`.
- Reuses: `createThaiPdfDoc('landscape')` and `sarabunBase64`.
- Produces a deterministic rendering script for visual inspection.

- [ ] **Step 1: Write the failing PDF test**

Create 25-row and 70-row fixtures. Load generated bytes with `PDFDocument.load` and `unpdf`, then assert:

- 25-row fixture is one A4 landscape page when source-like values fit;
- page width/height are within 1 pt of 841.92 × 595.32;
- title, unit, as-of date, all 10 headers, Thai names, record count, and page number are extractable;
- only approved rows contain the check-status phrase;
- the five alternate SDS statuses remain explicit;
- unresolved quantity conflict shows both reported/calculated values;
- 70 rows create multiple pages and each page contains the table header/page number.

- [ ] **Step 2: Verify failure**

Run: `npx tsx lib/chemical-safety/registry-pdf.test.ts`

Expected: FAIL because `registry-pdf.ts` does not exist.

- [ ] **Step 3: Reuse the shared Thai PDF helper without changing existing exports**

Use the existing regular Sarabun registration from `createThaiPdfDoc('landscape')`. Do not add a font dependency, replace the helper, or change other exports' orientation heuristics; create hierarchy with size, spacing, and color while keeping all Thai text in the embedded font.

- [ ] **Step 4: Implement the pure PDF builder**

Export:

```ts
export interface ChemicalRegistryPdfInput {
  rows: ChemicalPdfRow[]
  scopeLabel: string
  asOfDate: string
  generatedAt: string
}

export function buildChemicalRegistryPdf(input: ChemicalRegistryPdfInput): Buffer
```

Create A4 landscape in millimeters. Draw:

- centered `Unit Chemical Inventory List` at 9 mm;
- `Unit/Department: <scope>` and `ข้อมูล ณ วันที่: <Thai date>` at 15–20 mm;
- AutoTable beginning at 24 mm with exact 10 headers;
- blue header fill comparable to the source, black grid lines, 7–8 pt embedded Sarabun, `overflow: 'linebreak'`, `rowPageBreak: 'avoid'`, and repeated `showHead: 'everyPage'`;
- footer in `didDrawPage` with generated timestamp, total records, and the token `หน้า X / {total_pages_count_string}`, followed by `doc.putTotalPages('{total_pages_count_string}')` after AutoTable completes.

Use explicit column widths that fit the 277 mm printable width, with the largest allocations for chemical name and GHS classification. Do not use horizontal page splitting.

- [ ] **Step 5: Add deterministic render-to-PNG inspection tooling**

`scripts/render-chemical-registry-pdf.ts` builds the 25-row fixture, writes PDF and page PNGs under `tmp/chemical-safety-pdf/`, and renders at 2× scale using `unpdf.createIsomorphicCanvasFactory(() => import('@napi-rs/canvas'))`. It is diagnostic only and does not commit generated PDF/PNG files.

- [ ] **Step 6: Run PDF tests and inspect the render**

```bash
npx tsx lib/chemical-safety/registry-pdf.test.ts
npx tsx scripts/render-chemical-registry-pdf.ts
```

Expected: tests pass and the script reports one source-like page plus output paths. Inspect the PNG for clipped Thai marks, overlapping rows, missing borders, status ambiguity, and footer collision.

- [ ] **Step 7: Register and commit PDF generation**

Append the PDF test to `test:chemical-safety`.

```bash
git add lib/chemical-safety/registry-pdf.ts lib/chemical-safety/registry-pdf.test.ts scripts/render-chemical-registry-pdf.ts lib/external-quality/export.ts package.json
git commit -m "feat(chemical-safety): generate Thai registry PDF"
```

---

### Task 3: Add the protected export endpoint and current-filter action

**Files:**
- Create: `app/api/admin/chemical-safety/registry/export/route.ts`
- Create: `scripts/chemical-safety-export-api.test.ts`
- Modify: `components/chemical-safety/ChemicalSafetyHubClient.tsx`
- Modify: `components/chemical-safety/ChemicalRegistryTable.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces: staff-only `GET /api/admin/chemical-safety/registry/export`.
- Produces: an Export PDF action that serializes the currently applied registry filters.

- [ ] **Step 1: Write the failing export API/UI contract test**

Require:

- `requireChemicalViewer` before data access;
- `chemicalRegistryFiltersSchema` and `listChemicalRegistry` reuse;
- no direct chemical table query in the export route;
- `buildChemicalRegistryPdf(toChemicalPdfRows(rows))`;
- `Content-Type: application/pdf`, safe attachment disposition, and `Cache-Control: private, no-store`;
- an audit action containing actor, filter scope, record count, and generated time but no row contents;
- UI button disabled during generation and current URL/filter serialization.

- [ ] **Step 2: Verify failure**

Run: `npx tsx scripts/chemical-safety-export-api.test.ts`

Expected: FAIL because the export route does not exist.

- [ ] **Step 3: Implement the protected export Route Handler**

The handler:

1. calls `requireChemicalViewer`;
2. parses filters from `req.nextUrl.searchParams`;
3. calls `listChemicalRegistry(filters)` once;
4. derives a scope label from the selected unit/room or `ทุกหน่วยงาน`;
5. uses Bangkok as-of/generated dates;
6. builds the PDF;
7. inserts `chemical_safety.registry.export_pdf` in `audit_log` with JSON filter/count metadata;
8. returns bytes with a filename such as `chemical-inventory-all-2026-07-26.pdf`.

If the query/generation fails, return a Thai 500 response and do not write a success audit event. Empty results generate one valid page with `ไม่มีข้อมูลตามตัวกรอง`.

- [ ] **Step 4: Add the current-filter Export PDF action**

Place the action above the registry table. Build a `URLSearchParams` from the exact applied filters, call the export endpoint, extract the filename from Content-Disposition or use a safe fallback, create/revoke an object URL, and preserve the current table/tab state. Show an explicit error for 401/403/422/500 and re-enable the button in `finally`.

- [ ] **Step 5: Run focused and build checks**

Append the export API test to `test:chemical-safety`, then run:

```bash
npm run test:chemical-safety
npx tsc --noEmit
npm run build
```

Expected: all commands pass and the export route is listed as dynamic.

- [ ] **Step 6: Commit the export endpoint/UI**

```bash
git add app/api/admin/chemical-safety/registry/export components/chemical-safety scripts/chemical-safety-export-api.test.ts package.json
git commit -m "feat(chemical-safety): export filtered registry PDF"
```

---

### Task 4: Validate the real 25-row export against the source master list

**Files:**
- Create: `scripts/export-current-chemical-registry.ts`
- Create: `docs/chemical-safety-release-checklist.md`

**Interfaces:**
- Produces a local authorized diagnostic export using the same repository/builder.
- Produces a signed-off visual/data comparison checklist; generated source/PNG/PDF artifacts remain uncommitted.

- [ ] **Step 1: Add a non-public diagnostic export command**

The script loads `.env.local`, accepts the same filters, requires an explicit `--output` path within `tmp/chemical-safety-pdf/`, calls `listChemicalRegistry`, and writes the PDF. It does not accept arbitrary SQL, does not bypass approved-current defaults, and prints the record count/hash/output path.

- [ ] **Step 2: Generate the initial room PDF and render it**

Run the diagnostic export for `chemical-prep`, then render every page to PNG with the Task 2 tool. Expected initial count after responsible approval is 25 rows. Before all records are approved, the output must honestly show draft/mismatch/missing statuses and may be used only as a review copy.

- [ ] **Step 3: Compare data field by field**

Check sequence, names, package sizes, counts, minimums, totals, GHS classification source, normalized B3/B4 position, responsible unit, and SDS status. Confirm the five quantity conflicts remain explicit until resolved and the source's raw GHS/free-text is not presented as approved structured GHS.

- [ ] **Step 4: Compare page layout visually**

Compare side-by-side with `C:\Users\User\Downloads\Unit Chemical Inventory List ห้องเก็บสารเคมี (1).pdf`. Verify landscape orientation, recognizable header/table structure, Thai rendering, readable 25 rows where feasible, repeated header/page footer behavior, and no clipping/split rows. Record reviewer/date/result in `docs/chemical-safety-release-checklist.md`; do not commit source documents or generated PDFs.

- [ ] **Step 5: Commit diagnostic tooling/checklist**

```bash
git add scripts/export-current-chemical-registry.ts docs/chemical-safety-release-checklist.md
git commit -m "test(chemical-safety): add registry export acceptance checks"
```

---

### Task 5: Complete full-module safety, security, and rollout acceptance

**Files:**
- Modify: `docs/chemical-safety-release-checklist.md`
- Modify: `README.md`

**Interfaces:**
- Consumes every chemical-safety plan.
- Produces a production-release decision backed by data-owner sign-off, tests, and fail-closed public checks.

- [ ] **Step 1: Complete responsible-person validation**

For each of 25 master-list products, record Chemical Custodian and reviewer confirmation of physical bottle identity, CAS, concentration/grade, manufacturer/product code where present, current quantity, position, SDS Section 1 identity, SDS Section 2 GHS data, revision/effective date, and responsible unit. Resolve the five quantity conflicts explicitly; do not infer an answer from arithmetic alone.

- [ ] **Step 2: Resolve SDS blockers before public enablement**

Document resolution for all seven mismatches and five missing items. A product without an exact approved SDS remains absent from public search/QR and prints a non-approved PDF status. Do not use the anhydrous-ammonia gas, sodium-acetate, TFA-d, generic concentration, or uncertain Wright’s Baso candidates as substitutes.

- [ ] **Step 3: Verify internal roles and audit trail**

Sample import, draft edit, submit, reject/approve, supersede, role grant/revoke, QR create/revoke, public-access removal, and PDF-export audit events. Confirm self approval fails in UI/API/database and unit-scoped custodians/reviewers cannot mutate another unit.

- [ ] **Step 4: Verify public no-login behavior and privacy**

In a signed-out browser, verify `/sds`, approved SDS files from multiple units, valid QR links, and MN-LAB-02. Verify drafts/superseded/retired items, revoked tokens, another Internal manual, direct R2 guesses, and private IDs fail. Inspect HTML/RSC/JSON for forbidden quantity/location/workflow fields.

- [ ] **Step 5: Run the complete automated gate**

Run each command separately:

```bash
npm run test:chemical-safety
npm run test:security
npm run test:lab-map
npx tsc --noEmit
npm run build
```

Expected: every command exits 0.

- [ ] **Step 6: Complete responsive/accessibility and PDF visual checks**

At desktop and mobile widths, verify tab/search/filter keyboard behavior, visible focus, 44 px actions, dialogs, upload progress, GHS alt text, color-independent statuses, reduced motion, long Thai/English wrapping, public/manual file errors, and 429 states. Confirm the real registry PDF against the source at 100% zoom and printed A4 landscape.

- [ ] **Step 7: Stage production migration/import safely**

Apply schema first, then run the exact source dry-run and compare baseline counts. Apply import only after counts match. Keep every new SDS/product/holding non-public until two-person validation. Enable public SDS, manual banner, and QR targets only after approved-current rows exist; public page may launch earlier with an honest empty/partial approved library.

- [ ] **Step 8: Record release decision and recovery actions**

The checklist records schema/import hashes, test/build results, data-owner approvals, public privacy inspection, PDF comparison, release time, and rollback actions: revoke QR tokens, remove SDS approval/public eligibility, and disable the public navigation entry without deleting audit/source data.

- [ ] **Step 9: Commit final operations documentation**

```bash
git add docs/chemical-safety-release-checklist.md README.md
git commit -m "docs(chemical-safety): finalize release procedure"
```
