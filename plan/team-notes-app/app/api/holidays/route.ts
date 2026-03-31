import { NextRequest, NextResponse } from 'next/server'

// 공공데이터포털 - 한국천문연구원 특일정보 API
const API_BASE_URL = process.env.NEXT_PUBLIC_HOLIDAY_URL

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  if (!year || !month) {
    return NextResponse.json(
      { error: 'year와 month 파라미터가 필요합니다' },
      { status: 400 }
    )
  }

  const serviceKey = process.env.NEXT_PUBLIC_HOLIDAY_API_KEY

  console.log('key:::::::::', serviceKey);
  console.log('url:::::::::', API_BASE_URL);

  if (!serviceKey) {
    return NextResponse.json(
      { error: 'API 키가 설정되지 않았습니다' },
      { status: 500 }
    )
  }

  try {
    const params = new URLSearchParams({
      serviceKey: serviceKey,
      solYear: year,
      solMonth: month.padStart(2, '0'),
      _type: 'json',
      numOfRows: '100'
    })

    const url = `${API_BASE_URL}/getRestDeInfo?${params.toString()}`
    
    console.log('🔍 공휴일 API 호출:', {
      year,
      month,
      url: url.substring(0, 100) + '...' // API 키는 로그에서 숨김
    })
    
    const response = await fetch(url, {
      cache: 'force-cache', // 공휴일은 변하지 않으므로 캐싱
      next: { revalidate: 86400 } // 24시간마다 재검증
    })

    console.log('✅ API 응답 상태:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API 응답 에러:', errorText)
      throw new Error(`API 응답 실패: ${response.status}`)
    }

    const data = await response.json()
    console.log('📦 API 응답 데이터:', JSON.stringify(data).substring(0, 200))

    // API 응답 구조 확인 및 파싱
    const items = data?.response?.body?.items?.item

    if (!items) {
      return NextResponse.json({ holidays: [] })
    }

    // 배열이 아닌 경우 (1개일 때) 배열로 변환
    const holidays = Array.isArray(items) ? items : [items]

    // 날짜별 공휴일 객체로 변환
    const holidayMap: Record<string, string> = {}
    
    holidays.forEach((holiday: any) => {
      const dateStr = holiday.locdate.toString()
      const year = dateStr.substring(0, 4)
      const month = dateStr.substring(4, 6)
      const day = dateStr.substring(6, 8)
      const formattedDate = `${year}-${month}-${day}`
      
      holidayMap[formattedDate] = holiday.dateName
    })

    return NextResponse.json({ holidays: holidayMap })
  } catch (error) {
    console.error('공휴일 API 호출 실패:', error)
    return NextResponse.json(
      { error: '공휴일 정보를 가져올 수 없습니다', holidays: {} },
      { status: 500 }
    )
  }
}
