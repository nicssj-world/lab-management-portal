import { Readable } from 'node:stream'

import type { GetObjectCommandOutput } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'

function toBodyInit(body: GetObjectCommandOutput['Body']): BodyInit {
  if (!body) throw new Error('Missing object body')

  if (typeof body.transformToWebStream === 'function') {
    return body.transformToWebStream() as BodyInit
  }

  if (body instanceof ReadableStream) return body as BodyInit
  if (body instanceof Uint8Array) return body as unknown as BodyInit

  if (typeof (body as Readable).pipe === 'function') {
    return Readable.toWeb(body as Readable) as BodyInit
  }

  throw new Error('Unsupported object body')
}

export function r2ObjectResponse(object: GetObjectCommandOutput, options: { contentType?: string | null; contentDisposition?: string | null } = {}) {
  const headers = new Headers()
  headers.set('Content-Type', options.contentType || object.ContentType || 'application/octet-stream')
  headers.set('Accept-Ranges', object.AcceptRanges || 'bytes')
  headers.set('Cache-Control', 'private, max-age=0, no-store')

  if (object.ContentLength != null) headers.set('Content-Length', String(object.ContentLength))
  if (object.ContentRange) headers.set('Content-Range', object.ContentRange)
  if (object.ETag) headers.set('ETag', object.ETag)
  if (options.contentDisposition) headers.set('Content-Disposition', options.contentDisposition)

  return new NextResponse(toBodyInit(object.Body), {
    status: object.ContentRange ? 206 : 200,
    headers,
  })
}
