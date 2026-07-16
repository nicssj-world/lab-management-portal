# Satisfaction Survey Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved constrained satisfaction-survey builder, anonymous QR collection flow, live aggregate dashboard, controlled comments, annual exports, and deliberate KPI publication while preserving existing KPI history.

**Architecture:** Supabase stores immutable form versions, campaigns, responses, answers, and audit metadata. Next.js 16 Server Components and Route Handlers enforce staff permissions and public token validation; client components handle the builder, public form, Recharts dashboards, QR rendering, Realtime refetch, and browser exports. Public clients never write directly to Supabase.

**Tech Stack:** Next.js 16.2.6 App Router, React 19.2.4, TypeScript, Supabase/Postgres/RLS/Realtime, Zod 3, Recharts 3, XLSX, HTML print-to-PDF, `qrcode`, existing portal UI primitives and CSS variables.

## Global Constraints

- Work on `main` only because the user explicitly approved it.
- Read APIs from `node_modules/next/dist/docs/`; dynamic page and Route Handler params are promises and must be awaited.
- Use `await createClient()` only for session/auth checks and `supabaseAdmin` only in server code for controlled database access.
- All public reads/submissions go through `/api/satisfaction/[token]`; no direct anon table grants.
- Enable RLS on every new public-schema table. Revoke transaction-function execution from `PUBLIC`, `anon`, and `authenticated`; grant only `service_role`; fix `search_path`.
- Preserve all 17 existing `kpi_satisfaction` rows and do not repurpose the empty legacy `satisfaction_entries` table.
- Add the protected module under `/staff/satisfaction`; `/staff/*` is already covered by `proxy.ts`; keep `/s/[token]` public.
- Resource key is exactly `แบบสำรวจความพึงพอใจ` with `none | view | edit` semantics. Only normalized roles `Admin` and `Manager` may mark/read-state or export comment content.
- Primary satisfaction is normalized score; positive-response rate is secondary. Missing optional answers are excluded.
- Public responses are anonymous: no user ID, name, HN, permanent IP, or User-Agent. One-per-device uses only a campaign-bound hash of an HttpOnly cookie.
- No partial responses. Submission and answers commit in one transaction and retry is idempotent by `(campaign_id, submission_key)`.
- Use existing `components/ui`, `Icon`, Recharts, inline CSS variables, Sarabun/Noto Sans Thai, dark mode, and project modal patterns. Do not introduce a new UI library or Tailwind custom styling.
- Apply `ui-ux-pro-max` results that fit the portal: mobile-first public form; visible labels/focus; `aria-live` errors; 150–300 ms non-layout-shifting transitions; line, horizontal bar, and stacked Likert charts with numeric/table alternatives; verify 375/768/1024/1440 px and reduced motion. Retain project colors/fonts instead of its incompatible landing/typography suggestions.
- Test first and observe the expected failure before each production behavior. Run `npx tsc --noEmit` after every TypeScript task and `npm run build` before completion.
- Do not apply the SQL script to the linked remote Supabase project without separate explicit authorization.

---

### Task 1: Domain types, scoring, validation, SQL schema, and four-form seed

**Files:**
- Create: `lib/surveys/types.ts`
- Create: `lib/surveys/scoring.ts`
- Create: `lib/surveys/scoring.test.ts`
- Create: `lib/surveys/validation.ts`
- Create: `lib/surveys/validation.test.ts`
- Create: `scripts/satisfaction-survey-module.sql`
- Create: `scripts/satisfaction-survey-module.test.ts`

**Interfaces:**
- Produces `SurveyQuestionType`, `SurveyOption`, `SurveyQuestion`, `SurveySection`, `SurveyVersionDefinition`, `SurveyCampaign`, `SurveySubmission`, and `SurveyAnswerInput`.
- Produces `calculateSurveyScore(definition, answers): SurveyScoreSummary` and `validateSubmission(definition, answers): SubmissionValidationResult`.
- SQL produces eleven survey tables, immutable/version/device/idempotency constraints, `submit_survey_response(...)`, RLS/grants, Realtime publication, permission defaults, and the four seeded published definitions.

- [ ] **Step 1: Write failing scoring tests**

