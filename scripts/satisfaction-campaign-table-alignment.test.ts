import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'components/satisfaction/SatisfactionModule.tsx'), 'utf8')

assert.match(source, /satisfaction-campaign-table/, 'campaign table should have an isolated alignment hook')
assert.match(source, /\.satisfaction-campaign-table th:nth-child\(n\+3\),\.satisfaction-campaign-table td:nth-child\(n\+3\)\{text-align:center\}/, 'campaign status, response, and close-date columns should be centered')
assert.match(source, /className="satisfaction-status-cell"/, 'campaign status should use a dedicated centering wrapper')
assert.match(source, /\.satisfaction-status-cell\{display:flex;justify-content:center\}/, 'campaign status badge should be centered inside its cell')

console.log('satisfaction campaign table alignment checks passed')
