# Document-set database rollout

Deploy the database migration before deploying the application code. The new
application reads `set_mode`, `set_draft_id`, and the upload lease columns on its
first request; deploying code first will make document-set requests fail.

Choose exactly one migration path:

- Fresh schema without the document-set feature: run `add-document-sets.sql`.
- Earlier document-set schema that already contains `document_links.link_kind`,
  the `documents.pending_file_*` columns, `document_attachments.ephemeral`, and
  both attachment natural-key unique indexes, but does not contain `set_mode`,
  `set_draft_id`, `document_set_uploads`, or lease columns: run
  `upgrade-document-sets-v2.sql`.

Do not run both scripts. Take a database backup first and run the selected script
as one deployment. The migration deliberately fails closed if a Published set
member has an active revision draft or if ownership/natural keys are ambiguous.
Resolve those rows manually and rerun; do not delete or auto-adopt drafts to make
the preflight pass.

After migration, verify the shape before deploying the application:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'document_links'
  AND column_name IN ('link_kind', 'set_mode', 'set_draft_id')
ORDER BY column_name;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'document_set_uploads'
  AND column_name IN (
    'claimed_at', 'expires_at', 'lease_expires_at', 'lease_kind', 'lease_token'
  )
ORDER BY column_name;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'uq_document_links_set_draft_id',
    'idx_document_set_uploads_expired_unclaimed',
    'idx_document_set_uploads_active_leases',
    'idx_document_set_uploads_claimed_retention'
  )
ORDER BY indexname;
```

Expected results are three `document_links` columns, five upload lifecycle
columns, and four indexes. Also confirm `document_set_uploads` is RLS-enabled and
that only `service_role` has table privileges.

Rollback is not a routine down migration: the application can create set
ownership and upload-ticket state immediately after deployment. If rollback is
required, stop writes, restore the pre-deployment backup, and deploy the previous
application version together. Dropping only columns or constraints can orphan
revision ownership and R2 cleanup tickets.