```ts
import assert from 'node:assert/strict'
import { calculateSurveyScore } from './scoring'

const result = calculateSurveyScore([
  { questionId: 'q1', sectionId: 's1', score: 5, maxScore: 5, positiveThreshold: 4 },
  { questionId: 'q2', sectionId: 's1', score: 3, maxScore: 5, positiveThreshold: 4 },
])
assert.equal(result.normalizedPct, 80)
assert.equal(result.positivePct, 50)
assert.equal(result.validAnswerCount, 2)
```

- [ ] **Step 2: Run scoring tests and verify RED**

Run: `npx tsx lib/surveys/scoring.test.ts`
Expected: FAIL because `lib/surveys/scoring.ts` does not exist.

- [ ] **Step 3: Implement pure scoring**

Implement `ScoredAnswer` and `SurveyScoreSummary`; ignore null/non-finite/unscored answers, calculate `sum(score) / sum(maxScore) * 100`, calculate threshold hits, round percentages to two decimals, and produce per-section summaries.

- [ ] **Step 4: Verify scoring GREEN**

Run: `npx tsx lib/surveys/scoring.test.ts`
Expected: `scoring tests passed`.

- [ ] **Step 5: Write failing validation tests**

Cover required answers, option ownership, unknown question IDs, numeric bounds, 500-character short/detail text, 4,000-character comments, and a valid complete payload.

- [ ] **Step 6: Run validation tests and verify RED**

Run: `npx tsx lib/surveys/validation.test.ts`
Expected: FAIL because validation exports do not exist.

- [ ] **Step 7: Implement exact domain types and validation**

Use discriminated question types, a 64 KiB payload guard, and result shape `{ ok: true; answers: NormalizedAnswer[] } | { ok: false; issues: { questionId?: string; message: string }[] }`.

- [ ] **Step 8: Verify validation GREEN**

Run: `npx tsx lib/surveys/validation.test.ts`
Expected: `validation tests passed`.

- [ ] **Step 9: Write the failing SQL contract test**

Assert the exact eleven table names, RLS on every table, unique draft/campaign-submission/device constraints, fixed `search_path`, revoke/grant statements, Realtime publication, permission resource suffixes, four form codes, and expected rating-question counts 11/9/6/15.

- [ ] **Step 10: Run SQL contract test and verify RED**

Run: `npx tsx scripts/satisfaction-survey-module.test.ts`
Expected: FAIL because the SQL script does not exist.

- [ ] **Step 11: Implement schema and seed SQL**

Create `surveys`, `survey_versions`, `survey_sections`, `survey_questions`, `survey_question_options`, `survey_campaigns`, `survey_responses`, `survey_answers`, `survey_response_devices`, `survey_response_events`, and `survey_kpi_publications` (eleven tables). Implement `submit_survey_response` as the single transaction boundary, make raw tables service-role-only, allow authenticated event SELECT only through a cheap indexed permission policy, and seed Published Version 1 definitions with no campaigns.

- [ ] **Step 12: Verify SQL contract and typecheck**

Run: `npx tsx scripts/satisfaction-survey-module.test.ts; npx tsx lib/surveys/scoring.test.ts; npx tsx lib/surveys/validation.test.ts; npx tsc --noEmit`
Expected: all scripts print passed messages; TypeScript exits 0 with no output.

- [ ] **Step 13: Commit Task 1**

```bash
git add lib/surveys scripts/satisfaction-survey-module.sql scripts/satisfaction-survey-module.test.ts
git commit -m "feat: add satisfaction survey domain and schema"
```

### Task 2: Permission wiring and read-only staff module shell

**Files:**
- Modify: `lib/permission-resources.ts`
- Modify: `components/layout/StaffSidebar.tsx`
- Modify: `components/layout/StaffTopbar.tsx`
- Modify: `scripts/seed-role-permissions.sql`
- Modify: `lib/supabase/types.ts`
- Create: `lib/surveys/server.ts`
- Create: `app/(protected)/staff/satisfaction/page.tsx`
- Create: `components/satisfaction/SatisfactionModule.tsx`
- Create: `scripts/satisfaction-navigation.test.ts`

