'use client'

import { useEffect, useState } from 'react'
import type { Task } from '@/types/database.types'
import { parseDeployDateFromTitle } from '@/lib/deployDateFromTitle'
import { formatDateKey } from '@/lib/holidays'

const TEAM_MEMBERS = ['고진석', '김아름', '조소영', '김영은']
const DEV_TYPES = ['퍼블', '개발', '퍼블+개발', '일상'] as const

export interface TaskModalSubmitPayload {
  title: string
  content: string
  date: string
  /** 신규만: 캘린더에서 일정 추가 시 선택했던 날짜 */
  registered_date: string | null
  assignee: string
  status: string
  dev_type: string
  is_event: boolean
  jira_ticket_id: string
  jira_ticket_url: string
  jira_title: string | null
  jira_status: string | null
  jira_priority: string | null
  jira_assignee: string | null
}

export interface TaskModalProps {
  open: boolean
  mode: 'create' | 'edit'
  defaultDate: string
  /** 일정 추가 시 모달을 연 순간의 캘린더 선택일 (YYYY-MM-DD) */
  registerCalendarDate: string
  task: Task | null
  onClose: () => void
  onSubmit: (payload: TaskModalSubmitPayload) => Promise<void>
}

/** 등록일 기준일(YYYY-MM-DD) — 카드·모달 표시와 동일 */
function registerDayKey(task: Task): string {
  try {
    return (task.registered_date?.trim() || formatDateKey(new Date(task.created_at))) as string
  } catch {
    return ''
  }
}

function displayRegisteredDate(task: Task): string {
  const k = registerDayKey(task)
  return k || '—'
}

