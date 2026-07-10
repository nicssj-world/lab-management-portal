# Staff Dashboard Attention Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `app/(protected)/staff/dashboard/page.tsx` around a unified "ต้องดำเนินการวันนี้" Attention Queue (documents/contracts/risk/rejection), a promoted Quick Actions strip, a tabbed TAT + Lab Workload analytics area, and a funnel-style Lab Workflow Pipeline, per `docs/superpowers/specs/2026-07-10-staff-dashboard-attention-queue-design.md`.

**Architecture:** Extract new UI into small focused files under `components/dashboard/`, add pure/testable urgency-ranking helpers under `lib/dashboard/`, add one additive query function to the existing `lib/documents/pending.ts`, then wire everything into the dashboard Server Component. The Lab Workload tab reuses the existing `/api/admin/lab-workload/annual` endpoint via client-side lazy fetch; the TAT tab is prefetched server-side since it's cheap (cache reads) and is the default active tab.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, Recharts (client components only), Supabase (`supabaseAdmin` for reads), plain inline-style + CSS variables (no Tailwind), `node:assert/strict` + `npx tsx` for pure-logic tests (project has no test runner configured — this is the existing ad hoc convention, see `lib/personnel/filters.test.ts`).

## Global Constraints

- Styling is inline styles + CSS variables only (`var(--primary)`, etc.) — no Tailwind, no CSS modules, per `CLAUDE.md`.
- Icon names must come from the `ICONS` map in `components/ui/Icon.tsx` — do not invent new icon names.
- Every new query must respect the existing permission system (`lib/permission-resources.ts` resource keys: `'เอกสารคุณภาพ'`, `'สัญญา'`, `'ความเสี่ยง / Rejection'`) — do not hardcode role checks.
- `npx tsc --noEmit` must stay clean after every task (this project's only automated verification per `CLAUDE.md`).
- Don't touch `app/(protected)/staff/documents/pending/page.tsx`, `PendingClient.tsx`, or any other file already showing as modified in `git status` from unrelated in-flight work — only add new code, never edit those files.

---

### Task 1: Pure urgency-ranking helpers

**Files:**
- Create: `lib/dashboard/attention-queue.ts`
- Test: `lib/dashboard/attention-queue.test.ts`

**Interfaces:**
- Produces: `RiskRow` type, `daysOverdue(dateStr: string | null, todayISO: string): number | null`, `isRiskUrgent(risk: RiskRow, todayISO: string): boolean`, `filterUrgentRisks(risks: RiskRow[], todayISO: string): RiskRow[]`, `sortByOldestUpdated<T extends { updated_at: string }>(rows: T[]): T[]`, `monthsLeftUntil(endDate: string | null, now?: Date): number`, `sortContractsByUrgency<T extends { end_date: string | null; total: number; used: number }>(contracts: T[]): T[]`

- [ ] **Step 1: Write the failing test**

Create `lib/dashboard/attention-queue.test.ts`:

```ts
import assert from 'node:assert/strict'
import {
  daysOverdue, isRiskUrgent, filterUrgentRisks, sortByOldestUpdated,
  monthsLeftUntil, sortContractsByUrgency, type RiskRow,
} from './attention-queue'

const TODAY = '2026-07-11'

function risk(overrides: Partial<RiskRow> = {}): RiskRow {
  return {
    id: 1, risk_no: 'RM-001', name: 'ตัวอย่างความเสี่ยง',
    severity_level: null, status: 'open', due_date: null, follow_up_date: null,
    ...overrides,
  }
}

// daysOverdue
assert.equal(daysOverdue(null, TODAY), null)
assert.equal(daysOverdue('2026-07-11', TODAY), null) // today is not overdue
assert.equal(daysOverdue('2026-07-06', TODAY), 5)
assert.equal(daysOverdue('2026-07-20', TODAY), null) // future date is not overdue

// isRiskUrgent
assert.equal(isRiskUrgent(risk({ status: 'closed', due_date: '2026-01-01' }), TODAY), false)
assert.equal(isRiskUrgent(risk({ due_date: '2026-07-06' }), TODAY), true) // overdue
assert.equal(isRiskUrgent(risk({ severity_level: 'g' }), TODAY), true) // severe (case-insensitive)
assert.equal(isRiskUrgent(risk({ severity_level: 'C' }), TODAY), false) // not severe, not overdue
assert.equal(isRiskUrgent(risk(), TODAY), false)

// filterUrgentRisks: severity desc, then days-overdue desc
const risks = [
  risk({ id: 1, risk_no: 'A', severity_level: 'F', due_date: null }),
  risk({ id: 2, risk_no: 'B', severity_level: 'I', due_date: null }),
  risk({ id: 3, risk_no: 'C', severity_level: null, due_date: '2026-06-01' }), // overdue, no severity
  risk({ id: 4, risk_no: 'D', severity_level: 'I', due_date: '2026-07-01' }), // same top severity, more overdue
  risk({ id: 5, risk_no: 'E', severity_level: 'C', due_date: null }), // not urgent at all
]
assert.deepEqual(
  filterUrgentRisks(risks, TODAY).map(r => r.risk_no),
  ['D', 'B', 'A', 'C'],
)

// sortByOldestUpdated
const docs = [
  { id: '1', updated_at: '2026-07-01T00:00:00Z' },
  { id: '2', updated_at: '2026-06-20T00:00:00Z' },
  { id: '3', updated_at: '2026-07-05T00:00:00Z' },
]
assert.deepEqual(sortByOldestUpdated(docs).map(d => d.id), ['2', '1', '3'])

// monthsLeftUntil
assert.equal(monthsLeftUntil(null, new Date('2026-07-11')), 999)
assert.equal(monthsLeftUntil('2026-10-11', new Date('2026-07-11')), 3)

// sortContractsByUrgency: nearest end_date first, then lowest budget-remaining %
const contracts = [
  { id: 1, end_date: '2027-06-11', total: 100, used: 90 },  // far out, low budget remaining (10%)
  { id: 2, end_date: '2026-08-11', total: 100, used: 10 },  // 1 month left, high budget remaining
  { id: 3, end_date: '2026-08-11', total: 100, used: 50 },  // same months-left, more budget remaining than #2
]
assert.deepEqual(
  sortContractsByUrgency(contracts).map(c => c.id),
  [2, 3, 1],
)

console.log('lib/dashboard/attention-queue.test.ts: all assertions passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx lib/dashboard/attention-queue.test.ts`
Expected: FAIL — `Cannot find module './attention-queue'` (file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

Create `lib/dashboard/attention-queue.ts`:

```ts
export type RiskRow = {
  id: number
  risk_no: string | null
  name: string
  severity_level: string | null
  status: string
  due_date: string | null
  follow_up_date: string | null
}

const SEVERE_LEVELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
const SEVERE_THRESHOLD_INDEX = SEVERE_LEVELS.indexOf('E') // E–I count as severe

function severityRank(level: string | null): number {
  if (!level) return -1
  return SEVERE_LEVELS.indexOf(level.toUpperCase())
}

function isSevere(level: string | null): boolean {
  return severityRank(level) >= SEVERE_THRESHOLD_INDEX
}

export function daysOverdue(dateStr: string | null, todayISO: string): number | null {
  if (!dateStr) return null
  const today = new Date(todayISO).getTime()
  const then = new Date(dateStr).getTime()
  const diffDays = Math.floor((today - then) / 86_400_000)
  return diffDays > 0 ? diffDays : null
}

export function isRiskUrgent(risk: RiskRow, todayISO: string): boolean {
  if (risk.status === 'closed') return false
  const overdue = daysOverdue(risk.due_date, todayISO) != null || daysOverdue(risk.follow_up_date, todayISO) != null
  return overdue || isSevere(risk.severity_level)
}

function riskUrgencyScore(risk: RiskRow, todayISO: string): number {
  const overdueDays = Math.max(
    daysOverdue(risk.due_date, todayISO) ?? 0,
    daysOverdue(risk.follow_up_date, todayISO) ?? 0,
  )
  // severity dominates the sort; overdue days break ties within the same severity
  return severityRank(risk.severity_level) * 100_000 + overdueDays
}

export function filterUrgentRisks(risks: RiskRow[], todayISO: string): RiskRow[] {
  return risks
    .filter(r => isRiskUrgent(r, todayISO))
    .sort((a, b) => riskUrgencyScore(b, todayISO) - riskUrgencyScore(a, todayISO))
}

export function sortByOldestUpdated<T extends { updated_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.updated_at.localeCompare(b.updated_at))
}

export function monthsLeftUntil(endDate: string | null, now = new Date()): number {
  if (!endDate) return 999
  return Math.floor((new Date(endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))
}

export function sortContractsByUrgency<T extends { end_date: string | null; total: number; used: number }>(
  contracts: T[],
): T[] {
  return [...contracts].sort((a, b) => {
    const monthsA = monthsLeftUntil(a.end_date)
    const monthsB = monthsLeftUntil(b.end_date)
    if (monthsA !== monthsB) return monthsA - monthsB
    const remainingA = a.total > 0 ? ((a.total - a.used) / a.total) * 100 : 100
    const remainingB = b.total > 0 ? ((b.total - b.used) / b.total) * 100 : 100
    return remainingA - remainingB
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx lib/dashboard/attention-queue.test.ts`
Expected: prints `lib/dashboard/attention-queue.test.ts: all assertions passed` with no errors

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard/attention-queue.ts lib/dashboard/attention-queue.test.ts
git commit -m "Add urgency-ranking helpers for dashboard Attention Queue"
```

---

### Task 2: Pending-approval documents query

**Files:**
- Modify: `lib/documents/pending.ts` (additive only — do not change `getSourceUploadedDocumentIds` or `getActiveRevisionDrafts`)

**Interfaces:**
- Consumes: `getActiveRevisionDrafts(): Promise<ActiveDraftRow[]>` (already exists in this file)
- Produces: `PendingApprovalDoc` type `{ id: string; document_code: string; title: string; updated_at: string }`, `getPendingApprovalDocuments(): Promise<PendingApprovalDoc[]>`

- [ ] **Step 1: Add the function**

Append to `lib/documents/pending.ts`:

```ts
export interface PendingApprovalDoc {
  id: string
  document_code: string
  title: string
  updated_at: string
}

// Documents (or their active working-revision draft) currently sitting in Review or
// Approved status — the same definition of "pending" used by /staff/documents/pending,
// reused here for the dashboard's Attention Queue. Deduplicated by document id in case a
// document's own status and its draft's status would otherwise double-count it.
export async function getPendingApprovalDocuments(): Promise<PendingApprovalDoc[]> {
  const [reviewRes, approvedRes, drafts] = await Promise.all([
    supabaseAdmin.from('documents').select('id, document_code, title, updated_at')
      .eq('status', 'Review').is('deleted_at', null),
    supabaseAdmin.from('documents').select('id, document_code, title, updated_at')
      .eq('status', 'Approved').is('deleted_at', null),
    getActiveRevisionDrafts(),
  ])

  const draftDocs = drafts.filter(d => d.status === 'Review' || d.status === 'Approved')
  const draftDocIds = Array.from(new Set(draftDocs.map(d => d.documentId)))
  const draftParents = draftDocIds.length > 0
    ? await supabaseAdmin.from('documents').select('id, document_code, title').in('id', draftDocIds)
    : { data: [] as { id: string; document_code: string; title: string }[] }

  const parentById = new Map(
    ((draftParents.data ?? []) as { id: string; document_code: string; title: string }[])
      .map(d => [d.id, d] as const),
  )
  const fromDrafts: PendingApprovalDoc[] = draftDocs
    .map((d): PendingApprovalDoc | null => {
      const parent = parentById.get(d.documentId)
      return parent ? { id: parent.id, document_code: parent.document_code, title: parent.title, updated_at: d.updatedAt } : null
    })
    .filter((d): d is PendingApprovalDoc => d !== null)

  const fromStatus: PendingApprovalDoc[] = [
    ...((reviewRes.data ?? []) as PendingApprovalDoc[]),
    ...((approvedRes.data ?? []) as PendingApprovalDoc[]),
  ]

  const seen = new Set<string>()
  const merged: PendingApprovalDoc[] = []
  for (const doc of [...fromStatus, ...fromDrafts]) {
    if (seen.has(doc.id)) continue
    seen.add(doc.id)
    merged.push(doc)
  }
  return merged
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add lib/documents/pending.ts
git commit -m "Add getPendingApprovalDocuments for the dashboard Attention Queue"
```

---

### Task 3: Extract the shared `Empty` component

**Files:**
- Create: `components/dashboard/Empty.tsx`
- Modify: `app/(protected)/staff/dashboard/page.tsx` (remove the local `Empty` function at the bottom of the file, import the new one instead)

**Interfaces:**
- Produces: `Empty({ text, icon = 'check' }: { text: string; icon?: string })`

- [ ] **Step 1: Create the component**

Create `components/dashboard/Empty.tsx`:

```tsx
import { Icon } from '@/components/ui/Icon'

export function Empty({ text, icon = 'check' }: { text: string; icon?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '26px 0', color: 'var(--muted)' }}>
      <div style={{ opacity: .3, marginBottom: 8 }}><Icon name={icon} size={20} /></div>
      <div style={{ fontSize: 12.5 }}>{text}</div>
    </div>
  )
}
```

- [ ] **Step 2: Update the dashboard page**

In `app/(protected)/staff/dashboard/page.tsx`:
- Add near the top imports: `import { Empty } from '@/components/dashboard/Empty'`
- Delete the local `function Empty({ text, icon = 'check' }: ...) { ... }` definition at the end of the file (it currently duplicates the code above).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (all existing `<Empty .../>` call sites keep working — same name, same props)

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/Empty.tsx "app/(protected)/staff/dashboard/page.tsx"
git commit -m "Extract shared Empty component out of the dashboard page"
```

---

### Task 4: Lab Workload trend chart

**Files:**
- Create: `components/dashboard/WorkloadTrendChart.tsx`

**Interfaces:**
- Produces: `WorkloadOverallTrendRow` type `{ month: number; ln_count: number }`, `WorkloadTrendChart({ data }: { data: WorkloadOverallTrendRow[] })`

Note: this is deliberately a different type name than the existing `WorkloadTrendRow` in `lib/queries/workload.ts` (that one is per-department percentage data for the annual page's chart; this one is a single overall-total-per-month series for the dashboard tab) — do not reuse or rename the existing type.

- [ ] **Step 1: Create the component**

Create `components/dashboard/WorkloadTrendChart.tsx`:

```tsx
'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { getThaiMonthLabel } from '@/lib/kpi-utils'

export interface WorkloadOverallTrendRow {
  month: number
  ln_count: number
}

interface Props {
  data: WorkloadOverallTrendRow[]
}

export function WorkloadTrendChart({ data }: Props) {
  const chartData = data.map(d => ({ ...d, monthLabel: getThaiMonthLabel(d.month) }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} width={50} />
        <Tooltip
          contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          formatter={(value) => [(value as number).toLocaleString(), 'จำนวน LN']}
        />
        <Line type="monotone" dataKey="ln_count" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/WorkloadTrendChart.tsx
git commit -m "Add WorkloadTrendChart for the dashboard Analytics tabs"
```

---

### Task 5: Analytics tabs (TAT + Lab Workload)

**Files:**
- Create: `components/dashboard/AnalyticsTabs.tsx`

**Interfaces:**
- Consumes: `TATTrendChart({ data, targetMinutes? })` from `components/tat/TATTrendChart.tsx` (existing, data shape `{month, avgTAT, sampleCount}[]`), `WorkloadTrendChart({ data }: { data: WorkloadOverallTrendRow[] })` from Task 4, `getCurrentThaiFiscalYear(): number` from `lib/kpi-utils.ts` (existing)
- Produces: `TatTrendRow` type `{ month: number; avgTAT: number; sampleCount: number }`, `AnalyticsTabs({ tatTrend }: { tatTrend: TatTrendRow[] })`

- [ ] **Step 1: Create the component**

Create `components/dashboard/AnalyticsTabs.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { TATTrendChart } from '@/components/tat/TATTrendChart'
import { WorkloadTrendChart, type WorkloadOverallTrendRow } from './WorkloadTrendChart'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'

export interface TatTrendRow {
  month: number
  avgTAT: number
  sampleCount: number
}

interface Props {
  tatTrend: TatTrendRow[]
}

type Tab = 'tat' | 'workload'

export function AnalyticsTabs({ tatTrend }: Props) {
  const [tab, setTab] = useState<Tab>('tat')
  const [workloadTrend, setWorkloadTrend] = useState<WorkloadOverallTrendRow[] | null>(null)
  const [loadingWorkload, setLoadingWorkload] = useState(false)

  async function openWorkloadTab() {
    setTab('workload')
    if (workloadTrend !== null || loadingWorkload) return
    setLoadingWorkload(true)
    try {
      const year = getCurrentThaiFiscalYear()
      const res = await fetch(`/api/admin/lab-workload/annual?year=${year}`)
      const json = await res.json()
      const trend: WorkloadOverallTrendRow[] = Array.isArray(json.trend)
        ? json.trend.map((row: { month: number; ln_count: number }) => ({ month: row.month, ln_count: row.ln_count }))
        : []
      setWorkloadTrend(trend)
    } finally {
      setLoadingWorkload(false)
    }
  }

  function tabStyle(active: boolean): React.CSSProperties {
    return {
      padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit',
      fontSize: 13, fontWeight: 700,
      borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
      color: active ? 'var(--primary)' : 'var(--muted)',
    }
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '4px 20px 0', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', gap: 4 }}>
        <button onClick={() => setTab('tat')} style={tabStyle(tab === 'tat')}>TAT</button>
        <button onClick={openWorkloadTab} style={tabStyle(tab === 'workload')}>Lab Workload</button>
      </div>
      <div style={{ padding: 20 }}>
        {tab === 'tat' && <TATTrendChart data={tatTrend} />}
        {tab === 'workload' && (
          loadingWorkload ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด...</div>
          ) : (
            <WorkloadTrendChart data={workloadTrend ?? []} />
          )
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/AnalyticsTabs.tsx
git commit -m "Add tabbed TAT + Lab Workload analytics component"
```

---

### Task 6: Quick Actions strip

**Files:**
- Create: `components/dashboard/QuickActionsStrip.tsx`

**Interfaces:**
- Produces: `QuickActionsStrip()` — no props, same 4 actions/hrefs/icons as the current dashboard's Quick Actions grid

- [ ] **Step 1: Create the component**

Create `components/dashboard/QuickActionsStrip.tsx`:

```tsx
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'

const ACTIONS = [
  { href: '/staff/tests',     icon: 'plus',   accent: '#1E5FAD', th: 'เพิ่มรายการตรวจ',   en: 'Add new test item' },
  { href: '/staff/documents', icon: 'upload', accent: '#0D9488', th: 'Upload เอกสาร',     en: 'SOP / WI / Form' },
  { href: '/staff/rejection', icon: 'alert',  accent: '#DC2626', th: 'บันทึก Rejection',  en: 'Log specimen rejection' },
  { href: '/kpi/dashboard',   icon: 'chart',  accent: '#16A34A', th: 'รายงาน KPI',        en: 'Monthly report' },
] as const

export function QuickActionsStrip() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }} className="dash-qa-strip">
      {ACTIONS.map(item => (
        <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
          <div className="qa-tile" style={{
            padding: '13px 14px', borderRadius: 12,
            border: '1px solid var(--border)', background: 'var(--card)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${item.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.accent, flexShrink: 0 }}>
              <Icon name={item.icon} size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>{item.th}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.en}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/QuickActionsStrip.tsx
git commit -m "Add standalone Quick Actions strip component"
```

---

### Task 7: Attention Queue component

**Files:**
- Create: `components/dashboard/AttentionQueue.tsx`

**Interfaces:**
- Consumes: `RiskRow` type and helpers from `lib/dashboard/attention-queue.ts` (Task 1), `PendingApprovalDoc` from `lib/documents/pending.ts` (Task 2), `ContractWithUsage` from `lib/queries/contracts.ts` (existing), `Empty` from `components/dashboard/Empty.tsx` (Task 3), `Permissions` type from `lib/permissions.ts` (existing)
- Produces: `AttentionQueue({ pendingDocs, totalPendingDocs, contracts, totalContracts, urgentRisks, totalUrgentRisks, rejectionAlert, permissions }: AttentionQueueProps)` — returns `null` when every gated group is hidden by permission

- [ ] **Step 1: Create the component**

Create `components/dashboard/AttentionQueue.tsx`:

```tsx
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { Empty } from '@/components/dashboard/Empty'
import { monthsLeftUntil, type RiskRow } from '@/lib/dashboard/attention-queue'
import type { PendingApprovalDoc } from '@/lib/documents/pending'
import type { ContractWithUsage } from '@/lib/queries/contracts'
import type { Permissions } from '@/lib/permissions'

interface RejectionAlert {
  rate: number
  changeText: string | null
}

interface AttentionQueueProps {
  pendingDocs: PendingApprovalDoc[]
  totalPendingDocs: number
  contracts: ContractWithUsage[]
  totalContracts: number
  urgentRisks: RiskRow[]
  totalUrgentRisks: number
  rejectionAlert: RejectionAlert | null
  permissions: Permissions
}

function daysWaiting(updatedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000))
}

function GroupShell({ title, icon, iconColor, href, count, children }: {
  title: string; icon: string; iconColor: string; href: string; count: number; children: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '13px 16px 11px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: `${iconColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor, flexShrink: 0 }}>
            <Icon name={icon} size={13} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{title}</span>
        </div>
        {count > 0 && (
          <Link href={href} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            ดูทั้งหมด ({count}) →
          </Link>
        )}
      </div>
      <div style={{ padding: '10px 14px' }}>{children}</div>
    </div>
  )
}

