'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import type { SurveyDashboardData } from '@/lib/surveys/aggregates'

const COLORS = ['#DC2626', '#F97316', '#EAB308', '#22C55E', '#0F766E']
const percent = (value: number | null | undefined) => value === null || value === undefined ? '—' : `${value}%`

export function SatisfactionCharts({ data, lowSample = false }: { data: SurveyDashboardData; lowSample?: boolean }) {
  if (data.responseCount === 0 || data.questions.length === 0) {
    return <Card><EmptyState title="ยังไม่มีคำตอบสำหรับแสดงผล" hint="เมื่อมีคำตอบที่ให้คะแนนแล้ว กราฟและตารางจะปรากฏที่นี่" icon="chart" /></Card>
  }
  const questionData = [...data.questions]
    .sort((a, b) => (a.normalizedPct ?? 101) - (b.normalizedPct ?? 101))
    .map((question) => ({
      ...question,
      name: question.prompt,
      fullName: question.prompt,
      value: question.normalizedPct ?? 0,
      count: question.answerCount,
      s1: question.distribution[1], s2: question.distribution[2], s3: question.distribution[3], s4: question.distribution[4], s5: question.distribution[5],
    }))
  const weakQuestions = questionData.slice(0, 10)
  const sectionData = data.sections.map((section) => ({ name: section.title, value: section.normalizedPct ?? 0, count: section.validAnswerCount }))
  const distributionData = [{
    name: 'คำตอบ',
    s1: data.overall.distribution[1], s2: data.overall.distribution[2],
    s3: data.overall.distribution[3], s4: data.overall.distribution[4], s5: data.overall.distribution[5],
  }]
  const behavior = data.behavior
  const publicDemographics = lowSample ? [] : Object.entries(data.demographics).map(([key, groups]) => ({ key, groups, total: Object.values(groups).reduce((sum, count) => sum + count, 0) })).filter((item) => item.total >= 5)

  return (
    <div className="satisfaction-chart-grid">
      <Card className="satisfaction-chart-wide">
        <ChartHeading title="แนวโน้มคะแนนและจำนวนคำตอบรายเดือน" hint="เส้นเชื่อมค่าที่วัดได้จริงแบบเส้นตรง; แท่งด้านขวาแสดงปริมาณคำตอบของแต่ละเดือน" />
        <div className="satisfaction-trend-pair">
          <div className="chart-box" role="img" aria-label="กราฟแนวโน้มความพึงพอใจรายเดือน">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={data.trend} margin={{ top: 16, right: 28, left: -10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--muted)' }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--muted)' }} /><Tooltip cursor={false} content={<ChartTooltip />} /><Line type="linear" dataKey="normalizedPct" name="คะแนน" stroke="#0F766E" strokeWidth={2.5} dot={{ r: 4 }}><LabelList dataKey="normalizedPct" position="top" formatter={(value: unknown) => value === null ? '—' : `${value}%`} /></Line></LineChart></ResponsiveContainer>
          </div>
          <div className="chart-box satisfaction-response-volume" role="img" aria-label="กราฟจำนวนคำตอบรายเดือน">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={data.trend} margin={{ top: 16, right: 12, left: -22, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--muted)' }} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} /><Tooltip cursor={false} content={<ChartTooltip />} /><Bar dataKey="responseCount" name="จำนวนคำตอบ" fill="#2563EB" radius={[5, 5, 0, 0]} maxBarSize={42}><LabelList dataKey="responseCount" position="top" /></Bar></BarChart></ResponsiveContainer>
          </div>
        </div>
        <table className="satisfaction-chart-table"><caption className="satisfaction-visually-hidden">ตารางแนวโน้มความพึงพอใจและจำนวนคำตอบรายเดือน</caption><thead><tr><th scope="col">เดือน</th><th scope="col">คะแนน</th><th scope="col">ผลเชิงบวก</th><th scope="col">จำนวนคำตอบ</th></tr></thead><tbody>{data.trend.map((point) => <tr key={point.period}><td>{point.period}</td><td>{percent(point.normalizedPct)}</td><td>{percent(point.positivePct)}</td><td>{point.responseCount}</td></tr>)}</tbody></table>
      </Card>

      <Card>
        <ChartHeading title="คะแนนแยกหมวด" hint="ช่วยชี้ว่าหมวดใดควรได้รับการปรับปรุงก่อน" />
        <div className="chart-box satisfaction-section-chart" role="img" aria-label="กราฟคะแนนแยกหมวด"><ResponsiveContainer width="100%" height="100%"><BarChart data={sectionData} layout="vertical" margin={{ top: 4, right: 40, left: 26, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} /><XAxis type="number" domain={[0, 100]} hide /><YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 10.5, fill: 'var(--muted)' }} /><Tooltip cursor={false} content={<ChartTooltip />} /><Bar dataKey="value" name="คะแนน" fill="#0F766E" radius={[0, 5, 5, 0]}><LabelList dataKey="value" position="right" formatter={(value: unknown) => `${value}%`} /></Bar></BarChart></ResponsiveContainer></div>
        <table className="satisfaction-chart-table"><caption className="satisfaction-visually-hidden">ตารางคะแนนแยกหมวด</caption><thead><tr><th scope="col">หมวด</th><th scope="col">คะแนน</th><th scope="col">ผลเชิงบวก</th><th scope="col">จำนวนคำตอบ</th></tr></thead><tbody>{data.sections.map((section) => <tr key={section.sectionId}><td>{section.title}</td><td>{percent(section.normalizedPct)}</td><td>{percent(section.positivePct)}</td><td>{section.validAnswerCount}</td></tr>)}</tbody></table>
      </Card>

      <Card>
        <ChartHeading title="การกระจายระดับคะแนน" hint="จำนวนคำตอบระดับ 1–5 ของคำถามให้คะแนนทั้งหมด" />
        <div className="chart-box" role="img" aria-label="กราฟการกระจายระดับคะแนน"><ResponsiveContainer width="100%" height="100%"><BarChart data={distributionData} layout="vertical" margin={{ top: 30, right: 20, left: 5, bottom: 20 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" hide /><Tooltip cursor={false} content={<ChartTooltip />} /><Legend />{[1, 2, 3, 4, 5].map((score, index) => <Bar key={score} dataKey={`s${score}`} name={`ระดับ ${score}`} stackId="likert" fill={COLORS[index]}><LabelList dataKey={`s${score}`} position="center" fill="#fff" formatter={(value: unknown) => Number(value) > 0 ? String(value) : ''} /></Bar>)}</BarChart></ResponsiveContainer></div>
        <table className="satisfaction-chart-table"><caption className="satisfaction-visually-hidden">ตารางการกระจายระดับคะแนน</caption><thead><tr><th scope="col">ระดับ</th>{[1, 2, 3, 4, 5].map((score) => <th scope="col" key={score}>{score}</th>)}</tr></thead><tbody><tr><td>จำนวนคำตอบ</td>{[1, 2, 3, 4, 5].map((score) => <td key={score}>{data.overall.distribution[score as 1 | 2 | 3 | 4 | 5]}</td>)}</tr></tbody></table>
      </Card>

      <Card className="satisfaction-chart-wide">
        <ChartHeading title="คำถามที่ควรปรับปรุง" hint="เรียงคะแนนจากต่ำไปสูง; กราฟแสดง 10 อันดับแรก และตารางแสดงทุกคำถามพร้อม Likert distribution" />
        <div className="chart-box satisfaction-question-chart-box" style={{ height: Math.max(300, weakQuestions.length * 42) }} role="img" aria-label="กราฟคะแนนรายคำถามเรียงจากต่ำไปสูง"><ResponsiveContainer width="100%" height="100%"><BarChart data={weakQuestions} layout="vertical" margin={{ top: 6, right: 38, left: 18, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} /><XAxis type="number" domain={[0, 100]} hide /><YAxis type="category" dataKey="name" width={240} tick={{ fontSize: 10, fill: 'var(--muted)' }} /><Tooltip cursor={false} content={<ChartTooltip />} /><Bar dataKey="value" name="คะแนน" fill="#D97706" radius={[0, 5, 5, 0]}><LabelList dataKey="value" position="right" formatter={(value: unknown) => `${value}%`} /></Bar></BarChart></ResponsiveContainer></div>
        <div className="satisfaction-question-table-wrap"><table className="satisfaction-chart-table satisfaction-question-table"><caption className="satisfaction-visually-hidden">ตารางคะแนนและระดับคะแนนรายคำถาม</caption><thead><tr><th scope="col">คำถาม</th><th scope="col">คะแนน</th><th scope="col">จำนวนคำตอบ</th><th scope="col">Likert ระดับ 1–5</th></tr></thead><tbody>{questionData.map((item) => <tr key={item.questionId}><td>{item.fullName}</td><td>{percent(item.normalizedPct)}</td><td>{item.count}</td><td><div className="satisfaction-likert-mini" aria-label={`ระดับคะแนนรายคำถาม 1 ถึง 5: ${[item.s1, item.s2, item.s3, item.s4, item.s5].join(', ')}`}>{[item.s1, item.s2, item.s3, item.s4, item.s5].map((count, index) => <span key={index} style={{ flexGrow: count || .15, background: COLORS[index] }} title={`ระดับ ${index + 1}: ${count}`} />)}</div><small>{[item.s1, item.s2, item.s3, item.s4, item.s5].join(' · ')}</small></td></tr>)}</tbody></table></div>
      </Card>

      {behavior ? <>
        <Card className="satisfaction-chart-wide">
          <ChartHeading title="พฤติกรรมการตอบแบบสอบถาม" hint="วิเคราะห์เฉพาะคำตอบที่ส่งสำเร็จ โดยไม่ติดตามการเปิดฟอร์ม การละทิ้ง หรือเวลาในการตอบ" />
          <div className="satisfaction-behavior-metrics">
            <BehaviorMetric label="ตอบคำถามไม่บังคับ" value={percent(behavior.optionalAnswerRatePct)} />
            <BehaviorMetric label="ให้ความคิดเห็น" value={percent(behavior.commentRatePct)} />
            <BehaviorMetric label="ความครบถ้วนของคำตอบ" value={percent(behavior.completenessPct)} />
          </div>
          <div className="satisfaction-behavior-grid">
            <BehaviorBars title="วันที่มีคำตอบ" rows={behavior.responsesByWeekday} />
            <BehaviorBars title="ช่วงเวลาที่มีคำตอบ" rows={behavior.responsesByHour} />
            <BehaviorBars title="การกระจายคะแนนรายคำตอบ" rows={behavior.responseScoreDistribution} />
          </div>
        </Card>
      </> : null}

      <Card className="satisfaction-chart-wide">
        <ChartHeading title="ข้อมูลกลุ่มย่อย" hint={lowSample ? 'ซ่อนรายละเอียดทั้งหมดเนื่องจากจำนวนคำตอบน้อยกว่า 5' : 'กลุ่มที่มีข้อมูลน้อยกว่า 5 จะแสดงเป็น “น้อยกว่า 5”'} />
        {publicDemographics.length === 0 ? <div className="satisfaction-subgroup-empty">{lowSample ? 'ข้อมูลยังน้อย จึงยังไม่แสดง demographic/subgroup' : 'ไม่มีข้อมูลกลุ่มย่อยที่มีจำนวนเพียงพอ'}</div> : <div className="satisfaction-demographic-grid">{publicDemographics.map((item) => <section key={item.key}><strong>{behavior?.demographicLabels[item.key]?.prompt ?? item.key}</strong><dl>{Object.entries(item.groups).map(([label, count]) => <div key={label}><dt>{behavior?.demographicLabels[item.key]?.options[label] ?? label}</dt><dd>{count < 5 ? 'น้อยกว่า 5' : count.toLocaleString('th-TH')}</dd></div>)}</dl></section>)}</div>}
      </Card>

      <Card className="satisfaction-chart-wide">
        <ChartHeading title="ความคิดเห็นล่าสุด" hint="แสดงข้อความล่าสุดจากคำตอบที่ส่งสำเร็จ" />
        {!data.recentComments?.length ? <div className="satisfaction-subgroup-empty">ยังไม่มีความคิดเห็น</div> : <div className="satisfaction-recent-comments">{data.recentComments.map((comment, index) => <article key={comment.answerId ?? `${comment.questionId}-${index}`}><div><strong>{comment.prompt}</strong><span>{new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(comment.submittedAt))}</span></div><p>{comment.text}</p><small>{comment.readAt ? 'ดำเนินการแล้ว' : 'ยังไม่ได้ดำเนินการ'}</small></article>)}</div>}
      </Card>
    </div>
  )
}

function ChartHeading({ title, hint }: { title: string; hint: string }) {
  return <div className="satisfaction-chart-heading"><h3>{title}</h3><p>{hint}</p></div>
}

function BehaviorMetric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}

function BehaviorBars({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.count))
  return <section className="satisfaction-behavior-bars"><h4>{title}</h4>{rows.length === 0 ? <span>ยังไม่มีข้อมูล</span> : <dl>{rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd><i style={{ width: `${(row.count / max) * 100}%` }} /><span>{row.count.toLocaleString('th-TH')}</span></dd></div>)}</dl>}</section>
}

type ChartTooltipEntry = {
  name?: string
  value?: string | number
  color?: string
  payload?: { fullName?: string }
}

function ChartTooltip({ active, label, payload }: { active?: boolean; label?: string; payload?: ChartTooltipEntry[] }) {
  if (!active || !payload?.length) return null
  const title = payload[0]?.payload?.fullName ?? label ?? 'รายละเอียดข้อมูล'
  return (
    <div className="satisfaction-chart-tooltip">
      <div>{title}</div>
      <div>{payload.map((item) => <div key={item.name}><span><i aria-hidden="true" style={{ background: item.color ?? 'var(--primary)' }} />{item.name}</span><strong>{item.name === 'คะแนน' ? `${item.value}%` : `${item.value} คำตอบ`}</strong></div>)}</div>
    </div>
  )
}