**Interfaces:**
- `listSurveys(): Promise<SurveyListItem[]>`
- `listCampaigns(): Promise<SurveyCampaignListItem[]>`
- `SatisfactionModule` consumes initial lists and `PermLevel`.

- [ ] **Step 1: Write failing navigation/permission contract test**

Assert resource registration, sidebar href/resource/icon, topbar title, role seed rows, page use of `getActor/getPermissionLevel`, and four tab labels.

- [ ] **Step 2: Verify RED**

Run: `npx tsx scripts/satisfaction-navigation.test.ts`
Expected: FAIL because resource/route do not exist.

- [ ] **Step 3: Add permission, types, queries, and staff shell**

Add a `clipboard` icon to `components/ui/Icon.tsx` only if no existing icon communicates surveys; otherwise reuse `chart`. Page must redirect `none` to `/staff/dashboard`, fetch lists server-side in parallel, and pass `level` to a client tab shell. Use project cards, pills, table hover, empty/loading states, and responsive overflow.

- [ ] **Step 4: Verify GREEN and typecheck**

Run: `npx tsx scripts/satisfaction-navigation.test.ts; npx tsc --noEmit`
Expected: passed message and zero type errors.

- [ ] **Step 5: Commit Task 2**

```bash
git add lib/permission-resources.ts components/layout components/ui/Icon.tsx scripts/seed-role-permissions.sql lib/supabase/types.ts lib/surveys/server.ts 'app/(protected)/staff/satisfaction/page.tsx' components/satisfaction scripts/satisfaction-navigation.test.ts
git commit -m "feat: add satisfaction module shell"
```

### Task 3: Draft builder, clone, preview, and version publication

**Files:**
- Create: `lib/surveys/definition.ts`
- Create: `lib/surveys/definition.test.ts`
- Create: `app/api/admin/satisfaction/surveys/route.ts`
- Create: `app/api/admin/satisfaction/surveys/[surveyId]/route.ts`
- Create: `app/api/admin/satisfaction/surveys/[surveyId]/draft/route.ts`
- Create: `app/api/admin/satisfaction/surveys/[surveyId]/publish/route.ts`
- Create: `app/(protected)/staff/satisfaction/[surveyId]/page.tsx`
- Create: `components/satisfaction/SurveyBuilder.tsx`
- Create: `components/satisfaction/SurveyRenderer.tsx`
- Create: `components/satisfaction/SurveyPreviewModal.tsx`
- Create: `scripts/satisfaction-builder.test.ts`

**Interfaces:**
- `cloneDefinition(source, nextVersion): SurveyVersionDefinition`
- `validateDefinitionForPublish(definition): DefinitionIssue[]`
- API: list/create survey, get/archive survey, save draft, clone draft, publish draft.
- `SurveyRenderer` is shared by preview and public form and accepts `{ definition, mode, answers, errors, onAnswer }`.

- [ ] **Step 1: Write failing definition tests**

Test stable question/option keys across clone, new row IDs, version increment, one-draft behavior, missing sections/questions/options/scores/bounds, and valid publish definition.

- [ ] **Step 2: Verify RED**

Run: `npx tsx lib/surveys/definition.test.ts`
Expected: FAIL because definition helpers do not exist.

- [ ] **Step 3: Implement definition helpers and verify GREEN**

Run: `npx tsx lib/surveys/definition.test.ts`
Expected: `definition tests passed`.

- [ ] **Step 4: Write failing builder/API static contract test**

Assert `requireResource('แบบสำรวจความพึงพอใจ', 'edit')` on every mutation, Zod body parsing, async params, autosave 600 ms, explicit up/down controls, all six question types, `aria-live`, preview reuse, publish error navigation, and no `supabaseAdmin` import in client files.

- [ ] **Step 5: Verify RED**

Run: `npx tsx scripts/satisfaction-builder.test.ts`
Expected: FAIL because routes/components do not exist.

- [ ] **Step 6: Implement APIs and builder UI**

Persist a complete normalized draft graph using server-controlled replacement inside a database RPC or ordered service-role writes guarded by version status; prefer the RPC added to the SQL script so autosave cannot leave a partial definition. Keep the builder card-based, labeled, keyboard-operable, responsive, and within the approved limits.

