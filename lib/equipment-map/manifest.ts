import type {
  EquipmentAreaDefinition,
  EquipmentAreaLabel,
  EquipmentDoorDefinition,
  EquipmentRect,
  EquipmentWallDefinition,
} from './types'

/**
 * ผังเครื่องมือชั้น 3 — พิกัดทุกค่าถอดมาจากไฟล์ต้นฉบับ `แผนผังกลุ่มงาน2569.pptx` โดยตรง
 * (อ่าน EMU จาก ppt/slides/slide1.xml แล้วแปลงเป็นหน่วยนิ้ว ไม่ได้กะจากภาพ)
 *
 * **ผังนี้เป็นคนละแบบกับแผนที่ความปลอดภัย** (lib/lab-map) — ตำแหน่งและสัดส่วนห้องไม่ตรงกัน
 * จึงไม่ import geometry จากที่นั่นอีกต่อไป การพยายามผูกสองผังเข้าด้วยกันคือสาเหตุที่ผังเครื่องมือ
 * เคยแสดงห้องผิดตำแหน่งทั้งหมด ถ้าต้องแก้พิกัด ให้แก้ที่ .pptx แล้วถอดค่าใหม่ อย่าแก้มือทีละตัว
 */
export const EQUIPMENT_MAP_VERSION = 'EQ-F3-2569.07.28-18'
export const EQUIPMENT_MAP_VIEW_BOX = '0 0 1380 796'

/** จุดกำเนิดและสเกลที่ใช้แปลงนิ้วจาก .pptx → หน่วย SVG (1 นิ้ว = 100 หน่วย) */
const ORIGIN_X_IN = 0.15
const ORIGIN_Y_IN = 1.60
const SCALE = 100

const toX = (inches: number) => Math.round((inches - ORIGIN_X_IN) * SCALE)
const toY = (inches: number) => Math.round((inches - ORIGIN_Y_IN) * SCALE)

/** สี่เหลี่ยมจากพิกัดนิ้วในไฟล์ต้นฉบับ (x, y = มุมบนซ้าย; w, h = กว้าง/สูง) */
const rectIn = (x: number, y: number, w: number, h: number): EquipmentRect => ({
  x: toX(x),
  y: toY(y),
  width: Math.round(w * SCALE),
  height: Math.round(h * SCALE),
})

const labelIn = (x: number, y: number, lines: readonly string[], fontSize = 15): EquipmentAreaLabel => ({
  x: toX(x),
  y: toY(y),
  lines,
  fontSize,
})

const wall = (code: string, d: string): EquipmentWallDefinition => ({ code, d })

/** แปลงจุดศูนย์กลางประตูจากพิกเซลใน Screenshot 2026-07-27 222236.png โดยอิงกรอบผังจริง */
const doorPx = (
  code: string,
  pixelX: number,
  pixelY: number,
  orientation: EquipmentDoorDefinition['orientation'],
  pixelLength = 55,
): EquipmentDoorDefinition => ({
  code,
  x: Math.round(((pixelX - 21) / (2158 - 21)) * 1370),
  y: Math.round(((pixelY - 61) / (1290 - 61)) * 786),
  orientation,
  length: Math.round((pixelLength / (orientation === 'horizontal' ? 2158 - 21 : 1290 - 61)) * (orientation === 'horizontal' ? 1370 : 786)),
})

/**
 * ผนังเดี่ยวที่ไม่ใช่ขอบของห้องใดห้องหนึ่ง — ถอดจาก shape ชนิด line ใน .pptx ทั้ง 18 เส้น
 * (ขอบห้องวาดเองอยู่แล้วจาก rect ของแต่ละพื้นที่)
 */
export const EQUIPMENT_WALLS: readonly EquipmentWallDefinition[] = [
  wall('wall-1', 'M 398 183 V 317'),
  wall('wall-2', 'M 398 184 H 516'),
  wall('wall-3', 'M 283 185 H 325'),
  wall('wall-4', 'M 357 185 H 398'),
  wall('wall-5', 'M 715 281 V 315'),
  wall('wall-7', 'M 715 345 V 379'),
  wall('wall-8', 'M 283 346 V 470'),
  wall('wall-9', 'M 654 350 V 400'),
  wall('wall-11', 'M 596 400 V 437'),
  wall('wall-12', 'M 596 400 H 654'),
  wall('wall-13', 'M 1370 400 V 786'),
  wall('wall-14', 'M 984 408 V 493'),
  wall('wall-15', 'M 283 470 H 470'),
  wall('wall-16', 'M 984 520 V 574'),
  wall('wall-17', 'M 984 569 V 657'),
  wall('wall-18', 'M 985 786 H 1370'),
  wall('wall-microbiology-inner', 'M 936 205 H 1370'),
  wall('wall-microbiology-corridor-west', 'M 936 151 V 205'),
]

