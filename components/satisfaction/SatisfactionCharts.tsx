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
import type { SurveyDashboardData } from '@/lib/surveys/aggregates'

const COLORS = ['#DC2626', '#F97316', '#EAB308', '#22C55E', '#0F766E']

export function SatisfactionCharts({ data }: { data: SurveyDashboardData }) {
  const questionData = data.questions.slice(0, 10).map((question) => ({
    name: question.prompt.length > 34 ? `${question.prompt.slice(0, 34)}…` : question.prompt,
    fullName: question.prompt,
    value: question.normalizedPct ?? 0,
    count: question.answerCount,
  }))
  const distributionData = [{
    name: 'คำตอบ',
    s1: data.overall.distribution[1], s2: data.overall.distribution[2],
    s3: data.overall.distribution[3], s4: data.overall.distribution[4], s5: data.overall.distribution[5],
  }]
  return (
    <div className="satisfaction-chart-grid">
      <style>{`.satisfaction-chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.satisfaction-chart-wide{grid-column:1/-1}.chart-box{height:280px}.chart-table{width:100%;border-collapse:collapse;margin-top:12px;font-size:11.5px}.chart-table th,.chart-table td{padding:7px 8px;border-top:1px solid var(--border);text-align:left;color:var(--ink)}.chart-table th{color:var(--muted)}@media(max-width:900px){.satisfaction-chart-grid{grid-template-columns:1fr}.satisfaction-chart-wide{grid-column:auto}}@media(max-width:520px){.chart-box{height:240px}}`}</style>
      <Card className="satisfaction-chart-wide">
        <ChartHeading title="แนวโน้มความพึงพอใจ" hint="คะแนน normalized (%) ตามช่วงเวลา" />
        <div className="chart-box" aria-label="กราฟแนวโน้มความพึงพอใจ">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={data.trend} margin={{ top: 16, right: 28, left: -10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--muted)' }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--muted)' }} /><Tooltip cursor={false} content={<ChartTooltip />} /><Line type="monotone" dataKey="normalizedPct" name="คะแนน" stroke="#0F766E" strokeWidth={2.5} dot={{ r: 4 }}><LabelList dataKey="normalizedPct" position="top" formatter={(value: unknown) => value === null ? '—' : `${value}%`} /></Line></LineChart></ResponsiveContainer>
        </div>
        <table className="chart-table"><thead><tr><th>ช่วงเวลา</th><th>คะแนน</th><th>คำตอบ</th></tr></thead><tbody>{data.trend.map((point) => <tr key={point.period}><td>{point.period}</td><td>{point.normalizedPct ?? '—'}%</td><td>{point.responseCount}</td></tr>)}</tbody></table>
      </Card>
      <Card>
        <ChartHeading title="คะแนนรายคำถาม" hint="10 คำถามแรก เรียงจากคะแนนสูง" />
        <div className="chart-box" aria-label="กราฟคะแนนรายคำถาม"><ResponsiveContainer width="100%" height="100%"><BarChart data={questionData} layout="vertical" margin={{ top: 6, right: 38, left: 18, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis type="number" domain={[0, 100]} hide /><YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: 'var(--muted)' }} /><Tooltip cursor={false} content={<ChartTooltip />} /><Bar dataKey="value" name="คะแนน" fill="#2563EB" radius={[0, 5, 5, 0]}><LabelList dataKey="value" position="right" formatter={(value: unknown) => `${value}%`} /></Bar></BarChart></ResponsiveContainer></div>
        <table className="chart-table"><thead><tr><th>คำถาม</th><th>คะแนน</th><th>n</th></tr></thead><tbody>{questionData.map((item) => <tr key={item.name}><td>{item.name}</td><td>{item.value}%</td><td>{item.count}</td></tr>)}</tbody></table>
      </Card>
      <Card>
        <ChartHeading title="การกระจายระดับคะแนน" hint="จำนวนคำตอบระดับ 1–5" />
        <div className="chart-box" aria-label="กราฟการกระจายระดับคะแนน"><ResponsiveContainer width="100%" height="100%"><BarChart data={distributionData} layout="vertical" margin={{ top: 30, right: 20, left: 5, bottom: 20 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" hide /><Tooltip cursor={false} content={<ChartTooltip />} /><Legend />{[1,2,3,4,5].map((score, index) => <Bar key={score} dataKey={`s${score}`} name={`ระดับ ${score}`} stackId="likert" fill={COLORS[index]}><LabelList dataKey={`s${score}`} position="center" fill="#fff" formatter={(value: unknown) => Number(value) > 0 ? String(value) : ''} /></Bar>)}</BarChart></ResponsiveContainer></div>
        <table className="chart-table"><thead><tr><th>ระดับ</th>{[1,2,3,4,5].map((score) => <th key={score}>{score}</th>)}</tr></thead><tbody><tr><td>จำนวน</td>{[1,2,3,4,5].map((score) => <td key={score}>{data.overall.distribution[score as 1|2|3|4|5]}</td>)}</tr></tbody></table>
      </Card>
    </div>
  )
}

function ChartHeading({ title, hint }: { title: string; hint: string }) {
  return <div style={{ marginBottom: 10 }}><h3 style={{ margin: 0, fontSize: 14, color: 'var(--ink)' }}>{title}</h3><p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>{hint}</p></div>
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
    <div style={{ minWidth: 156, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--card)', boxShadow: '0 10px 28px rgba(15,23,42,.12)', color: 'var(--ink)' }}>
      <div style={{ maxWidth: 250, fontSize: 12, fontWeight: 800, lineHeight: 1.45 }}>{title}</div>
      <div style={{ display: 'grid', gap: 5, marginTop: 7 }}>
        {payload.map((item) => <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, fontSize: 12 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}><i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 99, background: item.color ?? 'var(--primary)' }} />{item.name}</span><strong>{item.name === 'คะแนน' ? `${item.value}%` : `${item.value} คำตอบ`}</strong></div>)}
      </div>
    </div>
  )
}
