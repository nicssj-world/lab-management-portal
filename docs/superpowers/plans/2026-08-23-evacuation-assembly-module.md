# จุดรวมพล/แผนอพยพ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างโมดูล `/staff/lab-map/evacuation` ที่จัดการแผนอพยพ จุดรวมพล การซ้อมประจำปี และเชื่อมงาน Quality Tasks/หลักฐาน/CAPA ให้ใช้งานจริงได้ โดยแยกจากโมดูลอุปกรณ์ความปลอดภัย

**Architecture:** ใช้ข้อมูลแผนที่และจุดรวมพลเดิมเป็น source of truth ไม่คัดลอก geometry เพิ่ม สร้างตารางเฉพาะสำหรับ plan version, exit assignment, drill cycle/session และ evidence link ใช้ `quality_task_links`/`quality_task_attachments` เดิมเป็นจุดเชื่อมงานและไฟล์ จากนั้นให้ Server Component โหลด dashboard และ Client Component จัดการ tabs/form แบบ optimistic เฉพาะข้อมูลที่ตรวจสอบได้

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase service-role server repository, SQL migrations, Zod, existing UI primitives/CSS tokens, `tsx` domain/UI contract tests

## Global Constraints

- โมดูลที่ 3 ต้องแยก navigation และ ownership จาก “อุปกรณ์ความปลอดภัย”
- Public/QR แสดงเฉพาะแผนที่และแผนอพยพสถานะ `published`; draft/in-review และข้อมูลบุคลากรต้องไม่หลุด public API
- ทุก route ที่เผยแพร่ต้องใช้ route preset ที่อนุมัติแล้ว มี primary/alternate ตาม scope และปลายทางหลังออกจากอาคาร
- ห้ามคำนวณ shortest path แบบสด และห้ามใช้ Google Maps เป็น dependency ของงานอพยพฉุกเฉิน
- งาน `CBH-ST-15`, `CBH-ST-17`, `CBH-ST-21` ต้องเชื่อมด้วย `quality_task_links`; ไม่สร้าง `CBH-QT-33` ซ้ำ
- หลักฐานต้องอยู่ใน `quality_task_attachments`; โมดูลใหม่แสดง/อ้างอิงไฟล์เดิมและ requirement เดิม ไม่เก็บไฟล์ซ้ำ
- reviewer/approver ต้องแยกกัน และ publish ต้อง fail-closed เมื่อข้อมูลจุด/route/metadata ไม่ครบ
- UI ใช้ semantic color tokens, SVG icons เดิม, visible labels, focus state, target อย่างน้อย 44px, responsive 375/768/1024/1440 และ reduced motion
- ทุก behavior ใหม่ต้องทำ TDD: เขียน test ให้ fail ก่อน production code แล้วจึงทำให้ผ่าน
- route ใหม่อยู่ใต้ `/staff` จึงอยู่ใน `isProtectedPath` เดิม ไม่ต้องขยาย public access

---

### Task 1: Domain contract และฐานข้อมูลแผนอพยพ

**Files:**
- Create: `supabase/migrations/20260823090000_lab_map_evacuation_module.sql`
- Create: `lib/lab-map/evacuation.ts`
- Create: `lib/lab-map/evacuation.test.ts`
- Modify: `lib/lab-map/types.ts`
- Modify: `lib/quality-tasks/types.ts`
- Modify: `package.json` (`test:lab-map-safety`)

**Interfaces:**
- `validateEvacuationPlanForPublish(input): { ok: true } | { ok: false; errors: string[] }`
- `calculateEvacuationMetrics(sessions): { completedRate; averageDurationSeconds; complianceRate; headcountReadyRate }`
- `EvacuationPlanDTO`, `EvacuationExitAssignmentDTO`, `EvacuationDrillCycleDTO`, `EvacuationDrillSessionDTO`, `EvacuationTaskLinkDTO`

- [ ] **Step 1: Write the failing test**

