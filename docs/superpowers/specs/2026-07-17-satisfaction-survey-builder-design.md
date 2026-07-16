# Satisfaction Survey Builder Design

## Goal

Add a constrained survey builder to the staff portal that lets authorized staff create, version, publish, and reuse satisfaction surveys; open anonymous collection campaigns with public QR links; monitor aggregate results in near real time; review comments under stricter role rules; export annual reports; and deliberately publish an approved annual result into the existing KPI satisfaction table.

The initial release digitizes these four controlled forms as ready-to-use published survey versions:

- `Fm-QP-LAB-09/01` — แบบสำรวจความพึงพอใจต่อการให้บริการ (เฉพาะบริการด่านหน้า)
- `Fm-QP-LAB-09/02` — แบบสำรวจความพึงพอใจต่อการให้บริการ (เฉพาะแพทย์/ทันตแพทย์ และพยาบาล)
- `Fm-QP-LAB-09/03` — แบบสำรวจความพึงพอใจต่อการให้บริการ (เฉพาะเจ้าหน้าที่ส่งตรวจ/เสมียนหอ)
- `Fm-QP-LAB-09/04` — แบบประเมินความพึงพอใจของผู้บริจาคโลหิต

## Product Boundary

This is a survey-specific builder, not a general Google Forms replacement. Version 1 supports the question patterns present in the four supplied forms and the lifecycle needed for controlled annual reporting.

Included:

- Blank survey creation and cloning from an existing survey/version
- Sections and ordered questions
- Six question types: `single_choice`, `short_text`, `number`, `rating_scale`, `long_text`, and `yes_no`
- Required questions, scored options, an “other” option with attached text, and optional detail text on a rating question
- Draft, preview, publish, version, archive, and campaign workflows
- Anonymous public forms, QR links, configurable collection periods, and optional one-response-per-device protection
- Aggregate dashboards, comments, annual Excel/PDF reports, and controlled KPI publication

Excluded:

- Conditional branching or skip logic
- File uploads from respondents
- Respondent login or identity verification
- Free-form formulas, custom themes, arbitrary page layouts, or collaborative editing
- Editing a published version in place
- Editing or deleting original response/comment text

## Architecture

Supabase remains the system of record for definitions, campaigns, responses, and answers. Next.js Route Handlers are the only application layer allowed to read public definitions or submit responses. Public browsers never write directly to Supabase. Vercel/Next.js hosts the staff UI, public form, APIs, aggregate queries, and exports.

The feature lives under existing protected and public route families:

- Staff module: `/staff/satisfaction`
- Public form: `/s/[token]`
- Staff APIs: `/api/admin/satisfaction/**`
- Public read/submit APIs: `/api/satisfaction/[token]/**`

`/staff/*` is already covered by `proxy.ts`, so the protected-route regex does not need a new root. `/s/[token]` intentionally remains outside that regex. Every API route still performs its own authentication, permission, token, and payload checks.

## Domain Model

### `surveys`

The durable identity of a controlled form.

- UUID primary key
- Unique controlled-form `code`
- Current display title and description
- Optional default KPI metric code
- `archived_at` instead of hard deletion after use
- Creator/updater IDs and timestamps

Archiving hides a survey from default lists but preserves every version, campaign, response, and report.

### `survey_versions`

An immutable published snapshot of the form definition.

- UUID primary key and `survey_id`
- Monotonic integer version number, unique within the survey
- Status: `draft`, `published`, or `retired`
- Snapshot title, introduction, anonymous notice, and completion message
- Publish actor/time
- At most one draft per survey

Draft versions can change. Published and retired versions cannot change. Editing a published form clones it into the next draft version while retaining stable question keys for cross-version comparisons.

### `survey_sections`

- UUID primary key and `survey_version_id`
- Title, optional description, and integer sort order

### `survey_questions`

- UUID row ID plus a stable `question_key` copied across cloned versions
- Section ID, prompt, optional help text, type, required flag, and sort order
- Optional placeholder, minimum/maximum number, and maximum text length
- `allow_detail_text` and `detail_label` for the `/01` “อื่น ๆ” scored row and similar future questions
- `is_comment` to distinguish reportable comments from short demographic/detail text
- Optional `positive_threshold_score` for positive-response reporting; rating questions default to 4

