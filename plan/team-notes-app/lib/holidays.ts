// 공휴일 관련 유틸리티

export interface Holiday {
  date: string // 'YYYY-MM-DD'
  name: string
}

export async function fetchHolidays(
  year: number,
  month: number
): Promise<Record<string, string>> {
  try {
    const response = await fetch(
      `/api/holidays?year=${year}&month=${month}`,
      { cache: 'force-cache' }
    )

    if (!response.ok) {
      console.error('공휴일 조회 실패:', response.status)
      return {}
    }

    const data = await response.json()
    return data.holidays || {}
  } catch (error) {
    console.error('공휴일 조회 에러:', error)
    return {}
  }
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isHoliday(
  date: Date,
  holidays: Record<string, string>
): { isHoliday: boolean; name?: string } {
  const dateKey = formatDateKey(date)
  const holidayName = holidays[dateKey]

  return {
    isHoliday: !!holidayName,
    name: holidayName,
  }
}
