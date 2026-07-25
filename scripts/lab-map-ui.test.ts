import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const canvas = readFileSync('components/lab-map/LabMapCanvas.tsx', 'utf8')
const shell = readFileSync('components/lab-map/LabMapShell.tsx', 'utf8')
const styles = readFileSync('components/lab-map/LabMapStyles.tsx', 'utf8')

assert.match(canvas, /^'use client'/)
assert.match(canvas, /<svg/)
assert.match(canvas, /data-space-code=/)
assert.match(canvas, /role="button"/)
assert.match(canvas, /tabIndex=/)
assert.match(canvas, /onKeyDown=/)
assert.match(canvas, /<pattern/)
assert.match(canvas, /aria-label=/)
assert.match(canvas, /resetView/)
assert.doesNotMatch(canvas, /from ['"]@\/lib\/lab-map\/manifest['"]/)

assert.match(shell, /aria-pressed=/)
assert.match(shell, /type="search"/)
assert.match(shell, /role="dialog"/)
assert.match(shell, /aria-modal=/)

assert.match(styles, /min-height:\s*44px/)
assert.match(styles, /min-width:\s*44px/)
assert.match(styles, /@media\s*\(max-width:\s*767px\)/)
assert.match(styles, /prefers-reduced-motion/)
assert.match(styles, /:focus-visible/)

console.log('lab map UI contract passed')
