import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRiskActor, getRiskPermission } from '@/lib/risk/access'
import { reviewDueThreshold, todayBangkok } from '@/lib/risk/register'

const WORKLIST_LIMIT = 8

/**
 * ข้อมูลหน้าภาพรวม — นับจากงานจริงของห้องแล็บเท่านั้น
 *
 * ระบบเดิมนับแถว Smart-RM (ข้อมูลนำเข้าจาก HIS ที่ไม่มี workflow) รวมเข้ามาด้วย
 * ทำให้ตัวเลข "เกินกำหนด" และ "รอแก้ไข" สูงเกินจริงมาก ตอนนี้ Smart-RM อยู่คนละตารางแล้ว
 */
export async function GET() {
  const actor = await getRiskActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((await getRiskPermission(actor.role)) === 'none') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const today = todayBangkok()
  const monthStart = `${today.slice(0, 7)}-01`

  const [incidentsRes, registerRes, actionsRes] = await Promise.all([
    supabaseAdmin
      .from('incident_reports')
      .select('id, report_no, event_date, event_detail, event_category, department_found, severity_level, status, requires_rca, root_cause, reviewed_at, closed_at, reporter_name')
      .is('deleted_at', null),
    supabaseAdmin
      .from('risk_register')
      .select('id, risk_no, risk_statement, department, owner, status, likelihood, impact, score, level, residual_likelihood, residual_impact, residual_score, residual_level, next_review_date')
      .is('deleted_at', null),
    supabaseAdmin
      .from('risk_actions')
      .select('id, incident_id, register_id, description, owner, due_date, status'),
  ])

  const error = incidentsRes.error ?? registerRes.error ?? actionsRes.error
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const incidents = incidentsRes.data ?? []
  const register = registerRes.data ?? []
  const actions = actionsRes.data ?? []

  const incidentById = new Map(incidents.map(i => [i.id, i]))
  const registerById = new Map(register.map(r => [r.id, r]))

  const openIncidents = incidents.filter(i => i.status !== 'closed')
  const closedThisMonth = incidents.filter(i => i.closed_at && i.closed_at >= monthStart)

  // เวลาเฉลี่ยที่ใช้ปิดเรื่อง นับจากวันเกิดเหตุถึงวันปิด
  const closedWithDates = incidents.filter(i => i.closed_at && i.event_date)
  const avgDaysToClose = closedWithDates.length === 0 ? 0 : Math.round(
    closedWithDates.reduce((sum, i) => {
      const days = (new Date(i.closed_at!).getTime() - new Date(i.event_date!).getTime()) / 86_400_000
      return sum + Math.max(0, days)
    }, 0) / closedWithDates.length,
  )

  const overdueActions = actions
    .filter(a => a.status !== 'done' && a.due_date && a.due_date < today)
    .map(a => {
      const parent = a.incident_id ? incidentById.get(a.incident_id) : a.register_id ? registerById.get(a.register_id) : null
      if (!parent) return null
      const isIncident = Boolean(a.incident_id)
      // มาตรการของเรื่องที่ปิดแล้วไม่ใช่งานค้างอีกต่อไป
      if (parent.status === 'closed') return null
      return {
        kind: isIncident ? 'incident' : 'register',
        parentId: parent.id,
        parentNo: isIncident
          ? (parent as { report_no?: string }).report_no
          : (parent as { risk_no?: string }).risk_no,
        title: a.description,
        owner: a.owner,
        dueDate: a.due_date,
        department: isIncident
          ? (parent as { department_found?: string }).department_found
          : (parent as { department?: string }).department,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))

  const awaitingReview = incidents
    .filter(i => i.status === 'reported')
    .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)))

  const needsRca = incidents
    .filter(i => i.status !== 'closed' && i.requires_rca && !i.root_cause)
    .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)))

  const reviewDue = register
    .filter(r => r.status !== 'closed' && r.next_review_date && r.next_review_date <= reviewDueThreshold())
    .sort((a, b) => String(a.next_review_date).localeCompare(String(b.next_review_date)))

  // ตารางความเสี่ยงต้องนับชุดเดียวกับ KPI residualHigh ด้านล่าง — เดิมตารางนับรายการที่ปิดแล้ว
  // ด้วย ทำให้ตัวเลขบนการ์ดกับจุดบนตารางไม่ตรงกันและดูเหมือนมีความเสี่ยงสูงเกินจริง
  // 'accepted' ยังนับ เพราะความเสี่ยงที่ยอมรับแล้วยังมีอยู่จริง แค่ตัดสินใจว่าอยู่กับมันได้
  const matrix = register
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

  return NextResponse.json({
    kpis: {
      openIncidents: openIncidents.length,
      awaitingReview: awaitingReview.length,
      closedThisMonth: closedThisMonth.length,
      avgDaysToClose,
      overdueActions: overdueActions.length,
      residualHigh: register.filter(r => r.residual_level === 'high' && r.status !== 'closed').length,
      reviewDue: reviewDue.length,
    },
    worklist: {
      awaitingReview: awaitingReview.slice(0, WORKLIST_LIMIT).map(i => ({
        id: i.id,
        no: i.report_no,
        title: i.event_category || i.event_detail,
        department: i.department_found,
        date: i.event_date,
        reporter: i.reporter_name,
      })),
      needsRca: needsRca.slice(0, WORKLIST_LIMIT).map(i => ({
        id: i.id,
        no: i.report_no,
        title: i.event_category || i.event_detail,
        department: i.department_found,
        date: i.event_date,
        severity: i.severity_level,
      })),
      overdueActions: overdueActions.slice(0, WORKLIST_LIMIT),
      reviewDue: reviewDue.slice(0, WORKLIST_LIMIT).map(r => ({
        id: r.id,
        no: r.risk_no,
        title: r.risk_statement,
        department: r.department,
        owner: r.owner,
        dueDate: r.next_review_date,
      })),
    },
    matrix,
  })
}
