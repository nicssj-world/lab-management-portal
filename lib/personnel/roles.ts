export type MainPersonnelRole = 'Assistant' | 'Medical Technologist' | 'Medical Science Technician'

export const MAIN_PERSONNEL_ROLES: MainPersonnelRole[] = [
  'Assistant',
  'Medical Technologist',
  'Medical Science Technician',
]

export function mainPersonnelRole(role: string | null | undefined): MainPersonnelRole | null {
  if (role === 'Assistant') return 'Assistant'
  if (role === 'Medical Science Technician') return 'Medical Science Technician'
  if (role === 'Medical Technologist' || role === 'Manager' || role === 'Admin') return 'Medical Technologist'
  return null
}

export function hasMedicalTechnologistLicenseScope(role: string | null | undefined): boolean {
  return mainPersonnelRole(role) === 'Medical Technologist'
}

// Admin/Manager may manage other people's orientation, work assignments, training plans,
// competencies, dept structure, and competency exams (follows the lib/risk/access.ts pattern).
export function canManagePersonnel(role: string | null | undefined): boolean {
  return role === 'Admin' || role === 'Manager'
}
