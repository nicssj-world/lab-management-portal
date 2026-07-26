import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { extractText, getDocumentProxy } from 'unpdf'

import {
  calculateHoldingTotal,
  detectQuantityConflict,
  type QuantityPart,
  type QuantityTotal,
} from '../domain'
import { INITIAL_POSITION_ASSIGNMENTS } from '../storage-manifest'
import { assertSourceFile } from './source-files'

export interface MasterlistRawRow {
  no: number
  chemicalName: string
  sdsOnFileRaw: string
  packageRaw: string
  containerCountRaw: string
  minimumStockRaw: string
  reportedTotalRaw: string
  rawGhsText: string
  rawLocation: string
  responsibleUnitRaw: string
}

export interface MasterlistNormalizedProposal {
  rawRowNo: number
  chemicalName: string
  packageParts: QuantityPart[]
  calculatedTotal: QuantityTotal
  quantityConflict: boolean
  currentPositionCode: string
}

export interface MasterlistImportSource {
  sha256: string
  title: 'Unit Chemical Inventory List'
  unitDepartment: string
  updatedLabel: 'June 2026'
  rows: MasterlistRawRow[]
}

export const JUNE_2026_MASTERLIST_SHA256 = '71d25b0e50b3056f97edb3238a1a7949584744f67fc0bfbfafcaa70273d83ddb'

const JUNE_2026_UNIT_DEPARTMENT = 'ห้องเก็บสารเคมีกลุ่มงานเทคนิคการแพทย์'

