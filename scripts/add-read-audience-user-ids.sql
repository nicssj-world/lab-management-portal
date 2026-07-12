-- Per-person read audience: specific users who must read the document, in addition to
-- read_audience_depts. Audience = users in depts union users in this list.
-- NULL/empty + NULL/empty depts = whole division.
alter table documents add column if not exists read_audience_user_ids uuid[];
notify pgrst, 'reload schema';
