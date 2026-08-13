# Staff Satisfaction UI Redesign Design

## Status

Approved direction: Clinical Operations / Trustworthy Analytics

This design covers the complete staff satisfaction surface:

- `/staff/satisfaction`
- `/staff/satisfaction/surveys`
- `/staff/satisfaction/campaigns`
- `/staff/satisfaction/comments`
- `/staff/satisfaction/settings`
- `/staff/satisfaction/[surveyId]`

The existing survey builder and satisfaction survey product specification remain the functional source of truth. This document defines the visual and interaction refinement for the staff experience; it does not redefine survey data, permissions, or reporting formulas.

## Goal

Make the satisfaction module feel like a dependable clinical operations workspace: staff should understand the current collection status quickly, find the next action without searching, and complete survey administration tasks with clear feedback on desktop and mobile.

The redesign should improve:

- information hierarchy across all module pages;
- consistency between cards, tables, tabs, dialogs, forms, and status badges;
- visibility of live/update/save/publish states;
- mobile usability for staff working from smaller screens;
- accessibility of controls, charts, tables, and asynchronous actions;
- confidence when a mutation succeeds, fails, or is temporarily busy.

## Product Context

Primary users are internal staff who administer satisfaction surveys, open collection rounds, monitor aggregate results, review comments, export reports, and maintain survey permissions. The module has two operating modes:

1. Operate — monitor active campaigns and act on drafts, rounds, comments, and reports.
2. Configure — build, version, publish, and assign access to controlled surveys.

The visual system should support both modes without making the builder feel like a separate product.

## Design Direction

### Clinical Operations / Trustworthy Analytics

Use the incumbent portal identity as the base rather than introducing a separate brand language:

- teal remains the primary action and trust color;
- blue is used for analytics and informational emphasis;
- green communicates healthy/open/success states;
- amber communicates draft, pending, or attention states;
- red is reserved for destructive actions and errors;
- neutral surfaces and borders carry most of the layout so color is not doing all the hierarchy work.

Use existing design tokens (`--primary`, `--primary-soft`, `--card`, `--surface`, `--surface-2`, `--border`, `--ink`, `--muted`, `--success`, and the existing danger/warning tokens) wherever available. Do not introduce a global font replacement or a new page-level color system.

Visual qualities:

- dense enough for operational work, with readable spacing and line height;
- calm, clinical, and precise rather than decorative;
- card edges and section dividers define grouping;
- one clear primary action per surface;
- status is conveyed by label, icon/dot, and color—not color alone;
- use the existing `Icon` component for interface icons; do not add emoji or ad-hoc icon glyphs.

## Shared Experience Architecture

Every staff satisfaction page uses the same vertical frame:

1. `PageHeader` with eyebrow, Thai title, supporting description, and the page-level primary action.
2. `ModuleSubnav` with the active route clearly selected and horizontally usable on narrow screens.
3. An optional context/status row for the current section, selected campaign, or draft state.
4. Content surfaces using a shared section-heading pattern.

The active page should be obvious from both the tab treatment and the page heading. The subnav must remain usable with keyboard focus and should not create a second competing visual hierarchy.

### Shared surface rules

- Use one card language for overview, lists, forms, and settings.
- Keep section headings aligned to the same left edge as their content.
- Use consistent title, helper, label, and table text sizes instead of one-off inline values.
- Keep controls at a minimum 44px touch target on mobile.
- Use a single primary button style and a predictable secondary/quiet/destructive hierarchy.
- Keep table row actions visible on hover/focus and discoverable on touch.
- Preserve existing portal border radius and shadow character; reduce decorative shadows where they compete with content.

### Shared state language

All asynchronous surfaces must define these states:

- Loading: skeletons preserve the final layout height; use a spinner only for short inline mutations.
- Empty: explain why there is no content and provide the next useful action when the user can act.
- Error: show a concise message, preserve existing data where possible, and provide Retry for recoverable reads.
- Success: show an inline confirmation or toast-like status near the changed object; do not rely only on a disabled button.
- Busy/disabled: disable the triggering control immediately, show progress text, and prevent duplicate submissions.
- Read-only: show the same content hierarchy with actions hidden or disabled and a concise permission explanation.
- Long content: wrap titles and prompts safely without causing horizontal page overflow.

Use `aria-live="polite"` for save, refresh, export, and mutation feedback. Use `role="alert"` for errors that require immediate attention. Respect `prefers-reduced-motion` for transitions, modal animations, and live refresh indicators.

## Page Designs

### 1. Overview — `/staff/satisfaction`

Purpose: answer “what is happening now?” and “what should I do next?” in one scan.

Layout order:

1. Header with the module description and `สร้างแบบสำรวจ` as the primary action for edit users.
2. Compact operational summary cards:
   - แบบสำรวจทั้งหมด;
   - รอบที่กำลังเปิด;
   - คำตอบสะสม.
