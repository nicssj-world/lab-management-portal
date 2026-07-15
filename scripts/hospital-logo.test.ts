import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const componentPath = 'components/lab/HospitalLogo.tsx'

assert.ok(existsSync(componentPath), 'HospitalLogo must provide one shared web rendering for the hospital logo')

const source = readFileSync(componentPath, 'utf8')

assert.match(source, /const width = height \* 1\.5/, 'the hospital logo must retain its intrinsic 3:2 ratio')
assert.match(source, /src="\/images\/logo-chonburi\.png"/, 'HospitalLogo must own the approved hospital-logo source')
assert.match(source, /width=\{width\}/, 'HospitalLogo must supply the ratio-safe width to next/image')
assert.match(source, /height=\{height\}/, 'HospitalLogo must supply its requested display height to next/image')
assert.match(source, /unoptimized/, 'HospitalLogo must serve the source PNG without Next.js recompression')
assert.match(source, /objectFit: 'contain'/, 'HospitalLogo must preserve the whole mark without cropping')
assert.match(source, /flexShrink: 0/, 'HospitalLogo must not be compressed by surrounding navigation content')
assert.match(source, /alt="โรงพยาบาลชลบุรี"/, 'HospitalLogo must retain meaningful accessible text')

const sharedLogo = readFileSync('components/lab/Logo.tsx', 'utf8')
const loginPage = readFileSync('app/login/page.tsx', 'utf8')
const publicNav = readFileSync('components/layout/PublicNav.tsx', 'utf8')

assert.match(sharedLogo, /import \{ HospitalLogo \} from '@\/components\/lab\/HospitalLogo'/, 'the shared public logo row must use HospitalLogo')
assert.match(sharedLogo, /<HospitalLogo height=\{size\} preload \/>/, 'the public header and footer must use the caller-provided logo height')
assert.doesNotMatch(sharedLogo, /src="\/images\/logo-chonburi\.png"/, 'the shared public logo row must not bypass HospitalLogo')

assert.match(loginPage, /import \{ HospitalLogo \} from '@\/components\/lab\/HospitalLogo'/, 'the login page must use HospitalLogo')
assert.match(loginPage, /<HospitalLogo height=\{64\} preload \/>/, 'the login page must render the hospital logo at the existing 64px height')
assert.doesNotMatch(loginPage, /src="\/images\/logo-chonburi\.png"/, 'the login page must not bypass HospitalLogo')

assert.doesNotMatch(publicNav, /\.pub-logo-link img\s*\{[\s\S]*?width:\s*48px !important;[\s\S]*?height:\s*48px !important;/, 'the mobile header must not force both logos into a square')

console.log('hospital logo component tests passed')
