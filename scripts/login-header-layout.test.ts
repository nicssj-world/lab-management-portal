import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const page = readFileSync(resolve('app/login/page.tsx'), 'utf8')

assert.match(page, /flexWrap: 'wrap'/, 'the login header should wrap instead of compressing its text')
assert.match(page, /flex: '1 1 180px', minWidth: 180/, 'the login title block should retain readable space')
assert.match(page, /marginLeft: 'auto'/, 'the home action should align right after wrapping')

console.log('Login header layout tests passed')