3. A real-time results surface with:
   - selected campaign control;
   - explicit live/update hint;
   - aggregate metrics;
   - chart area with reserved height;
   - accessible data tables beneath or alongside charts.
4. Latest collection rounds table with clear status, response count, close date, and campaign context.

Summary cards should communicate a number, label, and short interpretation. The icon is supporting content, not the primary signal. The selected campaign and refresh state must be easy to find without scrolling through the charts.

If the current API does not expose a metric needed for a visual, do not fabricate it. Prefer the existing survey/campaign/dashboard data and add only a small, explicit read endpoint when a value is already part of the product contract.

Chart rules:

- retain line, question comparison, and 1–5 distribution views where they answer distinct questions;
- use semantic chart labels and visible values;
- keep the accessible table alternative in the DOM;
- show a clear no-data state instead of plotting a misleading zero-filled chart;
- keep chart containers stable while loading to avoid layout shift;
- keep tooltip and legend text readable in Thai.

### 2. Survey registry — `/staff/satisfaction/surveys`

Purpose: find a controlled form and understand whether it is editable, published, or archived.

The registry surface contains:

- title and helper text explaining version immutability;
- a clear empty state with `สร้างแบบสำรวจ` when the user can edit;
- desktop table columns for name/code, version, status, published date, and permission;
- a mobile card representation with the same information and a full-row or explicit `เปิดแบบสำรวจ` action;
- status badges with text and supporting visual indicator;
- a visible distinction between the survey identity and its current version.

Do not make the code or version look like a competing title. Long survey names should wrap to two or more lines safely. The entire row should not become an unlabeled click target; retain a clear accessible link/action.

### 3. Campaign manager — `/staff/satisfaction/campaigns`

Purpose: create and operate collection rounds with confidence.

The page is organized into:

1. A compact explanation of the round lifecycle.
2. A create-round panel that can open/close without shifting the rest of the page unexpectedly.
3. A campaign table/list with name, survey/version, state, responses/limit, dates, and actions.
4. QR/link actions with clear confirmation and download affordances.

Form treatment:

- group fields into “round identity,” “collection rules,” and “response limit” when the existing fields support those concepts;
- show required fields and validation near the field;
- keep the selected published survey visible after selection;
- preserve values after a failed request;
- disable the create button on submit and show progress text.

Campaign actions must make lifecycle state obvious:

- Draft: amber, action to open when valid;
- Open: green, action to close;
- Closed: neutral, no action that implies reopening;
- Delete: destructive and only available when the existing business rules allow it.

QR modal treatment:

- identify the campaign and survey above the QR image;
- give Copy link and Download PNG clear labels;
- provide copy/download success feedback;
- ensure the image has an accessible label and a stable size;
- close with Escape and restore focus to the triggering control.

### 4. Comments — `/staff/satisfaction/comments`

Purpose: find and process qualitative feedback without losing context.

The top of the page contains a filter toolbar with:

- search;
- survey;
- campaign;
- read status;
- result count or active-filter summary.

On desktop, filters form a balanced toolbar. On mobile, they stack in a predictable order and remain usable without horizontal scrolling.

Each comment item presents:

- new/read state using text and a visual marker;
- survey and campaign context;
- submission time;
- question prompt;
- original comment text with safe wrapping;
- mark-read/manage action only for permitted roles.

Loading should use comment-card skeletons. Empty states should distinguish “no comments exist” from “filters returned no comments.” A failed filter request should preserve the last successful list when practical and provide Retry. Mark-read must show a busy state for the individual item and prevent rapid duplicate requests.

### 5. Settings — `/staff/satisfaction/settings`

Purpose: make administration ownership and permission scope understandable.

Keep the existing editor assignment workflow, but present it as a settings card with:

- a short explanation of what satisfaction editors can manage;
- a clear Admin-only note;
- the current assignee list and picker;
- save status and error placement near the affected control;
- an explicit read-only/permission state if the route is ever rendered without edit authority.

Avoid presenting permissions as an unexplained form field. The user should understand the effect of changing an editor before saving.

### 6. Survey builder — `/staff/satisfaction/[surveyId]`

Purpose: build a valid controlled survey draft and publish it safely.

The builder remains a focused two-column workspace:

- top toolbar: back, survey identity, version/status, Preview, Clone, discard/cancel, and Publish;
- main column: survey metadata, sections, and ordered question cards;
- side rail: readiness/preflight checklist and contextual validation summary.

Builder hierarchy:

1. Draft/save/publish status is always visible in the toolbar.
2. Survey title and description are clearly separate from question editing.
3. Section headers use stable numbering and accessible reorder/delete controls.
4. Question cards show type, required state, prompt, options, and controls with consistent grouping.
5. Validation errors link or scroll to the specific invalid section/question.

Interaction rules:

- preserve the current debounced save behavior and make saving/saved/error states visually distinct;
- disable publish while validation or a publish request is in progress;
- keep the draft intact after any failed save/publish request;
- make destructive discard/delete actions explicit and confirmable;
- use accessible up/down reorder controls as the primary mechanism;
- keep the preview in the same visual language as the public renderer while clearly indicating preview mode.

