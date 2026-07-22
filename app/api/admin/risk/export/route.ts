import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import autoTable from 'jspdf-autotable'
import { buildExcel, buildThaiPdf, createThaiPdfDoc, exportResponse } from '@/lib/external-quality/export'
import { drawMovementSummary, drawRiskMatrix } from '@/lib/risk/matrix-pdf'
import { getRiskActor, getRiskPermission } from '@/lib/risk/access'
import { applyIncidentFilters } from '../incidents/route'
import { applyRegisterFilters } from '../register/route'

const MAX_ROWS = 5000

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function statusLabel(map: Record<string, string>, value: string | null) {
  return (value && map[value]) || value || '—'
}

const INCIDENT_STATUS_LABELS: Record<string, string> = {
  reported: 'รอทบทวน', reviewing: 'กำลังทบทวน', action: 'กำลังแก้ไข',
  monitoring: 'ติดตามผล', closed: 'ปิดแล้ว',
}

const REGISTER_STATUS_LABELS: Record<string, string> = {
  open: 'ยังไม่จัดการ', treating: 'กำลังจัดการ', monitoring: 'ติดตามผล',
  accepted: 'ยอมรับความเสี่ยง', closed: 'ปิดแล้ว',
}

const LEVEL_LABELS: Record<string, string> = { low: 'ต่ำ', medium: 'กลาง', high: 'สูง' }

/**
 * ส่งออกข้อมูลตามตัวกรองเดียวกับที่หน้าจอใช้อยู่
 *
 * ใช้ applyIncidentFilters / applyRegisterFilters ตัวเดียวกับหน้ารายการ
 * เพื่อให้จำนวนแถวในไฟล์ตรงกับที่ผู้ใช้เห็นบนจอเสมอ
 */
