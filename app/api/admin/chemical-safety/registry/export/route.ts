import type { NextRequest } from 'next/server'
import { requireChemicalViewer } from '@/lib/chemical-safety/access'
import { queryObject, unexpectedError, validationError } from '@/lib/chemical-safety/api'
import { toChemicalPdfRows } from '@/lib/chemical-safety/export-rows'
import { buildChemicalRegistryPdf } from '@/lib/chemical-safety/registry-pdf'
import { listChemicalRegistry } from '@/lib/chemical-safety/repository'
import { chemicalRegistryFiltersSchema } from '@/lib/chemical-safety/schemas'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request:NextRequest){const guard=await requireChemicalViewer();if(guard.response)return guard.response;const parsed=chemicalRegistryFiltersSchema.safeParse(queryObject(request.nextUrl.searchParams));if(!parsed.success)return validationError(parsed.error);try{const rows=await listChemicalRegistry(parsed.data);const now=new Date();const date=new Intl.DateTimeFormat('th-TH',{dateStyle:'long',timeZone:'Asia/Bangkok'}).format(now);const generated=new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Bangkok'}).format(now);const bytes=buildChemicalRegistryPdf({rows:toChemicalPdfRows(rows),scopeLabel:'ทุกหน่วยงาน',asOfDate:date,generatedAt:generated});const audit=await supabaseAdmin.from('audit_log').insert({action:'chemical_safety.registry.export_pdf',user_id:guard.actor.id,target:'chemical-registry',detail:JSON.stringify({filters:parsed.data,count:rows.length,generatedAt:now.toISOString()})});if(audit.error)throw audit.error;return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="chemical-inventory-${now.toISOString().slice(0,10)}.pdf"`,'Cache-Control':'private, no-store'}})}catch(error){return unexpectedError(error)}}
