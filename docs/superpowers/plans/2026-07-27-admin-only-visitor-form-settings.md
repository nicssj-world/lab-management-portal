# Admin-only Visitor Form Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow every authorized visitor-log viewer to use the current public link/QR Code while restricting public-form open/close and link rotation to Admin users.

**Architecture:** Keep read access behind the existing visitor-log view gate, render mutation controls from the server-derived `isAdmin` prop, and add an explicit Admin authorization helper to the settings mutation route. The server check is authoritative; UI hiding is only the user-facing reflection of the same rule.

**Tech Stack:** Next.js 16.2.6 App Router, React 19.2.4, TypeScript 5, Node assertions executed with `tsx`.

## Global Constraints

- Every staff user who can access the visitor log page can view, download, and copy the current public link/QR Code.
- Only Admin users can see or invoke public-form open/close and link rotation.
- Non-Admin mutation attempts return HTTP 403 before settings change.
- Do not change visitor-record editing, staff checkout, deletion, URL structure, or QR appearance.
- Follow the installed Next.js guidance in `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and `05-server-and-client-components.md`.

---

### Task 1: Enforce Admin-only visitor-form settings management

**Files:**
- Modify: `scripts/it-visitor-log.test.ts`
- Modify: `lib/it-visitor/guard.ts`
- Modify: `app/api/admin/it-visitors/settings/route.ts`
- Modify: `app/(protected)/staff/it/visitors/ItVisitorsClient.tsx`

**Interfaces:**
- Consumes: `isAdminRole(role: string | null | undefined): boolean`, existing `requireVisitorLog(level)` and the existing `isAdmin` client prop.
- Produces: `canManageVisitorFormSettings(actor: Pick<ItActor, 'role'>): boolean` and an Admin-only `PATCH /api/admin/it-visitors/settings` boundary.

- [ ] **Step 1: Write the failing regression assertions**

Add these assertions to the permission and QR sections of `scripts/it-visitor-log.test.ts`:

```ts
assert.ok(
  guard.includes('canManageVisitorFormSettings'),
  'visitor form settings expose an Admin role guard',
)
assert.ok(
  settingsRoute.includes('canManageVisitorFormSettings'),
  'settings PATCH enforces the Admin-only rule',
)
assert.ok(settingsRoute.includes('status: 403'), 'non-Admin settings mutations return 403')

const qrAction = staffClient.match(/<Button variant="primary" icon="globe" onClick=\{showQr\}>ลิงก์ \/ QR Code<\/Button>/)
assert.ok(qrAction, 'every authorized visitor-log viewer can open the QR dialog')
const formSettingsLabelAt = staffClient.indexOf('เปิดรับการบันทึกผ่านแบบฟอร์มสาธารณะ')
const formSettingsGate = staffClient.slice(Math.max(0, formSettingsLabelAt - 1_200), formSettingsLabelAt)
assert.ok(formSettingsGate.includes('{isAdmin && ('), 'visitor form mutation controls are rendered only for Admin')
assert.ok(!formSettingsGate.includes('{canEdit && ('), 'edit permission does not expose visitor form mutations')
assert.ok(
  !staffClient.includes('{canEdit && <Button variant="primary" icon="globe" onClick={showQr}>'),
  'QR read access is not restricted to editors',
)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npx tsx scripts/it-visitor-log.test.ts
```

Expected: FAIL at `visitor form settings expose an Admin role guard`, because `canManageVisitorFormSettings` does not exist yet.

- [ ] **Step 3: Add the focused Admin helper**

Add to `lib/it-visitor/guard.ts` after `canDeleteVisitorLog`:

```ts
/**
 * การเปิด/ปิดฟอร์มและเปลี่ยนลิงก์สาธารณะทำได้เฉพาะ Admin
 */
export function canManageVisitorFormSettings(actor: Pick<ItActor, 'role'>): boolean {
  return isAdminRole(actor.role)
}
```

- [ ] **Step 4: Enforce the helper in the settings mutation route**

Update the guard import in `app/api/admin/it-visitors/settings/route.ts`:

```ts
import { canManageVisitorFormSettings, requireVisitorLog } from '@/lib/it-visitor/guard'
```

Then add this check immediately after retrieving `guard.actor` and before parsing the request body:

```ts
  if (!canManageVisitorFormSettings(actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
```

- [ ] **Step 5: Make QR read access available and hide mutations from non-Admins**

In `app/(protected)/staff/it/visitors/ItVisitorsClient.tsx`, render the header action without `canEdit`:

```tsx
<Button variant="primary" icon="globe" onClick={showQr}>ลิงก์ / QR Code</Button>
```

Change the settings-section gate inside the QR dialog from:

```tsx
{canEdit && (
```

to:

```tsx
{isAdmin && (
```

Keep the other `canEdit` checks used for visitor-record editing unchanged.

- [ ] **Step 6: Run the focused test and verify GREEN**

Run:

```powershell
npx tsx scripts/it-visitor-log.test.ts
```

Expected: PASS with `it visitor log tests passed`.

- [ ] **Step 7: Run broader verification**

Run:

```powershell
npm run test:security
npx tsc --noEmit
npm run build
git diff --check
```

Expected: all commands exit 0, security scripts print their pass messages, TypeScript reports no errors, and Next.js completes a production build.

- [ ] **Step 8: Commit only task files**

```powershell
git add -- 'scripts/it-visitor-log.test.ts' 'lib/it-visitor/guard.ts' 'app/api/admin/it-visitors/settings/route.ts' 'app/(protected)/staff/it/visitors/ItVisitorsClient.tsx' 'docs/superpowers/plans/2026-07-27-admin-only-visitor-form-settings.md'
git commit -m "fix(visitor): restrict public form settings to admins"
```

- [ ] **Step 9: Push the current branch**

```powershell
git push
```

Expected: the remote reports the current branch updated with the design and implementation commits.