### `survey_question_options`

- UUID row ID plus stable option key
- Question ID, stored value, display label, optional numeric score, and sort order
- `allows_other_text` for an option that opens an attached text input

Demographic options have no score. Rating options have explicit scores, so Thai labels can differ while still mapping to 5–1.

### `survey_campaigns`

A collection round bound permanently to one published version.

- UUID primary key and `survey_version_id`
- Name, Buddhist fiscal year, open/close timestamps, and status: `draft`, `open`, or `closed`
- Opaque random public token, unique and non-sequential
- Response policy: `multiple` or `one_per_device`
- Optional response limit
- Optional KPI metric code overriding the survey default
- Creator/opener/closer IDs and timestamps

Only a published version can open a campaign. `closed` is terminal; another round is created by cloning the campaign settings. Rotating a token invalidates the old QR/link and is audited.

### `survey_responses`

One successful anonymous submission.

- UUID primary key and `campaign_id`
- Client-generated submission key, unique per campaign, for idempotent retry
- Submission timestamp

It contains no user ID, name, HN, permanent IP address, User-Agent, or comment content.

### `survey_answers`

Typed answer values tied to the exact published question row:

- Response ID and question ID
- Selected option ID, numeric value, text value, score, and optional detail/other text
- Comment read time/actor for questions flagged `is_comment`

Original answer values are immutable. Marking a comment read changes only its read metadata.

### `survey_response_devices`

Server-only duplicate-control records for campaigns configured as `one_per_device`:

- Campaign ID, one-way device hash, response ID, and creation time
- Unique campaign/device-hash pair

The browser receives a random HttpOnly, Secure, SameSite cookie. The database stores only a campaign-bound hash. This is a soft duplicate deterrent, not identity proof; clearing cookies or switching devices can bypass it.

### `survey_response_events`

A narrow Realtime notification table containing only campaign ID and event time. It contains no response ID, device hash, score, answer, or comment. Authorized staff subscribe to inserts and refetch server-computed aggregates.

### `survey_kpi_publications`

An immutable record of an approved KPI transfer:

- Campaign ID, metric code, fiscal year, normalized value, formula, valid-answer count, response count, actor, and publication time
- One publication per campaign

The application then writes the approved result to `kpi_satisfaction`. Existing historical rows are preserved. A conflicting metric/year row not already linked to the same publication blocks the operation instead of silently overwriting it.

## Version and Campaign Lifecycle

The normal workflow is:

`Create/clone survey → edit draft → preview → publish version → create campaign → open campaign → collect responses → close campaign → export/report → optionally publish KPI`

Rules:

- A survey can have only one active draft.
- Publishing requires at least one section and one valid question.
- Choice/rating questions require valid options; scored questions require numeric scores and a positive maximum.
- Published version content is immutable at the API and database layers.
- A campaign remains attached to its original published version forever.
- A campaign with responses cannot be deleted; it can only be closed and retained.
- Surveys and versions referenced by campaigns cannot be hard-deleted.
- Closing a campaign prevents new submissions and stabilizes its report.
- KPI publication is available only after closing the campaign.

## Builder and Staff Experience

### Module home

`/staff/satisfaction` uses four tabs:

1. Overview — active campaigns, response totals, normalized satisfaction, trend, and unread comment count
2. Surveys — all forms, current published version, draft state, and archive state
3. Campaigns — fiscal year, open/close state, QR/link, response count, and collection dates
4. Comments — comment answers filtered by survey, campaign, date, section, question, and read state

### Survey detail and builder

A survey detail view provides its dashboard, per-question results, version history, campaigns, and actions. The builder uses focused section/question cards rather than a free-form canvas:

- Add, remove, and reorder sections/questions/options
- Reorder with accessible up/down controls rather than drag-and-drop
- Configure required state, numeric/text bounds, option scores, “other” text, rating detail text, and comment classification
- Draft saving debounced by 600 ms with visible saving/saved/error status
- Preview through the same renderer used by the public form
- Publish validation with question-specific errors and navigation to the invalid item

New surveys start blank or clone an existing survey/version. Editing a published survey always creates a new draft version.

### Campaign controls

Opening a campaign produces:

- Public URL and QR preview
- Copy-link action and PNG QR download
- Open/close timestamps, fiscal year, response policy, optional response limit, and KPI mapping
- Close action and clone-settings action for the next round

