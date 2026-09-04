-- The legacy verification parser now uses the source-folder year without
-- surfacing the harmless year mismatch as a warning. Remove the same warning
-- from sampling runs that were imported before that behavior changed.

UPDATE public.it_verification_sampling_runs
SET warning = NULL
WHERE warning = 'แบบฟอร์มระบุปี พ.ศ. 2568 แต่ใช้ปี พ.ศ. 2569 ตามโฟลเดอร์ต้นทาง';
