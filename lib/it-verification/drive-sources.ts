import * as XLSX from 'xlsx'
import type { ItDepartmentCode } from './domain'
import { parseLegacyResponsibleRows, type LegacyResponsibleSheetResult } from './legacy-assignee'
import { parseLegacyFormWorkbook, type LegacyFormSheetResult } from './legacy-form'

export type DriveLegacySource = {
  departmentCode: ItDepartmentCode
  spreadsheetId: string
}

export type DriveLegacyResponsibleSource = {
  spreadsheetId: string
}

export type DriveWorkbookOptions = {
  folderYear: number
  departmentCode: ItDepartmentCode
  sourceFileId: string
  sourceFileName: string
}

export const DRIVE_LEGACY_RESPONSIBLE_SOURCES: Record<2567 | 2568 | 2569, DriveLegacyResponsibleSource> = {
  2567: { spreadsheetId: '1QKiyLh-S9ORhsxC2LOrkXFY1w4XKdWxwLBX9I92qTj8' },
  2568: { spreadsheetId: '1ntBVPO-TYe66ePmrB_PsvZwvgUy1_z3sdGoJCz_cTio' },
  2569: { spreadsheetId: '1ZpLY9tP6i3EImzGmalxW_i0jP2r9jpQ89vnv0yumsiQ' },
}

// These are the read-only source workbooks in the shared historical folder.
// The importer downloads them through Google's export endpoint and never edits
// the Drive files.
export const DRIVE_LEGACY_SOURCES: Record<2567 | 2568 | 2569, readonly DriveLegacySource[]> = {
  2567: [
    { departmentCode: 'CHE', spreadsheetId: '1o6FZpcz8VWYCkHFnqZyFtpR9HD9Gyux_F1f3tWlE5yM' },
    { departmentCode: 'IMM', spreadsheetId: '1lLsop_u-crJAb_I6NLO1qRqW32DmrUWJ_6eeyTqdRy0' },
    { departmentCode: 'BLB', spreadsheetId: '13LIYfVdZSrjX1iVdigEHqIPmjyFflQo_mZ_5w8ksJm8' },
    { departmentCode: 'MOL', spreadsheetId: '1G1jfp8yLqq3o9FZZ_BW91Z3k-BxfKWLi5K8e81fvsdE' },
    { departmentCode: 'HEM', spreadsheetId: '1rVjHD0Wub569rmqgeHFGSkBqg-1pGaVq4SMOla2ufxw' },
    { departmentCode: 'MIC', spreadsheetId: '1V48oJ1JBcIshPd9oSLG6bE3t4LQZAzB3j8PkE3xsYGg' },
    { departmentCode: 'MIS', spreadsheetId: '1QUUWAy51oDWnxu-kY_js8LPKalWcleDJ_FIn0J7yf_E' },
  ],
  2568: [
    { departmentCode: 'MOL', spreadsheetId: '1D915RX2NHGVSxegT8WCfAawnXf48L7trEutJnrSoSx8' },
    { departmentCode: 'MIS', spreadsheetId: '1xAka_DYIwYGW2-3ID9oDtvZPBvcEHsuSh8R26LRDhJU' },
    { departmentCode: 'MIC', spreadsheetId: '16U1teSmZnCT3aKiFIhP-TDSvRphzxXMcp8rZYza5MlM' },
    { departmentCode: 'IMM', spreadsheetId: '1smC7FPmijgERTODJe_u_4oawiRb4QhDDu8Qj5JWszNQ' },
    { departmentCode: 'HEM', spreadsheetId: '1RlGjfV9KbEc5ysQMnZelFWYrQYx1w3r0KS9GocA3KPY' },
    { departmentCode: 'CHE', spreadsheetId: '1x_0FKaKTFUbykwXageZaE4dyCk0RKav6N7ptKa4liEA' },
    { departmentCode: 'BLB', spreadsheetId: '1mMII9_PlX6nCncQu_o2JYLz9Vkvm6cYcHKphypoJqCY' },
  ],
  2569: [
    { departmentCode: 'BLB', spreadsheetId: '1PQKMhhZ49oig3w_E9S1EqeLVus0xVmjmAzK72U2md28' },
    { departmentCode: 'CHE', spreadsheetId: '1zjbKOmoQFENhT7WYyLbwRVsgMAf0ahUW0eaKxa29Pjk' },
    { departmentCode: 'HEM', spreadsheetId: '1uYs6V6dGblWSBibOpMYhQ0nPN3Xd66Z5bS3Pbn7R_Y0' },
    { departmentCode: 'MIC', spreadsheetId: '1_f9uROMIEd_mSdGUD9588FvyADTJi8Mb5xxHwh_scQE' },
    { departmentCode: 'MOL', spreadsheetId: '1I2VYHGTxqtwD9YTK5e4S8DnyiqloqWaeMRNvWw6Q-Io' },
    { departmentCode: 'MIS', spreadsheetId: '1ZRRELWlCR0ID32flPxNNhTWhogpWBnm4ak-GrY4g3Rk' },
    { departmentCode: 'IMM', spreadsheetId: '1K3aN7RmnuILHvcNxjxSbvYZU6YjYOstsVnN-aEnbSzA' },
  ],
}

export function buddhistYearToCalendarYear(year: number): number {
  return year >= 2400 ? year - 543 : year
}

export function parseDriveWorkbook(
  buffer: Uint8Array | ArrayBuffer,
  options: DriveWorkbookOptions,
): LegacyFormSheetResult[] {
  const workbook = XLSX.read(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer), {
    type: 'array',
    cellDates: false,
  })
  const sheets: Record<string, ReadonlyArray<ReadonlyArray<unknown>>> = {}
  for (const quarter of [1, 2, 3, 4] as const) {
    const name = `Q${quarter}`
    const worksheet = workbook.Sheets[name]
    if (!worksheet) throw new Error(`${options.sourceFileName}: missing required tab ${name}`)
    sheets[name] = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: null,
      raw: true,
    })
  }

  return parseLegacyFormWorkbook(sheets, {
    folderYear: options.folderYear,
    departmentCode: options.departmentCode,
    sourceFileName: options.sourceFileName,
  })
}

export function parseDriveResponsibleWorkbook(
  buffer: Uint8Array | ArrayBuffer,
): LegacyResponsibleSheetResult {
  const workbook = XLSX.read(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer), {
    type: 'array',
    cellDates: false,
  })
  const worksheet = workbook.Sheets.Sheet1
  if (!worksheet) throw new Error('00 ผู้รับผิดชอบ IT: missing required tab Sheet1')
  return parseLegacyResponsibleRows(XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: null,
    raw: true,
  }))
}
