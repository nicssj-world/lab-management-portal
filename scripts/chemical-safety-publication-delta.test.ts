import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const repository = readFileSync(join(root, 'lib/chemical-safety/department-repository.ts'), 'utf8')
const migrations = readdirSync(join(root, 'supabase/migrations'))
  .filter(file => file.endsWith('.sql'))
  .map(file => readFileSync(join(root, 'supabase/migrations', file), 'utf8'))
  .join('\n')

assert.match(repository, /pendingCount/)
assert.match(repository, /last_published_at/)
assert.match(repository, /summarizeDepartmentPublication/)
assert.match(migrations, /ADD COLUMN IF NOT EXISTS last_published_at/i)
assert.match(migrations, /last_published_by/i)

console.log('chemical publication delta contract passed')