เพิ่ม tests ที่ยืนยันว่า plan ที่ไม่มีจุด verify/GPS, assignment primary/alternate, report point, ผู้รับผิดชอบ หรือใช้ `permanently_locked` exit ถูก block และ plan ที่ครบถ้วนผ่านได้ รวมถึง metrics ที่คำนวณเวลาเฉลี่ยและอัตราครบถ้วนถูกต้อง

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx lib/lab-map/evacuation.test.ts`
Expected: FAIL เพราะไม่มี `validateEvacuationPlanForPublish` และ types ใหม่

- [ ] **Step 3: Write minimal implementation**

เพิ่ม types และ pure validators แล้วสร้าง migration ที่มี `evacuation_plan_versions`, `evacuation_exit_assignments`, `evacuation_drill_cycles`, `evacuation_drill_sessions`, `evacuation_drill_evidence` พร้อม foreign keys, status checks, unique keys, indexes, RLS/service-role grants และเพิ่ม integration kinds `evacuation_plan_review`/`evacuation_drill` ใน constraints ของ template/link

Migration ต้อง update seed ของ `CBH-ST-15`, `CBH-ST-17`, `CBH-ST-21` ให้ใช้ integration kind ที่ตรงกัน และเพิ่ม evidence requirement สำหรับ attendance/headcount ของ `CBH-ST-17` โดยไม่สร้างหรือ activate `CBH-QT-33`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx lib/lab-map/evacuation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260823090000_lab_map_evacuation_module.sql lib/lab-map/evacuation.ts lib/lab-map/evacuation.test.ts lib/lab-map/types.ts lib/quality-tasks/types.ts package.json
git commit -m "feat: add evacuation domain and schema"
```

### Task 2: Server repository และ dashboard ที่รวมงาน/หลักฐาน

**Files:**
- Create: `lib/lab-map/evacuation-server.ts`
- Create: `lib/lab-map/evacuation-server.test.ts`
- Modify: `lib/quality-tasks/safety-server.ts` เฉพาะ helper projection ถ้าจำเป็น

**Interfaces:**
- `getEvacuationDashboard(actorId, level): Promise<EvacuationDashboardDTO>`
- `createEvacuationPlan(input, actor): Promise<EvacuationPlanDTO>`
- `updateEvacuationPlan(id, input, actor): Promise<EvacuationPlanDTO>`
- `transitionEvacuationPlan(id, action, actor): Promise<EvacuationPlanDTO>`
- `createDrillCycle(input, actor): Promise<EvacuationDrillCycleDTO>`
- `createDrillSession(input, actor): Promise<EvacuationDrillSessionDTO>`

- [ ] **Step 1: Write the failing test**

ทดสอบ pure query/projection helpers ด้วย fixture จริงว่า dashboard คืน plan/points/route preset, task candidates เฉพาะ `CBH-ST-15/17/21`, attachment requirement/count และ link source id เดียวกัน และไม่รวม task inactive `CBH-QT-33`

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx lib/lab-map/evacuation-server.test.ts`
Expected: FAIL เพราะ repository/projection ยังไม่มี

- [ ] **Step 3: Write minimal implementation**

ใช้ `getStaffLabMapDTO`, `listAssemblyPoints`, `getQualityTaskTemplates(true, 'safety')` และ `getQualityTaskOccurrences` เป็นแหล่งข้อมูลเดิม แล้ว query ตาราง evacuation/link เพิ่มเติม แปลงเป็น DTO ที่ UI ใช้ได้ทันที พร้อม map task detail ไปยัง `/staff/safety` และ attachment URL `/api/admin/safety-tasks/attachments/:id`

การสร้าง cycle ต้องตรวจว่ามี `taskInstanceId` จากงานที่เลือก แล้ว insert `quality_task_links` แบบ idempotent ด้วย `integration_kind='evacuation_drill'`, `source_type='evacuation_drill_cycle'`, `source_id=cycle.id`; การสร้าง plan review ใช้ link แบบเดียวกันกับ `evacuation_plan_version`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx lib/lab-map/evacuation-server.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/lab-map/evacuation-server.ts lib/lab-map/evacuation-server.test.ts lib/quality-tasks/safety-server.ts
git commit -m "feat: connect evacuation dashboard to safety tasks"
```

