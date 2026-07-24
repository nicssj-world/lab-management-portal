-- Competency exam (ข้อสอบสมรรถนะ) — self-contained, auto-graded from an answer key.
-- A section head authors an exam (multiple-choice / true-false with a correct-answer flag),
-- assigns it to staff, who log in and take it; the system grades against the key and
-- writes a staff_competencies record. Independent of the satisfaction survey engine.

create table if not exists public.competency_exams (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  -- definition: { "questions": [ { id, prompt, type: 'single_choice'|'yes_no',
  --                                options: [ { id, label, isCorrect } ] } ] }
  definition  jsonb not null default '{"questions":[]}'::jsonb,
  pass_mark   numeric not null default 60,   -- percentage required to pass
  active      boolean not null default true,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.exam_assignments (
  id            uuid primary key default gen_random_uuid(),
  exam_id       uuid not null references public.competency_exams(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  assigned_by   uuid references public.profiles(id),
  status        text not null default 'open' check (status in ('open', 'submitted', 'graded')),
  score         numeric,          -- percentage 0..100
  passed        boolean,
  answers       jsonb,            -- { "<questionId>": "<optionId>" }
  competency_id uuid references public.staff_competencies(id) on delete set null,
  assigned_at   timestamptz not null default now(),
  submitted_at  timestamptz,
  unique (exam_id, profile_id)
);
create index if not exists exam_assignments_profile on public.exam_assignments(profile_id);
create index if not exists exam_assignments_exam on public.exam_assignments(exam_id);

-- Access is via the service-role admin client only (mirrors the EQA module).
alter table public.competency_exams enable row level security;
alter table public.exam_assignments enable row level security;
