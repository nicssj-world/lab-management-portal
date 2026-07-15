import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const page = readFileSync(resolve('app/login/page.tsx'), 'utf8')

assert.match(page, /flexWrap: 'wrap'/, 'the login header should wrap instead of compressing its text')
assert.match(page, /flex: '1 1 180px', minWidth: 180/, 'the login title block should retain readable space')
assert.match(page, /aria-label="กลับสู่หน้าแรก"/, 'the home action should have an accessible purpose')
assert.match(page, /กลับหน้าแรก/, 'the home action should use a clear return label')
assert.match(page, /background: '#EFF6FF'/, 'the home action should be visually distinct from plain text')
assert.doesNotMatch(page, /marginLeft: 'auto'/, 'the home action should not float alone under the logos')

console.log('Login header layout tests passed')
