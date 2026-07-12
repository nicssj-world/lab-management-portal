# LINE message summary implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LINE test-result replies easier to scan by showing a compact summary and linking users to the full catalog detail page.

**Architecture:** Keep the existing webhook and reply transport unchanged. Update `lib/line/format.ts` so exact-code and single-search replies share a concise text layout, while preserving the existing catalog URL as the full-detail path. Add a focused Node assertion test for the formatter.

**Tech Stack:** TypeScript, Next.js App Router, Node `assert`, `tsx`.

## Global Constraints

- Do not change database queries, webhook signature handling, or LINE transport.
- Keep the E-Phis code, test name, price, specimen, TAT, service time, storage condition, contact, and catalog URL available when present.
- Do not include the full rejection-criteria list in the first reply; show a count and direct users to the full catalog page.
- Keep the reply readable as plain LINE text without relying on Markdown rendering.

---

### Task 1: Add formatter regression coverage

**Files:**
- Create: `lib/line/format.test.ts`
- Test: `lib/line/format.test.ts`

**Interfaces:**
- Consumes: `formatTestReply(test, docs, extraContacts)` from `lib/line/format.ts`.
- Produces: assertions that define the compact LINE reply contract.

- [ ] **Step 1: Write the failing test**

Create a representative partial `Test` fixture and assert that the reply has a title, compact labeled fields, a rejection count instead of raw criteria, the full catalog URL, and no emoji-prefixed rows.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx lib/line/format.test.ts`

Expected: FAIL because the current formatter still emits emoji rows and the full rejection list.

### Task 2: Implement the compact LINE formatter

**Files:**
- Modify: `lib/line/format.ts`
- Test: `lib/line/format.test.ts`

**Interfaces:**
- Consumes: existing `Test`, document, contact, and environment inputs.
- Produces: the same `formatTestReply` and `formatListReply` string APIs used by `app/api/webhooks/line/route.ts`.

- [ ] **Step 1: Write minimal implementation**

Format the reply in sections:

```text
ชื่อรายการตรวจ
รหัส E-Phis: ...

ข้อมูลหลัก
ราคา: ...
สิ่งส่งตรวจ: ...
ระยะเวลา: ...
เวลาบริการ: ...

การเก็บรักษา: ...
เกณฑ์ปฏิเสธ: มี N ข้อ (ดูรายละเอียดเต็ม)

ดูรายละเอียดเต็ม: https://...
```

Retain optional notes, contacts, and document names only when present, without emoji decoration.

- [ ] **Step 2: Run the focused test to verify it passes**

Run: `npx tsx lib/line/format.test.ts`

Expected: PASS.

- [ ] **Step 3: Run TypeScript validation**

Run: `npx tsc --noEmit`

Expected: PASS with no new type errors.

- [ ] **Step 4: Review the diff and preserve unrelated worktree changes**

Run: `git diff -- lib/line/format.ts lib/line/format.test.ts` and confirm no files outside the formatter and its test are staged.

- [ ] **Step 5: Commit**

```powershell
git add -- lib/line/format.ts lib/line/format.test.ts
git commit -m "feat: simplify LINE catalog replies"
```
