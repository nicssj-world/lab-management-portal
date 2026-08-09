BEGIN;

ALTER TABLE public.lab_map_assembly_points
  ADD COLUMN IF NOT EXISTS point_type text;

UPDATE public.lab_map_assembly_points
SET point_type = 'assembly'
WHERE point_type IS NULL;

ALTER TABLE public.lab_map_assembly_points
  ALTER COLUMN point_type SET DEFAULT 'assembly',
  ALTER COLUMN point_type SET NOT NULL;

ALTER TABLE public.lab_map_assembly_points
  DROP CONSTRAINT IF EXISTS assembly_point_type_check;

ALTER TABLE public.lab_map_assembly_points
  ADD CONSTRAINT assembly_point_type_check
  CHECK (point_type IN ('assembly', 'safe'));

NOTIFY pgrst, 'reload schema';
COMMIT;
