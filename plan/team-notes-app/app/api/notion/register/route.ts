import { NextRequest, NextResponse } from 'next/server'

const NOTION_VERSION = '2022-06-28'
const NOTION_BASE_URL = 'https://api.notion.com/v1'

/**
 * 앱 상태 → Notion DB `상태` 속성의 status 옵션 이름.
 * NOTION_STATUS_MAP(JSON): 키는 앱 값, 값은 Notion에 있는 옵션명. 값이 ""이면 해당 항목은 상태를 보내지 않음.
 * 예: {"개발완료":"완료","개발중":"진행 중","시작전":"대기"}
 */
function notionStatusName(appStatus: string): string | null {
  const raw = process.env.NOTION_STATUS_MAP
  if (!raw?.trim()) return appStatus
  try {
    const map = JSON.parse(raw) as Record<string, string>
    if (Object.prototype.hasOwnProperty.call(map, appStatus)) {
      const mapped = map[appStatus]
      return mapped === '' ? null : mapped
    }
  } catch {
    // 잘못된 JSON이면 원본 사용
  }
  return appStatus
}

interface TaskPayload {
  id: string
  title: string
  content: string | null
  date: string | null
  registered_date: string | null
  assignee: string | null
  status: string | null
  dev_type: string | null
  jira_ticket_id: string | null
  jira_ticket_url: string | null
  is_event: boolean
  has_page: boolean
}

type RegisterRequest = TaskPayload & { overwritePageId?: string | null }

type NotionPropertyMode = 'create' | 'patch'

/**
 * Notion DB에 보낼 properties.
 * - create: DB 행 생성용(제목 필수 → 비어 있으면 플레이스홀더). supabase_id는 항상 포함.
 * - patch: 요청에 실제로 값이 있는 필드만 포함 → 나머지 Notion 속성·본문은 그대로 유지.
 */
function buildNotionProperties(
  task: TaskPayload,
  opts: { mode: NotionPropertyMode }
): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  const { mode } = opts

  const titleTrimmed = task.title?.trim() ?? ''
  if (mode === 'create') {
    properties.task = {
      title: [
        {
          text: {
            content: titleTrimmed || '제목 없음',
          },
        },
      ],
    }
  } else if (titleTrimmed) {
    properties.task = {
      title: [{ text: { content: titleTrimmed } }],
    }
  }

  const idTrimmed = task.id?.trim() ?? ''
  if (idTrimmed) {
    properties.supabase_id = {
      rich_text: [{ text: { content: idTrimmed } }],
    }
  }

  const contentTrimmed = task.content?.trim() ?? ''
  if (contentTrimmed) {
    properties['비고'] = {
      rich_text: [{ text: { content: contentTrimmed.slice(0, 2000) } }],
    }
  }

  if (task.date) {
    properties['배포일정'] = { date: { start: task.date } }
  }

  const assigneeTrimmed = task.assignee?.trim() ?? ''
  if (assigneeTrimmed) {
    const names = assigneeTrimmed.split(',').map((n) => n.trim()).filter(Boolean)
    if (names.length) {
      properties['담당자'] = {
        multi_select: names.map((name) => ({ name })),
      }
    }
  }

  if (task.status?.trim()) {
    const statusName = notionStatusName(task.status.trim())
    if (statusName !== null && statusName !== '') {
      properties['상태'] = { status: { name: statusName } }
    }
  }

  const devTrimmed = task.dev_type?.trim() ?? ''
  if (devTrimmed) {
    const devOptions =
      devTrimmed === '퍼블+개발' ? ['퍼블', '개발'] : [devTrimmed]
    properties['퍼블/개발'] = {
      multi_select: devOptions.map((name) => ({ name })),
    }
  }

  const jiraTrimmed = task.jira_ticket_url?.trim() ?? ''
  if (jiraTrimmed) {
    properties['JIRA URL'] = { url: jiraTrimmed }
  }

  return properties
}

function joinPlainText(
  blocks: { plain_text?: string }[] | undefined
): string {
  return blocks?.map((b) => b.plain_text ?? '').join('') ?? ''
}

/** Notion DB 페이지 properties → 모달용 요약 */
function extractNotionPreview(
  properties: Record<string, unknown>
): Record<string, string> {
  const out: Record<string, string> = {}

  const taskProp = properties.task as
    | { title?: { plain_text?: string }[] }
    | undefined
  const title = joinPlainText(taskProp?.title)
  if (title) out['제목'] = title

  const note = properties['비고'] as
    | { rich_text?: { plain_text?: string }[] }
    | undefined
  const noteText = joinPlainText(note?.rich_text)
  if (noteText) out['비고'] = noteText.length > 400 ? `${noteText.slice(0, 400)}…` : noteText

  const dateProp = properties['배포일정'] as
    | { date?: { start?: string } | null }
    | undefined
  if (dateProp?.date?.start) out['배포일정'] = dateProp.date.start

  const assignee = properties['담당자'] as
    | { multi_select?: { name?: string }[] }
    | undefined
  if (assignee?.multi_select?.length) {
    out['담당자'] = assignee.multi_select.map((m) => m.name ?? '').join(', ')
  }

  const status = properties['상태'] as
    | { status?: { name?: string } | null }
    | undefined
  if (status?.status?.name) out['상태'] = status.status.name

  const dev = properties['퍼블/개발'] as
    | { multi_select?: { name?: string }[] }
    | undefined
  if (dev?.multi_select?.length) {
    out['퍼블/개발'] = dev.multi_select.map((m) => m.name ?? '').join(', ')
  }

  const jira = properties['JIRA URL'] as { url?: string | null } | undefined
  if (jira?.url) out['JIRA URL'] = jira.url

  const sid = properties.supabase_id as
    | { rich_text?: { plain_text?: string }[] }
    | undefined
  const sidText = joinPlainText(sid?.rich_text)
  if (sidText) out['Supabase ID'] = sidText

  return out
}

