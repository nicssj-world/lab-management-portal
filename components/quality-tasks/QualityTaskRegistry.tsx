'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PermLevel } from '@/lib/permissions'
import type { AssigneeEntry, QualityTaskSchedule, QualityTaskTemplate } from '@/lib/quality-tasks/types'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Icon } from '@/components/ui/Icon'
import { DEPARTMENTS } from '@/lib/validations/user-schema'
import { buildReadAudiencePayload, buildReadAudiencePickerState } from '@/lib/documents/read-audience'
import { QUALITY_TASK_CATEGORIES as CATS } from '@/lib/quality-tasks/categories'

type Person={id:string;name:string;dept:string|null;role:string;document_position:string|null}
function blank(no:number):QualityTaskTemplate{return{id:'',sourceKey:null,categoryCode:'A',categoryName:CATS.A,activityNo:no,title:'',description:null,referenceCode:null,frequencyText:'ตามที่กำหนด',ownerText:'',taskKind:'activity',reminderDays:7,evidenceRequired:false,active:true,defaultAssignees:[],defaultParticipantDepts:[],defaultParticipantUserIds:[],schedules:[]}}

export function QualityTaskRegistry({level,initialTemplates,people}:{level:PermLevel;initialTemplates:QualityTaskTemplate[];people:Person[]}){
 const [items,setItems]=useState(initialTemplates);const [search,setSearch]=useState('');const [cat,setCat]=useState('');const [draft,setDraft]=useState<QualityTaskTemplate|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [participantModalOpen,setParticipantModalOpen]=useState(false)
 const filtered=useMemo(()=>items.filter(t=>(!cat||t.categoryCode===cat)&&(!search||`${t.title} ${t.ownerText} ${t.referenceCode??''}`.toLowerCase().includes(search.toLowerCase()))),[items,cat,search])
 async function refresh(){const r=await fetch('/api/admin/quality-tasks/templates');const j=await r.json();if(!r.ok)throw new Error(j.error);setItems(j.templates)}
 async function save(){if(!draft)return;setBusy(true);setError('');try{const url=draft.id?`/api/admin/quality-tasks/templates/${draft.id}`:'/api/admin/quality-tasks/templates';const r=await fetch(url,{method:draft.id?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...draft,schedules:draft.schedules.map(s=>({...s,templateId:draft.id}))})});const j=await r.json();if(!r.ok)throw new Error(j.error);await refresh();setDraft(null)}catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ')}finally{setBusy(false)}}
 async function remove(t:QualityTaskTemplate){if(!confirm(`ลบกิจกรรม "${t.title}"?`))return;setBusy(true);setError('');try{const r=await fetch(`/api/admin/quality-tasks/templates/${t.id}`,{method:'DELETE'});const j=await r.json();if(!r.ok)throw new Error(j.error);await refresh()}catch(e){setError(e instanceof Error?e.message:'ลบไม่สำเร็จ')}finally{setBusy(false)}}
 function set<K extends keyof QualityTaskTemplate>(key:K,value:QualityTaskTemplate[K]){setDraft(d=>d?{...d,[key]:value}:d)}
 function updateSchedule(index:number,patch:Partial<QualityTaskSchedule>){setDraft(d=>d?{...d,schedules:d.schedules.map((s,i)=>i===index?{...s,...patch}:s)}:d)}
 return <div style={{display:'grid',gap:16}}><PageHeader eyebrow="Quality Task Registry" title="ทะเบียนกิจกรรมคุณภาพ" subtitle={`${items.length} กิจกรรม · 9 หมวด · อ้างอิง ISO 15189:2022`} actions={<><Link href="/staff/quality-tasks"><Button variant="secondary" icon="calendar">กลับปฏิทิน</Button></Link>{level==='edit'&&<Button icon="plus" onClick={()=>setDraft(blank(Math.max(0,...items.map(x=>x.activityNo??0))+1))}>เพิ่มกิจกรรม</Button>}</>}/><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหากิจกรรม ทีม หรือเลขเอกสาร" style={{...inputStyle,minWidth:280}}/><select value={cat} onChange={e=>setCat(e.target.value)} style={inputStyle}><option value="">ทุกหมวด</option>{Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{k} · {v}</option>)}</select></div><div style={{overflow:'auto',border:'1px solid var(--border)',borderRadius:12,background:'var(--card)'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr>{['รหัส','กิจกรรม','ความถี่','เลขเอกสาร','หลักฐาน',...(level==='edit'?['']:[])].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>{filtered.map(t=><tr key={t.id} style={{borderTop:'1px solid var(--border)',opacity:t.active?1:.55,transition:'background .1s'}} onMouseEnter={e=>{e.currentTarget.style.background='var(--surface-2)'}} onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}><td style={td}><span style={{background:'var(--primary-soft)',color:'var(--primary)',borderRadius:8,padding:'4px 8px',fontSize:11,fontWeight:800,whiteSpace:'nowrap'}}>{t.categoryCode}-{t.activityNo}</span></td><td style={td}><div style={{fontWeight:700}}>{t.title}</div><div style={{fontSize:11,color:'var(--muted)',marginTop:3}}>{t.ownerText}</div></td><td style={td}><Badge text={t.frequencyText}/></td><td style={td}>{t.referenceCode?<Badge text={t.referenceCode}/>:<span style={{color:'var(--muted)'}}>—</span>}</td><td style={td}><Badge text={t.evidenceRequired?'บังคับ PDF':'PDF ไม่บังคับ'} color={t.evidenceRequired?'#D97706':'#64748B'}/></td>{level==='edit'&&<td style={td}><div style={{display:'flex',gap:6}}><button onClick={()=>setDraft(structuredClone(t))} style={iconBtn}>แก้ไข</button><button onClick={()=>remove(t)} disabled={busy} style={{...iconBtn,color:'#DC2626',borderColor:'#FECACA',cursor:busy?'not-allowed':'pointer'}}>ลบ</button></div></td>}</tr>)}</tbody></table></div>{error&&!draft&&<p style={{color:'#DC2626',fontSize:12.5,margin:0}}>{error}</p>}{draft&&<div style={overlay} onClick={()=>setDraft(null)}><div style={modal} onClick={e=>e.stopPropagation()}><div style={{display:'flex',justifyContent:'space-between',gap:10}}><h2 style={{margin:0,fontSize:19}}>{draft.id?'แก้ไขกิจกรรม':'เพิ่มกิจกรรม'}</h2><button style={closeStyle} onClick={()=>setDraft(null)}>×</button></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:11,marginTop:15}}><Field label="หมวด"><select value={draft.categoryCode} onChange={e=>setDraft({...draft,categoryCode:e.target.value,categoryName:CATS[e.target.value]})} style={inputStyle}>{Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{k} · {v}</option>)}</select></Field><Field label="ลำดับ"><input type="number" value={draft.activityNo??''} onChange={e=>set('activityNo',e.target.value?Number(e.target.value):null)} style={inputStyle}/></Field><Field label="ชื่อกิจกรรม" wide><input value={draft.title} onChange={e=>set('title',e.target.value)} style={inputStyle}/></Field><Field label="รายละเอียด" wide><textarea value={draft.description??''} onChange={e=>set('description',e.target.value||null)} style={{...inputStyle,height:70,padding:9}}/></Field><Field label="เลขเอกสาร"><input value={draft.referenceCode??''} onChange={e=>set('referenceCode',e.target.value||null)} style={inputStyle}/></Field><Field label="ความถี่เดิม"><input value={draft.frequencyText} onChange={e=>set('frequencyText',e.target.value)} style={inputStyle}/></Field><Field label="ทีม/บทบาท" wide><input value={draft.ownerText} onChange={e=>set('ownerText',e.target.value)} style={inputStyle}/></Field><Field label="ประเภท"><select value={draft.taskKind} onChange={e=>set('taskKind',e.target.value as 'activity'|'meeting')} style={inputStyle}><option value="activity">กิจกรรม</option><option value="meeting">ประชุม</option></select></Field><Field label="เตือนล่วงหน้า (วัน)"><input type="number" min={0} max={365} value={draft.reminderDays} onChange={e=>set('reminderDays',Number(e.target.value))} style={inputStyle}/></Field><Field label="ผู้รับผิดชอบเริ่มต้น" wide><AssigneeListEditor entries={draft.defaultAssignees} onChange={entries=>set('defaultAssignees',entries)} people={people}/></Field><Field label="ผู้เข้าร่วมประชุม (ค่าเริ่มต้น)" wide><div style={{display:'flex',alignItems:'center',gap:9,flexWrap:'wrap'}}><span style={{fontSize:12,color:'var(--muted)'}}>{draft.defaultParticipantDepts.length===0&&draft.defaultParticipantUserIds.length===0?'ยังไม่กำหนด':`${draft.defaultParticipantDepts.length} แผนก · ${draft.defaultParticipantUserIds.length} คน`}</span><Button variant="secondary" size="sm" onClick={()=>setParticipantModalOpen(true)}>กำหนดผู้เข้าร่วม</Button></div></Field></div><div style={{display:'flex',gap:14,marginTop:12}}><label><input type="checkbox" checked={draft.evidenceRequired} onChange={e=>set('evidenceRequired',e.target.checked)}/> บังคับ PDF</label><label><input type="checkbox" checked={draft.active} onChange={e=>set('active',e.target.checked)}/> เปิดใช้งาน</label></div><div style={{marginTop:16,borderTop:'1px solid var(--border)',paddingTop:13}}><div style={{display:'flex',justifyContent:'space-between'}}><b>รอบเวลาอัตโนมัติ</b><Button variant="secondary" size="sm" onClick={()=>set('schedules',[...draft.schedules,{id:'',templateId:draft.id,intervalUnit:'month',intervalCount:1,startsOn:'2025-10-01',endsOn:null,active:true}])}>+ เพิ่มรอบ</Button></div>{draft.schedules.map((s,i)=><div key={i} style={{display:'grid',gridTemplateColumns:'1fr 80px 140px auto',gap:7,marginTop:8}}><select value={s.intervalUnit} onChange={e=>updateSchedule(i,{intervalUnit:e.target.value as 'week'|'month'|'year'})} style={inputStyle}><option value="week">สัปดาห์</option><option value="month">เดือน</option><option value="year">ปี</option></select><input type="number" min={1} value={s.intervalCount} onChange={e=>updateSchedule(i,{intervalCount:Number(e.target.value)})} style={inputStyle}/><input type="date" value={s.startsOn} onChange={e=>updateSchedule(i,{startsOn:e.target.value})} style={inputStyle}/><Button variant="danger" size="sm" onClick={()=>set('schedules',draft.schedules.filter((_,x)=>x!==i))}>ลบ</Button></div>)}</div>{error&&<p style={{color:'#DC2626',fontSize:12}}>{error}</p>}<div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}><Button variant="secondary" onClick={()=>setDraft(null)}>ยกเลิก</Button><Button disabled={busy||!draft.title.trim()} onClick={save}>{busy?'กำลังบันทึก':'บันทึก'}</Button></div></div></div>}
 {participantModalOpen&&draft&&<ParticipantAudienceModal depts={draft.defaultParticipantDepts} userIds={draft.defaultParticipantUserIds} people={people} onCancel={()=>setParticipantModalOpen(false)} onSave={(depts,userIds)=>{setDraft(d=>d?{...d,defaultParticipantDepts:depts,defaultParticipantUserIds:userIds}:d);setParticipantModalOpen(false)}}/>}
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
      <button onClick={()=>removeEntry(i)} style={iconBtn}>ลบ</button>
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
function Badge({text,color='#1E5FAD'}:{text:string;color?:string}){return <span style={{fontSize:10.5,fontWeight:700,color,background:`${color}12`,border:`1px solid ${color}35`,borderRadius:99,padding:'3px 7px'}}>{text}</span>}
function Field({label,wide,children}:{label:string;wide?:boolean;children:React.ReactNode}){return <label style={{fontSize:11,fontWeight:700,color:'var(--muted)',display:'grid',gap:5,gridColumn:wide?'1 / -1':undefined}}>{label}{children}</label>}
const inputStyle:React.CSSProperties={width:'100%',minHeight:36,border:'1px solid var(--border)',borderRadius:8,background:'var(--card)',color:'var(--ink)',padding:'0 9px',fontFamily:'inherit',fontSize:13};const iconBtn:React.CSSProperties={border:'1px solid var(--border)',background:'var(--card)',borderRadius:7,padding:'4px 7px',fontSize:10.5,cursor:'pointer',color:'var(--muted)'}
const th:React.CSSProperties={padding:'10px 12px',textAlign:'left',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em',color:'var(--muted)',background:'var(--surface-2)',whiteSpace:'nowrap'};const td:React.CSSProperties={padding:'11px 12px',verticalAlign:'top'}
const overlay:React.CSSProperties={position:'fixed',inset:0,zIndex:100,background:'rgba(15,23,42,.45)',display:'flex',alignItems:'center',justifyContent:'center',padding:16};const modal:React.CSSProperties={background:'var(--card)',borderRadius:16,width:'100%',maxWidth:760,maxHeight:'92vh',overflow:'auto',padding:20};const closeStyle:React.CSSProperties={border:0,background:'var(--surface-2)',borderRadius:8,width:32,height:32,fontSize:22,cursor:'pointer',color:'var(--muted)'}
