-- Annual-review workflow (ISO 15189 8.3) + per-document read audience.
-- review_confirmed_*: set when a Reviewer/DCC/Admin confirms the annual review of a
-- Published QP/WI/Manual document; cleared when the bulk annual-review action bumps the
-- revision. read_audience_depts: which profile departments must read the document —
-- values follow profiles.dept (DEPARTMENTS in lib/validations/user-schema.ts);
-- NULL or empty array means the whole division (every active user).

alter table documents add column if not exists review_confirmed_at timestamptz;
alter table documents add column if not exists review_confirmed_by uuid references profiles(id) on delete set null;
alter table documents add column if not exists review_confirmed_by_name text;
alter table documents add column if not exists read_audience_depts text[];
-- last_reviewed_at: date of the most recent annual review (with or without change).
-- Persistent (unlike review_confirmed_at which is cleared after the bulk action) — used to
-- reset the review-due clock even when a review-only pass leaves edit_date untouched.
alter table documents add column if not exists last_reviewed_at date;

-- Allow history_source='review' for the annual review-only rows (Rev "-" entries recorded
-- by the bulk annual-review action) in addition to the existing workflow/backfill/legacy.
alter table document_revisions drop constraint if exists document_revisions_history_source_check;
alter table document_revisions add constraint document_revisions_history_source_check
  check (history_source in ('workflow','backfill','legacy','review'));

notify pgrst, 'reload schema';
