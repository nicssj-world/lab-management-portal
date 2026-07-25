# Digital Lab Map Visitor Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing public Visitor Log so a visitor scans once, receives an active-visit card with a checkpoint map, and securely checks out from the same link/device.

**Architecture:** Keep `/v/[token]` and the existing public challenge/rate-limit flow. On successful check-in, generate an opaque checkout secret, persist only its SHA-256 hash, and set an HttpOnly cookie in the Route Handler response; page rendering reads the cookie server-side and returns a minimal active-visit DTO. `PATCH /api/it-visitors/[token]` performs self-checkout, while staff checkout remains unchanged.

**Tech Stack:** Next.js 16 Route Handlers and async `cookies()`, Supabase/Postgres, Zod, React Client Component, existing rate-limit/public-challenge utilities.

## Global Constraints

- Requires the Foundation Plan and `getPublicLabMapDTO('office')`.
- Cookie writes occur only in Route Handlers; Server Components may read cookies with `await cookies()` but never mutate during render.
- Store only a secret hash in Postgres. Never expose public name/phone search or another visitor's record.
- Same-device checkout is optional convenience; staff checkout remains the recovery path.
- Do not auto-checkout on page close, timeout, navigation, or inferred location.
- Preserve existing idempotent submission ordering and anti-abuse limits.

---

### Task 1: Add checkout persistence and pure secret helpers

**Files:**
- Create: `scripts/it-visitor-self-checkout.sql`
- Create: `lib/it-visitor/checkout.ts`
- Create: `lib/it-visitor/checkout.test.ts`
- Modify: `lib/it-visitor/types.ts`
- Modify: `scripts/it-visitor-log.test.ts`

**Interfaces:**
- Produces: `createCheckoutSecret(): string`, `hashCheckoutSecret(secret: string): string`, `safeSecretEqual(a, b): boolean`.
- Produces: `ActiveVisitorDTO` and `VisitorCheckInResult`.

- [ ] **Step 1: Write failing pure helper tests**

Test that secrets are base64url, at least 32 bytes of entropy, hashes are deterministic 64-char hex, and unequal secrets do not match.

- [ ] **Step 2: Verify failure**

Run: `npx tsx lib/it-visitor/checkout.test.ts`

Expected: FAIL because `checkout.ts` does not exist.

- [ ] **Step 3: Add the idempotent SQL patch**

Add columns to `it_visitor_logs`:

```sql
alter table it_visitor_logs
  add column if not exists checkout_secret_hash text,
  add column if not exists checkout_method text
    check (checkout_method is null or checkout_method in ('self', 'staff'));

create unique index if not exists it_visitor_checkout_secret_hash_idx
  on it_visitor_logs(checkout_secret_hash)
  where checkout_secret_hash is not null;
```

Backfill existing closed rows with `checkout_method = 'staff'` only when `closed_by is not null`; leave historic ambiguous rows null. Keep RLS unchanged and notify PostgREST schema reload.

- [ ] **Step 4: Implement helpers and DTOs**

Use `randomBytes(32).toString('base64url')`, `createHash('sha256')`, and `timingSafeEqual`. Add:

```ts
export interface ActiveVisitorDTO {
  enteredAt: string
  contactDept: string
  destinationCode: string | null
  checkpointCode: string | null
  directionsTh: readonly string[]
}

export interface VisitorCheckInResult {
  logId: string
  checkoutSecret: string
  activeVisit: ActiveVisitorDTO
}
```

- [ ] **Step 5: Update the contract test that previously prohibited cookies**

Replace the obsolete “no device cookie” assertion with assertions requiring an HttpOnly/Secure/SameSite cookie, a hash-only database value, `checkout_method`, and no public search fields.

- [ ] **Step 6: Run tests and commit**

Run each command separately:

```bash
npx tsx lib/it-visitor/checkout.test.ts
npx tsx scripts/it-visitor-log.test.ts
```

Expected: both pass.

```bash
git add scripts/it-visitor-self-checkout.sql lib/it-visitor/checkout.ts lib/it-visitor/checkout.test.ts lib/it-visitor/types.ts scripts/it-visitor-log.test.ts
git commit -m "feat(visitor): add secure checkout credentials"
```

---

### Task 2: Persist and resolve the active visit server-side

**Files:**
- Modify: `lib/it-visitor/public-server.ts`
- Create: `lib/it-visitor/destination.ts`
- Create: `lib/it-visitor/destination.test.ts`
- Modify: `app/api/it-visitors/[token]/route.ts`
- Modify: `app/v/[token]/page.tsx`

**Interfaces:**
- Produces: `insertVisitorLog(row: NormalizedVisitorLog, submissionKey: string): Promise<VisitorCheckInResult>`.
- Produces: `getActiveVisitorBySecret(secret): Promise<ActiveVisitorDTO | null>`.
- Produces: `selfCheckoutVisitor(secret): Promise<'checked_out' | 'already_closed' | 'invalid'>`.
- Produces: `resolveVisitorDestination(contactDept): { destinationCode; checkpointCode; directionsTh } | null`.

- [ ] **Step 1: Write destination mapping tests**

Cover office, Central Lab left/right mappings, microbiology, molecular biology, blood bank, special testing, and unmapped/offsite departments. Assert chemistry/immunology map left, hematology/microscopy map right, and public destinations are checkpoints.

- [ ] **Step 2: Verify destination tests fail**

Run: `npx tsx lib/it-visitor/destination.test.ts`

Expected: FAIL because `destination.ts` does not exist.

- [ ] **Step 3: Implement exact destination lookup**

Use a `Record<string, VisitorDestination>` keyed by canonical `DEPARTMENTS`. Return `null` for OPD, community lab, and free-text “other”; never guess.

