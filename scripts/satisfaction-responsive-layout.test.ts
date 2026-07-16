import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const module = readFileSync(resolve(process.cwd(), 'components/satisfaction/SatisfactionModule.tsx'), 'utf8')

assert.ok(module.includes('<main className="satisfaction-page" style={{ minWidth: 0 }}>'), 'uses CSS rather than fixed inline page padding')
assert.ok(module.includes('.satisfaction-page{width:100%;max-width:none;margin:0;padding:16px;box-sizing:border-box}'), 'fills the mobile viewport with a consistent 16px gutter')
assert.ok(module.includes('@media(min-width:768px){.satisfaction-page{padding:24px}}'), 'adds desktop spacing only from tablet width')
assert.ok(module.includes('@media(min-width:1440px){.satisfaction-page{max-width:1440px;margin-inline:auto}}'), 'centers dense dashboard content only on very wide screens')

console.log('satisfaction responsive layout tests passed')
