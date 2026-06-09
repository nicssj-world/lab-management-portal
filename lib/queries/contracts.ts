import type { SupabaseClient } from '@supabase/supabase-js'
import type { Contract, ContractUsage } from '@/lib/supabase/types'

export interface ContractWithUsage extends Contract {
  used: number
  lastUsageDate: string | null
  lastUsageMonth: string | null
  usageMonths: string[]
}

export async function getContracts(supabase: SupabaseClient): Promise<ContractWithUsage[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select(`
      *,
      contract_usage(amount, usage_date, usage_month)
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((c) => {
    const usages = c.contract_usage as { amount: number; usage_date: string | null; usage_month: string | null }[]
    const lastUsageDate = (usages ?? [])
      .filter(u => u.usage_date)
      .map(u => u.usage_date!)
      .sort()
      .at(-1) ?? null
    const lastUsageMonth = (usages ?? [])
      .map(u => u.usage_month ?? u.usage_date)
      .filter((d): d is string => Boolean(d))
      .map(d => d.slice(0, 7))
      .sort()
      .at(-1) ?? null
    const usageMonths = Array.from(new Set((usages ?? [])
      .map(u => u.usage_month ?? u.usage_date)
      .filter((d): d is string => Boolean(d))
      .map(d => d.slice(0, 7))))
      .sort()
    return {
      ...c,
      used: (usages ?? []).reduce((sum, u) => sum + (u.amount ?? 0), 0),
      lastUsageDate,
      lastUsageMonth,
      usageMonths,
    }
  })
}

export async function upsertContract(supabase: SupabaseClient, contract: Partial<Contract>): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .upsert(contract)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteContract(supabase: SupabaseClient, id: number): Promise<void> {
  const { error } = await supabase.from('contracts').delete().eq('id', id)
  if (error) throw error
}

export async function getContractUsage(supabase: SupabaseClient, contractId: number): Promise<ContractUsage[]> {
  const { data, error } = await supabase
    .from('contract_usage')
    .select('*')
    .eq('contract_id', contractId)
    .order('usage_month', { ascending: false, nullsFirst: false })
    .order('usage_date', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data ?? []
}

export async function addContractUsage(
  supabase: SupabaseClient,
  usage: { contract_id: number; amount: number; note?: string; recorded_by?: string; usage_date?: string; usage_month?: string }
): Promise<ContractUsage> {
  const { data, error } = await supabase
    .from('contract_usage')
    .insert(usage)
    .select()
    .single()
  if (error) throw error
  return data
}
