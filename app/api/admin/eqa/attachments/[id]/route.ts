import { NextRequest } from 'next/server'
import { deleteExternalQualityAttachment, getExternalQualityAttachment } from '@/lib/external-quality/attachment-api'
type Params = { params: Promise<{ id: string }> }
export async function GET(req: NextRequest, { params }: Params) { return getExternalQualityAttachment('eqa', req, (await params).id) }
export async function DELETE(_req: NextRequest, { params }: Params) { return deleteExternalQualityAttachment('eqa', (await params).id) }
