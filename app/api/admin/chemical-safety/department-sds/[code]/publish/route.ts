import { NextResponse } from 'next/server'

/**
 * การเผยแพร่ทั้งงานเป็นคำสั่งของทะเบียนสารเคมีเท่านั้น
 * เก็บ endpoint เดิมไว้ชั่วคราวเพื่อให้ client เก่ารู้ว่าต้องย้ายไปจุดใหม่
 */
export async function POST() {
  return NextResponse.json({
    error: 'department_sds_read_only',
    message: 'กรุณาเลือกหน่วยงานในทะเบียนสารเคมี แล้วใช้ปุ่มเผยแพร่ทั้งงานที่นั่น',
  }, { status: 410 })
}
