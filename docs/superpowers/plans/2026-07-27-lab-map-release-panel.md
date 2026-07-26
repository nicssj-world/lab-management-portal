# Lab Map Release Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Admin/Manager create, review/approve, and publish lab-map releases directly from the existing "ส่งออกแผนที่ควบคุม" export page (`/staff/lab-map/print`), so the "ส่งออกฉบับใช้งานจริง PDF" button can ever become enabled — today it never can, because no UI calls the release API routes that already exist.

**Architecture:** One new self-contained client component, `LabMapReleasePanel.tsx`, rendered above the existing `LabMapExportClient` in `print/page.tsx`. It calls the existing `/api/admin/lab-map/releases*` routes directly (no new API routes). `print/page.tsx` is extended to gate the panel behind the existing `canManageMapReleases` check, fetch the staff list for the reviewer/approver pickers, and resolve profile names for display.

**Tech Stack:** Next.js 16 App Router (async Server Component page + `'use client'` panel), `components/ui/{Card,Button,Select,Input}`, native `fetch` to existing routes, `next/navigation` `useRouter().refresh()`.

## Global Constraints

- Reuse the three existing API routes as-is — do not add, remove, or modify any `app/api/admin/lab-map/releases*` route.
- Gate access with the existing `canManageMapReleases(actor)` (Admin/Manager) from `lib/lab-map/release-server.ts` — do not add a new permission-resource key or touch `lib/permission-resources.ts`.
- No new route/page — everything renders on `/staff/lab-map/print`.
- UI only from `components/ui/*` (`Card`, `Button`, `Select`, `Input`) — no external UI libraries, no new dependencies.
- Toast style: bottom-right, auto-dismiss after 3.5s — copy the existing `useToast` pattern used across the codebase (e.g. `app/(protected)/staff/it/downtime/ItDowntimeClient.tsx`) verbatim.
- All UI text in Thai, matching existing lab-map copy style.
- This project has no component-rendering test runner (no jsdom/testing-library/vitest) — tests for `.tsx` files in this module are source-inspection contract tests via `node:assert` + `readFileSync`, run with `npx tsx`, following `scripts/lab-map-*.test.ts`.

---

## Correction found while planning (not in the original spec)

`print/page.tsx`'s existing release query is `.order('status', { ascending: false })`, which sorts `'published'` before `'draft'` **alphabetically** — it has nothing to do with recency. That means: once any release has ever been published, that query will *always* return the published row, never a newer draft. The approved spec's "Published → มีปุ่ม 'สร้างฉบับร่างใหม่'" flow would be unreachable after the very first publish, because the newly created draft could never surface back through this query for the admin to finish reviewing/approving/publishing it.

Fix baked into Task 2: fetch the latest **published** row and the latest **draft** row separately (both from one query, split in JS). Use `published ?? draft ?? fallback` for the **print/export catalog** (exporting should always reflect the official version, matching current behavior). Use `draft ?? published ?? fallback` for the **management panel** (an in-progress draft always takes priority over an already-published version, so the admin can keep steering it to publish).

---

### Task 1: `LabMapReleasePanel` component

**Files:**
- Create: `components/lab-map/LabMapReleasePanel.tsx`
- Test: `scripts/lab-map-release-panel.test.ts`

**Interfaces:**
- Produces: `LabMapReleasePanel({ release: MapReleaseDTO, staff: readonly { id: string; name: string | null; role: string }[] })` — a default-exported-free named export `LabMapReleasePanel`, consumed by Task 2's `print/page.tsx`.
- Consumes: `MapReleaseDTO` from `@/lib/lab-map/types` (already has optional `id`, `status`, `versionCode`, `effectiveDate`, `reviewedBy`, `approvedBy`, `notes`, `reviewerName`, `approverName` — no changes needed to this type).
- Consumes existing routes: `POST /api/admin/lab-map/releases`, `PATCH /api/admin/lab-map/releases/:id`, `POST /api/admin/lab-map/releases/:id/publish` (all pre-existing, already enforce `getActor()` + `canManageMapReleases()` server-side).

- [ ] **Step 1: Write the failing contract test**

