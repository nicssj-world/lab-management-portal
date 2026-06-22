# Lab Management Portal

Internal laboratory management portal for Chonburi Hospital. The app includes the staff portal, quality document control, test catalog, equipment, workload, TAT, risk/rejection, contracts, user/role management, and personnel modules.

## TAT Local Analysis Workflow

TAT source files are stored locally under `E:\TAT\<fiscal-year>`, for example `E:\TAT\2569`. Use the matching fiscal-year folder as new years are added.

Use local analysis as the source of truth for TAT dashboards. The local script publishes `analysis_summary_cache` only; raw `tat_records` and `phlebotomy_records` in Supabase are temporary staging data and can be removed after the cache is verified.

Example:

```powershell
npm run tat:local -- --tat "E:\TAT\2569\TAT 0169.txt" --phleb "E:\TAT\2569\Phe 0169.txt" --year 2026 --month 1
npm run tat:clean-raw -- --year 2026 --month 1 --dry-run
npm run tat:clean-raw -- --year 2026 --month 1 --yes
```

Fiscal year 2569 example mapping:

| File suffix | Month |
| --- | --- |
| `1068` | 2025-10 |
| `1168` | 2025-11 |
| `1268` | 2025-12 |
| `0169` | 2026-01 |
| `0269` | 2026-02 |
| `0369` | 2026-03 |
| `0469` | 2026-04 |
| `0569` | 2026-05 |

## Quality Document Workflow V2

Run the schema script before using the workflow in a real environment:

```sql
-- Supabase Dashboard -> SQL Editor
scripts/quality-document-workflow-v2.sql
```

### Core Rules

- `file_url` means the current official file.
- Word/Excel source uploads must never auto-promote into `file_url`.
- `Published` documents must not be edited directly for file/status/revision/date changes.
- Published content changes must create a working revision draft.
- Admin and Document Controller can correct small Published metadata. For QP/WI, cover-impacting metadata changes regenerate the final PDF and create an audit log.
- Signature uploads accept PNG/JPG/WebP up to 2 MB and are normalized to transparent PNG 900x260 before storage/stamping.

### QP/WI Flow

- QP and WI use the full workflow with system cover page and signature stamp.
- Reviewer creates Draft and can upload Word/Excel source only.
- Normal Draft workflow can be used for Rev.00 or Rev.>0 when the document should start from DOCX/XLSX and pass Draft -> Review -> Approved -> Published.
- Edit/Review date is the date the source draft is uploaded.
- DCC/Admin reviews the draft, uploads the content PDF without cover, then moves Draft -> Review.
- QP/WI Draft -> Review requires both the Word/Excel source file and the content PDF.
- For QP/WI Rev.>0 in normal Draft workflow, the later PDF upload must be the content PDF without the old cover; the system will generate the new cover at Published.
- Manager/Admin can move Review -> Approved; this sets approval date and approver.
- Only Quality Manager, Laboratory Director, and Admin can move Approved -> Published; this sets effective/published date, generates the cover page, merges cover + content PDF, and stores the generated final PDF as `file_url`.

### Legacy Import Flow Rev.>0

- Use this for existing controlled documents imported from Google Drive or an old system.
- Admin and Document Controller can choose "import current" when creating a document.
- The imported current revision is created as `Published` immediately and must include the current official file.
- QP/WI imports must use the existing official PDF that already has the old cover page.
- Imported QP/WI records set `legacy_cover_included = true`; the system does not regenerate or merge a new cover for that imported current file.
- Add old revision rows afterward as retroactive history/backfill.
- The next content change must use the working revision workflow; the next Published revision will use the new system cover.
- When a legacy-covered document is revised later, the old covered PDF is archived with the previous revision, imported-current markers are cleared from the current document, and the newly Published revision becomes a system-generated cover + content PDF.

### Form/Record/Reference/Card File Flow

- Non-cover document types still use status/revision/history.
- They do not generate a cover page and do not stamp signatures into files.
- Their official file can be PDF/DOC/DOCX/XLS/XLSX according to document type needs.

### Working Revisions

- Published documents are updated through "Create Revision" only.
- The system creates one active working revision draft per current document.
- When the draft is Published, the previous current version is archived into `document_revisions`, then the draft is promoted to the current document.
- Admin/Quality Manager/Laboratory Director can publish a QP/WI revision draft with "PDF already has a complete cover" checked. In that case the uploaded PDF becomes the official file directly, system cover generation is skipped, `legacy_cover_included` is set, and an audit log is written.
- Legacy revision rollback and direct workflow-history edits are intentionally blocked.

### Retroactive Revision History

- Old documents migrated from other systems can have retroactive history entries.
- Only Admin and Document Controller can add retroactive history.
- Retroactive entries use `document_revisions.history_source = 'backfill'`.
- Backfilled entries do not change the current document, `file_url`, status, or revision.
- Backfilled entries can be edited/deleted by Admin/Document Controller; workflow-generated revision history remains immutable.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