- [ ] **Step 7: Verify builder contracts and typecheck**

Run: `npx tsx lib/surveys/definition.test.ts; npx tsx scripts/satisfaction-builder.test.ts; npx tsc --noEmit`
Expected: passed messages and zero type errors.

- [ ] **Step 8: Commit Task 3**

```bash
git add lib/surveys app/api/admin/satisfaction 'app/(protected)/staff/satisfaction/[surveyId]' components/satisfaction scripts/satisfaction-builder.test.ts scripts/satisfaction-survey-module.sql
git commit -m "feat: add satisfaction survey builder"
```

### Task 4: Campaign lifecycle, QR, public definition, and anonymous submission

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `lib/surveys/campaign.ts`
- Create: `lib/surveys/campaign.test.ts`
- Create: `app/api/admin/satisfaction/campaigns/route.ts`
- Create: `app/api/admin/satisfaction/campaigns/[campaignId]/route.ts`
- Create: `app/api/admin/satisfaction/campaigns/[campaignId]/token/route.ts`
- Create: `app/api/satisfaction/[token]/route.ts`
- Create: `app/s/[token]/page.tsx`
- Create: `components/satisfaction/CampaignManager.tsx`
- Create: `components/satisfaction/PublicSurveyForm.tsx`
- Create: `scripts/satisfaction-public-flow.test.ts`

**Interfaces:**
- `campaignAvailability(campaign, now, responseCount, duplicate): CampaignAvailability`
- `createPublicToken(): string` produces 32 random bytes in base64url form.
- Admin campaign GET/POST/PATCH and rotate-token endpoints.
- Public GET returns safe published definition/status; POST accepts `{ submissionKey, answers }` and sets/reads the device cookie.

- [ ] **Step 1: Install pinned QR dependency**

Run: `npm install --save-exact qrcode@1.5.4; npm install --save-dev --save-exact @types/qrcode@1.5.6`
Expected: lockfile updated without audit failure.

- [ ] **Step 2: Write and RED-run campaign tests**

Cover draft/open/closed, scheduled opening, expiry, limit, duplicate device, token shape, and terminal close.

Run: `npx tsx lib/surveys/campaign.test.ts`
Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement helpers and verify GREEN**

Run: `npx tsx lib/surveys/campaign.test.ts`
Expected: `campaign tests passed`.

- [ ] **Step 4: Write and RED-run public-flow static test**

Assert awaited route params, 64 KiB content-length/body checks, no auth requirement on public route, HttpOnly/Secure/SameSite cookie, idempotency, token/server validation, QR generation, mobile labels/inputMode, `role="alert"`, disabled submit, retry reuse, and dedicated terminal states.

Run: `npx tsx scripts/satisfaction-public-flow.test.ts`
Expected: FAIL because routes/components do not exist.

- [ ] **Step 5: Implement campaign/public vertical slice**

Use `qrcode.toDataURL` for staff preview/download. Public page is a Server Component with awaited token params and safe initial fetch through server query/helper; interactive answers remain in `PublicSurveyForm`. Public POST calls only the restricted transactional RPC after TypeScript validation.

- [ ] **Step 6: Verify public flow and typecheck**

Run: `npx tsx lib/surveys/campaign.test.ts; npx tsx scripts/satisfaction-public-flow.test.ts; npx tsc --noEmit`
Expected: passed messages and zero type errors.

- [ ] **Step 7: Commit Task 4**

```bash
git add package.json package-lock.json lib/surveys app/api/admin/satisfaction/campaigns app/api/satisfaction app/s components/satisfaction scripts/satisfaction-public-flow.test.ts
git commit -m "feat: collect anonymous satisfaction responses"
```

### Task 5: Aggregates, charts, Realtime refetch, and controlled comments

**Files:**
- Create: `lib/surveys/aggregates.ts`
- Create: `lib/surveys/aggregates.test.ts`
- Create: `lib/hooks/useSurveyRealtime.ts`
- Create: `app/api/admin/satisfaction/dashboard/route.ts`
- Create: `app/api/admin/satisfaction/comments/route.ts`
- Create: `app/api/admin/satisfaction/comments/[answerId]/route.ts`
- Create: `components/satisfaction/SatisfactionDashboard.tsx`
- Create: `components/satisfaction/SatisfactionCharts.tsx`
- Create: `components/satisfaction/SurveyComments.tsx`
- Create: `scripts/satisfaction-dashboard.test.ts`

