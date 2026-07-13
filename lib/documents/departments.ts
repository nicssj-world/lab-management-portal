// Departments for the Quality Documents module — matches the values stored in
// documents.department (set via the create/edit form). Distinct from the personnel
// department list in lib/validations/user-schema.ts (different naming/order).
export const DOCUMENT_DEPARTMENTS = [
  'กลุ่มงานเทคนิคการแพทย์',
  'งานเคมีคลินิก',
  'งานภูมิคุ้มกันวิทยาคลินิก',
  'งานโลหิตวิทยาคลินิก',
  'งานจุลทรรศน์ศาสตร์คลินิก',
  'งานจุลชีววิทยาคลินิก',
  'งานอณูชีววิทยา',
  'งานคลังเลือด',
  'งานตรวจพิเศษและปฏิบัติการตรวจต่อ',
  'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี',
  'งานบริการผู้ป่วยนอก',
] as const
