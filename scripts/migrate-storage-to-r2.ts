/**
 * Migration script: Supabase Storage → Cloudflare R2
 *
 * Migrates all files from the Supabase 'documents' bucket to R2,
 * preserving the same key paths so existing file_url values in the DB remain valid.
 *
 * Usage:
 *   npx tsx scripts/migrate-storage-to-r2.ts
 *
 * Prerequisites:
 *   - .env.local must have R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *   - npx tsx (or ts-node) installed: npm install -D tsx
 */

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})
const BUCKET = process.env.R2_BUCKET_NAME!

async function fileExistsInR2(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

async function listAllFiles(prefix: string): Promise<string[]> {
  const paths: string[] = []
  let offset = 0
  const limit = 100

  while (true) {
    const { data, error } = await supabase.storage
      .from('documents')
      .list(prefix, { limit, offset, sortBy: { column: 'name', order: 'asc' } })

    if (error) throw new Error(`Failed to list ${prefix}: ${error.message}`)
    if (!data || data.length === 0) break

    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id) {
        // It's a file
        paths.push(fullPath)
      } else {
        // It's a folder — recurse
        const nested = await listAllFiles(fullPath)
        paths.push(...nested)
      }
    }

    if (data.length < limit) break
    offset += limit
  }

  return paths
}

async function migrateFile(path: string): Promise<'skipped' | 'migrated' | 'error'> {
  // Check if already in R2
  if (await fileExistsInR2(path)) {
    console.log(`  SKIP  ${path}`)
    return 'skipped'
  }

  // Download from Supabase Storage
  const { data, error } = await supabase.storage.from('documents').download(path)
  if (error || !data) {
    console.error(`  ERROR downloading ${path}: ${error?.message}`)
    return 'error'
  }

  const buffer = Buffer.from(await data.arrayBuffer())

  // Infer content type from extension
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const contentTypeMap: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    doc: 'application/msword',
    xls: 'application/vnd.ms-excel',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
  }
  const contentType = contentTypeMap[ext] ?? 'application/octet-stream'

  // Upload to R2
  try {
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: path,
      Body: buffer,
      ContentType: contentType,
    }))
    console.log(`  OK    ${path}`)
    return 'migrated'
  } catch (err) {
    console.error(`  ERROR uploading ${path}: ${err}`)
    return 'error'
  }
}

async function main() {
  console.log('=== Supabase Storage → Cloudflare R2 Migration ===\n')
  console.log(`R2 bucket: ${BUCKET}`)
  console.log('Listing files from Supabase Storage...\n')

  const allFiles = await listAllFiles('')
  console.log(`Found ${allFiles.length} files to migrate\n`)

  let migrated = 0
  let skipped = 0
  let errors = 0

  for (const path of allFiles) {
    const result = await migrateFile(path)
    if (result === 'migrated') migrated++
    else if (result === 'skipped') skipped++
    else errors++
  }

  console.log('\n=== Migration Complete ===')
  console.log(`Migrated: ${migrated}`)
  console.log(`Skipped (already in R2): ${skipped}`)
  console.log(`Errors: ${errors}`)

  if (errors > 0) {
    console.log('\nSome files failed to migrate. Re-run the script to retry errors.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
