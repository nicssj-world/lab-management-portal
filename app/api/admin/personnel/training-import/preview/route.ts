import { NextRequest, NextResponse } from 'next/server'
import { requirePersonnelEdit, requirePersonnelManage } from '@/lib/auth/guards'
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

export async function POST(request: NextRequest) {
  try {
    const mode = importMode(request)
    if (!mode) return NextResponse.json({ error: 'โหมดนำเข้าไม่ถูกต้อง' }, { status: 422 })
    const profileId = request.nextUrl.searchParams.get('profileId')

    if (mode === 'bulk') {
      const { actor, response } = await requirePersonnelManage()
      if (!actor) return response
    } else {
      if (!profileId) return NextResponse.json({ error: 'ไม่พบโปรไฟล์เป้าหมาย' }, { status: 422 })
      const { actor, response } = await requirePersonnelEdit(profileId)
      if (!actor) return response
    }

    const formData = await request.formData()
    const files = importFilesFromFormData(formData)
    const profiles = await loadHisTrainingProfiles(mode, files, profileId)
    return NextResponse.json(await buildHisTrainingPreview(files, profiles))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'อ่านไฟล์ HIS ไม่สำเร็จ' }, { status: 422 })
  }
}

