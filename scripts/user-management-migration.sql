-- User Management Schema Migration
-- Run in Supabase SQL Editor

-- 1. Extend profiles table
alter table profiles
  add column if not exists ephis_id  text,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists deleted_at timestamptz;

-- 2. Unique index on ephis_id (skip nulls)
create unique index if not exists profiles_ephis_id_key
  on profiles (ephis_id)
  where ephis_id is not null;

create index if not exists profiles_deleted_at_idx on profiles (deleted_at);
create index if not exists profiles_status_idx      on profiles (status);
create index if not exists profiles_role_idx        on profiles (role);

-- 3. Backfill ephis_id from auth.users email (e.g. "9495@cbh.go.th" → "9495")
update profiles p
set ephis_id = split_part(u.email, '@', 1)
from auth.users u
where u.id = p.id
  and p.ephis_id is null
  and u.email like '%@cbh.go.th';

-- 4. auto-update updated_at on row change
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- 5. RLS policies (add update/delete for admin)
drop policy if exists "profiles_admin_update" on profiles;
create policy "profiles_admin_update" on profiles
  for update using (
    (select role from profiles where id = auth.uid()) ilike 'admin'
  );

drop policy if exists "profiles_admin_delete" on profiles;
create policy "profiles_admin_delete" on profiles
  for delete using (
    (select role from profiles where id = auth.uid()) ilike 'admin'
  );

-- 6. audit_log — add ip + user_agent columns if missing
alter table audit_log
  add column if not exists ip_address text,
  add column if not exists user_agent text;
