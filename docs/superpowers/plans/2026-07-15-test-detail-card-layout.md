# Test Detail Card Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make test-detail summary cards responsive, readable, and visually balanced without truncating descriptive values.

**Architecture:** Keep all behavior in `TestDetailCard`. Replace its wrapping flex row with a responsive CSS Grid; description cards span a row when the containing column is constrained, while compact numeric cards use centered alignment. A source-level regression test protects those layout decisions without a new dependency.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, component-scoped CSS, Node `assert` run with `tsx`.

## Global Constraints

- Work directly on `main`, explicitly authorized by the user.
- Do not change `TestDetailCard` props, API calls, database schema, or dependencies.
- Preserve Thai copy, theme variables, icon system, tube-colour marker, and placeholder values.
- Use test-first red-green development and run `npx tsx`, `npx tsc --noEmit`, and `npm run build` before committing.

---

### Task 1: Add a failing responsive-layout regression test

**Files:**

- Create: `scripts/test-detail-card-layout.test.ts`
- Verify: `components/tests/TestDetailCard.tsx`

**Interfaces:**

- Consumes the `TestDetailCard.tsx` source.
- Produces a zero-dependency test invoked with `npx tsx scripts/test-detail-card-layout.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('components/tests/TestDetailCard.tsx', 'utf8')

assert.match(source, /test-detail-info-grid[\s\S]*?grid-template-columns/, 'summary fields should use CSS Grid')
assert.match(source, /test-detail-info-box--metric/, 'volume and TAT should use the metric card variant')
assert.match(source, /test-detail-info-box--descriptive/, 'specimen and service time should use the descriptive card variant')
assert.match(source, /overflow-wrap:\s*anywhere/, 'long summary values should be able to wrap safely')
assert.match(source, /test-detail-info-box--metric[\s\S]*?text-align:\s*center/, 'metric values should be centered')
assert.match(source, /@media \(max-width:\s*1100px\)[\s\S]*?test-detail-info-box--wide[\s\S]*?grid-column:\s*1\s*\/\s*-1/, 'descriptive cards should span a row at intermediate widths')
assert.match(source, /@media \(max-width:\s*767px\)[\s\S]*?test-detail-info-grid[\s\S]*?grid-template-columns:\s*1fr/, 'phone layout should use one summary column')
assert.doesNotMatch(source, />TAT \{tatDisplay\}</, 'TAT should not be duplicated below price')

console.log('test detail card layout tests passed')
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx tsx scripts/test-detail-card-layout.test.ts`

Expected: FAIL because the component still has a wrapping flex layout and no semantic card variants or safe wrapping rule.

### Task 2: Implement the responsive summary-grid variants

**Files:**

- Modify: `components/tests/TestDetailCard.tsx:1-18` — make `InfoBox` use variant classes.
- Modify: `components/tests/TestDetailCard.tsx:25-81` — add scoped grid, wrapping, and breakpoint styles.
- Modify: `components/tests/TestDetailCard.tsx:104-140` — assign variants and remove duplicate TAT under price.
- Test: `scripts/test-detail-card-layout.test.ts`

**Interfaces:**

- Consumes current `Test` and `Category` props unchanged.
- Produces `InfoBox({ icon, label, value, variant })`, with `variant` `'metric' | 'descriptive'`; `TestDetailCard` has no public API change.

- [ ] **Step 1: Refactor `InfoBox` to expose visual variants**

```tsx
function InfoBox({ icon, label, value, variant }: {
  icon: string
  label: string
  value: ReactNode
  variant: 'metric' | 'descriptive'
}) {
  return (
    <div className={`test-detail-info-box test-detail-info-box--${variant}`}>
      <div className="test-detail-info-label">
        <Icon name={icon} size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
        <span>{label}</span>
      </div>
      <div className="test-detail-info-value">{value}</div>
    </div>
  )
}
```

Import `ReactNode` from `react`. For specimen, allow a `className` prop or apply `test-detail-info-box--wide` around the same component without exposing it as a public `TestDetailCard` prop.

- [ ] **Step 2: Add responsive card CSS in the existing `<style>` block**

```css
.test-detail-info-grid { display: grid !important; grid-template-columns: minmax(0, 1.35fr) minmax(112px, .8fr) minmax(112px, .8fr) minmax(0, 1.2fr); gap: 10px; }
.test-detail-info-box { min-width: 0; padding: 14px; border-radius: 12px; background: var(--surface-2); }
.test-detail-info-label { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
.test-detail-info-value { min-width: 0; margin-top: 8px; color: var(--ink); font-size: 14px; font-weight: 600; line-height: 1.45; overflow-wrap: anywhere; }
.test-detail-info-box--metric { display: flex; min-height: 96px; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.test-detail-info-box--descriptive { text-align: left; }
@media (max-width: 1100px) { .test-detail-info-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .test-detail-info-box--wide { grid-column: 1 / -1; } }
@media (max-width: 767px) { .test-detail-info-grid { grid-template-columns: 1fr !important; } .test-detail-info-box--wide { grid-column: auto; } }
```

Keep current mobile title/price styling and ensure the rules are in the component's existing `<style>` element.

- [ ] **Step 3: Apply variants to fields and remove duplicate TAT**

Use `descriptive` plus `test-detail-info-box--wide` for specimen and service time; use `metric` for volume and TAT. Render the tube colour marker within a flex-wrapping specimen value. Delete only `<div>TAT {tatDisplay}</div>` below the price.

- [ ] **Step 4: Run the regression test and verify GREEN**

Run: `npx tsx scripts/test-detail-card-layout.test.ts`

Expected: `test detail card layout tests passed` and exit code 0.

### Task 3: Verify and commit the finished behavior

**Files:**

- Verify: `components/tests/TestDetailCard.tsx`
- Verify: `scripts/test-detail-card-layout.test.ts`

**Interfaces:**

- Consumes the component and its regression test.
- Produces fresh evidence that the requirements remain met across consumers of the shared component.

- [ ] **Step 1: Run type and production verification**

Run: `npx tsc --noEmit` then `npm run build`

Expected: both commands exit 0 without TypeScript or Next.js build errors.

- [ ] **Step 2: Check all specification criteria**

Re-read `docs/superpowers/specs/2026-07-15-test-detail-card-layout-design.md`; verify safe wrapping, left-aligned descriptive cards, centered metric cards, wide/intermediate/mobile grids, removal of price TAT duplication, and all command results.

- [ ] **Step 3: Review and commit**

Run: `git diff --check` and `git diff -- components/tests/TestDetailCard.tsx scripts/test-detail-card-layout.test.ts`.

```bash
git add components/tests/TestDetailCard.tsx scripts/test-detail-card-layout.test.ts
git commit -m "fix: improve test detail card layout"
```

- [ ] **Step 4: Run final fresh verification**

Run: `npx tsx scripts/test-detail-card-layout.test.ts; npx tsc --noEmit; npm run build`

Expected: every command exits 0.