## Public Form Experience

`/s/[token]` is mobile-first and does not use the staff shell. It displays the hospital/lab identity, form title, introduction, anonymous notice, and closing date.

All sections render as cards in one scrollable page. Rating questions use large labeled 1–5 controls rather than the dense paper table. Required validation appears beside the unanswered question. The respondent confirms anonymous submission, sees an in-progress state that disables duplicate clicks, and receives a terminal thank-you screen after success.

Distinct states are rendered for invalid token, not-yet-open, closed/expired, response-limit reached, already answered on this device, validation failure, transient server failure with retry, and successful submission.

## Initial Form Conversion

The four supplied PDFs are seeded as Published Version 1 with no campaign opened automatically.

- `/01`: sex, age band, service-payment type; 5-point service ratings grouped by process/staff/facilities; the “อื่น ๆ” rating uses optional detail text; final comment question
- `/02`: respondent profession and department/ward; nine 5-point ratings; final comment question
- `/03`: department/ward; six 5-point ratings; final comment question
- `/04`: sex, exact age, education, occupation, donation purpose/history; fifteen 5-point ratings grouped by place/staff/process; urgent-improvement comment; return-to-donate yes/no

The wording, ordering, section grouping, option labels, and score mapping follow the PDFs. Staff reviews them in the portal before creating the first campaign.

## Aggregation and Reporting

All aggregates are computed on the server from valid scored answers. Missing optional answers are excluded from both numerator and denominator.

Primary normalized satisfaction:

`sum(answer score) / sum(maximum score for each answered scored question) × 100`

Positive response rate:

`answers at or above the question positive threshold / valid scored answers × 100`

The normalized percentage is the primary dashboard/KPI value. Positive response rate is displayed as a supporting metric. Every report states the formula it uses.

Dashboard outputs:

- Valid response count
- Average score and normalized satisfaction
- Positive response rate and comment count
- Daily/monthly trend
- Section comparison
- 1–5 stacked distribution
- Highest/lowest-scoring questions
- Non-identifying demographic distributions
- Campaign and fiscal-year comparison

Filters include survey, campaign, fiscal year, date range, section, and permitted demographic fields.

Annual Excel and PDF reports include form/version, fiscal year and collection dates, response count, formula, overall and section results, score distributions, prior-year comparison when available, report generation time, and comments only when an Admin/Manager explicitly includes them.

## Realtime Behavior

Successful submission inserts a safe `survey_response_events` row in the same database transaction. Staff dashboards subscribe only to this event table. On an event for the displayed campaign, the client refetches aggregate APIs. Raw answers and comments are never subscribed or included in a Realtime payload.

## Permissions

Add `แบบสำรวจความพึงพอใจ` to `lib/permission-resources.ts`, sidebar navigation, topbar titles, default permission seeds, and the permission matrix.

- `none`: module hidden; server pages redirect; APIs return 403
- `view`: dashboards, forms/versions/campaigns, comments, and general score exports are read-only
- `edit`: create/edit drafts, publish versions, open/close campaigns, rotate tokens, and manage QR links
- Admin remains `edit` through the existing global override

Comment exception:

- Any module viewer can read, search, and filter comments.
- Only normalized roles `Admin` and `Manager` can mark comments read/unread or export comment content.
- No role can edit or delete original comment text.
- Server APIs enforce this role rule even when UI controls are hidden.

KPI publication requires both survey-module `edit` and KPI `edit` permissions because it mutates both domains.

## Public Submission Security

- Opaque campaign tokens contain 32 random bytes encoded for URLs and are non-sequential.
- Public clients never receive `service_role` credentials.
- Public definition and submission requests pass through server Route Handlers.
- Server validation confirms campaign state/time/limit, published-version membership, required answers, option ownership, numeric bounds, text limits, and the absence of unknown question IDs.
- Payload size and per-text limits are enforced before database work.
- Submission key uniqueness makes network retries idempotent.
- Response and answers are inserted in one database transaction.
- The transactional Postgres function is callable only by `service_role`: revoke `EXECUTE` from `PUBLIC`, `anon`, and `authenticated`, grant it explicitly to `service_role`, set a fixed safe `search_path`, and run Supabase database advisors.
- RLS is enabled on every table. `anon` receives no direct table access. Raw response/answer/device tables are server-only. The event-table select policy checks the survey resource permission before allowing Realtime subscription.
- No permanent IP/User-Agent tracking is introduced. Turnstile is deferred until observed spam justifies it.

