import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const loginPage = readFileSync('app/login/page.tsx', 'utf8')
const labLogoImages = [...loginPage.matchAll(/<Image\s+src="\/images\/cbh-lab-logo-v3\.png"[\s\S]*?\/>/g)].map(match => match[0])

assert.equal(labLogoImages.length, 2, 'the login page must render both CBH Lab logo placements')
assert.match(labLogoImages[0], /sizes="64px"/, 'the login-header logo must offer high-resolution image candidates')
assert.match(labLogoImages[1], /sizes="140px"/, 'the login-panel logo must offer high-resolution image candidates')

console.log('login logo rendering tests passed')