function notionPublicUrl(pageId: string): string {
  return `https://www.notion.so/${pageId.replace(/-/g, '')}`
}

export async function POST(req: NextRequest) {
  const token = process.env.NOTION_TOKEN
  const databaseId = process.env.NOTION_DATABASE_ID

  if (!token || !databaseId) {
    return NextResponse.json(
      {
        error:
          'Notion 설정이 없습니다. NOTION_TOKEN과 NOTION_DATABASE_ID 환경변수를 설정해주세요.',
      },
      { status: 500 }
    )
  }

  const body: RegisterRequest = await req.json()
  const { overwritePageId, ...task } = body

  const headers = {
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  }

  // 덮어쓰기: 앱에서 값이 있는 속성만 PATCH (나머지 Notion 필드·본문 유지)
  if (overwritePageId && typeof overwritePageId === 'string' && overwritePageId.trim()) {
    const properties = buildNotionProperties(task, { mode: 'patch' })
    if (Object.keys(properties).length === 0) {
      return NextResponse.json(
        { error: '갱신할 Notion 속성이 없습니다. 일정에 제목·ID 등 최소 정보를 확인해주세요.' },
        { status: 400 }
      )
    }
    const patchRes = await fetch(
      `${NOTION_BASE_URL}/pages/${overwritePageId.trim()}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ properties }),
      }
    )

    if (!patchRes.ok) {
      const err = await patchRes.json()
      return NextResponse.json(
        {
          error: `Notion 갱신 실패: ${err.message ?? patchRes.statusText}`,
        },
        { status: 500 }
      )
    }

    const page = await patchRes.json()
    return NextResponse.json({ success: true, pageId: page.id, overwritten: true })
  }

  // 1) supabase_id 로 중복
  const queryByIdRes = await fetch(`${NOTION_BASE_URL}/databases/${databaseId}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      filter: {
        property: 'supabase_id',
        rich_text: { equals: task.id },
      },
    }),
  })

  if (!queryByIdRes.ok) {
    const err = await queryByIdRes.json()
    return NextResponse.json(
      { error: `Notion 조회 실패: ${err.message ?? queryByIdRes.statusText}` },
      { status: 500 }
    )
  }

  const byIdData = await queryByIdRes.json()
  if (byIdData.results?.length > 0) {
    return NextResponse.json({
      duplicate: true,
      message: '이미 Notion에 등록된 항목입니다.',
    })
  }

  // 2) 동일 JIRA URL 이 있는지 (티켓 기준 중복)
  const jiraUrl = task.jira_ticket_url?.trim() ?? ''
  if (jiraUrl) {
    const queryJiraRes = await fetch(
      `${NOTION_BASE_URL}/databases/${databaseId}/query`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filter: {
            property: 'JIRA URL',
            url: { equals: jiraUrl },
          },
        }),
      }
    )

    if (!queryJiraRes.ok) {
      const err = await queryJiraRes.json()
      return NextResponse.json(
        {
          error: `Notion JIRA URL 조회 실패: ${err.message ?? queryJiraRes.statusText}`,
        },
        { status: 500 }
      )
    }

    const jiraData = await queryJiraRes.json()
    const hit = jiraData.results?.[0]
    if (hit?.id && hit.properties) {
      const preview = extractNotionPreview(
        hit.properties as Record<string, unknown>
      )
      return NextResponse.json({
        conflictJira: true,
        pageId: hit.id as string,
        notionUrl: notionPublicUrl(hit.id as string),
        preview,
        message:
          '같은 JIRA URL로 등록된 Notion 페이지가 있습니다. 내용을 확인한 뒤 덮어쓸지 선택해주세요.',
      })
    }
  }

  const createProperties = buildNotionProperties(task, { mode: 'create' })

  const createRes = await fetch(`${NOTION_BASE_URL}/pages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: createProperties,
    }),
  })

  if (!createRes.ok) {
    const err = await createRes.json()
    return NextResponse.json(
      { error: `Notion 등록 실패: ${err.message ?? createRes.statusText}` },
      { status: 500 }
    )
  }

  const page = await createRes.json()
  return NextResponse.json({ success: true, pageId: page.id })
}