### Task 3: Authenticated API และ state transitions

**Files:**
- Create: `app/api/admin/lab-map/evacuation/route.ts`
- Create: `app/api/admin/lab-map/evacuation/plans/route.ts`
- Create: `app/api/admin/lab-map/evacuation/plans/[id]/route.ts`
- Create: `app/api/admin/lab-map/evacuation/drills/route.ts`
- Create: `app/api/admin/lab-map/evacuation/drills/[id]/route.ts`
- Create: `scripts/lab-map-evacuation-api.test.ts`

**Interfaces:**
- `GET /api/admin/lab-map/evacuation`
- `POST /api/admin/lab-map/evacuation/plans`
- `PATCH /api/admin/lab-map/evacuation/plans/:id` with `action=submit|approve|publish|retire`
- `POST /api/admin/lab-map/evacuation/drills` with `kind=cycle|session`
- `PATCH /api/admin/lab-map/evacuation/drills/:id` with session update

- [ ] **Step 1: Write the failing test**

เพิ่ม static route contract tests ตรวจ route files, method/guard, schema validation, fail-closed publish response, duplicate task link handling และไม่ให้ viewer mutate

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/lab-map-evacuation-api.test.ts`
Expected: FAIL เพราะ route files/API contract ยังไม่มี

- [ ] **Step 3: Write minimal implementation**

ใช้ `requireSafetyViewer`, `requireSafetyEditor`, `requireSafetyManager` ตาม operation; ใช้ Zod schemas จำกัด scope/exit/variant/date/time/จำนวนผู้เข้าร่วม; ทุก transition ตรวจ optimistic `updatedAt`, audit log, reviewer/approver separation และตอบ error ที่บอกวิธีแก้

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/lab-map-evacuation-api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/lab-map/evacuation scripts/lab-map-evacuation-api.test.ts
git commit -m "feat: add evacuation management APIs"
```

### Task 4: หน้า staff โมดูลจุดรวมพล/แผนอพยพ

**Files:**
- Create: `app/(protected)/staff/lab-map/evacuation/page.tsx`
- Create: `components/lab-map/EvacuationClient.tsx`
- Create: `components/lab-map/EvacuationStyles.tsx`
- Create: `scripts/lab-map-evacuation-ui.test.ts`
- Modify: `components/lab-map/SafetyAssetsClient.tsx`
- Modify: `app/(protected)/staff/lab-map/safety-assets/page.tsx`

**Interfaces:**
- `EvacuationClient({ initialDashboard, canEdit, canManage })`
- tabs: `overview | plan | assembly | drills | tasks`

- [ ] **Step 1: Write the failing test**

ตรวจ source contract ว่ามีชื่อ route/title/tabs “งานและหลักฐาน”, task source keys ทั้งสาม, evidence count, primary/alternate, report point, annual drill fields, loading/error/empty states และ link กลับทะเบียนอุปกรณ์/งานความปลอดภัย

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/lab-map-evacuation-ui.test.ts`
Expected: FAIL เพราะ page/component ใหม่ยังไม่มี

- [ ] **Step 3: Write minimal implementation**

สร้าง Server Component ที่ guard และโหลด dashboard แล้ว Client UI แบบ data-dense แต่ใช้ incumbent tokens: overview มี readiness/metrics/current plan/task evidence; plan มี assignment form, route preset, report point, review/publish actions; assembly ใช้ endpoint เดิมเพื่อแก้/verify point; drills บันทึก cycle/session, เวลา, headcount, evaluator และ CAPA; tasks แสดง task status, requirement progress, attachment links และปุ่มเปิด Safety Task ที่เป็น source of truth

ลบ tab/การจัดการจุดรวมพลออกจาก `SafetyAssetsClient` และเปลี่ยน header/link ให้ “อุปกรณ์ความปลอดภัย” ชี้ไปโมดูลใหม่ ส่วนการจัดการ points อยู่หน้า evacuation เท่านั้น

UI ต้องมี keyboard tab semantics, labels, inline validation, `role=alert/status`, loading disable, retry, empty state, mobile card layout และไม่ใช้ icon-only/emoji

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/lab-map-evacuation-ui.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/(protected)/staff/lab-map/evacuation" components/lab-map/EvacuationClient.tsx components/lab-map/EvacuationStyles.tsx components/lab-map/SafetyAssetsClient.tsx "app/(protected)/staff/lab-map/safety-assets/page.tsx" scripts/lab-map-evacuation-ui.test.ts
git commit -m "feat: add evacuation assembly staff module"
```

