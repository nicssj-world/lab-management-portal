import { existsSync } from 'node:fs'
import { config } from 'dotenv'

for (const path of ['.env.local', '.env']) {
  if (existsSync(path)) config({ path, override: false })
}

export function optionalEnv(...names) {
  for (const name of names) {
    const value = process.env[name]
    if (value) return value
  }
  return undefined
}

export function requiredEnv(...names) {
  const value = optionalEnv(...names)
  if (value) return value
  throw new Error(`Missing required environment variable: ${names.join(' or ')}`)
}

export function getSupabaseServiceEnv() {
  return {
    url: requiredEnv('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
    serviceRoleKey: requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  }
}
