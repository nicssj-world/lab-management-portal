import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('proxy.ts', 'utf8')
const match = source.match(/const isProtected = (\/\^.*?\.test\(path\))/)
assert.ok(match, 'proxy exposes a protected-path regex')
const expression = match[1]
const isProtected = Function('path', `return ${expression}`) as (path: string) => boolean

assert.equal(isProtected('/staff/outlab'), true)
assert.equal(isProtected('/staff/eqa/programs/123'), true)
assert.equal(isProtected('/manual'), false)

console.log('scripts/external-quality-proxy.test.ts: all assertions passed')
