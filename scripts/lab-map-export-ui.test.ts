import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { isProtectedPath } from '../lib/auth/session-guard'
const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : ''
const page = read('app/(protected)/staff/lab-map/print/page.tsx')
const client = read('components/lab-map/LabMapExportClient.tsx')
const helper = read('lib/lab-map/export-client.ts')
const staffPage = read('app/(protected)/staff/lab-map/page.tsx')

assert.equal(isProtectedPath('/staff/lab-map/print'), true)
assert.ok(page.includes('getActor'))
assert.ok(page.includes("redirect('/login')"))
assert.ok(page.includes('buildMapPrintDTO'))
assert.ok(client.includes('ฉบับใช้งานจริง'))
assert.ok(client.includes('disabled={!dto.official') || client.includes('!dto.official'))
assert.ok(client.includes('ร่าง — ห้ามใช้ติดตั้ง') || page.includes('ร่าง — ห้ามใช้ติดตั้ง'))
assert.ok(helper.includes('document.fonts.ready'))
assert.ok(helper.includes("import('html2canvas')"))
assert.ok(helper.includes("import('jspdf')"))
assert.ok(helper.includes('A3.pdf') || helper.includes('paperSize'))
assert.ok(staffPage.includes('/staff/lab-map/print'))
console.log('lab map export UI contract passed')