/** ช่องประตูที่เห็นในภาพอ้างอิง (สัญลักษณ์ขีดคู่) */
export const EQUIPMENT_DOORS: readonly EquipmentDoorDefinition[] = [
  doorPx('door-h-1', 1940, 146, 'horizontal'),
  doorPx('door-h-2', 1523, 212, 'horizontal'),
  doorPx('door-h-3', 1783, 212, 'horizontal'),
  doorPx('door-h-4', 1710, 296, 'horizontal'),
  doorPx('door-h-5', 692.5, 297, 'horizontal'),
  doorPx('door-h-6', 1167.5, 296.5, 'horizontal'),
  doorPx('door-h-7', 1319, 296.5, 'horizontal'),
  doorPx('door-h-8', 1523, 297, 'horizontal'),
  doorPx('door-h-9', 1614, 297, 'horizontal'),
  doorPx('door-h-24', 60, 350, 'horizontal'),
  doorPx('door-h-10', 138, 350, 'horizontal'),
  doorPx('door-h-11', 934, 349, 'horizontal'),
  doorPx('door-h-12', 1202, 350, 'horizontal'),
  doorPx('door-h-13', 215, 350, 'horizontal'),
  doorPx('door-h-14', 367, 350, 'horizontal'),
  doorPx('door-h-15', 1364, 350, 'horizontal'),
  doorPx('door-h-16', 516, 357, 'horizontal'),
  doorPx('door-h-17', 1580, 377.5, 'horizontal'),
  doorPx('door-h-18', 1448, 700, 'horizontal'),
  doorPx('door-h-19', 851, 687.5, 'horizontal'),
  doorPx('door-h-20', 998, 687.5, 'horizontal'),
  doorPx('door-h-21', 1176, 773, 'horizontal'),
  doorPx('door-h-22', 1474.5, 1162, 'horizontal', 72),
  doorPx('door-h-23', 996, 1185, 'horizontal'),
  doorPx('door-v-1', 20, 321, 'vertical'),
  doorPx('door-v-3', 729, 321.5, 'vertical'),
  doorPx('door-v-4', 859.5, 1214.5, 'vertical'),
  doorPx('door-v-5', 950, 768.5, 'vertical'),
  doorPx('door-v-6', 1041, 830, 'vertical'),
  doorPx('door-v-7', 1041, 1106.5, 'vertical'),
  doorPx('door-v-8', 1135, 547, 'vertical'),
  doorPx('door-v-9', 1135, 603, 'vertical'),
  doorPx('door-v-10', 1135, 715, 'vertical'),
  doorPx('door-v-11', 1135, 1040, 'vertical'),
  doorPx('door-v-12', 1391, 919.5, 'vertical'),
  doorPx('door-v-13', 1391, 1123, 'vertical'),
  doorPx('door-v-14', 1481.5, 530.5, 'vertical'),
  doorPx('door-v-15', 1556, 1251, 'vertical'),
  doorPx('door-v-16', 1663, 253, 'vertical'),
  doorPx('door-v-17', 1752, 111, 'vertical'),
  doorPx('door-v-18', 1752, 253, 'vertical'),
  doorPx('door-v-19', 1887, 343, 'vertical'),
  doorPx('door-v-20', 1987, 212, 'vertical'),
  doorPx('door-v-21', 2158, 269, 'vertical'),
]

/**
 * ห้องและโซนทั้งหมด — พิกัดนิ้วตรงตาม .pptx
 *
 * กติกา: โซน (kind 'zone') ต้องปูเต็มพื้นที่ห้องแม่พอดี ไม่เหลือช่องว่างและไม่ทับกัน
 * (validate.ts บังคับ) ใช้ซอยเฉพาะห้องที่ผังต้นฉบับเขียนหลายชื่องานไว้ในห้องเดียว
 *
 * เส้นแบ่งโซนในห้องปฏิบัติการกลางและห้องตรวจพิเศษ กำหนดจากช่องว่างระหว่างกลุ่มครุภัณฑ์
 * ในผังต้นฉบับ ไม่ใช่ผนังจริง — ยืนยันเส้นแบ่งตอนเดินตรวจหน้างานได้
 */
