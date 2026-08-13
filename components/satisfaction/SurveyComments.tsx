'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import type { SatisfactionCampaignListItem } from '@/lib/supabase/types'
import { SatisfactionInlineError, SatisfactionLoadingState } from './SatisfactionPrimitives'

type CommentRow = {
  id: string
  campaign_id: string
  text_value: string
  created_at: string
  comment_read_at: string | null
  survey_questions: { prompt: string } | null
  survey_campaigns: {
    name: string
    surveys: { code: string; title: string } | null
    survey_versions: { version_number: number } | null
  } | null
}

export function SurveyComments({ actorRole, campaigns }: { actorRole: string; campaigns: SatisfactionCampaignListItem[] }) {
  const canManage = actorRole === 'Admin' || actorRole === 'Manager'
  const [surveyId, setSurveyId] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [read, setRead] = useState('all')
  const [search, setSearch] = useState('')
  const [comments, setComments] = useState<CommentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [markBusyId, setMarkBusyId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const surveyForms = useMemo(() => Array.from(new Map(campaigns.map((campaign) => [campaign.surveyId, {
    id: campaign.surveyId,
    code: campaign.surveyCode,
    title: campaign.surveyTitle,
  }])).values()), [campaigns])
  const hasFilters = Boolean(search.trim() || surveyId || campaignId || read !== 'all')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const params = new URLSearchParams({ read })
    if (surveyId) params.set('surveyId', surveyId)
    if (campaignId) params.set('campaignId', campaignId)
    if (search.trim()) params.set('search', search.trim())
    try {
      const response = await fetch(`/api/admin/satisfaction/comments?${params}`)
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'โหลดความคิดเห็นไม่สำเร็จ')
      setComments(result.comments ?? [])
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'โหลดความคิดเห็นไม่สำเร็จ') } finally { setLoading(false) }
  }, [campaignId, read, search, surveyId])
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer) }, [load])

  const mark = async (comment: CommentRow, nextRead: boolean) => {
    if (!canManage || markBusyId) return
    setMarkBusyId(comment.id); setError(''); setStatusMessage('')
    try {
      const response = await fetch(`/api/admin/satisfaction/comments/${comment.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: nextRead }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'เปลี่ยนสถานะไม่สำเร็จ')
      setStatusMessage(nextRead ? 'ทำเครื่องหมายว่าอ่านแล้ว' : 'ทำเครื่องหมายว่ายังไม่อ่าน')
      await load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'เปลี่ยนสถานะไม่สำเร็จ') } finally { setMarkBusyId(null) }
  }

  return (
    <div className="survey-comments">
      <div className="survey-comments-heading"><div><h2>ความคิดเห็นจากผู้ตอบ</h2><p>{canManage ? 'Admin/Manager สามารถเปลี่ยนเฉพาะสถานะอ่านและส่งออกได้ โดยแก้ไขหรือลบข้อความไม่ได้' : 'คุณมีสิทธิ์ดูและกรองความคิดเห็นเท่านั้น'}</p></div><span className="survey-comments-count" aria-live="polite">{loading ? 'กำลังค้นหา…' : `ผลการค้นหา ${comments.length.toLocaleString('th-TH')} รายการ`}</span></div>
      <div className="satisfaction-filter-toolbar"><label><span>ค้นหา</span><input className="comment-filter" aria-label="ค้นหาความคิดเห็น" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาในข้อความความคิดเห็น" /></label><label><span>แบบสำรวจ</span><select className="comment-filter" aria-label="กรองแบบสำรวจ" value={surveyId} onChange={(event) => { setSurveyId(event.target.value); setCampaignId('') }}><option value="">ทุกแบบสำรวจ</option>{surveyForms.map((survey) => <option key={survey.id} value={survey.id}>{survey.code} · {survey.title}</option>)}</select></label><label><span>รอบเก็บข้อมูล</span><select className="comment-filter" aria-label="กรองรอบเก็บข้อมูล" value={campaignId} onChange={(event) => setCampaignId(event.target.value)}><option value="">ทุกรอบเก็บข้อมูล</option>{campaigns.filter((campaign) => !surveyId || campaign.surveyId === surveyId).map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label><label><span>สถานะอ่าน</span><select className="comment-filter" aria-label="กรองสถานะอ่าน" value={read} onChange={(event) => setRead(event.target.value)}><option value="all">ทุกสถานะ</option><option value="unread">ยังไม่อ่าน</option><option value="read">อ่านแล้ว</option></select></label></div>
      {error && <div className="survey-comments-feedback"><SatisfactionInlineError message={error} onRetry={() => void load()} /></div>}
      {statusMessage && <div className="survey-comments-success" aria-live="polite">{statusMessage}</div>}
      {loading ? <SatisfactionLoadingState label="กำลังโหลดความคิดเห็น…" rows={5} /> : comments.length === 0 ? <EmptyState title={hasFilters ? 'ไม่พบความคิดเห็นตามตัวกรอง' : 'ยังไม่มีความคิดเห็น'} hint={hasFilters ? 'ลองเปลี่ยนตัวกรองหรือค้นหาข้อความอื่น' : 'เมื่อผู้ตอบส่งความคิดเห็น ข้อความจะปรากฏที่นี่'} icon="inbox" /> : <div className="survey-comments-list">{comments.map((comment) => <article className="satisfaction-comment-card" key={comment.id}><div className="satisfaction-comment-main"><div className="satisfaction-comment-status"><Badge color={comment.comment_read_at ? 'gray' : 'blue'} dot>{comment.comment_read_at ? 'อ่านแล้ว' : 'ใหม่'}</Badge>{!comment.comment_read_at && <span className="satisfaction-unread-marker" aria-label="ยังไม่อ่าน" />}</div><div className="comment-survey-context"><Badge color="teal">{comment.survey_campaigns?.surveys?.code ?? 'แบบสำรวจ'}</Badge><span>{comment.survey_campaigns?.surveys?.title ?? 'ไม่พบชื่อแบบสำรวจ'} · V{comment.survey_campaigns?.survey_versions?.version_number ?? '—'}</span></div><div className="comment-meta">{comment.survey_campaigns?.name ?? 'รอบสำรวจ'} · {new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(comment.created_at))}</div><div className="satisfaction-comment-prompt">{comment.survey_questions?.prompt}</div><p className="satisfaction-comment-text">{comment.text_value}</p></div>{canManage && <Button size="sm" variant="secondary" onClick={() => void mark(comment, !comment.comment_read_at)} disabled={Boolean(markBusyId)} aria-busy={markBusyId === comment.id}>{markBusyId === comment.id ? 'กำลังบันทึก…' : comment.comment_read_at ? 'ทำเครื่องหมายว่ายังไม่อ่าน' : 'ทำเครื่องหมายว่าอ่านแล้ว'}</Button>}</article>)}</div>}
      <div className="satisfaction-visually-hidden" aria-live="polite">{statusMessage}</div>
    </div>
  )
}
