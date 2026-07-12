-- Add Quality Manual (QM) and Log book (Lb) document types, remove the unused Record type.
-- Run manually in Supabase Dashboard > SQL Editor, one statement block at a time, IN ORDER —
-- the constraint update (STEP 2) must run before the data update (STEP 3), or STEP 3's
-- type='QM' will be rejected by the old CHECK constraint.

-- STEP 1: preview — confirm this returns exactly one row (QM-LAB-01) before running STEP 3.
select id, document_code, title, type
from documents
where type = 'Manual' and document_code ilike 'QM-%';

-- STEP 2: update the CHECK constraint first — drop Record, add QM and Lb.
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;

ALTER TABLE documents
  ADD CONSTRAINT documents_type_check
  CHECK (type IN ('QP','WI','Form','Policy','Manual','QM','Reference','Card file','Lb','Others'));

-- STEP 3: reclassify the existing Quality Manual document (QM-prefixed, was bucketed under
-- the generic Manual type before QM existed as its own type). Only valid now that STEP 2 ran.
update documents
set type = 'QM'
where document_code = 'QM-LAB-01' and type = 'Manual';

-- STEP 4: confirm no documents are using the type that was removed (expect 0 rows).
select id, document_code, title from documents where type = 'Record';
