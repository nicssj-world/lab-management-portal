import type { ChemicalPositionAssignment, ChemicalStorageLocationDefinition } from './types'

export const LOCATION_GROUP_COLORS = {
  A: '#1557C0',
  B: '#137333',
  C: '#F04B00',
  T: '#642A91',
} as const

export const CHEMICAL_PREP_LOCATIONS = [
  { code: 'A1', zoneCode: 'A', locationKind: 'cabinet', displayOrder: 1 },
  { code: 'A2', zoneCode: 'A', locationKind: 'cabinet', displayOrder: 2 },
  { code: 'B1', zoneCode: 'B', locationKind: 'cabinet', displayOrder: 3 },
  { code: 'B2', zoneCode: 'B', locationKind: 'cabinet', displayOrder: 4 },
  { code: 'B3', zoneCode: 'B', locationKind: 'cabinet', displayOrder: 5 },
  { code: 'B4', zoneCode: 'B', locationKind: 'cabinet', displayOrder: 6 },
  { code: 'C1', zoneCode: 'C', locationKind: 'cabinet', displayOrder: 7 },
  { code: 'C2', zoneCode: 'C', locationKind: 'cabinet', displayOrder: 8 },
  { code: 'C3', zoneCode: 'C', locationKind: 'cabinet', displayOrder: 9 },
  { code: 'C4', zoneCode: 'C', locationKind: 'cabinet', displayOrder: 10 },
  { code: 'C5', zoneCode: 'C', locationKind: 'cabinet', displayOrder: 11 },
  { code: 'T1', zoneCode: 'T', locationKind: 'table', displayOrder: 12 },
  { code: 'T2', zoneCode: 'T', locationKind: 'table', displayOrder: 13 },
] as const satisfies readonly ChemicalStorageLocationDefinition[]

export const INITIAL_POSITION_ASSIGNMENTS = [
  { positionCode: 'A1', name: '70% Alcohol' },
  { positionCode: 'A1', name: 'Alcohol hand rub' },
  { positionCode: 'A2', name: 'Ethyl alcohol 95%' },
  { positionCode: 'B1', name: 'Papanicolaou’s solution 1a (Harris hematoxylin)' },
  { positionCode: 'B1', name: 'Papanicolaou’s solution 2a (OG6)' },
  { positionCode: 'B1', name: 'Papanicolaou’s solution 3b (EA50)' },
  { positionCode: 'B2', name: 'Sodium acetate (anhydrous)' },
  { positionCode: 'B3', name: 'Acetic acid' },
  { positionCode: 'B3', name: 'Ethanol' },
  { positionCode: 'B3', name: 'Formic acid' },
  { positionCode: 'B4', name: 'Permount/Toluene solution' },
  { positionCode: 'B4', name: 'Propan-2-ol' },
  { positionCode: 'B4', name: 'Xylene' },
  { positionCode: 'C1', name: 'Formalin' },
  { positionCode: 'C2', name: 'Ammonia solution 25%' },
  { positionCode: 'C2', name: 'Ammonia solution 28%' },
  { positionCode: 'C2', name: 'Ammonia solution 30%' },
  { positionCode: 'C3', name: 'Acetonitrile' },
  { positionCode: 'C3', name: 'Dichloromethane' },
  { positionCode: 'C4', name: 'Hydrochloric acid 37%' },
  { positionCode: 'C4', name: 'Sulfuric acid' },
  { positionCode: 'C5', name: 'Citric acid' },
  { positionCode: 'C5', name: 'Trifluoroacetic acid' },
  { positionCode: 'T1', name: 'Wright’s Baso' },
  { positionCode: 'T2', name: 'Methanol' },
] as const satisfies readonly ChemicalPositionAssignment[]
