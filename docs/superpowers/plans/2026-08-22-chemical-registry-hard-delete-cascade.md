# Chemical Registry Hard-Delete Cascade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ผู้ดูแลลบ chemical holding จากหน้าทะเบียนสารเคมีได้จริง โดยลบ SDS metadata ที่เป็นของ holding เดียวกันใน transaction เดียว, บล็อก shared SDS dependency อย่างอธิบายได้, และลบ R2 object เฉพาะไฟล์ที่ไม่มี reference อื่น

**Architecture:** เพิ่ม pure impact planner สำหรับคำนวณผลกระทบและ reference ของไฟล์, เพิ่ม service-role API route สำหรับ preflight/confirmation และ RPC สำหรับ hard-delete cascade ใน database transaction เดียว, แล้วให้ client แสดง impact modal ก่อนยืนยัน การลบ binary หลัง commit ทำที่ server และไม่มีตัวเลือกให้ user เลือกเก็บหรือลบเอง

**Tech Stack:** Next.js App Router route handlers, React client component, TypeScript, Supabase/PostgreSQL RPC migration, Supabase service-role client, Cloudflare R2 ผ่าน AWS SDK, existing chemical-safety test scripts

## Global Constraints

- รักษา product master (`chemical_products`) และ `chemical_unit_products` รวมถึง holding อื่นไว้เสมอ
- shared SDS version/publication/link ต้องทำให้ลบไม่ได้และต้องไม่มี partial delete
- การใช้ PDF binary เดียวกันหลายรายการไม่ใช่เหตุผลให้บล็อก ถ้า reference อื่นยังอยู่ให้เก็บไฟล์ไว้และลบเฉพาะ metadata เป้าหมาย
- frontend ห้ามเขียน Supabase tables โดยตรง; ใช้ API route และ `requireChemicalCustodian` ตามสิทธิ์เดิม
- R2 cleanup ทำหลัง DB commit; failure ไม่ rollback ข้อมูลที่ลบสำเร็จและต้องคืน warning ที่อ่านได้
- ทุกการแก้ไฟล์ใช้ `apply_patch`; ทุก migration ต้องสร้างผ่าน `supabase migration new` ก่อนแก้ไข
- ใช้ TDD: เพิ่ม tests ให้ fail ก่อนเพิ่ม production code และรัน test ที่เกี่ยวข้องหลังแต่ละ task

---

## Task 1: Add failing regression and contract tests

**Files:**

- Create `lib/chemical-safety/holding-delete.test.ts`
- Create `scripts/chemical-safety-holding-delete-api.test.ts`
- Create `scripts/chemical-safety-holding-delete-ui.test.ts`
- Modify `package.json` to include the new `tsx` contract tests in `test:chemical-safety`

- [x] Write pure-planner tests for: room SDS/publication deletion, department SDS link deletion, shared SDS version blocking with no deletion plan, same file referenced by another version being kept, orphan file being selected for cleanup, product master/other holding preservation.
- [x] Write route contract tests that require a `GET` impact preflight and a `DELETE` RPC path, return `409` with impact for `holding_delete_shared_dependency`, and never create a `holding_delete` change request when the preflight is blocked.
- [x] Write UI contract tests that require an impact confirmation, an explicit irreversible-delete message, a visible shared-dependency reason, and a refresh of registry/SDS data after success.
- [x] Run the focused new tests and record the expected red failures before writing the planner, route, or migration.

Verification command:

```powershell
npm exec tsx -- lib/chemical-safety/holding-delete.test.ts
npm exec tsx -- scripts/chemical-safety-holding-delete-api.test.ts
npm exec tsx -- scripts/chemical-safety-holding-delete-ui.test.ts
```

Expected result before implementation: the new tests fail because the planner, route, and cascade UI do not yet exist.

## Task 2: Implement the typed impact planner

**Files:**

- Create `lib/chemical-safety/holding-delete.ts`
- Modify `lib/chemical-safety/holding-delete.test.ts`

- [x] Define serializable impact types for target holding, SDS versions, room/department publications, department SDS rows, shared dependencies, files to delete, and files to keep.
- [x] Implement `buildChemicalHoldingDeleteImpact(input)` as a pure function. Candidate versions must include direct `source_holding_id`, department links for the target holding, and target publications’ `sds_version_id` so legacy publication references are not missed.
- [x] Mark a dependency as shared only when another holding owns or publishes/links the same SDS version. Do not mark a shared file binary by itself as a blocking dependency.
- [x] Compute file cleanup from references remaining after the target metadata is deleted. A file is deletable only when no other `chemical_sds_versions` or `chemical_department_sds` row references it.
- [x] Keep the planner independent of Supabase and R2 so its edge cases remain deterministic and testable.
- [x] Run the planner tests and confirm they pass.

Verification command:

```powershell
npm exec tsx -- lib/chemical-safety/holding-delete.test.ts
```

## Task 3: Add the transactional Supabase cascade RPC

**Files:**

- Create migration with `supabase migration new chemical_safety_holding_hard_delete_cascade`
- Modify the generated migration file only
- Modify `scripts/chemical-safety-holding-delete.test.ts`

