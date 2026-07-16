'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import type { SatisfactionCampaignListItem } from '@/lib/supabase/types'

type CommentRow = {
  id: string
  campaign_id: string
  text_value: string
  created_at: string
  comment_read_at: string | null
  survey_questions: { prompt: string } | null
  survey_campaigns: { name: string } | null
}

export function SurveyComments({ actorRole, campaigns }: { actorRole: string; campaigns: SatisfactionCampaignListItem[] }) {
  const canManage = actorRole === 'Admin' || actorRole === 'Manager'
  const [campaignId, setCampaignId] = useState('')
  const [read, setRead] = useState('all')
  const [search, setSearch] = useState('')
  const [comments, setComments] = useState<CommentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    const params = new URLSearchParams({ read })
    if (campaignId) params.set('campaignId', campaignId)
    if (search.trim()) params.set('search', search.trim())
    try {
      const response = await fetch(`/api/admin/satisfaction/comments?${params}`)
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'โหลดความคิดเห็นไม่สำเร็จ')
      setComments(result.comments)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'โหลดความคิดเห็นไม่สำเร็จ') } finally { setLoading(false) }
  }, [campaignId, read, search])
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer) }, [load])

  const mark = async (comment: CommentRow, nextRead: boolean) => {
    const response = await fetch(`/api/admin/satisfaction/comments/${comment.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: nextRead }) })
    const result = await response.json(); if (!response.ok) { setError(result.error ?? 'เปลี่ยนสถานะไม่สำเร็จ'); return }
    await load()
  }

  return (
    <div className="survey-comments">
      <style>{`.comment-filters{display:grid;grid-template-columns:minmax(180px,1fr) minmax(160px,220px) minmax(140px,190px);gap:9px;padding:14px;border-bottom:1px solid var(--border)}.comment-filter{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--ink);padding:9px 10px;font:inherit;font-size:12px}.comment-card{padding:15px;border-bottom:1px solid var(--border);transition:background .16s}.comment-card:hover{background:var(--surface-2)}@media(max-width: 767px){.comment-filters{grid-template-columns:1fr}.comment-card{padding:14px}}@media(prefers-reduced-motion:reduce){.comment-card{transition:none}}`}</style>
      <div style={{ padding: '16px 17px 4px' }}><h2 style={{ margin: 0, color: 'var(--ink)', fontSize: 16 }}>ความคิดเห็นจากผู้ตอบ</h2><p style={{ margin: '4px 0 10px', color: 'var(--muted)', fontSize: 12 }}>{canManage ? 'Admin/Manager สามารถเปลี่ยนเฉพาะสถานะอ่านและส่งออกได้ โดยแก้ไขหรือลบข้อความไม่ได้' : 'คุณมีสิทธิ์ดูและกรองความคิดเห็นเท่านั้น'}</p></div>
      <div className="comment-filters"><input className="comment-filter" aria-label="ค้นหาความคิดเห็น" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาในความคิดเห็น" /><select className="comment-filter" aria-label="กรองรอบเก็บข้อมูล" value={campaignId} onChange={(event) => setCampaignId(event.target.value)}><option value="">ทุกรอบ</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select><select className="comment-filter" aria-label="กรองสถานะอ่าน" value={read} onChange={(event) => setRead(event.target.value)}><option value="all">ทั้งหมด</option><option value="unread">ยังไม่อ่าน</option><option value="read">อ่านแล้ว</option></select></div>
      {error && <div role="alert" style={{ margin: 14, padding: 10, borderRadius: 8, background: 'rgba(220,38,38,.08)', color: 'var(--danger)' }}>{error}</div>}
      {loading ? <div style={{ padding: 36, textAlign: 'center', color: 'var(--muted)' }}>กำลังโหลดความคิดเห็น…</div> : comments.length === 0 ? <EmptyState title="ไม่พบความคิดเห็น" hint="ลองเปลี่ยนตัวกรองหรือรอคำตอบใหม่" icon="inbox" /> : <div>{comments.map((comment) => <article className="comment-card" key={comment.id}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}><div style={{ minWidth: 0 }}><div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}><Badge color={comment.comment_read_at ? 'gray' : 'blue'} dot>{comment.comment_read_at ? 'อ่านแล้ว' : 'ใหม่'}</Badge><span style={{ color: 'var(--muted)', fontSize: 11.5 }}>{comment.survey_campaigns?.name ?? 'รอบสำรวจ'} · {new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(comment.created_at))}</span></div><div style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 8 }}>{comment.survey_questions?.prompt}</div><p style={{ color: 'var(--ink)', fontSize: 14, lineHeight: 1.65, margin: '5px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{comment.text_value}</p></div>{canManage && <Button size="sm" variant="secondary" onClick={() => mark(comment, !comment.comment_read_at)}>{comment.comment_read_at ? 'ทำเครื่องหมายว่ายังไม่อ่าน' : 'ทำเครื่องหมายว่าอ่านแล้ว'}</Button>}</div></article>)}</div>}
    </div>
  )
}
