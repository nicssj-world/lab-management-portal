# Product

<!-- impeccable:product-schema 1 -->

> **Record status:** Repository-backed draft. The structured init interview was unavailable in this session, so statements marked **Inference** are hypotheses derived from the codebase and should be confirmed by the product owner before becoming hard product commitments.

## Platform

web

## Users

- **Confirmed:** Internal users at Chonburi Hospital's Medical Technology / laboratory group. The portal has workflows for test catalog, quality documents, equipment, workload, TAT, risk, safety, surveys, IT records, personnel, and administration.
- **Confirmed:** Access is permissioned by role, document role, department role, safety-editor status, and module permissions. The code names roles including Admin, Laboratory Director, Quality Manager, Document Controller, Reviewer, Manager, and other staff roles.
- **Confirmed:** Public visitors use read-oriented routes for laboratory services, test catalog, manuals, news, public SDS/safety information, and public-safe laboratory-map views. Survey respondents submit through tokenized public forms reached from campaign QR codes.
- **Inference:** The primary day-to-day user is laboratory staff and quality/administrative coordinators who need to record work, retrieve current instructions, and prepare auditable evidence. Confirm the primary audience and priority jobs with the product owner.

## Product Purpose

- **Confirmed:** `CBH - Lab Management` is an internal laboratory management portal for Chonburi Hospital's Medical Technology group.
- **Inference:** The product brings operational records, quality evidence, performance data, safety workflows, and approved public information into one governed workspace. A successful experience lets staff complete routine work, find the current controlled source, follow approval boundaries, and inspect metrics without exposing protected information to public surfaces.

## Positioning

- **Inference from repository structure:** This is a hospital-lab operating system rather than a single catalog or dashboard. Its distinctive mechanism is the connection between day-to-day laboratory operations, QMS workflows, evidence/audit history, role-based access, and deliberately limited public projections of approved content.
- **Open decision:** Confirm whether “one governed workspace for laboratory operations and quality” is the intended product positioning, or whether a narrower audience/job should lead future work.

## Operating Context

- The portal serves a Thai-first hospital environment; staff navigation and public content use Thai labels with English equivalents where useful. The root document language is `th`.
- Staff work occurs inside an authenticated shell with a permission-filtered sidebar, route-aware breadcrumbs, module sub-navigation, URL-backed views, filters, imports, records, documents, and reports.
- Quality work follows controlled-document and QMS rituals: Draft → Review → Approved → Published, revision history, annual review, read-compliance, CAPA, evidence attachments, and audit logs.
- Data arrives from local LIS/HIS-style exports, spreadsheets, and manually applied Supabase SQL/migrations. TAT analysis uses local fiscal-year files as its source of truth and publishes an analysis summary cache.
- Cloudflare R2 is used for selected evidence and controlled-file storage. Public QR and printed workflows are part of the operating context for laboratory manuals, safety maps, check-ins, and surveys.
- Fiscal-year reporting uses Thai/Buddhist-year conventions and the application operates in the Asia/Bangkok context.

## Capabilities and Constraints

- **Staff operations:** dashboard/KPI, test catalog, quality document control, quality task registry and calendar, EQA/PT, OUTLAB, equipment and PM/CAL, personnel, IT access/backup/downtime/visitor records, news, and system administration.
- **Analytics:** KPI, laboratory workload, turnaround time, rejection, risk register/incident reporting, Smart-RM, satisfaction reporting, and annual/export views.
- **Safety:** internal laboratory map, evacuation and assembly points, safety-equipment inspections, chemical registry, SDS workflows, and controlled public projections. The public safety projection intentionally excludes internal room topology, labels, doors, infection classes, personnel, and safety-equipment positions.
- **Public services:** service/test catalog, collection manual, news, related documents, public SDS, public safety/manual views, tokenized survey/check-in/visitor flows, and QR-linked experiences.
- **Governance:** published controlled documents are not edited in place; content changes use working revisions. QP/WI documents can require source files, content PDFs, generated covers, signatures, effective dates, and immutable history.
- **Security and privacy:** protected pages are authenticated through Supabase; permissions control module visibility and editing. Public survey clients submit through API routes and must not read or write raw Supabase survey tables.
- **Operational constraints:** database schema and feature migrations are applied manually in Supabase SQL Editor; deployments do not apply migrations automatically. The legacy contract module is redirected to the external LABCBH Stock system when that cutover flag is enabled.
- **Terminology to preserve:** QP, WI, QM, MN, Rev., Draft, Review, Approved, Published, EQA/PT, OUTLAB, IOR, CAPA, SDS, TAT, LIS, HIS, and fiscal-year terminology.

