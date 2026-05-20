import { resolve4 } from 'node:dns/promises'
import pg from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'

const { Client } = pg

const sqlFile = process.argv[2]
if (!sqlFile) {
  console.error('Usage: node scripts/run-migration.mjs <sql-file>')
  process.exit(1)
}

const sql = readFileSync(join(process.cwd(), sqlFile), 'utf8')

const HOSTNAME = 'db.fslagsuorkcckvvtrmyi.supabase.co'

async function run() {
  // Resolve to IPv4 explicitly to avoid IPv6 timeout
  const [ipv4] = await resolve4(HOSTNAME)
  console.log(`▶ Connecting to ${ipv4} (${HOSTNAME}) …`)

  const client = new Client({
    host: ipv4, port: 5432, database: 'postgres',
    user: 'postgres', password: 'cLH4HyWz8Rh&VF8',
    ssl: { rejectUnauthorized: false },
  })

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
