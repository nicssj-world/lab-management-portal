import type { LabAssemblyPointDefinition, LabSafetyEquipmentDefinition } from './types'

/**
 * ข้อมูลความปลอดภัยที่แยกจาก manifest.ts โดยตั้งใจ — ไม่แตะเรขาคณิตของผัง (ห้อง ผนัง ป้าย
 * จุดสแกน) เลยแม้แต่พิกัดเดียว เพื่อให้เจ้าหน้าที่ความปลอดภัยแก้ไฟล์นี้ไฟล์เดียวจบหลังเดินสำรวจ
 * โดยไม่กระทบเรขาคณิตที่ผ่านการอนุมัติแล้ว
 */

/**
 * ลิฟต์ที่ห้ามใช้ขณะเกิดเหตุฉุกเฉิน — อ้างรหัสห้องจาก LAB_SPACES ใน manifest.ts
 * แยกเป็น constant ต่างหากแทนการเพิ่ม field ลง LAB_SPACES เพื่อไม่ต้องแตะ manifest เรื่องผัง
 */
export const EVACUATION_RESTRICTED_SPACE_CODES = ['lift-1', 'lift-2', 'lift-3', 'lift-4'] as const

/**
 * จุดรวมพล — ยืนยันจากผู้ใช้: พื้นที่หน้าอาคารอำนวยการ (ด้านหน้าหอพระ) รองรับทางออกทั้งสามจุด
 * แก้ไขได้ภายหลังหากมีจุดรวมพลเพิ่มเติมต่อทางออก
 */
export const LAB_ASSEMBLY_POINTS: readonly LabAssemblyPointDefinition[] = [
  {
    code: 'assembly-front-admin-building',
    nameTh: 'พื้นที่หน้าอาคารอำนวยการ',
    detailTh: 'ด้านหน้าหอพระ',
    exitCodes: ['exit-3a', 'exit-3b', 'exit-3c'],
  },
]

/**
 * ถังดับเพลิง 11 จุด — แปลงพิกัดจากภาพผังหนีไฟฉบับติดผนัง (ปีงบประมาณ 2569) ด้วยการแปลงพิกัด
 * เชิงเส้นจากป้ายทางออก 3A/3B/3C ที่ตรงกันแน่นอนระหว่างสองภาพ (ไม่ใช้การจับคู่ตามชื่อห้อง
 * เพราะปีกตะวันตกของผังฉบับเก่ามี layout ต่างจากผังปัจจุบัน):
 *
 *   x = (px − 88.8) × 1.097     จาก 3A(180px)→100 และ 3B(1345px)→1378
 *   y = (py − 172.8) × 1.086    จาก 3B(287px)→124 และ 3C(845px)→730
 *
 * ทุกจุดยังไม่ยืนยันหน้างาน (`verified: false`) — release validator กันการเผยแพร่เป็นฉบับ
 * ใช้งานจริงไว้จนกว่าจะเดินสำรวจยืนยันครบทุกจุดตาม docs/lab-map/floor-3-acceptance.md
 */
export const LAB_SAFETY_EQUIPMENT: readonly LabSafetyEquipmentDefinition[] = [
  {
    code: 'extinguisher-1', kind: 'fire-extinguisher', nameTh: 'ถังดับเพลิง 1',
    x: 1195, y: 140, verified: false,
    sourceNoteTh: 'ผนังโถงเหนือ ใต้ BSL2 Enhance',
  },
  {
    code: 'extinguisher-2', kind: 'fire-extinguisher', nameTh: 'ถังดับเพลิง 2',
    x: 492, y: 168, verified: false,
    sourceNoteTh: 'โถงเหนือ ฝั่งตะวันตก',
  },
  {
    code: 'extinguisher-3', kind: 'fire-extinguisher', nameTh: 'ถังดับเพลิง 3',
    x: 841, y: 168, verified: false,
    sourceNoteTh: 'โถงเหนือ ช่วงกลาง',
  },
  {
    code: 'extinguisher-4', kind: 'fire-extinguisher', nameTh: 'ถังดับเพลิง 4',
    x: 522, y: 255, verified: false,
    sourceNoteTh: 'ฝั่งตะวันตก ใต้แนวโถงเหนือ — ปีกที่ผังฉบับเก่าต่างจากผังปัจจุบันมากที่สุด ให้ยืนยันเป็นลำดับแรก',
  },
  {
    code: 'extinguisher-5', kind: 'fire-extinguisher', nameTh: 'ถังดับเพลิง 5',
    x: 775, y: 239, verified: false,
    sourceNoteTh: 'แกนกลาง ตอนบน',
  },
  {
    code: 'extinguisher-6', kind: 'fire-extinguisher', nameTh: 'ถังดับเพลิง 6',
    x: 1022, y: 334, verified: false,
    sourceNoteTh: 'โถงระหว่างบล็อกกลางกับปีกตะวันออก',
  },
  {
    code: 'extinguisher-7', kind: 'fire-extinguisher', nameTh: 'ถังดับเพลิง 7',
    x: 775, y: 426, verified: false,
    sourceNoteTh: 'แกนกลาง ตอนกลาง ข้างห้องปฏิบัติการตรวจพิเศษ',
  },
  // ผู้ใช้ยืนยันตำแหน่งจริงที่ช่องเปิดฝั่งตะวันออกของห้องเตรียมเลือด
  // (ระหว่างห้องเตรียมเลือดกับปีกตะวันออก) จึงวางไว้ในโถงที่พิกัด (1039,596)
  {
    code: 'extinguisher-8', kind: 'fire-extinguisher', nameTh: 'ถังดับเพลิง 8',
    x: 1039, y: 596, verified: false,
    sourceNoteTh: 'ช่องเปิดฝั่งตะวันออกของห้องเตรียมเลือด ระหว่างห้องเตรียมเลือดกับปีกตะวันออก',
  },
  // ถังดับเพลิง 9 อยู่ที่รอยต่อระหว่างห้องแยกส่วนประกอบของเลือดกับห้องเตรียมเลือด
  // (y≈591 ตรงแนวผนังกั้นสองห้องนี้พอดี) คนละจุดกับถังดับเพลิง 7 และ 8
  {
    code: 'extinguisher-9', kind: 'fire-extinguisher', nameTh: 'ถังดับเพลิง 9',
    x: 778, y: 591, verified: false,
    sourceNoteTh: 'แกนกลาง รอยต่อระหว่างห้องแยกส่วนประกอบของเลือดกับห้องเตรียมเลือด',
  },
  {
    code: 'extinguisher-10', kind: 'fire-extinguisher', nameTh: 'ถังดับเพลิง 10',
    x: 1312, y: 551, verified: false,
    sourceNoteTh: 'ปีกตะวันออก ในห้องรับบริจาคเลือด ข้างห้องอาหารว่าง',
  },
  {
    code: 'extinguisher-11', kind: 'fire-extinguisher', nameTh: 'ถังดับเพลิง 11',
    x: 1208, y: 730, verified: false,
    sourceNoteTh: 'โถงใต้ ก่อนถึงทางออก 3C',
  },
]
