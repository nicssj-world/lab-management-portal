'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PermLevel } from '@/lib/permissions'
import type { AssigneeEntry, QualityTaskOccurrence, QualityTaskTemplate } from '@/lib/quality-tasks/types'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Icon } from '@/components/ui/Icon'
import { DEPARTMENTS } from '@/lib/validations/user-schema'
import { buildParticipantSignInHtml } from '@/lib/quality-tasks/participant-sign-in-pdf'
import { buildReadAudiencePayload, buildReadAudiencePickerState } from '@/lib/documents/read-audience'
import { QUALITY_TASK_CATEGORIES } from '@/lib/quality-tasks/categories'

type Person = { id: string; name: string; dept: string | null; role: string; document_position: string | null }
type History = { id:string|number; action:string; detail:string|null; created_at:string; actor_name:string|null }
type Props = { actorId: string; level: PermLevel; initialMonth: string; initialOccurrences: QualityTaskOccurrence[]; templates: QualityTaskTemplate[]; people: Person[] }
const DAY_NAMES = ['อา','จ','อ','พ','พฤ','ศ','ส']
const urgencyColor = { normal: '#64748B', 'due-soon': '#D97706', overdue: '#DC2626', completed: '#16A34A' }
const urgencyText = { normal: 'ปกติ', 'due-soon': 'ใกล้กำหนด', overdue: 'เกินกำหนด', completed: 'เสร็จแล้ว' }
const CATEGORY_COLOR: Record<string,string> = { A:'#1E5FAD', B:'#9333EA', C:'#0D9488', D:'#DC2626', E:'#EA580C', F:'#D97706', G:'#4F46E5', H:'#16A34A', I:'#DB2777' }
const HISTORY_ACTION_LABEL: Record<string,string> = {
  'quality_task.instance.materialize': 'ระบบสร้างงานรอบนี้',
  'quality_task.instance.create': 'สร้างงานเฉพาะกิจ',
  'quality_task.instance.schedule': 'กำหนดวัน/แก้ไขรายละเอียด',
  'quality_task.instance.complete': 'ทำเสร็จ',
  'quality_task.instance.reopen': 'เปิดงานใหม่',
  'quality_task.attachment.upload': 'แนบไฟล์หลักฐาน',
  'quality_task.attachment.delete': 'ลบไฟล์หลักฐาน',
}

