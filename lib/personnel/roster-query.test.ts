import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('lib/queries/personnel.ts', 'utf8')
const rosterQuery = source.match(/export async function getStaffRoster\(\)[\s\S]+?\r?\n}\r?\n/)

assert.ok(rosterQuery, 'getStaffRoster query should exist')
assert.match(rosterQuery[0], /\.eq\('status', 'active'\)/, 'roster must exclude inactive profiles')
assert.match(rosterQuery[0], /\.is\('deleted_at', null\)/, 'roster must exclude soft-deleted profiles')

console.log('personnel roster query: all assertions passed')
