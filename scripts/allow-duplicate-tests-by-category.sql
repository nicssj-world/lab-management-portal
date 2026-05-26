-- Allow the same test code/name to exist in different categories.
-- Run this once in Supabase SQL Editor before importing duplicates across categories.

alter table tests drop constraint if exists tests_code_key;
drop index if exists tests_code_key;

create unique index if not exists tests_category_code_unique
  on tests (coalesce(category_id, ''), lower(trim(code)));

create index if not exists tests_category_name_idx
  on tests (coalesce(category_id, ''), lower(trim(th)));
