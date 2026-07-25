# Annual Agreement Approver and Menu Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** จำกัดการรับรองรอบข้อตกลงให้เฉพาะหัวหน้ากลุ่มงานจากผังองค์กร พร้อมเก็บ snapshot ผู้รับรองและยุบเมนูข้อตกลงไปไว้ที่ทะเบียนบุคลากร

**Architecture:** แยก capability การดู การจัดการ และการรับรองไว้ใน pure access helper และ server guards โดยทุก API ตรวจสิทธิ์ของตนเอง หน้าจอรับ boolean capability จาก Server Component และแสดงเฉพาะการกระทำที่อนุญาต ส่วนฐานข้อมูลเก็บ snapshot ผู้รับรองใน campaign เพื่อรักษาประวัติ

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/PostgreSQL, Node test runner via `tsx`

## Global Constraints

- ผู้รับรองต้องมี `profiles.dept_role = 'group_lead'` ณ เวลารับรอง
- Admin/Manager ที่ไม่ใช่ `group_lead` จัดการรอบได้แต่รับรองไม่ได้
- `group_deputy` และ `is_section_head` ไม่ได้รับสิทธิ์รับรองอัตโนมัติ
- ไม่เพิ่ม route ใหม่และไม่แก้ `proxy.ts`
- รักษาการเปลี่ยนแปลงอื่นใน dirty worktree และทำงานบน `main`

---

### Task 1: Access capabilities and server guards

**Files:**
- Create: `lib/personnel/agreement-access.ts`
- Create: `lib/personnel/agreement-access.test.ts`
- Modify: `lib/auth/guards.ts`

**Interfaces:**
- Produces: `canApproveAgreementCampaign(deptRole)`, `canViewAgreementCampaigns(role, deptRole)`, `requireAgreementCampaignView()`, `requireAgreementCampaignApprove()`

- [ ] **Step 1: Write failing access tests** for group lead approval, manager-only management without approval, deputy denial, and group-lead view access.
- [ ] **Step 2: Run** `npx tsx --test lib/personnel/agreement-access.test.ts` and confirm failure because the module does not exist.
- [ ] **Step 3: Implement pure capability functions** and extend `Actor`/`getActor()` to include `dept_role`; add view and approval guards using current database identity.
- [ ] **Step 4: Run the access test** and confirm all cases pass.

### Task 2: Enforce route authorization and approver snapshot

**Files:**
- Modify: `scripts/personnel-annual-agreements.sql`
- Modify: `lib/personnel/annual-agreements-server.ts`
- Modify: `app/api/admin/personnel/agreements/campaigns/route.ts`
- Modify: `app/api/admin/personnel/agreements/campaigns/[campaignId]/route.ts`
- Modify: `app/api/admin/personnel/agreements/campaigns/[campaignId]/approve/route.ts`
- Modify: `app/api/admin/personnel/agreements/campaigns/[campaignId]/report/route.ts`
- Modify: `app/api/admin/personnel/agreements/campaigns/[campaignId]/evidence/[profileId]/route.ts`
- Modify: `scripts/personnel-annual-agreements-contract.test.ts`

**Interfaces:**
- Consumes: guards from Task 1
- Produces: `approval_actor_snapshot jsonb` and approval records containing `{ name, positionTitle, deptRole }`

- [ ] **Step 1: Extend the contract test** to require view guards on GET/report/evidence, approval guard on POST approve, manager guards on mutations, and the SQL snapshot column.
- [ ] **Step 2: Run** `npx tsx scripts/personnel-annual-agreements-contract.test.ts` and confirm the new assertions fail.
- [ ] **Step 3: Add** `approval_actor_snapshot jsonb` with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, switch read routes to the view guard, and switch the approval route to the approval guard.
- [ ] **Step 4: In `approveAgreementCampaign`**, re-read the approver profile, reject non-`group_lead`, and store name, position title, and role snapshot with the approval.
- [ ] **Step 5: Run contract and access tests** and confirm they pass.

### Task 3: Capability-driven management UI

**Files:**
- Modify: `app/(protected)/staff/personnel/agreements/page.tsx`
- Modify: `components/personnel/AgreementCampaignManagerClient.tsx`
- Modify: `scripts/personnel-annual-agreements-contract.test.ts`

**Interfaces:**
- Consumes: `canViewAgreementCampaigns` and `canApproveAgreementCampaign`
- Produces: `canManageCampaigns` and `canApproveCampaigns` props

- [ ] **Step 1: Add failing contract assertions** requiring capability props and conditional rendering for create/delete/exempt/approve controls.
- [ ] **Step 2: Run the contract test** and confirm failure on missing props.
- [ ] **Step 3: Query `role, dept_role` on the server page**, allow managers or group leads, and pass both capabilities to the client.
- [ ] **Step 4: Hide manager mutations unless `canManageCampaigns`** and hide the approval signature section unless `canApproveCampaigns`.
- [ ] **Step 5: Run contract test and `npx tsc --noEmit`** and confirm success.

### Task 4: Consolidate navigation at the personnel registry

**Files:**
- Modify: `components/layout/StaffSidebar.tsx`
- Modify: `app/(protected)/staff/personnel/page.tsx`
- Modify: `app/(protected)/staff/personnel/PersonnelClient.tsx`
- Modify: `scripts/personnel-annual-agreements-contract.test.ts`

**Interfaces:**
- Produces: `canApproveAgreements` prop for the registry header

- [ ] **Step 1: Add failing contract assertions** that Sidebar does not contain `/staff/agreements`, the registry always links “ข้อตกลงของฉัน”, managers link management, and group leads link approval.
- [ ] **Step 2: Run the contract test** and confirm failure on the existing Sidebar link and missing registry actions.
- [ ] **Step 3: Remove the Sidebar child**, query `dept_role` on the registry page, allow group-lead access, and pass `canApproveAgreements`.
- [ ] **Step 4: Add registry buttons** for self agreement, management, and approval with mutually clear labels.
- [ ] **Step 5: Run contract test and TypeScript** and confirm success.

### Task 5: Full verification

**Files:**
- Verify only

- [ ] **Step 1: Run agreement tests:** `npx tsx --test lib/personnel/agreement-access.test.ts lib/personnel/annual-agreements.test.ts lib/personnel/agreement-evidence-pdf.test.ts lib/personnel/agreement-campaign-report-pdf.test.ts`.
- [ ] **Step 2: Run contract test:** `npx tsx scripts/personnel-annual-agreements-contract.test.ts`.
- [ ] **Step 3: Run static checks:** `npx tsc --noEmit` and `git diff --check`.
- [ ] **Step 4: Run production build:** `npm run build` and confirm exit code 0.
