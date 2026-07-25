import { NextRequest, NextResponse } from 'next/server'
import { requirePersonnelEdit, requirePersonnelManage } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { HIS_TRAINING_SOURCE } from '@/lib/personnel/his-training-import'
import {
  buildHisTrainingPreview,
  importFilesFromFormData,
  loadHisTrainingProfiles,
  type HisTrainingImportMode,
} from '@/lib/personnel/his-training-import-server'

export const runtime = 'nodejs'

function importMode(request: NextRequest): HisTrainingImportMode | null {
  const mode = request.nextUrl.searchParams.get('mode')
  return mode === 'self' || mode === 'bulk' ? mode : null
}

function selectedKeysFrom(formData: FormData): Set<string> {
  const raw = formData.get('selectedKeys')
  if (typeof raw !== 'string') throw new Error('ไม่พบรายการที่เลือกนำเข้า')
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('รายการที่เลือกนำเข้าไม่ถูกต้อง') }
  if (!Array.isArray(parsed) || parsed.length > 25_000 || parsed.some((value) => typeof value !== 'string')) {
    throw new Error('รายการที่เลือกนำเข้าไม่ถูกต้อง')
  }
  return new Set(parsed)
}

export async function POST(request: NextRequest) {
  try {
    const mode = importMode(request)
    if (!mode) return NextResponse.json({ error: 'โหมดนำเข้าไม่ถูกต้อง' }, { status: 422 })
    const profileId = request.nextUrl.searchParams.get('profileId')
    const access = mode === 'bulk'
      ? await requirePersonnelManage()
      : profileId ? await requirePersonnelEdit(profileId) : { response: NextResponse.json({ error: 'ไม่พบโปรไฟล์เป้าหมาย' }, { status: 422 }) }
    if (!access.actor) return access.response

    const formData = await request.formData()
    const selectedKeys = selectedKeysFrom(formData)
    if (selectedKeys.size === 0) return NextResponse.json({ error: 'เลือกอย่างน้อยหนึ่งรายการเพื่อนำเข้า' }, { status: 422 })
    const files = importFilesFromFormData(formData)
    const profiles = await loadHisTrainingProfiles(mode, files, profileId)
    const preview = await buildHisTrainingPreview(files, profiles)
    const selected = preview.files.flatMap((file) => file.rows
      .filter((row) => row.status === 'ready' && selectedKeys.has(row.key))
      .map((row) => ({ file, row })))
    if (selected.length === 0) return NextResponse.json({ error: 'ไม่มีรายการใหม่ที่ผ่านการตรวจสอบ' }, { status: 422 })

    const errorCount = preview.summary.error
    const skippedBeforeInsert = preview.summary.rows - selected.length
    const { data: batch, error: batchError } = await supabaseAdmin
      .from('staff_training_import_batches')
      .insert({
        mode,
        imported_by: access.actor.id,
        file_count: files.length,
        row_count: preview.summary.rows,
        inserted_count: 0,
        skipped_count: skippedBeforeInsert,
        error_count: errorCount,
      })
      .select('id')
      .single()
    if (batchError || !batch) throw new Error(batchError?.message ?? 'สร้างประวัติการนำเข้าไม่สำเร็จ')

    const insertRows = selected.map(({ file, row }) => ({
      profile_id: file.profileId,
      topic: row.topic,
      training_date: row.trainingDate,
      training_end_date: row.trainingEndDate,
      hours: row.hours,
      provider: row.provider,
      location: row.location,
      training_type: row.trainingType,
      cpd_credits: null,
      evidence_url: null,
      notes: null,
      source_system: HIS_TRAINING_SOURCE,
      source_record_id: row.sourceRecordId,
      source_details: row.sourceDetails,
      import_batch_id: batch.id,
      created_by: access.actor.id,
    }))
    const { data: created, error: insertError } = await supabaseAdmin
      .from('staff_training')
      .upsert(insertRows, {
        onConflict: 'profile_id,source_system,source_record_id',
        ignoreDuplicates: true,
      })
      .select('*')
    if (insertError) {
      await supabaseAdmin.from('staff_training_import_batches').update({ error_count: errorCount + selected.length }).eq('id', batch.id)
      throw new Error(insertError.message)
    }

    const insertedCount = created?.length ?? 0
    const skippedCount = skippedBeforeInsert + (selected.length - insertedCount)
    await supabaseAdmin
      .from('staff_training_import_batches')
      .update({ inserted_count: insertedCount, skipped_count: skippedCount })
      .eq('id', batch.id)
    await supabaseAdmin.from('audit_log').insert({
      action: 'personnel.training.his_import',
      user_id: access.actor.id,
      target: batch.id,
      detail: JSON.stringify({ mode, files: files.length, inserted: insertedCount, skipped: skippedCount, errors: errorCount }),
    })

    return NextResponse.json({
      ok: true,
      batchId: batch.id,
      inserted: insertedCount,
      skipped: skippedCount,
      errors: errorCount,
      created: created ?? [],
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'นำเข้าข้อมูล HIS ไม่สำเร็จ' }, { status: 422 })
  }
}
