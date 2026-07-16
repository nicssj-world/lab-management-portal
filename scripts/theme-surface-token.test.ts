import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const theme = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')
assert.match(theme, /:root\s*\{[\s\S]*?--surface:\s*var\(--card\);/, 'defines an opaque surface token from the card color')

console.log('theme surface token tests passed')
