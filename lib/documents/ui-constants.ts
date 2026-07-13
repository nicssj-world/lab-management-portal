import type { DocStatus } from '@/lib/documents/transitions'

// Shared display constants + formatters for the Quality Documents module —
// used by the documents library table, the detail modal, and the categories page.
export const TYPE_ICON_BG: Record<string, string> = {
  QP: 'rgba(30,95,173,.10)', WI: 'rgba(13,148,136,.10)', Form: 'rgba(147,51,234,.10)',
  Policy: 'rgba(217,119,6,.10)', Manual: 'rgba(22,163,74,.10)', QM: 'rgba(5,150,105,.10)',
  Reference: 'rgba(234,88,12,.10)', 'Card file': 'rgba(245,158,11,.10)', Lb: 'rgba(79,70,229,.10)', Others: 'rgba(100,116,139,.10)',
}
export const TYPE_ICON_FG: Record<string, string> = {
  QP: '#1E5FAD', WI: '#0D9488', Form: '#9333EA',
  Policy: '#D97706', Manual: '#16A34A', QM: '#059669', Reference: '#EA580C', 'Card file': '#F59E0B', Lb: '#4F46E5', Others: '#64748B',
}
// Read-report "กลุ่มผู้อ่าน" badges — one accent per department (lib/validations/user-schema DEPARTMENTS)
// so different reader groups are distinguishable at a glance instead of one flat color.
export const DEPT_BADGE_FG: Record<string, string> = {
  'สำนักงานกลุ่มงานเทคนิคการแพทย์': '#64748B',
  'งานเคมีคลินิก': '#DC2626',
  'งานโลหิตวิทยาคลินิก': '#D97706',
  'งานภูมิคุ้มกันวิทยาคลินิก': '#7C3AED',
  'งานจุลทรรศนศาสตร์คลินิก': '#0D9488',
  'งานอณูชีววิทยา': '#4F46E5',
  'งานจุลชีววิทยา': '#16A34A',
  'งานคลังเลือด': '#E11D48',
  'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ': '#EA580C',
  'งานบริการผู้ป่วยนอก': '#2563EB',
  'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี': '#0891B2',
}
export const DEPT_BADGE_MIXED_FG = '#9333EA' // 2+ departments combined — no single dept to color by

export const STATUS_LABEL: Record<DocStatus, string> = {
  Draft: 'Draft', Review: 'Review', Approved: 'Approved',
  Published: 'Published', Obsolete: 'Obsolete',
}
export const STATUS_COLOR: Record<DocStatus, 'gray' | 'amber' | 'blue' | 'green' | 'red'> = {
  Draft: 'gray', Review: 'amber', Approved: 'blue', Published: 'green', Obsolete: 'red',
}

export function fmtSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
export function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}
