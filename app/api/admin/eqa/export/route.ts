import { NextRequest } from 'next/server'
import { externalQualityContext, externalQualityError } from '@/lib/external-quality/access'
import { buildExcel, buildThaiPdf, exportResponse } from '@/lib/external-quality/export'
import { bangkokToday } from '@/lib/external-quality/server'
import { fiscalYearBeForDate } from '@/lib/eqa/domain'
import { getEqaOverview } from '@/lib/eqa/server'

const value = (input: unknown) => input == null ? '' : String(input)

export async function GET(req: NextRequest) {
  const ctx = await externalQualityContext('eqa')
  if (ctx.response) return ctx.response
  try {
    const fiscalYearBe = Number(req.nextUrl.searchParams.get('fiscalYearBe')) || fiscalYearBeForDate(bangkokToday())
    const overview = await getEqaOverview(fiscalYearBe)
    const programName = new Map(overview.programs.map(program => [program.id, program.name]))
    const categoryName = new Map(overview.categories.map(category => [category.id, `งาน${category.th}`]))
    const roundName = new Map(overview.rounds.map(round => [round.id, `${programName.get(round.program_id) ?? ''} / ${round.round_code}`]))
    const testName = new Map(overview.programTests.map(test => [test.id, test.test_name_snapshot]))
    if (req.nextUrl.searchParams.get('format') === 'pdf') {
      const rows = overview.rounds.map(round => [value(programName.get(round.program_id)), value(round.round_code), value(round.submission_due_on), value(round.status), value(round.urgency), value(round.blockers?.join(', '))])
      return exportResponse(
        buildThaiPdf(`รายงาน EQA ประจำปีงบประมาณ ${fiscalYearBe}`, `Planned ${overview.coverageSummary.plannedPct}% · Completed ${overview.coverageSummary.completedPct}%`, ['โครงการ', 'รอบ', 'กำหนดส่ง', 'สถานะ', 'เตือน', 'เงื่อนไขค้าง'], rows),
        `eqa-${fiscalYearBe}.pdf`, 'application/pdf',
      )
    }
    const buffer = buildExcel([
      { name: 'โครงการ', rows: overview.programs.map(program => ({ ปีงบประมาณ: program.fiscal_year_be, โครงการ: program.name, รหัส: program.program_code, หมวด: categoryName.get(program.discipline) ?? program.discipline, ประเภท: program.program_type, ใช้งาน: program.active ? 'ใช่' : 'ไม่' })) },
      { name: 'รอบ', rows: overview.rounds.map(round => ({ โครงการ: programName.get(round.program_id), รอบ: round.round_code, คาดรับตัวอย่าง: round.expected_receipt_on, รับจริง: round.received_on, กำหนดส่ง: round.submission_due_on, ส่งผล: round.submitted_on, รับรายงาน: round.report_received_on, สถานะ: round.status, ระดับเตือน: round.urgency })) },
      { name: 'ผล', rows: overview.results.map(result => ({ รอบ: roundName.get(result.round_id), รายการตรวจ: testName.get(result.program_test_id), ตัวอย่าง: result.sample_code, ค่ารายงาน: result.reported_value, ค่าเป้าหมาย: result.target_value, ZScore: result.z_score, SDI: result.sdi, คะแนน: result.score, ผล: result.outcome, เหตุผล: result.reason })) },
      { name: 'CAPA', rows: overview.capas.map(capa => ({ รอบ: roundName.get(capa.round_id), เรื่อง: capa.title, สาเหตุ: capa.root_cause, แก้ไขทันที: capa.immediate_correction, ป้องกันซ้ำ: capa.corrective_action, กำหนด: capa.due_on, สถานะ: capa.status, ผลทวนสอบ: capa.effectiveness_result })) },
      { name: 'Coverage', rows: [{ ปีงบประมาณ: fiscalYearBe, รายการที่ต้องประเมิน: overview.coverageSummary.eligible, วางแผนแล้ว: overview.coverageSummary.planned, ปิดสมบูรณ์: overview.coverageSummary.completed, 'Planned %': overview.coverageSummary.plannedPct, 'Completed %': overview.coverageSummary.completedPct }] },
    ])
    return exportResponse(buffer, `eqa-${fiscalYearBe}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  } catch (error) {
    return externalQualityError(error)
  }
}
