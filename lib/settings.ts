export interface SystemSettings {
  siteName: string
  systemCode: string
  orgName: string
  standards: string
  version: string
}

export const SETTINGS_DEFAULTS: SystemSettings = {
  siteName: 'Lab Management Portal',
  systemCode: 'MN-LAB-01',
  orgName: 'กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี',
  standards: 'ISO 15189 · ISO 15190',
  version: 'v1.0.0',
}
