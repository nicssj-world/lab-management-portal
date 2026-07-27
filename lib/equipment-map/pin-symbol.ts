export type EquipmentPinSymbolKind = 'refrigerator' | 'centrifuge' | 'microscope' | 'bsc' | 'code'

export interface EquipmentPinSymbol {
  kind: EquipmentPinSymbolKind
  code: string
  label: string
}

const SPECIAL_CLASSIFICATIONS: Record<string, EquipmentPinSymbol> = {
  '02': { kind: 'centrifuge', code: 'CF', label: 'เครื่องปั่นเหวี่ยง' },
  centrifuge: { kind: 'centrifuge', code: 'CF', label: 'เครื่องปั่นเหวี่ยง' },
  '07': { kind: 'refrigerator', code: 'FR', label: 'ตู้เย็น' },
  refrigerator: { kind: 'refrigerator', code: 'FR', label: 'ตู้เย็น' },
  '11': { kind: 'bsc', code: 'BSC', label: 'ตู้ชีวนิรภัย' },
  bsc: { kind: 'bsc', code: 'BSC', label: 'ตู้ชีวนิรภัย' },
  '12': { kind: 'microscope', code: 'MS', label: 'กล้องจุลทรรศน์' },
  microscope: { kind: 'microscope', code: 'MS', label: 'กล้องจุลทรรศน์' },
}

const CODE_CLASSIFICATIONS: Record<string, string> = {
  '01': 'AC', autoclave: 'AC',
  '03': 'WB', waterbath: 'WB',
  '04': 'HB', heatingblock: 'HB',
  '05': 'IC', incubator: 'IC',
  '06': 'BL', electronicbalance: 'BL',
  '08': 'TH', digitalthermometer: 'TH',
  '09': 'VP', volumetricpipette: 'VP',
  '10': 'AP', autopipette: 'AP',
  '13': 'WT', calibrationweight: 'WT',
  '14': 'AN', analyzer: 'AN',
  '15': 'AN', analyzerental: 'AN',
  '16': 'RT', rotator: 'RT',
  '17': 'VX', vortexmixer: 'VX',
  '18': 'TM', timer: 'TM',
  '19': 'UP', ups: 'UP',
}

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function fallbackForName(name: string): EquipmentPinSymbol | null {
  const value = normalise(name)
  if (value.includes('refrigerator') || value.includes('fridge') || name.includes('ตู้เย็น')) return SPECIAL_CLASSIFICATIONS.refrigerator
  if (value.includes('centrifuge') || name.includes('เครื่องปั่นเหวี่ยง')) return SPECIAL_CLASSIFICATIONS.centrifuge
  if (value.includes('microscope') || name.includes('กล้องจุลทรรศน์')) return SPECIAL_CLASSIFICATIONS.microscope
  if (value.includes('bsc') || value.includes('biosafetycabinet') || name.includes('ตู้ชีวนิรภัย')) return SPECIAL_CLASSIFICATIONS.bsc
  return null
}

export function getEquipmentPinSymbol(classification: string | null, name: string): EquipmentPinSymbol {
  const classificationKey = classification ? normalise(classification) : ''
  if (classificationKey) {
    return SPECIAL_CLASSIFICATIONS[classificationKey]
      ?? (CODE_CLASSIFICATIONS[classificationKey] ? { kind: 'code', code: CODE_CLASSIFICATIONS[classificationKey], label: classification } : { kind: 'code', code: 'EQ', label: 'อุปกรณ์ทั่วไป' })
  }

  return fallbackForName(name) ?? { kind: 'code', code: 'EQ', label: 'อุปกรณ์ทั่วไป' }
}