function monthRange(month: string) {
  const [y,m] = month.split('-').map(Number)
  return { from: `${y}-${String(m).padStart(2,'0')}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0,10) }
}
function shiftMonth(value: string, delta: number) { const [y,m] = value.split('-').map(Number); const d = new Date(Date.UTC(y,m-1+delta,1)); return d.toISOString().slice(0,7) }
function fmt(value: string | null) { return value ? new Date(`${value}T00:00:00+07:00`).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' }) : '—' }
function assigneeName(e: AssigneeEntry, people: Person[]) { return e.userId ? people.find(p => p.id === e.userId)?.name ?? e.manualName : e.manualName }

export function QualityTaskDashboard({ actorId, level, initialMonth, initialOccurrences, templates, people }: Props) {
  const [month,setMonth] = useState(initialMonth); const [items,setItems] = useState(initialOccurrences)
  const [scope,setScope] = useState<'mine'|'all'>(level === 'edit' ? 'all' : 'mine'); const [category,setCategory] = useState('')
  const [state,setState] = useState(''); const [owner,setOwner] = useState(''); const [assignee,setAssignee] = useState(''); const [search,setSearch] = useState(''); const [selected,setSelected] = useState<QualityTaskOccurrence|null>(null)
  const [history,setHistory] = useState<History[]>([])
  const [adHoc,setAdHoc]=useState<{templateId:string;label:string;dueDate:string;assignees:AssigneeEntry[]}|null>(null)
  const [busy,setBusy] = useState(false); const [error,setError] = useState(''); const fileRef = useRef<HTMLInputElement>(null)
  const [participantModalOpen,setParticipantModalOpen] = useState(false)
  const [completeNote,setCompleteNote] = useState('')

  async function load(nextMonth=month,nextScope=scope) {
    const {from,to}=monthRange(nextMonth); const res=await fetch(`/api/admin/quality-tasks/occurrences?from=${from}&to=${to}&scope=${nextScope}`); const json=await res.json(); if(!res.ok) throw new Error(json.error); setItems(json.occurrences)
  }
  async function move(delta:number){const next=shiftMonth(month,delta);setMonth(next);setSelected(null);await load(next,scope)}
  async function changeScope(next:'mine'|'all'){setScope(next);await load(month,next)}
  const filtered=useMemo(()=>items.filter(o=>(!category||o.template.categoryCode===category)&&(!state||o.urgency===state)&&(!owner||o.template.ownerText===owner)&&(!assignee||o.assignees.some(e=>e.userId===assignee))&&(!search||`${o.template.title} ${o.template.ownerText} ${o.completionNote??''}`.toLowerCase().includes(search.toLowerCase()))),[items,category,state,owner,assignee,search])
  const owners=useMemo(()=>[...new Set(items.map(o=>o.template.ownerText).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th')),[items])
  const summary={unscheduled:filtered.filter(o=>o.scheduling==='unscheduled'&&o.status==='open').length,dueSoon:filtered.filter(o=>o.urgency==='due-soon').length,overdue:filtered.filter(o=>o.urgency==='overdue').length,completed:filtered.filter(o=>o.urgency==='completed').length}
  const [y,m]=month.split('-').map(Number); const days=new Date(Date.UTC(y,m,0)).getUTCDate(); const offset=new Date(Date.UTC(y,m-1,1)).getUTCDay()
  const byDate=new Map<string,QualityTaskOccurrence[]>(); filtered.filter(o=>o.plannedDate?.startsWith(month)).forEach(o=>byDate.set(o.plannedDate!,[...(byDate.get(o.plannedDate!)??[]),o]))
  const todayStr=useMemo(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`},[])

  async function ensureInstance(o:QualityTaskOccurrence){if(o.instanceId)return o.instanceId;const res=await fetch('/api/admin/quality-tasks/occurrences',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'scheduled',scheduleId:o.scheduleId,periodStart:o.periodStart})});const json=await res.json();if(!res.ok)throw new Error(json.error);return json.instance.id as string}
  async function mutate(o:QualityTaskOccurrence,payload:unknown){setBusy(true);setError('');try{const id=await ensureInstance(o);const res=await fetch(`/api/admin/quality-tasks/occurrences/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const json=await res.json();if(!res.ok)throw new Error(json.error);await load();const fresh=(await (await fetch(`/api/admin/quality-tasks/occurrences?from=${monthRange(month).from}&to=${monthRange(month).to}&scope=${scope}`)).json()).occurrences as QualityTaskOccurrence[];setItems(fresh);setSelected(fresh.find(x=>x.key===o.key)??null)}catch(e){setError(e instanceof Error?e.message:'ดำเนินการไม่สำเร็จ')}finally{setBusy(false)}}
  async function upload(file:File){if(!selected)return;setBusy(true);setError('');try{const instanceId=await ensureInstance(selected);const pre=await fetch('/api/admin/quality-tasks/attachments/presign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instanceId,fileName:file.name,contentType:file.type,sizeBytes:file.size})});const p=await pre.json();if(!pre.ok)throw new Error(p.error);const put=await fetch(p.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/pdf'},body:file});if(!put.ok)throw new Error('อัปโหลด PDF ไม่สำเร็จ');const fin=await fetch('/api/admin/quality-tasks/attachments/finalize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instanceId,key:p.key,fileName:file.name,sizeBytes:file.size})});const f=await fin.json();if(!fin.ok)throw new Error(f.error);await load();setSelected(null)}catch(e){setError(e instanceof Error?e.message:'อัปโหลดไม่สำเร็จ')}finally{setBusy(false);if(fileRef.current)fileRef.current.value=''}}
  const canAct=selected&&(level==='edit'||selected.assignees.some(e=>e.userId===actorId))
  useEffect(()=>{if(!selected?.instanceId){setHistory([]);return}fetch(`/api/admin/quality-tasks/occurrences/${selected.instanceId}/history`).then(r=>r.json()).then(j=>setHistory(j.history??[])).catch(()=>setHistory([]))},[selected?.instanceId])
  useEffect(()=>{setCompleteNote('')},[selected?.key])
  async function removeAttachment(id:string){if(!confirm('ลบ PDF นี้?'))return;setBusy(true);setError('');try{const r=await fetch(`/api/admin/quality-tasks/attachments/${id}`,{method:'DELETE'});const j=await r.json();if(!r.ok)throw new Error(j.error);await load();setSelected(null)}catch(e){setError(e instanceof Error?e.message:'ลบไฟล์ไม่สำเร็จ')}finally{setBusy(false)}}
  async function createAdHoc(){if(!adHoc?.templateId||!adHoc.label.trim()||!adHoc.dueDate)return;setBusy(true);setError('');try{const r=await fetch('/api/admin/quality-tasks/occurrences',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'adHoc',...adHoc})});const j=await r.json();if(!r.ok)throw new Error(j.error);setAdHoc(null);await load()}catch(e){setError(e instanceof Error?e.message:'สร้างงานไม่สำเร็จ')}finally{setBusy(false)}}
  function downloadSignInSheet(){
    if(!selected||selected.participants.length===0)return
    const html=buildParticipantSignInHtml(selected.participants.map(p=>({name:p.name,documentPosition:p.documentPosition})))
    const blobUrl=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}))
    const win=window.open(blobUrl,'_blank')
    if(!win){URL.revokeObjectURL(blobUrl);return}
    win.addEventListener('load',()=>{win.print();URL.revokeObjectURL(blobUrl)},{once:true})
  }

  return <div style={{display:'grid',gap:18}}>
    <style>{`.qt-calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border:1px solid var(--border);border-radius:14px;overflow:hidden;background:var(--card)}.qt-day{min-height:120px;padding:8px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);transition:background .15s}.qt-day-today{background:var(--primary-soft)}.qt-card{width:100%;border:0;border-left:3px solid var(--primary);border-radius:7px;background:var(--primary-soft);padding:6px;text-align:left;cursor:pointer;color:var(--ink);font-family:inherit;transition:transform .15s,box-shadow .15s}.qt-card:hover{transform:translateX(2px);box-shadow:0 3px 10px rgba(15,23,42,.12)}.qt-mobile{display:none}@media(max-width:767px){.qt-calendar{grid-template-columns:repeat(7,84px);overflow:auto}.qt-day{min-height:96px;padding:5px}.qt-card{font-size:10.5px}.qt-desktop{display:none!important}.qt-mobile{display:grid;gap:9px}}`}</style>
    <div style={{padding:18,borderRadius:14,border:'1px solid var(--border)',background:'linear-gradient(135deg, var(--card) 0%, var(--surface-2) 100%)',boxShadow:'0 14px 36px rgba(15,23,42,.08)'}}>
      <PageHeader eyebrow="Quality Management System" title="งานคุณภาพ" subtitle="ปฏิทินประชุม กำหนดส่ง และหลักฐานการดำเนินงาน" marginBottom={0} actions={level==='edit'?<><Button variant="secondary" icon="plus" onClick={()=>setAdHoc({templateId:'',label:'',dueDate:monthRange(month).to,assignees:[]})}>สร้างงานเฉพาะกิจ</Button><Link href="/staff/quality-tasks/registry"><Button variant="primary" icon="inbox">ทะเบียนกิจกรรม</Button></Link></>:undefined}/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:10}}>{[['ยังไม่กำหนดวัน',summary.unscheduled,'#64748B','calendar'],['ใกล้กำหนด',summary.dueSoon,'#D97706','clock'],['เกินกำหนด',summary.overdue,'#DC2626','alert'],['เสร็จเดือนนี้',summary.completed,'#16A34A','check']].map(([label,value,color,icon],i)=><div key={String(label)} className="fade-in-up qd-card" style={{animationDelay:`${i*40}ms`,background:'var(--card)',border:'1px solid var(--border)',borderRadius:12,padding:14,display:'flex',alignItems:'center',gap:12}}><span style={{display:'flex',alignItems:'center',justifyContent:'center',width:38,height:38,borderRadius:10,flexShrink:0,background:`${color}1A`,color:String(color)}}><Icon name={String(icon)} size={18}/></span><div><div style={{fontSize:11,color:'var(--muted)',fontWeight:700}}>{label}</div><div style={{fontSize:24,fontWeight:800,color:'var(--ink)',marginTop:2,fontVariantNumeric:'tabular-nums'}}>{value}</div></div></div>)}</div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',padding:12,borderRadius:12,border:'1px solid var(--border)',background:'var(--card)'}}><Button variant="secondary" size="sm" onClick={()=>move(-1)}>‹</Button><Button variant="secondary" size="sm" onClick={()=>{const now=new Date();const v=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;setMonth(v);load(v,scope)}}>วันนี้</Button><Button variant="secondary" size="sm" onClick={()=>move(1)}>›</Button><strong style={{marginRight:'auto',fontSize:14.5}}>{new Date(`${month}-01T00:00:00+07:00`).toLocaleDateString('th-TH',{month:'long',year:'numeric'})}</strong><select value={scope} onChange={e=>changeScope(e.target.value as 'mine'|'all')} style={selectStyle}><option value="mine">งานของฉัน</option><option value="all">ทั้งหมด</option></select><select value={category} onChange={e=>setCategory(e.target.value)} style={{...selectStyle,color:category?CATEGORY_COLOR[category]:selectStyle.color,fontWeight:category?700:selectStyle.fontWeight}}><option value="">ทุกหมวด</option>{'ABCDEFGHI'.split('').map(c=><option key={c} value={c} style={{color:CATEGORY_COLOR[c]}}>● {c} — {QUALITY_TASK_CATEGORIES[c]}</option>)}</select><select value={owner} onChange={e=>setOwner(e.target.value)} style={selectStyle}><option value="">ทุกทีม</option>{owners.map(v=><option key={v}>{v}</option>)}</select><select value={assignee} onChange={e=>setAssignee(e.target.value)} style={selectStyle}><option value="">ผู้รับผิดชอบทุกคน</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><select value={state} onChange={e=>setState(e.target.value)} style={selectStyle}><option value="">ทุกสถานะ</option><option value="due-soon">ใกล้กำหนด</option><option value="overdue">เกินกำหนด</option><option value="completed">เสร็จแล้ว</option></select><div style={{position:'relative'}}><Icon name="search" size={13} style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:'var(--muted)'}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหางาน/ทีม" style={{...selectStyle,minWidth:180,paddingLeft:28}}/></div></div>
    <div className="qt-calendar">{DAY_NAMES.map(d=><div key={d} style={{padding:7,textAlign:'center',fontSize:11,fontWeight:700,color:'var(--muted)',background:'var(--surface-2)'}}>{d}</div>)}{Array.from({length:offset}).map((_,i)=><div key={`blank-${i}`} className="qt-day" style={{background:'var(--surface-2)'}}/>)}{Array.from({length:days},(_,i)=>i+1).map(day=>{const date=`${month}-${String(day).padStart(2,'0')}`;const isToday=date===todayStr;return <div className={`qt-day${isToday?' qt-day-today':''}`} key={date}><div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:isToday?20:undefined,height:isToday?20:undefined,borderRadius:isToday?'50%':undefined,background:isToday?'var(--primary)':undefined,color:isToday?'#fff':'var(--ink)',fontSize:11,fontWeight:700,marginBottom:5}}>{day}</div><div style={{display:'grid',gap:4}}>{(byDate.get(date)??[]).map(o=>{const catColor=CATEGORY_COLOR[o.template.categoryCode]??'var(--primary)'; return <button key={o.key} className="qt-card" onClick={()=>{setSelected(o);setError('')}} style={{borderLeftColor:urgencyColor[o.urgency]}}><div style={{display:'flex',alignItems:'center',gap:4,fontWeight:700,lineHeight:1.25}}>{o.template.taskKind==='meeting'&&<Icon name="users" size={10} style={{color:catColor,flexShrink:0}}/>}<span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.template.title}</span></div><div style={{opacity:.7,marginTop:2}}>{o.template.ownerText}</div></button>})}</div></div>})}</div>
    <section><h2 style={{fontSize:16,margin:'0 0 10px'}}>กิจกรรมทั้งหมด ({filtered.length})</h2><div className="qt-desktop" style={{overflow:'auto',border:'1px solid var(--border)',borderRadius:12,background:'var(--card)'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr>{['กิจกรรม','รอบ','วันนัด','ผู้รับผิดชอบ','สถานะ'].map(h=><th key={h} style={h==='รอบ'||h==='ผู้รับผิดชอบ'?thCenter:th}>{h}</th>)}</tr></thead><tbody>{filtered.map((o,i)=>{const catColor=CATEGORY_COLOR[o.template.categoryCode]??'var(--muted)'; return <tr key={o.key} onClick={()=>setSelected(o)} className="fade-in-up" style={{animationDelay:`${Math.min(i,12)*25}ms`,cursor:'pointer',borderTop:'1px solid var(--border)',transition:'background .1s'}} onMouseEnter={e=>{e.currentTarget.style.background='var(--surface-2)'}} onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}><td style={td}><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:7,height:7,borderRadius:'50%',background:catColor,flexShrink:0}}/><b>{o.template.title}</b></div><div style={{fontSize:11,color:'var(--muted)',marginLeft:15}}>หมวด {o.template.categoryCode} · {o.template.ownerText}</div></td><td style={tdCenter}>{o.periodLabel}</td><td style={td}>{fmt(o.plannedDate??o.effectiveDueDate)}{!o.plannedDate&&<div style={{fontSize:10.5,color:'#D97706'}}>ยังไม่กำหนดวัน</div>}</td><td style={tdCenter}>{o.assignees.map(e=>assigneeName(e,people)).filter(Boolean).join(', ')||'—'}</td><td style={td}><Status o={o}/></td></tr>})}</tbody></table></div><div className="qt-mobile">{filtered.map((o,i)=>{const catColor=CATEGORY_COLOR[o.template.categoryCode]??'var(--muted)'; return <button key={o.key} onClick={()=>setSelected(o)} className="fade-in-up qd-row" style={{animationDelay:`${Math.min(i,12)*25}ms`,background:'var(--card)',border:'1px solid var(--border)',borderRadius:12,padding:13,textAlign:'left',fontFamily:'inherit',color:'var(--ink)'}}><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:7,height:7,borderRadius:'50%',background:catColor,flexShrink:0}}/><b>{o.template.title}</b></div><div style={{fontSize:11,color:'var(--muted)',margin:'5px 0',marginLeft:15}}>หมวด {o.template.categoryCode} · {o.periodLabel} · {fmt(o.plannedDate??o.effectiveDueDate)}</div><Status o={o}/></button>})}</div></section>
    {selected&&<div onClick={()=>setSelected(null)} style={overlay}><div onClick={e=>e.stopPropagation()} className="modal-panel-pop" style={{...modal,borderTop:`3px solid ${CATEGORY_COLOR[selected.template.categoryCode]??'var(--primary)'}`}}><div style={{display:'flex',gap:10,justifyContent:'space-between'}}><div><div style={{fontSize:11,color:CATEGORY_COLOR[selected.template.categoryCode]??'var(--primary)',fontWeight:800}}>หมวด {selected.template.categoryCode} · {selected.periodLabel}</div><h2 style={{margin:'5px 0 0',fontSize:20}}>{selected.template.title}</h2></div><button onClick={()=>setSelected(null)} style={closeStyle}>×</button></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:14}}><Info label="ทีม/บทบาท" value={selected.template.ownerText}/><Info label="ผู้รับผิดชอบ" value={selected.assignees.map(e=>assigneeName(e,people)).filter(Boolean).join(', ')||'ยังไม่มอบหมาย'}/><Info label="ความถี่" value={selected.template.frequencyText}/><Info label="วันนัด" value={fmt(selected.plannedDate)}/><Info label="เส้นตาย" value={fmt(selected.effectiveDueDate)}/><Info label="ผู้เข้าร่วมประชุม" value={selected.participants.map(p=>p.name).join(', ')||'ยังไม่กำหนด'}/>{selected.completionNote&&<div style={{gridColumn:'1 / -1'}}><Info label={selected.template.taskKind==='meeting'?'สรุปมติที่ประชุม':'หมายเหตุการทำเสร็จ'} value={selected.completionNote}/></div>}</div>{selected.participants.length>0&&<div style={{marginTop:10}}><Button variant="secondary" size="sm" icon="download" onClick={downloadSignInSheet}>ดาวน์โหลด PDF ใบลงนาม ({selected.participants.length} คน)</Button></div>}{selected.plannedDate&&(selected.plannedDate<selected.periodStart||selected.plannedDate>selected.periodEnd)&&<div style={{marginTop:9,padding:8,borderRadius:8,background:'#FEF3C7',color:'#92400E',fontSize:11}}>วันนัดอยู่นอกช่วงรอบเดิม แต่ระบบยังนับเป็น {selected.periodLabel}</div>}<div style={{marginTop:12}}><Status o={selected}/></div>{error&&<div style={{marginTop:10,color:'#DC2626',fontSize:12}}>{error}</div>}{canAct&&<div style={{display:'grid',gap:8,marginTop:14,paddingTop:14,borderTop:'1px solid var(--border)'}}><label style={labelStyle}>กำหนดวัน<input type="date" defaultValue={selected.plannedDate??''} onChange={e=>mutate(selected,{action:'schedule',plannedDate:e.target.value||null})} disabled={busy} style={inputStyle}/></label><Button variant="secondary" size="sm" onClick={()=>{const note=prompt('หมายเหตุ',selected.note??'');if(note!==null)mutate(selected,{action:'schedule',plannedDate:selected.plannedDate,note})}}>บันทึกหมายเหตุ</Button>{level==='edit'&&<label style={labelStyle}>ผู้รับผิดชอบรอบนี้<AssigneeListEditor entries={selected.assignees} onChange={entries=>mutate(selected,{action:'schedule',plannedDate:selected.plannedDate,assignees:entries})} people={people}/></label>}{level==='edit'&&<label style={labelStyle}>ผู้เข้าร่วมประชุม (เฉพาะรอบนี้)<div style={{display:'flex',alignItems:'center',gap:9,flexWrap:'wrap'}}><span style={{fontSize:12,color:'var(--ink)',fontWeight:500}}>{selected.participantDepts.length===0&&selected.participantUserIds.length===0?'ใช้ค่าเริ่มต้นของกิจกรรม':`${selected.participantDepts.length} แผนก · ${selected.participantUserIds.length} คน (เฉพาะรอบนี้)`}</span><Button variant="secondary" size="sm" onClick={()=>setParticipantModalOpen(true)}>กำหนดผู้เข้าร่วม</Button></div></label>}<div><b style={{fontSize:12}}>PDF หลักฐาน {selected.template.evidenceRequired?'(บังคับ)':'(ไม่บังคับ)'}</b><div style={{display:'grid',gap:5,marginTop:6}}>{selected.attachments.map(a=><div key={a.id} style={{display:'flex',gap:6,alignItems:'center'}}><a href={`/api/admin/quality-tasks/attachments/${a.id}`} target="_blank" style={{fontSize:12,color:'var(--primary)',flex:1}}>📎 {a.fileName}</a>{level==='edit'&&<button onClick={()=>removeAttachment(a.id)} style={{...closeStyle,width:26,height:26,fontSize:13}}>ลบ</button>}</div>)}</div><Button variant="secondary" size="sm" onClick={()=>fileRef.current?.click()} disabled={busy} style={{marginTop:7}}>แนบ PDF</Button><input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={e=>{const f=e.target.files?.[0];if(f)upload(f)}}/></div>{selected.status==='open'?<div style={{display:'grid',gap:8}}>{selected.template.taskKind==='meeting'&&<label style={labelStyle}>สรุปมติที่ประชุม<textarea value={completeNote} onChange={e=>setCompleteNote(e.target.value)} placeholder="พิมพ์สรุปมติ/ประเด็นสำคัญของการประชุมครั้งนี้" disabled={busy} style={{...inputStyle,height:80,padding:9,resize:'vertical'}}/></label>}<div style={{display:'flex',justifyContent:'flex-end'}}><Button variant="primary" disabled={busy} onClick={()=>mutate(selected,{action:'complete',completionNote:completeNote.trim()||null})}>ทำแล้ว</Button></div></div>:level==='edit'?<div style={{display:'flex',justifyContent:'flex-end'}}><Button variant="secondary" disabled={busy} onClick={()=>{const reason=prompt('เหตุผลที่เปิดงานใหม่');if(reason)mutate(selected,{action:'reopen',reason})}}>เปิดงานใหม่</Button></div>:null}</div>}<div style={{marginTop:16,borderTop:'1px solid var(--border)',paddingTop:12}}><b style={{fontSize:12}}>ประวัติกิจกรรม</b>{history.length?<div style={{display:'grid',gap:7,marginTop:7}}>{history.map(h=><div key={h.id} style={{fontSize:11,color:'var(--muted)'}}><b style={{color:'var(--ink)'}}>{h.actor_name??'System'}</b> · {HISTORY_ACTION_LABEL[h.action]??h.action} · {new Date(h.created_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</div>)}</div>:<div style={{fontSize:11,color:'var(--muted)',marginTop:6}}>ยังไม่มีประวัติที่บันทึก</div>}</div></div></div>}
    {participantModalOpen&&selected&&<ParticipantAudienceModal depts={selected.participantDepts} userIds={selected.participantUserIds} people={people} onCancel={()=>setParticipantModalOpen(false)} onSave={(depts,userIds)=>{setParticipantModalOpen(false);mutate(selected,{action:'schedule',plannedDate:selected.plannedDate,participantDepts:depts,participantUserIds:userIds})}}/>}
    {adHoc&&<div style={overlay} onClick={()=>setAdHoc(null)}><div style={{...modal,maxWidth:560}} onClick={e=>e.stopPropagation()}><div style={{display:'flex',justifyContent:'space-between'}}><h2 style={{margin:0,fontSize:19}}>สร้างงานเฉพาะกิจ</h2><button style={closeStyle} onClick={()=>setAdHoc(null)}>×</button></div><div style={{display:'grid',gap:10,marginTop:14}}><label style={labelStyle}>แม่แบบ<select value={adHoc.templateId} onChange={e=>setAdHoc({...adHoc,templateId:e.target.value})} style={inputStyle}><option value="">เลือกกิจกรรม</option>{templates.map(t=><option key={t.id} value={t.id}>{t.activityNo}. {t.title}</option>)}</select></label><label style={labelStyle}>ชื่อรอบ/เหตุการณ์<input value={adHoc.label} onChange={e=>setAdHoc({...adHoc,label:e.target.value})} style={inputStyle}/></label><label style={labelStyle}>วันครบกำหนด<input type="date" value={adHoc.dueDate} onChange={e=>setAdHoc({...adHoc,dueDate:e.target.value})} style={inputStyle}/></label><label style={labelStyle}>ผู้รับผิดชอบ<AssigneeListEditor entries={adHoc.assignees} onChange={entries=>setAdHoc({...adHoc,assignees:entries})} people={people}/></label>{error&&<div style={{color:'#DC2626',fontSize:12}}>{error}</div>}<div style={{display:'flex',justifyContent:'flex-end',gap:8}}><Button variant="secondary" onClick={()=>setAdHoc(null)}>ยกเลิก</Button><Button disabled={busy||!adHoc.templateId||!adHoc.label.trim()} onClick={createAdHoc}>สร้างงาน</Button></div></div></div></div>}
  </div>
}

function AssigneeListEditor({entries,onChange,people}:{entries:AssigneeEntry[];onChange:(entries:AssigneeEntry[])=>void;people:Person[]}){
  function updateEntry(i:number,patch:Partial<AssigneeEntry>){onChange(entries.map((e,idx)=>idx===i?{...e,...patch}:e))}
  function addEntry(){onChange([...entries,{userId:null,manualName:null}])}
  function removeEntry(i:number){onChange(entries.filter((_,idx)=>idx!==i))}
  return <div style={{display:'grid',gap:6}}>
    {entries.map((e,i)=><div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:6}}>
      <select value={e.userId??''} onChange={ev=>{const uid=ev.target.value||null;const person=people.find(p=>p.id===uid);updateEntry(i,{userId:uid,manualName:person?person.name:e.manualName})}} style={inputStyle}>
        <option value="">ไม่ผูกกับผู้ใช้ / กรอกชื่อเอง</option>
        {people.map(p=><option key={p.id} value={p.id}>{p.name} · {p.dept??p.role}</option>)}
      </select>
      <input value={e.manualName??''} disabled={Boolean(e.userId)} onChange={ev=>updateEntry(i,{userId:null,manualName:ev.target.value||null})} placeholder="ชื่อผู้รับผิดชอบ" style={{...inputStyle,opacity:e.userId?.65:1}}/>
      <button onClick={()=>removeEntry(i)} style={{...closeStyle,width:36,height:36,fontSize:16}}>×</button>
    </div>)}
    <Button variant="secondary" size="sm" onClick={addEntry}>+ เพิ่มผู้รับผิดชอบ</Button>
  </div>
}
function DeptAudienceCheckbox({checked,indeterminate,disabled,onChange}:{checked:boolean;indeterminate:boolean;disabled?:boolean;onChange:(checked:boolean)=>void}){
  const ref=useRef<HTMLInputElement>(null)
  useEffect(()=>{if(ref.current)ref.current.indeterminate=indeterminate},[indeterminate])
  return <input ref={ref} type="checkbox" checked={checked} disabled={disabled} onChange={e=>onChange(e.target.checked)} onClick={e=>e.stopPropagation()} style={{accentColor:'var(--primary)',marginTop:2,flexShrink:0,cursor:disabled?'default':'pointer'}}/>
}
function ParticipantAudienceModal({depts,userIds,people,onCancel,onSave}:{depts:string[];userIds:string[];people:Person[];onCancel:()=>void;onSave:(depts:string[],userIds:string[])=>void}){
  const initial=useMemo(()=>buildReadAudiencePickerState(people,depts,userIds),[]) // eslint-disable-line react-hooks/exhaustive-deps
  const [mode,setMode]=useState<'all'|'depts'>(initial.mode)
  const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set(initial.selected_user_ids))
  const [expanded,setExpanded]=useState<Set<string>>(new Set(initial.expanded_keys))
  const groups=useMemo(()=>{
    const gs:{key:string;label:string;members:Person[]}[]=DEPARTMENTS.map(d=>({key:d,label:d,members:people.filter(p=>p.dept===d)}))
    const un=people.filter(p=>p.dept==null)
    if(un.length>0)gs.push({key:'__no_dept__',label:'ไม่ระบุแผนก',members:un})
    return gs
  },[people])
  function toggleExpand(k:string){setExpanded(prev=>{const n=new Set(prev);n.has(k)?n.delete(k):n.add(k);return n})}
  function toggleMember(id:string){setSelectedIds(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})}
  function toggleGroup(members:Person[]){setSelectedIds(prev=>{const n=new Set(prev);const all=members.every(m=>n.has(m.id));for(const m of members){if(all)n.delete(m.id);else n.add(m.id)}return n})}
  function handleSave(){
    if(mode==='all'){onSave([],[]);return}
    const payload=buildReadAudiencePayload(selectedIds,people,DEPARTMENTS)
    onSave(payload.depts,payload.user_ids)
  }
  return <div style={overlay} onClick={onCancel}><div style={{...modal,maxWidth:460,width:'100%'}} onClick={e=>e.stopPropagation()}>
    <div style={{fontSize:14,fontWeight:700,color:'var(--ink)'}}>กำหนดผู้เข้าร่วมประชุม</div>
    <div style={{fontSize:11.5,color:'var(--muted)',marginTop:3,marginBottom:14}}>เลือกแผนกหรือรายบุคคลที่คาดว่าจะเข้าร่วม</div>
    <div style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:10}}>
      <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12.5,color:'var(--ink)',cursor:'pointer'}}><input type="radio" name="qt-participant-mode" checked={mode==='all'} onChange={()=>setMode('all')} style={{accentColor:'var(--primary)'}}/>ยังไม่กำหนด (ไม่มีผู้เข้าร่วมเริ่มต้น)</label>
      <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12.5,color:'var(--ink)',cursor:'pointer'}}><input type="radio" name="qt-participant-mode" checked={mode==='depts'} onChange={()=>setMode('depts')} style={{accentColor:'var(--primary)'}}/>ระบุแผนก/รายคน</label>
    </div>
    {mode==='depts'&&<div style={{display:'grid',gridTemplateColumns:'1fr',gap:5,maxHeight:260,overflowY:'auto',padding:'4px 2px',marginBottom:6}}>
      {groups.map(group=>{
        const selectedCount=group.members.filter(p=>selectedIds.has(p.id)).length
        const checked=group.members.length>0&&selectedCount===group.members.length
        const indeterminate=selectedCount>0&&selectedCount<group.members.length
        const isExpanded=expanded.has(group.key)
        const disabled=group.members.length===0
        return <div key={group.key}>
          <div onClick={()=>{if(!disabled)toggleExpand(group.key)}} style={{display:'flex',alignItems:'flex-start',gap:7,fontSize:12,color:disabled?'var(--muted)':'var(--ink)',cursor:disabled?'default':'pointer',lineHeight:1.35,padding:'4px 2px'}}>
            <DeptAudienceCheckbox checked={checked} indeterminate={indeterminate} disabled={disabled} onChange={()=>toggleGroup(group.members)}/>
            <Icon name={isExpanded?'chevDown':'chevRight'} size={12} style={{color:'var(--muted)',flexShrink:0,marginTop:3}}/>
            <div style={{flex:1,minWidth:0}}><span style={{fontWeight:600}}>{group.label}</span><span style={{color:'var(--muted)',marginLeft:5}}>({group.members.length} คน)</span></div>
          </div>
          {isExpanded&&group.members.length>0&&<div style={{display:'grid',gap:4,padding:'2px 0 4px 32px'}}>
            {group.members.map(person=><label key={person.id} style={{display:'flex',alignItems:'flex-start',gap:6,fontSize:12,color:'var(--ink)',cursor:'pointer',lineHeight:1.35}}>
              <input type="checkbox" checked={selectedIds.has(person.id)} onChange={()=>toggleMember(person.id)} style={{accentColor:'var(--primary)',marginTop:2,flexShrink:0}}/>
              <span><span style={{fontWeight:600}}>{person.name}</span><span style={{color:'var(--muted)',marginLeft:5}}>{person.document_position??''}</span></span>
            </label>)}
          </div>}
        </div>
      })}
    </div>}
    {mode==='depts'&&selectedIds.size===0&&<div style={{fontSize:11,color:'var(--warning)',marginBottom:4}}>ยังไม่ได้เลือกแผนก/รายคน — จะไม่มีผู้เข้าร่วมเริ่มต้น</div>}
    <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:14}}>
      <button onClick={onCancel} style={{padding:'8px 16px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--ink)',cursor:'pointer',fontFamily:'inherit',fontSize:13}}>ยกเลิก</button>
      <button onClick={handleSave} style={{padding:'8px 16px',borderRadius:8,border:'none',background:'var(--primary)',color:'#fff',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700}}>บันทึก</button>
    </div>
  </div></div>
}
function Status({o}:{o:QualityTaskOccurrence}){return <span style={{display:'inline-flex',border:`1px solid ${urgencyColor[o.urgency]}55`,background:`${urgencyColor[o.urgency]}12`,color:urgencyColor[o.urgency],padding:'3px 8px',borderRadius:99,fontSize:10.5,fontWeight:800}}>{urgencyText[o.urgency]}</span>}
function Info({label,value}:{label:string;value:string}){return <div style={{background:'var(--surface-2)',borderRadius:9,padding:10}}><div style={{fontSize:10.5,color:'var(--muted)',fontWeight:700}}>{label}</div><div style={{fontSize:12,fontWeight:600,marginTop:3}}>{value}</div></div>}
const selectStyle:React.CSSProperties={height:34,border:'1px solid var(--border)',borderRadius:8,background:'var(--card)',color:'var(--ink)',padding:'0 9px',fontFamily:'inherit',fontSize:13}
const th:React.CSSProperties={padding:'10px 12px',textAlign:'left',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em',color:'var(--muted)',background:'var(--surface-2)',whiteSpace:'nowrap'};const thCenter:React.CSSProperties={...th,textAlign:'center'};const td:React.CSSProperties={padding:'11px 12px',verticalAlign:'top'};const tdCenter:React.CSSProperties={...td,textAlign:'center',verticalAlign:'middle'}
const overlay:React.CSSProperties={position:'fixed',inset:0,zIndex:100,background:'rgba(15,23,42,.45)',display:'flex',alignItems:'center',justifyContent:'center',padding:16};const modal:React.CSSProperties={background:'var(--card)',borderRadius:16,width:'100%',maxWidth:680,maxHeight:'90vh',overflow:'auto',padding:20,boxShadow:'0 24px 70px rgba(0,0,0,.25)'}
const closeStyle:React.CSSProperties={border:0,background:'var(--surface-2)',borderRadius:8,width:32,height:32,fontSize:22,cursor:'pointer',color:'var(--muted)'};const labelStyle:React.CSSProperties={fontSize:12,fontWeight:700,color:'var(--muted)',display:'grid',gap:5};const inputStyle:React.CSSProperties={height:36,border:'1px solid var(--border)',borderRadius:8,padding:'0 9px',background:'var(--card)',color:'var(--ink)',fontFamily:'inherit',fontSize:13}