## Brand Commitments

- The product name and metadata use `CBH - Lab Management` / `Lab Management Portal`.
- Institutional context is Chonburi Hospital's Medical Technology group (`กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี`). Do not invent institutional claims, accreditations, testimonials, or service promises beyond the source content.
- Thai is the primary content language; existing bilingual labels and terminology are part of the product's operating vocabulary.
- Preserve approved identity assets when a surface needs them, including `public/images/cbh-lab-logo-v3.png`, `public/images/logo-chonburi.png`, and `public/brand/logo-chonburi.png`.

## Evidence on Hand

- Product scope and workflow rules: [README.md](README.md).
- Runtime metadata and language: [app/layout.tsx](app/layout.tsx).
- Protected operating shell and accessibility behavior: [app/(protected)/layout.tsx](app/(protected)/layout.tsx), `components/layout/StaffSidebar.tsx`, and `components/layout/StaffTopbar.tsx`.
- Public service surface: [app/(public)/page.tsx](app/(public)/page.tsx), `app/(public)/manual`, `app/(public)/catalog`, `app/(public)/news`, and tokenized public routes under `app/s`, `app/e`, `app/h`, and `app/v`.
- Current visual primitives: [app/globals.css](app/globals.css), `components/ui/Button.tsx`, `components/ui/Card.tsx`, `components/ui/Input.tsx`, `components/ui/Badge.tsx`, `components/ui/ModuleSubnav.tsx`, `components/ui/ViewTabs.tsx`, and `components/ui/FilterChips.tsx`.
- Real content/assets: `public/images/hero-lab`, `public/images/cbh-lab-logo-v3.png`, `public/fonts/noto-sans-thai`, `public/fonts/rajdhani`, `public/fonts/dm-mono`, `assets/personnel/agreements`, controlled document PDFs, and the SQL/workbook files referenced by the README.
- **Absent:** No product-owner interview transcript, formal positioning statement, testimonial/case-study library, or formal WCAG conformance target was found. Future work must not fabricate these.

## Product Principles

These principles are derived from the confirmed workflows and repository evidence; the product owner should confirm them as strategic commitments.

1. **Current information is the safe information.** Make the current published document, status, revision, owner, and date easy to identify.
2. **Permission follows responsibility.** Keep module access, editing, approval, and public exposure aligned with role and workflow authority.
3. **Evidence travels with the work.** Preserve files, history, audit actions, read records, attachments, and source context so decisions remain explainable.
4. **Operational data should become usable signal.** Turn TAT, workload, KPI, rejection, risk, safety, and satisfaction records into focused views that support action.
5. **Public information is an intentional projection.** Publish only approved, privacy-safe information needed by patients, visitors, clinicians, or partner services.

## Accessibility & Inclusion

- Thai-first content and `lang="th"` are required for the primary audience; preserve readable bilingual labels where the existing navigation uses them.
- The protected shell provides a skip link, route-aware breadcrumbs, visible keyboard focus, `aria-current` navigation state, minimum 44px navigation targets, responsive horizontal scrolling, and reduced-motion behavior.
- Public tokenized flows must remain usable on mobile devices and through QR-linked entry points; error states should explain how to recover without exposing internal data.
- **Open decision:** No formal WCAG target is recorded in the repository. Confirm the required conformance level before making it a product commitment.
