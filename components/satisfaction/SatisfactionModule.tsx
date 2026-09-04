'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { ModuleSubnav } from '@/components/ui/ModuleSubnav'
import { SATISFACTION_NAVIGATION } from '@/lib/navigation'
import type { PermLevel } from '@/lib/permissions'
import type {
  SatisfactionCampaignListItem,
  SatisfactionSurveyListItem,
} from '@/lib/supabase/types'
import { SatisfactionDialog } from './SatisfactionDialog'
import {
  SatisfactionLoadingState,
  SatisfactionSectionHeading,
  SatisfactionStatusBadge,
  SatisfactionSummaryCard,
} from './SatisfactionPrimitives'

const SatisfactionDashboard = dynamic(
  () => import('./SatisfactionDashboard').then((module) => module.SatisfactionDashboard),
  { loading: () => <SatisfactionLoadingState label="กำลังโหลดภาพรวม…" rows={4} /> },
)
const SatisfactionExportActions = dynamic(
  () => import('./SatisfactionExportActions').then((module) => module.SatisfactionExportActions),
  { loading: () => <SatisfactionLoadingState label="กำลังเตรียมเครื่องมือรายงาน…" rows={1} /> },
)
const CampaignManager = dynamic(
  () => import('./CampaignManager').then((module) => module.CampaignManager),
  { loading: () => <SatisfactionLoadingState label="กำลังโหลดรอบเก็บข้อมูล…" rows={4} /> },
)
const SurveyComments = dynamic(
  () => import('./SurveyComments').then((module) => module.SurveyComments),
  { loading: () => <SatisfactionLoadingState label="กำลังโหลดความคิดเห็น…" rows={5} /> },
)
const SatisfactionEditors = dynamic(
  () => import('./SatisfactionEditors').then((module) => module.SatisfactionEditors),
  { loading: () => <SatisfactionLoadingState label="กำลังโหลดผู้ดูแล…" rows={3} /> },
)

export type SatisfactionSection = 'overview' | 'surveys' | 'campaigns' | 'comments' | 'settings'

const dateLabel = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value))
    : '—'

