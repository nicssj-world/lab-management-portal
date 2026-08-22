import { NextResponse } from 'next/server'

/** SDS-only เป็นการสร้างรายการทะเบียน จึงต้องเริ่มจากทะเบียนสารเคมี */
export async function POST() {
  return NextResponse.json({
    error: 'department_sds_read_only',
    message: 'กรุณาเพิ่มสารเคมีจากทะเบียนสารเคมี แล้วจัดการ SDS ที่แถวนั้น',
  }, { status: 410 })
}
