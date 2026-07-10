# Staff Dashboard — Attention Queue Redesign

## Goal

Replace the current stat-wall layout of `app/(protected)/staff/dashboard/page.tsx` with a dashboard organized around a single unified "needs attention today" queue that aggregates cross-module items (documents, contracts, risk, rejection), plus a compact tabbed analytics area (TAT, Lab Workload). Quick Actions and the sidebar redesign from the prior session stay as-is.

## Page order (top to bottom)

1. Hero (unchanged — greeting + system status)
2. KPI row (unchanged — 4 existing cards: Tests, Documents, Rejection Rate, Contracts-at-risk)
3. **Quick Actions** — promoted out of the old right column into its own full-width strip directly under the KPI row
4. **Attention Queue** (new section, see below)
5. **Analytics tabs** (new section, see below)
6. Lab Workflow Pipeline — redesigned funnel-style (box width proportional to stage duration, from the earlier session's discussion)
7. Heatmaps (unchanged, 2-column)
8. Bottom row: Activity Feed (7fr) + Document status bars (3fr) — Contracts is removed from this row since it now lives in the Attention Queue; Quick Actions is removed since it has its own strip; the Document status bars widget (Published/Review/Draft/Obsolete breakdown) is what's left of the old right-column card

The KPI row keeps showing aggregate counts for Tests/Documents/Rejection/Contracts even though 3 of those 4 concerns also appear in the Attention Queue — this is intentional layering (KPI row = magnitude at a glance, Attention Queue = itemized actionable list), not duplication to clean up.

## Attention Queue

Server-rendered section titled "ต้องดำเนินการวันนี้" with 4 grouped panels. Each panel shows up to 3 items plus a "ดูทั้งหมด (N) →" link, or an empty-state row if the group has zero qualifying items (the group still renders — it is not hidden — so a clear group reads as reassurance, not as missing UI).

A group is entirely omitted (not even as an empty state) when the viewing user's permission gate for that resource is `none` — same rule the sidebar already applies. If all 4 groups are permission-gated away for a given user, the whole Attention Queue section is omitted rather than rendering an empty shell with a heading and nothing under it.

### เอกสารรออนุมัติ (Documents)
- Query: `documents.status IN ('Review','Approved')` (existing `is('deleted_at', null)` filter applies) plus active revision drafts via the existing `getActiveRevisionDrafts()` helper (already used by `/staff/documents/pending`)
- Sort: oldest `updated_at` first (longest-waiting item surfaces first)
- Row content: document code + title, days waiting
- Link: `/staff/documents/pending`
- Visibility gate: only render this group for users whose permission on resource `เอกสารคุณภาพ` is not `none`

### สัญญา (Contracts)
- Reuses the existing `criticalContracts` filter already computed in the dashboard (expiring soon per the `total > 10_000_000 ? 6mo : 3mo` rule, or budget remaining < 30%)
- Sort: most urgent first — nearest `end_date`, then lowest budget-remaining %
- Row content: vendor/product, expiry or budget tag (same tags already produced by the existing `ContractCard` logic)
- Link: `/staff/contracts`
- Visibility gate: resource `สัญญา` != `none`

### ความเสี่ยง (Risk)
- Query: `risks` where `status != 'closed'` AND (`due_date < today()` OR `follow_up_date < today()` OR `severity_level IN ('E','F','G','H','I')`)
- Sort: severity desc (alphabetical descending on the letter grade — `I` is most severe, `A` least, matching the existing severity-badge convention in `RiskClient.tsx`), then days-overdue desc within the same severity
- Row content: risk no./title, severity badge, days overdue (if applicable)
- Link: `/staff/risk`
- Visibility gate: resource `ความเสี่ยง / Rejection` != `none`

### Rejection
- Single-row alert, not a list — reuses the existing `rejRate` calculation already in the dashboard
- Only appears when `rejRate >= 3` (the existing `warn` threshold); the whole card is omitted (not shown with an empty state) when below target, since "no alert" is the normal healthy state and doesn't need its own reassurance row like the other three groups
- Row content: current rate vs. target, month-over-month change
- Link: `/staff/rejection`
- Visibility gate: resource `ความเสี่ยง / Rejection` != `none`

## Analytics tabs

Client component (`'use client'`) rendering two tabs. Only the active tab's data is fetched (lazy), matching how `/tat/dashboard` already fetches on demand rather than prefetching everything server-side.

### TAT tab
- Reuses the existing `TATTrendChart` component (`components/tat/TATTrendChart.tsx`, Recharts `ComposedChart`, already used elsewhere)
- Data: loop `readCompletedTatSummary(year, month)` (already defined in the dashboard page) over the last 6 months, extracting `avg_total_tat_cut_720 ?? avg_total_tat ?? avg_tat` and `sample_count ?? total_count` per month
- Default target line stays at the component's default (240 min)

### Lab Workload tab
- New small line/bar chart (Recharts, styled like `TATTrendChart`) plotting `ln_count` per month
- Data: fetched client-side from the existing `/api/admin/lab-workload/annual?year=<currentThaiFiscalYear>` endpoint — no new backend route or query needed, this endpoint already returns a `trend: [{year, month, ln_count, test_rows, opd_hn}]` array for the full fiscal year
- Uses `getCurrentThaiFiscalYear()` from `lib/kpi-utils` (already used by `TatAnnualClient`) to pick the year param

## Out of scope for this spec

- KPI Dashboard as a third analytics tab (deferred — no summary query was agreed on for it this round)
- Role-personalized dashboard variants (a separate concept the user did not pick)
- Any change to permission definitions or new DB migrations — this spec only reads existing tables/endpoints
