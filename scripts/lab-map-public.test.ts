import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getPublicLabMapDTO } from '../lib/lab-map/public'

const helperSource = readFileSync('lib/lab-map/public.ts', 'utf8')
const pageSource = readFileSync('app/(public)/lab-map/[stationCode]/page.tsx', 'utf8')
const homeSource = readFileSync('app/(public)/page.tsx', 'utf8')
const navSource = readFileSync('components/layout/PublicNav.tsx', 'utf8')

assert.doesNotMatch(helperSource, /from ['"].*\/manifest['"]/)
assert.match(helperSource, /from ['"].*public-manifest['"]/)

assert.equal(getPublicLabMapDTO('missing-station'), null)
const officeMap = getPublicLabMapDTO('office')
assert.ok(officeMap)
assert.equal(officeMap.stationCode, 'office')
assert.ok(officeMap.routes.every((route) => route.fromStationCode === 'office'))

const serialized = JSON.stringify(officeMap)
assert.doesNotMatch(serialized, /BSL2|PCR|infectionClass|infectious|door-electrical-control|ห้องวินิจฉัยเชื้อ/i)
assert.doesNotMatch(serialized, /personnel|profileId|checkout_secret/i)

assert.match(pageSource, /await props\.params/)
assert.match(pageSource, /notFound\(\)/)
assert.match(pageSource, /LabMapShell/)
assert.match(pageSource, /allowedModes=\{\['overview', 'safety'\]\}/)

assert.match(homeSource, /href="\/lab-map\/office"/)
assert.doesNotMatch(homeSource, /<LabMapShell/)
assert.match(navSource, /href: '\/lab-map\/office'/)

console.log('lab map public projection passed')