export const EQUIPMENT_AREAS: readonly EquipmentAreaDefinition[] = [
  // ── แถบทิศเหนือ ──
  {
    code: 'room-nw-corner', nameTh: 'ห้องมุมตะวันตกเฉียงเหนือ', kind: 'room',
    rect: rectIn(0.15, 1.60, 1.38, 1.51), label: labelIn(0.84, 2.35, ['ห้องมุม', 'ตะวันตกเฉียงเหนือ'], 12),
  },
  {
    code: 'room-nw-store', nameTh: 'ห้องเก็บของทิศเหนือ', kind: 'room',
    rect: rectIn(1.53, 1.60, 1.34, 1.51), label: labelIn(2.20, 2.35, ['ห้องเก็บของ', 'ทิศเหนือ'], 12),
  },
  {
    code: 'room-central-lab', nameTh: 'ห้องปฏิบัติการกลาง', kind: 'room',
    rect: rectIn(2.87, 1.60, 6.65, 1.51),
  },
  {
    code: 'zone-central-chem-immuno', nameTh: 'เคมีคลินิก + ภูมิคุ้มกัน', kind: 'zone',
    parentCode: 'room-central-lab',
    rect: rectIn(2.87, 1.60, 2.66, 1.51), label: labelIn(4.20, 2.45, ['เคมีคลินิก', '+ ภูมิคุ้มกัน'], 15),
  },
  {
    code: 'zone-central-microscopy', nameTh: 'จุลทรรศนศาสตร์', kind: 'zone',
    parentCode: 'room-central-lab',
    rect: rectIn(5.53, 1.60, 2.39, 1.51), label: labelIn(6.73, 2.45, ['จุลทรรศนศาสตร์'], 15),
  },
  {
    code: 'zone-central-hematology', nameTh: 'โลหิตวิทยา', kind: 'zone',
    parentCode: 'room-central-lab',
    rect: rectIn(7.92, 1.60, 1.60, 1.51), label: labelIn(8.72, 2.45, ['โลหิตวิทยา'], 15),
  },
  {
    code: 'room-north-lab-1', nameTh: 'ห้องปฏิบัติการทิศเหนือ 1', kind: 'room',
    rect: rectIn(9.52, 1.60, 1.73, 0.97), label: labelIn(10.38, 2.08, ['ห้องปฏิบัติการ', 'ทิศเหนือ 1'], 12),
  },
  {
    code: 'room-north-lab-2', nameTh: 'ห้องปฏิบัติการทิศเหนือ 2', kind: 'room',
    rect: rectIn(11.25, 1.60, 0.87, 1.15), label: labelIn(11.68, 2.17, ['ห้องปฏิบัติการ', 'ทิศเหนือ 2'], 11),
  },
  {
    code: 'room-north-small', nameTh: 'ห้องเล็กทิศเหนือ', kind: 'room',
    rect: rectIn(12.12, 1.60, 0.64, 0.54), label: labelIn(12.44, 1.87, ['ห้องเล็ก'], 10),
  },
  {
    code: 'room-north-lab-3', nameTh: 'ห้องปฏิบัติการทิศเหนือ 3', kind: 'room',
    rect: rectIn(12.76, 1.60, 1.09, 1.15), label: labelIn(13.30, 2.17, ['ห้องปฏิบัติการ', 'ทิศเหนือ 3'], 11),
  },
  // โถงทิศเหนือเป็น 3 ห้องแยก (มีผนัง/รูปทรงคนละกล่องใน .pptx จริง ไม่ใช่ห้องเดียวยาว)
  {
    code: 'room-north-corridor-1', nameTh: 'โถงทิศเหนือ 1', kind: 'room',
    rect: rectIn(9.52, 2.57, 0.52, 0.54), label: labelIn(9.78, 2.84, ['โถง 1'], 10),
  },
  {
    code: 'room-north-corridor-2', nameTh: 'โถงทิศเหนือ 2', kind: 'room',
    rect: rectIn(10.04, 2.57, 0.64, 0.54), label: labelIn(10.36, 2.84, ['โถง 2'], 10),
  },
  {
    code: 'room-north-corridor-3', nameTh: 'โถงทิศเหนือ 3', kind: 'room',
    rect: rectIn(10.68, 2.57, 0.57, 0.54), label: labelIn(10.97, 2.84, ['โถง 3'], 10),
  },
  {
    // ห้องแยกมุมขวาบนตามภาพอ้างอิง — พื้นที่ด้านซ้ายของห้องนี้เป็นทางเดิน ไม่ใช่โซนจุลชีววิทยา
    code: 'room-microbiology-ne', nameTh: 'ห้องมุมขวาบนจุลชีววิทยา', kind: 'room',
    rect: rectIn(12.12, 3.11, 1.73, 0.54), label: labelIn(12.99, 3.38, ['มุมขวาบน', 'จุลชีววิทยา'], 10),
  },
  {
    // กรอบรวมจุลชีววิทยาและคลังน้ำยาเริ่มใต้ทางเดิน; โซนลูกสองโซนเป็นรูปตัว L ประกบกัน
    code: 'room-microbiology', nameTh: 'จุลชีววิทยา', kind: 'room',
    rect: rectIn(9.51, 3.65, 4.34, 2.04),
  },
  {
    code: 'zone-microbiology-main', nameTh: 'จุลชีววิทยา', kind: 'zone',
    parentCode: 'room-microbiology',
    rect: rectIn(9.51, 3.65, 4.34, 2.04),
    polygon: [
      { x: toX(9.51), y: toY(3.65) },
      { x: toX(13.85), y: toY(3.65) },
      { x: toX(13.85), y: toY(5.00) },
      { x: toX(10.73), y: toY(5.00) },
      { x: toX(10.73), y: toY(4.38) },
      { x: toX(9.51), y: toY(4.38) },
    ],
    label: labelIn(11.68, 4.00, ['จุลชีววิทยา'], 14),
  },

  // ── แถบกลาง ──
  // ห้องอณูชีววิทยาเป็นห้องแม่ที่มี 4 โซนตามที่ผู้ใช้กำหนด (ไม่อิงผังต้นฉบับ) โซนขวาสุดกว้างที่สุด
  // คงรหัส 'zone-molecular-genomics' ไว้ที่ห้องแม่ เพราะเครื่องมือบางชิ้นผูก area_code กับรหัสนี้ไปแล้ว
  {
    code: 'zone-molecular-genomics', nameTh: 'อณูชีววิทยา', kind: 'room',
    rect: rectIn(0.15, 3.45, 2.83, 1.65),
  },
  {
    code: 'zone-molecular-1', nameTh: 'อณูชีววิทยา (โซน 1)', kind: 'zone',
    parentCode: 'zone-molecular-genomics',
    rect: rectIn(0.15, 3.45, 0.50, 1.65), label: labelIn(0.40, 4.27, ['โซน 1'], 11),
  },
  {
    code: 'zone-molecular-2', nameTh: 'อณูชีววิทยา (โซน 2)', kind: 'zone',
    parentCode: 'zone-molecular-genomics',
    rect: rectIn(0.65, 3.45, 0.50, 1.65), label: labelIn(0.90, 4.27, ['โซน 2'], 11),
  },
  {
    code: 'zone-molecular-3', nameTh: 'อณูชีววิทยา (โซน 3)', kind: 'zone',
    parentCode: 'zone-molecular-genomics',
    rect: rectIn(1.15, 3.45, 0.50, 1.65), label: labelIn(1.40, 4.27, ['โซน 3'], 11),
  },
  {
    // โซนขวาสุด — กว้างที่สุดในสี่โซนตามที่ผู้ใช้ระบุ
    code: 'zone-molecular-4', nameTh: 'อณูชีววิทยา (โซน 4)', kind: 'zone',
    parentCode: 'zone-molecular-genomics',
    rect: rectIn(1.65, 3.45, 1.33, 1.65), label: labelIn(2.32, 4.27, ['โซน 4'], 13),
  },
  {
    // ห้องล้างรวมพื้นที่ด้านล่างซ้ายและด้านขวาใต้ห้องภูมิคุ้มกัน แต่ไม่ทับห้องดูดควันสองห้อง
    code: 'zone-equipment-wash', nameTh: 'ห้องล้าง', kind: 'room',
    rect: rectIn(2.98, 3.44, 3.71, 2.86),
    polygon: [
      { x: toX(2.98), y: toY(3.44) },
      { x: toX(5.31), y: toY(3.44) },
      { x: toX(5.31), y: toY(5.10) },
      { x: toX(6.69), y: toY(5.10) },
      { x: toX(6.69), y: toY(5.60) },
      { x: toX(4.85), y: toY(5.60) },
      { x: toX(4.85), y: toY(6.30) },
      { x: toX(2.98), y: toY(6.30) },
    ],
    label: labelIn(4.14, 4.90, ['ห้องล้าง'], 15),
  },
  {
    code: 'zone-clinical-immunology', nameTh: 'ภูมิคุ้มกัน', kind: 'room',
    rect: rectIn(5.31, 3.45, 1.38, 1.65), label: labelIn(6.00, 4.27, ['ภูมิคุ้มกัน'], 14),
  },
  {
    // ภาพอ้างอิงมีผนังตั้งแบ่งพื้นที่เดิมเป็น 2 ห้อง โดยห้องซ้ายแคบกว่าห้องขวา
    // คงรหัสเดิมไว้กับห้องซ้าย เพื่อไม่ให้เครื่องมือที่ผูกพื้นที่นี้อยู่หลุดการเชื่อมโยง
    code: 'room-centre-upper', nameTh: 'ห้องกลางด้านบน 1', kind: 'room',
    rect: rectIn(7.30, 3.45, 0.74, 0.97), label: labelIn(7.67, 3.93, ['ห้องกลาง', 'ด้านบน 1'], 10),
  },
  {
    code: 'room-centre-upper-2', nameTh: 'ห้องกลางด้านบน 2', kind: 'room',
    rect: rectIn(8.04, 3.45, 0.90, 0.97), label: labelIn(8.49, 3.93, ['ห้องกลาง', 'ด้านบน 2'], 10),
  },
  {
    // ปรับความกว้างให้เท่ากับตรวจพิเศษและตรวจต่อ (1.64) ตามที่ผู้ใช้ระบุ — เดิมกว้างกว่า (1.79)
    code: 'zone-cold-storage', nameTh: 'ตู้เย็น', kind: 'room',
    rect: rectIn(7.30, 4.42, 1.64, 0.97), label: labelIn(8.12, 4.90, ['ตู้เย็น'], 15),
  },
  {
    // เดิมเข้าใจผิดว่าเป็นห้องแยกต่างหาก ("คลังน้ำยา" รูปตัว L) — ผู้ใช้ยืนยันว่าคลังน้ำยาเป็นโซนของ
    // จุลชีววิทยา จึงย้ายมาเป็นลูกของ room-microbiology และย่อขนาดให้เหลือเฉพาะส่วนที่มีครุภัณฑ์จริง
    // (คงรหัสเดิมไว้ ไม่มีเครื่องมือผูก area_code กับรหัสนี้อยู่ก่อน จึงเปลี่ยน kind/parent/รูปทรงได้อิสระ)
    code: 'zone-material-reagent-store', nameTh: 'คลังน้ำยา', kind: 'zone',
    parentCode: 'room-microbiology',
    rect: rectIn(9.51, 4.38, 4.34, 1.31),
    polygon: [
      { x: toX(9.51), y: toY(4.38) },
      { x: toX(10.73), y: toY(4.38) },
      { x: toX(10.73), y: toY(5.00) },
      { x: toX(13.85), y: toY(5.00) },
      { x: toX(13.85), y: toY(5.69) },
      { x: toX(9.51), y: toY(5.69) },
    ],
    label: labelIn(10.12, 5.05, ['คลังน้ำยา'], 13),
  },

  // ── แถบใต้ ──
  {
    code: 'zone-special-testing', nameTh: 'ตรวจพิเศษและตรวจต่อ', kind: 'room',
    rect: rectIn(7.30, 5.39, 1.64, 4.07), label: labelIn(8.12, 5.55, ['ตรวจพิเศษและตรวจต่อ'], 12),
  },
  {
    code: 'zone-special-testing-upper-1', nameTh: 'ตรวจพิเศษ (โซนบน 1)', kind: 'zone',
    parentCode: 'zone-special-testing',
    rect: rectIn(7.30, 5.39, 1.64, 0.76), label: labelIn(8.12, 5.77, ['โซนบน 1'], 11),
  },
  {
    code: 'zone-special-testing-upper-2', nameTh: 'ตรวจพิเศษ (โซนบน 2)', kind: 'zone',
    parentCode: 'zone-special-testing',
    rect: rectIn(7.30, 6.15, 1.64, 0.75), label: labelIn(8.12, 6.53, ['โซนบน 2'], 11),
  },
  {
    code: 'zone-special-testing-mid', nameTh: 'ตรวจพิเศษ (โซนกลาง)', kind: 'zone',
    parentCode: 'zone-special-testing',
    rect: rectIn(7.30, 6.90, 1.64, 0.72), label: labelIn(8.12, 7.26, ['โซนกลาง'], 12), fillTone: 'controlled',
  },
  {
    code: 'zone-special-testing-lower', nameTh: 'ตรวจพิเศษ (โซนล่าง)', kind: 'zone',
    parentCode: 'zone-special-testing',
    rect: rectIn(7.30, 7.62, 1.64, 1.84), label: labelIn(8.12, 8.54, ['โซนล่าง'], 12), fillTone: 'controlled',
  },
  {
    // x เริ่มที่ 8.94 (ไม่ใช่ 8.93 ตาม .pptx เป๊ะ ๆ) เพื่อไม่ให้ปัดเศษแล้วทับขอบขวาของห้องตรวจพิเศษ
    code: 'zone-blood-bank', nameTh: 'คลังเลือด', kind: 'room',
    rect: rectIn(8.94, 5.69, 1.05, 2.96), label: labelIn(9.46, 7.17, ['คลังเลือด'], 14), fillTone: 'controlled',
  },
  {
    code: 'room-fume-hood', nameTh: 'ห้องดูดควัน', kind: 'room',
    rect: rectIn(4.86, 5.60, 0.83, 0.70), label: labelIn(5.27, 5.95, ['ห้องดูดควัน'], 11),
  },
  {
    code: 'room-fume-hood-side', nameTh: 'ห้องข้างห้องดูดควัน', kind: 'room',
    rect: rectIn(5.69, 5.60, 0.42, 0.70), label: labelIn(5.90, 5.95, ['ห้องข้าง'], 9),
  },
  {
    code: 'room-sw-1', nameTh: 'ห้องว่างตะวันตกเฉียงใต้ 1', kind: 'room',
    rect: rectIn(4.86, 6.30, 1.84, 1.09), label: labelIn(5.78, 6.85, ['ห้องว่าง', 'ตะวันตกเฉียงใต้ 1'], 12),
  },
  {
    code: 'room-sw-2', nameTh: 'ห้องว่างตะวันตกเฉียงใต้ 2', kind: 'room',
    rect: rectIn(4.85, 7.39, 1.84, 1.41), label: labelIn(5.77, 8.10, ['ห้องว่าง', 'ตะวันตกเฉียงใต้ 2'], 12),
  },
  {
    code: 'room-sw-3', nameTh: 'ห้องว่างตะวันตกเฉียงใต้ 3', kind: 'room',
    rect: rectIn(4.85, 8.80, 0.67, 0.66), label: labelIn(5.19, 9.13, ['ห้องว่าง 3'], 10),
  },
  {
    code: 'room-sw-4', nameTh: 'ห้องว่างตะวันตกเฉียงใต้ 4', kind: 'room',
    rect: rectIn(5.52, 8.80, 1.17, 0.66), label: labelIn(6.11, 9.13, ['ห้องว่าง 4'], 10),
  },
  {
    code: 'room-se-1', nameTh: 'ห้องทิศตะวันออกเฉียงใต้ 1', kind: 'room',
    rect: rectIn(9.99, 7.31, 0.79, 1.33), label: labelIn(10.39, 7.98, ['ห้อง', 'ตะวันออก', 'เฉียงใต้ 1'], 10), fillTone: 'controlled',
  },
  {
    code: 'room-se-2', nameTh: 'ห้องทิศตะวันออกเฉียงใต้ 2', kind: 'room',
    rect: rectIn(8.94, 8.65, 1.05, 0.82), label: labelIn(9.47, 9.06, ['ห้องตะวันออก', 'เฉียงใต้ 2'], 10),
  },
]

/**
 * รหัสของพื้นที่นั้นเอง บวกโซนลูกทั้งหมด (ถ้ามี) — ใช้กรองทะเบียนเครื่องมือเมื่อผู้ใช้เลือก "ห้อง"
 * ต้องครอบคลุมเครื่องมือของโซนลูกด้วย ไม่ใช่แค่เครื่องที่ area_code ตรงกับห้องเป๊ะ ๆ
 */
export function areaAndDescendantCodes(code: string): string[] {
  const children = EQUIPMENT_AREAS.filter((area) => area.parentCode === code).map((area) => area.code)
  return [code, ...children]
}
