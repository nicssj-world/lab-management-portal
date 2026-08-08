import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const proxy = readFileSync('proxy.ts', 'utf8')

assert.match(
  proxy,
  /let response\s*=\s*NextResponse\.next\(\{\s*request\s*\}\)/,
  'the auth proxy must forward the current request when it creates its response',
)
assert.match(
  proxy,
  /setAll\s*:\s*\(cookiesToSet,\s*headers\)/,
  'the auth proxy must receive Supabase cache headers when it writes refreshed cookies',
)
assert.match(
  proxy,
  /request\.cookies\.set\(name,\s*value\)/,
  'refreshed cookies must be copied to the request before server components render',
)
assert.match(
  proxy,
  /response\s*=\s*NextResponse\.next\(\{\s*request\s*\}\)/,
  'the response must be rebuilt after the request cookie jar is updated',
)
assert.match(
  proxy,
  /Object\.entries\(headers\)[\s\S]*response\.headers\.set/,
  'Supabase cache headers must be preserved on refresh responses',
)
assert.match(
  proxy,
  /supabase\.auth\.getClaims\(\)/,
  'the proxy must use Supabase’s server-side claims check for session refresh',
)

console.log('scripts/auth-refresh-proxy.test.ts: all assertions passed')