export async function GET(req: NextRequest) {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRiskPermission(actor.role)) === 'none') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp = req.nextUrl.searchParams
  const target = sp.get('target') ?? 'incidents'
  const format = sp.get('format') === 'pdf' ? 'pdf' : 'xlsx'
  const stamp = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

  try {
    if (target === 'incidents') {
      let query = supabaseAdmin.from('incident_reports').select('*')
        .order('event_date', { ascending: false, nullsFirst: false })
      query = applyIncidentFilters(query, sp)
      const { data, error } = await query.limit(MAX_ROWS)
      if (error) throw error

      const ids = (data ?? []).map(r => r.id)
      const { data: actions } = ids.length
        ? await supabaseAdmin.from('risk_actions').select('*').in('incident_id', ids)
        : { data: [] }
      const byId = new Map((data ?? []).map(r => [r.id, r]))

      const rows = (data ?? []).map(r => ({
        'เลขที่': r.report_no ?? `#${r.id}`,
        'วันที่เกิดเหตุ': r.event_date,
        'หน่วยงานที่พบ': r.department_found ?? '',
        'ประเภทเหตุการณ์': r.event_category ?? '',
        'รายละเอียด': r.event_detail,
        'ระดับความรุนแรง': r.severity_level ?? '',
        'สถานะ': statusLabel(INCIDENT_STATUS_LABELS, r.status),
        'ผู้รายงาน': r.reporter_name ?? '',
        'ผู้ทบทวน': r.reviewed_by_name ?? '',
        'รากของปัญหา': r.root_cause ?? '',
        'ผลการติดตาม': r.effectiveness_result ?? '',
        'ปิดเมื่อ': r.closed_at?.slice(0, 10) ?? '',
      }))

      if (format === 'pdf') {
        return exportResponse(
          buildThaiPdf(
            'ทะเบียนรายงานอุบัติการณ์ (IOR)',
            `ข้อมูล ณ วันที่ ${stamp} · ${rows.length} รายการ`,
            ['เลขที่', 'วันที่', 'หน่วยงาน', 'เหตุการณ์', 'ระดับ', 'สถานะ', 'ผู้รายงาน'],
            (data ?? []).map(r => [
              r.report_no ?? `#${r.id}`, r.event_date ?? '', r.department_found ?? '',
              r.event_category ?? r.event_detail.slice(0, 60), r.severity_level ?? '—',
              statusLabel(INCIDENT_STATUS_LABELS, r.status), r.reporter_name ?? '',
            ]),
          ),
          `incident-reports-${stamp}.pdf`,
          'application/pdf',
        )
      }

      const actionRows = (actions ?? []).map(a => ({
        'เลขที่เรื่อง': byId.get(a.incident_id)?.report_no ?? `#${a.incident_id}`,
        'ประเภทมาตรการ': a.action_type,
        'รายละเอียด': a.description,
        'ผู้รับผิดชอบ': a.owner ?? '',
        'กำหนดแล้วเสร็จ': a.due_date ?? '',
        'สถานะ': a.status,
        'ผลการติดตาม': a.result ?? '',
        'ได้ผลหรือไม่': a.is_effective === true ? 'ได้ผล' : a.is_effective === false ? 'ไม่ได้ผล' : '',
      }))

      return exportResponse(
        buildExcel([
          { name: 'อุบัติการณ์', rows },
          { name: 'มาตรการแก้ไข', rows: actionRows },
        ]),
        `incident-reports-${stamp}.xlsx`,
        XLSX_TYPE,
      )
    }

    if (target === 'register') {
      let query = supabaseAdmin.from('risk_register').select('*')
        .order('score', { ascending: false, nullsFirst: false })
      query = applyRegisterFilters(query, sp)
      const { data, error } = await query.limit(MAX_ROWS)
      if (error) throw error

      const rows = (data ?? []).map(r => ({
        'รหัส': r.risk_no ?? `#${r.id}`,
        'วันที่ประเมิน': r.assessed_date,
        'หน่วยงาน': r.department ?? '',
        'หมวดอันตราย': r.hazard_category ?? '',
        'กระบวนการ': r.process_step ?? '',
        'เหตุการณ์ความเสี่ยง': r.risk_statement,
        'โอกาสเกิด': r.likelihood ?? '',
        'ผลกระทบ': r.impact ?? '',
        'คะแนน': r.score ?? '',
        'ระดับ': statusLabel(LEVEL_LABELS, r.level),
        'มาตรการที่มีอยู่': r.existing_controls ?? '',
        'มาตรการเพิ่มเติม': r.additional_controls ?? '',
        'คะแนนคงเหลือ': r.residual_score ?? '',
        'ระดับคงเหลือ': statusLabel(LEVEL_LABELS, r.residual_level),
        'ผู้ยอมรับความเสี่ยง': r.risk_accepted_by_name ?? '',
        'ผู้รับผิดชอบ': r.owner ?? '',
        'สถานะ': statusLabel(REGISTER_STATUS_LABELS, r.status),
        'ทบทวนครั้งถัดไป': r.next_review_date ?? '',
      }))

      if (format === 'pdf') {
        // ตารางความเสี่ยงมาก่อนตารางรายการ เพราะเป็นหลักฐานที่ผู้ตรวจประเมินดูเป็นอันดับแรก
        // ใช้ cellsFor ตัวเดียวกับหน้าจอ ตัวเลขในไฟล์จึงตรงกับที่ผู้ใช้เห็น
        const matrixRisks = (data ?? [])
          .filter(r => r.status !== 'closed')
          .map(r => ({
            id: r.risk_no ?? `RR-${r.id}`,
            name: r.risk_statement,
            status: r.status,
            likelihood: r.likelihood,
            impact: r.impact,
            residualLikelihood: r.residual_likelihood,
            residualImpact: r.residual_impact,
          }))

        const doc = createThaiPdfDoc('portrait')
        drawRiskMatrix(doc, {
          risks: matrixRisks,
          view: 'inherent',
          title: 'ตารางความเสี่ยงก่อนมาตรการ (Inherent Risk)',
          subtitle: `ข้อมูล ณ วันที่ ${stamp}`,
        })

        doc.addPage()
        const afterMatrix = drawRiskMatrix(doc, {
          risks: matrixRisks,
          view: 'residual',
          title: 'ตารางความเสี่ยงคงเหลือหลังมาตรการ (Residual Risk)',
          subtitle: `ข้อมูล ณ วันที่ ${stamp}`,
        })
        drawMovementSummary(doc, matrixRisks, afterMatrix)

        doc.addPage('a4', 'landscape')
        doc.setFontSize(15)
        doc.text('ทะเบียนความเสี่ยงห้องปฏิบัติการ', 14, 16)
        doc.setFontSize(9)
        doc.text(`ข้อมูล ณ วันที่ ${stamp} · ${rows.length} รายการ`, 14, 22)
        autoTable(doc, {
          startY: 27,
          head: [['รหัส', 'หน่วยงาน', 'เหตุการณ์ความเสี่ยง', 'คะแนน', 'ระดับ', 'คงเหลือ', 'ทบทวนถัดไป']],
          body: (data ?? []).map(r => [
            r.risk_no ?? `#${r.id}`, r.department ?? '', r.risk_statement.slice(0, 80),
            String(r.score ?? '—'), statusLabel(LEVEL_LABELS, r.level),
            r.residual_score ? `${r.residual_score} (${statusLabel(LEVEL_LABELS, r.residual_level)})` : '—',
            r.next_review_date ?? '—',
          ]),
          styles: { font: 'Sarabun', fontStyle: 'normal', fontSize: 8, cellPadding: 1.7, overflow: 'linebreak' },
          headStyles: { font: 'Sarabun', fontStyle: 'normal', fillColor: [15, 118, 110] },
        })

        return exportResponse(
          Buffer.from(doc.output('arraybuffer')),
          `risk-register-${stamp}.pdf`,
          'application/pdf',
        )
      }

      return exportResponse(buildExcel([{ name: 'ทะเบียนความเสี่ยง', rows }]), `risk-register-${stamp}.xlsx`, XLSX_TYPE)
    }

    return NextResponse.json({ error: 'ไม่รู้จักชุดข้อมูลที่ขอส่งออก' }, { status: 422 })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
