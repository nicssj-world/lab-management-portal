-- Lets admins fine-tune the focal point of an org chart node photo
-- (CSS object-position value, e.g. '50% 30%'). Null falls back to center.
alter table org_chart_nodes add column if not exists photo_position text;
