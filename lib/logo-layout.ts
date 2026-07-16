// The hospital logo file has transparent padding on its right edge. This
// correction keeps the visible artwork at a consistent distance from the
// medical-technology seal when the marks are displayed as a pair.
export function getPairedHospitalLogoOffset(height: number): number {
  return -(height * 0.3125)
}
