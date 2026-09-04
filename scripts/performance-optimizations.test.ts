import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const satisfactionModule = read('components/satisfaction/SatisfactionModule.tsx')
const satisfactionExports = read('components/satisfaction/SatisfactionExportActions.tsx')
const contracts = read('app/(protected)/staff/contracts/ContractsClient.tsx')
const equipment = read('app/(protected)/staff/equipment/EquipmentClient.tsx')

assert.match(satisfactionModule, /dynamic\(\s*\(\) => import\('\.\/SatisfactionDashboard'\)/, 'overview dashboard is code split')
assert.match(satisfactionModule, /dynamic\(\s*\(\) => import\('\.\/CampaignManager'\)/, 'campaign manager is loaded on demand')
assert.match(satisfactionModule, /dynamic\(\s*\(\) => import\('\.\/SurveyComments'\)/, 'comments are loaded on demand')
assert.match(satisfactionModule, /dynamic\(\s*\(\) => import\('\.\/SatisfactionEditors'\)/, 'editor settings are loaded on demand')

assert.doesNotMatch(satisfactionExports, /import \* as XLSX from ['"]xlsx['"]/, 'satisfaction export does not load xlsx at module import time')
assert.match(satisfactionExports, /await import\(['"]xlsx['"]\)/, 'satisfaction export loads xlsx on export')
assert.doesNotMatch(contracts, /import \* as XLSX from ['"]xlsx['"]/, 'contract export does not load xlsx at module import time')
assert.match(contracts, /await import\(['"]xlsx['"]\)/, 'contract export loads xlsx on export')

assert.match(equipment, /initialListFetchPendingRef/, 'equipment tracks the server-hydrated first list')
assert.match(equipment, /initialListFetchPendingRef\.current\s*=\s*false/, 'equipment consumes the initial list only once')

console.log('performance optimization contract tests passed')
