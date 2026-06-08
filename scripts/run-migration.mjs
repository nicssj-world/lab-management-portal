import { resolve4 } from 'node:dns/promises'
import pg from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'
import { optionalEnv, requiredEnv } from './lib/env.mjs'

const { Client } = pg

const sqlFile = process.argv[2]
if (!sqlFile) {
  console.error('Usage: node scripts/run-migration.mjs <sql-file>')
  process.exit(1)
}

const sql = readFileSync(join(process.cwd(), sqlFile), 'utf8')

async function run() {
  const connectionString = optionalEnv('DATABASE_URL', 'POSTGRES_URL', 'SUPABASE_DB_URL')
  let clientConfig
  if (connectionString) {
    console.log('▶ Connecting with DATABASE_URL …')
    clientConfig = { connectionString, ssl: { rejectUnauthorized: false } }
  } else {
    const hostname = requiredEnv('SUPABASE_DB_HOST', 'POSTGRES_HOST')
    const useIpv4 = optionalEnv('SUPABASE_DB_RESOLVE_IPV4') !== '0'
    const host = useIpv4 ? (await resolve4(hostname))[0] : hostname
    console.log(`▶ Connecting to ${host} (${hostname}) …`)
    clientConfig = {
      host,
      port: Number(optionalEnv('SUPABASE_DB_PORT', 'POSTGRES_PORT') ?? 5432),
      database: optionalEnv('SUPABASE_DB_NAME', 'POSTGRES_DATABASE') ?? 'postgres',
      user: optionalEnv('SUPABASE_DB_USER', 'POSTGRES_USER') ?? 'postgres',
      password: requiredEnv('SUPABASE_DB_PASSWORD', 'POSTGRES_PASSWORD'),
      ssl: { rejectUnauthorized: false },
    }
  }

  const client = new Client(clientConfig)

  console.log(`▶ Running ${sqlFile} …`)
  await client.connect()
  try {
    await client.query(sql)
    console.log('✅ Migration สำเร็จ')
  } catch (err) {
    console.error('❌ Migration ล้มเหลว:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