Definition and submission limits:

- Maximum 20 sections per version, 200 questions per version, and 50 options per question
- Survey/form titles: 200 characters; section titles and question prompts: 500 characters
- Short text, option “other” text, and rating detail text: 500 characters each
- Long-text comments: 4,000 characters each
- Public submission JSON body: 64 KiB maximum
- Numeric answers must be finite and within the question's configured bounds; a number question cannot be published until both bounds are configured

Partial responses are not stored. A `survey_response` exists only after the complete validated response and all answers commit successfully.

## Audit Trail

Write `audit_log` events for survey/draft creation, draft updates, version publication, campaign creation/open/close, token rotation, comment export, report export, and KPI publication.

Do not copy response values, device hashes, or comment content into `audit_log`.

## Error Handling

Staff mutations return 401 for no session, 403 for permission/role failure, 409 for lifecycle/version/idempotency conflicts, and 422 for schema/definition validation failures. Client surfaces the server message without discarding the current draft.

Public submission maps invalid/not-open/closed/limit/duplicate/validation/transient states to dedicated user messages. A transient retry reuses the same submission key. A successful retry returns the original success response rather than inserting duplicates.

## Database Delivery

Follow the repository convention with a reviewable SQL script under `scripts/`, while using the installed Supabase CLI only through commands discovered with `--help`. Before committing schema changes:

1. Validate the SQL against the linked/local environment without exposing secrets.
2. Run Supabase database advisors and fix security/performance findings.
3. Verify RLS, grants, function execute permissions, constraints, and Realtime publication.
4. Keep the schema script and application interfaces in the same reviewed change.

Do not modify or repurpose the empty legacy `satisfaction_entries` table in this feature. Preserve it for a separately approved cleanup/migration decision. Preserve the existing 17 `kpi_satisfaction` rows.

## Verification and Acceptance

Automated verification follows repository reality: focused `npx tsx` scripts/tests plus type-check and production build.

- Static SQL assertions cover tables, unique/foreign/check constraints, RLS, grants/revokes, safe function configuration, permission defaults, and all four seeded form codes.
- Pure unit tests cover normalized scoring, positive-rate thresholds, missing answers, fiscal-year filtering, validation, cloning/stable keys, idempotency, and campaign lifecycle rules.
- Static UI/API contract tests cover route registration, sidebar/topbar/resource wiring, public no-auth access, staff guards, comment role guards, and no browser import of `supabaseAdmin`.
- Run `npx tsc --noEmit` after every TypeScript task.
- Run `npm run build` before completion.
- Run the Supabase advisors and a read-only schema/grant inspection after applying SQL.

Manual acceptance:

- Create a blank survey and clone an existing one.
- Build and preview every supported question type.
- Publish a valid draft and confirm it becomes immutable.
- Create/open a campaign and use its URL/QR on a mobile viewport without login.
- Confirm required validation, successful submission, duplicate-click protection, and idempotent retry.
- Confirm closed/not-open/invalid/limit/one-per-device states.
- Confirm Realtime aggregate refresh without raw-answer/comment payloads.
- Recalculate seeded test results by hand and match cards/charts.
- Confirm `view` users cannot mutate builders/campaigns.
- Confirm non-Admin/Manager users cannot mark or export comments.
- Confirm version changes do not alter old campaign reports.
- Confirm annual Excel/PDF metadata, formulas, counts, and optional comment inclusion.
- Confirm controlled KPI publication cannot overwrite the 17 historical rows and is fully audited.

## Delivery Sequence

1. Schema, RLS, transaction function, permission resource, TypeScript domain types, and four-form seed
2. Staff survey list/detail, constrained builder, cloning, preview, and version publication
3. Campaign management, QR generation, public renderer, anonymous submission, and duplicate protection
4. Aggregate APIs, Realtime refresh, dashboard charts, and role-restricted comment workflow
5. Excel/PDF annual reports, KPI publication, audit labels, security review, and end-to-end verification

Each stage must leave independently testable behavior and must not begin by refactoring unrelated modules.