### Task 5: Public/print projection และ regression ของโมดูลเดิม

**Files:**
- Modify: `lib/lab-map/public-safety.ts`
- Modify: `app/(public)/lab-map/[stationCode]/page.tsx`
- Modify: `components/lab-map/LabMapPrintSheet.tsx` หรือ `components/lab-map/LabMapExportClient.tsx` เฉพาะส่วน post-exit panel
- Create: `scripts/lab-map-evacuation-public.test.ts`

- [ ] **Step 1: Write the failing test**

ตรวจว่า projection ใช้เฉพาะ published plan/assembly snapshot, ไม่ส่ง draft/private/task attachments และมี post-exit instruction/version/effective date ใน safety view/print

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx scripts/lab-map-evacuation-public.test.ts`
Expected: FAIL เพราะ public projection ยังไม่มี plan instruction/status contract

- [ ] **Step 3: Write minimal implementation**

เพิ่ม public-safe plan summary จาก server snapshot ใช้ static site panel และ fallback ข้อความให้ยึดป้ายฉบับอนุมัติเมื่อไม่มี online plan ห้ามแสดงผู้เข้าร่วม/ชื่อบุคลากร/หลักฐาน private

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx scripts/lab-map-evacuation-public.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/lab-map/public-safety.ts "app/(public)/lab-map/[stationCode]/page.tsx" components/lab-map scripts/lab-map-evacuation-public.test.ts
git commit -m "feat: expose published evacuation guidance"
```

### Task 6: Verification, bug fixing และ handoff

**Files:**
- Modify: only files created or modified in Tasks 1–5 when a verification failure identifies a concrete defect
- Create: `docs/superpowers/plans/2026-08-23-evacuation-assembly-module.md` (this plan)

- [ ] **Step 1: Run focused RED/GREEN suites**

Run: `npm run test:lab-map-safety` and each new test command; fix actual failures in production code, not by weakening assertions

- [ ] **Step 2: Run type/build verification**

Run: `npx tsc --noEmit` then `npm run build`
Expected: no TypeScript errors and production build succeeds

- [ ] **Step 3: Run static UI quality checks**

Run: `node .agents/skills/impeccable/scripts/detect.mjs --json` against changed UI targets; resolve mechanical findings, then verify 375px/768px/1024px/1440px layout contracts and reduced-motion CSS

- [ ] **Step 4: Run secret/worktree checks**

Run: `npm run test:secrets` and `git diff --check`; confirm only intended files are changed and no credentials are included

- [ ] **Step 5: Commit verified implementation**

```bash
git add supabase/migrations/20260823090000_lab_map_evacuation_module.sql lib/lab-map/evacuation.ts lib/lab-map/evacuation.test.ts lib/lab-map/evacuation-server.ts lib/lab-map/evacuation-server.test.ts lib/lab-map/types.ts lib/quality-tasks/types.ts app/api/admin/lab-map/evacuation components/lab-map/EvacuationClient.tsx components/lab-map/EvacuationStyles.tsx components/lab-map/SafetyAssetsClient.tsx "app/(protected)/staff/lab-map/evacuation" "app/(protected)/staff/lab-map/safety-assets/page.tsx" lib/lab-map/public-safety.ts "app/(public)/lab-map/[stationCode]/page.tsx" scripts/lab-map-evacuation-*.test.ts package.json
git commit -m "feat: ship evacuation assembly and drill module"
```
