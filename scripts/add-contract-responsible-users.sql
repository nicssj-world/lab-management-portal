-- Contracts can have one or more responsible users who may log usage entries
-- for that contract even if their role does not have edit permission on สัญญา.
alter table contracts add column if not exists responsible_user_ids uuid[] default '{}'::uuid[];
