import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const path = resolve('components/personnel/AuthorizationMultiSelect.tsx')
assert.equal(existsSync(path), true, 'multi-select component should exist')

const source = readFileSync(path, 'utf8')
assert.match(source, /type="checkbox"/)
assert.match(source, /aria-label=/)
assert.match(source, /value\.includes/)