const checkedRows: MasterlistRawRow[] = [
  { no: 1, chemicalName: '70 % alcohol', sdsOnFileRaw: '√', packageRaw: '450 ml', containerCountRaw: '11 ขวด', minimumStockRaw: '11', reportedTotalRaw: '4,950 มิลลิลิตร', rawGhsText: 'ก๊าซไวไฟ และ พิษเฉียบพลัน (มีความเป็นพิษต ่า)', rawLocation: 'A1', responsibleUnitRaw: 'กลุ่มงานเทคนิคฯ' },
  { no: 2, chemicalName: 'Acetic acid', sdsOnFileRaw: '√', packageRaw: '2.5 ลิตร', containerCountRaw: '2 ขวด', minimumStockRaw: '1', reportedTotalRaw: '5 ลิตร', rawGhsText: 'ก๊าซไวไฟ และ สารทีกัดกร่อนโลหะ', rawLocation: 'B3, B4', responsibleUnitRaw: 'โลหิตวิทยา/ภูมิคุ้มกันวิทยา' },
  { no: 3, chemicalName: 'Acetonitrile', sdsOnFileRaw: '√', packageRaw: '4 ลิตร', containerCountRaw: '1 ขวด', minimumStockRaw: '1', reportedTotalRaw: '4 ลิตร', rawGhsText: 'ก๊าซไวไฟ และ พิษเฉียบพลัน (มีความเป็นพิษต ่า)', rawLocation: 'C3', responsibleUnitRaw: 'จุลชีววิทยา' },
  { no: 4, chemicalName: 'Ammonia solution 25%', sdsOnFileRaw: '√', packageRaw: '2.5 ลิตร', containerCountRaw: '1 ขวด', minimumStockRaw: '1', reportedTotalRaw: '2.5 ลิตร', rawGhsText: 'สารทีกัดกร่อนโลหะ พิษเฉียบพลัน (มีความเป็นพิษต ่า) และ ความ เป็นอันตรายต่อสิงแวดล้อมทางน ่า', rawLocation: 'C2', responsibleUnitRaw: 'กลุ่มงานเทคนิคฯ' },
  { no: 5, chemicalName: 'Ammonia solution 28%', sdsOnFileRaw: '√', packageRaw: '2.5 ลิตร', containerCountRaw: '1 ขวด', minimumStockRaw: '1', reportedTotalRaw: '2.5 ลิตร', rawGhsText: 'สารทีกัดกร่อนโลหะ พิษเฉียบพลัน (มีความเป็นพิษต ่า) และ ความ เป็นอันตรายต่อสิงแวดล้อมทางน ่า', rawLocation: 'C2', responsibleUnitRaw: 'กลุ่มงานเทคนิคฯ' },
  { no: 6, chemicalName: 'Ammonia solution 30%', sdsOnFileRaw: '√', packageRaw: '2.5 ลิตร', containerCountRaw: '2 ขวด', minimumStockRaw: '1', reportedTotalRaw: '2.5 ลิตร', rawGhsText: 'สารทีกัดกร่อนโลหะ พิษเฉียบพลัน (มีความเป็นพิษต ่า) และความ เป็นอันตรายต่อสิงแวดล้อมทางน ่า', rawLocation: 'C2', responsibleUnitRaw: 'กลุ่มงานเทคนิคฯ' },
  { no: 7, chemicalName: 'alcohol Hand Rub', sdsOnFileRaw: '√', packageRaw: '450 ml', containerCountRaw: '11 ขวด', minimumStockRaw: '11', reportedTotalRaw: '4,950 มิลลิลิตร', rawGhsText: 'ก๊าซไวไฟ และ พิษเฉียบพลัน (มีความเป็นพิษต ่า)', rawLocation: 'A1', responsibleUnitRaw: 'กลุ่มงานเทคนิคฯ' },
  { no: 8, chemicalName: 'Citric acid', sdsOnFileRaw: '√', packageRaw: '100 กรัม', containerCountRaw: '1 ขวด', minimumStockRaw: '1', reportedTotalRaw: '100 กรัม', rawGhsText: 'พิษเฉียบพลัน (มีความเป็นพิษต ่า)', rawLocation: 'C5', responsibleUnitRaw: 'กลุ่มงานเทคนิคฯ' },
  { no: 9, chemicalName: 'Dichloromethane', sdsOnFileRaw: '√', packageRaw: '2.5 ลิตร', containerCountRaw: '4 ขวด', minimumStockRaw: '1', reportedTotalRaw: '10 ลิตร', rawGhsText: 'อันตรายต่อสุขภาพ และ พิษเฉียบพลัน (มีความเป็นพิษต ่า)', rawLocation: 'C3', responsibleUnitRaw: 'กลุ่มงานเทคนิคฯ' },
  { no: 10, chemicalName: 'Ethanol', sdsOnFileRaw: '√', packageRaw: '2.5 ลิตร', containerCountRaw: '3 ขวด', minimumStockRaw: '1', reportedTotalRaw: '7.5 ลิตร', rawGhsText: 'ก๊าซไวไฟ และ พิษเฉียบพลัน (มีความเป็นพิษต ่า)', rawLocation: 'B3, B4', responsibleUnitRaw: 'จุลชีววิทยา' },
  { no: 11, chemicalName: 'Ethyl alcohol 95%', sdsOnFileRaw: '√', packageRaw: '500 มิลลิลิตร', containerCountRaw: '7 ขวด', minimumStockRaw: '1', reportedTotalRaw: '18 ลิตร', rawGhsText: 'ก๊าซไวไฟ พิษเฉียบพลัน (มีความเป็นพิษสูง) และอันตรายต่อสุขภาพ', rawLocation: 'A2', responsibleUnitRaw: 'ภูมิคุ้มกันวิทยา' },
  { no: 12, chemicalName: 'Formalin', sdsOnFileRaw: '√', packageRaw: '450 มิลลิลิตร', containerCountRaw: '1 ขวด', minimumStockRaw: '1', reportedTotalRaw: '450 มิลลิลิตร', rawGhsText: 'ก๊าซไวไฟ พิษเฉียบพลัน (มีความเป็นพิษสูง) อันตรายต่อสุขภาพ และสารทีกัดกร่อนโลหะ', rawLocation: 'C1', responsibleUnitRaw: 'โลหิตวิทยา' },
  { no: 13, chemicalName: 'Formic acid', sdsOnFileRaw: '√', packageRaw: '2.5 ลิตร, 1 ลิตร', containerCountRaw: '1 ขวด, 1 ขวด', minimumStockRaw: '1', reportedTotalRaw: '2.5 ลิตร', rawGhsText: 'ก๊าซไวไฟ พิษเฉียบพลัน (มีความเป็นพิษสูง) และสารทีกัดกร่อนโลหะ', rawLocation: 'B3, B4', responsibleUnitRaw: 'จุลชีววิทยา' },
  { no: 14, chemicalName: 'Hydrochloric acid 37%', sdsOnFileRaw: '√', packageRaw: '2.5 ลิตร', containerCountRaw: '1 ขวด', minimumStockRaw: '1', reportedTotalRaw: '2.5 ลิตร', rawGhsText: 'สารทีกัดกร่อนโลหะ และ พิษเฉียบพลัน (มีความเป็นพิษต ่า)', rawLocation: 'C4', responsibleUnitRaw: 'โลหิตวิทยา' },
  { no: 15, chemicalName: 'Methanol', sdsOnFileRaw: '√', packageRaw: '2.5 ลิตร', containerCountRaw: '1 ขวด', minimumStockRaw: '2', reportedTotalRaw: '5 ลิตร', rawGhsText: 'ก๊าซไวไฟ พิษเฉียบพลัน (มีความเป็นพิษสูง) และอันตรายต่อสุขภาพ', rawLocation: 'T2', responsibleUnitRaw: 'โลหิตวิทยา' },
  { no: 16, chemicalName: "Papanicolaou's solution 1a Harris hematoxylin solution", sdsOnFileRaw: '√', packageRaw: '2.5 ลิตร', containerCountRaw: '1 ขวด', minimumStockRaw: '1', reportedTotalRaw: '2.5 ลิตร', rawGhsText: 'สารทีกัดกร่อนโลหะ', rawLocation: 'B1', responsibleUnitRaw: 'ภูมิคุ้มกันวิทยา' },
  { no: 17, chemicalName: "Papanicolaou's solution 2a orange G solution (OG6)", sdsOnFileRaw: '√', packageRaw: '2.5 ลิตร', containerCountRaw: '1 ขวด', minimumStockRaw: '1', reportedTotalRaw: '2.5 ลิตร', rawGhsText: 'ก๊าซไวไฟ และ พิษเฉียบพลัน (มีความเป็นพิษต ่า)', rawLocation: 'B1', responsibleUnitRaw: 'ภูมิคุ้มกันวิทยา' },
  { no: 18, chemicalName: "Papanicolaou's solution 3b polychromatic solution EA 50", sdsOnFileRaw: '√', packageRaw: '2.5 ลิตร', containerCountRaw: '1 ขวด', minimumStockRaw: '1', reportedTotalRaw: '2.5 ลิตร', rawGhsText: 'ก๊าซไวไฟ อันตรายต่อสุขภาพ และ พิษเฉียบพลัน (มีความเป็นพิษต ่า)', rawLocation: 'B1', responsibleUnitRaw: 'ภูมิคุ้มกันวิทยา' },
  { no: 19, chemicalName: 'Permount/Toluene solution', sdsOnFileRaw: '√', packageRaw: '500 มิลลิลิตร', containerCountRaw: '1 ขวด', minimumStockRaw: '1', reportedTotalRaw: '500 มิลลิลิตร', rawGhsText: 'ก๊าซไวไฟ พิษเฉียบพลัน (มีความเป็นพิษต ่า) และอันตรายต่อสุขภาพ', rawLocation: 'B3, B4', responsibleUnitRaw: 'ภูมิคุ้มกันวิทยา' },
  { no: 20, chemicalName: 'PROPAN-2-OL', sdsOnFileRaw: '√', packageRaw: '5 ลิตร', containerCountRaw: '1 ขวด', minimumStockRaw: '1', reportedTotalRaw: '5 ลิตร', rawGhsText: 'ก๊าซไวไฟ และ พิษเฉียบพลัน (มีความเป็นพิษต ่า)', rawLocation: 'B3, B4', responsibleUnitRaw: 'ภูมิคุ้มกันวิทยา' },
  { no: 21, chemicalName: 'Sodium acetate (anhydrous)', sdsOnFileRaw: '√', packageRaw: '250 กรัม', containerCountRaw: '1 ขวด', minimumStockRaw: '1', reportedTotalRaw: '250 กรัม', rawGhsText: 'ของแข็งไม่ก่าหนดประเภท', rawLocation: 'B2', responsibleUnitRaw: 'ภูมิคุ้มกันวิทยา' },
  { no: 22, chemicalName: 'Sulphuric acid', sdsOnFileRaw: '√', packageRaw: '2.5 ลิตร', containerCountRaw: '2 ขวด', minimumStockRaw: '1', reportedTotalRaw: '5 ลิตร', rawGhsText: 'สารทีกัดกร่อนโลหะ', rawLocation: 'C4', responsibleUnitRaw: 'จุลชีววิทยา' },
  { no: 23, chemicalName: 'Trifluoroacetic acid', sdsOnFileRaw: '√', packageRaw: '100 มิลลิลิตร', containerCountRaw: '1 ขวด', minimumStockRaw: '1', reportedTotalRaw: '100 มิลลิลิตร', rawGhsText: 'พิษเฉียบพลัน (มีความเป็นพิษต ่า) และสารทีกัดกร่อนโลหะ', rawLocation: 'C5', responsibleUnitRaw: 'จุลชีววิทยา' },
  { no: 24, chemicalName: 'Wright’s Baso', sdsOnFileRaw: '√', packageRaw: '5 ลิตร', containerCountRaw: '1 ขวด', minimumStockRaw: '10', reportedTotalRaw: '50 ลิตร', rawGhsText: 'ก๊าซไวไฟ', rawLocation: 'T1', responsibleUnitRaw: 'โลหิตวิทยา' },
  { no: 25, chemicalName: 'Xylene', sdsOnFileRaw: '√', packageRaw: '5 ลิตร', containerCountRaw: '1 ขวด', minimumStockRaw: '1', reportedTotalRaw: '5 ลิตร 1 ขวด', rawGhsText: 'ก๊าซไวไฟ อันตรายต่อสุขภาพ และ พิษเฉียบพลัน (มีความเป็นพิษต ่า)', rawLocation: 'B3, B4', responsibleUnitRaw: 'ภูมิคุ้มกันวิทยา' },
]

