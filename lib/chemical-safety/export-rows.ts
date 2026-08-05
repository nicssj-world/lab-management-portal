import type { ChemicalRegistryRow } from './types'

export interface ChemicalPdfRow { no:string; chemicalName:string; sdsStatus:string; packageVolume:string; currentCount:string; minimumStock:string; totalVolume:string; ghsClassification:string; storagePosition:string; responsibleUnit:string }
const show=(value:unknown,unit?:string|null)=>value==null||value===''?'—':`${value}${unit?` ${unit}`:''}`
export function formatPdfSdsStatus(row:Pick<ChemicalRegistryRow,'sdsStatus'>){return ({approved:'✓ มี SDS ที่อนุมัติแล้ว',draft:'รอตรวจสอบ SDS',mismatch:'SDS ไม่ตรงผลิตภัณฑ์',missing:'ไม่พบ SDS',review_due:'มี SDS — ถึงกำหนดทบทวน'} as Record<string,string>)[row.sdsStatus]||row.sdsStatus}
export function toChemicalPdfRows(rows:ChemicalRegistryRow[]):ChemicalPdfRow[]{return rows.map((row,index)=>({
  no:String(index+1),chemicalName:[row.canonicalName,row.casNumber?`CAS ${row.casNumber}`:''].filter(Boolean).join('\n'),sdsStatus:formatPdfSdsStatus(row),
  packageVolume:show(row.packageValue,row.packageUnit),currentCount:show(row.currentContainerCount),minimumStock:show(row.minimumStock),
  totalVolume:show(row.calculatedTotalValue,row.calculatedTotalUnit),
  ghsClassification:row.sdsStatus==='approved'||row.sdsStatus==='review_due'?[row.signalWord,...row.pictogramCodes,...row.hazards.map(h=>`${h.className} ${h.category}`)].filter(Boolean).join(', ')||'—':'รอยืนยันจาก SDS',
  storagePosition:row.positionCode||'—',responsibleUnit:row.unitName,
}))}
