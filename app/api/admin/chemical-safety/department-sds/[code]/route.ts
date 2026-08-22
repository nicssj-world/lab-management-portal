import { NextResponse } from 'next/server'

/** ข้อมูล SDS ของงานเป็น read-only; การแก้ไขและการลบต้องทำจากทะเบียนสารเคมี */
export async function PATCH() {
  return NextResponse.json({
    error: 'department_sds_read_only',
    message: 'กรุณาแก้ไข SDS จากทะเบียนสารเคมี',
  }, { status: 410 })
}

export async function DELETE() {
  return NextResponse.json({
    error: 'department_sds_read_only',
    message: 'กรุณาลบรายการจากทะเบียนสารเคมี',
  }, { status: 410 })
}