for (const row of checkedRows) Object.freeze(row)

export const JUNE_2026_MASTERLIST_ROWS: readonly MasterlistRawRow[] = Object.freeze(checkedRows)

const normalizedNamesByRow = [
  '70% Alcohol',
  'Acetic acid',
  'Acetonitrile',
  'Ammonia solution 25%',
  'Ammonia solution 28%',
  'Ammonia solution 30%',
  'Alcohol hand rub',
  'Citric acid',
  'Dichloromethane',
  'Ethanol',
  'Ethyl alcohol 95%',
  'Formalin',
  'Formic acid',
  'Hydrochloric acid 37%',
  'Methanol',
  'Papanicolaou’s solution 1a (Harris hematoxylin)',
  'Papanicolaou’s solution 2a (OG6)',
  'Papanicolaou’s solution 3b (EA50)',
  'Permount/Toluene solution',
  'Propan-2-ol',
  'Sodium acetate (anhydrous)',
  'Sulfuric acid',
  'Trifluoroacetic acid',
  'Wright’s Baso',
  'Xylene',
] as const

export function buildJune2026NormalizedProposals(
  rows: readonly MasterlistRawRow[],
): MasterlistNormalizedProposal[] {
  return rows.map(row => {
    const chemicalName = normalizedNamesByRow[row.no - 1]
    if (!chemicalName) throw new Error(`Unsupported June 2026 master-list row: ${row.no}`)

    const assignment = INITIAL_POSITION_ASSIGNMENTS.find(candidate => candidate.name === chemicalName)
    if (!assignment) throw new Error(`Missing reviewed storage assignment for row ${row.no}`)

    const packageParts = parsePackageParts(row.packageRaw, row.containerCountRaw)
    const calculatedTotal = calculateHoldingTotal(packageParts)

    return {
      rawRowNo: row.no,
      chemicalName,
      packageParts,
      calculatedTotal,
      quantityConflict: detectQuantityConflict({ calculated: calculatedTotal, reportedRaw: row.reportedTotalRaw }),
      currentPositionCode: assignment.positionCode,
    }
  })
}

