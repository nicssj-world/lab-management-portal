import { NextResponse } from 'next/server'

/** การสร้างไฟล์ SDS ใหม่ต้องเริ่มจากรายการในทะเบียนสารเคมี */
export async function POST() {
  return NextResponse.json({
    error: 'department_sds_read_only',
    message: 'กรุณาเพิ่มสารเคมีและแนบ SDS จากทะเบียนสารเคมี',
  }, { status: 410 })
}
