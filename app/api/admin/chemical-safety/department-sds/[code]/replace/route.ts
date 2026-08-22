import { NextResponse } from 'next/server'

/** การแทนที่ไฟล์ SDS ต้องทำจากทะเบียนสารเคมี เพื่อให้ publication อยู่จุดเดียว */
export async function POST() {
  return NextResponse.json({
    error: 'department_sds_read_only',
    message: 'กรุณาแทนที่ไฟล์ SDS จากทะเบียนสารเคมี',
  }, { status: 410 })
}