export function findConflictNames(rows: readonly MasterlistRawRow[]): string[] {
  return buildJune2026NormalizedProposals(rows)
    .filter(proposal => proposal.quantityConflict)
    .map(proposal => proposal.chemicalName)
}

export async function readJune2026Masterlist(pdfPath: string): Promise<MasterlistImportSource> {
  const sha256 = await assertSourceFile(pdfPath, JUNE_2026_MASTERLIST_SHA256)
  const bytes = await readFile(pdfPath)
  const bytesSha256 = createHash('sha256').update(bytes).digest('hex')
  if (bytesSha256 !== sha256) {
    throw new Error(`Source file SHA-256 changed while reading: expected ${sha256}, received ${bytesSha256}`)
  }

  const pdf = await getDocumentProxy(new Uint8Array(bytes))
  let extractedText: string
  try {
    const extracted = await extractText(pdf, { mergePages: true })
    extractedText = extracted.text
  } finally {
    await pdf.destroy()
  }

  assertRecognizableJune2026Source(extractedText)

  return {
    sha256,
    title: 'Unit Chemical Inventory List',
    unitDepartment: JUNE_2026_UNIT_DEPARTMENT,
    updatedLabel: 'June 2026',
    rows: JUNE_2026_MASTERLIST_ROWS.map(row => ({ ...row })),
  }
}

