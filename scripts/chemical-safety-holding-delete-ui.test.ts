import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const clientPath = 'components/chemical-safety/ChemicalSafetyHubClient.tsx'
const dialogPath = 'components/chemical-safety/HoldingDeleteImpactDialog.tsx'
const bulkDialogPath = 'components/chemical-safety/BulkHoldingDeleteImpactDialog.tsx'
assert.ok(existsSync(clientPath), `missing ${clientPath}`)
assert.ok(existsSync(dialogPath), `missing ${dialogPath}`)
assert.ok(existsSync(bulkDialogPath), `missing ${bulkDialogPath}`)

const client = readFileSync(clientPath, 'utf8')
const dialog = readFileSync(dialogPath, 'utf8')
const bulkDialog = readFileSync(bulkDialogPath, 'utf8')

assert.doesNotMatch(client, /entityType:\s*['"]holding_delete['"]/i, 'registry UI no longer submits the old delete request')
assert.match(client, /registry\/\$\{row\.holdingId\}\/delete|registry\/\$\{.*holdingId.*\}\/delete/i, 'registry UI calls the holding delete API')
assert.match(client, /router\.refresh\(\)/i, 'successful deletion refreshes registry and SDS data')
assert.match(client, /selectedHoldingIds/i, 'registry UI supports selecting multiple holdings')
assert.match(client, /เลือกเพื่อลบหลายรายการ/i, 'registry UI exposes the multi-delete entry point')
assert.match(client, /method:\s*'DELETE'/i, 'bulk deletion uses the permanent delete method')
assert.match(dialog, /sharedDependencies/i, 'impact dialog explains shared SDS references')
assert.match(dialog, /canDelete/i, 'impact dialog supports deleting while shared SDS is retained')
assert.match(dialog, /ย้อนคืนไม่ได้|ลบถาวร|ถาวร/i, 'impact dialog states that deletion is irreversible')
assert.match(dialog, /filesToKeep|เก็บไฟล์|อ้างอิง/i, 'impact dialog explains reused binary files')
assert.match(bulkDialog, /Promise\.all/i, 'bulk delete preflights every selected holding')
assert.match(bulkDialog, /การลบนี้ถาวรและย้อนคืนไม่ได้/i, 'bulk delete warns that deletion is irreversible')
assert.match(bulkDialog, /onConfirm/i, 'bulk delete provides a confirmation action')

console.log('chemical holding-delete UI contract passed')
