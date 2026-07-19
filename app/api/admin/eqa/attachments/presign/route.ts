import { NextRequest } from 'next/server'
import { presignExternalQualityAttachment } from '@/lib/external-quality/attachment-api'
export const POST = (req: NextRequest) => presignExternalQualityAttachment('eqa', req)