export function SatisfactionModule({
  level,
  isAdmin,
  actorRole,
  initialSurveys,
  initialCampaigns,
  activeSection,
}: {
  level: PermLevel
  isAdmin: boolean
  actorRole: string
  initialSurveys: SatisfactionSurveyListItem[]
  initialCampaigns: SatisfactionCampaignListItem[]
  activeSection: SatisfactionSection
}) {
  const router = useRouter()
  const activeTab = activeSection
  const [createSurveyOpen, setCreateSurveyOpen] = useState(false)
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const canEdit = level === 'edit'
  // Settings holds the editor-assignment list, which only a real Admin may hand out.
  const navItems = useMemo(
    () => (isAdmin ? SATISFACTION_NAVIGATION : SATISFACTION_NAVIGATION.filter((item) => item.id !== 'settings')),
    [isAdmin],
  )
  const openCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaign.effectiveStatus === 'open'),
    [campaigns],
  )
  const totalResponses = useMemo(
    () => campaigns.reduce((total, campaign) => total + campaign.responseCount, 0),
    [campaigns],
  )
  useEffect(() => setCampaigns(initialCampaigns), [initialCampaigns])
  const updateCampaignResponseCount = useCallback((campaignId: string, responseCount: number) => {
    setCampaigns((rows) => {
      const current = rows.find((campaign) => campaign.id === campaignId)
      if (!current || current.responseCount === responseCount) return rows
      return rows.map((campaign) => campaign.id === campaignId ? { ...campaign, responseCount } : campaign)
    })
  }, [])

  return (
    <div className="satisfaction-module satisfaction-page" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="SATISFACTION SURVEY"
        title="แบบสำรวจความพึงพอใจ"
        subtitle="สร้างแบบสำรวจ เปิดรอบรับคำตอบ และติดตามผล โดยไม่เก็บข้อมูลระบุตัวบุคคล"
        actions={canEdit ? <Button icon="plus" onClick={() => setCreateSurveyOpen(true)}>สร้างแบบสำรวจ</Button> : undefined}
        marginBottom={0}
      />

      <ModuleSubnav items={navItems} label="เมนูแบบสำรวจความพึงพอใจ" />

      <section id={`satisfaction-section-${activeTab}`}>
        {activeTab === 'overview' && (
          <>
            <div className="satisfaction-summary-grid">
              <SatisfactionSummaryCard label="แบบสำรวจทั้งหมด" value={initialSurveys.length} hint="รวมฉบับร่างและเผยแพร่" icon="clipboard" tone="teal" />
              <SatisfactionSummaryCard label="รอบที่กำลังเปิด" value={openCampaigns.length} hint="รับคำตอบแบบเรียลไทม์" icon="calendar" tone="blue" />
              <SatisfactionSummaryCard label="จำนวนคำตอบสะสม" value={totalResponses.toLocaleString('th-TH')} hint="ไม่เก็บชื่อหรือ HN" icon="chart" tone="purple" />
            </div>
            <SatisfactionDashboard campaigns={campaigns} onResponseCountChange={updateCampaignResponseCount} />
            <SatisfactionExportActions campaigns={campaigns} actorRole={actorRole} />
            <Card padding={0}>
              <SatisfactionSectionHeading title="รอบเก็บข้อมูลล่าสุด" hint="สถานะและจำนวนคำตอบของแต่ละรอบ" />
              <CampaignTable campaigns={campaigns.slice(0, 5)} />
            </Card>
          </>
        )}

        {activeTab === 'surveys' && (
          <Card padding={0}>
            <SatisfactionSectionHeading
              title="แบบสำรวจ"
              hint="แบบที่เผยแพร่แล้วจะถูกล็อกและแก้ไขผ่านเวอร์ชันใหม่"
            />
            {initialSurveys.length === 0 ? (
              <EmptyState title="ยังไม่มีแบบสำรวจ" hint="หลังติดตั้ง SQL จะพบแบบมาตรฐานทั้ง 4 ชุด" icon="clipboard" />
            ) : (
              <div className="satisfaction-table-wrap">
                <table className="satisfaction-table">
                  <caption className="satisfaction-visually-hidden">รายการแบบสำรวจความพึงพอใจ</caption>
                  <thead><tr><th scope="col">ชื่อแบบสำรวจ / รหัส</th><th scope="col">เวอร์ชัน</th><th scope="col">สถานะ</th><th scope="col">เผยแพร่เมื่อ</th><th scope="col">สิทธิ์</th></tr></thead>
                  <tbody>{initialSurveys.map((survey) => (
                    <tr key={survey.id}>
                      <td data-label="ชื่อแบบสำรวจ / รหัส"><Link href={`/staff/satisfaction/${survey.id}`} className="satisfaction-primary-link">{survey.title}</Link><div className="satisfaction-secondary-text">{survey.code}</div></td>
                      <td data-label="เวอร์ชัน">Version {survey.latestVersion ?? '—'}</td>
                      <td data-label="สถานะ"><SatisfactionStatusBadge status={survey.latestStatus} /></td>
                      <td data-label="เผยแพร่เมื่อ">{dateLabel(survey.publishedAt)}</td>
                      <td data-label="สิทธิ์"><Badge color={canEdit ? 'blue' : 'gray'}>{canEdit ? 'แก้ไขได้' : 'ดูเท่านั้น'}</Badge></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'campaigns' && (
          <Card padding={0}>
            {canEdit ? <CampaignManager campaigns={campaigns} surveys={initialSurveys} /> : <><SatisfactionSectionHeading title="รอบเก็บข้อมูล" hint="แต่ละรอบผูกกับเวอร์ชันและ QR token ของตนเอง" /><CampaignTable campaigns={campaigns} /></>}
          </Card>
        )}

        {activeTab === 'comments' && (
          <Card padding={0}>
          <SurveyComments actorRole={actorRole} campaigns={campaigns} />
          </Card>
        )}

        {activeTab === 'settings' && isAdmin && <SatisfactionEditors />}
      </section>
      {createSurveyOpen && <CreateSurveyDialog onClose={() => setCreateSurveyOpen(false)} onCreated={(surveyId) => router.push(`/staff/satisfaction/${surveyId}`)} />}
    </div>
  )
}

function CreateSurveyDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (surveyId: string) => void }) {
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const createSurvey = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      const response = await fetch('/api/admin/satisfaction/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, title, description: description.trim() || null }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.surveyId) throw new Error(result.error ?? 'สร้างแบบสำรวจไม่สำเร็จ')
      onCreated(result.surveyId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'สร้างแบบสำรวจไม่สำเร็จ')
    } finally { setSaving(false) }
  }

  return <SatisfactionDialog labelledBy="create-survey-title" onClose={onClose} className="satisfaction-create-dialog">
    <form onSubmit={createSurvey}>
      <div className="satisfaction-dialog-content">
        <h2 id="create-survey-title">สร้างแบบสำรวจใหม่</h2>
        <p>ระบบจะสร้าง Version 1 เป็นฉบับร่าง แล้วเปิดหน้าสำหรับเพิ่มคำถามให้ทันที</p>
        <div className="satisfaction-form-stack">
          <label className="create-survey-field">รหัสแบบสำรวจ<input data-dialog-autofocus required maxLength={80} value={code} onChange={(event) => setCode(event.target.value)} placeholder="เช่น FM-QP-LAB-09-05" /></label>
          <label className="create-survey-field">ชื่อแบบสำรวจ<input required maxLength={500} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="ระบุชื่อแบบสำรวจ" /></label>
          <label className="create-survey-field">คำอธิบาย <span>(ไม่บังคับ)</span><textarea maxLength={4000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="อธิบายกลุ่มผู้ตอบหรือวัตถุประสงค์" /></label>
        </div>
        {error && <div className="satisfaction-form-error" role="alert">{error}</div>}
      </div>
      <div className="satisfaction-dialog-actions">
        <Button variant="secondary" onClick={onClose} disabled={saving}>ยกเลิก</Button>
        <Button type="submit" icon="plus" disabled={saving}>{saving ? 'กำลังสร้าง…' : 'สร้างและเริ่มแก้ไข'}</Button>
      </div>
    </form>
  </SatisfactionDialog>
}

function CampaignTable({ campaigns }: { campaigns: SatisfactionCampaignListItem[] }) {
  if (campaigns.length === 0) return <EmptyState title="ยังไม่มีรอบเก็บข้อมูล" hint="สร้างรอบและ QR หลังเผยแพร่แบบสำรวจแล้ว" icon="calendar" />
  return (
    <div className="satisfaction-table-wrap"><table className="satisfaction-table satisfaction-campaign-table"><caption className="satisfaction-visually-hidden">รอบเก็บข้อมูลล่าสุด</caption><thead><tr><th scope="col">ชื่อรอบ</th><th scope="col">แบบ / เวอร์ชัน</th><th scope="col">สถานะ</th><th scope="col">จำนวนคำตอบ</th><th scope="col">ปิดรับ</th></tr></thead><tbody>{campaigns.map((campaign) => <tr key={campaign.id}><td data-label="ชื่อรอบ"><strong>{campaign.name}</strong><div className="satisfaction-secondary-text">{campaign.departmentCode ?? 'ยังไม่ระบุหน่วยงาน'} · ปีงบ {campaign.fiscalYear ?? '—'}</div></td><td data-label="แบบ / เวอร์ชัน">{campaign.surveyCode} · V{campaign.versionNumber}<div className="satisfaction-secondary-text">{campaign.surveyTitle}</div></td><td data-label="สถานะ"><div className="satisfaction-status-cell"><SatisfactionStatusBadge status={campaign.effectiveStatus} /></div></td><td data-label="จำนวนคำตอบ">{campaign.responseCount.toLocaleString('th-TH')}{campaign.targetResponseCount ? ` / ${campaign.targetResponseCount.toLocaleString('th-TH')}` : ''}</td><td data-label="ปิดรับ">{dateLabel(campaign.closesAt)}</td></tr>)}</tbody></table></div>
  )
}
