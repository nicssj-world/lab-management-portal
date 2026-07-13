import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isEphemeralSetStorageKey } from './registration-set-contracts'

export async function purgeEphemeralAttachments(documentId: string) {
  const { data: attachments, error: selectError } = await supabaseAdmin
    .from('document_attachments')
    .select('id, file_url')
    .eq('document_id', documentId)
    .eq('ephemeral', true)

  if (selectError) throw selectError
  if (!attachments?.length) return

  const deletedObjectIds: string[] = []
  const failures: string[] = []
  for (const attachment of attachments) {
    if (!isEphemeralSetStorageKey(documentId, attachment.file_url)) {
      failures.push(`${attachment.id}: storage key อยู่นอก namespace ของชุดเอกสาร`)
      continue
    }
    try {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: attachment.file_url }))
      deletedObjectIds.push(attachment.id)
    } catch (error) {
      failures.push(`${attachment.id}: ${error instanceof Error ? error.message : 'ลบไฟล์จาก R2 ไม่สำเร็จ'}`)
    }
  }

  if (deletedObjectIds.length > 0) {
    const { error: deleteError } = await supabaseAdmin
      .from('document_attachments')
      .delete()
      .in('id', deletedObjectIds)

    if (deleteError) {
      failures.push(`ลบแถวไฟล์แนบหลังลบ R2 ไม่สำเร็จ: ${deleteError.message}`)
    }
  }

  if (failures.length > 0) throw new Error(failures.join('; '))
}