function DocumentRow({ doc }: { doc: PendingApprovalDoc }) {
  const days = daysWaiting(doc.updated_at)
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{doc.document_code}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
      <div style={{ fontSize: 10.5, color: '#D97706', fontWeight: 700, marginTop: 3 }}>รอ {days} วัน</div>
    </div>
  )
}

function ContractRow({ contract }: { contract: ContractWithUsage }) {
  const total = contract.total ?? 0
  const remaining = total > 0 ? 100 - (contract.used / total) * 100 : 100
  const months = monthsLeftUntil(contract.end_date)
  const isExpiry = total > 10_000_000 ? months <= 6 : months <= 3
  const tag = isExpiry ? (months <= 0 ? 'หมดอายุแล้ว' : `เหลือ ${months} เดือน`) : `งบเหลือ ${remaining.toFixed(0)}%`
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{contract.vendor}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contract.product}</div>
      <div style={{ fontSize: 10.5, color: isExpiry ? '#DC2626' : '#D97706', fontWeight: 700, marginTop: 3 }}>{tag}</div>
    </div>
  )
}

function RiskRowItem({ risk }: { risk: RiskRow }) {
  const days = Math.max(
    risk.due_date ? Math.floor((Date.now() - new Date(risk.due_date).getTime()) / 86_400_000) : 0,
    risk.follow_up_date ? Math.floor((Date.now() - new Date(risk.follow_up_date).getTime()) / 86_400_000) : 0,
  )
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{risk.risk_no ?? `#${risk.id}`}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{risk.name}</div>
      <div style={{ fontSize: 10.5, color: '#DC2626', fontWeight: 700, marginTop: 3 }}>
        {risk.severity_level ? `ระดับ ${risk.severity_level.toUpperCase()}` : ''}
        {days > 0 ? ` · เกินกำหนด ${days} วัน` : ''}
      </div>
    </div>
  )
}

