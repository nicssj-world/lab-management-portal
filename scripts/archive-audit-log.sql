-- Archive audit_log rows older than 1 year into a separate cold-storage table instead of
-- deleting them — audit_log is the QMS audit trail (ISO 15189 traceability), so old entries
-- should stay recoverable, just out of the hot table the Activity Log page queries.
--
-- Run manually in Supabase Dashboard > SQL Editor, one statement block at a time, in order.
-- This repo has no cron/job runner (see other scripts/*.sql) — re-run this script periodically
-- (e.g. once a year) as the table grows; it's safe to run repeatedly (no-ops on rows already
-- archived).

-- STEP 1: one-time setup — create the archive table (same shape as audit_log), enable RLS with
-- the same admin-read policy convention as every other table, and add an index on created_at
-- (speeds up this archive step and the Activity Log page's own "order by created_at desc").
create table if not exists audit_log_archive (
  id          bigint primary key,
  action      text not null,
  user_id     uuid references auth.users,
  target      text,
  detail      text,
  created_at  timestamptz
);
alter table audit_log_archive enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='audit_log_archive' and policyname='audit_log_archive_admin_read') then
    create policy "audit_log_archive_admin_read" on audit_log_archive for select using (
      (select role from profiles where id = auth.uid()) = 'admin'
    );
  end if;
end $$;

create index if not exists idx_audit_log_created_at on audit_log (created_at);

-- STEP 2: preview — how many rows are older than the 1-year cutoff and about to move.
select count(*) as rows_to_archive from audit_log where created_at < now() - interval '1 year';

-- STEP 3: move them (atomic — insert into archive, then delete from the live table).
begin;

insert into audit_log_archive (id, action, user_id, target, detail, created_at)
select id, action, user_id, target, detail, created_at
from audit_log
where created_at < now() - interval '1 year'
on conflict (id) do nothing;

delete from audit_log
where created_at < now() - interval '1 year';

commit;

-- STEP 4: confirm — live table should have 0 rows older than the cutoff now.
select count(*) as leftover_old_rows from audit_log where created_at < now() - interval '1 year';
