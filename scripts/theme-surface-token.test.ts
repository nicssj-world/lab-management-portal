import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const theme = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')
const satisfaction = readFileSync(resolve(process.cwd(), 'components/satisfaction/SatisfactionModule.tsx'), 'utf8')

assert.match(theme, /:root\s*\{[\s\S]*?--surface:\s*var\(--card\);/, 'defines an opaque surface token from the card color')
assert.ok(satisfaction.includes("background: 'var(--surface)'"), 'the creation dialog uses the shared opaque surface token')

console.log('theme surface token tests passed')
