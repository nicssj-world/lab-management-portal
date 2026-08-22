// แหล่งเดียวของการแมป "ความหมาย → ภาพ" ของโมดูลความปลอดภัยสารเคมี
// ทุก client ใน components/chemical-safety/ ต้อง import จากไฟล์นี้ ห้ามประกาศแผนที่สีซ้ำในไฟล์ตัวเอง
//
// กติกาสำคัญ: ห้ามสื่อความหมายด้วยสีอย่างเดียว ทุกตัวบ่งชี้ต้องมีอย่างน้อย 2 ช่องทาง
// (สี + ข้อความ หรือ สี + ไอคอน) เพื่อให้อ่านได้เมื่อพิมพ์ขาวดำและสำหรับผู้ที่ตาบอดสี

import type { CSSProperties } from 'react'
import type { BadgeColor } from '@/components/ui/Badge'
import { CHEMICAL_ZONE_META } from '@/lib/chemical-safety/storage-manifest'
import type { ChemicalStorageZoneCode } from '@/lib/chemical-safety/types'

// ── ระยะและขนาดตัวอักษร (สเกลเดียวกับโมดูลความเสี่ยง) ───────────────────────
export const SPACE = { xs: 8, sm: 12, md: 16, lg: 24, xl: 32 } as const
export const FONT = { xs: 11, sm: 11.5, base: 12.5, md: 13, lg: 14, xl: 20, xxl: 25 } as const

export const tabularNums: CSSProperties = { fontVariantNumeric: 'tabular-nums' }

export const SDS_ONLY_CAPTURE_LABEL = 'มี SDS แล้ว · ยังไม่ระบุปริมาณ'

// ── สถานะเอกสาร SDS ─────────────────────────────────────────────────────────
export type SdsWorkflowStatus = 'draft' | 'in_review' | 'approved' | 'superseded' | 'rejected'

export interface StatusMeta {
  label: string
  tone: BadgeColor
  icon: string
}

export const SDS_STATUS_META: Record<SdsWorkflowStatus, StatusMeta> = {
  draft: { label: 'ฉบับร่าง', tone: 'gray', icon: 'edit' },
  in_review: { label: 'รอตรวจสอบ', tone: 'amber', icon: 'clock' },
  approved: { label: 'พร้อมใช้งาน', tone: 'green', icon: 'shieldCheck' },
  superseded: { label: 'ฉบับเก่า · มีฉบับใหม่แล้ว', tone: 'purple', icon: 'inbox' },
  rejected: { label: 'ต้องแก้ไขข้อมูล', tone: 'red', icon: 'x' },
}

export function sdsStatusMeta(value?: string | null): StatusMeta {
  return SDS_STATUS_META[(value ?? '') as SdsWorkflowStatus] ?? { label: value || '—', tone: 'gray', icon: 'doc' }
}

// ── สถานะ SDS ของสารในทะเบียน (ผลลัพธ์ของ currentSdsState) ──────────────────
export type SdsRegistryState = 'approved' | 'review_due' | 'draft' | 'mismatch' | 'missing'

export const SDS_STATE_META: Record<SdsRegistryState, StatusMeta> = {
  approved: { label: 'มี SDS แล้ว', tone: 'green', icon: 'shieldCheck' },
  review_due: { label: 'ถึงกำหนดตรวจทาน', tone: 'amber', icon: 'clock' },
  draft: { label: 'ฉบับร่าง · ยังไม่พร้อมใช้งาน', tone: 'blue', icon: 'edit' },
  mismatch: { label: 'ไฟล์ไม่ตรงกับสาร', tone: 'red', icon: 'alert' },
  missing: { label: 'ยังไม่มี SDS', tone: 'gray', icon: 'inbox' },
}

export function sdsStateMeta(value?: string | null): StatusMeta {
  return SDS_STATE_META[(value ?? '') as SdsRegistryState] ?? SDS_STATE_META.missing
}

// ── โซนจัดเก็บ A/B/C/T ──────────────────────────────────────────────────────
// สีมาจาก LOCATION_GROUP_COLORS ผ่าน CHEMICAL_ZONE_META แหล่งเดียว
// ตู้ทุกใบมีรหัสตัวอักษรกำกับอยู่แล้ว (A1, B3, …) จึงไม่ได้สื่อความหมายด้วยสีล้วน
export const ZONE_META = CHEMICAL_ZONE_META

export function zoneColor(zoneCode?: string | null): string {
  return ZONE_META.find(zone => zone.code === zoneCode)?.color ?? 'var(--muted)'
}

export function zoneTitle(zoneCode?: string | null): string {
  return ZONE_META.find(zone => zone.code === zoneCode)?.titleTh ?? 'ไม่ระบุตำแหน่ง'
}

export const ZONE_CODES: readonly ChemicalStorageZoneCode[] = ZONE_META.map(zone => zone.code)

// ── ที่มาของสัญลักษณ์ GHS ───────────────────────────────────────────────────
// ต้องบอกเสมอว่าสัญลักษณ์มาจากเอกสาร SDS หรือจากบัญชีรายการสารเคมี
export const GHS_SOURCE_META: Record<'sds' | 'masterlist', { label: string; tone: BadgeColor; hint: string }> = {
  sds: {
    label: 'จาก SDS',
    tone: 'green',
    hint: 'สัญลักษณ์มาจากข้อมูลในเอกสาร SDS ของรายการนี้',
  },
  masterlist: {
    label: 'จากบัญชีสารเคมี',
    tone: 'blue',
    hint: 'สัญลักษณ์มาจากข้อมูล GHS เบื้องต้นในทะเบียนสารเคมี',
  },
}

// ── การเผยแพร่คลัง SDS ของงาน ───────────────────────────────────────────────
export const DEPARTMENT_PUBLISH_META: Record<'draft' | 'published', StatusMeta> = {
  draft: { label: 'ยังไม่เผยแพร่', tone: 'gray', icon: 'lock' },
  published: { label: 'เผยแพร่แล้ว', tone: 'green', icon: 'globe' },
}
