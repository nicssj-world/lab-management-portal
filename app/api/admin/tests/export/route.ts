import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getActor, getPermissionLevel, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { getTests } from '@/lib/queries/tests'
import type { Test } from '@/lib/supabase/types'
import { TEST_EXCEL_COLUMNS, type TestExcelField } from '@/lib/tests/excel'

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const PAGE_SIZE = 1000

export const runtime = 'nodejs'

function cellValue(test: Test, key: TestExcelField, categoryNames: Map<string, string>): string | number {
  if (key === 'category') return test.category_id ? (categoryNames.get(test.category_id) ?? '') : ''
  if (key === 'category_id') return test.category_id ?? ''

  const value = (test as unknown as Record<string, unknown>)[key]
  if (typeof value === 'boolean') return value ? 'ใช่' : 'ไม่ใช่'
  if (typeof value === 'number') return value
  return value == null ? '' : String(value)
}

async function loadAllTests(searchParams: URLSearchParams): Promise<Test[]> {
  const activeParam = searchParams.get('active')
  const sortDir = searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc'
  const filters = {
    search: searchParams.get('search') || undefined,
    category: searchParams.get('category') || undefined,
    tube: searchParams.get('tube') || undefined,
    department: searchParams.get('department') || undefined,
    active: activeParam === 'false' ? false : true,
    sortBy: searchParams.get('sortBy') || 'code',
    sortDir,
  } as const

  const rows: Test[] = []
  let page = 0
  let total = 0

  while (rows.length < total || page === 0) {
    const result = await getTests(supabaseAdmin, { ...filters, page, pageSize: PAGE_SIZE })
    total = result.count
    rows.push(...result.data)
    page++
    if (result.data.length === 0 || result.data.length < PAGE_SIZE) break
  }

  return rows
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getActor()
    if (!actor) return jsonUnauthorized()
    if ((await getPermissionLevel(actor, 'รายการตรวจ')) === 'none') return jsonForbidden()

    const { data: categories, error: categoryError } = await supabaseAdmin
      .from('categories')
      .select('id, th')
    if (categoryError) return NextResponse.json({ error: categoryError.message }, { status: 500 })

    const tests = await loadAllTests(request.nextUrl.searchParams)
    const categoryNames = new Map((categories ?? []).map(category => [category.id, category.th]))
    const rows = tests.map(test => TEST_EXCEL_COLUMNS.map(column => cellValue(test, column.key, categoryNames)))

    const filterDepartment = request.nextUrl.searchParams.get('department') || 'ทุกหน่วยงาน'
    const filterSummary = [
      ['รายการ', 'รายการตรวจวิเคราะห์'],
      ['หน่วยงาน', filterDepartment],
      ['จำนวนรายการ', tests.length],
      ['หมายเหตุ', 'คอลัมน์ ID ระบบ และหมวดหมู่ ID ใช้สำหรับจับคู่ตอนนำเข้า ห้ามแก้ไขหรือลบคอลัมน์'],
    ] as (string | number)[][]

    const dataSheet = XLSX.utils.aoa_to_sheet([TEST_EXCEL_COLUMNS.map(column => column.header), ...rows])
    dataSheet['!cols'] = TEST_EXCEL_COLUMNS.map(column => ({ wch: column.width }))
    dataSheet['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(TEST_EXCEL_COLUMNS.length - 1)}${rows.length + 1}` }

    const infoSheet = XLSX.utils.aoa_to_sheet(filterSummary)
    infoSheet['!cols'] = [{ wch: 18 }, { wch: 90 }]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, dataSheet, 'รายการตรวจ')
    XLSX.utils.book_append_sheet(workbook, infoSheet, 'คำแนะนำ')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const today = new Date().toISOString().slice(0, 10)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': XLSX_TYPE,
        'Content-Disposition': `attachment; filename="test-catalog-${today}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
