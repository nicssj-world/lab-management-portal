import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const module = read('components/satisfaction/SatisfactionModule.tsx')
const builder = read('components/satisfaction/SurveyBuilder.tsx')
const publicPage = read('app/s/[token]/page.tsx')

assert.ok(module.includes('.satisfaction-page{width:100%;max-width:none;margin:0'), 'staff satisfaction page fills its content area')
assert.ok(!module.includes('@media(min-width:1440px){.satisfaction-page{max-width:1440px;margin-inline:auto}}'), 'staff dashboard has no large-screen width cap')
assert.ok(builder.includes('.survey-builder-page{max-width:1180px;margin:0 auto}'), 'survey builder retains a readable centered width')
assert.ok(publicPage.includes('.public-survey-page-inner{width:min(760px,100%);margin:0 auto}'), 'public survey retains a focused centered width')

console.log('satisfaction responsive width tests passed')
