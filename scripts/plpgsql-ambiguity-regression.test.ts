import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migrationsDir = join(root, 'supabase', 'migrations')
const repairMigrations = new Set([
  '20260827044612_chemical_department_review_variable_ambiguity.sql',
  '20260827044806_chemical_department_review_sds_product_id_ambiguity.sql',
])

const dangerousPatterns = [
  {
    name: 'chemical product_id local variable colliding with the product column',
    pattern: /\bproduct_id\s+uuid\s*;[\s\S]{0,12000}lower\(btrim\(product\.canonical_name\)\)\s*=\s*lower\(btrim\(canonical_name\)\)/i,
  },
  {
    name: 'chemical product_id local variable colliding in the SDS version lookup',
    pattern: /\bproduct_id\s+uuid\s*;[\s\S]{0,12000}version\.product_id\s*=\s*product_id(?:\s|[.)])/i,
  },
]

const filesToAudit = [
  ...readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql') && name.slice(0, 14) >= '20260827044612' && !repairMigrations.has(name))
    .map((name) => join(migrationsDir, name)),
  join(root, 'scripts', 'chemical-safety-department-registry.sql'),
]

for (const file of filesToAudit) {
  const sql = readFileSync(file, 'utf8')
  for (const { name, pattern } of dangerousPatterns) {
    assert.doesNotMatch(sql, pattern, `${file}: ${name}`)
  }
}

const productionAudit = readFileSync(join(root, 'scripts', 'plpgsql-production-audit.sql'), 'utf8')
assert.match(productionAudit, /plpgsql_check_function_tb/i)
assert.match(productionAudit, /unexpected_errors/i)

console.log('PL/pgSQL chemical ambiguity regression checks: ok')