export default function TaskModal({
  open,
  mode,
  defaultDate,
  registerCalendarDate,
  task,
  onClose,
  onSubmit,
}: TaskModalProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])
  const [status, setStatus] = useState('시작 전')
  const [devType, setDevType] = useState('')
  const [isEvent, setIsEvent] = useState(false)
  const [jiraTicketId, setJiraTicketId] = useState('')
  const [jiraTicketUrl, setJiraTicketUrl] = useState('')
  const [jiraTitle, setJiraTitle] = useState<string | null>(null)
  const [jiraStatus, setJiraStatus] = useState<string | null>(null)
  const [jiraPriority, setJiraPriority] = useState<string | null>(null)
  const [jiraAssignee, setJiraAssignee] = useState<string | null>(null)

  const [jiraLookupLoading, setJiraLookupLoading] = useState(false)
  const [jiraLookupHint, setJiraLookupHint] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setJiraLookupHint('')
    if (mode === 'edit' && task) {
      setTitle(task.title)
      setContent(task.content ?? '')
      // 배포일을 따로 두지 않고 등록일만 쓴 경우(DB상 date === 등록일) 배포 칸은 비움
      // 제목 [YY-MM-DD]로 배포일이 잡힌 경우는 그대로 표시
      const reg = registerDayKey(task)
      const fromTitle = parseDeployDateFromTitle(task.title)
      if (fromTitle && fromTitle === task.date) {
        setDate(task.date)
      } else if (reg && task.date === reg) {
        setDate('')
      } else {
        setDate(task.date)
      }
      setSelectedAssignees(
        (task.assignee ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      )
      setStatus(task.status ?? '시작 전')
      setDevType(task.dev_type ?? '')
      setIsEvent((task as Task & { is_event?: boolean }).is_event ?? false)
      setJiraTicketId(task.jira_ticket_id ?? '')
      setJiraTicketUrl(task.jira_ticket_url ?? '')
      setJiraTitle(task.jira_title ?? null)
      setJiraStatus(task.jira_status ?? null)
      setJiraPriority(task.jira_priority ?? null)
      setJiraAssignee(task.jira_assignee ?? null)
    } else {
      setTitle('')
      setContent('')
      setDate('')
      setSelectedAssignees([])
      setStatus('시작 전')
      setDevType('')
      setIsEvent(false)
      setJiraTicketId('')
      setJiraTicketUrl('')
      setJiraTitle(null)
      setJiraStatus(null)
      setJiraPriority(null)
      setJiraAssignee(null)
    }
  }, [open, mode, task, defaultDate])

  if (!open) return null

  const handleJiraLookup = async () => {
    const raw = jiraTicketId.trim()
    if (!raw) {
      setError('먼저 티켓 키를 입력해주세요')
      return
    }
    setJiraLookupLoading(true)
    setError('')
    setJiraLookupHint('')
    try {
      const res = await fetch(`/api/jira/issue?key=${encodeURIComponent(raw)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '티켓 조회에 실패했습니다')
        return
      }
      setJiraTicketId(data.key)
      setJiraTicketUrl(data.browseUrl ?? '')
      setJiraTitle(data.summary || null)
      setJiraStatus(data.status ?? null)
      setJiraPriority(data.priority ?? null)
      const jiraName = data.assigneeDisplayName as string | null
      setJiraAssignee(jiraName)
      if (data.summary) setTitle(data.summary)
      if (jiraName) setSelectedAssignees([jiraName])
      const fromTitle = data.summary ? parseDeployDateFromTitle(String(data.summary)) : null
      if (fromTitle) setDate(fromTitle)
      else if (data.duedate) setDate(data.duedate)
      setJiraLookupHint('Jira에서 일정 정보를 가져왔습니다. 필요하면 아래를 수정한 뒤 저장하세요.')
    } catch {
      setError('티켓 조회 중 오류가 발생했습니다')
    } finally {
      setJiraLookupLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) {
      setError('제목을 입력해주세요 (티켓 조회로 채우거나 직접 입력)')
      return
    }
    const parsedDeploy = parseDeployDateFromTitle(t)
    const regFallback = registerCalendarDate.trim() || defaultDate.trim()
    const editFallback = task?.registered_date?.trim() || task?.date?.trim() || ''
    const deployDate =
      parsedDeploy ??
      (date.trim() || (mode === 'create' ? regFallback : editFallback))
    if (!deployDate) {
      setError('배포 일자를 정할 수 없습니다. 수정 모드에서 날짜를 한 번 선택해주세요.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const hasJira = !!(jiraTicketId.trim() || jiraTicketUrl.trim())
      await onSubmit({
        title: t,
        content: content.trim(),
        date: deployDate,
        registered_date:
          mode === 'create' ? (registerCalendarDate.trim() || defaultDate) : null,
        assignee: selectedAssignees.join(', '),
        status,
        dev_type: devType,
        is_event: isEvent,
        jira_ticket_id: jiraTicketId.trim(),
        jira_ticket_url: jiraTicketUrl.trim(),
        jira_title: hasJira ? jiraTitle : null,
        jira_status: hasJira ? jiraStatus : null,
        jira_priority: hasJira ? jiraPriority : null,
        jira_assignee: hasJira ? jiraAssignee : null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  const inputBase =
    'w-full px-4 py-3 bg-gray-100 border-0 rounded-md text-gray-900 text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto p-4 md:p-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? '일정 등록' : '일정 수정'}
          </h2>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-orange-100 bg-orange-50/60 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-900">1. Jira 티켓 (선택)</p>
            <p className="text-xs text-gray-600 leading-relaxed">
              티켓 키를 입력한 뒤 <strong>티켓 조회</strong>를 누르면 제목·담당자·마감일·링크를 가져옵니다.
              <strong className="text-gray-800"> Jira 없이</strong> 일정만 올릴 땐 이 칸 전부 비워 두면 됩니다.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={jiraTicketId}
                onChange={(e) => {
                  setJiraTicketId(e.target.value)
                  setJiraLookupHint('')
                }}
                className={`${inputBase} flex-1`}
                placeholder="티켓 키 (예: PROJ-123)"
                autoComplete="off"
              />
              <button
                type="button"
                disabled={jiraLookupLoading}
                onClick={handleJiraLookup}
                className="shrink-0 px-4 py-3 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium rounded-md disabled:opacity-50 transition-colors"
              >
                {jiraLookupLoading ? '조회 중…' : '티켓 조회'}
              </button>
            </div>
            <input
              type="url"
              value={jiraTicketUrl}
              onChange={(e) => setJiraTicketUrl(e.target.value)}
              className={inputBase}
              placeholder="티켓 URL (조회 시 자동 입력)"
            />
            {(jiraStatus || jiraPriority) && (
              <p className="text-xs text-gray-600">
                {jiraStatus && <span>상태: {jiraStatus}</span>}
                {jiraStatus && jiraPriority && <span className="mx-2">·</span>}
                {jiraPriority && <span>우선순위: {jiraPriority}</span>}
              </p>
            )}
            {jiraLookupHint && <p className="text-xs text-green-700">{jiraLookupHint}</p>}
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-4">
            <p className="text-sm font-semibold text-gray-900">2. 일정 내용</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  const p = parseDeployDateFromTitle(title)
                  if (p) setDate(p)
                }}
                className={inputBase}
                placeholder="예: [26-04-01]배포테스트 — 대괄호 날짜가 배포일로 반영됩니다"
              />
              <p className="mt-1 text-xs text-gray-500">
                <code className="text-[11px] bg-gray-100 px-1 rounded">[YY-MM-DD]</code> 또는{' '}
                <code className="text-[11px] bg-gray-100 px-1 rounded">[YYYY-MM-DD]</code> 가 있으면 그 날짜가{' '}
                <strong>배포 일자</strong>로 저장됩니다(저장 시 제목의 값이 우선합니다).
              </p>
            </div>

            {mode === 'create' && (
              <div className="rounded-md bg-gray-50 border border-gray-100 px-4 py-2.5">
                <p className="text-xs font-medium text-gray-500 mb-0.5">등록일 (캘린더 선택)</p>
                <p className="text-sm text-gray-800 font-medium">{registerCalendarDate || defaultDate}</p>
                <p className="text-xs text-gray-500 mt-1">일정 추가 버튼을 누를 때 캘린더에 선택되어 있던 날짜입니다.</p>
              </div>
            )}

            {mode === 'edit' && task && (
              <div className="rounded-md bg-gray-50 border border-gray-100 px-4 py-2.5">
                <p className="text-xs font-medium text-gray-500 mb-0.5">등록일 (캘린더 선택)</p>
                <p className="text-sm text-gray-800 font-medium">{displayRegisteredDate(task)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {task.registered_date
                    ? '등록 시 캘린더에서 선택한 날짜입니다.'
                    : '예전 데이터는 등록 시각이 있던 시점의 날짜로 표시됩니다.'}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                배포 일자 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputBase} />
              <p className="mt-1 text-xs text-gray-500">
                캘린더에 쓰이는 <strong>배포·일정 일자</strong>입니다.{' '}
                <strong className="text-gray-700">비워 두면 등록일과 같은 날</strong>로 저장됩니다. 우선순위: 제목{' '}
                <code className="text-[11px] bg-gray-100 px-0.5 rounded">[YY-MM-DD]</code> → 아래 입력칸 → (비었을 때){' '}
                등록일. Jira 조회 시에는 제목 날짜 → 마감일 → 등록일 순으로 채웁니다.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">진행 상태</label>
              <div className="flex gap-2">
                {(['시작 전', '개발중', '완료'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex-1 py-2 text-sm font-medium rounded-md border transition-colors ${
                      status === s
                        ? s === '완료' ? 'bg-green-500 text-white border-green-500'
                          : s === '개발중' ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-gray-500 text-white border-gray-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">구분 (선택)</label>
              <div className="flex gap-2 flex-wrap">
                {DEV_TYPES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDevType(devType === d ? '' : d)}
                    className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
                      devType === d
                        ? d === '일상'
                          ? 'bg-purple-500 text-white border-purple-500'
                          : 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">담당자 (복수 선택 가능)</label>
              <div className="flex gap-2 flex-wrap">
                {TEAM_MEMBERS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() =>
                      setSelectedAssignees((prev) =>
                        prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
                      )
                    }
                    className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
                      selectedAssignees.includes(name)
                        ? 'bg-gray-700 text-white border-gray-700'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              {selectedAssignees.length > 0 && (
                <p className="mt-1.5 text-xs text-gray-500">선택됨: {selectedAssignees.join(', ')}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_event"
                checked={isEvent}
                onChange={(e) => setIsEvent(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <label htmlFor="is_event" className="text-sm font-medium text-gray-700 cursor-pointer">
                이벤트 일정 <span className="text-xs text-gray-400 font-normal">(주간보고 이벤트 섹션에 포함)</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">상세</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                className={`${inputBase} resize-none`}
                placeholder="메모·체크리스트 등"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 space-y-2">
              <p className="flex items-start gap-1">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{error}</span>
              </p>
              {error.includes('assignee') && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-md p-2 pl-3">
                  Supabase SQL Editor에서 실행:{' '}
                  <code className="text-[11px] break-all">
                    alter table public.tasks add column if not exists assignee text;
                  </code>
                </p>
              )}
              {error.includes('registered_date') && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-md p-2 pl-3">
                  Supabase SQL Editor에서 실행:{' '}
                  <code className="text-[11px] break-all">
                    alter table public.tasks add column if not exists registered_date date;
                  </code>
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => !saving && onClose()}
              className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium text-base rounded-md transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white font-medium text-base rounded-md disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  저장 중
                </>
              ) : (
                '저장'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