export function AttentionQueue({
  pendingDocs, totalPendingDocs, contracts, totalContracts,
  urgentRisks, totalUrgentRisks, rejectionAlert, permissions,
}: AttentionQueueProps) {
  const canSeeDocs = (permissions['เอกสารคุณภาพ'] ?? 'none') !== 'none'
  const canSeeContracts = (permissions['สัญญา'] ?? 'none') !== 'none'
  const canSeeRisk = (permissions['ความเสี่ยง / Rejection'] ?? 'none') !== 'none'

  if (!canSeeDocs && !canSeeContracts && !canSeeRisk) return null

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>ต้องดำเนินการวันนี้</div>
      </div>
      <div className="dash-attention-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {canSeeDocs && (
          <GroupShell title="เอกสารรออนุมัติ" icon="doc" iconColor="#0D9488" href="/staff/documents/pending" count={totalPendingDocs}>
            {pendingDocs.length > 0
              ? pendingDocs.slice(0, 3).map(doc => <DocumentRow key={doc.id} doc={doc} />)
              : <Empty text="ไม่มีเอกสารรออนุมัติ" icon="shieldCheck" />}
          </GroupShell>
        )}
        {canSeeContracts && (
          <GroupShell title="สัญญา" icon="building" iconColor="#7C3AED" href="/staff/contracts" count={totalContracts}>
            {contracts.length > 0
              ? contracts.slice(0, 3).map(c => <ContractRow key={c.id} contract={c} />)
              : <Empty text="ไม่มีสัญญาที่ต้องดูแล" icon="shieldCheck" />}
          </GroupShell>
        )}
        {canSeeRisk && (
          <GroupShell title="ความเสี่ยง" icon="shield" iconColor="#DC2626" href="/staff/risk" count={totalUrgentRisks}>
            {urgentRisks.length > 0
              ? urgentRisks.slice(0, 3).map(r => <RiskRowItem key={r.id} risk={r} />)
              : <Empty text="ไม่มีความเสี่ยงที่ต้องดำเนินการ" icon="shieldCheck" />}
          </GroupShell>
        )}
        {canSeeRisk && rejectionAlert && (
          <GroupShell title="Rejection" icon="alert" iconColor="#F59E0B" href="/staff/rejection" count={1}>
            <div style={{ padding: '8px 0' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#DC2626' }}>{rejectionAlert.rate.toFixed(2)}%</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>เป้าหมาย: &lt;3%{rejectionAlert.changeText ? ` · ${rejectionAlert.changeText}` : ''}</div>
            </div>
          </GroupShell>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/AttentionQueue.tsx
git commit -m "Add Attention Queue component grouped by documents/contracts/risk/rejection"
```

---

### Task 8: Wire everything into the dashboard page

**Files:**
- Modify: `app/(protected)/staff/dashboard/page.tsx`

**Interfaces:**
- Consumes: everything produced in Tasks 1–7
- Produces: the reordered dashboard page (Hero → KPI row → Quick Actions strip → Attention Queue → Analytics tabs → Pipeline → Heatmaps → Activity Feed + Document status bars)

- [ ] **Step 1: Add new imports**

At the top of `app/(protected)/staff/dashboard/page.tsx`, replace:

```ts
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getContracts } from '@/lib/queries/contracts'
import { getRejectionLogs } from '@/lib/queries/rejection'
import { Icon } from '@/components/ui/Icon'
import type { ContractWithUsage } from '@/lib/queries/contracts'
import Link from 'next/link'
```

with:

```ts
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getContracts } from '@/lib/queries/contracts'
import { getRejectionLogs } from '@/lib/queries/rejection'
import { getRolePermissions } from '@/lib/permissions'
import { getPendingApprovalDocuments } from '@/lib/documents/pending'
import { sortByOldestUpdated, sortContractsByUrgency, filterUrgentRisks, monthsLeftUntil, type RiskRow } from '@/lib/dashboard/attention-queue'
import { Icon } from '@/components/ui/Icon'
import { Empty } from '@/components/dashboard/Empty'
import { QuickActionsStrip } from '@/components/dashboard/QuickActionsStrip'
import { AttentionQueue } from '@/components/dashboard/AttentionQueue'
import { AnalyticsTabs, type TatTrendRow } from '@/components/dashboard/AnalyticsTabs'
import type { ContractWithUsage } from '@/lib/queries/contracts'
import Link from 'next/link'
```

- [ ] **Step 2: Remove now-unused local declarations**

Delete the local `function Empty({ text, icon = 'check' }: ...) { ... }` at the very end of the file (replaced by the import in Step 1).

Delete the `function SectionCard(...) { ... }` function (it was only used by the Contracts card being removed in Step 5).

Delete the `function ContractCard({ contract }: { contract: ContractWithUsage }) { ... }` function (its logic now lives in `components/dashboard/AttentionQueue.tsx`'s `ContractRow`).

- [ ] **Step 3: Fetch actor + permissions, add new data queries**

At the top of `StaffDashboardPage()`, before the existing `const now = new Date()` line, add:

```ts
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
const { data: actor } = user
  ? await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  : { data: null }
const permissions = actor?.role ? await getRolePermissions(actor.role) : {}
const todayISO = new Date().toISOString().slice(0, 10)
```

Right after the existing `const prevPrevMonth = ...` / `const prevPrevYear = ...` lines (still before the `Promise.all` block), add the 6-month TAT trend month list and kick off its fetch concurrently with the main batch:

```ts
const tatTrendMonths: { year: number; month: number }[] = []
{
  let y = prevYear, m = prevMonth
  for (let i = 0; i < 6; i++) {
    tatTrendMonths.unshift({ year: y, month: m })
    m -= 1
    if (m === 0) { m = 12; y -= 1 }
  }
}
const tatTrendPromise = Promise.all(tatTrendMonths.map(({ year, month }) => readCompletedTatSummary(year, month)))
const pendingDocsPromise = getPendingApprovalDocuments()
```

Add one new entry to the existing `Promise.all([...])` array (right after `getContracts(supabaseAdmin),`):

```ts
    supabaseAdmin.from('risks')
      .select('id, risk_no, name, severity_level, status, due_date, follow_up_date')
      .neq('status', 'closed'),
```

and add the matching destructured name `risksResult,` in the same position in the array on the left-hand side of the `const [ ... ] = await Promise.all([ ... ])`.

After the `const [...] = await Promise.all([...])` block, add:

```ts
const tatTrendPayloads = await tatTrendPromise
const pendingDocsAll = await pendingDocsPromise
const tatTrend: TatTrendRow[] = tatTrendMonths.map(({ month }, i) => {
  const p = tatTrendPayloads[i]
  const k = p?.kpi ?? {}
  return {
    month,
    avgTAT: Math.round(k.avg_total_tat_cut_720 ?? k.avg_total_tat ?? k.avg_tat ?? 0),
    sampleCount: k.sample_count ?? k.total_count ?? 0,
  }
})
const pendingDocs = sortByOldestUpdated(pendingDocsAll)
const urgentRisksAll = filterUrgentRisks((risksResult.data ?? []) as RiskRow[], todayISO)
```

- [ ] **Step 4: Replace the `monthsLeft`/`criticalContracts` block**

Find:

```ts
  function monthsLeft(endDate: string | null) {
    if (!endDate) return 999
    return Math.floor((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30))
  }
  const criticalContracts = contracts.filter(c => {
    const ml = monthsLeft(c.end_date)
    const isExpiring = c.total > 10_000_000 ? ml <= 6 : ml <= 3
    const budgetRemaining = c.total > 0 ? ((c.total - c.used) / c.total) * 100 : 100
    return isExpiring || budgetRemaining < 30
  })
```

Replace with:

```ts
  const criticalContractsAll = sortContractsByUrgency(contracts.filter(c => {
    const ml = monthsLeftUntil(c.end_date)
    const isExpiring = c.total > 10_000_000 ? ml <= 6 : ml <= 3
    const budgetRemaining = c.total > 0 ? ((c.total - c.used) / c.total) * 100 : 100
    return isExpiring || budgetRemaining < 30
  }))
```

(`monthsLeftUntil` replaces the local `monthsLeft` helper — it's the same formula, now shared with `AttentionQueue.tsx`.) Update every other use of `criticalContracts` in the file (the KPI card) to `criticalContractsAll`.

- [ ] **Step 5: Rebuild the JSX section order**

Replace the whole return block's body — from `{/* ══ KPI ROW ══ */}` through the closing of the `{/* ══ ACTIVITY + CONTRACTS ══ */}` `</div>` (i.e. delete that entire "ACTIVITY + CONTRACTS" grid, including the Contracts `SectionCard` and the Quick Actions + Doc Status card) — with:

```tsx
        {/* ══ KPI ROW ══ */}
        <div className="dash-kpi-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          <KpiCard
            icon="flask" label="รายการตรวจทั้งหมด" accent="#0EA5E9" delay={0.02}
            value={testCount.toLocaleString()} sub="รายการที่ใช้งานอยู่"
            barLabel="Active" barValue={`${testCount}/${testTotal}`}
            barPct={testTotal ? (testCount / testTotal) * 100 : 0}
          />
          <KpiCard
            icon="doc" label="เอกสารคุณภาพ" accent="#0D9488" delay={0.08}
            value={docTotal.toLocaleString()} sub={prevMonthLabel}
            change={docNew > 0 ? `+${docNew} ฉบับ` : undefined}
            changeDir="up"
            barLabel="Published" barValue={`${docPublished}/${docTotal}`}
            barPct={docTotal > 0 ? (docPublished / docTotal) * 100 : 0}
          />
          <KpiCard
            icon="alert" label="Rejection Rate" accent="#F59E0B" delay={0.14}
            value={rejRate != null ? `${rejRate.toFixed(2)}%` : `${rejThisMonth.toLocaleString()} ราย`}
            sub={rejRate != null ? 'เป้าหมาย: <3%' : prevMonthLabel}
            warn={rejRate != null ? rejRate >= 3 : rejThisMonth > 50}
            change={rejRateChange != null ? `${Math.abs(rejRateChange).toFixed(2)}% ${rejRateChange <= 0 ? 'ดีขึ้น' : 'แย่ลง'}` : undefined}
            changeDir={rejRateChange != null ? (rejRateChange <= 0 ? 'down' : 'up') : undefined}
            barLabel="Rate" barValue={rejRate != null ? `${rejRate.toFixed(2)}%` : `${rejThisMonth}`}
            barPct={rejRate != null ? Math.min(100, (rejRate / 3) * 100) : Math.min(100, (rejThisMonth / 200) * 100)}
          />
          <KpiCard
            icon="building" label="สัญญาใกล้หมด/งบต่ำ" delay={0.2}
            accent={criticalContractsAll.length > 0 ? '#DC2626' : '#16A34A'}
            value={criticalContractsAll.length.toLocaleString()} sub={`จาก ${contracts.length} สัญญา`}
            warn={criticalContractsAll.length > 0}
            barLabel="ต้องดูแล" barValue={`${criticalContractsAll.length}/${contracts.length}`}
            barPct={contracts.length ? (criticalContractsAll.length / contracts.length) * 100 : 0}
          />
        </div>

        {/* ══ QUICK ACTIONS ══ */}
        <div className="dash-fade" style={{ animationDelay: '.22s' }}>
          <QuickActionsStrip />
        </div>

        {/* ══ ATTENTION QUEUE ══ */}
        <div className="dash-fade" style={{ animationDelay: '.26s' }}>
          <AttentionQueue
            pendingDocs={pendingDocs}
            totalPendingDocs={pendingDocs.length}
            contracts={criticalContractsAll}
            totalContracts={criticalContractsAll.length}
            urgentRisks={urgentRisksAll}
            totalUrgentRisks={urgentRisksAll.length}
            rejectionAlert={rejRate != null && rejRate >= 3 ? {
              rate: rejRate,
              changeText: rejRateChange != null ? `${Math.abs(rejRateChange).toFixed(2)}% ${rejRateChange <= 0 ? 'ดีขึ้น' : 'แย่ลง'}` : null,
            } : null}
            permissions={permissions}
          />
        </div>

        {/* ══ ANALYTICS ══ */}
        <div className="dash-fade" style={{ animationDelay: '.3s' }}>
          <AnalyticsTabs tatTrend={tatTrend} />
        </div>
```

- [ ] **Step 6: Redesign the Pipeline stage boxes to be funnel-style**

In the `{/* ══ PIPELINE ══ */}` block, right before `{PIPELINE.length > 0 ? (`, add:

```ts
            const totalPipelineMinutes = PIPELINE.reduce((sum, step) => sum + step.value, 0)
```

Then find, inside the `dash-pipeline-steps` map:

```tsx
                  {PIPELINE.map((step, i) => (
                    <div key={step.label} style={{ flex:1, display:'flex', alignItems:'center', minWidth:0 }}>
```

Replace with:

```tsx
                  {PIPELINE.map((step, i) => (
                    <div key={step.label} style={{ flex: Math.max(step.value, totalPipelineMinutes * 0.12), display:'flex', alignItems:'center', minWidth:120 }}>
```

(This makes each stage's width proportional to how many minutes it takes, with a floor of 12% of the total so no stage becomes unreadably narrow — `overflow-x:auto` already exists on `.dash-pipeline-steps` for mobile, so this degrades to horizontal scroll rather than squeezing text.)

- [ ] **Step 7: Move Activity Feed + Document status bars to the bottom**

After the closing `</div>` of `{/* ══ HEATMAPS ══ */}` and before the final `</div>` / `</> )` that closes the component's return statement, add:

```tsx
        {/* ══ ACTIVITY + DOCUMENT STATUS ══ */}
        <div className="dash-main-grid dash-fade" style={{ display:'grid', gridTemplateColumns:'7fr 3fr', gap:16, alignItems:'stretch', animationDelay:'.44s' }}>

          {/* Recent Activity — custom card with timeline */}
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'14px 20px 12px', borderBottom:'1px solid var(--border)', background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:30,height:30,borderRadius:8,background:'rgba(30,95,173,.14)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--primary)',flexShrink:0 }}>
                  <Icon name="bell" size={14} />
                </div>
                <div>
                  <div style={{ fontSize:13,fontWeight:800,color:'var(--ink)' }}>กิจกรรมล่าสุด</div>
                  <div style={{ fontSize:11,color:'var(--muted)',marginTop:1 }}>อัปเดตวันนี้</div>
                </div>
              </div>
            </div>
            <div style={{ padding:'8px 20px 0', flex:1, display:'flex', flexDirection:'column' }}>
              {auditLogs.length > 0 ? (
                <div className="activity-timeline">
                  {auditLogs.slice(0, 5).map((entry, i) => (
                    <ActivityFeedItem
                      key={entry.id}
                      entry={entry}
                      profileName={entry.user_id ? (profileMap[entry.user_id] ?? '') : ''}
                      isLast={i === Math.min(4, auditLogs.length - 1)}
                    />
                  ))}
                </div>
              ) : (
                <Empty text="ยังไม่มีกิจกรรมในระบบ" icon="clock" />
              )}
              <div style={{ marginTop:'auto', padding:'12px 0 16px' }}>
                <Link href="/staff/activity" className="more-link">
                  ดูกิจกรรมทั้งหมด →
                </Link>
              </div>
            </div>
          </div>

          {/* Document status bars */}
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'13px 16px 11px', borderBottom:'1px solid var(--border)', background:'var(--surface-2)' }}>
              <div style={{ fontSize:13, fontWeight:800, color:'var(--ink)' }}>เอกสารตามสถานะ</div>
            </div>
            <div style={{ padding:'14px 16px' }}>
              {([
                { label:'Published', count:docPublished, color:'#16A34A' },
                { label:'Review',    count:docReview,    color:'#1E5FAD' },
                { label:'Draft',     count:docDraft,     color:'#D97706' },
                { label:'Obsolete',  count:docObsolete,  color:'#DC2626' },
              ] as const).map(({ label, count, color }) => {
                const pct = docTotal > 0 ? (count / docTotal) * 100 : 0
                const barWidth = Math.max(pct, count > 0 ? 2 : 0)
                return (
                  <div key={label} style={{ marginBottom:9 }}>
                    <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                      <span style={{ fontSize:12,color:'var(--ink)',fontWeight:600 }}>{label}</span>
                      <span style={{ fontSize:12,color,fontWeight:700 }}>{count} ฉบับ</span>
                    </div>
                    <div style={{ height:4,background:'var(--border)',borderRadius:99,overflow:'hidden' }}>
                      <div style={{ height:'100%',width:`${barWidth}%`,background:color,borderRadius:99 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
```

- [ ] **Step 8: Add a CSS rule for the Attention Queue grid on small screens**

In the page's `<style>` block, next to the existing `@media(max-width:640px)` rule, add `.dash-attention-grid{grid-template-columns:repeat(2,1fr)!important}` inside it, and `.dash-qa-strip{grid-template-columns:repeat(2,1fr)!important}` too — matching the existing `.dash-kpi-grid` mobile pattern already in that block.

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If any remain, they'll point at leftover references to the deleted `monthsLeft`/`criticalContracts`/`SectionCard`/`ContractCard`/local `Empty` names — rename those call sites to match Steps 2–4.

- [ ] **Step 10: Manual verification**

Run: `npm run dev` (or use whatever dev server is already running on the project's port)
Then in a browser, log in as a user with `Admin` role and visit `/staff/dashboard`. Confirm:
- Page order top to bottom is: Hero, KPI row, Quick Actions strip, Attention Queue (4 groups), Analytics tabs (TAT tab active by default, showing a 6-month chart), Pipeline (stage boxes now visibly different widths), Heatmaps, Activity Feed + Document status bars
- Clicking the "Lab Workload" tab shows a brief loading state then a monthly LN-count line chart
- Each Attention Queue group's "ดูทั้งหมด (N) →" link navigates to the right existing page (`/staff/documents/pending`, `/staff/contracts`, `/staff/risk`, `/staff/rejection`)
- If there are zero urgent risks or zero pending documents in the current database, that group shows the green empty-state message instead of being blank

- [ ] **Step 11: Commit**

```bash
git add "app/(protected)/staff/dashboard/page.tsx"
git commit -m "Reorder staff dashboard around Attention Queue, Quick Actions strip, and Analytics tabs"
```

---

## Self-Review Notes

- **Spec coverage:** page order ✓ (Task 8 Steps 5–7), Documents/Contracts/Risk/Rejection groups with the agreed filters/sorts ✓ (Tasks 1, 2, 7), 3-items-plus-count-link per group ✓ (Task 7), empty-state-per-group except Rejection ✓ (Task 7), TAT tab prefetched + Workload tab lazy-fetched via existing endpoint ✓ (Tasks 5, 8), permission gating + whole-section omission ✓ (Task 7), funnel-style Pipeline ✓ (Task 8 Step 6), Activity Feed + Document status bars moved to the bottom ✓ (Task 8 Step 7).
- **Type consistency check:** `RiskRow` (Task 1) is reused as-is by `AttentionQueue` (Task 7) and by the new `risksResult` query shape in Task 8 — column list in the Supabase `.select(...)` matches `RiskRow`'s fields exactly. `PendingApprovalDoc` (Task 2) is reused as-is in Task 7 and Task 8. `TatTrendRow` (Task 5) matches the field names/types `TATTrendChart`'s internal (unexported) `TrendRow` expects (`month`, `avgTAT`, `sampleCount`) structurally. `WorkloadOverallTrendRow` (Task 4) is deliberately distinct from the existing per-department `WorkloadTrendRow` in `lib/queries/workload.ts`.
- **Out of scope, confirmed still out of scope:** KPI Dashboard as a third analytics tab, role-personalized dashboard variants, any new DB migration.
