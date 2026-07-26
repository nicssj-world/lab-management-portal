/** Lightweight room catalog for client-side forms; geometry stays out of the client bundle. */
export const LAB_MAP_SPACE_OPTIONS = [
  ['office', 'สำนักงานกลุ่มงานเทคนิคการแพทย์'], ['group-head-office', 'ห้องหัวหน้ากลุ่มงานเทคนิคการแพทย์'],
  ['meeting-room', 'ห้องประชุม'], ['central-lab-left', 'ห้องปฏิบัติการกลาง — ฝั่งซ้าย'],
  ['central-lab-right', 'ห้องปฏิบัติการกลาง — ฝั่งขวา'], ['clinical-immunology-room', 'ห้องปฏิบัติการภูมิคุ้มกันวิทยาคลินิก'],
  ['molecular-biology-lab', 'ห้องปฏิบัติการอณูชีววิทยา'], ['genomics-lab', 'ห้องปฏิบัติการจีโนมิกส์'],
  ['microbiology-lab', 'ห้องปฏิบัติการจุลชีววิทยาคลินิก'], ['infectious-diagnosis-room', 'ห้องวินิจฉัยเชื้อ'],
  ['bsl2-enhance', 'BSL2 Enhance'], ['pcr-room', 'ห้อง PCR'], ['culture-media-prep', 'ห้องเตรียมอาหารเลี้ยงเชื้อ'],
  ['specimen-prep', 'ห้องเตรียมตัวอย่าง'], ['material-store', 'คลังวัสดุ'],
  ['material-reagent-store', 'คลังวัสดุและน้ำยา'], ['cold-material-reagent-store', 'ห้องเก็บวัสดุและน้ำยาแช่เย็น'],
  ['special-testing-lab', 'ห้องปฏิบัติการตรวจพิเศษ'], ['blood-donation-room', 'ห้องรับบริจาคเลือด'],
  ['blood-component-room', 'ห้องแยกส่วนประกอบของเลือด'], ['blood-prep-room', 'ห้องเตรียมเลือด'],
  ['ppe-zone', 'โซน PPE'], ['equipment-wash', 'ห้องล้างอุปกรณ์'], ['chemical-prep', 'ห้องเตรียมสารเคมี'],
  ['electrical-control', 'ห้องควบคุมไฟฟ้า'], ['computer-control', 'ห้องควบคุมระบบคอมพิวเตอร์'],
] as const
