-- The quality-task calendar can display an occurrence by its explicit planned
-- date even when that date is outside the original recurrence period.
create index if not exists quality_task_instances_planned_date
  on public.quality_task_instances(planned_date);
