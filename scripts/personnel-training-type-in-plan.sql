-- MT-CBH Staff / Personnel Module — Training type: in-plan / out-of-plan
-- Replaces the old internal/external/CME/CPD classification with a simple
-- "อยู่ในแผนอบรมหรือไม่" flag. Run via Supabase Dashboard → SQL Editor. Safe to re-run.

ALTER TABLE staff_training DROP CONSTRAINT IF EXISTS staff_training_training_type_check;

-- Old values (internal/external/CME/CPD) don't map to the new classification; clear them.
UPDATE staff_training SET training_type = NULL WHERE training_type NOT IN ('in_plan', 'out_of_plan');

ALTER TABLE staff_training ADD CONSTRAINT staff_training_training_type_check CHECK (training_type IN ('in_plan', 'out_of_plan'));
