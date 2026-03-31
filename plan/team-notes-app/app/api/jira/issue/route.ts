import { NextRequest, NextResponse } from 'next/server'

/** Jira Cloud / DC 공통: GET /rest/api/3/issue/{key} */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('key')?.trim().replace(/\s/g, '') ?? ''
  const key = raw.toUpperCase()

  if (!key || !/^[A-Z0-9]+-\d+$/.test(key)) {
    return NextResponse.json(
      { error: '티켓 키 형식을 확인해주세요. (예: PROJ-123)' },
      { status: 400 }
    )
  }

  const host = process.env.JIRA_HOST?.replace(/\/$/, '')
  const email = process.env.JIRA_EMAIL?.trim()
  const token = process.env.JIRA_API_TOKEN?.trim()

  if (!host || !email || !token) {
    return NextResponse.json(
      {
        error:
          'Jira 연동이 설정되지 않았습니다. 서버 환경 변수 JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN을 설정해주세요.',
        configured: false,
      },
      { status: 503 }
    )
  }

  const auth = Buffer.from(`${email}:${token}`, 'utf8').toString('base64')
  const url = `${host}/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary,assignee,duedate,status,priority`

  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
      next: { revalidate: 0 },
    })
  } catch {
    return NextResponse.json({ error: 'Jira 서버에 연결할 수 없습니다.' }, { status: 502 })
  }

  if (res.status === 401 || res.status === 403) {
    return NextResponse.json(
      { error: 'Jira 인증에 실패했습니다. 이메일·API 토큰·권한을 확인해주세요.' },
      { status: 401 }
    )
  }

  if (res.status === 404) {
    return NextResponse.json({ error: '해당 티켓을 찾을 수 없습니다.' }, { status: 404 })
  }

  if (!res.ok) {
    return NextResponse.json({ error: `Jira API 오류 (${res.status})` }, { status: 502 })
  }

  let data: {
    key: string
    fields?: {
      summary?: string
      duedate?: string | null
      assignee?: { displayName?: string } | null
      status?: { name?: string }
      priority?: { name?: string }
    }
  }

  try {
    data = await res.json()
  } catch {
    return NextResponse.json({ error: 'Jira 응답을 해석할 수 없습니다.' }, { status: 502 })
  }

  const f = data.fields
  const browseUrl = `${host}/browse/${data.key}`

  return NextResponse.json({
    configured: true,
    key: data.key,
    summary: f?.summary ?? '',
    duedate: f?.duedate ?? null,
    assigneeDisplayName: f?.assignee?.displayName ?? null,
    status: f?.status?.name ?? null,
    priority: f?.priority?.name ?? null,
    browseUrl,
  })
}
