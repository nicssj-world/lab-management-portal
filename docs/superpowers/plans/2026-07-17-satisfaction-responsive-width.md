# Satisfaction Responsive Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the staff satisfaction dashboard with the full-width analytics modules while retaining readable constrained widths for the survey builder and public response form.

**Architecture:** Keep width ownership local to each satisfaction surface. The staff dashboard fills the protected content area, the editing workspace remains centered at `1180px`, and the public form remains centered at `760px`; only the obsolete wide-screen dashboard cap is removed.

**Tech Stack:** Next.js 16.2.6 App Router, React 19.2.4, TypeScript, component-scoped CSS.

## Global Constraints

- Work directly on `main` as requested by the user.
- Follow the portal's existing protected-layout gutters: `28px` desktop and `12px` mobile.
- Keep the staff dashboard data-dense and full-width at every desktop breakpoint.
- Keep the builder centered with `max-width: 1180px`.
- Keep the public survey form centered with `width: min(760px, 100%)`.
- Do not change survey behavior, data fetching, permissions, colors, typography, or chart configuration.
- Test first and observe the expected failure before changing production CSS.

---

### Task 1: Responsive width contract

**Files:**
- Create: `scripts/satisfaction-responsive-width.test.ts`
- Modify: `components/satisfaction/SatisfactionModule.tsx:70-90`

**Interfaces:**
- Consumes the existing `.satisfaction-page`, `.survey-builder-page`, and `.public-survey-page-inner` CSS contracts.
- Produces a full-width staff dashboard while preserving the two readable form constraints.

- [ ] **Step 1: Write the failing layout contract test**

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const module = read('components/satisfaction/SatisfactionModule.tsx')
const builder = read('components/satisfaction/SurveyBuilder.tsx')
const publicPage = read('app/s/[token]/page.tsx')

assert.ok(module.includes('.satisfaction-page{width:100%;max-width:none;margin:0'), 'staff satisfaction page fills its content area')
assert.ok(!module.includes('@media(min-width:1440px){.satisfaction-page{max-width:1440px;margin-inline:auto}}'), 'staff dashboard has no large-screen width cap')
assert.ok(builder.includes('.survey-builder-page{max-width:1180px;margin:0 auto}'), 'survey builder retains a readable centered width')
assert.ok(publicPage.includes('.public-survey-page-inner{width:min(760px,100%);margin:0 auto}'), 'public survey retains a focused centered width')

console.log('satisfaction responsive width tests passed')
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `npx tsx scripts/satisfaction-responsive-width.test.ts`

Expected: FAIL with `staff dashboard has no large-screen width cap` because the `1440px` media query still exists.

- [ ] **Step 3: Remove only the obsolete staff dashboard cap**

Delete this rule from `components/satisfaction/SatisfactionModule.tsx`:

```css
@media(min-width:1440px){.satisfaction-page{max-width:1440px;margin-inline:auto}}
```

Retain the base full-width rule and all mobile/table overflow rules unchanged.

- [ ] **Step 4: Verify focused and project checks**

Run:

```powershell
npx tsx scripts/satisfaction-responsive-width.test.ts
npx tsx scripts/satisfaction-header-consistency.test.ts
npx tsc --noEmit
npm run build
```

Expected: both scripts print passed messages; TypeScript and the production build exit `0`.

- [ ] **Step 5: Commit the responsive layout change**

```powershell
git add docs/superpowers/plans/2026-07-17-satisfaction-responsive-width.md scripts/satisfaction-responsive-width.test.ts components/satisfaction/SatisfactionModule.tsx
git commit -m "refine: align satisfaction content widths"
```

## Self-Review Coverage

- Full-width staff analytics surface: Task 1 Steps 1–3.
- Constrained builder and public form: Task 1 Step 1 regression assertions.
- Mobile gutters and table behavior remain owned by the protected layout and existing component rules; no unrelated CSS is changed.
- No placeholders, new interfaces, data behavior, or permission changes are introduced.
