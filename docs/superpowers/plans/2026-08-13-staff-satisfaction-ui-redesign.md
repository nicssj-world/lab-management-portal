# Staff Satisfaction UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine every staff satisfaction route into one calm, data-dense clinical operations workspace while preserving the existing survey APIs, permissions, scoring, and workflows.

**Architecture:** Add a scoped satisfaction visual layer in the existing global stylesheet, extract repeated satisfaction primitives and dialog behavior into focused components, then update the module shell, dashboard, campaigns, comments, settings, exports, and builder to consume those primitives. Keep server route data loading and client mutation endpoints unchanged; UI changes should improve hierarchy, responsive behavior, and asynchronous feedback without changing the domain contract.

**Tech Stack:** Next.js 16.2.6 App Router, React 19.2.4, TypeScript, existing `components/ui` primitives, global CSS variables, Recharts 3.8.1, `qrcode` 1.5.4, static `tsx` contract tests, and the repository's existing build/typecheck commands.

## Global Constraints

- The approved design source is `docs/superpowers/specs/2026-08-13-staff-satisfaction-ui-redesign-design.md`; the existing satisfaction survey product/builder specification remains the functional source of truth.
- Read the relevant Next.js guide in `node_modules/next/dist/docs/` before writing code; this repository uses Next.js 16.2.6 and dynamic route params are promises that must be awaited.
- Keep API routes, Supabase data model, permission levels, survey scoring/reporting formulas, anonymous response behavior, route protection, and shared UI component contracts unchanged.
- Use existing design tokens (`--primary`, `--primary-soft`, `--card`, `--surface`, `--surface-2`, `--border`, `--ink`, `--muted`, `--success`, and existing danger/warning tokens) wherever available.
- Do not introduce a global font replacement, new UI library, new charting library, or a new global design system for this refinement.
- Use the existing `Icon` component for interface icons; do not add emoji or ad-hoc icon glyphs.
- Reuse `PageHeader`, `ModuleSubnav`, `Card`, `Button`, `Badge`, `EmptyState`, `Icon`, and `Spinner` where their contracts already fit.
- Preserve Admin-only settings behavior, comment role restrictions, read-only rendering, and server-side permission enforcement.
- Validate at 375px, 768px, 1024px, and 1440px widths; support dark mode and `prefers-reduced-motion`.
- Every asynchronous surface must cover loading, empty, error, success, busy/disabled, read-only, and long-content states where that state is possible.
- Async feedback uses `aria-live="polite"`; actionable errors use `role="alert"`; dialogs support Escape, focus management, and focus restoration.
- Test first and observe the expected failure before each new UI contract; run `npx tsc --noEmit` after every TypeScript task and `npm run build` before completion.
- Use `apply_patch` for edits and keep each task independently reviewable with a focused commit.

---

## File Map

- `app/globals.css` — owns the scoped `.satisfaction-module` and `.satisfaction-builder-page` visual rules, responsive breakpoints, focus states, and reduced-motion overrides.
- `components/satisfaction/SatisfactionPrimitives.tsx` — owns reusable status badge, section heading, summary card, loading, and inline-error presentation.
- `components/satisfaction/SatisfactionDialog.tsx` — owns focusable modal shell, Escape/backdrop close behavior, and focus restoration.
- `components/satisfaction/SatisfactionModule.tsx` — owns the staff shell, navigation, overview composition, survey registry, and create-survey dialog integration.
- `components/satisfaction/SatisfactionDashboard.tsx` — owns campaign selection, aggregate loading/retry/live-refresh state, and dashboard metric composition.
- `components/satisfaction/SatisfactionCharts.tsx` — owns chart cards, semantic chart labels, no-data handling, and accessible table alternatives.
- `components/satisfaction/SatisfactionExportActions.tsx` — owns report/export controls and their busy/success/error feedback.
- `components/satisfaction/CampaignManager.tsx` — owns collection-round form, lifecycle actions, QR dialog, and campaign operation feedback.
- `components/satisfaction/SurveyComments.tsx` — owns filters, comment result state, and per-comment read-status mutation feedback.
- `components/satisfaction/SatisfactionEditors.tsx` — owns editor assignment loading, retry, toggle busy state, and errors.
- `components/satisfaction/SurveyBuilder.tsx` — owns builder layout, save/publish state hierarchy, field grouping, and responsive editor markup.
- `components/satisfaction/SurveyPreviewModal.tsx` — consumes the shared dialog shell while retaining the existing `SurveyRenderer` preview contract.
- `scripts/satisfaction-ui-redesign.test.ts` — static contract test for the shared redesign surface and required states.
- `scripts/satisfaction-dashboard.test.ts`, `scripts/satisfaction-chart-polish.test.ts`, `scripts/satisfaction-header-consistency.test.ts`, `scripts/satisfaction-responsive-layout.test.ts`, `scripts/satisfaction-builder.test.ts` — update existing contracts only where class/markup ownership intentionally moves.
- `package.json` — add a focused `test:satisfaction-ui` command for the complete UI contract set.

---

### Task 1: Establish shared satisfaction primitives, dialog behavior, and scoped styles

**Files:**
- Create: `components/satisfaction/SatisfactionPrimitives.tsx`
- Create: `components/satisfaction/SatisfactionDialog.tsx`
- Modify: `app/globals.css`
- Modify: `components/satisfaction/SatisfactionModule.tsx`
- Create: `scripts/satisfaction-ui-redesign.test.ts`

