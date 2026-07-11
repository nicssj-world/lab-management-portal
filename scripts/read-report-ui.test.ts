import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/(protected)/staff/documents/read-report/ReadReportClient.tsx', 'utf8')
const ariaIndex = source.indexOf('aria-label="ดาวน์โหลด PDF สรุปการอ่าน"')
const buttonStart = source.lastIndexOf('<button', ariaIndex)
const buttonEnd = source.indexOf('</button>', ariaIndex)
const downloadButton = buttonStart >= 0 && buttonEnd >= 0 ? source.slice(buttonStart, buttonEnd + '</button>'.length) : ''

assert.doesNotMatch(downloadButton, /<span[^>]*>\s*ดาวน์โหลด PDF\s*<\/span>/, 'read report summary download button should stay icon-only')
assert.match(downloadButton, /width: 32/, 'read report summary download button should keep a clear icon-button target')
assert.match(downloadButton, /height: 32/, 'read report summary download button should keep a clear icon-button target')
assert.match(downloadButton, /background: 'var\(--primary-soft\)'/, 'read report summary download button should use a visible soft primary background')
assert.match(downloadButton, /border: '1px solid rgba\(30,95,173,\.28\)'/, 'read report summary download button should have a visible border')

console.log('read-report UI tests passed')