Responsive behavior:

- at desktop widths, retain the editor/rail relationship;
- at tablet widths, reduce rail width and preserve editor readability;
- at mobile widths, stack the rail below the editor and keep the primary publish action reachable;
- avoid horizontal scrolling for question fields and option controls;
- keep sticky elements from covering focused fields or dialog content.

## Responsive Behavior

Validate at 375px, 768px, 1024px, and 1440px widths.

At 375px:

- no page-level horizontal overflow;
- header actions wrap or become full-width without clipping;
- tabs remain horizontally scrollable with visible focus;
- summary cards stack;
- tables switch to cards or a deliberate contained scroll region with the row label still understandable;
- dialogs fit within the viewport and keep primary/secondary actions reachable.

At 768px:

- use two-column form/chart layouts only when each column remains readable;
- allow table density to reduce before switching representation;
- keep builder rail visible only when it does not compress the editor below a usable width.

At 1024px and above:

- use the data-dense dashboard layout;
- align cards and table surfaces to a shared content grid;
- keep primary actions in the page header or surface header rather than scattering them through content.

## Accessibility Requirements

- Preserve a logical heading hierarchy on every route.
- Give tables captions or accessible labels and identify the row-level action.
- Ensure every input/select has a visible label or equivalent accessible name.
- Maintain visible `:focus-visible` styling with sufficient contrast.
- Do not communicate status by color alone.
- Use at least 44px interactive targets on touch layouts.
- Give charts a concise summary and retain an accessible tabular alternative.
- Announce async save, refresh, export, and mutation states.
- Ensure dialogs trap focus, close with Escape where appropriate, and return focus to the trigger.
- Respect reduced-motion preferences.
- Verify text remains readable when browser text is increased and when titles/prompts are long.

## Technical Boundaries

Keep the following unchanged unless implementation verification proves a UI defect requires a narrowly scoped contract adjustment:

- API routes and Supabase data model;
- permission levels and role restrictions;
- survey scoring/reporting formulas;
- anonymous response behavior;
- route protection and redirects;
- existing shared UI component contracts.

Implementation should prefer shared classes or small local components over large inline style strings. Reuse the existing `PageHeader`, `ModuleSubnav`, `Card`, `Button`, `Badge`, `EmptyState`, `Icon`, and spinner/loading primitives. Do not add a new charting library or a new global design system for this refinement.

Read-only users must continue to see the same useful data without mutation controls. Admin-only settings behavior and comment management restrictions remain enforced server-side; the UI only reflects those permissions.

## Verification and Acceptance

### Automated checks

- `npx tsc --noEmit`
- focused UI contract/static checks for all satisfaction routes and shared state labels;
- `git diff --check`;
- production build using the repository's existing build command.

### Manual checks

- Navigate through every staff satisfaction route and confirm the active subnav state.
- Test overview with no surveys, no campaigns, an open campaign, and dashboard API failure.
- Test surveys with long names, no surveys, draft, published, and read-only rows.
- Create a campaign, trigger validation failure, create successfully, open/close it, and exercise QR copy/download feedback.
- Filter comments, see no-result vs no-data states, retry a failed load, and mark one comment read without duplicate requests.
- Review settings as Admin and as a non-Admin.
- Edit a draft, observe autosave states, create validation errors, preview, and publish from desktop and mobile widths.
- Confirm buttons cannot be double-submitted during create, save, publish, mark-read, export, and QR actions.
- Confirm keyboard focus, Escape behavior for dialogs, chart table alternatives, and reduced-motion behavior.
- Confirm no page-level horizontal overflow at 375px.

## Implementation Sequence

1. Read the incumbent visual implementation and `craft-floor.md`; extract shared satisfaction layout/state classes without changing behavior.
2. Establish the shared module frame, status language, responsive rules, and common section/table/card patterns.
3. Refine overview and dashboard states, including chart/table presentation and live refresh feedback.
4. Refine surveys, campaigns, QR modal, and create-round interaction states.
5. Refine comments and settings, including loading/empty/error/permission states.
6. Refine the survey builder toolbar, editor cards, preflight rail, and responsive behavior.
7. Run focused tests, type-check, build, and manual viewport/state verification.

Each step should preserve the existing functional contract and leave the module usable before moving to the next surface.

## Self-review Checklist

- The scope includes every requested staff satisfaction page and the survey builder.
- The recommended direction preserves the incumbent portal identity and avoids an unnecessary global redesign.
- The design covers loading, empty, error, success, disabled, read-only, long-content, responsive, and reduced-motion states.
- The design does not introduce unsupported metrics or change backend behavior by assumption.
- The design includes keyboard, screen-reader, touch-target, modal, chart, and table requirements.
- The implementation sequence is ordered from shared foundations to page-specific refinement.
- Existing satisfaction product and builder behavior remains the functional source of truth.
