import { supabaseAdmin } from '@/lib/supabase/admin'

export type ExternalQualityPerson = {
  id: string
  name: string
  dept: string | null
  role: string
}

export type EqaAnalyzer = {
  id: string
  cbh_code: string | null
  equipment_type: string
  model: string | null
  classification: string | null
  department: string | null
}

export type ExternalQualityCatalogTest = {
  id: number
  code: string
  th: string
  en: string
  category_id: string | null
  department: string | null
  method: string | null
  transport_condition: string | null
  tat: string | null
  tat_hours: number | null
  tat_minutes: string | null
  price: number | null
}

export function bangkokToday(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

export async function listExternalQualityPeople(): Promise<ExternalQualityPerson[]> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, dept, role')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return (data ?? []) as ExternalQualityPerson[]
}

export async function listEqaAnalyzers(): Promise<EqaAnalyzer[]> {
  const { data, error } = await supabaseAdmin
    .from('equipment')
    .select('id, cbh_code, equipment_type, model, classification, department, status')
    .in('classification', ['Analyzer', 'Analyzer (Rental)'])
    .eq('status', 'Active')
    .order('cbh_code')
  if (error) throw error
  return (data ?? []).map(({ status: _status, ...analyzer }) => analyzer) as EqaAnalyzer[]
}

export async function listExternalQualityCatalogTests(): Promise<ExternalQualityCatalogTest[]> {
  const { data, error } = await supabaseAdmin
    .from('tests')
    .select('id, code, th, en, category_id, department, method, transport_condition, tat, tat_hours, tat_minutes, price')
    .eq('active', true)
    .order('code')
  if (error) throw error
  return (data ?? []) as ExternalQualityCatalogTest[]
}
