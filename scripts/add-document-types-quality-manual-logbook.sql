-- Add Quality Manual (QM) and Log book (Lb) document types, remove the unused Record type.
-- Run manually in Supabase Dashboard > SQL Editor, one statement block at a time.

-- STEP 1: preview — confirm this returns exactly one row (QM-LAB-01) before running STEP 2.
select id, document_code, title, type
from documents
where type = 'Manual' and document_code ilike 'QM-%';

-- STEP 2: reclassify the existing Quality Manual document (QM-prefixed, was bucketed under
-- the generic Manual type before QM existed as its own type).
update documents
set type = 'QM'
where document_code = 'QM-LAB-01' and type = 'Manual';

-- STEP 3: confirm no documents are using the type being removed (expect 0 rows).
select id, document_code, title from documents where type = 'Record';

-- STEP 4: update the CHECK constraint — drop Record, add QM and Lb.
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;

ALTER TABLE documents
  ADD CONSTRAINT documents_type_check
  CHECK (type IN ('QP','WI','Form','Policy','Manual','QM','Reference','Card file','Lb','Others'));
