import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  ephisIdFromHisFileName,
  HIS_TRAINING_MAX_FILES,
  HIS_TRAINING_SOURCE,
  markHisTrainingDuplicates,
  parseHisTrainingWorkbook,
  summarizeHisTrainingPreview,
  type HisTrainingFilePreview,
  type HisTrainingImportSummary,
  type HisTrainingProfile,
} from '@/lib/personnel/his-training-import'

export type HisTrainingImportMode = 'self' | 'bulk'

type ProfileRow = { id: string; ephis_id: string | null; name: string }

export function importFilesFromFormData(formData: FormData): File[] {
  const files = formData.getAll('files').filter((value): value is File => value instanceof File && value.size > 0)
  if (files.length === 0) throw new Error('กรุณาเลือกไฟล์ HIS อย่างน้อยหนึ่งไฟล์')
  if (files.length > HIS_TRAINING_MAX_FILES) throw new Error(`นำเข้าได้ไม่เกิน ${HIS_TRAINING_MAX_FILES} ไฟล์ต่อครั้ง`)
  return files
}

export async function loadHisTrainingProfiles(
  mode: HisTrainingImportMode,
  files: File[],
  targetProfileId?: string | null,
): Promise<Map<string, HisTrainingProfile>> {
  let rows: ProfileRow[] = []
  if (mode === 'self') {
    if (!targetProfileId) throw new Error('ไม่พบโปรไฟล์เป้าหมาย')
    if (files.length !== 1) throw new Error('การนำเข้าของตนเองรองรับครั้งละหนึ่งไฟล์')
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id,ephis_id,name')
      .eq('id', targetProfileId)
      .is('deleted_at', null)
      .single()
    if (error || !data) throw new Error('ไม่พบบุคลากรเป้าหมาย')
    rows = [data as ProfileRow]
  } else {
    const ids = [...new Set(files.map((file) => ephisIdFromHisFileName(file.name)).filter(Boolean))]
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id,ephis_id,name')
      .in('ephis_id', ids)
      .is('deleted_at', null)
    if (error) throw new Error(error.message)
    rows = (data ?? []) as ProfileRow[]
  }

  return new Map(rows.flatMap((profile) => profile.ephis_id
    ? [[profile.ephis_id, { id: profile.id, ephisId: profile.ephis_id, name: profile.name }] as const]
    : []))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'อ่านไฟล์ HIS ไม่สำเร็จ'
}

export async function buildHisTrainingPreview(
  files: File[],
  profilesByEphisId: Map<string, HisTrainingProfile>,
): Promise<{ files: HisTrainingFilePreview[]; summary: HisTrainingImportSummary }> {
  const previews: HisTrainingFilePreview[] = []

  for (const file of files) {
    const ephisId = ephisIdFromHisFileName(file.name)
    const profile = profilesByEphisId.get(ephisId)
    if (!profile) {
      previews.push({
        fileName: file.name, ephisId, fingerprint: null, profileId: null, profileName: null,
        rows: [], error: `ไม่พบบุคลากร E-Phis ${ephisId || 'จากชื่อไฟล์'}`,
      })
      continue
    }
    try {
      const parsed = parseHisTrainingWorkbook(Buffer.from(await file.arrayBuffer()), { fileName: file.name, profile })
      previews.push({ ...parsed, error: null })
    } catch (error) {
      previews.push({
        fileName: file.name, ephisId, fingerprint: null, profileId: profile.id, profileName: profile.name,
        rows: [], error: errorMessage(error),
      })
    }
  }

  const parsedFiles = previews.filter((file) => file.profileId && file.rows.length > 0)
  const profileIds = [...new Set(parsedFiles.map((file) => file.profileId as string))]
  const sourceIds = [...new Set(parsedFiles.flatMap((file) => file.rows.map((row) => row.sourceRecordId).filter(Boolean)))]
  if (profileIds.length > 0 && sourceIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('staff_training')
      .select('profile_id,source_record_id,topic,training_date,training_end_date,hours,provider,location,training_type,source_details')
      .in('profile_id', profileIds)
      .eq('source_system', HIS_TRAINING_SOURCE)
      .in('source_record_id', sourceIds)
    if (error) throw new Error(error.message)
    const byProfile = new Map<string, Array<Record<string, unknown>>>()
    for (const row of data ?? []) {
      const profileId = String(row.profile_id)
      byProfile.set(profileId, [...(byProfile.get(profileId) ?? []), row as Record<string, unknown>])
    }
    for (const file of parsedFiles) {
      file.rows = markHisTrainingDuplicates(file.rows, byProfile.get(file.profileId as string) ?? [])
    }
  }

  const seen = new Set<string>()
  for (const file of parsedFiles) {
    file.rows = file.rows.map((row) => {
      if (row.status !== 'ready') return row
      const identity = `${file.profileId}:${row.sourceRecordId}`
      if (seen.has(identity)) return { ...row, status: 'error', error: 'รหัสรายการ HIS ซ้ำระหว่างไฟล์' }
      seen.add(identity)
      return row
    })
  }

  return { files: previews, summary: summarizeHisTrainingPreview(previews) }
}