**Interfaces:**
- `aggregateSurveyResults(definition, rows): SurveyDashboardData` with overall, sections, questions, distribution, trend, and demographics.
- Dashboard GET accepts survey/campaign/fiscal-year/date filters.
- Comments GET requires module view; PATCH read state requires Admin/Manager; export is added in Task 6 with the same role guard.

- [ ] **Step 1: Write and RED-run aggregate tests**

Test normalized and positive results, optional omissions, section/question rankings, five-bin distribution, daily/monthly grouping, and unscored demographic counts.

Run: `npx tsx lib/surveys/aggregates.test.ts`
Expected: FAIL because aggregate helper does not exist.

- [ ] **Step 2: Implement aggregates and verify GREEN**

Run: `npx tsx lib/surveys/aggregates.test.ts`
Expected: `aggregate tests passed`.

- [ ] **Step 3: Write and RED-run dashboard contract test**

Assert Recharts line/horizontal bar/stacked distribution, numeric labels/table alternatives, event-table-only subscription filtered by campaign, refetch callback, comment view/edit role split, no comment edit/delete, responsive styles, focus/aria behavior, and reduced-motion CSS.

Run: `npx tsx scripts/satisfaction-dashboard.test.ts`
Expected: FAIL because dashboard files do not exist.

- [ ] **Step 4: Implement dashboard and comments**

Fetch aggregate data from server APIs; never fetch the entire raw answer set in a client. Subscribe only to `survey_response_events` inserts and refetch. Render chart value labels and a compact accessible table under each visualization. Enforce comment role rules in API and UI.

- [ ] **Step 5: Verify dashboard and typecheck**

Run: `npx tsx lib/surveys/aggregates.test.ts; npx tsx scripts/satisfaction-dashboard.test.ts; npx tsc --noEmit`
Expected: passed messages and zero type errors.

- [ ] **Step 6: Commit Task 5**

```bash
git add lib/surveys lib/hooks app/api/admin/satisfaction components/satisfaction scripts/satisfaction-dashboard.test.ts
git commit -m "feat: add live satisfaction analytics"
```

### Task 6: Annual Excel/PDF exports, KPI publication, and audit labels

**Files:**
- Create: `lib/surveys/report.ts`
- Create: `lib/surveys/report.test.ts`
- Create: `app/api/admin/satisfaction/reports/route.ts`
- Create: `app/api/admin/satisfaction/comments/export/route.ts`
- Create: `app/api/admin/satisfaction/campaigns/[campaignId]/publish-kpi/route.ts`
- Create: `components/satisfaction/SatisfactionExportActions.tsx`
- Modify: `app/(protected)/staff/activity/ActivityClient.tsx`
- Create: `scripts/satisfaction-reporting.test.ts`

**Interfaces:**
- `buildAnnualReportModel(input): AnnualSurveyReport` contains form/version/period/formula/counts/overall/sections/distribution/comparison/comments metadata.
- General score exports require module view. Comment export requires Admin/Manager. KPI publication requires survey edit plus KPI edit and a closed campaign.

- [ ] **Step 1: Write and RED-run report-model tests**

Cover report metadata, formula text, prior-year absence/presence, Thai fiscal year, and comment inclusion flag.

Run: `npx tsx lib/surveys/report.test.ts`
Expected: FAIL because report helper does not exist.

- [ ] **Step 2: Implement report model and verify GREEN**

Run: `npx tsx lib/surveys/report.test.ts`
Expected: `report tests passed`.

- [ ] **Step 3: Write and RED-run reporting contract test**

Assert XLSX export, HTML Blob print export with formula/version/counts, Admin/Manager comment export guard, double-permission KPI guard, closed-campaign/collision checks, immutable `survey_kpi_publications`, audit writes without comment content, and activity labels.

Run: `npx tsx scripts/satisfaction-reporting.test.ts`
Expected: FAIL because reporting files do not exist.

- [ ] **Step 4: Implement exports and KPI publication**