- [ ] **Step 4: Change insertion and active-visit resolution**

Generate the checkout secret before insert, write `checkout_secret_hash`, return the raw secret only to the Route Handler, and build `ActiveVisitorDTO` from the stored `contact_dept`. `getActiveVisitorBySecret` selects only `entered_at`, `exited_at`, `contact_dept`, and the hash needed for lookup; never select name or phone.

- [ ] **Step 5: Set the cookie in the POST response**

After a successful/new or idempotent submission, return a `NextResponse.json` and set:

```ts
response.cookies.set('lab_visitor_checkout', checkoutSecret, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24,
  priority: 'high',
})
```

For an idempotent retry, resolve and reuse the same row's active secret lifecycle rather than creating a second log. If the raw secret is no longer available, return success without replacing the cookie and keep staff checkout as recovery.

- [ ] **Step 6: Read active state in the public page**

Use `const cookieStore = await cookies()` and pass `initialActiveVisit` to `PublicVisitorForm`. Reading the cookie makes the page dynamic, which is already declared. Do not set/delete cookies in the Server Component.

- [ ] **Step 7: Run visitor security tests and commit**

Run each command separately:

```bash
npx tsx lib/it-visitor/destination.test.ts
npm run test:security
```

Expected: all security tests pass.

```bash
git add -- lib/it-visitor/public-server.ts lib/it-visitor/destination.ts lib/it-visitor/destination.test.ts ':(literal)app/api/it-visitors/[token]/route.ts' ':(literal)app/v/[token]/page.tsx'
git commit -m "feat(visitor): restore active visits on the same device"
```

---

### Task 3: Implement self-checkout and active-visit UI

**Files:**
- Modify: `app/api/it-visitors/[token]/route.ts`
- Modify: `components/it-visitor/PublicVisitorForm.tsx`
- Create: `components/it-visitor/ActiveVisitCard.tsx`
- Modify: `scripts/it-visitor-log.test.ts`

**Interfaces:**
- Consumes: active DTO and cookie from Task 2.
- Produces: `PATCH /api/it-visitors/[token]` and `ActiveVisitCard`.

- [ ] **Step 1: Add failing route/UI assertions**

Require `PATCH`, cookie lookup, explicit same-origin validation (`Origin` host equals request host when Origin is present), rate limiting, `checkout_method: 'self'`, one-time secret invalidation, active-card map link, safety link, and disabled checkout button while submitting.

- [ ] **Step 2: Verify failure**

Run: `npx tsx scripts/it-visitor-log.test.ts`

Expected: FAIL on the new self-checkout assertions.

- [ ] **Step 3: Implement the PATCH handler**

Read the HttpOnly cookie from `request.cookies`, validate form token and same-origin headers, apply per-IP and per-form limits, call `selfCheckoutVisitor`, and map results to 200/401/409. On success, expire the cookie with `maxAge: 0` and return `{ ok: true, exitedAt }` only.

- [ ] **Step 4: Replace the terminal success screen with active-visit state**

After POST, use the returned `activeVisit`; do not require a reload. `ActiveVisitCard` shows entered time, department, checkpoint, glanceable directions, `/lab-map/office?destination=<safe-code>`, a safety-mode link, and a primary “บันทึกออก” button. Unknown destination shows “เลือกปลายทางบนแผนที่” without inventing a route.

- [ ] **Step 5: Run tests and build**

Run each command separately:

```bash
npm run test:security
npm run build
```

Expected: security suite and build pass.

- [ ] **Step 6: Commit self-checkout**

```bash
git add -- ':(literal)app/api/it-visitors/[token]/route.ts' components/it-visitor/ActiveVisitCard.tsx components/it-visitor/PublicVisitorForm.tsx scripts/it-visitor-log.test.ts
git commit -m "feat(visitor): support same-link self checkout"
```

---

### Task 4: Preserve staff checkout and audit both methods

**Files:**
- Modify: `app/api/admin/it-visitors/[id]/route.ts`
- Modify: `app/(protected)/staff/it/visitors/ItVisitorsClient.tsx`
- Modify: `app/(protected)/staff/activity/ActivityClient.tsx`
- Modify: `app/(protected)/staff/dashboard/page.tsx`
- Modify: `scripts/it-visitor-log.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: `checkout_method` schema.
- Produces: staff list/detail visibility of self/staff checkout method and audit action `it_visitor.self_checkout`.

- [ ] **Step 1: Add failing staff/audit assertions**

Require staff PATCH to write `checkout_method: 'staff'`, public checkout to audit `it_visitor.self_checkout`, both activity label maps to contain the action, and the staff detail modal to label the method.

- [ ] **Step 2: Implement staff method tracking and labels**

When staff first sets `exited_at`, set `checkout_method = 'staff'` in the same update. Preserve existing values on later edits. Add Thai activity labels and display “ผู้มาติดต่อบันทึกเอง / เจ้าหน้าที่บันทึกให้”.

- [ ] **Step 3: Document and test the migration sequence**

README must instruct running `scripts/it-visitor-self-checkout.sql` after the base Visitor Log migration and before deploying UI code.

Run each command separately:

```bash
npm run test:security
npm run build
```

Expected: all pass.

- [ ] **Step 4: Commit the completed visitor flow**

```bash
git add -- ':(literal)app/api/admin/it-visitors/[id]/route.ts' "app/(protected)/staff/it/visitors/ItVisitorsClient.tsx" "app/(protected)/staff/activity/ActivityClient.tsx" "app/(protected)/staff/dashboard/page.tsx" scripts/it-visitor-log.test.ts README.md
git commit -m "feat(visitor): audit self and staff checkout methods"
```