Create `scripts/lab-map-release-panel.test.ts`:

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panel = readFileSync('components/lab-map/LabMapReleasePanel.tsx', 'utf8')

assert.match(panel, /^'use client'/)
assert.match(panel, /export function LabMapReleasePanel/)
assert.match(panel, /fetch\('\/api\/admin\/lab-map\/releases',/, 'creates a draft release via the existing POST route')
assert.match(panel, /fetch\(`\/api\/admin\/lab-map\/releases\/\$\{release\.id\}`,/, 'edits the draft via the existing PATCH route')
assert.match(panel, /fetch\(`\/api\/admin\/lab-map\/releases\/\$\{release\.id\}\/publish`/, 'publishes via the existing publish route')
assert.match(panel, /response\.status === 422/, 'treats 422 as a validation-blocker response, not a generic error')
assert.match(panel, /setBlockers\(body\.blockers/, 'reads the blockers array the publish route returns')
assert.match(panel, /router\.refresh\(\)/, 'reloads server-fetched data after every successful action')
assert.match(panel, /!release\.id/, 'the create-draft form is shown when there is no persisted release yet')
assert.match(panel, /release\.status === 'draft'/, 'the edit/publish form is shown for a draft release')
assert.match(panel, /reviewedBy \|\| null/, 'reviewer is sent as null, not empty string, when unset')
assert.match(panel, /approvedBy \|\| null/, 'approver is sent as null, not empty string, when unset')

console.log('lab map release panel contract passed')
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx scripts/lab-map-release-panel.test.ts`
Expected: fails with `ENOENT` (file `components/lab-map/LabMapReleasePanel.tsx` does not exist)

- [ ] **Step 3: Implement the component**

Create `components/lab-map/LabMapReleasePanel.tsx`:

```tsx
'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import type { MapReleaseDTO } from '@/lib/lab-map/types'

export interface LabMapReleaseStaffOption {
  id: string
  name: string | null
  role: string
}

interface LabMapReleasePanelProps {
  release: MapReleaseDTO
  staff: readonly LabMapReleaseStaffOption[]
}

const labelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block',
}

function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([])
  const counter = useRef(0)
  const add = useCallback((msg: string, ok = true) => {
    const id = ++counter.current
    setToasts((t) => [...t, { id, msg, ok }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  return { toasts, add }
}

function suggestedVersionCode() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `F3-${yyyy}.${mm}.${dd}-01`
}

async function readJson(response: Response) {
  return response.json().catch(() => ({}))
}

export function LabMapReleasePanel({ release, staff }: LabMapReleasePanelProps) {
  const router = useRouter()
  const { toasts, add } = useToast()
  const [saving, setSaving] = useState(false)
  const [blockers, setBlockers] = useState<string[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)

  const [versionCode, setVersionCode] = useState(suggestedVersionCode())
  const [effectiveDate, setEffectiveDate] = useState(release.effectiveDate ?? '')
  const [notes, setNotes] = useState(release.notes ?? '')
  const [reviewedBy, setReviewedBy] = useState(release.reviewedBy ?? '')
  const [approvedBy, setApprovedBy] = useState(release.approvedBy ?? '')

  const staffOptions = staff.map((person) => ({ value: person.id, label: `${person.name ?? 'ไม่ทราบชื่อ'} (${person.role})` }))

  async function createDraft() {
    setSaving(true)
    setBlockers([])
    try {
      const response = await fetch('/api/admin/lab-map/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionCode, effectiveDate: effectiveDate || null, notes: notes || null }),
      })
      const body = await readJson(response)
      if (!response.ok) throw new Error(body.error ?? 'สร้างฉบับร่างไม่สำเร็จ')
      add('สร้างฉบับร่างสำเร็จ')
      setShowCreateForm(false)
      router.refresh()
    } catch (caught) {
      add(caught instanceof Error ? caught.message : 'สร้างฉบับร่างไม่สำเร็จ', false)
    } finally {
      setSaving(false)
    }
  }

  async function saveDraft() {
    if (!release.id) return
    setSaving(true)
    setBlockers([])
    try {
      const response = await fetch(`/api/admin/lab-map/releases/${release.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          effectiveDate: effectiveDate || null,
          reviewedBy: reviewedBy || null,
          approvedBy: approvedBy || null,
          notes: notes || null,
        }),
      })
      const body = await readJson(response)
      if (!response.ok) throw new Error(body.error ?? 'บันทึกไม่สำเร็จ')
      add('บันทึกสำเร็จ')
      router.refresh()
    } catch (caught) {
      add(caught instanceof Error ? caught.message : 'บันทึกไม่สำเร็จ', false)
    } finally {
      setSaving(false)
    }
  }

  async function publish() {
    if (!release.id) return
    setSaving(true)
    setBlockers([])
    try {
      const response = await fetch(`/api/admin/lab-map/releases/${release.id}/publish`, { method: 'POST' })
      const body = await readJson(response)
      if (response.status === 422) {
        setBlockers(Array.isArray(body.blockers) && body.blockers.length > 0 ? body.blockers : [body.error ?? 'ยังเผยแพร่ไม่ได้'])
        return
      }
      if (!response.ok) throw new Error(body.error ?? 'เผยแพร่ไม่สำเร็จ')
      add('เผยแพร่สำเร็จ')
      router.refresh()
    } catch (caught) {
      add(caught instanceof Error ? caught.message : 'เผยแพร่ไม่สำเร็จ', false)
    } finally {
      setSaving(false)
    }
  }

  const toastTray = (
    <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 2000 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: '#fff', background: t.ok ? 'var(--success)' : 'var(--danger)', boxShadow: '0 6px 20px rgba(0,0,0,.18)' }}>{t.msg}</div>
      ))}
    </div>
  )

  const createForm = (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <label style={labelStyle}>รหัสเวอร์ชัน</label>
        <Input value={versionCode} onChange={setVersionCode} />
      </div>
      <div>
        <label style={labelStyle}>วันที่มีผล</label>
        <Input type="date" value={effectiveDate ?? ''} onChange={setEffectiveDate} />
      </div>
      <div>
        <label style={labelStyle}>หมายเหตุ</label>
        <Input value={notes ?? ''} onChange={setNotes} placeholder="ไม่บังคับ" />
      </div>
      <Button onClick={createDraft} disabled={saving || versionCode.trim().length < 3}>สร้างฉบับร่าง</Button>
    </div>
  )

  if (!release.id) {
    return (
      <Card padding={24} style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, color: 'var(--ink)' }}>จัดการฉบับแผนที่ควบคุม</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--muted)' }}>
          ยังไม่มีฉบับแผนที่ในระบบ — สร้างฉบับร่างเพื่อเริ่มขั้นตอนทบทวนและเผยแพร่
        </p>
        {createForm}
        {toastTray}
      </Card>
    )
  }

  if (release.status === 'draft') {
    return (
      <Card padding={24} style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 15, color: 'var(--ink)' }}>จัดการฉบับแผนที่ควบคุม</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--muted)' }}>ฉบับร่าง {release.versionCode}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>ผู้ทบทวน</label>
            <Select value={reviewedBy} onChange={setReviewedBy} options={staffOptions} placeholder="เลือกผู้ทบทวน" />
          </div>
          <div>
            <label style={labelStyle}>ผู้อนุมัติ</label>
            <Select value={approvedBy} onChange={setApprovedBy} options={staffOptions} placeholder="เลือกผู้อนุมัติ" />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>วันที่มีผล</label>
          <Input type="date" value={effectiveDate ?? ''} onChange={setEffectiveDate} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>หมายเหตุ</label>
          <Input value={notes ?? ''} onChange={setNotes} placeholder="ไม่บังคับ" />
        </div>
        {blockers.length > 0 ? (
          <div role="alert" style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', fontSize: 12.5 }}>
            <strong>ยังเผยแพร่ไม่ได้:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {blockers.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={saveDraft} disabled={saving}>บันทึก</Button>
          <Button onClick={publish} disabled={saving}>เผยแพร่</Button>
        </div>
        {toastTray}
      </Card>
    )
  }

  return (
    <Card padding={24} style={{ marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15, color: 'var(--ink)' }}>จัดการฉบับแผนที่ควบคุม</h3>
      <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.8 }}>
        ฉบับใช้งานจริง {release.versionCode} · มีผล {release.effectiveDate ?? 'ยังไม่กำหนด'}<br />
        ผู้ทบทวน {release.reviewerName ?? 'ยังไม่กำหนด'} · ผู้อนุมัติ {release.approverName ?? 'ยังไม่กำหนด'}
      </p>
      {showCreateForm ? createForm : (
        <Button variant="secondary" onClick={() => setShowCreateForm(true)}>สร้างฉบับร่างใหม่</Button>
      )}
      {toastTray}
    </Card>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx scripts/lab-map-release-panel.test.ts`
Expected: `lab map release panel contract passed`

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add components/lab-map/LabMapReleasePanel.tsx scripts/lab-map-release-panel.test.ts
git commit -m "feat(lab-map): add release management panel component"
```

---

### Task 2: Wire the panel into the export page

**Files:**
- Modify: `app/(protected)/staff/lab-map/print/page.tsx`
- Test: `scripts/lab-map-release-wiring.test.ts`

**Interfaces:**
- Consumes: `LabMapReleasePanel` from Task 1 (`{ release: MapReleaseDTO, staff: readonly { id, name, role }[] }`), `canManageMapReleases` from `lib/lab-map/release-server.ts` (already exists, unchanged).
- Produces: nothing new for later tasks — this is the last task in the plan.

- [ ] **Step 1: Write the failing contract test**

Create `scripts/lab-map-release-wiring.test.ts`:

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync('app/(protected)/staff/lab-map/print/page.tsx', 'utf8')

assert.match(page, /canManageMapReleases/, 'gates the panel with the same Admin\/Manager check the API already enforces')
assert.match(page, /LabMapReleasePanel/, 'renders the new panel')
assert.match(page, /canManage \? <LabMapReleasePanel/, 'the panel is only rendered for Admin\/Manager, not shipped to every role')
assert.match(page, /select\('id, name, role'\)/, 'fetches the staff list for the reviewer\/approver pickers')
assert.match(page, /reviewerName/, 'resolves the reviewer profile name before it is used')
assert.match(page, /approverName/, 'resolves the approver profile name before it is used')
// เดิม query เรียง status ก่อน (published มาก่อน draft ตามตัวอักษรเสมอ ไม่ใช่ตามความใหม่) ทำให้เห็นฉบับร่างใหม่ไม่ได้
// อีกต่อไปถ้าเคยมีฉบับเผยแพร่มาก่อน — ต้องแยกดึงฉบับล่าสุดของแต่ละสถานะเอง
assert.doesNotMatch(page, /order\('status'/, 'no longer sorts by status text — published vs draft is resolved explicitly in code')
assert.match(page, /row\.status === 'published'/)
assert.match(page, /row\.status === 'draft'/)

console.log('lab map release wiring contract passed')
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx scripts/lab-map-release-wiring.test.ts`
Expected: fails (current `page.tsx` has none of these yet, and still contains `order('status'`)

- [ ] **Step 3: Rewrite `print/page.tsx`**

Replace the full contents of `app/(protected)/staff/lab-map/print/page.tsx` with:

```tsx
import { redirect } from 'next/navigation'
import { LabMapExportClient } from '@/components/lab-map/LabMapExportClient'
import { LabMapReleasePanel } from '@/components/lab-map/LabMapReleasePanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { getActor } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { LAB_MAP_VERSION, LAB_ROUTE_PRESETS, LAB_STATIONS } from '@/lib/lab-map/manifest'
import { VISITOR_STATION_CODE } from '@/lib/lab-map/visitor'
import { currentManifestHash } from '@/lib/lab-map/release'
import { canManageMapReleases, mapReleaseRow } from '@/lib/lab-map/release-server'
import { buildMapPrintDTO, type MapPaperSize, type MapPrintDTO } from '@/lib/lab-map/print'
import type { MapReleaseDTO } from '@/lib/lab-map/types'

export const dynamic = 'force-dynamic'

function fallbackRelease(): MapReleaseDTO {
  return {
    versionCode: LAB_MAP_VERSION, status: 'draft', manifestHash: currentManifestHash(),
    effectiveDate: null, reviewedBy: null, approvedBy: null, approvedAt: null,
  }
}

async function withReviewerNames(release: MapReleaseDTO): Promise<MapReleaseDTO> {
  const ids = [release.reviewedBy, release.approvedBy].filter((id): id is string => Boolean(id))
  if (ids.length === 0) return release
  const { data: people } = await supabaseAdmin.from('profiles').select('id, name').in('id', ids)
  const nameById = new Map((people ?? []).map((person) => [person.id as string, person.name as string | null]))
  return {
    ...release,
    reviewerName: release.reviewedBy ? (nameById.get(release.reviewedBy) ?? null) : null,
    approverName: release.approvedBy ? (nameById.get(release.approvedBy) ?? null) : null,
  }
}

export default async function LabMapPrintPage() {
  const actor = await getActor()
  if (!actor) redirect('/login')
  const canManage = canManageMapReleases(actor)

  const { data: releaseRows } = await supabaseAdmin.from('lab_map_versions').select('*')
    .in('status', ['published', 'draft']).order('created_at', { ascending: false }).limit(20)
  const publishedRow = releaseRows?.find((row) => row.status === 'published') ?? null
  const draftRow = releaseRows?.find((row) => row.status === 'draft') ?? null

  // แผ่นพิมพ์ใช้ฉบับเผยแพร่จริงเสมอถ้ามี — ไม่งั้นฉบับร่างที่ยังไม่ผ่านการอนุมัติจะกลายเป็น "ฉบับใช้งานจริง"
  const release: MapReleaseDTO = await withReviewerNames(
    publishedRow ? mapReleaseRow(publishedRow) : draftRow ? mapReleaseRow(draftRow) : fallbackRelease(),
  )
  // แผงจัดการต้องเห็นฉบับร่างที่กำลังทำอยู่ก่อนเสมอ ไม่งั้นสร้างฉบับร่างใหม่ไปแล้วจะกลับมาแก้ไม่ได้อีก
  // ตราบใดที่ยังมีฉบับเผยแพร่ค้างอยู่
  const managedRelease: MapReleaseDTO = draftRow
    ? await withReviewerNames(mapReleaseRow(draftRow))
    : publishedRow
      ? await withReviewerNames(mapReleaseRow(publishedRow))
      : fallbackRelease()

  const staffRows = canManage
    ? await supabaseAdmin.from('profiles').select('id, name, role').order('name')
    : { data: [] as { id: string; name: string | null; role: string }[] }
  const staff = (staffRows.data ?? []).map((row) => ({ id: String(row.id), name: row.name as string | null, role: String(row.role) }))

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lab.chonburihospital.go.th').replace(/\/$/, '')
  const catalog: MapPrintDTO[] = []
  const papers: MapPaperSize[] = ['A3', 'A4']
  // สถานีชนิด 'checkpoint' คือจุดที่ผู้มาติดต่อยืนรอจริง ไม่ใช่จุดติดตั้งป้าย — ไม่เข้าแคตตาล็อกงานพิมพ์
  const installationStations = LAB_STATIONS.filter((station) => station.kind === 'installation')
  for (const paperSize of papers) for (const station of installationStations) {
    for (const kind of ['evacuation', 'infection_control'] as const) {
      const result = buildMapPrintDTO({ release, kind, paperSize, stationCode: station.code, webUrl: `${siteUrl}/staff/lab-map` })
      if (result.ok) catalog.push(result.value)
    }
  }
  // ไม่มีเส้นทางสาธารณะแบบ URL อีกต่อไป — QR ชี้กลับไปที่แผนที่ฝั่งเจ้าหน้าที่
  // ไม่รวมจุดสแกนของสำนักงานเอง (checkpoint ของ VISITOR_STATION_CODE) เป็นตัวเลือกปลายทางที่พิมพ์ได้ —
  // ผู้มาติดต่อยืนอยู่หน้าสำนักงานอยู่แล้ว เส้นทางไปจุดสแกนที่ติดกับประตูเดียวกันไม่จำเป็นต้องมีป้ายพิมพ์แยก
  // (เส้นทางนี้ยังคงอยู่ใน manifest เพื่อใช้กับการนำทางในแอปสำหรับผู้มาติดต่อของแผนกนี้)
  const ownCheckpointCode = LAB_STATIONS.find((station) => station.code === VISITOR_STATION_CODE)?.checkpointCode
  const destinations = [...new Set(LAB_ROUTE_PRESETS.filter((route) => route.kind === 'visitor' && route.fromStationCode === VISITOR_STATION_CODE && route.destinationCode !== ownCheckpointCode).map((route) => route.destinationCode))]
  for (const paperSize of papers) for (const destinationCode of destinations) {
    const result = buildMapPrintDTO({ release, kind: 'visitor_navigation', paperSize, stationCode: VISITOR_STATION_CODE, destinationCode, webUrl: `${siteUrl}/staff/lab-map` })
    if (result.ok) catalog.push(result.value)
  }

  return <>
    <PageHeader title="ส่งออกแผนที่ควบคุม" subtitle="A3/A4 · PDF/PNG · แยกชั้นข้อมูลตามวัตถุประสงค์" />
    {canManage ? <LabMapReleasePanel release={managedRelease} staff={staff} /> : null}
    <LabMapExportClient catalog={catalog} />
  </>
}
```

- [ ] **Step 4: Run the wiring test to verify it passes**

Run: `npx tsx scripts/lab-map-release-wiring.test.ts`
Expected: `lab map release wiring contract passed`

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Run the full existing lab-map test suite (regression check)**

Run:
```bash
npx tsx scripts/lab-map-domain.test.ts
npx tsx scripts/lab-map-visitor-flow.test.ts
npx tsx scripts/lab-map-ui.test.ts
npx tsx scripts/lab-map-navigation.test.ts
npx tsx scripts/lab-map-export-ui.test.ts
npx tsx scripts/lab-map-release-api.test.ts
npx tsx lib/lab-map/server.test.ts
npx tsx lib/lab-map/print.test.ts
npx tsx lib/lab-map/release.test.ts
npx tsx scripts/lab-map-release-panel.test.ts
npx tsx scripts/lab-map-release-wiring.test.ts
```
Expected: every line prints its own `... passed` message, no failures

- [ ] **Step 7: Production build**

Run: `npm run build`
Expected: build succeeds (this also re-runs the TypeScript check across the whole project)

- [ ] **Step 8: Commit**

```bash
git add "app/(protected)/staff/lab-map/print/page.tsx" scripts/lab-map-release-wiring.test.ts
git commit -m "feat(lab-map): wire release management panel into the export page"
```

---

## Manual verification (do after both tasks, in a dev server)

1. Sign in as a role that is **not** Admin/Manager, open `/staff/lab-map/print` — confirm no release panel appears, export controls look exactly as before.
2. Sign in as Admin/Manager with no release ever created — confirm the "สร้างฉบับร่าง" form appears; submit it; confirm a toast and the page refreshing into the draft-edit state.
3. In the draft-edit state, pick the same person for ผู้ทบทวน and ผู้อนุมัติ, click "บันทึก", then "เผยแพร่" — confirm the blockers list appears (server rejects same reviewer/approver) instead of a generic error.
4. Pick two different people, save, then publish — if safety equipment/assembly points are not fully verified yet, confirm the blockers list explains that (this is expected given current seed data per `lib/lab-map/release.ts`'s `validatePublishableRelease`) rather than crashing.
5. Once publishable, confirm publish succeeds, the export page now shows "ฉบับใช้งานจริง" and the "ส่งออกฉบับใช้งานจริง PDF" button is enabled, and the printed PDF footer shows the reviewer/approver **names**, not UUIDs.
6. Click "สร้างฉบับร่างใหม่" after publishing — confirm a second draft can be created and edited without losing sight of it on refresh.
