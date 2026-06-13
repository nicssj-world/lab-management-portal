import { supabaseAdmin } from '@/lib/supabase/admin'
import type {
  Profile,
  StaffCertification,
  StaffTraining,
  StaffCompetency,
  StaffAuthorization,
  StaffJd,
  StaffTrainingPlan,
} from '@/lib/supabase/types'

export interface StaffDetail {
  profile: Profile
  certifications: StaffCertification[]
  training: StaffTraining[]
  competencies: StaffCompetency[]
  authorizations: StaffAuthorization[]
  jds: StaffJd[]
  trainingPlan: StaffTrainingPlan[]
}

// Roster — all active personnel (profiles are the staff registry)
export async function getStaffRoster(): Promise<Profile[]> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function getStaffProfile(id: string): Promise<Profile | null> {
  const { data } = await supabaseAdmin.from('profiles').select('*').eq('id', id).maybeSingle()
  return (data as Profile) ?? null
}

export async function getStaffDetail(id: string): Promise<StaffDetail | null> {
  const profile = await getStaffProfile(id)
  if (!profile) return null

  const [certs, training, comps, auths, jds, plan] = await Promise.all([
    supabaseAdmin.from('staff_certifications').select('*').eq('profile_id', id).is('deleted_at', null).order('expiry_date', { ascending: true }),
    supabaseAdmin.from('staff_training').select('*').eq('profile_id', id).is('deleted_at', null).order('training_date', { ascending: false }),
    supabaseAdmin.from('staff_competencies').select('*').eq('profile_id', id).is('deleted_at', null).order('assessment_date', { ascending: false }),
    supabaseAdmin.from('staff_authorizations').select('*').eq('profile_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
    supabaseAdmin.from('staff_jd').select('*').eq('profile_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
    supabaseAdmin.from('staff_training_plan').select('*').eq('profile_id', id).is('deleted_at', null).order('year', { ascending: false }),
  ])

  return {
    profile,
    certifications: (certs.data ?? []) as StaffCertification[],
    training: (training.data ?? []) as StaffTraining[],
    competencies: (comps.data ?? []) as StaffCompetency[],
    authorizations: (auths.data ?? []) as StaffAuthorization[],
    jds: (jds.data ?? []) as StaffJd[],
    trainingPlan: (plan.data ?? []) as StaffTrainingPlan[],
  }
}

// All active certifications (for roster summary + compliance) — joined with owner name
export async function getAllCertifications(): Promise<StaffCertification[]> {
  const { data } = await supabaseAdmin
    .from('staff_certifications')
    .select('*')
    .is('deleted_at', null)
  return (data ?? []) as StaffCertification[]
}

export async function getAllCompetencies(): Promise<StaffCompetency[]> {
  const { data } = await supabaseAdmin
    .from('staff_competencies')
    .select('*')
    .is('deleted_at', null)
  return (data ?? []) as StaffCompetency[]
}

export async function getAllTraining(): Promise<StaffTraining[]> {
  const { data } = await supabaseAdmin
    .from('staff_training')
    .select('*')
    .is('deleted_at', null)
  return (data ?? []) as StaffTraining[]
}

// Profile IDs that have at least one Active JD (for KPI coverage)
export async function getActiveJdProfileIds(): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from('staff_jd')
    .select('profile_id')
    .eq('status', 'Active')
    .is('deleted_at', null)
  return new Set((data ?? []).map((r) => r.profile_id as string))
}
