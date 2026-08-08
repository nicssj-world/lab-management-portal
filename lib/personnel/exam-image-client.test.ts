import assert from 'node:assert/strict'
import { compressExamImage, fitExamImageSize, uploadExamImage } from './exam-image-client'

assert.deepEqual(fitExamImageSize(3200, 1600, 1600), { width: 1600, height: 800 })
assert.deepEqual(fitExamImageSize(800, 600, 1600), { width: 800, height: 600 })

async function main() {
  const calls: Array<{ width: number; height: number; quality: number }> = []
  const fakeCodec = {
    decode: async () => ({ width: 3200, height: 1600 }),
    encode: async (_file: File, width: number, height: number, quality: number) => {
      calls.push({ width, height, quality })
      return new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })
    },
  }
  const result = await compressExamImage(new File(['source'], 'diagram.png', { type: 'image/png' }), fakeCodec)
  assert.equal(result.file.type, 'image/webp')
  assert.equal(result.width, 1600)
  assert.equal(result.height, 800)
  assert.equal(calls[0].quality, 0.82)

  const requests: Array<{ url: string; init?: RequestInit }> = []
  const uploaded = await uploadExamImage(new File(['source'], 'diagram.png', { type: 'image/png' }), {
    compressor: async () => ({
      file: new File(['webp'], 'diagram.webp', { type: 'image/webp' }),
      width: 1600,
      height: 800,
      alt: 'diagram',
    }),
    fetcher: (async (input, init) => {
      requests.push({ url: String(input), init })
      if (String(input).includes('/presign')) {
        return new Response(JSON.stringify({
          key: 'personnel-exams/user-1/img-1.webp',
          uploadUrl: 'https://upload.example/img-1',
          readUrl: 'https://read.example/img-1',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(null, { status: 200 })
    }) as typeof fetch,
  })
  assert.equal(uploaded.key, 'personnel-exams/user-1/img-1.webp')
  assert.equal(uploaded.url, 'https://read.example/img-1')
  assert.equal(requests[1].init?.method, 'PUT')

  const shrinkingCalls: Array<{ width: number; height: number }> = []
  await assert.rejects(() => compressExamImage(new File(['source'], 'portrait.png', { type: 'image/png' }), {
    decode: async () => ({ width: 600, height: 1600 }),
    encode: async (_file, width, height) => {
      shrinkingCalls.push({ width, height })
      return { size: 2 * 1024 * 1024 + 1 } as Blob
    },
  }))
  assert.ok(shrinkingCalls.every((call) => Math.abs(call.width / call.height - 600 / 1600) < 0.001), 'compression must preserve portrait aspect ratio')

  console.log('exam image client: ok')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
