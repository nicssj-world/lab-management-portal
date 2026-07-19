import { contentDispositionForInline } from '@/lib/documents/download-filename'

export function contentDispositionForExternalQualityAttachment(fileName: string) {
  return contentDispositionForInline(fileName)
}
