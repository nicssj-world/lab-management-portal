// Static SQL/route-shape checks only. Database conflict behavior requires an integration environment.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync('scripts/add-document-sets.sql', 'utf8')
const route = readFileSync('app/api/admin/documents/[id]/register-set/route.ts', 'utf8')

function section(source: string, start: string, end: string) {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from + start.length)
  assert.notEqual(from, -1, `missing section start: ${start}`)
  assert.notEqual(to, -1, `missing section end: ${end}`)
  return source.slice(from, to)
}

const originalStatements = [
  "ALTER TABLE document_links ADD COLUMN link_kind text NOT NULL DEFAULT 'related';",
  "ALTER TABLE document_links ADD CONSTRAINT document_links_link_kind_check CHECK (link_kind IN ('related','set'));",
  "CREATE INDEX idx_document_links_set ON document_links(document_id) WHERE link_kind = 'set';",
  'ALTER TABLE documents ADD COLUMN pending_file_url text;',
  'ALTER TABLE documents ADD COLUMN pending_file_name text;',
  'ALTER TABLE documents ADD COLUMN pending_file_size bigint;',
  'ALTER TABLE documents ADD COLUMN pending_file_mime text;',
  'ALTER TABLE document_attachments ADD COLUMN ephemeral boolean NOT NULL DEFAULT false;',
]
for (const statement of originalStatements) assert.ok(sql.includes(statement), `approved statement must remain intact: ${statement}`)

const attachmentPreflight = sql.indexOf('GROUP BY document_id, file_url')
const attachmentIndex = sql.indexOf('CREATE UNIQUE INDEX uq_document_attachments_document_file_url')
const draftPreflight = sql.indexOf('GROUP BY draft_id, file_url')
const draftIndex = sql.indexOf('CREATE UNIQUE INDEX uq_document_revision_draft_attachments_draft_file_url')
assert.ok(attachmentPreflight >= 0 && attachmentPreflight < attachmentIndex, 'attachment duplicate preflight must precede its unique index')
assert.ok(draftPreflight >= 0 && draftPreflight < draftIndex, 'draft attachment duplicate preflight must precede its unique index')
assert.match(sql, /RAISE EXCEPTION 'Cannot create uq_document_attachments_document_file_url/)
assert.match(sql, /RAISE EXCEPTION 'Cannot create uq_document_revision_draft_attachments_draft_file_url/)
assert.match(sql, /ON document_attachments\(document_id, file_url\)/)
assert.match(sql, /ON document_revision_draft_attachments\(draft_id, file_url\)/)
assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/i, 'migration preflight must never auto-delete data')

const setDraftPreflight = sql.indexOf('GROUP BY set_draft_id')
const setDraftIndex = sql.indexOf('CREATE UNIQUE INDEX uq_document_links_set_draft_id')
assert.ok(setDraftPreflight >= 0 && setDraftPreflight < setDraftIndex, 'set draft duplicate preflight must precede its unique index')
assert.match(sql, /ADD COLUMN set_mode text/)
assert.match(sql, /ADD COLUMN set_draft_id uuid REFERENCES document_revision_drafts\(id\)/)
assert.match(sql, /set_mode IN \('registered', 'linked', 'revision'\)/)
assert.match(sql, /set_mode = 'revision' AND set_draft_id IS NOT NULL/)
assert.match(sql, /CREATE TABLE document_set_uploads/)
assert.match(sql, /upload_kind IN \('register', 'attach', 'revise-existing'\)/)
assert.match(sql, /file_size >= 0 AND file_size <= 52428800/)
assert.match(sql, /ALTER TABLE document_set_uploads ENABLE ROW LEVEL SECURITY/)
assert.match(sql, /REVOKE ALL ON TABLE document_set_uploads FROM anon, authenticated/)
assert.doesNotMatch(sql, /CREATE POLICY[\s\S]*(?:anon|authenticated)/i)

const attachmentRoute = section(route, 'async function attachFile', 'async function reviseExisting')
const revisionRoute = section(route, 'async function reviseExisting', 'async function processItem')
assert.match(attachmentRoute, /findDocumentAttachment\(mainDocumentId, item\.file\.key\)/)
assert.match(attachmentRoute, /inserted\.error\?\.code === '23505'[\s\S]*findDocumentAttachment\(mainDocumentId, item\.file\.key\)/)
assert.match(revisionRoute, /inserted\.error\?\.code === '23505'[\s\S]*findDraftAttachment\(draft\.id, item\.file\.key\)/)
assert.doesNotMatch(route, /duplicates\.map|from\('document_attachments'\)\.delete|from\('document_revision_draft_attachments'\)\.delete/)
