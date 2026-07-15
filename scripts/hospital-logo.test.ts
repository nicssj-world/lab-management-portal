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

console.log('hospital logo component tests passed')
