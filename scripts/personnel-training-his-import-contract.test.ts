import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const previewRoute = 'app/api/admin/personnel/training-import/preview/route.ts'
const commitRoute = 'app/api/admin/personnel/training-import/commit/route.ts'
const dialog = 'components/personnel/TrainingImportDialog.tsx'
const migration = 'scripts/personnel-training-his-import.sql'

for (const file of [previewRoute, commitRoute, dialog, migration]) {
  assert.equal(existsSync(file), true, `HIS training import artifact exists: ${file}`)
}

const previewSource = readFileSync(previewRoute, 'utf8')
assert.ok(previewSource.includes('requirePersonnelEdit'), 'self preview checks profile ownership/edit permission')
assert.ok(previewSource.includes('requirePersonnelManage'), 'bulk preview is restricted to personnel managers')
assert.ok(previewSource.includes('request.formData()'), 'preview receives original workbook files as multipart data')

const commitSource = readFileSync(commitRoute, 'utf8')
assert.ok(commitSource.includes('requirePersonnelEdit'), 'self commit checks profile ownership/edit permission')
assert.ok(commitSource.includes('requirePersonnelManage'), 'bulk commit is restricted to personnel managers')
assert.ok(commitSource.includes('selectedKeys'), 'commit only inserts rows selected from preview')
assert.ok(commitSource.includes('source_record_id'), 'commit persists the HIS source record identifier')
assert.ok(commitSource.includes('audit_log'), 'commit records a privacy-safe batch audit entry')

const migrationSource = readFileSync(migration, 'utf8')
assert.ok(migrationSource.includes('staff_training_import_batches'), 'migration adds import batch provenance')
assert.ok(migrationSource.includes('source_record_id'), 'migration adds HIS source identity')
assert.ok(migrationSource.includes('UNIQUE'), 'migration enforces duplicate protection in the database')

const detailSource = readFileSync('app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx', 'utf8')
assert.ok(detailSource.includes('TrainingImportDialog'), 'training tab exposes self import')

const manageSource = readFileSync('app/(protected)/staff/personnel/manage/ManageClient.tsx', 'utf8')
assert.ok(manageSource.includes('TrainingImportDialog'), 'personnel management exposes bulk import')

console.log('personnel HIS training import contract tests passed')
