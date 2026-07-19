import { NextRequest } from 'next/server'
import { finalizeExternalQualityAttachment } from '@/lib/external-quality/attachment-api'
export const POST = (req: NextRequest) => finalizeExternalQualityAttachment('eqa', req)