Use existing `xlsx`; generate printable HTML with the project Thai font stack. General reports omit comments unless the API confirms Admin/Manager and explicit `includeComments=true`. KPI route calculates server-side, inserts publication first in a transaction, blocks existing unrelated metric/year rows, writes `kpi_satisfaction`, and audits source campaign/formula/counts without raw answers.

- [ ] **Step 5: Verify reporting and typecheck**

Run: `npx tsx lib/surveys/report.test.ts; npx tsx scripts/satisfaction-reporting.test.ts; npx tsc --noEmit`
Expected: passed messages and zero type errors.

- [ ] **Step 6: Commit Task 6**

```bash
git add lib/surveys app/api/admin/satisfaction components/satisfaction 'app/(protected)/staff/activity/ActivityClient.tsx' scripts/satisfaction-reporting.test.ts scripts/satisfaction-survey-module.sql
git commit -m "feat: report and publish satisfaction KPIs"
```

### Task 7: Security review, full verification, and responsive browser acceptance

**Files:**
- Modify as required by verification findings only
- Update: `README.md`
- Update: `CLAUDE.md`

- [ ] **Step 1: Run every focused test**

Run:

```powershell
npx tsx scripts/satisfaction-survey-module.test.ts
npx tsx lib/surveys/scoring.test.ts
npx tsx lib/surveys/validation.test.ts
npx tsx scripts/satisfaction-navigation.test.ts
npx tsx lib/surveys/definition.test.ts
npx tsx scripts/satisfaction-builder.test.ts
npx tsx lib/surveys/campaign.test.ts
npx tsx scripts/satisfaction-public-flow.test.ts
npx tsx lib/surveys/aggregates.test.ts
npx tsx scripts/satisfaction-dashboard.test.ts
npx tsx lib/surveys/report.test.ts
npx tsx scripts/satisfaction-reporting.test.ts
```

Expected: every script exits 0 with a passed message.

- [ ] **Step 2: Run Supabase static security inspection**

Confirm RLS on every table; no anon raw grants; function `search_path`; revoke/grant execution; indexed policy predicates; Realtime publication only for event table; immutable triggers; and no raw answer/comment in audit/event SQL.

- [ ] **Step 3: Run TypeScript and production build**

Run: `npx tsc --noEmit; npm run build`
Expected: both exit 0; build lists `/staff/satisfaction`, `/staff/satisfaction/[surveyId]`, `/s/[token]`, staff APIs, and public token API.

- [ ] **Step 4: Start dev server and perform browser acceptance**

Verify staff and public pages at 375, 768, 1024, and 1440 px; light/dark staff UI; keyboard-only builder/public flow; visible focus; labels; `aria-live`; no horizontal scroll; QR rendering; chart value/table alternatives; and reduced-motion behavior. Because SQL is not applied remotely without authorization, use a documented local/mock-safe state for layout verification and record that database-backed acceptance remains gated on applying `scripts/satisfaction-survey-module.sql`.

- [ ] **Step 5: Document setup and operational rules**

Add README/CLAUDE sections with SQL script path, routes, permission resource, anonymous model, comment role exception, KPI collision rule, Realtime event table, and the instruction not to expose/write raw tables from public clients.

- [ ] **Step 6: Re-run all changed-area tests, typecheck, and build after documentation/fixes**

Run the Step 1 suite, `npx tsc --noEmit`, and `npm run build` again. Expected: all exit 0.

- [ ] **Step 7: Commit Task 7**

```bash
git add README.md CLAUDE.md app components lib scripts package.json package-lock.json
git commit -m "docs: document satisfaction survey operations"
```

## Self-Review Coverage

- Architecture/domain/version/campaign lifecycle: Tasks 1, 3, 4
- Four supplied PDFs: Task 1 seed + SQL contract counts
- Staff builder/preview/UI rules: Tasks 2–3
- QR/public anonymous flow/security/idempotency: Task 4
- Dashboard/formulas/Realtime/comments role exception: Task 5
- Excel/PDF/KPI/audit: Task 6
- RLS/function/grants/advisors-ready checks/responsive acceptance/docs: Task 7

No task mutates the linked production Supabase project automatically; applying the SQL remains an explicit deployment action.
