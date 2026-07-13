import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function purgeEphemeralAttachments(documentId: string) {
  const { data: attachments, error: selectError } = await supabaseAdmin
    .from('document_attachments')
    .select('id, file_url')
    .eq('document_id', documentId)
    .eq('ephemeral', true)

  if (selectError) throw selectError
  if (!attachments?.length) return

  await Promise.all(attachments.map(({ file_url }) =>
    r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: file_url }))
      .catch(() => {}),
  ))

  const { error: deleteError } = await supabaseAdmin
    .from('document_attachments')
    .delete()
    .in('id', attachments.map(({ id }) => id))

  if (deleteError) throw deleteError
}
