import type { SupabaseClient } from '@supabase/supabase-js'
import type { Contract, ContractUsage } from '@/lib/supabase/types'

export interface ContractWithUsage extends Contract {
  used: number
}

export async function getContracts(supabase: SupabaseClient): Promise<ContractWithUsage[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select(`
      *,
      contract_usage(amount)
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((c) => ({
    ...c,
    used: (c.contract_usage as { amount: number }[])?.reduce((sum, u) => sum + (u.amount ?? 0), 0) ?? 0,
  }))
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
    .order('usage_date', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function addContractUsage(
  supabase: SupabaseClient,
  usage: { contract_id: number; amount: number; note?: string; recorded_by?: string; usage_date?: string }
): Promise<ContractUsage> {
  const { data, error } = await supabase
    .from('contract_usage')
    .insert(usage)
    .select()
    .single()
  if (error) throw error
  return data
}
