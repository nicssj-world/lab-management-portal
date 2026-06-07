import { S3Client } from '@aws-sdk/client-s3'
import { requiredEnv } from '@/lib/env'

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${requiredEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: requiredEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requiredEnv('R2_SECRET_ACCESS_KEY'),
  },
})

export const R2_BUCKET = requiredEnv('R2_BUCKET_NAME')