**Interfaces:**
- `SatisfactionStatusBadge({ status }: { status: string | null })` renders localized status text with a non-color-only badge.
- `SatisfactionSectionHeading({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode })` renders the shared surface heading.
- `SatisfactionSummaryCard({ label, value, hint, icon, tone }: { label: string; value: string | number; hint: string; icon: string; tone: 'teal' | 'blue' | 'purple' })` renders a KPI card.
- `SatisfactionLoadingState({ label, rows }: { label: string; rows?: number })` renders layout-preserving skeleton rows.
- `SatisfactionInlineError({ message, onRetry }: { message: string; onRetry?: () => void })` renders an alert and optional retry button.
- `SatisfactionDialog({ labelledBy, onClose, children, className, closeOnBackdrop }: { labelledBy: string; onClose: () => void; children: React.ReactNode; className?: string; closeOnBackdrop?: boolean })` renders an accessible modal shell and restores focus to the trigger on close.

- [ ] **Step 1: Write the failing shared UI contract test**

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const css = read('app/globals.css')
const primitives = read('components/satisfaction/SatisfactionPrimitives.tsx')
const dialog = read('components/satisfaction/SatisfactionDialog.tsx')
const module = read('components/satisfaction/SatisfactionModule.tsx')

assert.match(css, /\.satisfaction-module\s*\{/, 'shared satisfaction styles are scoped to the module')
assert.match(css, /\.satisfaction-builder-page\s*\{/, 'builder receives a shared visual root')
assert.match(css, /prefers-reduced-motion:\s*reduce/, 'satisfaction motion has a reduced-motion path')
assert.match(primitives, /export function SatisfactionStatusBadge/, 'status badge is shared')
assert.match(primitives, /export function SatisfactionSummaryCard/, 'summary card is shared')
assert.match(primitives, /aria-live="polite"/, 'shared async state is announced')
assert.match(dialog, /aria-modal="true"/, 'dialog is modal')
assert.match(dialog, /Escape/, 'dialog supports Escape close')
assert.match(module, /className="satisfaction-module satisfaction-page"/, 'staff module uses the scoped root')

console.log('satisfaction shared UI contract tests passed')
```

- [ ] **Step 2: Run the new contract test and verify RED**

Run: `npx tsx scripts/satisfaction-ui-redesign.test.ts`

Expected: FAIL because the shared primitives, dialog, and scoped root styles do not exist yet.

- [ ] **Step 3: Implement `SatisfactionPrimitives.tsx`**

Use the existing `Badge`, `Button`, `Card`, `EmptyState`, `Icon`, and `Spinner` contracts. Keep status labels explicit:

```tsx
import type { ReactNode } from 'react'
import { Badge, type BadgeColor } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Spinner } from '@/components/ui/Spinner'

const STATUS: Record<string, { label: string; color: BadgeColor }> = {
  published: { label: 'เผยแพร่แล้ว', color: 'green' },
  open: { label: 'เปิดรับคำตอบ', color: 'green' },
  draft: { label: 'ฉบับร่าง', color: 'amber' },
  closed: { label: 'ปิดแล้ว', color: 'gray' },
  archived: { label: 'เก็บถาวร', color: 'gray' },
}

export function SatisfactionStatusBadge({ status }: { status: string | null }) {
  const item = STATUS[status ?? ''] ?? { label: status || 'ไม่ระบุสถานะ', color: 'gray' as const }
  return <Badge color={item.color} dot>{item.label}</Badge>
}

export function SatisfactionSectionHeading({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return <div className="satisfaction-section-heading"><div><h2>{title}</h2><p>{hint}</p></div>{action}</div>
}

export function SatisfactionSummaryCard({ label, value, hint, icon, tone }: { label: string; value: string | number; hint: string; icon: string; tone: 'teal' | 'blue' | 'purple' }) {
  return <Card className={`satisfaction-summary-card satisfaction-summary-card-${tone}`}><span className="satisfaction-summary-icon"><Icon name={icon} size={19} /></span><div className="satisfaction-summary-copy"><div className="satisfaction-summary-label">{label}</div><div className="satisfaction-summary-value">{value}</div><div className="satisfaction-summary-hint">{hint}</div></div></Card>
}

export function SatisfactionLoadingState({ label, rows = 3 }: { label: string; rows?: number }) {
  return <div className="satisfaction-loading" aria-live="polite" aria-label={label}>{Array.from({ length: rows }, (_, index) => <span key={index} className="satisfaction-skeleton-row" />)}<span className="satisfaction-loading-label"><Spinner />{label}</span></div>
}

export function SatisfactionInlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="satisfaction-inline-error" role="alert"><span>{message}</span>{onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>ลองใหม่</Button>}</div>
}
```

- [ ] **Step 4: Implement `SatisfactionDialog.tsx` with focus management**

The component must capture the opener, focus the first `[data-dialog-autofocus]` element or the panel, close on Escape, trap Tab within the dialog, close on the backdrop only when `closeOnBackdrop` is true, and restore focus in cleanup.

```tsx
'use client'

import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function SatisfactionDialog({ labelledBy, onClose, children, className = '', closeOnBackdrop = true }: { labelledBy: string; onClose: () => void; children: React.ReactNode; className?: string; closeOnBackdrop?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const first = panelRef.current?.querySelector<HTMLElement>('[data-dialog-autofocus]') ?? panelRef.current
    first?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab' || !panelRef.current) return
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (items.length === 0) { event.preventDefault(); return }
      const firstItem = items[0]!
      const lastItem = items[items.length - 1]!
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus() }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); openerRef.current?.focus() }
  }, [onClose])

  const content = <div className="satisfaction-dialog-scrim" role="presentation" onMouseDown={(event) => { if (closeOnBackdrop && event.target === event.currentTarget) onClose() }}><div ref={panelRef} className={`satisfaction-dialog-panel ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>{children}</div></div>
  return typeof document === 'undefined' ? content : createPortal(content, document.body)
}
```

- [ ] **Step 5: Add the scoped CSS contract**

Append a `.satisfaction-module` block to `app/globals.css` that defines the shared surface, table, state, filter, dialog, chart, and builder selectors. The first implementation must include these concrete rules so later components share one visual language:

```css
.satisfaction-module,
.satisfaction-builder-page { min-width: 0; color: var(--ink); }
.satisfaction-module .satisfaction-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 17px 18px; border-bottom: 1px solid var(--border); }
.satisfaction-module .satisfaction-section-heading h2 { margin: 0; color: var(--ink); font-size: 15px; }
.satisfaction-module .satisfaction-section-heading p { margin: 4px 0 0; color: var(--muted); font-size: 12px; }
.satisfaction-module .satisfaction-summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
.satisfaction-module .satisfaction-summary-card { display: flex; align-items: flex-start; gap: 12px; box-shadow: 0 7px 18px rgba(15, 23, 42, .045); }
.satisfaction-module .satisfaction-summary-icon { display: grid; width: 38px; height: 38px; flex: 0 0 auto; place-items: center; border-radius: 10px; }
.satisfaction-module .satisfaction-summary-card-teal .satisfaction-summary-icon { color: var(--primary); background: var(--primary-soft); }
.satisfaction-module .satisfaction-summary-card-blue .satisfaction-summary-icon { color: var(--primary-2); background: rgba(37, 99, 235, .10); }
.satisfaction-module .satisfaction-summary-card-purple .satisfaction-summary-icon { color: #7C3AED; background: rgba(124, 58, 237, .10); }
.satisfaction-module .satisfaction-summary-copy { min-width: 0; }
.satisfaction-module .satisfaction-summary-label,.satisfaction-module .satisfaction-summary-hint { color: var(--muted); font-size: 12px; }
.satisfaction-module .satisfaction-summary-value { margin-top: 3px; color: var(--ink); font-size: 26px; font-weight: 800; line-height: 1.2; }
.satisfaction-module .satisfaction-summary-hint { margin-top: 4px; font-size: 11.5px; }
.satisfaction-module .satisfaction-table-wrap { overflow-x: auto; }
.satisfaction-module .satisfaction-table { width: 100%; min-width: 680px; border-collapse: collapse; }
.satisfaction-module .satisfaction-table th { padding: 11px 14px; border-bottom: 1px solid var(--border); color: var(--muted); background: var(--surface-2); font-size: 11px; font-weight: 800; text-align: left; }
.satisfaction-module .satisfaction-table td { padding: 14px; border-bottom: 1px solid var(--border); color: var(--ink); font-size: 13px; vertical-align: middle; }
.satisfaction-module .satisfaction-table tbody tr { transition: background .15s ease; }
.satisfaction-module .satisfaction-table tbody tr:hover { background: color-mix(in srgb, var(--primary-soft) 48%, transparent); }
.satisfaction-module .satisfaction-loading { display: grid; gap: 10px; min-height: 220px; place-content: center; padding: 24px; }
.satisfaction-module .satisfaction-skeleton-row { display: block; width: min(460px, 75vw); height: 12px; border-radius: 999px; background: var(--surface-2); }
.satisfaction-module .satisfaction-loading-label { display: inline-flex; align-items: center; justify-content: center; gap: 8px; color: var(--muted); font-size: 12px; }
.satisfaction-inline-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border: 1px solid color-mix(in srgb, var(--danger) 20%, var(--border)); border-radius: 9px; color: var(--danger); background: color-mix(in srgb, var(--danger) 7%, var(--card)); font-size: 12px; }
.satisfaction-dialog-scrim { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 16px; background: rgba(15, 23, 42, .58); backdrop-filter: blur(3px); }
.satisfaction-dialog-panel { width: min(560px, 100%); max-height: min(760px, calc(100vh - 32px)); overflow: auto; border: 1px solid var(--border); border-radius: 16px; background: var(--card); box-shadow: 0 24px 80px rgba(0, 0, 0, .28); }
.satisfaction-builder-page { width: min(1180px, 100%); margin: 0 auto; padding: 24px; }
@media (max-width: 767px) { .satisfaction-module .satisfaction-summary-grid { grid-template-columns: 1fr; } .satisfaction-module .satisfaction-section-heading { align-items: flex-start; flex-direction: column; } .satisfaction-module .satisfaction-table { min-width: 0; } .satisfaction-module .satisfaction-table thead { display: none; } .satisfaction-module .satisfaction-table tbody,.satisfaction-module .satisfaction-table tr,.satisfaction-module .satisfaction-table td { display: block; } .satisfaction-module .satisfaction-table tr { padding: 12px 14px; border-bottom: 1px solid var(--border); } .satisfaction-module .satisfaction-table td { display: grid; grid-template-columns: minmax(100px, 38%) minmax(0, 1fr); gap: 10px; padding: 5px 0; border: 0; } .satisfaction-module .satisfaction-table td::before { content: attr(data-label); color: var(--muted); font-size: 11px; font-weight: 700; } .satisfaction-inline-error { align-items: flex-start; flex-direction: column; } .satisfaction-builder-page { padding: 16px; } }
@media (prefers-reduced-motion: reduce) { .satisfaction-module .satisfaction-table tbody tr { transition: none; } }
```

- [ ] **Step 6: Attach the shared root without changing the protected layout**

Change the module root from `className="satisfaction-page"` to `className="satisfaction-module satisfaction-page"` while retaining the existing `minWidth: 0`, flex direction, and gap values so the current header/navigation contract remains valid.

- [ ] **Step 7: Run the shared contract and typecheck**

Run: `npx tsx scripts/satisfaction-ui-redesign.test.ts; npx tsc --noEmit`

Expected: the contract prints `satisfaction shared UI contract tests passed`; TypeScript exits 0 with no output.

- [ ] **Step 8: Commit Task 1**

```bash
git add app/globals.css components/satisfaction/SatisfactionPrimitives.tsx components/satisfaction/SatisfactionDialog.tsx components/satisfaction/SatisfactionModule.tsx scripts/satisfaction-ui-redesign.test.ts
git commit -m "feat: add satisfaction UI primitives"
```

### Task 2: Refine the shared module shell, overview, survey registry, and report actions

**Files:**
- Modify: `components/satisfaction/SatisfactionModule.tsx`
- Modify: `components/satisfaction/SatisfactionExportActions.tsx`
- Modify: `scripts/satisfaction-header-consistency.test.ts`
- Modify: `scripts/satisfaction-responsive-layout.test.ts`
- Modify: `scripts/satisfaction-ui-redesign.test.ts`

**Interfaces:**
- `SatisfactionModule` continues to consume `level`, `isAdmin`, `actorRole`, `initialSurveys`, `initialCampaigns`, and `activeSection` with their existing types.
- `SatisfactionExportActions` keeps its existing `campaigns` and `actorRole` props and existing endpoint calls.
- Survey rows expose `data-label` values for the responsive card treatment without changing response data.

- [ ] **Step 1: Extend the failing contract for overview and registry structure**

```ts
const module = read('components/satisfaction/SatisfactionModule.tsx')
const exports = read('components/satisfaction/SatisfactionExportActions.tsx')

assert.match(module, /SatisfactionSummaryCard/, 'overview uses the shared KPI primitive')
assert.match(module, /className="satisfaction-summary-grid"/, 'overview groups KPIs in one responsive grid')
assert.match(module, /data-label="ชื่อแบบสำรวจ \/ รหัส"/, 'survey rows have mobile labels')
assert.match(module, /<caption className="satisfaction-visually-hidden"/, 'survey and campaign tables have accessible captions')
assert.match(exports, /className="satisfaction-overview-actions"/, 'report actions have a named surface')
assert.match(exports, /aria-live="polite"/, 'report actions announce completion/error state')
```

- [ ] **Step 2: Run the focused contract and verify RED**

Run: `npx tsx scripts/satisfaction-ui-redesign.test.ts`

Expected: FAIL because the overview still uses local summary markup and report actions have no shared surface/status contract.

- [ ] **Step 3: Replace local summary/heading/status helpers with shared primitives**

Import `SatisfactionSectionHeading`, `SatisfactionStatusBadge`, and `SatisfactionSummaryCard`; delete the duplicate local helper implementations. Keep the existing summary values and colors mapped to `teal`, `blue`, and `purple` tones. Preserve the current `PageHeader`, `ModuleSubnav`, `canEdit`, Admin settings filtering, and route links.

- [ ] **Step 4: Compose the overview in the approved scan order**

Render the overview in this order: summary grid, `SatisfactionDashboard`, report actions, latest rounds. Use the following structure around existing data/components:

```tsx
<div className="satisfaction-summary-grid">
  <SatisfactionSummaryCard label="แบบสำรวจทั้งหมด" value={initialSurveys.length} hint="รวมฉบับร่างและเผยแพร่" icon="clipboard" tone="teal" />
  <SatisfactionSummaryCard label="รอบที่กำลังเปิด" value={openCampaigns.length} hint="รับคำตอบแบบเรียลไทม์" icon="calendar" tone="blue" />
  <SatisfactionSummaryCard label="คำตอบสะสม" value={totalResponses.toLocaleString('th-TH')} hint="ไม่เก็บชื่อหรือ HN" icon="chart" tone="purple" />
</div>
<SatisfactionDashboard campaigns={initialCampaigns} />
<SatisfactionExportActions campaigns={initialCampaigns} actorRole={actorRole} />
<Card padding={0}>
  <SatisfactionSectionHeading title="รอบเก็บข้อมูลล่าสุด" hint="สถานะและจำนวนคำตอบของแต่ละรอบ" />
  <CampaignTable campaigns={initialCampaigns.slice(0, 5)} />
</Card>
```

- [ ] **Step 5: Make survey and campaign tables responsive and explicit**

Add `<caption className="satisfaction-visually-hidden">` to each table, add `data-label` to every mobile-visible cell, use `SatisfactionStatusBadge`, keep the survey link as an explicit accessible action, and preserve the existing read-only/edit permission badge. Keep the table content order and values unchanged.

- [ ] **Step 6: Give export actions a stable surface and feedback state**

Wrap the existing selector, fiscal-year input, and buttons in `.satisfaction-overview-actions`. Add a visually-hidden label for the report action group, `aria-live="polite"` status text, and a success message after Excel/PDF/comments/KPI operations. Keep every existing endpoint and permission condition. Use `busy` to disable all related buttons while one export is running.

- [ ] **Step 7: Update and run shell contracts**

Run: `npx tsx scripts/satisfaction-ui-redesign.test.ts; npx tsx scripts/satisfaction-header-consistency.test.ts; npx tsx scripts/satisfaction-responsive-layout.test.ts; npx tsc --noEmit`

Expected: all scripts print passed messages and TypeScript exits 0.

- [ ] **Step 8: Commit Task 2**

```bash
git add components/satisfaction/SatisfactionModule.tsx components/satisfaction/SatisfactionExportActions.tsx scripts/satisfaction-ui-redesign.test.ts scripts/satisfaction-header-consistency.test.ts scripts/satisfaction-responsive-layout.test.ts
git commit -m "feat: refine satisfaction overview shell"
```

### Task 3: Refine real-time dashboard, chart states, and accessible data presentation

**Files:**
- Modify: `components/satisfaction/SatisfactionDashboard.tsx`
- Modify: `components/satisfaction/SatisfactionCharts.tsx`
- Modify: `scripts/satisfaction-dashboard.test.ts`
- Modify: `scripts/satisfaction-chart-polish.test.ts`
- Modify: `scripts/satisfaction-ui-redesign.test.ts`

**Interfaces:**
- `SatisfactionDashboard({ campaigns }: { campaigns: SatisfactionCampaignListItem[] })` keeps its existing prop and `/api/admin/satisfaction/dashboard?campaignId=` request.
- `SatisfactionCharts({ data }: { data: SurveyDashboardData })` keeps its existing data contract and Recharts dependency.
- No dashboard API or aggregate calculation changes are introduced.

- [ ] **Step 1: Add failing dashboard-state assertions**

```ts
const dashboard = read('components/satisfaction/SatisfactionDashboard.tsx')
const charts = read('components/satisfaction/SatisfactionCharts.tsx')

assert.match(dashboard, /ลองใหม่/, 'dashboard errors offer retry')
assert.match(dashboard, /aria-live="polite"/, 'dashboard refresh state is announced')
assert.match(dashboard, /lastUpdated/, 'dashboard exposes a last-updated state')
assert.match(charts, /responseCount === 0/, 'charts have an explicit no-data branch')
assert.match(charts, /satisfaction-chart-table/, 'chart tables use a shared accessible class')
```

- [ ] **Step 2: Run the dashboard contracts and verify RED**

Run: `npx tsx scripts/satisfaction-dashboard.test.ts; npx tsx scripts/satisfaction-chart-polish.test.ts; npx tsx scripts/satisfaction-ui-redesign.test.ts`

Expected: FAIL on retry/live/no-data assertions.

- [ ] **Step 3: Add dashboard refresh status and retry behavior**

Track `lastUpdated: string | null`; set it after a successful aggregate fetch. Render a live-status badge beside the campaign selector, an `aria-live="polite"` message when refreshing/saved, and `SatisfactionInlineError` with `onRetry={() => void load()}`. If a refresh fails after data exists, keep the previous data visible below the error instead of replacing it with a blank surface.

- [ ] **Step 4: Replace the dashboard spinner-only state with a stable loading surface**

Use `SatisfactionLoadingState label="กำลังโหลดผลสำรวจ…" rows={4}` inside a `Card` with a fixed minimum height. Keep the campaign selector mounted while loading so changing context does not shift the page header.

- [ ] **Step 5: Add an explicit no-data branch to charts**

Before rendering Recharts, return a `Card`/`EmptyState` surface when `data.responseCount === 0` or `data.questions.length === 0`. Do not turn missing data into a zero-valued chart. Keep the metrics visible so the user can distinguish “zero responses” from “dashboard failed.”

- [ ] **Step 6: Normalize chart cards and accessible alternatives**

Keep the existing line, question comparison, and stacked distribution charts. Rename `.chart-table` to `.satisfaction-chart-table`, add `<caption className="satisfaction-visually-hidden">` to each table, preserve visible numeric labels, retain the custom tooltip, and keep `cursor={false}` plus `content={<ChartTooltip />}` on all three charts. Use CSS variables for chart text/grid colors and preserve the existing semantic palette.

- [ ] **Step 7: Run dashboard/chart verification and typecheck**

Run: `npx tsx scripts/satisfaction-dashboard.test.ts; npx tsx scripts/satisfaction-chart-polish.test.ts; npx tsx scripts/satisfaction-ui-redesign.test.ts; npx tsc --noEmit`

Expected: passed messages and zero TypeScript errors.

- [ ] **Step 8: Commit Task 3**

```bash
git add components/satisfaction/SatisfactionDashboard.tsx components/satisfaction/SatisfactionCharts.tsx scripts/satisfaction-dashboard.test.ts scripts/satisfaction-chart-polish.test.ts scripts/satisfaction-ui-redesign.test.ts
git commit -m "feat: improve satisfaction dashboard states"
```

### Task 4: Refine campaign operations, mutation feedback, and QR dialog

**Files:**
- Modify: `components/satisfaction/CampaignManager.tsx`
- Modify: `components/satisfaction/SatisfactionModule.tsx`
- Modify: `scripts/satisfaction-campaign-table-alignment.test.ts`
- Modify: `scripts/satisfaction-public-flow.test.ts`
- Modify: `scripts/satisfaction-ui-redesign.test.ts`

**Interfaces:**
- `CampaignManager({ campaigns, surveys }: { campaigns: SatisfactionCampaignListItem[]; surveys: SatisfactionSurveyListItem[] })` keeps its existing props and API payloads.
- Campaign mutation calls remain `POST /api/admin/satisfaction/campaigns`, `PATCH /api/admin/satisfaction/campaigns/:campaignId`, and `DELETE /api/admin/satisfaction/campaigns/:campaignId`.
- The QR URL remains `${window.location.origin}/s/${campaign.publicToken}`.

- [ ] **Step 1: Add failing campaign interaction assertions**

```ts
const campaigns = read('components/satisfaction/CampaignManager.tsx')

assert.match(campaigns, /useRouter/, 'campaign mutations refresh without a full browser reload')
assert.match(campaigns, /aria-live="polite"/, 'campaign mutation feedback is announced')
assert.match(campaigns, /copyState/, 'QR copy has explicit success state')
assert.match(campaigns, /SatisfactionDialog/, 'QR uses the shared accessible dialog')
assert.match(campaigns, /aria-busy/, 'busy campaign controls expose mutation state')
```

- [ ] **Step 2: Run campaign contracts and verify RED**

Run: `npx tsx scripts/satisfaction-campaign-table-alignment.test.ts; npx tsx scripts/satisfaction-public-flow.test.ts; npx tsx scripts/satisfaction-ui-redesign.test.ts`

Expected: FAIL on router refresh, copy state, dialog, and busy-state assertions.

- [ ] **Step 3: Replace hard reloads with router refresh after successful mutations**

Import `useRouter`; after a successful create, patch, or delete, call `router.refresh()` and close/reset the create form only after the response succeeds. Preserve current form values on failures and keep the existing confirmation text for deletion.

- [ ] **Step 4: Add explicit mutation and empty states**

Track `busyAction: string` instead of only a global boolean for row-level labels. Disable all campaign mutation controls while any mutation is in flight, add `aria-busy={Boolean(busyAction)}`, use `SatisfactionInlineError`, and show a success status through `aria-live`. When no published surveys exist, keep the round form usable enough to explain the prerequisite and disable the create action with the hint `เผยแพร่แบบสำรวจอย่างน้อยหนึ่งฉบับก่อนสร้างรอบ`.

- [ ] **Step 5: Move QR into `SatisfactionDialog` and add copy/download feedback**

Track `qrLoadingId`, `copyState`, and `qrError`; guard repeated QR generation; give the QR image a stable width/height and descriptive alt text; make Copy link update `copyState` to `copied` only after `navigator.clipboard.writeText` succeeds; reset it when the dialog closes. Keep Download PNG and the public URL visible and keyboard accessible.

- [ ] **Step 6: Add table captions and mobile labels**

Add a caption and `data-label` to round/survey/status/response/actions cells. Keep the existing lifecycle labels `ฉบับร่าง`, `เปิดรับ`, and `ปิดแล้ว`; use `SatisfactionStatusBadge` for the status column.

- [ ] **Step 7: Run campaign verification and typecheck**

Run: `npx tsx scripts/satisfaction-campaign-table-alignment.test.ts; npx tsx scripts/satisfaction-public-flow.test.ts; npx tsx scripts/satisfaction-ui-redesign.test.ts; npx tsc --noEmit`

Expected: passed messages and zero TypeScript errors.

- [ ] **Step 8: Commit Task 4**

```bash
git add components/satisfaction/CampaignManager.tsx components/satisfaction/SatisfactionModule.tsx scripts/satisfaction-campaign-table-alignment.test.ts scripts/satisfaction-public-flow.test.ts scripts/satisfaction-ui-redesign.test.ts
git commit -m "feat: polish satisfaction campaign operations"
```

### Task 5: Refine comments and Admin editor settings

**Files:**
- Modify: `components/satisfaction/SurveyComments.tsx`
- Modify: `components/satisfaction/SatisfactionEditors.tsx`
- Modify: `scripts/satisfaction-comment-context.test.ts`
- Modify: `scripts/satisfaction-ui-redesign.test.ts`

**Interfaces:**
- `SurveyComments({ actorRole, campaigns }: { actorRole: string; campaigns: SatisfactionCampaignListItem[] })` keeps its existing API query shape and role rule.
- `SatisfactionEditors` keeps `AssigneePicker` and `/api/admin/satisfaction/editors` GET/PATCH contracts.
- Only Admin/Manager may mutate comment read status; all other roles remain read-only.

- [ ] **Step 1: Add failing comments/settings state assertions**

```ts
const comments = read('components/satisfaction/SurveyComments.tsx')
const editors = read('components/satisfaction/SatisfactionEditors.tsx')

assert.match(comments, /markBusyId/, 'comment mutations track the individual busy row')
assert.match(comments, /aria-busy/, 'comment mutation exposes busy state')
assert.match(comments, /ผลการค้นหา/, 'comments expose result context')
assert.match(comments, /SatisfactionLoadingState/, 'comments use a structured loading state')
assert.match(editors, /ลองใหม่/, 'settings load errors offer retry')
assert.match(editors, /toggleBusyId/, 'settings toggles expose busy state')
```

- [ ] **Step 2: Run comments/settings contracts and verify RED**

Run: `npx tsx scripts/satisfaction-comment-context.test.ts; npx tsx scripts/satisfaction-ui-redesign.test.ts`

Expected: FAIL on per-row busy, result context, structured loading, and editor retry assertions.

- [ ] **Step 3: Add filter semantics and structured comment loading**

Compute `hasFilters` from `search`, `surveyId`, `campaignId`, and `read`. Render the filter controls inside a named `.satisfaction-filter-toolbar`; show `ผลการค้นหา N รายการ` after the filters; use `SatisfactionLoadingState label="กำลังโหลดความคิดเห็น…" rows={5}` while loading; distinguish `ยังไม่มีความคิดเห็น` from `ไม่พบความคิดเห็นตามตัวกรอง` in the empty state.

- [ ] **Step 4: Guard individual comment read mutations**

Add `markBusyId: string | null`; set it before the PATCH, disable only that comment's button, add `aria-busy={markBusyId === comment.id}`, catch and surface errors, always clear the busy ID, and reload the current filter only after a successful response. Preserve the original comment text and role restrictions.

- [ ] **Step 5: Improve comment card hierarchy and mobile actions**

Use `.satisfaction-comment-card`, keep new/read badge text, place survey/campaign/version context above the prompt, wrap comment text safely, and move the action below the content on narrow screens. Add a visible no-color-only unread marker and keep all filter labels accessible.

- [ ] **Step 6: Add settings retry and per-person toggle feedback**

Extract `loadEditors` with `useCallback`; render `SatisfactionInlineError` with retry; track `toggleBusyId`, catch PATCH errors without unhandled rejected promises, disable only the affected picker action while saving, and announce the resulting `เพิ่มผู้ดูแลแล้ว`/`ถอนผู้ดูแลแล้ว` status.

- [ ] **Step 7: Run comments/settings verification and typecheck**

Run: `npx tsx scripts/satisfaction-comment-context.test.ts; npx tsx scripts/satisfaction-ui-redesign.test.ts; npx tsc --noEmit`

Expected: passed messages and zero TypeScript errors.

- [ ] **Step 8: Commit Task 5**

```bash
git add components/satisfaction/SurveyComments.tsx components/satisfaction/SatisfactionEditors.tsx scripts/satisfaction-comment-context.test.ts scripts/satisfaction-ui-redesign.test.ts
git commit -m "feat: improve satisfaction comments and settings"
```

### Task 6: Refine the survey builder workspace and preview/discard dialogs

**Files:**
- Modify: `components/satisfaction/SurveyBuilder.tsx`
- Modify: `components/satisfaction/SurveyPreviewModal.tsx`
- Modify: `scripts/satisfaction-builder.test.ts`
- Modify: `scripts/satisfaction-ui-redesign.test.ts`

**Interfaces:**
- `SurveyBuilder({ workspace, level }: { workspace: SurveyWorkspace; level: PermLevel })` keeps its existing props, autosave endpoint, publish endpoint, draft endpoint, question types, and `validateDefinitionForPublish` contract.
- `SurveyPreviewModal({ definition, onClose }: { definition: SurveyVersionDefinition; onClose: () => void })` continues to render `SurveyRenderer`.
- `SatisfactionDialog` is the only new dialog shell; it does not change the builder mutation APIs.

- [ ] **Step 1: Add failing builder refinement assertions**

```ts
const builder = read('components/satisfaction/SurveyBuilder.tsx')
const preview = read('components/satisfaction/SurveyPreviewModal.tsx')

assert.match(builder, /className="satisfaction-builder-page survey-builder-page"/, 'builder uses the shared visual root')
assert.doesNotMatch(builder, /<main className="survey-builder-page"/, 'protected layout keeps one main landmark')
assert.match(builder, /data-save-state/, 'toolbar exposes a machine-readable save state')
assert.match(builder, /Publish/, 'primary publish action remains explicit')
assert.match(preview, /SatisfactionDialog/, 'preview uses the shared dialog behavior')
```

- [ ] **Step 2: Run builder contracts and verify RED**

Run: `npx tsx scripts/satisfaction-builder.test.ts; npx tsx scripts/satisfaction-ui-redesign.test.ts`

Expected: FAIL on the new root, save-state, and shared-dialog assertions.

- [ ] **Step 3: Convert the builder root to a protected-layout-compatible workspace**

Replace the nested `<main>` with `<div className="satisfaction-builder-page survey-builder-page">`. Keep the existing padding through the new global class and preserve all toolbar/editor/rail children.

- [ ] **Step 4: Make save/publish status the first toolbar signal**

Render the existing `saveState`/`saveMessage` in a `.builder-save-status` element with `data-save-state={saveState}` and `aria-live="polite"`. Disable Clone, Preview where appropriate, Discard, and Publish while their respective requests are busy; keep `readOnly` behavior unchanged. Use explicit text for `กำลังบันทึก…`, `บันทึกแล้ว`, `กำลังเผยแพร่…`, and error states.

- [ ] **Step 5: Align section/question cards with the shared responsive system**

Replace layout-critical inline styles with `.builder-*` classes already covered by the scoped builder CSS: toolbar, grid, metadata card, section header, question header, option row, icon button group, and sticky preflight rail. Keep all labels, up/down controls, question type support, required controls, option scores, and validation paths intact.

- [ ] **Step 6: Migrate preview and discard confirmation to `SatisfactionDialog`**

Keep the current preview title and renderer, add `data-dialog-autofocus` to the close button, and pass `onClose`. For discard, use the shared dialog with the existing `hasPriorPublishedVersion` copy and `discarding` disabled state. Preserve the current route behavior after discard.

- [ ] **Step 7: Run builder verification and typecheck**

Run: `npx tsx scripts/satisfaction-builder.test.ts; npx tsx scripts/satisfaction-ui-redesign.test.ts; npx tsc --noEmit`

Expected: passed messages and zero TypeScript errors.

- [ ] **Step 8: Commit Task 6**

```bash
git add components/satisfaction/SurveyBuilder.tsx components/satisfaction/SurveyPreviewModal.tsx scripts/satisfaction-builder.test.ts scripts/satisfaction-ui-redesign.test.ts
git commit -m "feat: polish satisfaction survey builder"
```

### Task 7: Add the focused test command and complete regression verification

**Files:**
- Modify: `package.json`
- Modify: `scripts/satisfaction-ui-redesign.test.ts`
- Modify: `docs/superpowers/specs/2026-08-13-staff-satisfaction-ui-redesign-design.md` only if verification discovers a clarified acceptance condition

**Interfaces:**
- `npm run test:satisfaction-ui` runs the focused satisfaction UI contract suite without requiring a database or browser.
- Existing satisfaction domain/public tests continue to run independently.

- [ ] **Step 1: Add the focused test script**

Add this exact entry to `package.json` under `scripts`:

```json
"test:satisfaction-ui": "tsx scripts/satisfaction-ui-redesign.test.ts && tsx scripts/satisfaction-navigation.test.ts && tsx scripts/satisfaction-header-consistency.test.ts && tsx scripts/satisfaction-responsive-layout.test.ts && tsx scripts/satisfaction-responsive-width.test.ts && tsx scripts/satisfaction-dashboard.test.ts && tsx scripts/satisfaction-chart-polish.test.ts && tsx scripts/satisfaction-campaign-table-alignment.test.ts && tsx scripts/satisfaction-comment-context.test.ts && tsx scripts/satisfaction-builder.test.ts && tsx scripts/satisfaction-ui-pro-max.test.ts"
```

- [ ] **Step 2: Run the focused UI suite**

Run: `npm run test:satisfaction-ui`

Expected: every listed script prints its existing `... tests passed` message and exits 0.

- [ ] **Step 3: Run the satisfaction functional contracts**

Run: `npx tsx lib/surveys/aggregates.test.ts; npx tsx lib/surveys/definition.test.ts; npx tsx lib/surveys/report.test.ts; npx tsx lib/surveys/validation.test.ts; npx tsx scripts/satisfaction-public-flow.test.ts; npx tsx scripts/satisfaction-reporting.test.ts`

Expected: all existing domain/public/report contracts pass; no API or scoring behavior changed.

- [ ] **Step 4: Run typecheck and diff validation**

Run: `npx tsc --noEmit; git diff --check`

Expected: TypeScript exits 0 with no output; `git diff --check` exits 0.

- [ ] **Step 5: Run the production build**

Run: `npm run build`

Expected: Next.js production build completes successfully with no type, route, or CSS import errors.

- [ ] **Step 6: Perform manual viewport/state verification**

Use the local app to check `/staff/satisfaction`, `/surveys`, `/campaigns`, `/comments`, `/settings`, and a survey builder at 375px, 768px, 1024px, and 1440px. Exercise no data, loading, retry/error, success, busy/disabled, read-only, long names/prompts, QR modal, preview modal, discard modal, keyboard focus, Escape close, and reduced-motion settings. Confirm no page-level horizontal overflow at 375px.

- [ ] **Step 7: Commit the verification command and final contract updates**

```bash
git add package.json scripts/satisfaction-ui-redesign.test.ts docs/superpowers/specs/2026-08-13-staff-satisfaction-ui-redesign-design.md
git commit -m "test: verify satisfaction UI redesign"
```

## Self-review Checklist

- The plan maps every approved route and the survey builder to concrete files and tasks.
- Shared visual primitives and dialog behavior are implemented before page-specific refinements.
- Existing API endpoints, data contracts, role rules, scoring, anonymous behavior, and route guards remain unchanged.
- Every task has a focused test, an expected RED/GREEN cycle, a typecheck, and a commit.
- The plan covers loading, empty, error, success, busy/disabled, read-only, long-content, responsive, keyboard, dialog, chart, and reduced-motion requirements.
- Existing static tests are updated only where class/markup ownership intentionally changes.
- No task depends on an unspecified library, placeholder function, new metric, or unsupported backend field.
- The final task includes functional regression checks and a production build before completion.
