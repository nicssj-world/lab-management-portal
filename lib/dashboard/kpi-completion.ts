export function getKpiCompletionState(filled: number, required: number, daysRemaining: number) {
  const isComplete = required === 0 || filled >= required

  if (isComplete) {
    return {
      isComplete: true,
      accent: '#15803D',
      badgeBackground: '#DCFCE7',
      badgeText: 'บันทึกครบ 100% แล้ว',
      successTitle: 'บันทึก KPI ครบทุกงานแล้ว',
      successDetail: 'ข้อมูลของงวดนี้พร้อมดูในภาพรวม',
    }
  }

  if (daysRemaining < 0) {
    return {
      isComplete: false,
      accent: '#DC2626',
      badgeBackground: '#FEE2E2',
      badgeText: `เกินกำหนด ${Math.abs(daysRemaining)} วัน`,
      successTitle: '',
      successDetail: '',
    }
  }

  if (daysRemaining <= 3) {
    return {
      isComplete: false,
      accent: '#D97706',
      badgeBackground: '#FEF3C7',
      badgeText: daysRemaining === 0 ? 'ครบกำหนดวันนี้' : `เหลือ ${daysRemaining} วัน`,
      successTitle: '',
      successDetail: '',
    }
  }

  return {
    isComplete: false,
    accent: '#1E5FAD',
    badgeBackground: 'var(--primary-soft)',
    badgeText: `เหลือ ${daysRemaining} วัน`,
    successTitle: '',
    successDetail: '',
  }
}
