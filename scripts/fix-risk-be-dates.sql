-- One-time repair for risk/risk_actions dates that were stored with the wrong era or century
-- before the parseSmartRmDate/normalizeIsoDate fix (BE→CE conversion + 2-digit-year handling).
--
-- Run each step manually in the Supabase SQL Editor, in order. STEP 1 and STEP 4 are read-only
-- previews — always look at them before running the UPDATE in STEP 2/3. Do not run this against
-- data you have not reviewed; it edits existing compliance records.

-- STEP 1: preview suspect rows (any date column outside a plausible 1990–2049 range)
select id, risk_no, external_no, event_date, recorded_date, due_date, follow_up_date
from risks
where extract(year from event_date) not between 1990 and 2049
   or extract(year from recorded_date) not between 1990 and 2049
   or extract(year from due_date) not between 1990 and 2049
   or extract(year from follow_up_date) not between 1990 and 2049;

select id, risk_id, due_date, follow_up_date, next_follow_up_date
from risk_actions
where extract(year from due_date) not between 1990 and 2049
   or extract(year from follow_up_date) not between 1990 and 2049
   or extract(year from next_follow_up_date) not between 1990 and 2049;

-- STEP 2: year stored as literal BE (e.g. 2569 instead of 2026) — subtract 543
-- make_date will error on a mismatched Feb 29 row rather than silently corrupt it; if that
-- happens, fix that single row by hand and re-run.
update risks set event_date = make_date(extract(year from event_date)::int - 543, extract(month from event_date)::int, extract(day from event_date)::int)
where extract(year from event_date) > 2400;
update risks set recorded_date = make_date(extract(year from recorded_date)::int - 543, extract(month from recorded_date)::int, extract(day from recorded_date)::int)
where extract(year from recorded_date) > 2400;
update risks set due_date = make_date(extract(year from due_date)::int - 543, extract(month from due_date)::int, extract(day from due_date)::int)
where extract(year from due_date) > 2400;
update risks set follow_up_date = make_date(extract(year from follow_up_date)::int - 543, extract(month from follow_up_date)::int, extract(day from follow_up_date)::int)
where extract(year from follow_up_date) > 2400;

update risk_actions set due_date = make_date(extract(year from due_date)::int - 543, extract(month from due_date)::int, extract(day from due_date)::int)
where extract(year from due_date) > 2400;
update risk_actions set follow_up_date = make_date(extract(year from follow_up_date)::int - 543, extract(month from follow_up_date)::int, extract(day from follow_up_date)::int)
where extract(year from follow_up_date) > 2400;
update risk_actions set next_follow_up_date = make_date(extract(year from next_follow_up_date)::int - 543, extract(month from next_follow_up_date)::int, extract(day from next_follow_up_date)::int)
where extract(year from next_follow_up_date) > 2400;

-- STEP 3: 2-digit year misread as "2000+yy" instead of BE 25yy (e.g. "68" stored as 2068
-- instead of 2025) — subtract 43. Scoped to 2050–2110 so it can't touch already-correct rows.
update risks set event_date = make_date(extract(year from event_date)::int - 43, extract(month from event_date)::int, extract(day from event_date)::int)
where extract(year from event_date) between 2050 and 2110;
update risks set recorded_date = make_date(extract(year from recorded_date)::int - 43, extract(month from recorded_date)::int, extract(day from recorded_date)::int)
where extract(year from recorded_date) between 2050 and 2110;
update risks set due_date = make_date(extract(year from due_date)::int - 43, extract(month from due_date)::int, extract(day from due_date)::int)
where extract(year from due_date) between 2050 and 2110;
update risks set follow_up_date = make_date(extract(year from follow_up_date)::int - 43, extract(month from follow_up_date)::int, extract(day from follow_up_date)::int)
where extract(year from follow_up_date) between 2050 and 2110;

update risk_actions set due_date = make_date(extract(year from due_date)::int - 43, extract(month from due_date)::int, extract(day from due_date)::int)
where extract(year from due_date) between 2050 and 2110;
update risk_actions set follow_up_date = make_date(extract(year from follow_up_date)::int - 43, extract(month from follow_up_date)::int, extract(day from follow_up_date)::int)
where extract(year from follow_up_date) between 2050 and 2110;
update risk_actions set next_follow_up_date = make_date(extract(year from next_follow_up_date)::int - 43, extract(month from next_follow_up_date)::int, extract(day from next_follow_up_date)::int)
where extract(year from next_follow_up_date) between 2050 and 2110;

-- STEP 4a: anything still outside the plausible range after STEP 2/3 — needs manual fixing,
-- this script does not guess further.
select id, risk_no, external_no, event_date, recorded_date, due_date, follow_up_date
from risks
where extract(year from event_date) not between 1990 and 2049
   or extract(year from recorded_date) not between 1990 and 2049
   or extract(year from due_date) not between 1990 and 2049
   or extract(year from follow_up_date) not between 1990 and 2049;

-- STEP 4b: day/month swap suspects — rows where swapping day and month of event_date would
-- ALSO be a valid calendar date (e.g. stored as 13/07 when it should be 31/07, or vice versa).
-- These are genuinely ambiguous from the date value alone; cross-check against the source
-- document/SmartRM export by hand. Read-only — no update.
select id, risk_no, external_no, event_date,
  make_date(extract(year from event_date)::int, extract(day from event_date)::int, extract(month from event_date)::int) as swapped_candidate
from risks
where extract(day from event_date) <= 12
  and extract(day from event_date) <> extract(month from event_date)
  and extract(month from event_date) <= 12;