function parsePackageParts(packageRaw: string, containerCountRaw: string): QuantityPart[] {
  const packages = packageRaw.split(',').map(value => value.trim())
  const counts = containerCountRaw.split(',').map(value => value.trim())
  if (packages.length !== counts.length) {
    throw new Error(`Package/count mismatch: ${packageRaw} / ${containerCountRaw}`)
  }

  return packages.map((rawPackage, index) => {
    const packageMatch = rawPackage.match(/^(\d+(?:\.\d+)?)\s+(ml|มิลลิลิตร|ลิตร|กรัม)$/)
    const countMatch = counts[index].match(/^(\d+)\s+ขวด$/)
    if (!packageMatch || !countMatch) {
      throw new Error(`Unrecognized June 2026 package/count: ${rawPackage} / ${counts[index]}`)
    }

    const unit = packageMatch[2] === 'ลิตร'
      ? 'L'
      : packageMatch[2] === 'กรัม'
        ? 'g'
        : 'mL'

    return {
      value: Number(packageMatch[1]),
      unit,
      count: Number(countMatch[1]),
    }
  })
}

function assertRecognizableJune2026Source(rawText: string): void {
  const text = rawText.replace(/\s+/g, ' ').trim()
  const requiredText = [
    'Unit Chemical Inventory List',
    JUNE_2026_UNIT_DEPARTMENT,
    'Update June 2026',
    `1 ${JUNE_2026_MASTERLIST_ROWS[0].chemicalName}`,
    `25 ${JUNE_2026_MASTERLIST_ROWS[24].chemicalName}`,
    ...JUNE_2026_MASTERLIST_ROWS.map(row => `${row.no} ${row.chemicalName}`),
  ]

  for (const marker of requiredText) {
    if (!text.includes(marker)) {
      throw new Error(`June 2026 master-list source text is not recognizable: missing ${marker}`)
    }
  }
}
