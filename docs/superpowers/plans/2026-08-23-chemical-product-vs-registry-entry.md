# Chemical Product vs Registry Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the chemical registry clearly distinguish one shared chemical identity from the separate inventory/usage entries owned by each department or storage scope, without changing or merging existing records.

**Architecture:** Reuse the existing `chemical_products`, `chemical_unit_products`, and `chemical_inventory_holdings` relationship. Add a small pure summary helper for the UI, make the registry table and modal copy name the two levels explicitly, and preserve the existing `productMode: 'existing' | 'new'` API workflow.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, existing Supabase-backed repository, Node/tsx contract tests.

## Global Constraints

- Do not delete, merge, rewrite, or backfill existing chemical products, holdings, SDS records, or publication records.
- Do not add a new database table or migration; the current product/unit/holding model already supports the separation.
- A registry count continues to mean inventory/usage entries; a separate product count means distinct chemical identities.
- Reusing an existing chemical product must create/use a new scoped registry entry and must not duplicate the product master.
- Keep existing authorization, immediate-save behavior, room auto-publication, department publication, and SDS workflows unchanged.

---

### Task 1: Product and registry-entry summary contract

**Files:**
- Create: `lib/chemical-safety/registry-summary.ts`
- Test: `lib/chemical-safety/registry-summary.test.ts`
- Modify: `package.json`

**Interfaces:**
- `summarizeChemicalRegistry(rows: Pick<ChemicalRegistryRow, 'productId' | 'holdingId' | 'storageScope'>[]): { productCount: number; registryEntryCount: number; roomEntryCount: number; departmentEntryCount: number }`

- [ ] **Step 1: Write the failing test**

Use rows containing two holdings for one product and one holding for a second product. Assert that the product count is `2`, registry entry count is `3`, and scope counts are `1` room plus `2` department entries.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm exec -- tsx lib/chemical-safety/registry-summary.test.ts`

Expected: FAIL because `./registry-summary` does not exist.

- [ ] **Step 3: Write the minimal implementation**

Use `Set` for product and holding IDs and count `storageScope === 'room'` or `'department'`. Do not load data or call Supabase from this helper.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm exec -- tsx lib/chemical-safety/registry-summary.test.ts`

Expected: PASS with `chemical-safety registry summary: ok`.

- [ ] **Step 5: Add the test to `test:chemical-safety`**

Insert `tsx lib/chemical-safety/registry-summary.test.ts` beside the other pure chemical registry tests in the existing script.

### Task 2: Make the registry UI name both levels

**Files:**
- Modify: `components/chemical-safety/ChemicalSafetyHubClient.tsx`
- Modify: `scripts/chemical-safety-ui.test.ts`

**Interfaces:**
- Import `summarizeChemicalRegistry` from `@/lib/chemical-safety/registry-summary`.

- [ ] **Step 1: Write the failing UI contract assertions**

Require the registry source to contain the user-facing labels `สารเคมีหลัก`, `รายการของงาน/คลัง`, and the explanatory copy that a shared product can have multiple registry entries. Require the component to call `summarizeChemicalRegistry(registry)`.

- [ ] **Step 2: Run the targeted UI test to verify it fails**

Run: `npm exec -- tsx scripts/chemical-safety-ui.test.ts`

Expected: FAIL because the current page only calls the second column `หน่วยงาน / ตำแหน่ง` and does not display the two-level explanation.

- [ ] **Step 3: Implement the minimal UI change**

Add a compact explanatory card above the registry filters showing `{productCount} สารเคมีหลัก` and `{registryEntryCount} รายการของงาน/คลัง`. Rename the relevant table headings and add a row-level note that the current row is the scoped inventory entry while the chemical name is shared.

- [ ] **Step 4: Run the targeted UI test to verify it passes**

Run: `npm exec -- tsx scripts/chemical-safety-ui.test.ts`

Expected: PASS.

### Task 3: Clarify create-existing vs create-new workflow

**Files:**
- Modify: `components/chemical-safety/RegistryChangeModal.tsx`
- Modify: `components/chemical-safety/ChemicalDetailsModal.tsx`
- Modify: `scripts/chemical-safety-ui.test.ts`

**Interfaces:**
- Preserve the existing payloads: `productMode: 'existing'` with `productId`, and `productMode: 'new'` with product fields plus the scoped holding fields.

- [ ] **Step 1: Write the failing copy assertions**

Require the add modal to expose `สร้างสารเคมีหลักใหม่ + รายการคลัง` and `ใช้สารเคมีหลักเดิม + เพิ่มรายการคลัง`, and require the details modal to distinguish `ข้อมูลสารเคมีหลัก` from `รายการคลังของงาน/ห้องนี้`.

- [ ] **Step 2: Run the targeted UI test to verify it fails**

Run: `npm exec -- tsx scripts/chemical-safety-ui.test.ts`

Expected: FAIL because the current options say `สร้างรายการสารใหม่` and `ใช้สารที่มีอยู่` without explaining the scoped registry entry.

- [ ] **Step 3: Update only the labels and explanatory text**

Keep the same select state, validation, POST body, API routes, and SDS handling. Explain that selecting an existing product creates a new scoped registry entry and does not create a duplicate chemical master. Add a details subtitle that identifies the current row as the work/storage entry.

- [ ] **Step 4: Run the targeted UI test to verify it passes**

Run: `npm exec -- tsx scripts/chemical-safety-ui.test.ts`

Expected: PASS.

### Task 4: Full verification

**Files:**
- No additional source files.

- [ ] **Step 1: Run the chemical-safety suite**

Run: `npm run test:chemical-safety`

Expected: PASS with no failed tests.

- [ ] **Step 2: Run TypeScript validation**

Run: `npm exec tsc -- --noEmit`

Expected: exit code `0`.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Next.js compiles, type-checks, generates all pages, and exits `0`.

- [ ] **Step 4: Review the final diff**

Run: `git diff --check` and `git status --short --untracked-files=all`. Confirm there are no migrations, destructive SQL statements, or unrelated generated files in the change.
