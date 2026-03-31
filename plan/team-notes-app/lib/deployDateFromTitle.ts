/**
 * 제목 안의 대괄호 날짜를 배포 일자(YYYY-MM-DD)로 파싱합니다.
 * - [26-04-01] → 2000년대 2자리 연도 (26 → 2026)
 * - [2026-04-01] → 4자리 연도 그대로
 */
export function parseDeployDateFromTitle(title: string): string | null {
  const t = title.trim()
  if (!t) return null

  const four = t.match(/\[(\d{4})-(\d{2})-(\d{2})\]/)
  if (four) {
    const y = four[1]
    const m = four[2]
    const d = four[3]
    if (isValidYmd(y, m, d)) return `${y}-${m}-${d}`
  }

  const two = t.match(/\[(\d{2})-(\d{2})-(\d{2})\]/)
  if (two) {
    const yy = parseInt(two[1], 10)
    const m = two[2]
    const d = two[3]
    const fullYear = 2000 + yy
    const y = String(fullYear)
    if (isValidYmd(y, m, d)) return `${y}-${m}-${d}`
  }

  return null
}

function isValidYmd(yStr: string, mStr: string, dStr: string): boolean {
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10)
  const d = parseInt(dStr, 10)
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}
