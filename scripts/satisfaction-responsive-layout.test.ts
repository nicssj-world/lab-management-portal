import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const module = readFileSync(resolve(process.cwd(), 'components/satisfaction/SatisfactionModule.tsx'), 'utf8')
const layout = readFileSync(resolve(process.cwd(), 'app/(protected)/layout.tsx'), 'utf8')

assert.ok(layout.includes('<main id="main-content"'), 'uses one semantic main landmark in the protected layout')
assert.ok(module.includes('<div className="satisfaction-page"'), 'uses a container rather than nesting a second main landmark')
assert.ok(module.includes('.satisfaction-page{width:100%;max-width:none;margin:0;padding:0;box-sizing:border-box}'), 'fills the available protected content width')
assert.ok(!module.includes('max-width:1440px'), 'does not cap dense dashboard content on wide screens')

console.log('satisfaction responsive layout tests passed')