- [x] Add `public.delete_chemical_holding_cascade(p_holding_id uuid, p_actor_id uuid) RETURNS jsonb` as a service-role-only, transaction-scoped function using the repository’s existing permission conventions.
- [x] Lock the target holding and relevant dependency rows before rechecking shared dependencies. Raise `holding_delete_shared_dependency` before any delete when a version/publication/department link is still used by another holding, allowing PostgreSQL to roll back the entire call.
- [x] Delete in FK-safe order: target publications, target department links, target-owned SDS versions (with cascading hazards), target department SDS metadata that has no remaining reference, then the target holding.
- [x] Before deleting file rows, collect only orphan `r2_key` values; do not delete a file row when another version or department SDS still references it.
- [x] Return deleted IDs and `fileKeys` in JSON so the server can perform post-commit R2 cleanup. Never delete `chemical_products` or `chemical_unit_products`.
- [x] Restrict execute to the service role and notify PostgREST/schema cache in the same migration style as the existing chemical-safety RPCs.
- [x] Update the existing `review_chemical_holding_delete_request` compatibility path so any old `holding_delete` request uses the same cascade guard rather than preserving the old SDS-FK failure behavior.
- [x] Add migration contract assertions for delete order, shared guard/rollback, file reference checks, product preservation, and service-role permissions.
- [x] Run the migration contract test and the focused holding-delete tests.

Verification commands:

```powershell
npm exec tsx -- scripts/chemical-safety-holding-delete.test.ts
npm run test:chemical-safety
```

## Task 4: Add server API preflight, delete, and storage cleanup

**Files:**

- Create `app/api/admin/chemical-safety/registry/[holdingId]/delete/route.ts`
- Create `lib/chemical-safety/holding-delete-storage.ts`
- Modify `scripts/chemical-safety-holding-delete-api.test.ts`

- [x] Implement `GET` using the service-role client to load the holding and all relevant SDS/publication/link/file references, then return the typed pure-planner impact.
- [x] Enforce `requireChemicalCustodian` for the holding’s unit scope on both `GET` and `DELETE`; return the repository’s standard not-found/authorization responses.
- [x] Implement `DELETE` by reloading the impact, returning `409` with the impact when shared dependencies exist, and otherwise calling `delete_chemical_holding_cascade` with the authenticated actor ID.
- [x] Map the RPC’s shared-dependency/stale result to `409` without exposing raw database errors. The server must never create a pending change request for this workflow.
- [x] Implement post-commit R2 deletion with `DeleteObjectCommand` for only the returned orphan keys. Return cleanup failures as a warning while keeping the successful database deletion.
- [x] Make cleanup deterministic for empty key lists and isolate each object failure so one R2 failure does not prevent attempts for other orphan objects.
- [x] Run route tests and TypeScript checks for the new handler/helper.

Verification commands:

```powershell
npm exec tsx -- scripts/chemical-safety-holding-delete-api.test.ts
npm exec tsc -- --noEmit
```

## Task 5: Replace the registry delete interaction with impact confirmation

**Files:**

- Modify `components/chemical-safety/ChemicalSafetyHubClient.tsx`
- Create `components/chemical-safety/HoldingDeleteImpactDialog.tsx`
- Modify `scripts/chemical-safety-holding-delete-ui.test.ts`

- [x] Change the red-X action to request preflight impact from the new route instead of creating/submitting `holding_delete` change requests.
- [x] Show the target holding, SDS/publication rows that will disappear, files that will remain because another metadata row references them, and an explicit irreversible confirmation before calling `DELETE`.
- [x] When shared dependencies exist, disable the destructive action and show the other holding/department/publication that blocks deletion.
- [x] On success, refresh the registry and both SDS views through the existing router/data-loading flow and show a Thai success or cleanup-warning toast.
- [x] Preserve loading, cancel, error, and repeated-click behavior; do not leave stale modal state after cancel or a completed deletion.
- [x] Run the UI contract test and the existing component/type checks.

Verification command:

```powershell
npm exec tsx -- scripts/chemical-safety-holding-delete-ui.test.ts
```

## Task 6: Integrate error mapping and existing chemical-safety coverage

**Files:**

- Modify `lib/chemical-safety/api.ts` if the new route shares its standard API error mapping
- Modify existing chemical-safety tests only where the new behavior changes an outdated expectation

- [x] Add a stable client-facing mapping for shared dependency, holding not found, stale/preflight mismatch, and cleanup warning without exposing SQL text.
- [x] Keep the old `holding_delete` request schema available for backward compatibility but ensure the registry UI no longer uses it for direct deletion.
- [x] Run all existing chemical-safety tests, including the prior unlink/delete contract tests, and correct only assertions that conflict with the approved hard-delete behavior.

Verification command:

```powershell
npm run test:chemical-safety
```

## Task 7: Verify build, migration contracts, and end-to-end behavior

- [x] Run `git diff --check` and inspect the complete diff for accidental changes, direct browser table writes, product deletion, or an option that asks the user whether to keep a shared file.
- [x] Run the complete `test:chemical-safety` suite and TypeScript validation. The suite passes; repository TypeScript remains blocked by pre-existing stale `.next` validator imports.
- [x] Run the Next.js production build using the repository’s configured command. Compilation passes; the build’s type phase hits the same pre-existing stale `.next` validator imports.
- [x] Check Supabase local/integration availability. Local lint/application is unavailable because Docker/Postgres is not running; migration contracts and pure-planner coverage remain green.
- [x] Confirm no new protected page was added, so `proxy.ts` requires no route-regex change.
- [x] Use the verification-before-completion skill and report exact verification results.

Verification commands:

```powershell
git diff --check
npm run test:chemical-safety
npm exec tsc -- --noEmit
npm run build
```

## Execution

The user explicitly approved starting implementation, so execute this plan inline in the current shared checkout with the `executing-plans` workflow. Do not create a second worktree that would hide the changes from the user.
