import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const css = read('app/globals.css')
const primitives = read('components/satisfaction/SatisfactionPrimitives.tsx')
const dialog = read('components/satisfaction/SatisfactionDialog.tsx')
const module = read('components/satisfaction/SatisfactionModule.tsx')

assert.match(css, /\.satisfaction-module(?:,\s*\.satisfaction-builder-page)?\s*\{/, 'shared satisfaction styles are scoped to the module')
assert.match(css, /\.satisfaction-builder-page\s*\{/, 'builder receives a shared visual root')
assert.match(css, /prefers-reduced-motion:\s*reduce/, 'satisfaction motion has a reduced-motion path')
assert.match(primitives, /export function SatisfactionStatusBadge/, 'status badge is shared')
assert.match(primitives, /export function SatisfactionSummaryCard/, 'summary card is shared')
assert.match(primitives, /aria-live="polite"/, 'shared async state is announced')
assert.match(dialog, /aria-modal="true"/, 'dialog is modal')
assert.match(dialog, /Escape/, 'dialog supports Escape close')
assert.match(module, /className="satisfaction-module satisfaction-page"/, 'staff module uses the scoped root')

console.log('satisfaction shared UI contract tests passed')
