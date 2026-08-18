BEGIN;

-- Keep the scheduled safety workflow one-to-one: one quality task instance
-- owns one inspection round. The partial predicate preserves legacy ad-hoc
-- rounds whose links do not carry this source type.
create unique index if not exists quality_task_links_safety_task_instance_key
  on public.quality_task_links (instance_id)
  where integration_kind = 'safety_inspection'
    and source_type = 'lab_map_safety_inspection_round';

COMMIT;
